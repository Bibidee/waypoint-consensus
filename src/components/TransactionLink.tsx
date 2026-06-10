"use client";
import { getExplorerTxUrl } from "@/lib/genlayer/explorer";

export default function TransactionLink({
  hash,
  label = "View transaction",
  className = "",
}: {
  hash: string | null;
  label?: string;
  className?: string;
}) {
  if (!hash) return null;

  const short = hash.slice(0, 8) + "…" + hash.slice(-6);

  return (
    <a
      href={getExplorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 bg-passport/60 border border-gold/40 rounded px-3 py-1.5 mono text-[10px] uppercase tracking-[0.25em] text-gold hover:bg-gold/10 hover:border-gold transition-colors ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
      <span>{label}</span>
      <span className="text-gold/60 normal-case tracking-normal text-[11px]">{short}</span>
      <span className="text-gold/70">↗</span>
    </a>
  );
}
