# Waypoint Consensus

Travel claims judged by evidence, policy, and consensus — a GenLayer-powered travel insurance claim judgement layer.

## Setup

```bash
npm install
cp .env.local.example .env.local
# add NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS after deploying contracts/WaypointConsensus.py
npm run dev
```

## Contract

Deploy `contracts/WaypointConsensus.py` to GenLayer Studionet (chain 61999). The non-deterministic core lives in `judge_claim`, `review_dispute`, `detect_evidence_conflicts`, and `interpret_policy_gate` — each uses `gl.eq_principle.prompt_comparative` to reach validator consensus on a structured JSON verdict that drives claim state on-chain.

## Flow

1. Add a policy in `/policies`
2. File a claim in `/file-claim`
3. Add evidence in `/claims/[id]/evidence`
4. Run **GenLayer Consensus Review** on the claim detail page
5. Optionally open a dispute in `/claims/[id]/dispute` and run dispute review

No demo/mock data: every record comes from real user submissions and stored consensus results.
