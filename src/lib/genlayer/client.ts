"use client";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

/**
 * Two genlayer-js clients, per the GenLayer provider-based dApp pattern:
 *
 *   readClient  = createClient({ chain: studionet })
 *   writeClient = createClient({ chain: studionet, account, provider })
 *
 * Writes go through writeClient.writeContract (NOT viem walletClient.writeContract).
 * Receipts are polled on readClient.waitForTransactionReceipt.
 *
 * Before any write we call writeClient.connect("studionet") so the SDK
 * dispatches through GenLayer's consensus contract, not as a plain EVM tx.
 */

type WriteCtx = {
  client: any;
  address: string;
  prepared: Promise<void>;
};

let readClient: any = null;
let writeCtx: WriteCtx | null = null;

function getReadClient() {
  if (readClient) return readClient;
  readClient = createClient({ chain: studionet as any });
  return readClient;
}

async function prepareWriteClient(client: any) {
  try {
    if (typeof client.connect === "function") {
      await client.connect("studionet");
    }
  } catch (e) {
    console.warn("writeClient.connect warn:", e);
  }
  try {
    if (typeof client.initializeConsensusSmartContract === "function") {
      await client.initializeConsensusSmartContract();
    }
  } catch (e) {
    console.warn("initializeConsensusSmartContract warn:", e);
  }
}

export function clearClientCache() {
  writeCtx = null;
  readClient = null;
}

export async function getWriteClient(wallet: {
  address: string;
  getEthereumProvider: () => Promise<any>;
}) {
  if (writeCtx && writeCtx.address.toLowerCase() === wallet.address.toLowerCase()) {
    await writeCtx.prepared;
    return writeCtx.client;
  }
  const provider = await wallet.getEthereumProvider();
  const client = createClient({
    chain: studionet as any,
    account: wallet.address as `0x${string}`,
    provider,
  } as any);
  const prepared = prepareWriteClient(client);
  writeCtx = { client, address: wallet.address, prepared };
  await prepared;
  return client;
}

export async function getReadClientReady() {
  return getReadClient();
}
