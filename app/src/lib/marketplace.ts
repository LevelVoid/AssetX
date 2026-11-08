import { BN, Program } from "@anchor-lang/core";
import { fetchAsset, fetchAssetsByOwner } from "@metaplex-foundation/mpl-core";
import type { AssetV1 } from "@metaplex-foundation/mpl-core";
import { Connection, PublicKey } from "@solana/web3.js";

import { PROGRAM_ID } from "../config";
import { fetchAssetMetadata } from "./metadata";
import { umi } from "./umi";
import type {
  AccountWithPubkey,
  AssetKind,
  AssetSummary,
  ListingAccount,
  MarketplaceConfigAccount,
  TicketAccount,
} from "./types";
import { isTicketListing } from "./types";

export type MarketplaceProgram = Program;

/** Borsh discriminator (8) + ticket_id (8) + issuer (32). */
const TICKET_OWNER_OFFSET = 48;

export const getMarketplacePda = (): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from("marketplace")], PROGRAM_ID)[0];

export const getListingPda = (asset: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), asset.toBuffer()],
    PROGRAM_ID
  )[0];

export const getTicketPda = (issuer: PublicKey, ticketId: BN): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      Buffer.from("ticket"),
      issuer.toBuffer(),
      ticketId.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )[0];

export async function fetchMarketplaceConfig(
  program: MarketplaceProgram
): Promise<MarketplaceConfigAccount> {
  return (await (program.account as any).marketplaceConfig.fetch(
    getMarketplacePda()
  )) as MarketplaceConfigAccount;
}

export async function fetchListing(
  program: MarketplaceProgram,
  listing: PublicKey
): Promise<ListingAccount> {
  return (await (program.account as any).listing.fetch(
    listing
  )) as ListingAccount;
}

/** Collection of a Metaplex Core asset, when it is part of one. */
export async function fetchCoreCollection(
  assetAddress: PublicKey
): Promise<PublicKey | null> {
  const asset = await fetchAsset(umi, assetAddress.toBase58());
  return coreCollection(asset);
}

export async function fetchActiveListings(
  program: MarketplaceProgram
): Promise<Array<AccountWithPubkey<ListingAccount>>> {
  const now = Math.floor(Date.now() / 1000);
  const all = (await (program.account as any).listing.all()) as Array<
    AccountWithPubkey<ListingAccount>
  >;
  return all.filter(
    ({ account }) =>
      "active" in account.status && account.expiresAt.toNumber() > now
  );
}

export async function fetchMyListings(
  program: MarketplaceProgram,
  seller: PublicKey
): Promise<Array<AccountWithPubkey<ListingAccount>>> {
  const all = (await (program.account as any).listing.all()) as Array<
    AccountWithPubkey<ListingAccount>
  >;
  return all.filter(
    ({ account }) =>
      account.seller.equals(seller) && "active" in account.status
  );
}

const coreCollection = (asset: AssetV1): PublicKey | null => {
  if (
    asset.updateAuthority.type === "Collection" &&
    asset.updateAuthority.address
  ) {
    return new PublicKey(asset.updateAuthority.address);
  }
  return null;
};

export const ticketSummary = async (
  ticket: TicketAccount,
  asset: PublicKey,
  listing?: AccountWithPubkey<ListingAccount>
): Promise<AssetSummary> => {
  const metadata = await fetchAssetMetadata(ticket.metadataUri);
  return {
    kind: "ticket",
    asset,
    listing: listing?.publicKey,
    name: ticket.eventName,
    subtitle: ticket.seatCategory,
    image: metadata?.image,
    priceLamports: listing?.account.priceLamports,
    seller: listing?.account.seller,
    expiresAt: listing?.account.expiresAt,
    metadata,
    ticket,
  };
};

export const collectibleSummary = async (
  assetAddress: PublicKey,
  listing?: AccountWithPubkey<ListingAccount>
): Promise<AssetSummary> => {
  const asset = await fetchAsset(umi, assetAddress.toBase58());
  const metadata = await fetchAssetMetadata(asset.uri);
  return {
    kind: "collectible",
    asset: assetAddress,
    listing: listing?.publicKey,
    name: asset.name,
    subtitle: "Metaplex Core collectible",
    image: metadata?.image,
    priceLamports: listing?.account.priceLamports,
    seller: listing?.account.seller,
    expiresAt: listing?.account.expiresAt,
    metadata,
    collection: coreCollection(asset),
  };
};

export async function resolveListing(
  program: MarketplaceProgram,
  listingAddress: PublicKey,
  listingAccount?: ListingAccount
): Promise<AssetSummary> {
  const listing = listingAccount ?? (await fetchListing(program, listingAddress));
  const record = { publicKey: listingAddress, account: listing };

  if (isTicketListing(listing)) {
    const ticket = (await (program.account as any).ticket.fetch(
      listing.asset
    )) as TicketAccount;
    return ticketSummary(ticket, listing.asset, record);
  }

  return collectibleSummary(listing.asset, record);
}

