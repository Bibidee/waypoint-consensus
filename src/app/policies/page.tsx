"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";
import AuthGate from "@/components/AuthGate";
import TransactionLink from "@/components/TransactionLink";

const Schema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  provider: z.string().min(2),
  reference: z.string().min(1),
  summary: z.string().min(20),
  coverage: z.string().min(2),
  exclusions: z.string().optional(),
  delayThresholdHours: z.coerce.number().nonnegative().default(0),
  baggageLimit: z.coerce.number().nonnegative().default(0),
  cancellationTerms: z.string().optional(),
  maxPayout: z.coerce.number().nonnegative().default(0),
  documentUri: z.string().optional(),
});

type V = z.infer<typeof Schema>;

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm<V>();

  async function load() {
    if (!isContractConfigured()) { setPolicies([]); return; }
    try {
      const idsRaw = await wpc.listPolicies();
      const ids: string[] = typeof idsRaw === "string" ? JSON.parse(idsRaw) : (idsRaw ?? []);
      const items = await Promise.all(ids.map(async id => {
        try { return { id, ...JSON.parse(await wpc.getPolicy(id)) }; } catch { return null; }
      }));
      setPolicies(items.filter(Boolean));
    } catch { setPolicies([]); }
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(v: V) {
    setErr(null);
    setTxHash(null);
    if (!isContractConfigured()) { setErr("Contract not configured."); return; }
    setSubmitting(true);
    try {
      const json = JSON.stringify({
        name: v.name, provider: v.provider, reference: v.reference, summary: v.summary,
        coverage: v.coverage.split(",").map(s => s.trim()).filter(Boolean),
        exclusions: (v.exclusions ?? "").split(",").map(s => s.trim()).filter(Boolean),
        delayThresholdHours: v.delayThresholdHours, baggageLimit: v.baggageLimit,
        cancellationTerms: v.cancellationTerms ?? "", maxPayout: v.maxPayout,
        documentUri: v.documentUri ?? "",
      });
      const hash = await wpc.createPolicy(v.id, json);
      setTxHash(hash);
      reset();
      load();
    } catch (e: any) { setErr(e?.message ?? "Failed to create policy"); }
    finally { setSubmitting(false); }
  }

  return (
    <AuthGate action="manage policies">
    <div>
      <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Policy Vault</div>
      <h1 className="font-display text-4xl text-paper">Policies</h1>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="paper rounded-md p-5 space-y-3">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">New Policy</div>
          <input {...register("id")} placeholder="Policy ID (e.g. pol-acme-001)" className="input" />
          <input {...register("name")} placeholder="Policy name" className="input" />
          <input {...register("provider")} placeholder="Provider" className="input" />
          <input {...register("reference")} placeholder="Reference number" className="input" />
          <textarea rows={4} {...register("summary")} placeholder="Policy summary / text" className="input" />
          <input {...register("coverage")} placeholder="Coverage categories (comma separated)" className="input" />
          <input {...register("exclusions")} placeholder="Exclusions (comma separated)" className="input" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" {...register("delayThresholdHours")} placeholder="Delay hrs" className="input"/>
            <input type="number" {...register("baggageLimit")} placeholder="Baggage limit" className="input"/>
            <input type="number" {...register("maxPayout")} placeholder="Max payout" className="input"/>
          </div>
          <input {...register("cancellationTerms")} placeholder="Cancellation terms" className="input"/>
          <input {...register("documentUri")} placeholder="Document URI (IPFS, https…)" className="input"/>
          {err && <div className="text-vermilion text-sm">{err}</div>}
          <TransactionLink hash={txHash} label="View policy tx" />
          <button disabled={submitting} className="bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">
            {submitting ? "Saving…" : "Add to Vault"}
          </button>
          <style jsx>{`.input{width:100%;background:#FBFAF7;color:#111;border:1px solid rgba(17,17,17,0.25);border-radius:4px;padding:0.5rem 0.75rem;font-family:var(--font-mono),monospace;font-size:0.85rem;}`}</style>
        </form>

        <div>
          {!isContractConfigured() ? (
            <div className="boarding rounded-md p-6 text-paper/80">Contract not configured.</div>
          ) : policies === null ? <div className="mono text-paper/70">LOADING…</div>
          : policies.length === 0 ? (
            <div className="boarding rounded-md p-6 text-paper/80">
              <div className="font-display text-xl text-paper">No policies yet.</div>
              <p className="text-paper/60 text-sm mt-1">Add a policy to anchor future claim reviews.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {policies.map((p) => (
                <li key={p.id} className="paper rounded-md p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">{p.id}</div>
                  <div className="font-display text-lg">{p.name}</div>
                  <div className="text-sm text-stamped/70">{p.provider} · {p.reference}</div>
                  <div className="text-xs text-stamped/60 mt-1">Delay ≥ {p.delayThresholdHours}h · Max payout {p.maxPayout}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
    </AuthGate>
  );
}
