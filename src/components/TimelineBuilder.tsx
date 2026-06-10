"use client";
import { useState } from "react";
import { wpc } from "@/lib/genlayer/contracts";
import TransactionLink from "@/components/TransactionLink";

const EVENT_TYPES = [
  "BOOKING_CREATED","CHECK_IN","SCHEDULED_DEPARTURE","ACTUAL_DEPARTURE",
  "SCHEDULED_ARRIVAL","ACTUAL_ARRIVAL","DELAY_NOTICE","CANCELLATION_NOTICE",
  "BAGGAGE_REPORTED_MISSING","BAGGAGE_RETURNED","HOTEL_MISSED",
  "EXPENSE_INCURRED","CLAIM_FILED","INSURER_RESPONSE",
];

const CONFIDENCE = ["LOW","MEDIUM","HIGH"];

export type TimelineEvent = {
  id: string;
  time: string;
  location?: string;
  event_type: string;
  description: string;
  evidence_refs?: string[];
  confidence: string;
};

export default function TimelineBuilder({
  claimId, initial, onSaved,
}: {
  claimId: string;
  initial: TimelineEvent[];
  onSaved?: (events: TimelineEvent[]) => void;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initial ?? []);
  const [draft, setDraft] = useState<TimelineEvent>({
    id: "", time: "", location: "", event_type: "DELAY_NOTICE",
    description: "", evidence_refs: [], confidence: "MEDIUM",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  function add() {
    if (!draft.time || !draft.description) {
      setErr("Time and description are required."); return;
    }
    setErr(null);
    const next = [
      ...events,
      { ...draft, id: "tl-" + Date.now().toString(36) + Math.random().toString(36).slice(2,4) },
    ].sort((a, b) => a.time.localeCompare(b.time));
    setEvents(next);
    setDraft({ ...draft, time: "", location: "", description: "" });
  }

  function remove(id: string) {
    setEvents(events.filter(e => e.id !== id));
  }

  async function save() {
    setSaving(true); setErr(null); setTxHash(null);
    try {
      const hash = await wpc.setTimeline(claimId, JSON.stringify(events));
      setTxHash(hash);
      onSaved?.(events);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save timeline");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="paper rounded-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-stamped/60">Timeline Builder</div>
        <button onClick={save} disabled={saving || events.length === 0}
          className="bg-burgundy text-paper mono uppercase text-[10px] tracking-[0.25em] px-3 py-1.5 rounded disabled:opacity-40">
          {saving ? "Stamping…" : "Save Timeline On-Chain"}
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-stamped/60 text-sm">No events yet. Add the booking, scheduled vs actual departures, delay notice, and any expense events to give validators a clean timeline.</div>
      ) : (
        <ol className="space-y-2">
          {events.map(e => (
            <li key={e.id} className="border border-stamped/15 rounded p-3 flex items-start gap-3">
              <div className="mono text-[10px] text-stamped/60 w-32 shrink-0">{e.time}</div>
              <div className="flex-1">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-stamped/70">{e.event_type}{e.location ? ` · ${e.location}` : ""}</div>
                <div className="text-sm text-stamped">{e.description}</div>
                <div className="mono text-[9px] text-stamped/50 mt-1">confidence: {e.confidence}</div>
              </div>
              <button onClick={() => remove(e.id)} className="mono text-[10px] text-vermilion hover:underline">remove</button>
            </li>
          ))}
        </ol>
      )}

      <div className="hairline" />

      <div className="grid sm:grid-cols-2 gap-2">
        <input type="datetime-local" value={draft.time}
          onChange={e => setDraft({ ...draft, time: e.target.value })} className="input" />
        <select value={draft.event_type}
          onChange={e => setDraft({ ...draft, event_type: e.target.value })} className="input">
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
        </select>
        <input value={draft.location ?? ""} onChange={e => setDraft({ ...draft, location: e.target.value })}
          placeholder="Location (e.g. LHR T3)" className="input" />
        <select value={draft.confidence}
          onChange={e => setDraft({ ...draft, confidence: e.target.value })} className="input">
          {CONFIDENCE.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea value={draft.description} rows={2}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
          placeholder="What happened at this point in the trip?" className="input sm:col-span-2" />
      </div>

      {err && <div className="text-vermilion text-sm">{err}</div>}
      <TransactionLink hash={txHash} label="View timeline tx" />

      <button onClick={add} className="border border-stamped/30 mono text-[10px] uppercase tracking-[0.25em] px-3 py-1.5 rounded text-stamped hover:bg-stamped/5">
        + Add Event
      </button>

      <style jsx>{`.input{width:100%;background:#FBFAF7;color:#111;border:1px solid rgba(17,17,17,0.25);border-radius:4px;padding:0.5rem 0.75rem;font-family:var(--font-mono),monospace;font-size:0.85rem;}`}</style>
    </div>
  );
}
