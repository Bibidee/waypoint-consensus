"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";
import type { Claim } from "@/types";
import { SkeletonRow } from "@/components/Skeleton";

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!isContractConfigured()) { setClaims([]); return; }
    (async () => {
      const idsRaw = await wpc.listClaims();
      const ids: string[] = typeof idsRaw === "string" ? JSON.parse(idsRaw) : (idsRaw ?? []);
      const items = await Promise.all(ids.map(async (id) => {
        try { return JSON.parse(await wpc.getClaim(id)) as Claim; } catch { return null; }
      }));
      setClaims(items.filter(Boolean) as Claim[]);
    })().catch(() => setClaims([]));
  }, []);

  const filtered = (claims ?? []).filter(c => filter === "ALL" || c.status === filter);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Departures Board</div>
          <h1 className="font-display text-4xl text-paper">Claims</h1>
        </div>
        <Link href="/file-claim" className="bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">File a Claim</Link>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {["ALL","FILED","UNDER_CONSENSUS_REVIEW","APPROVED","PARTIALLY_APPROVED","REJECTED","NEEDS_MORE_EVIDENCE","DISPUTED","FINALIZED"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`mono text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded border ${filter===s ? "border-gold text-gold" : "border-paper/20 text-paper/60 hover:border-gold/50"}`}>{s.replace(/_/g," ")}</button>
        ))}
      </div>

      {!isContractConfigured() ? (
        <div className="boarding rounded-md p-6 text-paper/80">Contract not configured. Add <span className="mono">NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS</span>.</div>
      ) : claims === null ? (
        <div className="boarding rounded-md overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="boarding rounded-md p-10 text-center">
          <div className="font-display text-2xl text-paper">No Waypoint Files yet.</div>
          <p className="text-paper/70 mt-2">Create a claim to generate the first reviewable travel case.</p>
          <Link href="/file-claim" className="mt-5 inline-block bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-4 py-2 rounded">File a Claim</Link>
        </div>
      ) : (
        <div className="boarding rounded-md overflow-hidden">
          <div className="grid grid-cols-12 mono text-[10px] uppercase tracking-[0.25em] text-gold/70 px-4 py-3 border-b border-gold/20">
            <span className="col-span-3">Claim</span>
            <span className="col-span-3">Route</span>
            <span className="col-span-2">Incident</span>
            <span className="col-span-2">Policy</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          {filtered.map(c => (
            <Link key={c.id} href={`/claims/${c.id}`} className="grid grid-cols-12 px-4 py-3 border-b border-gold/10 hover:bg-gold/5">
              <span className="col-span-3 mono text-xs text-paper">{c.claimType?.replace(/_/g," ")}</span>
              <span className="col-span-3 mono text-xs text-paper/80">{c.route?.from} → {c.route?.to}</span>
              <span className="col-span-2 mono text-xs text-paper/70">{c.incidentDate}</span>
              <span className="col-span-2 mono text-xs text-paper/60 truncate">{c.policyId || "—"}</span>
              <span className="col-span-2 mono text-xs text-right text-gold">{c.status?.replace(/_/g," ")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
