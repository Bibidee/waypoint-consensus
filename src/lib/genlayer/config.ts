export const GENLAYER_STUDIONET = {
  name: "GenLayer Studionet",
  chainId: 61999,
  rpcUrl: "https://studio.genlayer.com/api",
  currency: "GEN",
  explorerUrl: "https://explorer-studio.genlayer.com",
} as const;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS || "") as `0x${string}` | "";

export function isContractConfigured(): boolean {
  return Boolean(CONTRACT_ADDRESS && CONTRACT_ADDRESS.startsWith("0x"));
}
