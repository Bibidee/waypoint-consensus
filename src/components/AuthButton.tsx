"use client";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function AuthButton() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) {
    return <span className="mono text-[10px] uppercase tracking-[0.2em] text-vermilion">No Privy</span>;
  }
  const { ready, authenticated, user, logout } = usePrivy();

  if (!ready) {
    return <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/50">…</span>;
  }

  if (!authenticated) {
    return (
      <Link
        href="/signin"
        className="bg-gold text-passport mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded hover:bg-gold/90"
      >
        Sign In
      </Link>
    );
  }

  const email = user?.email?.address ?? user?.google?.email ?? "traveller";
  return (
    <div className="flex items-center gap-3">
      <Link href="/account/wallet" className="mono text-[11px] text-paper/80 hover:text-gold truncate max-w-[160px]">{email}</Link>
      <button
        onClick={() => logout()}
        className="mono text-[10px] uppercase tracking-[0.25em] text-paper/60 hover:text-vermilion"
      >
        Sign Out
      </button>
    </div>
  );
}
