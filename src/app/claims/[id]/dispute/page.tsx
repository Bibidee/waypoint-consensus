"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";
import TransactionLink from "@/components/TransactionLink";

const REASONS = ["POLICY_MISINTERPRETED","EVIDENCE_NOT_CONSIDERED","INCORRECT_TIMELINE","PAYMENT_AMOUNT_TOO_LOW","EXCLUSION_WRONGLY_APPLIED","NEW_EVIDENCE_AVAILABLE","OTHER"];

type V = { reason: string; argument: string; newEvidence?: string };

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { register, handleSubmit } = useForm<V>({ defaultValues: { reason: "POLICY_MISINTERPRETED" } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function onSubmit(v: V) {
    if (!isContractConfigured()) { setErr("Contract not configured."); return; }
    setBusy(true); setErr(null); setTxHash(null);
    try {
      const did = "dsp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      const hash = await wpc.openDispute(did, id, JSON.stringify(v));
      setTxHash(hash);
      try {
        const key = `wpc:disputes:${id}`;
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        if (!arr.includes(did)) arr.push(did);
        localStorage.setItem(key, JSON.stringify(arr));
      } catch { /* ignore */ }
      setDisputeId(did);
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  async function runReview() {
    if (!disputeId) return;
    setReviewing(true); setErr(null); setTxHash(null);
    try {
      const hash = await wpc.reviewDispute(disputeId);
      router.push(`/claims/${id}?tx=${hash}`);
    }
    catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setReviewing(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Dispute Terminal</div>
      <h1 className="font-display text-3xl text-paper">Open Dispute</h1>

      {!disputeId ? (
        <form onSubmit={handleSubmit(onSubmit)} className="paper rounded-md p-5 mt-6 space-y-3">
          <select {...register("reason")} className="input">{REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g," ")}</option>)}</select>
          <textarea rows={5} {...register("argument", { required: true })} placeholder="Explain why the decision is wrong" className="input"/>
          <textarea rows={3} {...register("newEvidence")} placeholder="Reference any new evidence (URI, hash, description)" className="input"/>
          {err && <div className="text-vermilion text-sm">{err}</div>}
          <button disabled={busy} className="bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">{busy ? "Filing…" : "File Dispute"}</button>
          <style jsx>{`.input{width:100%;background:#FBFAF7;color:#111;border:1px solid rgba(17,17,17,0.25);border-radius:4px;padding:0.5rem 0.75rem;font-family:var(--font-mono),monospace;font-size:0.85rem;}`}</style>
        </form>
      ) : (
        <div className="boarding rounded-md p-6 mt-6 text-paper">
          <div className="mono text-xs text-gold/80">Dispute filed: {disputeId}</div>
          <TransactionLink hash={txHash} label="View dispute tx" className="mt-2 inline-block" />
          <p className="mt-2 text-paper/80 text-sm">Trigger GenLayer consensus to review your dispute.</p>
          <button disabled={reviewing} onClick={runReview} className="mt-4 bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">
            {reviewing ? "Validators deliberating…" : "Run Dispute Review"}
          </button>
          {err && <div className="text-vermilion text-sm mt-2">{err}</div>}
        </div>
      )}
    </div>
  );
}
