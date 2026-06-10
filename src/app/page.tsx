import Link from "next/link";
import ControlBoard from "@/components/ControlBoard";

const journey = [
  "Policy Loaded", "Claim Filed", "Evidence Checked", "Consensus Review", "Decision Stamped",
];

const gates = [
  "Policy active on travel date",
  "Event type covered",
  "Delay/cancellation threshold met",
  "Exclusion not triggered",
  "Evidence supports event",
  "Receipts support amount",
  "Claim filed within required window",
  "Traveller acted reasonably",
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero / Control Hall */}
      <section className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Waypoint Control Desk</div>
          <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.05] text-paper">
            Travel claims judged by evidence, policy, and consensus.
          </h1>
          <p className="mt-5 text-paper/75 max-w-xl">
            Upload policy terms, itineraries, receipts, and disruption evidence. GenLayer validators
            interpret the claim facts and produce a structured coverage decision.
          </p>
          <div className="mt-7 flex gap-3">
            <Link href="/file-claim" className="bg-gold text-passport mono uppercase text-xs tracking-[0.25em] px-5 py-3 rounded hover:bg-gold/90">File a Claim</Link>
            <Link href="/claims" className="border border-paper/30 text-paper mono uppercase text-xs tracking-[0.25em] px-5 py-3 rounded hover:border-gold">View Claims</Link>
          </div>
        </div>
        <ControlBoard />
      </section>

      {/* Claim Journey Strip */}
      <section>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-3">Claim Journey</div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {journey.map((j, i) => (
            <div key={j} className="flex items-center gap-3 shrink-0">
              <span className="paper px-4 py-2 rounded mono text-xs uppercase tracking-[0.2em]">{j}</span>
              {i < journey.length - 1 && <span className="text-gold mono">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Why travel claims are hard + GenLayer */}
      <section className="grid lg:grid-cols-2 gap-8">
        <div className="paper rounded-md p-8">
          <h2 className="font-display text-2xl">Why travel claims are hard</h2>
          <ul className="mt-4 space-y-2 text-stamped/80 text-sm list-disc pl-5">
            <li>Did the delay actually pass the policy threshold?</li>
            <li>Was the missed connection reasonably unavoidable?</li>
            <li>Do the receipts prove the loss the traveller is claiming?</li>
            <li>Does an exclusion quietly apply?</li>
            <li>Is the evidence internally consistent with the timeline?</li>
          </ul>
        </div>
        <div className="boarding rounded-md p-8">
          <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Why this needed GenLayer</div>
          <h2 className="mt-2 font-display text-2xl text-paper">Interpretation, not just storage.</h2>
          <p className="mt-3 text-paper/75 text-sm">
            A normal smart contract can store the claim and check fixed thresholds, but it cannot interpret
            ambiguous policy language or judge whether messy travel evidence supports a claim. GenLayer
            validators review the policy, evidence, and timeline and reach consensus on a structured decision
            that directly changes the claim&apos;s on-chain state.
          </p>
        </div>
      </section>

      {/* Policy Gates */}
      <section>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-3">Policy Gate System</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {gates.map((g, i) => (
            <div key={g} className="paper rounded p-4">
              <div className="mono text-[10px] text-stamped/50 uppercase tracking-[0.2em]">Gate {i + 1}</div>
              <div className="mt-1 text-stamped text-sm">{g}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-10">
        <div className="stamp text-gold mx-auto mb-4">Awaiting Consensus Review</div>
        <h3 className="font-display text-3xl text-paper">From itinerary chaos to reviewable claim decisions.</h3>
        <Link href="/file-claim" className="mt-6 inline-block bg-burgundy text-paper mono uppercase text-xs tracking-[0.25em] px-6 py-3 rounded hover:bg-burgundy/90">Begin a Waypoint File →</Link>
      </section>
    </div>
  );
}
