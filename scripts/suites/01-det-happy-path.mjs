// Suite 01 - deterministic happy path.
// Walks policy → file_claim → add_evidence → set_claim_timeline,
// reading state back after each write.
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, assert, assertEq,
} from "../lib.mjs";

export default async function suite01() {
  const { client, address } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const read = await makeReadClient();

  const policyId = nowId("pol-det");
  const claimId = nowId("clm-det");
  const evidenceId = nowId("ev-det");

  // 1. create_policy
  const policyPayload = {
    name: "Acme Global Traveller Plus",
    provider: "Acme Insurance Co.",
    reference: "ACM-GTP-2026",
    summary: "Covers flight delays over 6 hours, cancellations for covered reasons, missed connections, lost or delayed baggage, and reasonable mitigation expenses up to USD 2000. Excludes acts of war, undeclared pre-existing conditions, intentional misconduct.",
    coverage: ["flight_delay", "flight_cancellation", "missed_connection", "lost_baggage", "hotel_expense", "meal_expense"],
    exclusions: ["acts_of_war", "pre_existing_conditions", "intentional_misconduct"],
    delayThresholdHours: 6,
    baggageLimit: 1500,
    cancellationTerms: "Refund if cancelled by airline for covered reason; partial cover for traveller-initiated cancellation within 24h of departure due to documented medical emergency.",
    maxPayout: 2000,
    documentUri: "ipfs://placeholder/acme-gtp-2026.pdf",
  };
  await writeOrThrow({
    client, functionName: "create_policy",
    args: [policyId, JSON.stringify(policyPayload)],
  });

  const policyRead = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_policy", args: [policyId] }));
  assert(policyRead, "policy not stored");
  assertEq(policyRead.provider, policyPayload.provider, "policy provider round-trip");

  // 2. file_claim
  const claimPayload = {
    claimType: "FLIGHT_DELAY",
    route: { from: "Lagos (LOS)", to: "New York (JFK)", connection: "London (LHR)" },
    provider: "Delta Air Lines",
    bookingReference: "DL220-7XK9P",
    incidentDate: "2026-06-05",
    claimedAmount: 650,
    currency: "USD",
    explanation: "Delta DL220 LHR→JFK departed 9 hours late due to crew rest violation. Booking lost, mitigated with emergency hotel and meals. Airline issued written delay notice.",
  };
  await writeOrThrow({
    client, functionName: "file_claim",
    args: [claimId, policyId, JSON.stringify(claimPayload)],
  });

  const claim = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));
  assert(claim, "claim not stored");
  assertEq(claim.id, claimId, "claim id round-trip");
  assertEq(claim.policyId, policyId, "claim policyId round-trip");
  assertEq(claim.status, "FILED", "filed claim should be in FILED status");
  assertEq(claim.claimant?.toLowerCase(), address.toLowerCase(), "claimant should equal caller");

  // 3. add_evidence
  const evidencePayload = {
    type: "AIRLINE_NOTICE",
    title: "9-hour Delay Notice - DL220",
    uri: "https://delta.com/notice/DL220-delay",
    source: "Delta Air Lines",
    issuedAt: "2026-06-05T10:00",
    description: "Official airline email confirming DL220 LHR→JFK delayed 9h due to crew rest violation.",
    privacy: "PUBLIC",
  };
  await writeOrThrow({
    client, functionName: "add_evidence",
    args: [evidenceId, claimId, JSON.stringify(evidencePayload)],
  });

  const evidence = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim_evidence", args: [claimId] }));
  assert(Array.isArray(evidence) && evidence.length >= 1, "evidence array should have ≥1 entry");
  const ev = evidence.find(e => e.id === evidenceId);
  assert(ev, "evidence with our id not found");
  assertEq(ev.title, evidencePayload.title, "evidence title round-trip");

  // 4. set_claim_timeline
  const timeline = [
    { id: "tl-1", time: "2026-06-05T14:00", location: "LHR T3", event_type: "SCHEDULED_DEPARTURE", description: "DL220 scheduled departure.", confidence: "HIGH" },
    { id: "tl-2", time: "2026-06-05T14:30", location: "LHR T3", event_type: "DELAY_NOTICE", description: "Airline emails 9h delay.", confidence: "HIGH" },
    { id: "tl-3", time: "2026-06-05T23:00", location: "LHR T3", event_type: "ACTUAL_DEPARTURE", description: "DL220 actually departed.", confidence: "HIGH" },
    { id: "tl-4", time: "2026-06-06T06:30", location: "JFK", event_type: "EXPENSE_INCURRED", description: "Hotel + meals during wait.", confidence: "MEDIUM" },
  ];
  await writeOrThrow({
    client, functionName: "set_claim_timeline",
    args: [claimId, JSON.stringify(timeline)],
  });

  const tl = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim_timeline", args: [claimId] }));
  assert(Array.isArray(tl), "timeline should be an array");
  assertEq(tl.length, timeline.length, "timeline length round-trip");

  // 5. user_claims & protocol_stats
  const userClaims = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_user_claims", args: [address] }));
  assert(Array.isArray(userClaims) && userClaims.includes(claimId), "user_claims should include the new claim id");

  const stats = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_protocol_stats" }));
  assert(typeof stats.claims === "number" && stats.claims > 0, "protocol stats claim counter should be > 0");

  return { policyId, claimId, evidenceId, claimStatus: claim.status };
}
