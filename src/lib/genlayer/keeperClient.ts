// SERVER-ONLY. Do not import from any "use client" file.
import "server-only";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

let cached: any = null;

export function getKeeperContractAddress(): `0x${string}` {
  const addr = process.env.WAYPOINT_CONSENSUS_CONTRACT_ADDRESS;
  if (!addr || !addr.startsWith("0x")) {
    throw new Error("WAYPOINT_CONSENSUS_CONTRACT_ADDRESS not set on server.");
  }
  return addr as `0x${string}`;
}

export function getKeeperSecret(): string {
  const s = process.env.KEEPER_SECRET;
  if (!s) throw new Error("KEEPER_SECRET not set on server.");
  return s;
}

/**
 * Build the keeper genlayer-js client (read+write capable) using the
 * server-only KEEPER_PRIVATE_KEY. Never expose the resulting client or
 * the key to the browser.
 */
export async function getKeeperClient() {
  if (cached) return cached;
  const pk = process.env.KEEPER_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x")) throw new Error("KEEPER_PRIVATE_KEY not set on server.");
  const account = createAccount(pk as `0x${string}`);
  const client: any = createClient({ chain: studionet as any, account: account as any });
  try { if (typeof client.connect === "function") await client.connect("studionet"); } catch (e) { console.warn("keeper connect warn:", e); }
  try { if (typeof client.initializeConsensusSmartContract === "function") await client.initializeConsensusSmartContract(); } catch (e) { console.warn("keeper init warn:", e); }
  cached = client;
  return client;
}

export function verifyKeeperAuth(headerVal: string | null): boolean {
  if (!headerVal) return false;
  const expected = `Bearer ${getKeeperSecret()}`;
  // constant-time-ish compare
  if (headerVal.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerVal.length; i++) {
    mismatch |= headerVal.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

const REVIEWABLE_STATUSES = new Set([
  "FILED",
  "READY_FOR_REVIEW",
  "NEEDS_MORE_EVIDENCE",
]);

const NON_REVIEWABLE_STATUSES = new Set([
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "FINALIZED",
  "DISPUTED",
  "UNDER_CONSENSUS_REVIEW",
]);

export function isReviewableStatus(s: string | undefined | null): boolean {
  if (!s) return false;
  return REVIEWABLE_STATUSES.has(s) && !NON_REVIEWABLE_STATUSES.has(s);
}

export async function safeReadClaim(client: any, address: `0x${string}`, claimId: string): Promise<any | null> {
  try {
    const raw = await client.readContract({ address, functionName: "get_claim", args: [claimId] });
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { return null; }
}

export async function safeReadReview(client: any, address: `0x${string}`, claimId: string): Promise<any | null> {
  try {
    const raw = await client.readContract({ address, functionName: "get_claim_review", args: [claimId] });
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch { return null; }
}

export async function listAllClaimIds(client: any, address: `0x${string}`): Promise<string[]> {
  try {
    const raw = await client.readContract({ address, functionName: "list_claims", args: [] });
    if (!raw) return [];
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * Fire-and-forget judge_claim. We do NOT await consensus inside the API route —
 * Vercel serverless functions time out at 10s (Hobby) or 60s (Pro) and GenLayer
 * nondet consensus often takes 30s+. We submit the tx, return the hash, and let
 * the chain finish asynchronously. cron-job.org will skip the claim on its next
 * tick once get_claim_review() returns a non-empty review.
 */
export async function judgeClaim(client: any, address: `0x${string}`, claimId: string): Promise<string> {
  const txHash: any = await client.writeContract({
    address, functionName: "judge_claim", args: [claimId], value: BigInt(0),
  });
  return typeof txHash === "string" ? txHash : (txHash?.hash ?? "");
}
