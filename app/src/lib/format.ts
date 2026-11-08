import { BN } from "@anchor-lang/core";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const solToLamports = (input: string): BN | null => {
  const value = input.trim();
  if (!/^\d*(\.\d{0,9})?$/.test(value) || value === "" || value === ".") {
    return null;
  }
  const [whole, fraction = ""] = value.split(".");
  const lamports = `${whole || "0"}${fraction.padEnd(9, "0").slice(0, 9)}`;
  return new BN(lamports);
};

export const formatSol = (lamports: BN | number, digits = 3): string => {
  const value =
    typeof lamports === "number"
      ? lamports / LAMPORTS_PER_SOL
      : lamports.toNumber() / LAMPORTS_PER_SOL;
  return `${value.toFixed(digits).replace(/\.?0+$/, "")} SOL`;
};

export const formatTimestamp = (timestamp: BN | number): string => {
  const ms = (typeof timestamp === "number" ? timestamp : timestamp.toNumber()) * 1000;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (timestamp: BN | number): string => {
  const ms = (typeof timestamp === "number" ? timestamp : timestamp.toNumber()) * 1000;
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const timeLeft = (expiresAt: BN): string => {
  const seconds = expiresAt.toNumber() - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "expired";
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(seconds / 60))}m left`;
};

export function shortAddress(address: string, chars = 4): string {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export const feeFor = (priceLamports: BN, feeBps: number): BN => {
  const fee = priceLamports.muln(feeBps).divn(10_000);
  return fee;
};
