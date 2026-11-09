/**
 * Demo issuance data for the RWA Exchange Devnet marketplace.
 *
 * All issuers, events and assets here are fictional. Nothing in this file represents a
 * real ticket, organiser or admission credential.
 */

export const DEFAULT_METADATA_BASE_URL =
  "https://raw.githubusercontent.com/LevelVoid/AssetX/main/assets/metadata";

export const metadataBaseUrl = () =>
  process.env.METADATA_BASE_URL ?? DEFAULT_METADATA_BASE_URL;

export const MARKETPLACE_FEE_BPS = 250;

/** Deterministic demo issuer identities. Their keys are derived from public labels. */
export type DemoIssuer = {
  key: string;
  name: string;
  metadataFile: string;
};

export const DEMO_ISSUERS: DemoIssuer[] = [
  { key: "cricket-board", name: "Demo Cricket Board", metadataFile: "issuers/cricket-board.json" },
  { key: "football-league", name: "Demo Football League", metadataFile: "issuers/football-league.json" },
  { key: "live-events", name: "Demo Live Events", metadataFile: "issuers/live-events.json" },
];

export type DemoTicket = {
  slug: string;
  ticketId: number;
  eventId: number;
  eventName: string;
  seatCategory: string;
  issuerKey: string;
  daysUntilEvent: number;
  daysUntilDeadline: number;
  maxResalePriceSol: number;
  metadataFile: string;
};

export const DEMO_TICKETS: DemoTicket[] = [
  {
    slug: "cricket-championship",
    ticketId: 1,
    eventId: 1001,
    eventName: "Cricket Championship",
    seatCategory: "General Stand",
    issuerKey: "cricket-board",
    daysUntilEvent: 30,
    daysUntilDeadline: 25,
    maxResalePriceSol: 0.5,
    metadataFile: "cricket-championship-general-stand.json",
  },
  {
    slug: "football-final",
    ticketId: 1,
    eventId: 2001,
    eventName: "Football Final",
    seatCategory: "Premium Stand",
    issuerKey: "football-league",
    daysUntilEvent: 21,
    daysUntilDeadline: 18,
    maxResalePriceSol: 1.5,
    metadataFile: "football-final-premium-stand.json",
  },
  {
    slug: "music-festival",
    ticketId: 1,
    eventId: 3001,
    eventName: "Music Festival",
    seatCategory: "VIP Pass",
    issuerKey: "live-events",
    daysUntilEvent: 45,
    daysUntilDeadline: 40,
    maxResalePriceSol: 2,
    metadataFile: "music-festival-vip-pass.json",
  },
];

export type DemoCollectible = {
  slug: string;
  name: string;
  issuerKey: string;
  metadataFile: string;
};

export const DEMO_COLLECTIBLES: DemoCollectible[] = [
  {
    slug: "championship-final",
    name: "Championship Final — Limited Edition",
    issuerKey: "football-league",
    metadataFile: "championship-final-limited-edition.json",
  },
  {
    slug: "legendary-player",
    name: "Legendary Player — Digital Sports Card",
    issuerKey: "football-league",
    metadataFile: "legendary-player-digital-card.json",
  },
  {
    slug: "festival-commemorative",
    name: "Festival Commemorative Collectible",
    issuerKey: "live-events",
    metadataFile: "festival-commemorative-collectible.json",
  },
];

export const COLLECTION_NAME = "RWA Demo Collectibles";
