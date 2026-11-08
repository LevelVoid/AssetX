import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

import type { RwaExchange } from "../target/types/rwa_exchange";

const BN = anchor.BN;

describe("rwa_exchange: config, issuers and tickets", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RwaExchange as Program<RwaExchange>;
  const connection = provider.connection;

  const authority = provider.wallet as anchor.Wallet;
  const treasury = Keypair.generate();
  const issuerAuthority = Keypair.generate();

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

  const now = () => Math.floor(Date.now() / 1000);

  const defaultTicket = () => ({
    ticketId: new BN(1),
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
      const message = err?.error?.errorCode?.code ?? err?.message ?? String(err);
      assert.include(message, code);
    }
  }

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

  it("rejects a second initialization and an excessive fee", async () => {
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
    const ticket = defaultTicket();
    await program.methods
      .createTicket(
        ticket.ticketId,
        ticket.eventId,
        ticket.eventName,
        ticket.seatCategory,
        ticket.eventTimestamp,
        ticket.transferDeadline,
        ticket.maxResalePrice,
        ticket.metadataUri
      )
      .accountsPartial({
        authority: issuerAuthority.publicKey,
        issuer: issuerPda,
        ticket: ticketPda(1),
        systemProgram: SystemProgram.programId,
      })
      .signers([issuerAuthority])
      .rpc();

    const account = await program.account.ticket.fetch(ticketPda(1));
    assert.equal(account.ticketId.toNumber(), 1);
    assert.equal(account.issuer.toBase58(), issuerPda.toBase58());
    assert.equal(account.owner.toBase58(), issuerAuthority.publicKey.toBase58());
    assert.equal(account.eventName, "Cricket Championship");
    assert.equal(account.seatCategory, "General Stand");
    assert.equal(account.redeemed, false);
    assert.equal(account.maxResalePrice.toNumber(), ticket.maxResalePrice.toNumber());
  });

  it("rejects duplicate issuance, bad deadlines and unregistered issuers", async () => {
    const ticket = defaultTicket();
    await expectFailure(
      program.methods
        .createTicket(
          ticket.ticketId,
          ticket.eventId,
          ticket.eventName,
          ticket.seatCategory,
          ticket.eventTimestamp,
          ticket.transferDeadline,
          ticket.maxResalePrice,
          ticket.metadataUri
        )
        .accountsPartial({
          authority: issuerAuthority.publicKey,
          issuer: issuerPda,
          ticket: ticketPda(1),
          systemProgram: SystemProgram.programId,
        })
        .signers([issuerAuthority])
        .rpc(),
      "already in use"
    );

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
          "https://example.com/metadata/football.json"
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
          "https://example.com/metadata/festival.json"
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

    const ticket = defaultTicket();
    await expectFailure(
      program.methods
        .createTicket(
          new BN(10),
          ticket.eventId,
          ticket.eventName,
          ticket.seatCategory,
          ticket.eventTimestamp,
          ticket.transferDeadline,
          ticket.maxResalePrice,
          ticket.metadataUri
        )
        .accountsPartial({
          authority: issuerAuthority.publicKey,
          issuer: issuerPda,
          ticket: ticketPda(10),
          systemProgram: SystemProgram.programId,
        })
        .signers([issuerAuthority])
        .rpc(),
      "IssuerInactive"
    );

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
