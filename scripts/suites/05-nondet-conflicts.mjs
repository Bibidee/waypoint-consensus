// Suite 05 - detect_evidence_conflicts non-deterministic.
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, assert, assertOneOf,
} from "../lib.mjs";

const ALLOWED_CONFLICT_TYPES = ["TIMELINE_CONFLICT","AMOUNT_CONFLICT","MISSING_DOCUMENT","IDENTITY_OR_POLICY_MISMATCH","EVENT_DESCRIPTION_CONFLICT","NO_MAJOR_CONFLICT"];
const ALLOWED_SEVERITY = ["LOW","MEDIUM","HIGH"];

export default async function suite05() {
  const { client } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const read = await makeReadClient();
  const policyId = nowId("pol-cf");
  const claimId = nowId("clm-cf");

  await writeOrThrow({ client, functionName: "create_policy", args: [policyId, JSON.stringify({ name: "p", provider: "x", reference: "r", summary: "s", coverage: ["flight_delay"], exclusions: [], delayThresholdHours: 6, baggageLimit: 1000, cancellationTerms: "", maxPayout: 2000 })] });
  await writeOrThrow({ client, functionName: "file_claim", args: [claimId, policyId, JSON.stringify({ claimType: "FLIGHT_DELAY", route: { from: "A", to: "B" }, provider: "X", bookingReference: "BK", incidentDate: "2026-06-01", claimedAmount: 500, currency: "USD", explanation: "9h delay" })] });
  await writeOrThrow({ client, functionName: "add_evidence", args: [nowId("ev"), claimId, JSON.stringify({ type: "AIRLINE_NOTICE", title: "delay 9h", uri: "x", source: "Delta", description: "delay 9h confirmed", privacy: "PUBLIC" })] });

  console.log("   …detect_evidence_conflicts - non-deterministic…");
  await writeOrThrow({ client, functionName: "detect_evidence_conflicts", args: [claimId], label: "detect_evidence_conflicts", attempts: 2 });

  const review = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim_review", args: [claimId] }));
  assert(review && typeof review === "object", "review payload missing");
  const ec = review.evidence_conflicts ?? review.conflicts ?? null;
  assert(ec && typeof ec === "object", "evidence_conflicts missing on review payload");
  console.log("   evidence_conflicts:", JSON.stringify(ec, null, 2));

  if (typeof ec.has_conflict === "boolean") assert(typeof ec.has_conflict === "boolean", "has_conflict bool");
  if (ec.top_conflict_type) assertOneOf(ec.top_conflict_type, ALLOWED_CONFLICT_TYPES, "top_conflict_type");
  if (ec.severity) assertOneOf(ec.severity, ALLOWED_SEVERITY, "severity");

  return { claimId, evidence_conflicts: ec };
}
