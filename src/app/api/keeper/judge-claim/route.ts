import { NextResponse } from "next/server";
import {
  getKeeperClient, getKeeperContractAddress, verifyKeeperAuth,
  safeReadClaim, safeReadReview, isReviewableStatus, judgeClaim,
} from "@/lib/genlayer/keeperClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!verifyKeeperAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const claimId: string = body?.claimId;
  if (!claimId || typeof claimId !== "string") {
    return NextResponse.json({ ok: false, error: "claimId required" }, { status: 400 });
  }

  try {
    const client = await getKeeperClient();
    const address = getKeeperContractAddress();

    const claim = await safeReadClaim(client, address, claimId);
    if (!claim || !claim.id) {
      return NextResponse.json({ ok: false, claimId, skipped: "claim_not_found" }, { status: 404 });
    }

    const existing = await safeReadReview(client, address, claimId);
    if (existing && (existing.decision || existing.claimId)) {
      return NextResponse.json({ ok: true, claimId, skipped: "already_reviewed", status: claim.status });
    }

    if (!isReviewableStatus(claim.status)) {
      return NextResponse.json({ ok: true, claimId, skipped: "not_reviewable_status", status: claim.status });
    }

    const hash = await judgeClaim(client, address, claimId);
    const updated = await safeReadClaim(client, address, claimId);

    return NextResponse.json({
      ok: true, claimId, txHash: hash,
      status: updated?.status ?? claim.status,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "judge_claim failed" }, { status: 500 });
  }
}
