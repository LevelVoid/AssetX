/**
 * Seed the RWA Exchange Devnet demo: marketplace config, demo issuers, Anchor tickets
 * and real Metaplex Core collectibles.
 *
 * Usage:
 *   npx ts-node scripts/issue-demo-assets.ts [--only=tickets|collectibles] [--url=<rpc>]
 *
 * Every demo issuer key is derived from a public label. These keys are worthless by design:
 * they exist only to sign demo issuance on Devnet and must never hold real value.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import * as anchor from "@anchor-lang/core";
import { BN, Program, Wallet } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  keypairIdentity,
  publicKey as umiPublicKey,
} from "@metaplex-foundation/umi";
import {
  create,
  createCollection,
  fetchAssetsByOwner,
  mplCore,
} from "@metaplex-foundation/mpl-core";

import {
  COLLECTION_NAME,
  DEMO_COLLECTIBLES,
  DEMO_ISSUERS,
  DEMO_TICKETS,
  MARKETPLACE_FEE_BPS,
  metadataBaseUrl,
} from "./demo-data";
import type { RwaExchange } from "../target/types/rwa_exchange";

const ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(ROOT, "target", "idl", "rwa_exchange.json");
const STATE_PATH = path.join(ROOT, ".demo-state.json");

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "true";
};

const endpoint =
  flag("url") ?? process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const only = flag("only");
if (only && only !== "tickets" && only !== "collectibles") {
  throw new Error(`--only must be "tickets" or "collectibles", received "${only}"`);
}

const log = (message: string) => console.log(message);

/* ------------------------------------------------------------------ wallet */

function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error(
      `No Solana keypair at ${walletPath}. Create one with: solana-keygen new --outfile ${walletPath}`
    );
  }
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

/** Deterministic, publicly derivable demo key. Never use for real assets. */
function derivedKeypair(label: string): Keypair {
  const seed = crypto
    .createHash("sha256")
    .update(`rwa-exchange-devnet-demo:${label}`)
    .digest();
  return Keypair.fromSeed(seed);
}

/* -------------------------------------------------------------- connection */

const admin = loadWallet();
const connection = new Connection(endpoint, "confirmed");
const provider = new anchor.AnchorProvider(connection, new Wallet(admin), {
  commitment: "confirmed",
});

const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
const program = new Program<RwaExchange>(idl, provider);

const base = metadataBaseUrl();
const metadataUri = (file: string) => `${base}/${file}`;

const [marketplacePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("marketplace")],
  program.programId
);

const issuerKeypair = (issuerKey: string) => derivedKeypair(`issuer:${issuerKey}`);
const issuerPda = (authority: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("issuer"), authority.toBuffer()],
    program.programId
  )[0];
const ticketPda = (issuer: PublicKey, ticketId: number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), issuer.toBuffer(), new BN(ticketId).toArrayLike(Buffer, "le", 8)],
    program.programId
  )[0];

/* ----------------------------------------------------------------- helpers */

async function exists(pubkey: PublicKey): Promise<boolean> {
  return (await connection.getAccountInfo(pubkey)) !== null;
}

async function transferSol(to: PublicKey, lamports: number) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: to, lamports })
  );
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, "confirmed");
}

async function ensureFunded(pubkey: PublicKey, minSol: number) {
  const balance = await connection.getBalance(pubkey);
  const required = Math.round(minSol * LAMPORTS_PER_SOL);
  if (balance >= required) return;
  log(`  funding ${pubkey.toBase58()} with ${(required - balance) / LAMPORTS_PER_SOL} SOL`);
  await transferSol(pubkey, required - balance);
}

