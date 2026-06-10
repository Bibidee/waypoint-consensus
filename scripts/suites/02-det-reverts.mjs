// Suite 02 - deterministic revert paths.
// For each VmUserError branch the contract has, build a scenario and confirm
// it reverts on-chain (not just thrown by the SDK), and that no state changed.
import {
  makeClient, makeReadClient, writeOrThrow, writeExpectRevert,
  readOrThrow, parseJsonReadResult, nowId, assert, assertEq,
} from "../lib.mjs";

export default async function suite02() {
  const { client } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const read = await makeReadClient();

  const policyId = nowId("pol-rev");
  const claimId = nowId("clm-rev");

  // Seed: one valid policy + claim we can reuse to trigger downstream reverts
  await writeOrThrow({
    client, functionName: "create_policy",
    args: [policyId, JSON.stringify({ name: "p", provider: "x", reference: "r", summary: "s", coverage: [], exclusions: [], delayThresholdHours: 6, baggageLimit: 1000, cancellationTerms: "", maxPayout: 2000 })],
  });
  await writeOrThrow({
    client, functionName: "file_claim",
    args: [claimId, policyId, JSON.stringify({ claimType: "FLIGHT_DELAY", route: { from: "A", to: "B" }, provider: "x", bookingReference: "BK1", incidentDate: "2026-06-05", claimedAmount: 100, currency: "USD", explanation: "seed" })],
  });

  const statsBefore = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_protocol_stats" }));

  // R1 - empty policy_id
  await writeExpectRevert({
    client, functionName: "create_policy", args: ["", "{}"], label: "create_policy empty id",
  });

  // R2 - malformed policy JSON
  await writeExpectRevert({
    client, functionName: "create_policy", args: [nowId("pol-bad"), "this-is-not-json"], label: "create_policy bad JSON",
  });

  // R3 - duplicate policy id
  await writeExpectRevert({
    client, functionName: "create_policy", args: [policyId, "{}"], label: "create_policy duplicate",
  });

  // R4 - file_claim with unknown policy
  await writeExpectRevert({
    client, functionName: "file_claim",
    args: [nowId("clm-x"), nowId("pol-missing"), JSON.stringify({ claimType: "FLIGHT_DELAY", claimedAmount: 100 })],
    label: "file_claim unknown policy",
  });

  // R5 - file_claim with malformed JSON
  await writeExpectRevert({
    client, functionName: "file_claim",
    args: [nowId("clm-x"), policyId, "not-json"],
    label: "file_claim bad JSON",
  });

  // R6 - duplicate claim id
  await writeExpectRevert({
    client, functionName: "file_claim",
    args: [claimId, policyId, JSON.stringify({ claimType: "FLIGHT_DELAY" })],
    label: "file_claim duplicate",
  });

  // R7 - add_evidence on missing claim
  await writeExpectRevert({
    client, functionName: "add_evidence",
    args: [nowId("ev"), nowId("clm-missing"), JSON.stringify({ type: "OTHER", title: "x" })],
    label: "add_evidence missing claim",
  });

  // R8 - add_evidence with empty evidence_id
  await writeExpectRevert({
    client, functionName: "add_evidence",
    args: ["", claimId, JSON.stringify({ type: "OTHER" })],
    label: "add_evidence empty evidence_id",
  });

  // R9 - set_claim_timeline on missing claim
  await writeExpectRevert({
    client, functionName: "set_claim_timeline",
    args: [nowId("clm-missing"), "[]"],
    label: "set_claim_timeline missing claim",
  });

  // R10 - open_dispute on missing claim
  await writeExpectRevert({
    client, functionName: "open_dispute",
    args: [nowId("dsp"), nowId("clm-missing"), "{}"],
    label: "open_dispute missing claim",
  });

  // R11 - review_dispute on missing dispute (nondet, but the precondition fails fast)
  await writeExpectRevert({
    client, functionName: "review_dispute",
    args: [nowId("dsp-missing")],
    label: "review_dispute missing dispute",
  });

  // R12 - interpret_policy_gate with unsupported gate name
  await writeExpectRevert({
    client, functionName: "interpret_policy_gate",
    args: [claimId, "TOTALLY_BOGUS_GATE_NAME"],
    label: "interpret_policy_gate unsupported gate",
  });

  // R13 - judge_claim on missing claim
  await writeExpectRevert({
    client, functionName: "judge_claim",
    args: [nowId("clm-missing")],
    label: "judge_claim missing claim",
  });

  // Confirm protocol stats counters did NOT advance from the reverts (the
  // seed writes earlier did advance them, so compare to statsBefore).
  const statsAfter = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_protocol_stats" }));
  // policies/claims/disputes should equal statsBefore (since every attempted write reverted).
  assertEq(statsAfter.policies, statsBefore.policies, "policies counter changed after reverts");
  assertEq(statsAfter.claims, statsBefore.claims, "claims counter changed after reverts");
  assertEq(statsAfter.disputes, statsBefore.disputes, "disputes counter changed after reverts");

  return { policyId, claimId, statsBefore, statsAfter };
}
