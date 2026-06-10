"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="mono text-paper/60">Loading…</div>}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("next") || "/account/wallet";
  const toast = useToast();

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) {
    return <div className="paper rounded-md p-6 max-w-md">Privy is not configured. Set <span className="mono">NEXT_PUBLIC_PRIVY_APP_ID</span>.</div>;
  }

  const { ready, authenticated } = usePrivy();
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: () => { toast.push("success", "Signed in"); router.replace(redirect); },
    onError: (e: any) => toast.push("error", e?.message ?? "Sign in failed"),
  });
  const { initOAuth, state: oauthState } = useLoginWithOAuth({
    onComplete: () => router.replace(redirect),
    onError: (e: any) => toast.push("error", e?.message ?? "Google sign in failed"),
  });

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && authenticated) router.replace(redirect);
  }, [ready, authenticated, redirect, router]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await sendCode({ email });
      setStage("code");
      toast.push("info", "Check your email for the code");
    } catch (err: any) {
      toast.push("error", err?.message ?? "Could not send code");
    } finally { setBusy(false); }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    try {
      await loginWithCode({ code });
    } catch (err: any) {
      toast.push("error", err?.message ?? "Invalid code");
    } finally { setBusy(false); }
  }

  async function onGoogle() {
    setBusy(true);
    try { await initOAuth({ provider: "google" }); }
    catch (err: any) { toast.push("error", err?.message ?? "Google sign in failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-10 items-start">
      <div>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Passport Control</div>
        <h1 className="font-display text-5xl mt-3 text-paper">Sign in.</h1>
        <p className="text-paper/75 mt-3 max-w-md">
          Waypoint Consensus uses passwordless sign-in. Enter your email — we send a one-time code. No password, no recovery flow.
        </p>
        <p className="text-paper/60 mt-3 text-sm max-w-md">
          On first sign-in we create your embedded EVM wallet automatically. It signs every claim, evidence, and consensus action on Studionet.
        </p>
      </div>

      <div className="paper rounded-md p-7">
        {stage === "email" ? (
          <form onSubmit={onSend} className="space-y-4">
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@traveller.io"
                className="mt-1 w-full bg-cloud border border-stamped/25 rounded px-3 py-2.5 mono text-sm"
              />
            </div>
            <button
              disabled={busy || !email}
              className="w-full bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-3 rounded disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send login code"}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-stamped/15" />
              <span className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/50">or</span>
              <div className="flex-1 h-px bg-stamped/15" />
            </div>

            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              className="w-full border border-stamped/30 text-stamped mono uppercase text-xs tracking-[0.25em] px-4 py-3 rounded hover:bg-stamped/5"
            >
              Continue with Google
            </button>

            <p className="text-stamped/55 text-xs mt-3">
              No passwords. No "forgot password" — your email inbox is the recovery channel.
            </p>
          </form>
        ) : (
          <form onSubmit={onVerify} className="space-y-4">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Check your email</div>
              <div className="font-display text-xl mt-1">Enter the 6-digit code</div>
              <div className="mono text-xs text-stamped/60 mt-1">sent to {email}</div>
            </div>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoFocus
              placeholder="••••••"
              className="w-full bg-cloud border border-stamped/25 rounded px-3 py-3 mono text-2xl tracking-[0.5em] text-center"
            />
            <button
              disabled={busy || code.length < 4}
              className="w-full bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-4 py-3 rounded disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Verify & enter"}
            </button>
            <button
              type="button"
              onClick={() => { setStage("email"); setCode(""); }}
              className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60 hover:text-burgundy"
            >
              ← use a different email
            </button>
          </form>
        )}

        <div className="hairline mt-6" />
        <p className="text-stamped/50 text-xs mt-3 mono">
          Auth state: {emailState?.status ?? "idle"} · OAuth: {oauthState?.status ?? "idle"}
        </p>
      </div>

      <div className="lg:col-span-2">
        <Link href="/" className="mono text-[10px] uppercase tracking-[0.25em] text-paper/60 hover:text-gold">← back to control desk</Link>
      </div>
    </div>
  );
}
