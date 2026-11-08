import { PublicKey } from "@solana/web3.js";

/** Single source of truth for the Devnet deployment used by every screen. */
export const PROGRAM_ID = new PublicKey(
  "EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA"
);

export const RPC_URL =
  process.env.EXPO_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER = "devnet";

/** Metaplex Core program on Devnet (and all Solana clusters). */
export const MPL_CORE_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

export const EXPLORER_BASE = "https://explorer.solana.com";
export const FEE_DENOMINATOR = 10_000;

export const APP_IDENTITY = {
  name: "RWA Exchange",
  uri: "https://github.com/pradeepbiswas/AssetX",
  icon: "https://raw.githubusercontent.com/pradeepbiswas/AssetX/main/app/assets/icon.png",
};

export const txExplorerUrl = (signature: string) =>
  `${EXPLORER_BASE}/tx/${signature}?cluster=${CLUSTER}`;

export const addressExplorerUrl = (address: string) =>
  `${EXPLORER_BASE}/address/${address}?cluster=${CLUSTER}`;
