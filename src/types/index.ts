export type ClaimStatus =
  | "DRAFT" | "FILED" | "EVIDENCE_PENDING" | "UNDER_CONSENSUS_REVIEW"
  | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "NEEDS_MORE_EVIDENCE"
  | "DISPUTED" | "FINALIZED";

export type ClaimType =
  | "FLIGHT_DELAY" | "FLIGHT_CANCELLATION" | "MISSED_CONNECTION"
  | "LOST_BAGGAGE" | "DELAYED_BAGGAGE" | "TRIP_CANCELLATION"
  | "TRIP_INTERRUPTION" | "HOTEL_CANCELLATION" | "MEDICAL_TRAVEL_INCIDENT"
  | "DENIED_BOARDING" | "WEATHER_DISRUPTION" | "AIRLINE_STRIKE"
  | "OVERBOOKING" | "OTHER";

export type Claim = {
  id: string;
  claimant: string;
  policyId: string;
  claimType: ClaimType;
  route: { from: string; to: string; connection?: string };
  provider: string;
  bookingReference: string;
  incidentDate: string;
  claimedAmount: number;
  currency: string;
  explanation: string;
  status: ClaimStatus;
  createdAt: number;
  updatedAt: number;
};

export type EvidencePrivacy = "PUBLIC" | "REDACTED" | "PRIVATE_HASH_ONLY";

export type EvidenceItem = {
  id: string;
  claimId: string;
  type: string;
  title: string;
  uri: string;
  hash?: string;
  source: string;
  issuedAt?: string;
  description: string;
  linkedTimelineEventId?: string;
  privacy: EvidencePrivacy;
};

export type PolicyGateResult = "PASSED" | "FAILED" | "PARTIAL" | "UNCLEAR" | "NOT_APPLICABLE";

export type PolicyGate = {
  gate: string;
  result: PolicyGateResult;
};

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
export type PayoutPercent = 0 | 25 | 50 | 75 | 100;

export type ClaimReview = {
  claimId: string;
  decision: "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "NEEDS_MORE_EVIDENCE" | "ESCALATE";
  coverage_status: "COVERED" | "COVERED_WITH_LIMITS" | "NOT_COVERED" | "UNCLEAR" | "EXCLUDED";
  payout_percent: PayoutPercent;
  approved_amount: number;
  claimed_amount: number;
  currency?: string;
  confidence_band: ConfidenceBand;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  policy_gates: PolicyGate[];
  reason_codes: string[];
};

export type Policy = {
  id: string;
  name: string;
  provider: string;
  reference: string;
  summary: string;
  coverage: string[];
  exclusions: string[];
  delayThresholdHours: number;
  baggageLimit: number;
  cancellationTerms: string;
  maxPayout: number;
  documentUri?: string;
};
