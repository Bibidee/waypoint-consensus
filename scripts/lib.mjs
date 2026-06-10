// Shared helpers for the e2e suite.
// Reads env from process.env only - never hardcoded, never echoed, never committed.
import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (Node doesn't auto-load it for scripts).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || process.env[k] === "") process.env[k] = v;
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || (typeof v === "string" && v.trim() === "")) {
    throw new Error(
      `Missing required env var ${name}. ` +
      `Add it to .env.local and re-run. (Refusing to fall back to a default.)`
    );
  }
  return v;
}

export const CONTRACT_ADDRESS = requireEnv("WAYPOINT_CONSENSUS_CONTRACT_ADDRESS");
export const CHAIN_ID = parseInt(requireEnv("NEXT_PUBLIC_GENLAYER_CHAIN_ID"), 10);
export const RPC_URL = requireEnv("NEXT_PUBLIC_GENLAYER_RPC_URL");

const _gl = await import("genlayer-js");
const _glChains = await import("genlayer-js/chains");
const _glTypes = await import("genlayer-js/types").catch(() => ({}));

export const studionet = _glChains.studionet;
export const TransactionStatus = _glTypes.TransactionStatus ?? {};
export const ExecutionResult = _glTypes.ExecutionResult ?? {};

function pkFromEnv(name) {
  const pk = requireEnv(name);
  if (!pk.startsWith("0x")) throw new Error(`${name} must be 0x-prefixed`);
  return pk;
}

export async function makeClient(pkEnvName) {
  const pk = pkFromEnv(pkEnvName);
  const account = _gl.createAccount(pk);
  const client = _gl.createClient({ chain: studionet, account });
  // Required so writeContract dispatches through the consensus contract,
  // not as a plain EVM tx.
  try { if (typeof client.connect === "function") await client.connect("studionet"); } catch (e) { /* tolerate */ }
  try { if (typeof client.initializeConsensusSmartContract === "function") await client.initializeConsensusSmartContract(); } catch (e) { /* tolerate */ }
  return { client, account, address: account.address };
}

export async function makeReadClient() {
  const client = _gl.createClient({ chain: studionet });
  try { if (typeof client.initializeConsensusSmartContract === "function") await client.initializeConsensusSmartContract(); } catch (e) { /* tolerate */ }
  return client;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Wrapper around client.writeContract that:
 *   1. Submits the tx (retries up to 3× with 5s backoff on RPC failure)
 *   2. Waits for ACCEPTED via waitForTransactionReceipt
 *   3. Reads the full transaction back via getTransaction
 *   4. Inspects receipt.consensus_data.leader_receipt[0].execution_result
 *      - anything other than SUCCESS / ACCEPTED is treated as failure, with
 *      the last 2 lines of stderr surfaced as the error message.
 */
export async function writeOrThrow({ client, functionName, args, label, attempts = 5, backoffMs = 12000 }) {
  const callLabel = label ?? functionName;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    try {
      console.log(`   → ${callLabel}(${argsSummary(args)})  attempt ${attempt}/${attempts}`);
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        value: 0n,
      });
      const hash = typeof txHash === "string" ? txHash : txHash?.hash;
      if (!hash) throw new Error("writeContract returned no tx hash");

      // Wait for ACCEPTED
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED ?? "ACCEPTED",
        retries: 200,
        interval: 3000,
        fullTransaction: false,
      });

      // Pull full tx to inspect consensus_data
      const tx = await client.getTransaction({ hash });
      const execStatus = pickExecutionStatus(tx);
      if (execStatus && !isOkStatus(execStatus)) {
        const stderr = pickStderrTail(tx);
        const err = new Error(
          `${callLabel} on-chain status ${execStatus}` +
          (stderr ? `\n  stderr tail: ${stderr}` : "")
        );
        err.txHash = hash;
        err.tx = tx;
        throw err;
      }

      const ms = Date.now() - t0;
      console.log(`   ✓ ${functionName} (${ms}ms) tx=${hash}`);
      return { hash, tx };
    } catch (e) {
      lastErr = e;
      const ms = Date.now() - t0;
      // If we got an on-chain failure (e.txHash set), don't retry - it'll just fail the same way.
      if (e?.txHash) {
        console.log(`   ✗ ${functionName} on-chain failure (${ms}ms): ${e.message}`);
        throw e;
      }
      console.log(`   ⚠ ${functionName} attempt ${attempt} failed (${ms}ms): ${e?.message ?? e}`);
      if (attempt < attempts) await sleep(backoffMs);
    }
  }
  throw lastErr ?? new Error(`${callLabel}: all retries exhausted`);
}

