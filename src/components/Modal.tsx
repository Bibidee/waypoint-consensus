"use client";
import { useEffect } from "react";

export default function Modal({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 px-4" onClick={onClose}>
      <div className="paper rounded-md max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
