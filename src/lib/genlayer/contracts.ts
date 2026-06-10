"use client";
import { getReadClientReady, getWriteClient } from "./client";
import { CONTRACT_ADDRESS, isContractConfigured } from "./config";

type Wallet = { address: string; getEthereumProvider: () => Promise<any> };
let activeWallet: Wallet | null = null;

export function setActiveWallet(w: Wallet | null) { activeWallet = w; }
export function getActiveWalletAddress() { return activeWallet?.address ?? null; }

function requireConfigured() {
  if (!isContractConfigured()) throw new Error("Contract not configured");
}

export async function readContract(method: string, args: any[] = []): Promise<any> {
  requireConfigured();
  const read = await getReadClientReady();
  return await read.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: method,
    args,
  });
}

/**
 * GenLayer write path:
 *   1. writeClient (genlayer-js, account+provider) is prepared via .connect("studionet").
 *   2. writeClient.writeContract dispatches through the consensus contract.
 *   3. readClient.waitForTransactionReceipt confirms ACCEPTED status.
 */
export async function writeContract(method: string, args: any[] = []): Promise<string> {
  requireConfigured();
  if (!activeWallet) throw new Error("Sign in to file claims and run consensus reviews.");

  const write = await getWriteClient(activeWallet);
  const read = await getReadClientReady();
  let hash = "";

  try {
    const txHash: any = await write.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: method,
      args,
      value: BigInt(0),
    });
    hash = typeof txHash === "string" ? txHash : (txHash?.hash ?? "");
    if (!hash) throw new Error("GenLayer did not return a transaction hash.");

    const { ExecutionResult, TransactionStatus } = await import("genlayer-js/types");
    const receipt = await read.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: 60,
      interval: 3000,
      fullTransaction: false,
    });

    if (receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
      throw new Error(`Contract execution failed for ${method}.`);
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const suffix = hash ? ` (transaction ${hash})` : "";
    throw new Error(`${msg}${suffix}`);
  }

  return hash;
}

export const wpc = {
  createPolicy: (id: string, json: string) => writeContract("create_policy", [id, json]),
  fileClaim: (id: string, policyId: string, json: string) =>
    writeContract("file_claim", [id, policyId, json]),
  addEvidence: (eid: string, cid: string, json: string) =>
    writeContract("add_evidence", [eid, cid, json]),
  setTimeline: (cid: string, json: string) => writeContract("set_claim_timeline", [cid, json]),
  openDispute: (did: string, cid: string, json: string) =>
    writeContract("open_dispute", [did, cid, json]),
  finalizeClaim: (cid: string) => writeContract("finalize_claim", [cid]),
  judgeClaim: (cid: string) => writeContract("judge_claim", [cid]),
  reviewDispute: (did: string) => writeContract("review_dispute", [did]),
  detectConflicts: (cid: string) => writeContract("detect_evidence_conflicts", [cid]),
  interpretGate: (cid: string, gate: string) =>
    writeContract("interpret_policy_gate", [cid, gate]),

  getPolicy: (id: string) => readContract("get_policy", [id]),
  getClaim: (id: string) => readContract("get_claim", [id]),
  getEvidence: (cid: string) => readContract("get_claim_evidence", [cid]),
  getTimeline: (cid: string) => readContract("get_claim_timeline", [cid]),
  getReview: (cid: string) => readContract("get_claim_review", [cid]),
  getDispute: (did: string) => readContract("get_dispute", [did]),
  getDisputeReview: (did: string) => readContract("get_dispute_review", [did]),
  listClaims: () => readContract("list_claims", []),
  listPolicies: () => readContract("list_policies", []),
  getStats: () => readContract("get_protocol_stats", []),
};
