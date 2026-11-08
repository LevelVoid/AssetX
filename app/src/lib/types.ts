import type { BN } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";

export type AssetKind = "ticket" | "collectible";

export type MarketplaceConfigAccount = {
  authority: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  paused: boolean;
  bump: number;
};

export type IssuerAccount = {
  authority: PublicKey;
  name: string;
  metadataUri: string;
  active: boolean;
  bump: number;
};

export type TicketAccount = {
  ticketId: BN;
  issuer: PublicKey;
  owner: PublicKey;
  eventId: BN;
  eventName: string;
  seatCategory: string;
  eventTimestamp: BN;
  transferDeadline: BN;
  maxResalePrice: BN;
  redeemed: boolean;
  metadataUri: string;
  bump: number;
};

export type ListingAccount = {
  asset: PublicKey;
  assetType: { ticket: Record<string, never> } | { collectible: Record<string, never> };
  seller: PublicKey;
  priceLamports: BN;
  createdAt: BN;
  expiresAt: BN;
  status:
    | { active: Record<string, never> }
    | { sold: Record<string, never> }
    | { cancelled: Record<string, never> };
  bump: number;
};

export type AccountWithPubkey<T> = {
  publicKey: PublicKey;
  account: T;
};

export type AssetMetadata = {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

export type AssetSummary = {
  kind: AssetKind;
  /** Ticket PDA or Metaplex Core asset address. */
  asset: PublicKey;
  /** Active listing PDA, when the asset is listed. */
  listing?: PublicKey;
  name: string;
  subtitle: string;
  image?: string;
  priceLamports?: BN;
  seller?: PublicKey;
  expiresAt?: BN;
  metadata?: AssetMetadata | null;
  ticket?: TicketAccount;
  /** Core collection the asset belongs to, if any. */
  collection?: PublicKey | null;
};

export const isTicketListing = (listing: ListingAccount) =>
  "ticket" in listing.assetType;
