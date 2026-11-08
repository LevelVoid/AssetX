# Wallet Setup Guide for AssetX

## The Issue

When you try to connect a wallet in AssetX on Android and see:
```
Found no installed wallet that supports mobile wallet protocol
```

This means you need to install a compatible Solana wallet app on your Android device.

---

## Solution: Install a Compatible Wallet

AssetX uses the **Mobile Wallet Adapter (MWA)** protocol on Android, which requires a wallet app that supports this protocol.

### Recommended Wallets:

#### 1. **Phantom Wallet** (Recommended)
- **Download**: [Google Play Store - Phantom](https://play.google.com/store/apps/details?id=app.phantom)
- ✅ Full MWA support
- ✅ Best integration
- ✅ Most popular

#### 2. **Solflare Wallet**
- **Download**: [Google Play Store - Solflare](https://play.google.com/store/apps/details?id=com.solflare.mobile)
- ✅ MWA support
- ✅ Good alternative

---

## Setup Steps

### 1. Install Phantom or Solflare from Google Play

Open Google Play Store and search for "Phantom" or "Solflare", or use the links above.

### 2. Create or Import a Wallet

When you first open the wallet app:
- **New User**: Tap "Create a new wallet"
- **Existing User**: Tap "Import wallet" and enter your recovery phrase

⚠️ **IMPORTANT**: Save your recovery phrase securely! Never share it with anyone.

### 3. Switch to Devnet (REQUIRED)

AssetX runs on Solana **Devnet** (test network), so you need to switch your wallet:

**For Phantom:**
1. Open Phantom app
2. Tap the gear icon (Settings) in the bottom right
3. Tap "Developer Settings"
4. Tap "Change Network"
5. Select **"Devnet"**

**For Solflare:**
1. Open Solflare app
2. Tap the hamburger menu (three lines)
3. Tap "Settings"
4. Tap "Network"
5. Select **"Devnet"**

### 4. Get Devnet SOL (Free Test Tokens)

You need Devnet SOL to interact with AssetX:

**Option A: Phantom In-App Airdrop**
1. Open Phantom on Devnet
2. Tap "Receive"
3. Tap "Request Airdrop" button
4. Confirm the airdrop

**Option B: Solana Faucet Website**
1. Copy your wallet address from the wallet app
2. Go to: https://faucet.solana.com
3. Paste your address
4. Select "Devnet"
5. Click "Request Airdrop"

You should receive 1-2 SOL on Devnet (it's free test money, not real).

### 5. Connect to AssetX

1. Open the AssetX app
2. Tap "Connect Wallet" button
3. The app will open your wallet (Phantom or Solflare)
4. Approve the connection
5. You'll be redirected back to AssetX, now connected!

---

## Troubleshooting

### Still Getting "No Wallet Found" Error?

1. **Verify wallet is installed**: Check your app drawer for Phantom or Solflare
2. **Restart AssetX**: Close and reopen the app
3. **Rebuild the app**: The app needs to detect MWA-compatible wallets
   ```bash
   cd app
   npx expo run:android
   ```

### Wallet Opens But Doesn't Connect?

1. **Check network**: Make sure wallet is on **Devnet**, not Mainnet
2. **Check permissions**: AssetX needs permission to open other apps
3. **Try different wallet**: If Phantom doesn't work, try Solflare

### Transaction Fails?

1. **Get more Devnet SOL**: Transactions require SOL for fees
2. **Check balance**: Tap your wallet icon in AssetX to see balance
3. **Wait and retry**: Devnet can be slower than Mainnet

---

## Why Mobile Wallet Adapter?

The Mobile Wallet Adapter (MWA) is the official Solana Mobile standard that:

✅ **Keeps your keys safe** - Your private keys never leave the wallet app
✅ **Better UX** - Native mobile app integration
✅ **More secure** - No browser extensions or web-based wallets
✅ **Standard protocol** - Works across all MWA-compatible dApps

When you connect, AssetX opens your wallet app for authorization, and your wallet signs transactions securely.

---

## Web Version (Alternative)

If you're using AssetX on web (browser):
- The app will use **browser wallet extensions** instead of MWA
- Install Phantom or Solflare browser extension
- Connect through the browser extension popup
- Still need to switch to Devnet in extension settings

---

## Network Information

**AssetX runs on Solana Devnet:**
- Cluster: `devnet`
- RPC: `https://api.devnet.solana.com`
- Program ID: `EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA`

All tokens and assets are **test assets only** - they have no real-world value.

---

## Quick Reference

| Action | Where |
|--------|-------|
| Install wallet | Google Play Store → "Phantom" |
| Switch to Devnet | Wallet app → Settings → Network → Devnet |
| Get test SOL | Phantom: Request Airdrop<br>Web: https://faucet.solana.com |
| Connect | AssetX → Connect Wallet button |
| View balance | AssetX → Settings screen |

---

## Support

If you continue having issues:
1. Verify Phantom/Solflare is installed and updated
2. Confirm you're on Devnet in the wallet app
3. Rebuild AssetX: `npx expo run:android`
4. Check the app logs for specific errors

---

**Remember**: All activity happens on **Devnet** (test network). Never send real mainnet SOL to these addresses!
