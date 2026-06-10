"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets, useCreateWallet } from "@privy-io/react-auth";
import { getExplorerAddressUrl } from "@/lib/genlayer/explorer";
import { useToast } from "@/components/Toast";
import Modal from "@/components/Modal";

function shortAddr(a?: string) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export default function WalletPage() {
  const router = useRouter();
  const toast = useToast();
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) {
    return <div className="paper p-6">Privy not configured.</div>;
  }
  const { ready, authenticated, user, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  const embedded = wallets.find(w => w.walletClientType === "privy");

  const [exportWarnOpen, setExportWarnOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/signin?next=/account/wallet");
  }, [ready, authenticated, router]);

  // ---------- States ----------
  if (!ready) {
    return <div className="mono text-paper/60">Loading wallet…</div>;
  }
  if (!authenticated) {
    return <div className="mono text-paper/60">Redirecting to sign in…</div>;
  }

  // No wallet found - offer creation
  if (!embedded) {
    async function onCreate() {
      setCreating(true);
      try {
        await createWallet();
        toast.push("success", "Embedded wallet created");
      } catch (e: any) {
        toast.push("error", e?.message ?? "Could not create wallet");
      } finally { setCreating(false); }
    }
    return (
      <div className="paper rounded-md p-7 max-w-xl">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Waypoint Wallet</div>
        <h1 className="font-display text-3xl mt-1">No embedded wallet found.</h1>
        <p className="text-stamped/70 mt-2 text-sm">
          Every traveller needs one embedded EVM wallet to sign claims and consensus reviews on GenLayer Studionet.
        </p>
        <button
          onClick={onCreate}
          disabled={creating}
          className="mt-5 bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-5 py-3 rounded disabled:opacity-40"
        >
          {creating ? "Creating…" : "Create wallet"}
        </button>
      </div>
    );
  }

  const address = embedded.address;
  const email = user?.email?.address ?? user?.google?.email ?? "-";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(address);
      toast.push("success", "Wallet address copied");
    } catch {
      toast.push("error", "Could not copy address");
    }
  }

  async function onExportConfirm() {
    setExportWarnOpen(false);
    try {
      await exportWallet();
      toast.push("success", "Export completed");
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("cancel")) {
        toast.push("info", "Export cancelled");
      } else {
        toast.push("error", e?.message ?? "Export failed");
      }
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Waypoint Wallet</div>
        <h1 className="font-display text-4xl text-paper mt-1">Your embedded wallet</h1>
        <p className="text-paper/70 mt-2 text-sm">Held by Privy. Used to sign every Waypoint Consensus action.</p>
      </div>

      {/* Wallet card */}
      <section className="paper rounded-md p-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Traveller</div>
            <div className="font-display text-lg">{email}</div>
          </div>
          <span className="mono text-[10px] uppercase tracking-[0.25em] text-signal border border-signal/40 rounded px-2 py-0.5">Active</span>
        </div>

        <div className="hairline my-5" />

        <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Address</div>
        <div className="mt-1 mono text-sm break-all text-stamped">{address}</div>
        <div className="mt-1 mono text-[11px] text-stamped/50">{shortAddr(address)}</div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={onCopy}
            className="bg-stamped text-cloud mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded hover:bg-stamped/85"
          >
            Copy address
          </button>
          <a
            href={getExplorerAddressUrl(address)}
            target="_blank" rel="noreferrer"
            className="border border-stamped/40 mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded hover:bg-stamped/5"
          >
            View on explorer ↗
          </a>
        </div>
      </section>

      {/* Export */}
      <section className="paper rounded-md p-6">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Private key</div>
        <h2 className="font-display text-2xl mt-1">Export private key</h2>
        <p className="text-stamped/70 text-sm mt-2">
          Exporting reveals your key inside a Privy-controlled secure modal. Waypoint Consensus never sees or stores it.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={() => setExportWarnOpen(true)}
            className="bg-burgundy text-paper mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded"
          >
            Export private key
          </button>
        </div>
      </section>

      {/* Session */}
      <section className="paper rounded-md p-6">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-stamped/60">Session</div>
        <h2 className="font-display text-2xl mt-1">Sign out</h2>
        <p className="text-stamped/70 text-sm mt-2">
          Signs you out of Privy on this device. Your wallet is not deleted - sign back in to access it again.
        </p>
        <button
          onClick={onLogout}
          className="mt-4 border border-stamped/40 mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded hover:bg-stamped/5"
        >
          Sign out
        </button>
      </section>

      <div>
        <Link href="/claims" className="mono text-[10px] uppercase tracking-[0.25em] text-gold">← back to claims</Link>
      </div>

      {/* Export warning modal */}
      <Modal open={exportWarnOpen} onClose={() => setExportWarnOpen(false)}>
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-vermilion">Warning</div>
        <h3 className="font-display text-2xl mt-1">Export private key</h3>
        <ul className="text-stamped/85 text-sm mt-3 list-disc pl-5 space-y-1.5">
          <li>Anyone with this private key can control your Waypoint wallet.</li>
          <li>Never share it. Never paste it into unknown websites.</li>
          <li>Store it somewhere safe and offline.</li>
          <li>Waypoint Consensus cannot recover funds if your key is leaked.</li>
        </ul>
        <div className="hairline my-5" />
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setExportWarnOpen(false)}
            className="border border-stamped/40 mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onExportConfirm}
            className="bg-vermilion text-cloud mono uppercase text-[11px] tracking-[0.25em] px-4 py-2 rounded"
          >
            I understand - show key
          </button>
        </div>
      </Modal>
    </div>
  );
}
