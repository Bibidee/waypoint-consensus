"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured, CONTRACT_ADDRESS } from "@/lib/genlayer/config";
import { getExplorerAddressUrl } from "@/lib/genlayer/explorer";
import type { Claim, ClaimReview, EvidenceItem } from "@/types";
import TimelineBuilder, { type TimelineEvent } from "@/components/TimelineBuilder";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import TransactionLink from "@/components/TransactionLink";

const DEFAULT_GATES = [
  "POLICY_ACTIVE",
  "EVENT_COVERED",
  "THRESHOLD_MET",
  "NO_EXCLUSION",
  "EVENT_EVIDENCE_SUPPORTED",
  "RECEIPTS_SUPPORTED",
  "FILED_IN_WINDOW",
  "REASONABLE_ACTIONS",
];

const GATE_LABEL: Record<string, string> = {
  POLICY_ACTIVE: "Policy active on travel date",
  EVENT_COVERED: "Event type covered",
  THRESHOLD_MET: "Delay/cancellation threshold met",
  NO_EXCLUSION: "Exclusion not triggered",
  EVENT_EVIDENCE_SUPPORTED: "Evidence supports event",
  RECEIPTS_SUPPORTED: "Receipts support amount",
  FILED_IN_WINDOW: "Claim filed within required window",
  REASONABLE_ACTIONS: "Traveller acted reasonably",
};

const REASON_LABEL: Record<string, string> = {
  POLICY_ACTIVE_CONFIRMED: "Policy active on travel date",
  POLICY_DATE_UNCLEAR: "Policy dates unclear",
  EVENT_TYPE_COVERED: "Event type is covered",
  EVENT_TYPE_NOT_COVERED: "Event type not covered",
  EXCLUSION_TRIGGERED: "Exclusion applies",
  NO_EXCLUSION_FOUND: "No exclusion applies",
  INSUFFICIENT_EVENT_EVIDENCE: "Insufficient evidence of event",
  EVENT_EVIDENCE_ACCEPTED: "Event evidence accepted",
  INSUFFICIENT_RECEIPTS: "Insufficient receipts",
  RECEIPTS_ACCEPTED: "Receipts accepted",
  CLAIM_FILED_LATE: "Claim filed outside window",
  CLAIM_FILED_IN_WINDOW: "Claim filed in window",
  AMOUNT_EXCEEDS_POLICY_LIMIT: "Amount exceeds policy limit",
  PARTIAL_DOCUMENTATION: "Partial documentation",
  CONTRADICTORY_TIMELINE: "Contradictory timeline",
  TRAVELLER_ACTED_REASONABLY: "Traveller acted reasonably",
  TRAVELLER_DID_NOT_MITIGATE_LOSS: "Traveller did not mitigate loss",
  AMBIGUOUS_POLICY_LANGUAGE: "Ambiguous policy language",
  HUMAN_REVIEW_RECOMMENDED: "Human review recommended",
};

const STAMP_TONE: Record<string, string> = {
  APPROVED: "text-signal border-signal",
  PARTIALLY_APPROVED: "text-gold border-gold",
  REJECTED: "text-vermilion border-vermilion",
  NEEDS_MORE_EVIDENCE: "text-gold border-gold",
  ESCALATE: "text-teal border-teal",
};

type DisputeReview = {
  dispute_decision: string;
  new_claim_decision: string;
  adjusted_amount: number;
  confidence: number;
  accepted_arguments: string[];
  rejected_arguments: string[];
  reasoning_summary: string;
  final_recommendation: string;
};

