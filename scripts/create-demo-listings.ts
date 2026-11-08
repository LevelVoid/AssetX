/**
 * Create demo listings on the marketplace.
 * This script lists the demo tickets and collectibles that were issued.
 *
 * Usage:
 *   npx ts-node scripts/create-demo-listings.ts
 */
import fs from "node:fs";
import path from "node:path";

import * as anchor from "@anchor-lang/core";
import { BN, Program, Wallet } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";

import type { RwaExchange } from "../target/types/rwa_exchange";

const ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(ROOT, "target", "idl", "rwa_exchange.json");
const STATE_PATH = path.join(ROOT, ".demo-state.json");

const log = (message: string) => console.log(message);

function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ??
    path.join(process.env.HOME || "~", ".config", "solana", "id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error(`No wallet found at ${walletPath}`);
  }
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

const admin = loadWallet();

if (!fs.existsSync(STATE_PATH)) {
  throw new Error(`No demo state found at ${STATE_PATH}. Run issue-demo-assets.ts first.`);
}

const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
const endpoint = state.cluster;

const connection = new Connection(endpoint, "confirmed");
const provider = new anchor.AnchorProvider(connection, new Wallet(admin), {
  commitment: "confirmed",
});

const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
const program = new Program<RwaExchange>(idl, provider);

const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const getListingPda = (asset: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), asset.toBuffer()],
    program.programId
  )[0];

async function exists(pubkey: PublicKey): Promise<boolean> {
  return (await connection.getAccountInfo(pubkey)) !== null;
}

const now = () => Math.floor(Date.now() / 1000);
const DAYS_7 = 7 * 24 * 60 * 60;

async function listTicket(ticketAddress: string, priceSol: number, slug: string) {
  const asset = new PublicKey(ticketAddress);
  const listing = getListingPda(asset);

  if (await exists(listing)) {
    log(`  ${slug}: already listed`);
    return;
  }

  const price = new BN(priceSol * LAMPORTS_PER_SOL);
  const expiresAt = new BN(now() + DAYS_7);
  const marketplace = new PublicKey(state.marketplace);

  await program.methods
    .listTicket(price, expiresAt)
    .accountsPartial({
      seller: admin.publicKey,
      marketplace,
      ticket: asset,
      listing,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  log(`  ${slug}: listed at ${priceSol} SOL`);
}

async function listCollectible(
  collectibleAddress: string,
  priceSol: number,
  slug: string
) {
  const asset = new PublicKey(collectibleAddress);
  const listing = getListingPda(asset);

  if (await exists(listing)) {
    log(`  ${slug}: already listed`);
    return;
  }

  const price = new BN(priceSol * LAMPORTS_PER_SOL);
  const expiresAt = new BN(now() + DAYS_7);
  const marketplace = new PublicKey(state.marketplace);

  await program.methods
    .listCollectible(price, expiresAt)
    .accountsPartial({
      seller: admin.publicKey,
      marketplace,
      asset,
      collection: null,
      listing,
      mplCoreProgram: MPL_CORE_ID,
      logWrapper: null as any,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  log(`  ${slug}: listed at ${priceSol} SOL`);
}

async function main() {
  log(`Creating demo listings on ${endpoint}`);
  log(`Admin: ${admin.publicKey.toBase58()}`);

  const balance = await connection.getBalance(admin.publicKey);
  log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // List tickets
  log("Listing tickets:");
  const tickets = state.tickets || [];
  for (const ticket of tickets) {
    await listTicket(ticket.address, 0.25, ticket.slug);
  }

  // List collectibles
  log("\nListing collectibles:");
  const collectibles = state.collectibles || [];
  for (const collectible of collectibles) {
    await listCollectible(collectible.address, 0.15, collectible.slug);
  }

  log("\nDemo listings created! Refresh the app to see them.");
}

main().catch((error) => {
  console.error(`\nFailed to create listings: ${error.message}`);
  console.error(error);
  process.exit(1);
});
