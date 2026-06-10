"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { wpc } from "@/lib/genlayer/contracts";
import { isContractConfigured } from "@/lib/genlayer/config";
import type { ClaimType } from "@/types";
import AuthGate from "@/components/AuthGate";

const claimTypes: ClaimType[] = [
  "FLIGHT_DELAY","FLIGHT_CANCELLATION","MISSED_CONNECTION","LOST_BAGGAGE","DELAYED_BAGGAGE",
  "TRIP_CANCELLATION","TRIP_INTERRUPTION","HOTEL_CANCELLATION","MEDICAL_TRAVEL_INCIDENT",
  "DENIED_BOARDING","WEATHER_DISRUPTION","AIRLINE_STRIKE","OVERBOOKING","OTHER",
];

const Schema = z.object({
  policyId: z.string().min(1),
  claimType: z.string().min(1),
  from: z.string().min(2),
  to: z.string().min(2),
  connection: z.string().optional(),
  provider: z.string().min(2),
  bookingReference: z.string().min(2),
  incidentDate: z.string().min(4),
  claimedAmount: z.coerce.number().nonnegative(),
  currency: z.string().min(1).default("USD"),
  explanation: z.string().min(20),
});

type FormVals = z.infer<typeof Schema>;

export default function FileClaimPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormVals>({
    defaultValues: { currency: "USD" },
  });

  useEffect(() => {
    if (!isContractConfigured()) return;
    (async () => {
      try {
        const raw = await wpc.listPolicies();
        setPolicies(typeof raw === "string" ? JSON.parse(raw) : (raw ?? []));
      } catch { /* ignore */ }
    })();
  }, []);

  async function onSubmit(values: FormVals) {
    setErr(null);
    const parsed = Schema.safeParse(values);
    if (!parsed.success) { setErr("Please complete all required fields."); return; }
    if (!isContractConfigured()) { setErr("Contract not configured. Set NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS."); return; }
    setSubmitting(true);
    try {
      const id = "wpc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const now = Date.now();
      const claim = {
        id,
        claimType: values.claimType,
        route: { from: values.from, to: values.to, connection: values.connection || undefined },
        provider: values.provider,
        bookingReference: values.bookingReference,
        incidentDate: values.incidentDate,
        claimedAmount: values.claimedAmount,
        currency: values.currency,
        explanation: values.explanation,
        status: "FILED",
        createdAt: now,
        updatedAt: now,
      };
      const hash = await wpc.fileClaim(id, values.policyId, JSON.stringify(claim));
      router.push(`/claims/${id}?tx=${hash}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to file claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate action="file a claim">
    <div className="max-w-3xl mx-auto">
      <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70">Passport Desk</div>
      <h1 className="font-display text-4xl text-paper">File a Waypoint File</h1>
      <p className="text-paper/70 mt-2">Stamped pages - each section becomes part of the on-chain travel case.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
        <Section title="Policy">
          {policies.length === 0 ? (
            <p className="text-stamped/70 text-sm">No policies in the Vault yet. <a href="/policies" className="text-burgundy underline">Add a policy first.</a></p>
          ) : (
            <select {...register("policyId")} className="w-full bg-cloud border border-stamped/30 rounded px-3 py-2 mono text-sm">
              <option value="">- Select policy -</option>
              {policies.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </Section>

        <Section title="Trip">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="From"><input {...register("from")} className="input"/></Field>
            <Field label="To"><input {...register("to")} className="input"/></Field>
            <Field label="Connection (optional)"><input {...register("connection")} className="input"/></Field>
            <Field label="Airline / Provider"><input {...register("provider")} className="input"/></Field>
            <Field label="Booking Reference"><input {...register("bookingReference")} className="input"/></Field>
            <Field label="Incident Date"><input type="date" {...register("incidentDate")} className="input"/></Field>
          </div>
        </Section>

        <Section title="Incident">
          <Field label="Claim Type">
            <select {...register("claimType")} className="input">
              <option value="">- Select -</option>
              {claimTypes.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
          </Field>
          <Field label="Explanation">
            <textarea rows={5} {...register("explanation")} className="input" placeholder="Describe what happened, what you did to mitigate, and what you are claiming." />
          </Field>
        </Section>

        <Section title="Expenses">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Claimed Amount"><input type="number" step="0.01" {...register("claimedAmount")} className="input"/></Field>
            <Field label="Currency"><input {...register("currency")} className="input" defaultValue="USD"/></Field>
          </div>
        </Section>

        {err && <div className="paper p-3 text-vermilion text-sm">{err}</div>}
        {Object.keys(errors).length > 0 && <div className="paper p-3 text-vermilion text-sm">Please complete the highlighted fields.</div>}

        <div className="flex justify-end gap-3">
          <button type="submit" disabled={submitting} className="bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-5 py-3 rounded disabled:opacity-50">
            {submitting ? "Stamping…" : "Stamp & File"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .input { width: 100%; background: #FBFAF7; color: #111; border: 1px solid rgba(17,17,17,0.25); border-radius: 4px; padding: 0.5rem 0.75rem; font-family: var(--font-mono), monospace; font-size: 0.85rem; }
      `}</style>
    </div>
    </AuthGate>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="paper rounded-md p-5">
      <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60 mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-[0.2em] text-stamped/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
