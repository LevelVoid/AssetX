# AssetX - Quick Fixes for Current Issues

## Issue 1: "Found no wallet that supports wallet protocol"

### Root Cause:
The Mobile Wallet Adapter needs a Solana wallet app installed on your Android phone.

### Solution:

**On your Android phone (not computer):**

1. **Open Google Play Store**
2. **Search for "Phantom - Crypto Wallet"**
3. **Install the official Phantom app** (by Phantom Technologies)
   - Icon: Purple ghost logo
   - Link: https://play.google.com/store/apps/details?id=app.phantom

4. **Setup Phantom:**
   - Open Phantom app
   - Tap "Create a new wallet"
   - Write down your recovery phrase (12 words) - **CRITICAL: Save this!**
   - Set a password

5. **Switch to Devnet:**
   - In Phantom, tap the gear icon (⚙️) at bottom right
   - Tap "Developer Settings"
   - Tap "Change Network"
   - Select **"Devnet"** (NOT "Mainnet")

6. **Get free test SOL:**
   - Still in Phantom on Devnet
   - Tap "Receive" tab at bottom
   - Tap the "Request Airdrop" button
   - Wait 10 seconds - you should get 1 SOL

7. **Rebuild AssetX** (on computer):
   ```bash
   cd /Users/pradeepbiswas/Projects/AssetX/app
   # Kill the current running app
   adb shell am force-stop com.assetx.app
   # Rebuild and reinstall
   npx expo run:android
   ```

8. **Test connection:**
   - Open AssetX on your phone
   - Tap "Connect wallet" button
   - Phantom should open automatically
   - Tap "Connect" in Phantom
   - You'll be redirected back to AssetX - connected!

---

## Issue 2: "No live listings" in Marketplace

### Root Cause:
The demo assets exist on localhost (local validator) but AssetX connects to Devnet. No assets have been created on Devnet yet.

### Solution Options:

#### Option A: Use Local Validator (For Development)

1. **Start local validator** (Terminal 1):
   ```bash
   cd /Users/pradeepbiswas/Projects/AssetX
   surfpool
   ```

2. **Deploy to local** (Terminal 2):
   ```bash
   cd /Users/pradeepbiswas/Projects/AssetX
   anchor deploy
   ```

3. **Seed demo assets** (same terminal):
   ```bash
   npx ts-node scripts/issue-demo-assets.ts
   ```

4. **Point app to localhost** - Edit `/app/src/config.ts`:
   ```typescript
   export const RPC_URL = "http://10.0.2.2:8899"; // Android emulator
   // or
   export const RPC_URL = "http://YOUR_COMPUTER_IP:8899"; // Physical device
   ```

5. **Rebuild app**:
   ```bash
   cd app
   npx expo run:android
   ```

**Problem with this approach:** Your phone's Phantom wallet will still be on Devnet, not localhost.

---

#### Option B: Deploy to Devnet (Recommended)

**Need Devnet SOL first:**

1. **Get SOL from web faucet:**
   - Go to: https://faucet.solana.com
   - Paste: `54S81w7FbfuzNg5a1ufmn6XFY9UjsmtHrFEu4aoNDnq4`
   - Select "Devnet"
   - Request 2 SOL
   - Wait for confirmation

2. **Check balance:**
   ```bash
   solana balance
   ```
   Should show 2+ SOL

3. **Deploy program to Devnet:**
   ```bash
   cd /Users/pradeepbiswas/Projects/AssetX
   anchor build
   anchor deploy --provider.cluster devnet
   ```

4. **Issue demo assets:**
   ```bash
   npx ts-node scripts/issue-demo-assets.ts --url=https://api.devnet.solana.com
   ```

5. **App is already configured for Devnet** - just refresh:
   - Open AssetX
   - Pull down to refresh marketplace

---

#### Option C: Quick Test with Pre-deployed Devnet

If someone has already deployed to Devnet with demo assets:

1. Just use the existing program ID (already in config)
2. Connect wallet
3. Browse listings

**Current program ID:** `EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA`

---

## Verification Checklist

### For Wallet Connection:
- [ ] Phantom installed from Play Store (on phone)
- [ ] Phantom switched to Devnet (in app settings)
- [ ] Got test SOL in Phantom (via airdrop)
- [ ] AssetX rebuilt after installing Phantom
- [ ] Can see "Connect wallet" button in AssetX
- [ ] Tapping button opens Phantom
- [ ] Connection approved in Phantom
- [ ] See wallet address in AssetX after connecting

### For Marketplace Listings:
- [ ] Program deployed to Devnet (or using localhost)
- [ ] Demo assets issued (`npx ts-node scripts/issue-demo-assets.ts`)
- [ ] `.demo-state.json` shows correct cluster (devnet or localhost)
- [ ] App RPC_URL matches where assets are (`config.ts`)
- [ ] Pulled down to refresh marketplace screen
- [ ] Can see ticket and collectible listings

---

## Quick Debug Commands

```bash
# Check if Phantom is installed (can't always check via adb)
# Manually verify on your phone: App drawer → Phantom

# Check Solana CLI config
solana config get

# Check wallet balance
solana balance

# Check if program is deployed
solana program show EosvnRWaZrdLWoSRCwp18QFMCL99GJJFTE1cEqhFJbuA

# View demo state
cat .demo-state.json

# Check app RPC URL
grep RPC_URL app/src/config.ts

# Rebuild app completely
cd app
rm -rf android/build
npx expo run:android
```

---

## Common Issues

### "Attempt to debit an account" during deploy
**Solution:** Get SOL via https://faucet.solana.com first

### Wallet opens but doesn't connect
**Solution:** Make sure Phantom is on Devnet, not Mainnet

### No listings after deploying
**Solution:** Run `npx ts-node scripts/issue-demo-assets.ts` to create demo tickets/collectibles

### Can't connect - wallet not found
**Solution:** Rebuild app AFTER installing Phantom: `npx expo run:android`

### App connects but transactions fail
**Solution:** Make sure you have Devnet SOL in your Phantom wallet (Request Airdrop in Phantom)

---

## Priority Actions (Do These First)

1. **Install Phantom on phone** → Switch to Devnet → Get test SOL
2. **Get Devnet SOL for computer wallet** → Use https://faucet.solana.com
3. **Deploy to Devnet** → `anchor deploy --provider.cluster devnet`
4. **Issue demo assets** → `npx ts-node scripts/issue-demo-assets.ts --url=https://api.devnet.solana.com`
5. **Rebuild AssetX** → `cd app && npx expo run:android`
6. **Connect wallet in app** → Test buying/selling

---

## Current Status

- ✅ App compiled and runs
- ✅ Program built successfully
- ✅ Demo assets created (but on localhost, not Devnet)
- ❌ Phantom not installed (or not detected)
- ❌ No SOL in deployer wallet (can't deploy to Devnet)
- ❌ No listings on Devnet (assets only on localhost)

---

**Next immediate step:** Get 2+ SOL from https://faucet.solana.com into wallet `54S81w7FbfuzNg5a1ufmn6XFY9UjsmtHrFEu4aoNDnq4`, then deploy to Devnet.
