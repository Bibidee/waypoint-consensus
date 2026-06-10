"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { defineChain } from "viem";
import { ToastProvider } from "@/components/Toast";

const studionetViem = defineChain({
  id: 61999,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://studio.genlayer.com/api"] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer-studio.genlayer.com" },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  if (!appId) {
    return (
      <>
        <div className="border-b border-vermilion/40 bg-vermilion/10 text-vermilion text-xs px-6 py-2 mono uppercase tracking-[0.2em]">
          Privy not configured - set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable sign-in.
        </div>
        <ToastProvider>{children}</ToastProvider>
      </>
    );
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#D6A84F",
          logo: undefined,
          showWalletLoginFirst: false,
        },
        defaultChain: studionetViem,
        supportedChains: [studionetViem],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: false,
        },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </PrivyProvider>
  );
}