function disputeStoreKey(claimId: string) { return `wpc:disputes:${claimId}`; }
function loadLocalDisputeIds(claimId: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(disputeStoreKey(claimId)) || "[]"); }
  catch { return []; }
}

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [review, setReview] = useState<ClaimReview | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [disputeReviews, setDisputeReviews] = useState<DisputeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyGate, setBusyGate] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const queryTx = searchParams.get("tx");

  async function refresh() {
    if (!isContractConfigured() || !id) return;
    setLoading(true);
    try {
      const [cRaw, rRaw, eRaw, tRaw] = await Promise.all([
        wpc.getClaim(id), wpc.getReview(id), wpc.getEvidence(id), wpc.getTimeline(id),
      ]);
      setClaim(cRaw ? JSON.parse(cRaw) : null);
      setReview(rRaw ? JSON.parse(rRaw) : null);
      setEvidence(eRaw ? JSON.parse(eRaw) : []);
      setTimeline(tRaw ? JSON.parse(tRaw) : []);

      const dids = loadLocalDisputeIds(id);
      const drs = await Promise.all(dids.map(async did => {
        try { const raw = await wpc.getDisputeReview(did); return raw ? JSON.parse(raw) : null; }
        catch { return null; }
      }));
      setDisputeReviews(drs.filter(Boolean) as DisputeReview[]);
    } catch (e: any) { setErr(e?.message ?? "Failed to load claim"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { if (queryTx) setTxHash(queryTx); }, [queryTx]);

  async function runJudge() {
    setBusy("judge"); setErr(null); setTxHash(null);
    try { const hash = await wpc.judgeClaim(id); setTxHash(hash); await refresh(); }
    catch (e: any) { setErr(e?.message ?? "Consensus review failed"); }
    finally { setBusy(null); }
  }
  async function runConflicts() {
    setBusy("conflicts"); setErr(null); setTxHash(null);
    try { const hash = await wpc.detectConflicts(id); setTxHash(hash); await refresh(); }
    catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  }
  async function runGate(name: string) {
    setBusyGate(name); setErr(null); setTxHash(null);
    try { const hash = await wpc.interpretGate(id, name); setTxHash(hash); await refresh(); }
    catch (e: any) { setErr(e?.message ?? "Gate review failed"); }
    finally { setBusyGate(null); }
  }

  if (!isContractConfigured()) return <div className="boarding rounded p-6 text-paper">Contract not configured.</div>;

  if (loading && !claim) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid sm:grid-cols-2 gap-3">
          <SkeletonCard /><SkeletonCard />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!claim) return <div className="paper p-6">Claim not found.</div>;

  const decision = review?.decision;
  const stampTone = decision ? STAMP_TONE[decision] : "text-paper border-paper/50";
  const reviewedGates = review?.policy_gates ?? [];
  const mergedGates = DEFAULT_GATES.map(name => {
    const found = reviewedGates.find(g => g.gate === name);
    return found ?? { gate: name, result: "UNCLEAR" as const };
  });
  for (const g of reviewedGates) {
    if (!DEFAULT_GATES.includes(g.gate)) mergedGates.push(g);
  }

  return (
    <div className="space-y-8">
      {/* Zone A: Waypoint File Cover */}
      <section className="paper rounded-md p-6 relative overflow-hidden">
        <div className="absolute right-6 top-6">
          <div className={`stamp ${stampTone}`}>{decision ? decision.replace(/_/g," ") : "Awaiting Consensus Review"}</div>
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">Waypoint File</div>
        <h1 className="font-display text-3xl mt-1">{claim.claimType?.replace(/_/g," ")}</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm">
          <Meta label="Claim ID" value={claim.id} mono />
          <Meta label="Policy" value={claim.policyId || "—"} mono />
          <Meta label="Route" value={`${claim.route?.from} → ${claim.route?.to}`} />
          <Meta label="Incident" value={claim.incidentDate} />
          <Meta label="Provider" value={claim.provider} />
          <Meta label="Booking" value={claim.bookingReference} mono />
          <Meta label="Claimed" value={`${claim.claimedAmount} ${claim.currency}`} mono />
          <Meta label="Status" value={claim.status} mono />
        </div>
        <p className="mt-4 text-sm text-stamped/80">{claim.explanation}</p>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-3">
        <button onClick={runJudge} disabled={!!busy} className="bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded disabled:opacity-50">
          {busy === "judge" ? "Validators deliberating…" : "Run GenLayer Consensus Review"}
        </button>
        <button onClick={runConflicts} disabled={!!busy} className="border border-paper/30 text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">
          {busy === "conflicts" ? "Scanning…" : "Detect Evidence Conflicts"}
        </button>
        <Link href={`/claims/${id}/evidence`} className="border border-paper/30 text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">Add Evidence</Link>
        <Link href={`/claims/${id}/dispute`} className="border border-burgundy text-burgundy mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">Open Dispute</Link>
        <TransactionLink hash={txHash} label="View latest tx" className="self-center" />
        {err && <span className="mono text-xs text-vermilion self-center">{err}</span>}
      </section>

      {/* Zone B: Evidence Runway */}
      <section>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-2">Evidence Runway</div>
        {evidence.length === 0 ? (
          <div className="paper rounded p-4 text-sm text-stamped/70">No evidence checkpoints yet. <Link href={`/claims/${id}/evidence`} className="text-burgundy underline">Add evidence</Link>.</div>
        ) : (
          <div className="flex overflow-x-auto gap-3 pb-3">
            {evidence.map(ev => (
              <div key={ev.id} className="paper rounded p-3 min-w-[220px]">
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">{ev.type}</div>
                <div className="font-display text-sm mt-1">{ev.title}</div>
                <div className="text-xs text-stamped/70 mt-1">{ev.source}</div>
                {ev.uri && <div className="mono text-[10px] text-stamped/50 truncate mt-1">{ev.uri}</div>}
                <div className="mono text-[9px] mt-2 inline-block px-2 py-0.5 rounded border border-stamped/30">{ev.privacy}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Travel Timeline + Builder */}
      <section>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-2">Travel Timeline</div>
        <TimelineBuilder claimId={id} initial={timeline} onSaved={(t) => setTimeline(t)} />
      </section>

      {/* Zone C: Policy Gates */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Policy Gates</div>
          <div className="mono text-[10px] text-paper/50">Tap re-run on any gate to invoke <span className="text-gold">interpret_policy_gate</span> individually.</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {mergedGates.map((g, i) => (
            <div key={i} className="paper rounded p-4">
              <div className="flex justify-between items-baseline gap-3">
                <div className="font-display">{GATE_LABEL[g.gate] ?? g.gate}</div>
                <span className={`mono text-[10px] uppercase tracking-[0.2em] ${
                  g.result === "PASSED" ? "gate-pass" :
                  g.result === "FAILED" ? "gate-fail" :
                  g.result === "PARTIAL" ? "gate-partial" : "gate-unclear"
                }`}>{g.result}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="mono text-[10px] text-stamped/50">{g.gate}</div>
                <button onClick={() => runGate(g.gate)} disabled={!!busyGate}
                  className="mono text-[10px] uppercase tracking-[0.25em] text-burgundy hover:underline disabled:opacity-50">
                  {busyGate === g.gate ? "Reviewing…" : "Re-run gate ↻"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Consensus Review */}
      <section className="boarding rounded-md p-6">
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Consensus Review</div>
        {!review ? (
          <p className="text-paper/80 mt-2">This claim has not been reviewed by GenLayer consensus yet.</p>
        ) : (
          <div className="mt-3 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 text-paper/85 text-sm space-y-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-paper/60 mb-2">Reason codes</div>
                {review.reason_codes && review.reason_codes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {review.reason_codes.map(code => (
                      <span key={code} className="mono text-[10px] uppercase tracking-[0.2em] text-paper bg-gold/15 border border-gold/40 rounded px-2 py-1">
                        {REASON_LABEL[code] ?? code}
                      </span>
                    ))}
                  </div>
                ) : <div className="text-paper/40 text-xs">—</div>}
              </div>
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.25em] text-paper/60 mb-1">Payout</div>
                <div className="font-display text-3xl text-paper">
                  {review.approved_amount} <span className="text-paper/50 text-base">{review.currency ?? claim.currency}</span>
                </div>
                <div className="mono text-[11px] text-paper/60 mt-1">
                  {review.payout_percent}% of claimed {review.claimed_amount}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Stat label="Decision" value={review.decision?.replace(/_/g, " ")} tone />
              <Stat label="Coverage" value={review.coverage_status?.replace(/_/g, " ")} />
              <Stat label="Payout %" value={`${review.payout_percent}%`} />
              <Stat label="Confidence" value={review.confidence_band} />
              <Stat label="Risk" value={review.risk_level} />
            </div>
          </div>
        )}
      </section>

      {/* Dispute Reviews */}
      {disputeReviews.length > 0 && (
        <section>
          <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-2">Dispute Reviews</div>
          <div className="space-y-3">
            {disputeReviews.map((d, i) => (
              <div key={i} className="paper rounded-md p-5">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">Dispute outcome</div>
                    <div className="font-display text-xl">{d.dispute_decision?.replace(/_/g," ")}</div>
                  </div>
                  <div className="text-right mono text-[11px] text-stamped/70">
                    new decision: <span className="text-burgundy">{d.new_claim_decision}</span>
                    {typeof d.adjusted_amount === "number" && <> · adjusted {d.adjusted_amount}</>}
                    {typeof d.confidence === "number" && <> · conf {d.confidence}%</>}
                  </div>
                </div>
                <p className="text-sm text-stamped/80 mt-2">{d.reasoning_summary}</p>
                {d.final_recommendation && (
                  <p className="text-sm text-stamped/70 mt-1"><span className="mono text-[10px] uppercase tracking-[0.2em] text-stamped/50 mr-2">Recommendation</span>{d.final_recommendation}</p>
                )}
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <DList title="Accepted arguments" items={d.accepted_arguments} tone="signal" />
                  <DList title="Rejected arguments" items={d.rejected_arguments} tone="vermilion" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Why this needed GenLayer */}
      <section className="paper rounded-md p-6">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">Why this needed GenLayer</div>
        <p className="mt-2 text-stamped/80 text-sm">
          This review required interpretation of real-world evidence, conflicting signals, and natural-language policy
          rules. A normal smart contract can store the submission, but it cannot judge whether a delay qualifies under
          the policy language, whether receipts genuinely support the loss, or whether an exclusion applies. GenLayer
          validators review the context and reach consensus on a structured result that directly updates the claim status on-chain.
        </p>
      </section>

      {/* Audit trail */}
      <section>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-2">On-chain Audit Trail</div>
        <div className="paper rounded p-4 mono text-xs text-stamped/80">
          Contract: <a className="text-burgundy underline" target="_blank" rel="noreferrer" href={getExplorerAddressUrl(CONTRACT_ADDRESS as string)}>{CONTRACT_ADDRESS}</a>
        </div>
      </section>
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-stamped/60">{label}</div>
      <div className={`text-stamped ${mono ? "mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
function Stat({ label, value, tone = false }: { label: string; value: string; tone?: boolean }) {
  return (
    <div className="border border-gold/30 rounded p-3">
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-gold/70">{label}</div>
      <div className={`font-display text-lg ${tone ? "text-gold" : "text-paper"}`}>{value}</div>
    </div>
  );
}
function List({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-paper/60">{title}</div>
      {!items || items.length === 0 ? <div className="text-paper/40 text-xs">—</div> :
        <ul className="text-sm text-paper/80 list-disc pl-4">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>}
    </div>
  );
}
function DList({ title, items, tone }: { title: string; items?: string[]; tone: "signal" | "vermilion" }) {
  return (
    <div>
      <div className={`mono text-[10px] uppercase tracking-[0.2em] ${tone === "signal" ? "text-signal" : "text-vermilion"}`}>{title}</div>
      {!items || items.length === 0 ? <div className="text-stamped/40 text-xs">—</div> :
        <ul className="text-sm text-stamped/80 list-disc pl-4">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>}
    </div>
  );
}
