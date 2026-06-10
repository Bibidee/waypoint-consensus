// Suite 03 — judge_claim non-deterministic.
// Builds a fresh covered claim, calls judge_claim, validates the bounded review.
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, assert, assertEq, assertOneOf,
} from "../lib.mjs";

const ALLOWED_DECISIONS = ["APPROVED","PARTIALLY_APPROVED","REJECTED","NEEDS_MORE_EVIDENCE","ESCALATE"];
const ALLOWED_COVERAGE = ["COVERED","COVERED_WITH_LIMITS","NOT_COVERED","UNCLEAR","EXCLUDED"];
const ALLOWED_GATE_RESULTS = ["PASSED","FAILED","PARTIAL","UNCLEAR","NOT_APPLICABLE"];
const ALLOWED_RISK = ["LOW","MEDIUM","HIGH","CRITICAL"];
const ALLOWED_BANDS = ["LOW","MEDIUM","HIGH"];
const ALLOWED_PAYOUT = [0,25,50,75,100];
const REQUIRED_GATES = ["POLICY_ACTIVE","EVENT_COVERED","THRESHOLD_MET","NO_EXCLUSION","EVENT_EVIDENCE_SUPPORTED","RECEIPTS_SUPPORTED","FILED_IN_WINDOW","REASONABLE_ACTIONS"];
const STATUS_BY_DECISION = {
  APPROVED: "APPROVED",
  PARTIALLY_APPROVED: "PARTIALLY_APPROVED",
  REJECTED: "REJECTED",
  NEEDS_MORE_EVIDENCE: "NEEDS_MORE_EVIDENCE",
  ESCALATE: "UNDER_CONSENSUS_REVIEW",
};

export default async function suite03() {
  const { client } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const read = await makeReadClient();

  const policyId = nowId("pol-nd");
  const claimId = nowId("clm-nd");

  await writeOrThrow({
    client, functionName: "create_policy",
    args: [policyId, JSON.stringify({
      name: "Acme GTP", provider: "Acme", reference: "ACM-GTP-2026",
      summary: "Covers flight delays over 6 hours, missed connections, lost baggage, and reasonable mitigation expenses up to USD 2000. Excludes acts of war and pre-existing conditions.",
      coverage: ["flight_delay","flight_cancellation","missed_connection","lost_baggage","hotel_expense","meal_expense"],
      exclusions: ["acts_of_war","pre_existing_conditions","intentional_misconduct"],
      delayThresholdHours: 6, baggageLimit: 1500,
      cancellationTerms: "Refund if airline cancels for covered reason.",
      maxPayout: 2000,
    })],
  });

  await writeOrThrow({
    client, functionName: "file_claim",
    args: [claimId, policyId, JSON.stringify({
      claimType: "FLIGHT_DELAY",
      route: { from: "Lagos (LOS)", to: "New York (JFK)", connection: "London (LHR)" },
      provider: "Delta Air Lines", bookingReference: "DL220-7XK9P",
      incidentDate: "2026-06-05", claimedAmount: 650, currency: "USD",
      explanation: "Delta DL220 LHR→JFK departed 9 hours late due to crew rest violation. Airline issued written delay notice. Mitigated with emergency hotel + meals.",
    })],
  });

  await writeOrThrow({
    client, functionName: "add_evidence",
    args: [nowId("ev"), claimId, JSON.stringify({
      type: "AIRLINE_NOTICE", title: "9-hour Delay Notice DL220",
      uri: "https://delta.com/notice/DL220", source: "Delta Air Lines",
      issuedAt: "2026-06-05T10:00",
      description: "Official airline email confirming 9h delay due to crew rest violation.",
      privacy: "PUBLIC",
    })],
  });
  await writeOrThrow({
    client, functionName: "add_evidence",
    args: [nowId("ev"), claimId, JSON.stringify({
      type: "HOTEL_RECEIPT", title: "Hilton JFK overnight",
      uri: "ipfs://placeholder/hilton.pdf", source: "Hilton Garden Inn JFK",
      issuedAt: "2026-06-06T07:30", description: "Itemised one-night stay USD 380.",
      privacy: "PUBLIC",
    })],
  });

  await writeOrThrow({
    client, functionName: "set_claim_timeline",
    args: [claimId, JSON.stringify([
      { time: "2026-06-05T14:00", location: "LHR T3", event_type: "SCHEDULED_DEPARTURE", description: "DL220 scheduled departure.", confidence: "HIGH" },
      { time: "2026-06-05T14:30", location: "LHR T3", event_type: "DELAY_NOTICE", description: "Airline emails 9h delay.", confidence: "HIGH" },
      { time: "2026-06-05T23:00", location: "LHR T3", event_type: "ACTUAL_DEPARTURE", description: "DL220 actually departed.", confidence: "HIGH" },
      { time: "2026-06-06T06:30", location: "JFK", event_type: "EXPENSE_INCURRED", description: "Hotel + meals.", confidence: "MEDIUM" },
    ])],
  });

  // === The actual nondet call ===
  console.log("   …calling judge_claim — this can take a few minutes for consensus…");
  await writeOrThrow({
    client, functionName: "judge_claim", args: [claimId], label: "judge_claim",
    attempts: 2,
  });

  const review = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim_review", args: [claimId] }));
  assert(review && typeof review === "object", "review JSON missing");
  console.log("   review:", JSON.stringify(review, null, 2));

  // Schema asserts
  assertOneOf(review.decision, ALLOWED_DECISIONS, "decision");
  assertOneOf(review.coverage_status, ALLOWED_COVERAGE, "coverage_status");
  assertOneOf(review.risk_level, ALLOWED_RISK, "risk_level");
  assertOneOf(review.confidence_band, ALLOWED_BANDS, "confidence_band");
  assertOneOf(review.payout_percent, ALLOWED_PAYOUT, "payout_percent");

  assert(Array.isArray(review.policy_gates), "policy_gates must be array");
  const gateNames = review.policy_gates.map(g => g.gate);
  for (const required of REQUIRED_GATES) {
    assert(gateNames.includes(required), `missing required gate ${required}`);
  }
  for (const g of review.policy_gates) {
    assertOneOf(g.result, ALLOWED_GATE_RESULTS, `gate ${g.gate} result`);
  }

  assert(Array.isArray(review.reason_codes) && review.reason_codes.length >= 1, "reason_codes must have ≥1 entry");

  // Approved amount = claimed * percent / 100 (deterministic contract calc)
  const expected = Math.round(review.claimed_amount * review.payout_percent / 100);
  assert(
    Math.abs(review.approved_amount - expected) <= 1,
    `approved_amount mismatch: got ${review.approved_amount}, expected ~${expected}`
  );

  // Status should reflect decision
  const claim = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));
  const expectedStatus = STATUS_BY_DECISION[review.decision];
  assertEq(claim.status, expectedStatus, `claim status should match decision (${review.decision} → ${expectedStatus})`);

  return {
    claimId,
    decision: review.decision,
    payout_percent: review.payout_percent,
    confidence_band: review.confidence_band,
    risk_level: review.risk_level,
    gates: review.policy_gates.length,
    reason_codes: review.reason_codes,
    approved_amount: review.approved_amount,
    claim_status: claim.status,
  };
}
