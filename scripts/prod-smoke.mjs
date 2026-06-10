// End-to-end prod smoke test:
// 1) test1 wallet files a fresh policy+claim+evidence+timeline on Studionet
// 2) hit prod /api/keeper/judge-claim with the new claim id
// 3) poll get_claim_review until the verdict lands
// 4) print full review + final claim status
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, requireEnv, CONTRACT_ADDRESS,
} from "./lib.mjs";

const PROD_URL = "https://waypoint-consensus.vercel.app";
const KEEPER_SECRET = requireEnv("KEEPER_SECRET");

async function callKeeper(claimId) {
  const r = await fetch(`${PROD_URL}/api/keeper/judge-claim`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEEPER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claimId }),
  });
  const body = await r.text();
  return { status: r.status, body };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const t0 = Date.now();
console.log(`\nProd smoke test against ${PROD_URL}`);
console.log(`Contract: ${CONTRACT_ADDRESS}\n`);

const { client, address } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
const read = await makeReadClient();
console.log(`Filing as: ${address}\n`);

const policyId = nowId("pol-prod");
const claimId  = nowId("clm-prod");

// Policy
await writeOrThrow({
  client, functionName: "create_policy",
  args: [policyId, JSON.stringify({
    name: "Acme Global Traveller Plus", provider: "Acme Insurance Co.",
    reference: "ACM-GTP-2026",
    summary: "Covers flight delays over 6 hours, missed connections, lost baggage, and reasonable mitigation expenses up to USD 2000. Excludes acts of war and pre-existing conditions.",
    coverage: ["flight_delay","flight_cancellation","missed_connection","lost_baggage","hotel_expense","meal_expense"],
    exclusions: ["acts_of_war","pre_existing_conditions","intentional_misconduct"],
    delayThresholdHours: 6, baggageLimit: 1500,
    cancellationTerms: "Refund if airline cancels for covered reason.", maxPayout: 2000,
  })],
});

// Claim
await writeOrThrow({
  client, functionName: "file_claim",
  args: [claimId, policyId, JSON.stringify({
    claimType: "FLIGHT_DELAY",
    route: { from: "Lagos (LOS)", to: "New York (JFK)", connection: "London (LHR)" },
    provider: "Delta Air Lines", bookingReference: "DL220-PROD-SMOKE",
    incidentDate: "2026-06-05", claimedAmount: 650, currency: "USD",
    explanation: "Delta DL220 LHR→JFK departed 9h late due to crew rest violation. Booking lost, mitigated with emergency hotel + meals. Airline issued written delay notice.",
  })],
});

// Evidence (airline notice + hotel + meals)
await writeOrThrow({ client, functionName: "add_evidence",
  args: [nowId("ev"), claimId, JSON.stringify({
    type: "AIRLINE_NOTICE", title: "9-hour Delay Notice DL220",
    uri: "https://delta.com/notice/DL220", source: "Delta Air Lines",
    issuedAt: "2026-06-05T10:00",
    description: "Official airline email confirming 9h delay due to crew rest violation.",
    privacy: "PUBLIC",
  })],
});
await writeOrThrow({ client, functionName: "add_evidence",
  args: [nowId("ev"), claimId, JSON.stringify({
    type: "HOTEL_RECEIPT", title: "Hilton JFK overnight",
    uri: "ipfs://placeholder/hilton.pdf", source: "Hilton Garden Inn JFK",
    issuedAt: "2026-06-06T07:30",
    description: "Itemised one-night stay USD 380.",
    privacy: "PUBLIC",
  })],
});

// Timeline
await writeOrThrow({ client, functionName: "set_claim_timeline",
  args: [claimId, JSON.stringify([
    { time: "2026-06-05T14:00", location: "LHR T3", event_type: "SCHEDULED_DEPARTURE", description: "DL220 scheduled departure.", confidence: "HIGH" },
    { time: "2026-06-05T14:30", location: "LHR T3", event_type: "DELAY_NOTICE", description: "Airline emails 9h delay.", confidence: "HIGH" },
    { time: "2026-06-05T23:00", location: "LHR T3", event_type: "ACTUAL_DEPARTURE", description: "DL220 actually departed.", confidence: "HIGH" },
    { time: "2026-06-06T06:30", location: "JFK", event_type: "EXPENSE_INCURRED", description: "Hotel + meals during wait.", confidence: "MEDIUM" },
  ])],
});

const initial = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));
console.log(`\n✓ Initial claim state: status=${initial.status}, claimant=${initial.claimant}\n`);

// Trigger prod keeper
console.log(`Calling prod /api/keeper/judge-claim...`);
const r = await callKeeper(claimId);
console.log(`  status: ${r.status}`);
console.log(`  body:   ${r.body}\n`);

// Poll for review
console.log(`Polling get_claim_review for verdict...`);
let review = null;
for (let i = 0; i < 60; i++) {
  await sleep(5000);
  const raw = await readOrThrow({ client: read, functionName: "get_claim_review", args: [claimId] });
  review = parseJsonReadResult(raw);
  process.stdout.write(".");
  if (review && review.decision) { console.log(""); break; }
}

if (!review || !review.decision) {
  console.log("\n⚠ Verdict did not appear within 5 minutes.");
  process.exit(1);
}

const finalClaim = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim", args: [claimId] }));

console.log(`\n══════ VERDICT ══════`);
console.log(`Decision:         ${review.decision}`);
console.log(`Coverage:         ${review.coverage_status}`);
console.log(`Payout %:         ${review.payout_percent}`);
console.log(`Claimed amount:   ${review.claimed_amount} ${review.currency ?? finalClaim.currency}`);
console.log(`Approved amount:  ${review.approved_amount}`);
console.log(`Confidence band:  ${review.confidence_band}`);
console.log(`Risk level:       ${review.risk_level}`);
console.log(`Gates:`);
for (const g of (review.policy_gates ?? [])) console.log(`  ${g.gate.padEnd(28)} ${g.result}`);
console.log(`Reason codes:     ${(review.reason_codes ?? []).join(", ")}`);
console.log(`Claim status after review: ${finalClaim.status}`);
console.log(`\nClaim id: ${claimId}`);
console.log(`Total wall-clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`UI link: ${PROD_URL}/claims/${claimId}`);
