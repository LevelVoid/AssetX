import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, fetchAsset, mplCore } from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
} from "@metaplex-foundation/umi";
import { assert } from "chai";

import type { RwaExchange } from "../target/types/rwa_exchange";

const BN = anchor.BN;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.RwaExchange as Program<RwaExchange>;
const connection = provider.connection;
const authority = provider.wallet as anchor.Wallet;

const treasury = Keypair.generate();
const issuerAuthority = Keypair.generate();

const MPL_CORE_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const [marketplacePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("marketplace")],
  program.programId
);
const [issuerPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("issuer"), issuerAuthority.publicKey.toBuffer()],
  program.programId
);

const ticketPda = (ticketId: number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), issuerPda.toBuffer(), new BN(ticketId).toArrayLike(Buffer, "le", 8)],
    program.programId
  )[0];

const listingPda = (asset: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), asset.toBuffer()],
    program.programId
  )[0];

const now = () => Math.floor(Date.now() / 1000);

/** Cluster time, which can drift from the host clock on a local validator. */
async function chainNow(): Promise<number> {
  const slot = await connection.getSlot("confirmed");
  return (await connection.getBlockTime(slot)) ?? now();
}

const defaultTicket = (ticketId = 1) => ({
  ticketId: new BN(ticketId),
  eventId: new BN(2026),
  eventName: "Cricket Championship",
  seatCategory: "General Stand",
  eventTimestamp: new BN(now() + 30 * 24 * 60 * 60),
  transferDeadline: new BN(now() + 25 * 24 * 60 * 60),
  maxResalePrice: new BN(0.5 * LAMPORTS_PER_SOL),
  metadataUri: "https://example.com/metadata/cricket.json",
});