export async function fetchOwnedTickets(
  program: MarketplaceProgram,
  owner: PublicKey
): Promise<Array<AccountWithPubkey<TicketAccount>>> {
  const all = (await (program.account as any).ticket.all([
    {
      memcmp: {
        offset: TICKET_OWNER_OFFSET,
        bytes: owner.toBase58(),
      },
    },
  ])) as Array<AccountWithPubkey<TicketAccount>>;
  return all;
}

export async function ownedTicketSummary(
  ticket: AccountWithPubkey<TicketAccount>
): Promise<AssetSummary> {
  return ticketSummary(ticket.account, ticket.publicKey);
}

export type OwnedCollectible = {
  asset: PublicKey;
  name: string;
  uri: string;
  collection: PublicKey | null;
};

export async function fetchOwnedCollectibles(
  owner: PublicKey
): Promise<OwnedCollectible[]> {
  const assets = await fetchAssetsByOwner(umi, owner.toBase58());
  return assets.map((asset) => ({
    asset: new PublicKey(asset.publicKey),
    name: asset.name,
    uri: asset.uri,
    collection: coreCollection(asset),
  }));
}

export type OwnedAsset = {
  kind: AssetKind;
  asset: PublicKey;
  name: string;
  subtitle: string;
  image?: string;
  metadataUri?: string;
  collection?: PublicKey | null;
};

export async function fetchOwnedAssets(
  program: MarketplaceProgram,
  owner: PublicKey
): Promise<OwnedAsset[]> {
  const [tickets, collectibles] = await Promise.all([
    fetchOwnedTickets(program, owner),
    fetchOwnedCollectibles(owner),
  ]);

  const ticketAssets = await Promise.all(
    tickets.map(async ({ publicKey, account }) => {
      const metadata = await fetchAssetMetadata(account.metadataUri);
      return {
        kind: "ticket" as const,
        asset: publicKey,
        name: account.eventName,
        subtitle: account.seatCategory,
        image: metadata?.image,
        metadataUri: account.metadataUri,
      };
    })
  );

  const collectibleAssets = await Promise.all(
    collectibles.map(async (item) => {
      const metadata = await fetchAssetMetadata(item.uri);
      return {
        kind: "collectible" as const,
        asset: item.asset,
        name: item.name,
        subtitle: "Metaplex Core collectible",
        image: metadata?.image,
        metadataUri: item.uri,
        collection: item.collection,
      };
    })
  );

  return [...ticketAssets, ...collectibleAssets];
}

/* ------------------------------------------------------------------ activity */

export type ActivityItem = {
  signature: string;
  blockTime?: number;
  label: string;
  detail?: string;
  signatureIndex: number;
};

const eventLabel = (name: string): string => {
  switch (name) {
    case "ListingCreated":
      return "New listing";
    case "ListingCancelled":
      return "Listing cancelled";
    case "AssetSold":
      return "Asset sold";
    case "TicketCreated":
      return "Demo ticket issued";
    case "TicketRedeemed":
      return "Ticket redeemed";
    case "IssuerRegistered":
      return "Issuer registered";
    case "IssuerStatusChanged":
      return "Issuer status changed";
    case "MarketplaceInitialized":
      return "Marketplace initialized";
    case "MarketplaceUpdated":
      return "Marketplace updated";
    default:
      return name;
  }
};

const numberFrom = (value: unknown): number | null => {
  if (value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") return Number(value);
  return null;
};

export async function fetchActivity(
  connection: Connection,
  program: MarketplaceProgram,
  limit = 20
): Promise<ActivityItem[]> {
  const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, {
    limit,
  });

  const items: ActivityItem[] = [];
  for (let index = 0; index < signatures.length; index += 1) {
    const entry = signatures[index];
    const transaction = await connection
      .getTransaction(entry.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })
      .catch(() => null);
    if (!transaction) continue;

    for (const log of transaction.meta?.logMessages ?? []) {
      if (!log.startsWith("Program data: ")) continue;
      try {
        const event = program.coder.events.decode(
          log.slice("Program data: ".length)
        );
        if (!event) continue;
        const data = event.data as Record<string, unknown>;
        const price = numberFrom(data.priceLamports ?? data.price_lamports);
        const detail =
          price !== null
            ? `◎ ${(price / 1_000_000_000).toFixed(3)}`
            : typeof data.eventName === "string"
              ? data.eventName
              : undefined;
        items.push({
          signature: entry.signature,
          blockTime: entry.blockTime ?? undefined,
          label: eventLabel(event.name),
          detail,
          signatureIndex: index,
        });
      } catch {
        // Ignore logs that are not Anchor events for this program.
      }
    }
  }

  return items;
}