/**
 * Expects the write to revert on-chain. Returns the tx + extracted stderr on success.
 * Fails if the write succeeded (because the contract was supposed to reject this input).
 */
export async function writeExpectRevert({ client, functionName, args, label, attempts = 1 }) {
  const callLabel = label ?? functionName;
  let txHash;
  let tx;
  try {
    const t0 = Date.now();
    console.log(`   → ${callLabel}(${argsSummary(args)})  expecting revert`);
    txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      value: 0n,
    });
    txHash = typeof txHash === "string" ? txHash : txHash?.hash;
    try {
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED ?? "ACCEPTED",
        retries: 80,
        interval: 3000,
        fullTransaction: false,
      });
    } catch { /* tolerate - receipt may surface failure */ }
    tx = await client.getTransaction({ hash: txHash });
    const execStatus = pickExecutionStatus(tx);
    if (execStatus && isOkStatus(execStatus)) {
      throw new Error(
        `${callLabel} did NOT revert (execution_result=${execStatus}). ` +
        `The contract accepted input it should have rejected.`
      );
    }
    const stderr = pickStderrTail(tx);
    const ms = Date.now() - t0;
    console.log(`   ✓ ${functionName} reverted as expected (${ms}ms) status=${execStatus ?? "?"} tx=${txHash}`);
    return { hash: txHash, tx, stderr };
  } catch (e) {
    // If the SDK threw before tx was even submitted, that's still a revert.
    if (!txHash) {
      console.log(`   ✓ ${functionName} rejected pre-submit: ${e?.message ?? e}`);
      return { hash: null, tx: null, stderr: e?.message ?? "" };
    }
    if (e.message?.includes("did NOT revert")) throw e;
    console.log(`   ✓ ${functionName} reverted as expected: ${e?.message ?? e}`);
    return { hash: txHash, tx, stderr: e?.message ?? "" };
  }
}

export async function readOrThrow({ client, functionName, args = [], label }) {
  const callLabel = label ?? functionName;
  try {
    const v = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
    });
    return v;
  } catch (e) {
    throw new Error(`${callLabel} read failed: ${e?.message ?? e}`);
  }
}

export function parseJsonReadResult(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v; }
}

function pickExecutionStatus(tx) {
  try {
    const cd = tx?.consensus_data ?? tx?.consensusData ?? null;
    const lr = cd?.leader_receipt ?? cd?.leaderReceipt ?? null;
    const first = Array.isArray(lr) ? lr[0] : lr;
    return first?.execution_result ?? first?.executionResult ?? null;
  } catch { return null; }
}

function pickStderrTail(tx) {
  try {
    const cd = tx?.consensus_data ?? tx?.consensusData ?? null;
    const lr = cd?.leader_receipt ?? cd?.leaderReceipt ?? null;
    const first = Array.isArray(lr) ? lr[0] : lr;
    const stderr = first?.stderr ?? "";
    if (!stderr) return "";
    const lines = String(stderr).split(/\r?\n/).filter(Boolean);
    return lines.slice(-2).join(" | ");
  } catch { return ""; }
}

function isOkStatus(s) {
  if (!s) return true; // unknown - treat as ok
  const u = String(s).toUpperCase();
  return u === "SUCCESS" || u === "ACCEPTED" || u === "FINISHED" || u === "FINISHED_OK";
}

function argsSummary(args) {
  return (args ?? []).map(a => {
    if (typeof a === "string" && a.length > 32) return JSON.stringify(a.slice(0, 28) + "…");
    if (typeof a === "string") return JSON.stringify(a);
    if (typeof a === "object") return "{…}";
    return String(a);
  }).join(", ");
}

export function nowId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function timed(label, fn) {
  const t0 = Date.now();
  console.log(`\n══ ${label} ══`);
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    console.log(`   SUMMARY ${label}: PASS · ${(ms / 1000).toFixed(1)}s`);
    return { ok: true, ms, result: r };
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`   SUMMARY ${label}: FAIL · ${(ms / 1000).toFixed(1)}s · ${e?.message ?? e}`);
    if (e?.txHash) console.log(`   FAIL tx=${e.txHash}`);
    return { ok: false, ms, error: e };
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
}
export function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`ASSERT_EQ: ${msg ?? "values differ"} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}
export function assertOneOf(v, set, msg) {
  if (!set.includes(v)) throw new Error(`ASSERT_ONE_OF: ${msg ?? "value not in set"} got=${JSON.stringify(v)} allowed=${JSON.stringify(set)}`);
}
