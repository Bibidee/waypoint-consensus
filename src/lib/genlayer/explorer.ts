import { GENLAYER_STUDIONET } from "./config";

export const getExplorerAddressUrl = (address: string) =>
  `${GENLAYER_STUDIONET.explorerUrl}/address/${address}`;

export const getExplorerTxUrl = (txHash: string) =>
  `${GENLAYER_STUDIONET.explorerUrl}/tx/${txHash}`;
