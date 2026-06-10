"use client";
import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { setActiveWallet } from "@/lib/genlayer/contracts";
import { clearClientCache } from "@/lib/genlayer/client";

/**
 * Mount once at app root. Whenever the user is authenticated and has an embedded
 * Privy wallet, we hand it to the GenLayer contract layer so writes sign through it.
 */
export default function WalletSync() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) return null;
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setActiveWallet(null);
      clearClientCache();
      return;
    }
    const embedded = wallets.find(w => w.walletClientType === "privy");
    if (!embedded) {
      setActiveWallet(null);
      return;
    }
    setActiveWallet({
      address: embedded.address,
      getEthereumProvider: () => embedded.getEthereumProvider(),
    });
  }, [authenticated, ready, wallets]);

  return null;
}
