"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";

const TYPES = ["ITINERARY","BOARDING_PASS","AIRLINE_NOTICE","DELAY_CONFIRMATION","CANCELLATION_EMAIL","BAGGAGE_REPORT","HOTEL_RECEIPT","TRANSPORT_RECEIPT","MEDICAL_RECEIPT","POLICE_REPORT","WEATHER_ALERT","VISA_DOCUMENT","PHOTO","VIDEO","CHAT_SCREENSHOT","BANK_STATEMENT","OTHER"];
const PRIVACY = ["PUBLIC","REDACTED","PRIVATE_HASH_ONLY"];

type V = { title: string; type: string; uri: string; hash?: string; source: string; description: string; privacy: string; issuedAt?: string };

export default function AddEvidencePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { register, handleSubmit, reset } = useForm<V>({ defaultValues: { type: "AIRLINE_NOTICE", privacy: "PUBLIC" } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(v: V) {
    if (!isContractConfigured()) { setErr("Contract not configured."); return; }
    setBusy(true); setErr(null);
    try {
      const eid = "ev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      const hash = await wpc.addEvidence(eid, id, JSON.stringify(v));
      reset();
      router.push(`/claims/${id}?tx=${hash}`);
    } catch (e: any) { setErr(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Evidence Wallet</div>
      <h1 className="font-display text-3xl text-paper">Add Evidence</h1>
      <p className="text-paper/70 text-sm mt-1">Only submit information you are comfortable making available for review. Use hashes/CIDs for sensitive files.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="paper rounded-md p-5 mt-6 space-y-3">
        <input {...register("title", { required: true })} placeholder="Title (e.g. 9hr Delay Notice - DL220)" className="input" />
        <div className="grid grid-cols-2 gap-3">
          <select {...register("type")} className="input">{TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select>
          <select {...register("privacy")} className="input">{PRIVACY.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select>
        </div>
        <input {...register("source", { required: true })} placeholder="Source / issuer" className="input"/>
        <input type="datetime-local" {...register("issuedAt")} className="input"/>
        <input {...register("uri")} placeholder="URI / IPFS CID / link" className="input"/>
        <input {...register("hash")} placeholder="Hash (optional)" className="input"/>
        <textarea rows={3} {...register("description", { required: true })} placeholder="Describe what this proves" className="input"/>
        {err && <div className="text-vermilion text-sm">{err}</div>}
        <button disabled={busy} className="bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">{busy ? "Stamping…" : "Stamp Evidence"}</button>
        <style jsx>{`.input{width:100%;background:#FBFAF7;color:#111;border:1px solid rgba(17,17,17,0.25);border-radius:4px;padding:0.5rem 0.75rem;font-family:var(--font-mono),monospace;font-size:0.85rem;}`}</style>
      </form>
    </div>
  );
}
