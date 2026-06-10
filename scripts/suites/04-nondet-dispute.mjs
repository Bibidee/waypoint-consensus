// Suite 04 - dispute review non-deterministic.
// Builds + judges a fresh claim, then test_wallet_2 opens a dispute, runs review_dispute.
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, assert, assertEq, assertOneOf,
} from "../lib.mjs";

const ALLOWED_DISPUTE_DECISIONS = ["ORIGINAL_DECISION_UPHELD","ORIGINAL_DECISION_ADJUSTED","MORE_EVIDENCE_REQUIRED","ESCALATE_TO_HUMAN_ARBITRATION","DISPUTE_REJECTED"];
const ALLOWED_DECISIONS = ["APPROVED","PARTIALLY_APPROVED","REJECTED","NEEDS_MORE_EVIDENCE","ESCALATE"];
const ALLOWED_BANDS = ["LOW","MEDIUM","HIGH"];
const ALLOWED_PAYOUT = [0,25,50,75,100];

export default async function suite04() {
  const w1 = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const w2 = await makeClient("TEST_WALLET_2_PRIVATE_KEY");
  const read = await makeReadClient();

  const policyId = nowId("pol-dsp");
  const claimId = nowId("clm-dsp");
  const disputeId = nowId("dsp");

  // w1 sets up + judges a claim
  await writeOrThrow({ client: w1.client, functionName: "create_policy", args: [policyId, JSON.stringify({ name: "P", provider: "X", reference: "R", summary: "s", coverage: ["flight_delay"], exclusions: [], delayThresholdHours: 6, baggageLimit: 1000, cancellationTerms: "", maxPayout: 2000 })] });
  await writeOrThrow({ client: w1.client, functionName: "file_claim", args: [claimId, policyId, JSON.stringify({ claimType: "FLIGHT_DELAY", route: { from: "A", to: "B" }, provider: "X", bookingReference: "BK", incidentDate: "2026-06-01", claimedAmount: 400, currency: "USD", explanation: "9h delay" })] });
  await writeOrThrow({ client: w1.client, functionName: "add_evidence", args: [nowId("ev"), claimId, JSON.stringify({ type: "AIRLINE_NOTICE", title: "delay", uri: "x", source: "x", description: "9h delay notice", privacy: "PUBLIC" })] });
  console.log("   …judge_claim before dispute…");
  await writeOrThrow({ client: w1.client, functionName: "judge_claim", args: [claimId], label: "judge_claim", attempts: 2 });

  // w2 opens a dispute
  await writeOrThrow({
    client: w2.client, functionName: "open_dispute",
    args: [disputeId, claimId, JSON.stringify({
      reason: "PAYMENT_AMOUNT_TOO_LOW",
      argument: "The receipts and the airline notice together support a fuller payout than initially approved. The notice confirms the policy threshold; expenses were itemised; the timeline matches.",
      newEvidence: "All previously attached evidence references stand.",
    })],
  });

  const claimAfterOpen = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));
  assertEq(claimAfterOpen.status, "DISPUTED", "claim status should be DISPUTED after open_dispute");

  console.log("   …review_dispute - this can take a few minutes…");
  await writeOrThrow({ client: w2.client, functionName: "review_dispute", args: [disputeId], label: "review_dispute", attempts: 2 });

  const dr = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_dispute_review", args: [disputeId] }));
  assert(dr && typeof dr === "object", "dispute_review missing");
  console.log("   dispute_review:", JSON.stringify(dr, null, 2));

  assertOneOf(dr.dispute_decision, ALLOWED_DISPUTE_DECISIONS, "dispute_decision");
  assertOneOf(dr.new_claim_decision, ALLOWED_DECISIONS, "new_claim_decision");
  assertOneOf(dr.confidence_band, ALLOWED_BANDS, "confidence_band");
  if (typeof dr.payout_percent === "number") assertOneOf(dr.payout_percent, ALLOWED_PAYOUT, "payout_percent");
  assert(Array.isArray(dr.reason_codes) && dr.reason_codes.length >= 1, "reason_codes ≥ 1");

  // Status should reflect new_claim_decision
  const claimAfter = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));
  return {
    claimId, disputeId,
    dispute_decision: dr.dispute_decision,
    new_claim_decision: dr.new_claim_decision,
    confidence_band: dr.confidence_band,
    payout_percent: dr.payout_percent,
    final_status: claimAfter.status,
  };
}
