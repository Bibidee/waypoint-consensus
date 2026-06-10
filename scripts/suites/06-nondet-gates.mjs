// Suite 06 - interpret_policy_gate per-gate non-deterministic.
import {
  makeClient, makeReadClient, writeOrThrow, readOrThrow, parseJsonReadResult,
  nowId, assert, assertOneOf,
} from "../lib.mjs";

const ALLOWED_GATE_RESULTS = ["PASSED","FAILED","PARTIAL","UNCLEAR","NOT_APPLICABLE"];
const ALLOWED_BANDS = ["LOW","MEDIUM","HIGH"];
const GATES_TO_TEST = ["POLICY_ACTIVE", "EVENT_COVERED", "RECEIPTS_SUPPORTED", "FILED_IN_WINDOW"];

export default async function suite06() {
  const { client } = await makeClient("TEST_WALLET_1_PRIVATE_KEY");
  const read = await makeReadClient();
  const policyId = nowId("pol-gt");
  const claimId = nowId("clm-gt");

  await writeOrThrow({ client, functionName: "create_policy", args: [policyId, JSON.stringify({ name: "p", provider: "x", reference: "r", summary: "covers flight delays >6h", coverage: ["flight_delay"], exclusions: [], delayThresholdHours: 6, baggageLimit: 1000, cancellationTerms: "", maxPayout: 2000 })] });
  await writeOrThrow({ client, functionName: "file_claim", args: [claimId, policyId, JSON.stringify({ claimType: "FLIGHT_DELAY", route: { from: "A", to: "B" }, provider: "X", bookingReference: "BK", incidentDate: "2026-06-01", claimedAmount: 500, currency: "USD", explanation: "9h delay confirmed" })] });
  await writeOrThrow({ client, functionName: "add_evidence", args: [nowId("ev"), claimId, JSON.stringify({ type: "AIRLINE_NOTICE", title: "delay 9h", uri: "x", source: "Delta", description: "9h delay notice", privacy: "PUBLIC" })] });

  const perGate = {};
  for (const gate of GATES_TO_TEST) {
    console.log(`   …interpret_policy_gate(${gate})…`);
    await writeOrThrow({ client, functionName: "interpret_policy_gate", args: [claimId, gate], label: `interpret_policy_gate ${gate}`, attempts: 2 });

    const review = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_claim_review", args: [claimId] }));
    const gates = review?.policy_gates ?? [];
    const g = gates.find(x => x.gate === gate);
    assert(g, `gate ${gate} not found in policy_gates after interpret_policy_gate`);
    assertOneOf(g.result, ALLOWED_GATE_RESULTS, `gate ${gate} result`);
    if (g.confidence_band) assertOneOf(g.confidence_band, ALLOWED_BANDS, `gate ${gate} confidence_band`);
    perGate[gate] = g;
  }

  return { claimId, perGate };
}