async function ensureAdminFunds(minSol: number) {
  const balance = await connection.getBalance(admin.publicKey);
  if (balance >= minSol * LAMPORTS_PER_SOL) {
    log(`Admin ${admin.publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    return;
  }
  log(`Admin balance is ${balance / LAMPORTS_PER_SOL} SOL, requesting an airdrop...`);
  try {
    const signature = await connection.requestAirdrop(
      admin.publicKey,
      Math.ceil(minSol * LAMPORTS_PER_SOL)
    );
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    log(`Airdrop confirmed: ${signature}`);
  } catch (error) {
    throw new Error(
      `Unable to fund ${admin.publicKey.toBase58()} on ${endpoint}. ` +
        `Fund it from a faucet (https://faucet.solana.com) and rerun. Underlying error: ${String(error)}`
    );
  }
}

/* ------------------------------------------------------------ marketplace */

async function ensureMarketplace() {
  log("\n== Marketplace ==");
  if (await exists(marketplacePda)) {
    const config = await program.account.marketplaceConfig.fetch(marketplacePda);
    log(
      `  config ${marketplacePda.toBase58()} exists (fee ${config.feeBps} bps, paused ${config.paused})`
    );
    return;
  }

  await program.methods
    .initializeMarketplace(MARKETPLACE_FEE_BPS, admin.publicKey)
    .accountsPartial({
      authority: admin.publicKey,
      marketplace: marketplacePda,
      treasury: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  log(`  initialized ${marketplacePda.toBase58()} with fee ${MARKETPLACE_FEE_BPS} bps`);
}

/* ----------------------------------------------------------------- issuers */

async function ensureIssuers() {
  log("\n== Demo issuers ==");
  const registered: Record<string, { authority: PublicKey; issuer: PublicKey }> = {};

  for (const issuer of DEMO_ISSUERS) {
    const authority = issuerKeypair(issuer.key).publicKey;
    const pda = issuerPda(authority);
    registered[issuer.key] = { authority, issuer: pda };

    if (await exists(pda)) {
      log(`  ${issuer.name}: ${pda.toBase58()} (already registered)`);
      continue;
    }

    await program.methods
      .registerIssuer(issuer.name, metadataUri(issuer.metadataFile))
      .accountsPartial({
        authority: admin.publicKey,
        marketplace: marketplacePda,
        issuerAuthority: authority,
        issuer: pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    log(`  registered ${issuer.name}: ${pda.toBase58()}`);
  }

  return registered;
}

/* ----------------------------------------------------------------- tickets */

async function ensureTickets(
  issuers: Record<string, { authority: PublicKey; issuer: PublicKey }>
) {
  log("\n== Demo tickets ==");
  const now = Math.floor(Date.now() / 1000);
  const created: Array<{ slug: string; address: string }> = [];

  for (const ticket of DEMO_TICKETS) {
    const issuer = issuers[ticket.issuerKey];
    if (!issuer) throw new Error(`Unknown demo issuer "${ticket.issuerKey}"`);

    const pda = ticketPda(issuer.issuer, ticket.ticketId);
    created.push({ slug: ticket.slug, address: pda.toBase58() });

    if (await exists(pda)) {
      log(`  ${ticket.eventName} (${ticket.seatCategory}): ${pda.toBase58()} (exists)`);
      continue;
    }

    const issuerSigner = issuerKeypair(ticket.issuerKey);
    await ensureFunded(issuerSigner.publicKey, 0.05);

    const eventTimestamp = now + ticket.daysUntilEvent * 86_400;
    const transferDeadline = now + ticket.daysUntilDeadline * 86_400;
    const maxResalePrice = new BN(Math.round(ticket.maxResalePriceSol * LAMPORTS_PER_SOL));

    await program.methods
      .createTicket(
        new BN(ticket.ticketId),
        new BN(ticket.eventId),
        ticket.eventName,
        ticket.seatCategory,
        new BN(eventTimestamp),
        new BN(transferDeadline),
        maxResalePrice,
        metadataUri(ticket.metadataFile),
        admin.publicKey
      )
      .accountsPartial({
        authority: issuerSigner.publicKey,
        issuer: issuer.issuer,
        ticket: pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuerSigner])
      .rpc();

    log(
      `  issued ${ticket.eventName} (${ticket.seatCategory}) to ${admin.publicKey.toBase58()}: ${pda.toBase58()}`
    );
  }

  return created;
}

/* ------------------------------------------------------------- collectibles */

async function ensureCollectibles() {
  log("\n== Demo collectibles (Metaplex Core) ==");

  const umi = createUmi(endpoint).use(mplCore());
  const adminSigner = createSignerFromKeypair(
    umi,
    umi.eddsa.createKeypairFromSecretKey(admin.secretKey)
  );
  umi.use(keypairIdentity(adminSigner));

  const toUmiSigner = (keypair: Keypair) =>
    createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(keypair.secretKey));

  const collectionSigner = toUmiSigner(derivedKeypair("collection:collectibles"));
  const collectionAccount = await umi.rpc.getAccount(collectionSigner.publicKey);
  if (!collectionAccount.exists) {
    await createCollection(umi, {
      collection: collectionSigner,
      name: COLLECTION_NAME,
      uri: metadataUri("collection.json"),
    }).sendAndConfirm(umi);
    log(`  created collection ${collectionSigner.publicKey} (${COLLECTION_NAME})`);
  } else {
    log(`  collection ${collectionSigner.publicKey} exists`);
  }

  const created: Array<{ slug: string; address: string }> = [];
  for (const collectible of DEMO_COLLECTIBLES) {
    const assetSigner = toUmiSigner(derivedKeypair(`collectible:${collectible.slug}`));
    created.push({ slug: collectible.slug, address: assetSigner.publicKey });

    const account = await umi.rpc.getAccount(assetSigner.publicKey);
    if (account.exists) {
      log(`  ${collectible.name}: ${assetSigner.publicKey} (exists)`);
      continue;
    }

    await create(umi, {
      asset: assetSigner,
      collection: { publicKey: collectionSigner.publicKey },
      name: collectible.name,
      uri: metadataUri(collectible.metadataFile),
      owner: umiPublicKey(admin.publicKey.toBase58()),
    }).sendAndConfirm(umi);

    log(`  minted ${collectible.name}: ${assetSigner.publicKey}`);
  }

  const owned = await fetchAssetsByOwner(umi, umiPublicKey(admin.publicKey.toBase58()));
  log(
    `  admin now owns ${owned.length} Core asset(s): ${owned
      .map((asset) => asset.name)
      .join(", ")}`
  );

  return created;
}

/* -------------------------------------------------------------------- main */

async function main() {
  log(`RWA Exchange demo issuance`);
  log(`  cluster: ${endpoint}`);
  log(`  program: ${program.programId.toBase58()}`);
  log(`  metadata base: ${base}`);

  const programAccount = await connection.getAccountInfo(program.programId);
  if (!programAccount) {
    throw new Error(
      `Program ${program.programId.toBase58()} is not deployed on ${endpoint}. ` +
        `Run "anchor deploy --provider.cluster devnet" first.`
    );
  }

  await ensureAdminFunds(0.5);
  await ensureMarketplace();

  const issuers = await ensureIssuers();
  const state: Record<string, unknown> = stateFor(issuers);

  if (only !== "collectibles") {
    state.tickets = await ensureTickets(issuers);
  }
  if (only !== "tickets") {
    state.collectibles = await ensureCollectibles();
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
  log(`\nWrote ${path.relative(ROOT, STATE_PATH)}`);
  log("Demo assets are simulated and are not valid for entry to any real event.");
}

function stateFor(issuers: Record<string, { authority: PublicKey; issuer: PublicKey }>) {
  return {
    cluster: endpoint,
    programId: program.programId.toBase58(),
    marketplace: marketplacePda.toBase58(),
    issuers: Object.fromEntries(
      Object.entries(issuers).map(([key, value]) => [
        key,
        { authority: value.authority.toBase58(), issuer: value.issuer.toBase58() },
      ])
    ),
  };
}

main().catch((error) => {
  console.error(`\nDemo issuance failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
