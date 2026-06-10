"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type Ctx = { push: (kind: Toast["kind"], text: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`paper rounded-md px-4 py-3 shadow-lg mono text-xs uppercase tracking-[0.2em] flex items-start gap-3 ${
              t.kind === "success" ? "border-l-4 border-signal" :
              t.kind === "error" ? "border-l-4 border-vermilion" :
              "border-l-4 border-gold"
            }`}
          >
            <span className={
              t.kind === "success" ? "text-signal" :
              t.kind === "error" ? "text-vermilion" : "text-gold"
            }>●</span>
            <span className="text-stamped">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { push: (_k: any, _t: any) => {} };
}
