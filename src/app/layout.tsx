import "./globals.css";
import type { Metadata } from "next";
import { Marcellus, Sora, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import MobileDock from "@/components/MobileDock";
import Providers from "@/components/Providers";
import WalletSync from "@/components/WalletSync";
import AuthButton from "@/components/AuthButton";

const marcellus = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-marcellus" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Waypoint Consensus — Travel claims judged by evidence, policy, and consensus.",
  description: "GenLayer-powered travel insurance claim judgement layer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${marcellus.variable} ${sora.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <WalletSync />
          <header className="border-b border-gold/20 bg-passport/70 backdrop-blur">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-gold text-passport grid place-items-center font-display text-lg">W</span>
                <div>
                  <div className="font-display tracking-widest text-paper">WAYPOINT CONSENSUS</div>
                  <div className="text-[10px] mono text-gold/70 uppercase tracking-[0.25em]">Control Desk · Studionet</div>
                </div>
              </Link>
              <div className="flex items-center gap-6">
                <nav className="hidden md:flex items-center gap-6 text-sm text-paper/80">
                  <Link href="/claims" className="hover:text-gold">Claims</Link>
                  <Link href="/file-claim" className="hover:text-gold">File Claim</Link>
                  <Link href="/policies" className="hover:text-gold">Policy Vault</Link>
                </nav>
                <AuthButton />
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-6 py-10 pb-24 md:pb-10">{children}</main>
          <MobileDock />
          <footer className="border-t border-gold/20 mt-16">
            <div className="max-w-7xl mx-auto px-6 py-6 text-xs mono text-paper/50 flex justify-between flex-wrap gap-2">
              <span>WAYPOINT/CTRL · GENLAYER STUDIONET · CHAIN 61999</span>
              <span>Not legal advice or a regulated insurance decision unless adopted by an insurer.</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
