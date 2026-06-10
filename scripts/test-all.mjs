#!/usr/bin/env node
// Waypoint Consensus end-to-end test runner.
// Usage:
//   node scripts/test-all.mjs                # run every suite
//   node scripts/test-all.mjs 00 01 02       # run a subset by prefix or name
import { timed, CONTRACT_ADDRESS, CHAIN_ID, RPC_URL } from "./lib.mjs";

const SUITES = [
  ["00-sanity",            () => import("./suites/00-sanity.mjs").then(m => m.default())],
  ["01-det-happy-path",    () => import("./suites/01-det-happy-path.mjs").then(m => m.default())],
  ["02-det-reverts",       () => import("./suites/02-det-reverts.mjs").then(m => m.default())],
  ["03-nondet-judge",      () => import("./suites/03-nondet-judge.mjs").then(m => m.default())],
  ["04-nondet-dispute",    () => import("./suites/04-nondet-dispute.mjs").then(m => m.default())],
  ["05-nondet-conflicts",  () => import("./suites/05-nondet-conflicts.mjs").then(m => m.default())],
  ["06-nondet-gates",      () => import("./suites/06-nondet-gates.mjs").then(m => m.default())],
];

function selectSuites(argv) {
  if (!argv.length) return SUITES;
  return SUITES.filter(([name]) => argv.some(arg => name.startsWith(arg) || name.includes(arg)));
}

(async () => {
  const args = process.argv.slice(2);
  const selected = selectSuites(args);
  if (!selected.length) {
    console.error(`No suites matched filter: ${JSON.stringify(args)}`);
    console.error(`Available: ${SUITES.map(s => s[0]).join(", ")}`);
    process.exit(2);
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Waypoint Consensus e2e suite`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Chain:    ${CHAIN_ID}  RPC: ${RPC_URL}`);
  console.log(`Suites:   ${selected.map(s => s[0]).join(", ")}`);
  console.log(`──────────────────────────────────────────────\n`);

  const totals = [];
  let firstFailure = null;
  const t0 = Date.now();

  for (const [name, runner] of selected) {
    const res = await timed(name, runner);
    totals.push({ name, ...res });
    if (!res.ok) {
      firstFailure = { name, error: res.error };
      break;
    }
  }

  const totalMs = Date.now() - t0;

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`FINAL REPORT`);
  console.log(`══════════════════════════════════════════════`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Network:  GenLayer Studionet (chain ${CHAIN_ID})`);
  console.log(`Total:    ${(totalMs / 1000).toFixed(1)}s\n`);

  for (const t of totals) {
    const tag = t.ok ? "PASS" : "FAIL";
    console.log(`  [${tag}] ${t.name}  ${(t.ms / 1000).toFixed(1)}s`);
  }
  if (firstFailure) {
    console.log(`\nFAILED at ${firstFailure.name}: ${firstFailure.error?.message ?? firstFailure.error}`);
    if (firstFailure.error?.txHash) console.log(`  tx=${firstFailure.error.txHash}`);
    process.exit(1);
  }
  console.log(`\nAll selected suites green.`);
})().catch((e) => {
  console.error(`\nFATAL: ${e?.message ?? e}`);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
