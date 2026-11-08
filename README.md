# AssetX - A secondary asset exchange application

A Solana Devnet secondary marketplace for **transferable event tickets** and **digital collectibles**.

Tickets live in custom Anchor accounts; collectibles are real Metaplex Core assets. One Anchor
marketplace program escrows both asset types, settles native SOL payments atomically, and closes
its listing account on every sale or cancellation.

> **Demo assets only.** Every ticket and collectible in this project is simulated. Demo tickets are
> not admission credentials, and demo issuers are not real event organizers.

## Repository layout

```
programs/rwa_exchange   Anchor program: config, issuers, tickets, listings, settlement
tests                   Integration tests against a local validator / Devnet
scripts                 Demo issuance (Anchor tickets, Metaplex Core collectibles)
assets/metadata         Off-chain JSON metadata for demo assets
app                     Expo (React Native + TypeScript) marketplace client
```

## Toolchain

| Tool | Version |
|---|---|
| Agave CLI | 4.1.2 |
| Anchor CLI / `anchor-lang` | 1.2.2 |
| `@anchor-lang/core` | 1.2.2 |
| `mpl-core` (Rust) | 0.12.1 |
| `@metaplex-foundation/mpl-core` | 1.10.0 |
| Expo SDK | 58 |
| Solana cluster | Devnet |

Program ID: `EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA`
Metaplex Core program (Devnet): `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`

## Setup

```sh
# Toolchain
sh -c "$(curl -sSfL https://release.anza.xyz/v4.1.2/install)"
cargo install --git https://github.com/otter-sec/anchor --tag v1.2.2 anchor-cli --locked
curl -sL https://run.surfpool.run/ | bash

# Dependencies
npm install
npm --prefix app install

# Devnet wallet
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 2
```

## Build, test, deploy

```sh
anchor build
anchor test            # Surfpool local validator
anchor deploy --provider.cluster devnet
```

Detailed deployment, issuance, demo, and testing instructions are added as the milestones land.
