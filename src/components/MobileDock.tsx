"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Desk" },
  { href: "/claims", label: "Claims" },
  { href: "/file-claim", label: "File" },
  { href: "/policies", label: "Vault" },
  { href: "/account/wallet", label: "Wallet" },
];

export default function MobileDock() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-passport/95 backdrop-blur border-t border-gold/30">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path?.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link href={it.href} className={`flex flex-col items-center py-2.5 mono text-[10px] uppercase tracking-[0.25em] ${active ? "text-gold" : "text-paper/70"}`}>
                <span className={`w-1.5 h-1.5 rounded-full mb-1 ${active ? "bg-gold" : "bg-paper/30"}`} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
