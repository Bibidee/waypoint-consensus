import { NextResponse } from "next/server";
import {
  getKeeperClient, getKeeperContractAddress, verifyKeeperAuth,
  safeReadClaim, safeReadReview, isReviewableStatus, judgeClaim, listAllClaimIds,
} from "@/lib/genlayer/keeperClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 1; // judge_claim is slow + nondeterministic - keep batches tiny.

export async function POST(req: Request) {
  if (!verifyKeeperAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const triggered: string[] = [];
  const skipped: Array<{ claimId: string; reason: string }> = [];

  try {
    const client = await getKeeperClient();
    const address = getKeeperContractAddress();
    const ids = await listAllClaimIds(client, address);

    for (const claimId of ids) {
      if (triggered.length >= MAX_PER_RUN) {
        skipped.push({ claimId, reason: "batch_cap_reached" });
        continue;
      }

      const claim = await safeReadClaim(client, address, claimId);
      if (!claim) { skipped.push({ claimId, reason: "claim_not_found" }); continue; }

      const existing = await safeReadReview(client, address, claimId);
      if (existing && (existing.decision || existing.claimId)) {
        skipped.push({ claimId, reason: "already_reviewed" }); continue;
      }

      if (!isReviewableStatus(claim.status)) {
        skipped.push({ claimId, reason: "not_reviewable_status" }); continue;
      }

      try {
        await judgeClaim(client, address, claimId);
        triggered.push(claimId);
      } catch (e: any) {
        skipped.push({ claimId, reason: `judge_failed:${e?.message ?? "unknown"}` });
      }
    }

    return NextResponse.json({ ok: true, triggered, skipped });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "batch failed", triggered, skipped }, { status: 500 });
  }
}
