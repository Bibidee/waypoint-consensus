"use client";
import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthGate({ children, action = "continue" }: { children: ReactNode; action?: string }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) return <>{children}</>;
  const { ready, authenticated } = usePrivy();
  const path = usePathname();
  if (!ready) return <div className="mono text-paper/60">…</div>;
  if (!authenticated) {
    return (
      <div className="paper rounded-md p-8 max-w-xl">
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-stamped/60">Sign in required</div>
        <h2 className="font-display text-2xl mt-1">Sign in to {action}</h2>
        <p className="text-stamped/70 text-sm mt-2">
          Waypoint Consensus uses passwordless email or Google sign-in via Privy. Your embedded EVM wallet signs every on-chain action.
        </p>
        <Link
          href={`/signin?next=${encodeURIComponent(path ?? "/")}`}
          className="mt-5 inline-block bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-5 py-3 rounded"
        >
          Sign In
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
