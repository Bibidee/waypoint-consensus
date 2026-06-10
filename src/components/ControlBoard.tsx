"use client";
import { useEffect, useState } from "react";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";
import type { Claim } from "@/types";
import Link from "next/link";

const statusLabel: Record<string, string> = {
  FILED: "AWAITING REVIEW",
  EVIDENCE_PENDING: "NEEDS EVIDENCE",
  UNDER_CONSENSUS_REVIEW: "CONSENSUS REVIEW",
  APPROVED: "APPROVED",
  PARTIALLY_APPROVED: "PARTIAL COVER",
  REJECTED: "REJECTED",
  NEEDS_MORE_EVIDENCE: "NEEDS EVIDENCE",
  DISPUTED: "DISPUTED",
  FINALIZED: "FINALIZED",
};

const statusTone: Record<string, string> = {
  APPROVED: "text-signal",
  PARTIALLY_APPROVED: "text-gold",
  REJECTED: "text-vermilion",
  NEEDS_MORE_EVIDENCE: "text-gold",
  UNDER_CONSENSUS_REVIEW: "text-teal",
  DISPUTED: "text-vermilion",
  FINALIZED: "text-paper",
  FILED: "text-paper/80",
};

export default function ControlBoard() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isContractConfigured()) { setClaims([]); return; }
    (async () => {
      try {
        const idsRaw = await wpc.listClaims();
        const ids: string[] = typeof idsRaw === "string" ? JSON.parse(idsRaw) : (idsRaw ?? []);
        const items = await Promise.all(ids.map(async (id) => {
          const raw = await wpc.getClaim(id);
          try { return JSON.parse(raw) as Claim; } catch { return null; }
        }));
        setClaims(items.filter(Boolean) as Claim[]);
      } catch (e: any) { setErr(e?.message ?? "Failed to load claims"); setClaims([]); }
    })();
  }, []);

  if (!isContractConfigured()) {
    return (
      <div className="boarding rounded-md p-6">
        <div className="mono text-xs uppercase tracking-[0.25em] text-gold/80">Setup required</div>
        <div className="mt-2 font-display text-xl text-paper">GenLayer contract is not configured yet.</div>
        <p className="mt-2 text-paper/70 text-sm">Deploy <span className="mono">WaypointConsensus</span> and add <span className="mono">NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS</span> to enable live claims.</p>
      </div>
    );
  }

  if (claims === null) {
    return <div className="boarding rounded-md p-6 mono text-sm text-paper/70">LOADING CONTROL BOARD…</div>;
  }

  if (err) return <div className="boarding rounded-md p-6 mono text-vermilion text-sm">{err}</div>;

  if (claims.length === 0) {
    return (
      <div className="boarding rounded-md p-6">
        <div className="mono text-xs uppercase tracking-[0.25em] text-gold/80">Control Board</div>
        <div className="mt-2 font-display text-xl text-paper">No claim waypoints yet.</div>
        <p className="mt-2 text-paper/70 text-sm">File the first travel claim to begin GenLayer consensus review.</p>
        <Link href="/file-claim" className="mt-4 inline-block mono text-xs text-gold uppercase tracking-[0.25em] border border-gold/50 px-3 py-2 rounded hover:bg-gold/10">File a Claim →</Link>
      </div>
    );
  }

  return (
    <div className="boarding rounded-md p-6">
      <div className="mono text-xs uppercase tracking-[0.25em] text-gold/80 mb-3">Live Control Board</div>
      <ul className="divide-y divide-gold/10">
        {claims.slice(0, 8).map((c) => (
          <li key={c.id}>
            <Link href={`/claims/${c.id}`} className="grid grid-cols-12 items-center py-3 gap-3 hover:bg-gold/5 px-2 rounded">
              <span className="col-span-3 mono text-xs text-paper/60 truncate">{(c.claimType ?? "OTHER").replace(/_/g, " ")}</span>
              <span className="col-span-4 mono text-xs text-paper/80 truncate">{c.route?.from ?? "-"} → {c.route?.to ?? "-"}</span>
              <span className="col-span-2 mono text-xs text-paper/60 truncate">{c.id.slice(0, 10)}</span>
              <span className={`col-span-3 mono text-xs text-right tracking-[0.2em] ${statusTone[c.status] ?? "text-paper"}`}>
                {statusLabel[c.status] ?? c.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
