# AssetX

A Solana Devnet secondary marketplace for **transferable event tickets** and **digital collectibles**.

Tickets live in custom Anchor accounts; collectibles are real Metaplex Core assets. One Anchor
marketplace program escrows both asset types, settles native SOL payments atomically, and closes
its listing account on every sale or cancellation. The Expo client in `app/` reads those accounts
directly and signs purchases, listings, cancellations, and redemptions with the user's wallet.

> **Demo assets only.** Every ticket and collectible in this project is simulated. Demo tickets are
> not admission credentials, demo issuers are not real event organizers, and no asset represents a
> real-world claim. Never send mainnet SOL to these demo addresses.

## Repository layout

```
programs/rwa_exchange   Anchor program: config, issuers, tickets, listings, settlement
tests                   Integration tests against Surfpool / a local validator
scripts                 Demo issuance, listings, and metadata helpers
assets/metadata         Off-chain JSON metadata for demo assets
assets/images           Demo artwork referenced by the metadata
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
| React Native | 0.88.1 |
| Solana cluster | Devnet |

Program ID: `EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA`
Metaplex Core program (Devnet): `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`

The Devnet deployment currently has:

- marketplace config `Ds8U3wrTSb8sud1SsGsonQNrj8kCver4P3LUwetaVZh`
- three demo issuers and three demo tickets (cricket, football, music festival)
- three active ticket listings at `0.25 SOL` each

`.demo-state.json` records the addresses created by the issuance script.

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
anchor test                                   # Surfpool, all 33 integration tests
anchor program deploy --provider.cluster devnet
```

`anchor deploy` is deprecated in Anchor 1.2; use `anchor program deploy`.

## Seed demo assets

The issuance script is idempotent: it reuses issuer, ticket, collection, and collectible addresses
when they already exist on the target cluster.

```sh
# Devnet (default)
npm run seed

# Local Surfpool / validator
METADATA_BASE_URL=http://127.0.0.1:3000/metadata \
  ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 npm run seed
```

To create the on-chain listings used by the app:

```sh
npx ts-node scripts/create-demo-listings.ts
```

## Run the app

```sh
cd app
npx expo start --web          # browser build
npx expo run:android          # Android dev build + install
```

The RPC endpoint defaults to the public Devnet endpoint
`https://api.devnet.solana.com`. Override it at build/start time if the public endpoint is
rate-limiting you:

```sh
EXPO_PUBLIC_RPC_URL=https://your-devnet-rpc.example npx expo start
```

### Wallet architecture

- **Android** uses `@wallet-ui/react-native-web3js` and the Mobile Wallet Adapter. Install Phantom
  or Solflare on the device, switch it to Devnet, and fund it with a Devnet airdrop. The wallet app
  is only used for authorization and signatures; no private keys ever enter AssetX.
- **Web** uses `@solana/wallet-adapter-react` with the Phantom and Solflare browser adapters.
- Platform providers live in `app/src/wallet/AppWalletProvider.native.tsx` and
  `AppWalletProvider.web.tsx`; both feed the shared `useAppWallet` context.

### React Native Borsh fix

`app/src/polyfills.ts` restores Node's Buffer-returning `Buffer.prototype.subarray`. The
React Native `buffer` polyfill otherwise returns a plain `Uint8Array`, which makes Anchor's Borsh
decoder crash with `TypeError: undefined is not a function` when reading any program account.

### Metadata URLs

On-chain demo metadata URIs were written before the repository moved from the
`pradeepbiswas/AssetX` GitHub account to `LevelVoid/AssetX`. `app/src/lib/metadata.ts` rewrites
those legacy raw URLs at read time, so existing Devnet accounts keep working without re-issuing.

## Testing

```sh
pkill -f surfpool; sleep 1
anchor test --skip-build
```

The suite covers marketplace configuration, issuer registration, ticket issuance/redemption,
ticket and Core listing escrow, atomic native-SOL settlement, fee splitting, pause checks, resale
caps, transfer deadlines, and cancellation.