async function fund(pubkey: PublicKey, sol = 2) {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

async function expectFailure(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    assert.fail(`expected transaction to fail with ${code}`);
  } catch (err: any) {
    const text = [
      err?.error?.errorCode?.code,
      err?.error?.errorMessage,
      err?.message,
      Array.isArray(err?.logs) ? err.logs.join("\n") : undefined,
      Array.isArray(err?.transactionLogs) ? err.transactionLogs.join("\n") : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    assert.include(text, code);
  }
}

async function issueTicket(ticketId: number, owner: PublicKey, maxResaleSol = 0.5) {
  const ticket = defaultTicket(ticketId);
  await program.methods
    .createTicket(
      ticket.ticketId,
      ticket.eventId,
      ticket.eventName,
      ticket.seatCategory,
      ticket.eventTimestamp,
      ticket.transferDeadline,
      new BN(maxResaleSol * LAMPORTS_PER_SOL),
      ticket.metadataUri,
      owner
    )
    .accountsPartial({
      authority: issuerAuthority.publicKey,
      issuer: issuerPda,
      ticket: ticketPda(ticketId),
      systemProgram: SystemProgram.programId,
    })
    .signers([issuerAuthority])
    .rpc();
}

describe("rwa_exchange: configuration and issuance", () => {
  before(async () => {
    await fund(issuerAuthority.publicKey);
  });

  it("initializes the marketplace", async () => {
    await program.methods
      .initializeMarketplace(250, treasury.publicKey)
      .accountsPartial({
        authority: authority.publicKey,
        marketplace: marketplacePda,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.marketplaceConfig.fetch(marketplacePda);
    assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(config.treasury.toBase58(), treasury.publicKey.toBase58());
    assert.equal(config.feeBps, 250);
    assert.equal(config.paused, false);
  });

  it("rejects a second initialization", async () => {
    await expectFailure(
      program.methods
        .initializeMarketplace(250, treasury.publicKey)
        .accountsPartial({
          authority: authority.publicKey,
          marketplace: marketplacePda,
          treasury: treasury.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "already in use"
    );
  });

  it("registers an issuer (admin only)", async () => {
    const attacker = Keypair.generate();
    await fund(attacker.publicKey, 1);

    await expectFailure(
      program.methods
        .registerIssuer("Demo Cricket Board", "https://example.com/issuer/cricket.json")
        .accountsPartial({
          authority: attacker.publicKey,
          marketplace: marketplacePda,
          issuerAuthority: issuerAuthority.publicKey,
          issuer: issuerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc(),
      "ConstraintHasOne"
    );

    await program.methods
      .registerIssuer("Demo Cricket Board", "https://example.com/issuer/cricket.json")
      .accountsPartial({
        authority: authority.publicKey,
        marketplace: marketplacePda,
        issuerAuthority: issuerAuthority.publicKey,
        issuer: issuerPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const issuer = await program.account.issuer.fetch(issuerPda);
    assert.equal(issuer.authority.toBase58(), issuerAuthority.publicKey.toBase58());
    assert.equal(issuer.name, "Demo Cricket Board");
    assert.equal(issuer.active, true);
  });

  it("issues a ticket from an active issuer", async () => {
    await issueTicket(1, issuerAuthority.publicKey);

    const account = await program.account.ticket.fetch(ticketPda(1));
    assert.equal(account.ticketId.toNumber(), 1);
    assert.equal(account.issuer.toBase58(), issuerPda.toBase58());
    assert.equal(account.owner.toBase58(), issuerAuthority.publicKey.toBase58());
    assert.equal(account.eventName, "Cricket Championship");
    assert.equal(account.seatCategory, "General Stand");
    assert.equal(account.redeemed, false);
    assert.equal(account.maxResalePrice.toNumber(), 0.5 * LAMPORTS_PER_SOL);
  });

  it("rejects duplicate issuance, bad deadlines and unregistered issuers", async () => {
    await expectFailure(issueTicket(1, issuerAuthority.publicKey), "already in use");

    // transfer deadline after the event
    await expectFailure(
      program.methods
        .createTicket(
          new BN(2),
          new BN(2026),
          "Football Final",
          "Premium Stand",
          new BN(now() + 1000),
          new BN(now() + 2000),
          new BN(LAMPORTS_PER_SOL),
          "https://example.com/metadata/football.json",
          issuerAuthority.publicKey
        )
        .accountsPartial({
          authority: issuerAuthority.publicKey,
          issuer: issuerPda,
          ticket: ticketPda(2),
          systemProgram: SystemProgram.programId,
        })
        .signers([issuerAuthority])
        .rpc(),
      "InvalidTransferDeadline"
    );

    // unknown issuer authority
    const stranger = Keypair.generate();
    await fund(stranger.publicKey, 1);
    await expectFailure(
      program.methods
        .createTicket(
          new BN(3),
          new BN(2026),
          "Music Festival",
          "VIP Pass",
          new BN(now() + 1000),
          new BN(now() + 500),
          new BN(LAMPORTS_PER_SOL),
          "https://example.com/metadata/festival.json",
          stranger.publicKey
        )
        .accountsPartial({
          authority: stranger.publicKey,
          issuer: issuerPda,
          ticket: ticketPda(3),
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
      "ConstraintSeeds"
    );
  });

  it("stops an inactive issuer from issuing", async () => {
    await program.methods
      .setIssuerActive(false)
      .accountsPartial({
        authority: authority.publicKey,
        marketplace: marketplacePda,
        issuer: issuerPda,
      })
      .rpc();

    await expectFailure(issueTicket(10, issuerAuthority.publicKey), "IssuerInactive");

    await program.methods
      .setIssuerActive(true)
      .accountsPartial({
        authority: authority.publicKey,
        marketplace: marketplacePda,
        issuer: issuerPda,
      })
      .rpc();
  });

  it("redeems a ticket exactly once", async () => {
    await program.methods
      .redeemTicket()
      .accountsPartial({
        authority: issuerAuthority.publicKey,
        issuer: issuerPda,
        ticket: ticketPda(1),
      })
      .signers([issuerAuthority])
      .rpc();

    const account = await program.account.ticket.fetch(ticketPda(1));
    assert.equal(account.redeemed, true);

    await expectFailure(
      program.methods
        .redeemTicket()
        .accountsPartial({
          authority: issuerAuthority.publicKey,
          issuer: issuerPda,
          ticket: ticketPda(1),
        })
        .signers([issuerAuthority])
        .rpc(),
      "TicketRedeemed"
    );
  });

  it("pauses and unpauses the marketplace (admin only)", async () => {
    await expectFailure(
      program.methods
        .updateMarketplace(250, treasury.publicKey, true)
        .accountsPartial({ authority: issuerAuthority.publicKey, marketplace: marketplacePda })
        .signers([issuerAuthority])
        .rpc(),
      "ConstraintHasOne"
    );

    await program.methods
      .updateMarketplace(300, treasury.publicKey, true)
      .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
      .rpc();

    let config = await program.account.marketplaceConfig.fetch(marketplacePda);
    assert.equal(config.paused, true);
    assert.equal(config.feeBps, 300);

    await program.methods
      .updateMarketplace(250, treasury.publicKey, false)
      .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
      .rpc();

    config = await program.account.marketplaceConfig.fetch(marketplacePda);
    assert.equal(config.paused, false);
    assert.equal(config.feeBps, 250);
  });
});

describe("rwa_exchange: listings and escrow", () => {
  const seller = Keypair.generate();
  const ticketId = 100;
  const price = new BN(0.4 * LAMPORTS_PER_SOL);

  before(async () => {
    await fund(seller.publicKey, 2);
    await issueTicket(ticketId, seller.publicKey, 0.5);
    await issueTicket(101, seller.publicKey, 0.5);
    await issueTicket(102, seller.publicKey, 0.5);
  });

  it("rejects a resale price above the issuer cap", async () => {
    await expectFailure(
      program.methods
        .listTicket(new BN(0.6 * LAMPORTS_PER_SOL), new BN(now() + 86_400))
        .accountsPartial({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(ticketId),
          listing: listingPda(ticketPda(ticketId)),
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc(),
      "ResalePriceAboveCap"
    );
  });

  it("moves a ticket into marketplace escrow and creates a listing", async () => {
    const expiresAt = now() + 86_400;
    await program.methods
      .listTicket(price, new BN(expiresAt))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(ticketId),
        listing: listingPda(ticketPda(ticketId)),
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda(ticketId));
    assert.equal(ticket.owner.toBase58(), marketplacePda.toBase58());

    const listing = await program.account.listing.fetch(listingPda(ticketPda(ticketId)));
    assert.equal(listing.asset.toBase58(), ticketPda(ticketId).toBase58());
    assert.deepEqual(listing.assetType, { ticket: {} });
    assert.equal(listing.seller.toBase58(), seller.publicKey.toBase58());
    assert.equal(listing.priceLamports.toNumber(), price.toNumber());
    assert.equal(listing.expiresAt.toNumber(), expiresAt);
    assert.deepEqual(listing.status, { active: {} });
  });

  it("rejects a duplicate listing and a non-owner listing", async () => {
    await expectFailure(
      program.methods
        .listTicket(price, new BN(now() + 86_400))
        .accountsPartial({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(ticketId),
          listing: listingPda(ticketPda(ticketId)),
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc(),
      "already in use"
    );

    const stranger = Keypair.generate();
    await fund(stranger.publicKey, 1);
    await expectFailure(
      program.methods
        .listTicket(price, new BN(now() + 86_400))
        .accountsPartial({
          seller: stranger.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(101),
          listing: listingPda(ticketPda(101)),
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
      "NotAssetOwner"
    );
  });

  it("blocks listing while the marketplace is paused", async () => {
    await program.methods
      .updateMarketplace(250, treasury.publicKey, true)
      .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
      .rpc();

    try {
      await expectFailure(
        program.methods
          .listTicket(price, new BN(now() + 86_400))
          .accountsPartial({
            seller: seller.publicKey,
            marketplace: marketplacePda,
            ticket: ticketPda(102),
            listing: listingPda(ticketPda(102)),
            systemProgram: SystemProgram.programId,
          })
          .signers([seller])
          .rpc(),
        "MarketplacePaused"
      );
    } finally {
      await program.methods
        .updateMarketplace(250, treasury.publicKey, false)
        .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
        .rpc();
    }
  });

  it("lets only the seller cancel, then returns the ticket and frees the PDA", async () => {
    const listing = listingPda(ticketPda(ticketId));
    const stranger = Keypair.generate();
    await fund(stranger.publicKey, 1);

    await expectFailure(
      program.methods
        .cancelTicketListing()
        .accountsPartial({
          seller: stranger.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(ticketId),
          listing,
        })
        .signers([stranger])
        .rpc(),
      "ConstraintHasOne"
    );

    await program.methods
      .cancelTicketListing()
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(ticketId),
        listing,
      })
      .signers([seller])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda(ticketId));
    assert.equal(ticket.owner.toBase58(), seller.publicKey.toBase58());
    assert.isNull(await connection.getAccountInfo(listing));

    // The closed PDA can be reused by a new listing of the same asset.
    await program.methods
      .listTicket(price, new BN(now() + 86_400))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(ticketId),
        listing,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const relisted = await program.account.listing.fetch(listing);
    assert.equal(relisted.asset.toBase58(), ticketPda(ticketId).toBase58());
  });
});

describe("rwa_exchange: collectible listings and escrow", () => {
  const seller = Keypair.generate();
  const other = Keypair.generate();
  const price = new BN(0.25 * LAMPORTS_PER_SOL);

  let umi: ReturnType<typeof createUmi>;
  let asset: PublicKey;

  before(async () => {
    await fund(seller.publicKey, 3);
    await fund(other.publicKey, 1);

    umi = createUmi(connection.rpcEndpoint).use(mplCore());
    const signer = createSignerFromKeypair(
      umi,
      umi.eddsa.createKeypairFromSecretKey(seller.secretKey)
    );
    umi.use(keypairIdentity(signer));

    const assetSigner = generateSigner(umi);
    await create(umi, {
      asset: assetSigner,
      name: "Test Collectible",
      uri: "https://example.com/metadata/test-collectible.json",
    }).sendAndConfirm(umi);

    asset = new PublicKey(assetSigner.publicKey);
  });

  it("rejects a listing from a non-owner", async () => {
    await expectFailure(
      program.methods
        .listCollectible(price, new BN(now() + 86_400))
        .accountsPartial({
          seller: other.publicKey,
          marketplace: marketplacePda,
          asset,
          collection: null,
          listing: listingPda(asset),
          mplCoreProgram: MPL_CORE_ID,
          logWrapper: null,
          systemProgram: SystemProgram.programId,
        })
        .signers([other])
        .rpc(),
      "NotAssetOwner"
    );
  });

  it("escrows the Core asset through CPI and creates a listing", async () => {
    await program.methods
      .listCollectible(price, new BN(now() + 86_400))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        asset,
        collection: null,
        listing: listingPda(asset),
        mplCoreProgram: MPL_CORE_ID,
        logWrapper: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const assetAccount = await fetchAsset(umi, asset.toBase58());
    assert.equal(assetAccount.owner, marketplacePda.toBase58());

    const listing = await program.account.listing.fetch(listingPda(asset));
    assert.equal(listing.asset.toBase58(), asset.toBase58());
    assert.deepEqual(listing.assetType, { collectible: {} });
    assert.equal(listing.seller.toBase58(), seller.publicKey.toBase58());
  });

  it("returns the Core asset to the seller on cancellation", async () => {
    await program.methods
      .cancelCollectibleListing()
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        asset,
        collection: null,
        listing: listingPda(asset),
        mplCoreProgram: MPL_CORE_ID,
        logWrapper: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const assetAccount = await fetchAsset(umi, asset.toBase58());
    assert.equal(assetAccount.owner, seller.publicKey.toBase58());
    assert.isNull(await connection.getAccountInfo(listingPda(asset)));
  });
});

describe("rwa_exchange: atomic ticket settlement", () => {
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const price = new BN(0.4 * LAMPORTS_PER_SOL);
  const feeBps = 250;
  const ticketId = 200;
  const listing = listingPda(ticketPda(ticketId));

  const balance = (pubkey: PublicKey) => connection.getBalance(pubkey, "confirmed");
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  before(async () => {
    await fund(seller.publicKey, 2);
    await fund(buyer.publicKey, 3);
    await issueTicket(ticketId, seller.publicKey, 0.5);
  });

  async function list() {
    await program.methods
      .listTicket(price, new BN(now() + 86_400))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(ticketId),
        listing,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();
  }

  async function buy(from: Keypair, treasuryKey: PublicKey = treasury.publicKey) {
    return program.methods
      .buyTicket()
      .accountsPartial({
        buyer: from.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(ticketId),
        seller: seller.publicKey,
        treasury: treasuryKey,
        listing,
        systemProgram: SystemProgram.programId,
      })
      .signers([from])
      .rpc();
  }

  it("rejects purchases while the marketplace is paused", async () => {
    await list();
    await program.methods
      .updateMarketplace(feeBps, treasury.publicKey, true)
      .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
      .rpc();

    try {
      await expectFailure(buy(buyer), "MarketplacePaused");
    } finally {
      await program.methods
        .updateMarketplace(feeBps, treasury.publicKey, false)
        .accountsPartial({ authority: authority.publicKey, marketplace: marketplacePda })
        .rpc();
    }
    // Listing survives a rejected purchase.
    const ticket = await program.account.ticket.fetch(ticketPda(ticketId));
    assert.equal(ticket.owner.toBase58(), marketplacePda.toBase58());
  });

  it("rejects a fee redirect through a forged treasury account", async () => {
    const attacker = Keypair.generate();
    await fund(attacker.publicKey, 1);
    await expectFailure(buy(buyer, attacker.publicKey), "ConstraintHasOne");
  });

  it("settles the sale atomically and splits the price", async () => {
    const fee = (price.toNumber() * feeBps) / 10_000;
    const listingRent = await balance(listing);
    const sellerBefore = await balance(seller.publicKey);
    const treasuryBefore = await balance(treasury.publicKey);
    const buyerBefore = await balance(buyer.publicKey);

    await buy(buyer);

    const ticket = await program.account.ticket.fetch(ticketPda(ticketId));
    assert.equal(ticket.owner.toBase58(), buyer.publicKey.toBase58());
    assert.equal(ticket.redeemed, false);
    assert.isNull(await connection.getAccountInfo(listing));

    assert.equal((await balance(treasury.publicKey)) - treasuryBefore, fee);
    assert.equal(
      (await balance(seller.publicKey)) - sellerBefore,
      price.toNumber() - fee + listingRent
    );
    assert.isAtLeast(buyerBefore - (await balance(buyer.publicKey)), price.toNumber());
  });

  it("does not allow a second buyer to take a sold listing", async () => {
    const secondBuyer = Keypair.generate();
    await fund(secondBuyer.publicKey, 2);
    await expectFailure(buy(secondBuyer), "AccountNotInitialized");
  });

  it("rejects self-purchase", async () => {
    const selfTicketId = 201;
    await issueTicket(selfTicketId, seller.publicKey, 0.5);
    const selfListing = listingPda(ticketPda(selfTicketId));

    await program.methods
      .listTicket(price, new BN(now() + 86_400))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(selfTicketId),
        listing: selfListing,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    await expectFailure(
      program.methods
        .buyTicket()
        .accountsPartial({
          buyer: seller.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(selfTicketId),
          seller: seller.publicKey,
          treasury: treasury.publicKey,
          listing: selfListing,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc(),
      "SelfPurchase"
    );

    await program.methods
      .cancelTicketListing()
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(selfTicketId),
        listing: selfListing,
      })
      .signers([seller])
      .rpc();
  });

  it("rejects an expired listing", async () => {
    const expiredTicketId = 202;
    await issueTicket(expiredTicketId, seller.publicKey, 0.5);
    const expiredListing = listingPda(ticketPda(expiredTicketId));

    const expiresAt = (await chainNow()) + 5;
    await program.methods
      .listTicket(price, new BN(expiresAt))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(expiredTicketId),
        listing: expiredListing,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    await sleep(6_000);

    await expectFailure(
      program.methods
        .buyTicket()
        .accountsPartial({
          buyer: buyer.publicKey,
          marketplace: marketplacePda,
          ticket: ticketPda(expiredTicketId),
          seller: seller.publicKey,
          treasury: treasury.publicKey,
          listing: expiredListing,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc(),
      "ListingExpired"
    );

    // The seller can still recover the asset after expiry.
    await program.methods
      .cancelTicketListing()
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        ticket: ticketPda(expiredTicketId),
        listing: expiredListing,
      })
      .signers([seller])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda(expiredTicketId));
    assert.equal(ticket.owner.toBase58(), seller.publicKey.toBase58());
  });
});

describe("rwa_exchange: atomic collectible settlement", () => {
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  const price = new BN(0.25 * LAMPORTS_PER_SOL);
  const feeBps = 250;

  let umi: ReturnType<typeof createUmi>;
  let asset: PublicKey;

  const balance = (pubkey: PublicKey) => connection.getBalance(pubkey, "confirmed");

  before(async () => {
    await fund(seller.publicKey, 3);
    await fund(buyer.publicKey, 3);

    umi = createUmi(connection.rpcEndpoint).use(mplCore());
    const signer = createSignerFromKeypair(
      umi,
      umi.eddsa.createKeypairFromSecretKey(seller.secretKey)
    );
    umi.use(keypairIdentity(signer));

    const assetSigner = generateSigner(umi);
    await create(umi, {
      asset: assetSigner,
      name: "Purchasable Collectible",
      uri: "https://example.com/metadata/purchasable.json",
    }).sendAndConfirm(umi);
    asset = new PublicKey(assetSigner.publicKey);

    await program.methods
      .listCollectible(price, new BN(now() + 86_400))
      .accountsPartial({
        seller: seller.publicKey,
        marketplace: marketplacePda,
        asset,
        collection: null,
        listing: listingPda(asset),
        mplCoreProgram: MPL_CORE_ID,
        logWrapper: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();
  });

  it("transfers the Core asset and splits the price atomically", async () => {
    const listing = listingPda(asset);
    const fee = (price.toNumber() * feeBps) / 10_000;
    const listingRent = await balance(listing);
    const sellerBefore = await balance(seller.publicKey);
    const treasuryBefore = await balance(treasury.publicKey);

    await program.methods
      .buyCollectible()
      .accountsPartial({
        buyer: buyer.publicKey,
        marketplace: marketplacePda,
        asset,
        collection: null,
        seller: seller.publicKey,
        treasury: treasury.publicKey,
        listing,
        mplCoreProgram: MPL_CORE_ID,
        logWrapper: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const assetAccount = await fetchAsset(umi, asset.toBase58());
    assert.equal(assetAccount.owner, buyer.publicKey.toBase58());
    assert.isNull(await connection.getAccountInfo(listing));

    assert.equal((await balance(treasury.publicKey)) - treasuryBefore, fee);
    assert.equal(
      (await balance(seller.publicKey)) - sellerBefore,
      price.toNumber() - fee + listingRent
    );
  });

  it("does not allow a second buyer to take a sold collectible", async () => {
    const secondBuyer = Keypair.generate();
    await fund(secondBuyer.publicKey, 2);

    await expectFailure(
      program.methods
        .buyCollectible()
        .accountsPartial({
          buyer: secondBuyer.publicKey,
          marketplace: marketplacePda,
          asset,
          collection: null,
          seller: seller.publicKey,
          treasury: treasury.publicKey,
          listing: listingPda(asset),
          mplCoreProgram: MPL_CORE_ID,
          logWrapper: null,
          systemProgram: SystemProgram.programId,
        })
        .signers([secondBuyer])
        .rpc(),
      "AccountNotInitialized"
    );
  });
});
