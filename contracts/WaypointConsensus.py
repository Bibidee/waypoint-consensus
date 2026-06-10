# v0.2.17
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from genlayer.errors import VmUserError
import json
import typing
ALLOWED_DECISIONS = {
    "APPROVED",
    "PARTIALLY_APPROVED",
    "REJECTED",
    "NEEDS_MORE_EVIDENCE",
    "ESCALATE",
}
ALLOWED_COVERAGE = {
    "COVERED",
    "COVERED_WITH_LIMITS",
    "NOT_COVERED",
    "UNCLEAR",
    "EXCLUDED",
}
ALLOWED_GATE_RESULTS = {
    "PASSED",
    "FAILED",
    "PARTIAL",
    "UNCLEAR",
    "NOT_APPLICABLE",
}
ALLOWED_RISK = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
}
ALLOWED_CONFIDENCE_BANDS = {
    "LOW",
    "MEDIUM",
    "HIGH",
}
ALLOWED_PAYOUT_PERCENT = {
    0,
    25,
    50,
    75,
    100,
}
REQUIRED_GATES = [
    "POLICY_ACTIVE",
    "EVENT_COVERED",
    "THRESHOLD_MET",
    "NO_EXCLUSION",
    "EVENT_EVIDENCE_SUPPORTED",
    "RECEIPTS_SUPPORTED",
    "FILED_IN_WINDOW",
    "REASONABLE_ACTIONS",
]
ALLOWED_REASON_CODES = {
    "POLICY_ACTIVE_CONFIRMED",
    "POLICY_DATE_UNCLEAR",
    "EVENT_TYPE_COVERED",
    "EVENT_TYPE_NOT_COVERED",
    "EXCLUSION_TRIGGERED",
    "NO_EXCLUSION_FOUND",
    "INSUFFICIENT_EVENT_EVIDENCE",
    "EVENT_EVIDENCE_ACCEPTED",
    "INSUFFICIENT_RECEIPTS",
    "RECEIPTS_ACCEPTED",
    "CLAIM_FILED_LATE",
    "CLAIM_FILED_IN_WINDOW",
    "AMOUNT_EXCEEDS_POLICY_LIMIT",
    "PARTIAL_DOCUMENTATION",
    "CONTRADICTORY_TIMELINE",
    "TRAVELLER_ACTED_REASONABLY",
    "TRAVELLER_DID_NOT_MITIGATE_LOSS",
    "AMBIGUOUS_POLICY_LANGUAGE",
    "HUMAN_REVIEW_RECOMMENDED",
}
ALLOWED_CONFLICT_SEVERITY = {
    "LOW",
    "MEDIUM",
    "HIGH",
}
ALLOWED_DISPUTE_DECISIONS = {
    "ORIGINAL_DECISION_UPHELD",
    "ORIGINAL_DECISION_ADJUSTED",
    "MORE_EVIDENCE_REQUIRED",
    "ESCALATE_TO_HUMAN_ARBITRATION",
    "DISPUTE_REJECTED",
}
ALLOWED_DISPUTE_REASON_CODES = {
    "ORIGINAL_REVIEW_REASONABLE",
    "ORIGINAL_REVIEW_UNSUPPORTED",
    "NEW_EVIDENCE_MATERIAL",
    "NEW_EVIDENCE_NOT_MATERIAL",
    "DISPUTE_ARGUMENT_ACCEPTED",
    "DISPUTE_ARGUMENT_REJECTED",
    "POLICY_INTERPRETATION_CHANGED",
    "AMOUNT_SHOULD_CHANGE",
    "MORE_EVIDENCE_NEEDED",
    "HUMAN_ARBITRATION_RECOMMENDED",
}
class WaypointConsensus(gl.Contract):
    owner: Address
    policy_count: u256
    claim_count: u256
    evidence_count: u256
    review_count: u256
    dispute_count: u256
    policies: TreeMap[str, str]
    claims: TreeMap[str, str]
    claim_evidence: TreeMap[str, str]
    claim_timelines: TreeMap[str, str]
    claim_reviews: TreeMap[str, str]
    disputes: TreeMap[str, str]
    dispute_reviews: TreeMap[str, str]
    user_claims: TreeMap[str, str]
    protocol_stats: TreeMap[str, str]
    def __init__(self):
        self.owner = gl.message.sender_address
        self.policy_count = u256(0)
        self.claim_count = u256(0)
        self.evidence_count = u256(0)
        self.review_count = u256(0)
        self.dispute_count = u256(0)
    # ---------- helpers ----------
    def _now(self) -> int:
        try:
            return int(gl.message.timestamp)
        except Exception:
            return 0
    def _json_loads_or_error(self, raw: str, msg: str):
        try:
            return json.loads(raw)
        except Exception:
            raise VmUserError(msg)
    def _append_user_claim(self, user: str, claim_id: str) -> None:
        existing = self.user_claims.get(user, "[]")
        try:
            arr = json.loads(existing)
            if not isinstance(arr, list):
                arr = []
        except Exception:
            arr = []
        if claim_id not in arr:
            arr.append(claim_id)
        self.user_claims[user] = json.dumps(arr)
    def _set_claim_status(self, claim_id: str, status: str) -> None:
        raw = self.claims.get(claim_id, "")
        if not raw:
            return
        try:
            obj = json.loads(raw)
        except Exception:
            return
        obj["status"] = status
        obj["updatedAt"] = self._now()
        self.claims[claim_id] = json.dumps(obj)
    def _get_claimed_amount(self, claim: dict) -> float:
        raw_amount = claim.get("claimedAmount", claim.get("claimed_amount", 0))
        try:
            amount = float(raw_amount)
        except Exception:
            amount = 0.0
        if amount < 0:
            return 0.0
        return amount
    def _clean_reason_codes(self, codes: typing.Any) -> typing.List[str]:
        cleaned: typing.List[str] = []
        if not isinstance(codes, list):
            return cleaned
        for code in codes:
            if isinstance(code, str) and code in ALLOWED_REASON_CODES and code not in cleaned:
                cleaned.append(code)
        return cleaned
    def _clean_dispute_reason_codes(self, codes: typing.Any) -> typing.List[str]:
        cleaned: typing.List[str] = []
        if not isinstance(codes, list):
            return cleaned
        for code in codes:
            if isinstance(code, str) and code in ALLOWED_DISPUTE_REASON_CODES and code not in cleaned:
                cleaned.append(code)
        return cleaned
    # ---------- deterministic writes ----------
    @gl.public.write
    def create_policy(self, policy_id: str, policy_json: str) -> None:
        if not policy_id or not policy_json:
            raise VmUserError("policy_id and policy_json required")
        try:
            json.loads(policy_json)
        except Exception:
            raise VmUserError("policy_json must be valid JSON")
        if policy_id in self.policies:
            raise VmUserError("policy already exists")
        self.policies[policy_id] = policy_json
        self.policy_count = u256(int(self.policy_count) + 1)
    @gl.public.write
    def file_claim(self, claim_id: str, policy_id: str, claim_json: str) -> None:
        if not claim_id or not claim_json:
            raise VmUserError("claim_id and claim_json required")
        if policy_id and policy_id not in self.policies:
            raise VmUserError("policy not found")
        try:
            claim = json.loads(claim_json)
        except Exception:
            raise VmUserError("claim_json must be valid JSON")
        if claim_id in self.claims:
            raise VmUserError("claim already exists")
        claim["id"] = claim_id
        claim["policyId"] = policy_id
        claim.setdefault("status", "FILED")
        claim["claimant"] = str(gl.message.sender_address)
        claim["createdAt"] = self._now()
        claim["updatedAt"] = self._now()
        self.claims[claim_id] = json.dumps(claim)
        self.claim_count = u256(int(self.claim_count) + 1)
        self._append_user_claim(str(gl.message.sender_address), claim_id)
    @gl.public.write
    def add_evidence(self, evidence_id: str, claim_id: str, evidence_json: str) -> None:
        if not evidence_id:
            raise VmUserError("evidence_id required")
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        try:
            ev = json.loads(evidence_json)
        except Exception:
            raise VmUserError("evidence_json must be valid JSON")
        existing = self.claim_evidence.get(claim_id, "[]")
        try:
            arr = json.loads(existing)
            if not isinstance(arr, list):
                arr = []
        except Exception:
            arr = []
        ev["id"] = evidence_id
        ev["claimId"] = claim_id
        ev["createdAt"] = self._now()
        arr.append(ev)
        self.claim_evidence[claim_id] = json.dumps(arr)
        self.evidence_count = u256(int(self.evidence_count) + 1)
    @gl.public.write
    def set_claim_timeline(self, claim_id: str, timeline_json: str) -> None:
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        try:
            parsed = json.loads(timeline_json)
        except Exception:
            raise VmUserError("timeline_json must be valid JSON")
        if not isinstance(parsed, list):
            raise VmUserError("timeline_json must be a JSON array")
        self.claim_timelines[claim_id] = timeline_json
    @gl.public.write
    def open_dispute(self, dispute_id: str, claim_id: str, dispute_json: str) -> None:
        if not dispute_id:
            raise VmUserError("dispute_id required")
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        if dispute_id in self.disputes:
            raise VmUserError("dispute already exists")
        try:
            d = json.loads(dispute_json)
        except Exception:
            raise VmUserError("dispute_json must be valid JSON")
        d["id"] = dispute_id
        d["claimId"] = claim_id
        d["openedBy"] = str(gl.message.sender_address)
        d["createdAt"] = self._now()
        self.disputes[dispute_id] = json.dumps(d)
        self.dispute_count = u256(int(self.dispute_count) + 1)
        self._set_claim_status(claim_id, "DISPUTED")
    @gl.public.write
    def finalize_claim(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        self._set_claim_status(claim_id, "FINALIZED")
    # ---------- non-deterministic GenLayer judgement ----------
    @gl.public.write
    def judge_claim(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        claim_raw = self.claims[claim_id]
        claim = json.loads(claim_raw)
        policy_raw = self.policies.get(claim.get("policyId", ""), "{}")
        evidence_raw = self.claim_evidence.get(claim_id, "[]")
        timeline_raw = self.claim_timelines.get(claim_id, "[]")
        claimed_amount = self._get_claimed_amount(claim)
        prompt = f"""You are a travel insurance claim review panel.
Your job is to produce a STABLE CONSENSUS VERDICT.
Do not write a full insurance report.
Do not include long prose.
Do not include exact confidence scores.
Do not include exact custom payout amounts.
Do not include timestamps.
Do not include model names.
Do not invent enum values.
Return strict JSON only.
The output must be easy for multiple validators to agree on.
Allowed decision values:
APPROVED, PARTIALLY_APPROVED, REJECTED, NEEDS_MORE_EVIDENCE, ESCALATE
Allowed coverage_status values:
COVERED, COVERED_WITH_LIMITS, NOT_COVERED, UNCLEAR, EXCLUDED
Allowed confidence_band values:
LOW, MEDIUM, HIGH
Allowed risk_level values:
LOW, MEDIUM, HIGH, CRITICAL
Allowed payout_percent values:
0, 25, 50, 75, 100
Allowed gate result values:
PASSED, FAILED, PARTIAL, UNCLEAR, NOT_APPLICABLE
Required gates:
POLICY_ACTIVE
EVENT_COVERED
THRESHOLD_MET
NO_EXCLUSION
EVENT_EVIDENCE_SUPPORTED
RECEIPTS_SUPPORTED
FILED_IN_WINDOW
REASONABLE_ACTIONS
Allowed reason_codes:
POLICY_ACTIVE_CONFIRMED
POLICY_DATE_UNCLEAR
EVENT_TYPE_COVERED
EVENT_TYPE_NOT_COVERED
EXCLUSION_TRIGGERED
NO_EXCLUSION_FOUND
INSUFFICIENT_EVENT_EVIDENCE
EVENT_EVIDENCE_ACCEPTED
INSUFFICIENT_RECEIPTS
RECEIPTS_ACCEPTED
CLAIM_FILED_LATE
CLAIM_FILED_IN_WINDOW
AMOUNT_EXCEEDS_POLICY_LIMIT
PARTIAL_DOCUMENTATION
CONTRADICTORY_TIMELINE
TRAVELLER_ACTED_REASONABLY
TRAVELLER_DID_NOT_MITIGATE_LOSS
AMBIGUOUS_POLICY_LANGUAGE
HUMAN_REVIEW_RECOMMENDED
Decision rules:
- If the event is covered and evidence supports the full amount, choose APPROVED.
- If only part of the amount is supported or policy limits apply, choose PARTIALLY_APPROVED.
- If the event is clearly not covered or an exclusion is triggered, choose REJECTED.
- If material evidence is missing, choose NEEDS_MORE_EVIDENCE.
- If the policy or facts are too ambiguous for automated review, choose ESCALATE.
- APPROVED should usually use payout_percent 100.
- PARTIALLY_APPROVED should use payout_percent 25, 50, or 75.
- REJECTED should use payout_percent 0.
- NEEDS_MORE_EVIDENCE should use payout_percent 0.
- ESCALATE should use payout_percent 0.
POLICY JSON:
{policy_raw}
CLAIM JSON:
{claim_raw}
EVIDENCE JSON ARRAY:
{evidence_raw}
TIMELINE JSON ARRAY:
{timeline_raw}
Return STRICT JSON ONLY with this exact shape:
{{
  "decision": "APPROVED",
  "coverage_status": "COVERED",
  "payout_percent": 100,
  "confidence_band": "HIGH",
  "risk_level": "LOW",
  "gates": {{
    "POLICY_ACTIVE": "PASSED",
    "EVENT_COVERED": "PASSED",
    "THRESHOLD_MET": "PASSED",
    "NO_EXCLUSION": "PASSED",
    "EVENT_EVIDENCE_SUPPORTED": "PASSED",
    "RECEIPTS_SUPPORTED": "PASSED",
    "FILED_IN_WINDOW": "PASSED",
    "REASONABLE_ACTIONS": "PASSED"
  }},
  "reason_codes": ["POLICY_ACTIVE_CONFIRMED", "EVENT_TYPE_COVERED"]
}}
"""
        def run() -> str:
            return gl.nondet.exec_prompt(prompt).strip()
        raw = gl.eq_principle.prompt_non_comparative(
            run,
            """
Accept the leader output only if it is valid strict JSON and it is a reasonable bounded travel-insurance claim verdict.
Validation criteria:
- decision must be one of: APPROVED, PARTIALLY_APPROVED, REJECTED, NEEDS_MORE_EVIDENCE, ESCALATE.
- coverage_status must be one of: COVERED, COVERED_WITH_LIMITS, NOT_COVERED, UNCLEAR, EXCLUDED.
- payout_percent must be one of: 0, 25, 50, 75, 100.
- confidence_band must be one of: LOW, MEDIUM, HIGH.
- risk_level must be one of: LOW, MEDIUM, HIGH, CRITICAL.
- all required gate results must be present and must use only allowed gate enum values.
- reason_codes must come from the allowed reason code list.
- the decision must be consistent with the policy, claim, evidence, timeline, gates, and payout_percent.
- APPROVED should normally have payout_percent 100.
- PARTIALLY_APPROVED should have payout_percent 25, 50, or 75.
- REJECTED, NEEDS_MORE_EVIDENCE, and ESCALATE should have payout_percent 0.
- reject malformed JSON, invented enum values, contradictory verdicts, unsupported approval, or unsupported rejection.
- do not reject only because another valid review could have used slightly different reason_codes or gate wording.
""",
        )
        try:
            parsed = json.loads(raw)
        except Exception:
            raise VmUserError("validator output was not valid JSON")
        decision = parsed.get("decision", "")
        coverage = parsed.get("coverage_status", "")
        payout_percent = parsed.get("payout_percent", 0)
        confidence_band = parsed.get("confidence_band", "")
        risk = parsed.get("risk_level", "")
        gates = parsed.get("gates", {})
        reason_codes = parsed.get("reason_codes", [])
        if decision not in ALLOWED_DECISIONS:
            raise VmUserError("invalid decision")
        if coverage not in ALLOWED_COVERAGE:
            raise VmUserError("invalid coverage_status")
        if risk not in ALLOWED_RISK:
            raise VmUserError("invalid risk_level")
        if confidence_band not in ALLOWED_CONFIDENCE_BANDS:
            raise VmUserError("invalid confidence_band")
        if payout_percent not in ALLOWED_PAYOUT_PERCENT:
            raise VmUserError("invalid payout_percent")
        if not isinstance(gates, dict):
            raise VmUserError("gates must be an object")
        for gate_name in REQUIRED_GATES:
            if gates.get(gate_name) not in ALLOWED_GATE_RESULTS:
                raise VmUserError("invalid gate result")
        cleaned_reason_codes = self._clean_reason_codes(reason_codes)
        if len(cleaned_reason_codes) == 0:
            raise VmUserError("at least one valid reason_code required")
        approved_amount = (claimed_amount * float(payout_percent)) / 100.0
        policy_gates = []
        for gate_name in REQUIRED_GATES:
            policy_gates.append({
                "gate": gate_name,
                "result": gates.get(gate_name),
            })
        parsed_review = {
            "claimId": claim_id,
            "decision": decision,
            "coverage_status": coverage,
            "claimed_amount": claimed_amount,
            "approved_amount": approved_amount,
            "payout_percent": payout_percent,
            "currency": claim.get("currency", "USD"),
            "confidence_band": confidence_band,
            "risk_level": risk,
            "policy_gates": policy_gates,
            "reason_codes": cleaned_reason_codes,
            "reasoning_summary": "Consensus verdict generated from bounded policy gates, payout band, and reason codes.",
            "traveller_advice": "Check claim status. If the claim needs more evidence, upload clearer receipts, event proof, and travel timeline support.",
            "createdAt": self._now(),
        }
        self.claim_reviews[claim_id] = json.dumps(parsed_review)
        self.review_count = u256(int(self.review_count) + 1)
        next_status = {
            "APPROVED": "APPROVED",
            "PARTIALLY_APPROVED": "PARTIALLY_APPROVED",
            "REJECTED": "REJECTED",
            "NEEDS_MORE_EVIDENCE": "NEEDS_MORE_EVIDENCE",
            "ESCALATE": "UNDER_CONSENSUS_REVIEW",
        }[decision]
        self._set_claim_status(claim_id, next_status)
    @gl.public.write
    def review_dispute(self, dispute_id: str) -> None:
        if dispute_id not in self.disputes:
            raise VmUserError("dispute not found")
        dispute_raw = self.disputes[dispute_id]
        d = json.loads(dispute_raw)
        claim_id = d.get("claimId", "")
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        claim_raw = self.claims.get(claim_id, "{}")
        claim = json.loads(claim_raw)
        review_raw = self.claim_reviews.get(claim_id, "{}")
        evidence_raw = self.claim_evidence.get(claim_id, "[]")
        policy_raw = self.policies.get(claim.get("policyId", ""), "{}")
        claimed_amount = self._get_claimed_amount(claim)
        prompt = f"""You are reviewing a dispute against a prior travel insurance claim decision.
Produce a bounded consensus dispute verdict.
Do not write long prose.
Do not use exact confidence scores.
Do not invent enum values.
Use only the allowed values below.
Allowed dispute_decision values:
ORIGINAL_DECISION_UPHELD
ORIGINAL_DECISION_ADJUSTED
MORE_EVIDENCE_REQUIRED
ESCALATE_TO_HUMAN_ARBITRATION
DISPUTE_REJECTED
Allowed new_claim_decision values:
APPROVED
PARTIALLY_APPROVED
REJECTED
NEEDS_MORE_EVIDENCE
ESCALATE
Allowed payout_percent values:
0, 25, 50, 75, 100
Allowed confidence_band values:
LOW, MEDIUM, HIGH
Allowed reason_codes:
ORIGINAL_REVIEW_REASONABLE
ORIGINAL_REVIEW_UNSUPPORTED
NEW_EVIDENCE_MATERIAL
NEW_EVIDENCE_NOT_MATERIAL
DISPUTE_ARGUMENT_ACCEPTED
DISPUTE_ARGUMENT_REJECTED
POLICY_INTERPRETATION_CHANGED
AMOUNT_SHOULD_CHANGE
MORE_EVIDENCE_NEEDED
HUMAN_ARBITRATION_RECOMMENDED
POLICY JSON:
{policy_raw}
CLAIM JSON:
{claim_raw}
ORIGINAL REVIEW JSON:
{review_raw}
EVIDENCE JSON ARRAY:
{evidence_raw}
DISPUTE JSON:
{dispute_raw}
Return STRICT JSON ONLY:
{{
  "dispute_decision": "ORIGINAL_DECISION_UPHELD",
  "new_claim_decision": "REJECTED",
  "payout_percent": 0,
  "confidence_band": "HIGH",
  "reason_codes": ["ORIGINAL_REVIEW_REASONABLE"]
}}
"""
        def run() -> str:
            return gl.nondet.exec_prompt(prompt).strip()
        raw = gl.eq_principle.prompt_non_comparative(
            run,
            """
Accept the leader output only if it is valid strict JSON and it is a reasonable bounded dispute review.
Validation criteria:
- dispute_decision must be one of the allowed dispute decision enums.
- new_claim_decision must be one of the allowed claim decision enums.
- payout_percent must be one of: 0, 25, 50, 75, 100.
- confidence_band must be LOW, MEDIUM, or HIGH.
- reason_codes must come from the allowed dispute reason code list.
- the dispute decision must be consistent with the original review, dispute argument, policy, claim, and evidence.
- reject malformed JSON, invented enum values, contradictory decisions, or unsupported payout changes.
- do not reject only because another valid review could phrase or choose minor reason codes differently.
""",
        )
        try:
            parsed = json.loads(raw)
        except Exception:
            raise VmUserError("validator output was not valid JSON")
        dispute_decision = parsed.get("dispute_decision", "")
        new_claim_decision = parsed.get("new_claim_decision", "")
        payout_percent = parsed.get("payout_percent", 0)
        confidence_band = parsed.get("confidence_band", "")
        reason_codes = parsed.get("reason_codes", [])
        if dispute_decision not in ALLOWED_DISPUTE_DECISIONS:
            raise VmUserError("invalid dispute_decision")
        if new_claim_decision not in ALLOWED_DECISIONS:
            raise VmUserError("invalid new_claim_decision")
        if payout_percent not in ALLOWED_PAYOUT_PERCENT:
            raise VmUserError("invalid payout_percent")
        if confidence_band not in ALLOWED_CONFIDENCE_BANDS:
            raise VmUserError("invalid confidence_band")
        cleaned_reason_codes = self._clean_dispute_reason_codes(reason_codes)
        if len(cleaned_reason_codes) == 0:
            raise VmUserError("at least one valid dispute reason_code required")
        adjusted_amount = (claimed_amount * float(payout_percent)) / 100.0
        final_review = {
            "disputeId": dispute_id,
            "claimId": claim_id,
            "dispute_decision": dispute_decision,
            "new_claim_decision": new_claim_decision,
            "adjusted_amount": adjusted_amount,
            "payout_percent": payout_percent,
            "confidence_band": confidence_band,
            "reason_codes": cleaned_reason_codes,
            "reasoning_summary": "Consensus dispute verdict generated from bounded dispute decision fields.",
            "final_recommendation": "Apply the new claim decision unless the case is escalated to human arbitration.",
            "createdAt": self._now(),
        }
        self.dispute_reviews[dispute_id] = json.dumps(final_review)
        new_status = {
            "APPROVED": "APPROVED",
            "PARTIALLY_APPROVED": "PARTIALLY_APPROVED",
            "REJECTED": "REJECTED",
            "NEEDS_MORE_EVIDENCE": "NEEDS_MORE_EVIDENCE",
            "ESCALATE": "UNDER_CONSENSUS_REVIEW",
        }[new_claim_decision]
        self._set_claim_status(claim_id, new_status)
    @gl.public.write
    def detect_evidence_conflicts(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        evidence_raw = self.claim_evidence.get(claim_id, "[]")
        timeline_raw = self.claim_timelines.get(claim_id, "[]")
        claim_raw = self.claims[claim_id]
        prompt = f"""Identify only major evidence conflicts for this insurance claim.
Use bounded output.
Do not write long prose.
Do not invent severity values.
Allowed severity values:
LOW, MEDIUM, HIGH
Conflict type values:
TIMELINE_CONFLICT
AMOUNT_CONFLICT
MISSING_DOCUMENT
IDENTITY_OR_POLICY_MISMATCH
EVENT_DESCRIPTION_CONFLICT
NO_MAJOR_CONFLICT
CLAIM JSON:
{claim_raw}
EVIDENCE JSON ARRAY:
{evidence_raw}
TIMELINE JSON ARRAY:
{timeline_raw}
Return STRICT JSON ONLY:
{{
  "has_conflict": false,
  "top_conflict_type": "NO_MAJOR_CONFLICT",
  "severity": "LOW"
}}
"""
        def run() -> str:
            return gl.nondet.exec_prompt(prompt).strip()
        raw = gl.eq_principle.prompt_non_comparative(
            run,
            """
Accept the leader output only if it is valid strict JSON and it is a reasonable bounded evidence-conflict assessment.
Validation criteria:
- has_conflict must be a boolean.
- top_conflict_type must be one of the allowed conflict types.
- severity must be LOW, MEDIUM, or HIGH.
- if has_conflict is false, top_conflict_type should normally be NO_MAJOR_CONFLICT and severity LOW.
- if has_conflict is true, top_conflict_type should identify a real major conflict visible in the claim/evidence/timeline.
- reject malformed JSON, invented enum values, or conflict findings unsupported by the evidence.
""",
        )
        try:
            parsed = json.loads(raw)
        except Exception:
            raise VmUserError("validator output was not valid JSON")
        if not isinstance(parsed.get("has_conflict"), bool):
            raise VmUserError("has_conflict must be boolean")
        if parsed.get("severity") not in ALLOWED_CONFLICT_SEVERITY:
            raise VmUserError("invalid conflict severity")
        allowed_conflict_types = {
            "TIMELINE_CONFLICT",
            "AMOUNT_CONFLICT",
            "MISSING_DOCUMENT",
            "IDENTITY_OR_POLICY_MISMATCH",
            "EVENT_DESCRIPTION_CONFLICT",
            "NO_MAJOR_CONFLICT",
        }
        if parsed.get("top_conflict_type") not in allowed_conflict_types:
            raise VmUserError("invalid conflict type")
        existing_review = self.claim_reviews.get(claim_id, "{}")
        try:
            obj = json.loads(existing_review)
        except Exception:
            obj = {}
        obj["claimId"] = claim_id
        obj["evidence_conflicts"] = {
            "has_conflict": parsed.get("has_conflict"),
            "top_conflict_type": parsed.get("top_conflict_type"),
            "severity": parsed.get("severity"),
        }
        self.claim_reviews[claim_id] = json.dumps(obj)
    @gl.public.write
    def interpret_policy_gate(self, claim_id: str, gate_name: str) -> None:
        if claim_id not in self.claims:
            raise VmUserError("claim not found")
        if not gate_name:
            raise VmUserError("gate_name required")
        if gate_name not in REQUIRED_GATES:
            raise VmUserError("unsupported gate_name")
        claim_raw = self.claims[claim_id]
        claim = json.loads(claim_raw)
        policy_raw = self.policies.get(claim.get("policyId", ""), "{}")
        evidence_raw = self.claim_evidence.get(claim_id, "[]")
        prompt = f"""Evaluate one policy gate against a travel insurance claim.
Use bounded output only.
Do not write long prose.
Do not invent enum values.
Gate to evaluate:
{gate_name}
Allowed result values:
PASSED, FAILED, PARTIAL, UNCLEAR, NOT_APPLICABLE
Allowed confidence_band values:
LOW, MEDIUM, HIGH
Allowed reason_codes:
POLICY_ACTIVE_CONFIRMED
POLICY_DATE_UNCLEAR
EVENT_TYPE_COVERED
EVENT_TYPE_NOT_COVERED
EXCLUSION_TRIGGERED
NO_EXCLUSION_FOUND
INSUFFICIENT_EVENT_EVIDENCE
EVENT_EVIDENCE_ACCEPTED
INSUFFICIENT_RECEIPTS
RECEIPTS_ACCEPTED
CLAIM_FILED_LATE
CLAIM_FILED_IN_WINDOW
AMOUNT_EXCEEDS_POLICY_LIMIT
PARTIAL_DOCUMENTATION
CONTRADICTORY_TIMELINE
TRAVELLER_ACTED_REASONABLY
TRAVELLER_DID_NOT_MITIGATE_LOSS
AMBIGUOUS_POLICY_LANGUAGE
HUMAN_REVIEW_RECOMMENDED
POLICY JSON:
{policy_raw}
CLAIM JSON:
{claim_raw}
EVIDENCE JSON ARRAY:
{evidence_raw}
Return STRICT JSON ONLY:
{{
  "gate": "{gate_name}",
  "result": "PASSED",
  "confidence_band": "HIGH",
  "reason_codes": ["POLICY_ACTIVE_CONFIRMED"]
}}
"""
        def run() -> str:
            return gl.nondet.exec_prompt(prompt).strip()
        raw = gl.eq_principle.prompt_non_comparative(
            run,
            """
Accept the leader output only if it is valid strict JSON and it is a reasonable bounded policy-gate interpretation.
Validation criteria:
- gate must match the requested gate.
- result must be PASSED, FAILED, PARTIAL, UNCLEAR, or NOT_APPLICABLE.
- confidence_band must be LOW, MEDIUM, or HIGH.
- reason_codes must come from the allowed reason code list.
- the gate result must be consistent with the policy, claim, and evidence.
- reject malformed JSON, invented enum values, wrong gate names, or unsupported gate outcomes.
""",
        )
        try:
            parsed = json.loads(raw)
        except Exception:
            raise VmUserError("validator output was not valid JSON")
        result = parsed.get("result", "")
        confidence_band = parsed.get("confidence_band", "")
        reason_codes = parsed.get("reason_codes", [])
        if result not in ALLOWED_GATE_RESULTS:
            raise VmUserError("invalid gate result")
        if confidence_band not in ALLOWED_CONFIDENCE_BANDS:
            raise VmUserError("invalid confidence_band")
        cleaned_reason_codes = self._clean_reason_codes(reason_codes)
        if len(cleaned_reason_codes) == 0:
            raise VmUserError("at least one valid reason_code required")
        existing_review = self.claim_reviews.get(claim_id, "{}")
        try:
            obj = json.loads(existing_review)
        except Exception:
            obj = {}
        gates = obj.get("policy_gates", [])
        if not isinstance(gates, list):
            gates = []
        gates = [g for g in gates if g.get("gate") != gate_name]
        gates.append({
            "gate": gate_name,
            "result": result,
            "confidence_band": confidence_band,
            "reason_codes": cleaned_reason_codes,
        })
        obj["policy_gates"] = gates
        obj["claimId"] = claim_id
        self.claim_reviews[claim_id] = json.dumps(obj)
    # ---------- views ----------
    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        return self.policies.get(policy_id, "")
    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        return self.claims.get(claim_id, "")
    @gl.public.view
    def get_claim_evidence(self, claim_id: str) -> str:
        return self.claim_evidence.get(claim_id, "[]")
    @gl.public.view
    def get_claim_timeline(self, claim_id: str) -> str:
        return self.claim_timelines.get(claim_id, "[]")
    @gl.public.view
    def get_claim_review(self, claim_id: str) -> str:
        return self.claim_reviews.get(claim_id, "")
    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        return self.disputes.get(dispute_id, "")
    @gl.public.view
    def get_dispute_review(self, dispute_id: str) -> str:
        return self.dispute_reviews.get(dispute_id, "")
    @gl.public.view
    def get_user_claims(self, user: str) -> str:
        return self.user_claims.get(user, "[]")
    @gl.public.view
    def list_claims(self) -> str:
        ids = []
        for k in self.claims:
            ids.append(k)
        return json.dumps(ids)
    @gl.public.view
    def list_policies(self) -> str:
        ids = []
        for k in self.policies:
            ids.append(k)
        return json.dumps(ids)
    @gl.public.view
    def get_protocol_stats(self) -> str:
        return json.dumps({
            "policies": int(self.policy_count),
            "claims": int(self.claim_count),
            "evidence": int(self.evidence_count),
            "reviews": int(self.review_count),
            "disputes": int(self.dispute_count),
        })