# Environment Setup Guide

## ✅ Fix for ENS Error

The error you encountered:
```
Error: an ENS name used for a contract target must be correctly configured
(value="", code=UNCONFIGURED_NAME)
```

**Was caused by:** An empty `MAONO_CONTRACT_ADDRESS` environment variable being passed to `ethers.Contract()`.

**Fixed by:** 
- Added lazy initialization with validation in `server/blockchain.ts`
- Contract is only created when actually needed, with proper error messages

---

## 🔧 Required Environment Variables

Create a `.env` file in your project root with these variables:

```env
# ====================================
# MTAA DAO Environment Variables
# ====================================

# --- Blockchain Configuration ---
RPC_URL=https://alfajores-forno.celo-testnet.org
CHAIN_ID=44787

# --- Wallet Configuration ---
# Your wallet private key (WITH 0x prefix, 66 characters total)
WALLET_PRIVATE_KEY=0x...

# Manager wallet private key (for vault management)
MANAGER_PRIVATE_KEY=0x...

# Deployer private key (for contract deployments)
DEPLOYER_PRIVATE_KEY=0x...

# --- Contract Addresses ---
# ⚠️ IMPORTANT: Deploy MaonoVault first, then set this address
MAONO_CONTRACT_ADDRESS=

# DAO Treasury address
DAO_TREASURY=0x...

# Manager address
MANAGER=0x...

# Token addresses (Celo Alfajores Testnet)
CUSD_ADDRESS=0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
CEUR_ADDRESS=0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9
CREAL_ADDRESS=0xE4D517785D091D3c54818832dB6094bcc2744545

# --- Application ---
NODE_ENV=development
DATABASE_URL=your_database_url
SESSION_SECRET=your_session_secret
```

---

## 📝 Setup Steps

### 1️⃣ Create Your `.env` File

```bash
# Copy this template to .env
cp ENV_SETUP_GUIDE.md .env
# Then edit .env with your actual values
```

### 2️⃣ Generate a Test Wallet (if needed)

```bash
# Option A: Use the generate_wallet script
node scripts/generate_wallet.js

# Option B: Use the agent_wallet demo
npx tsx server/agent_wallet.ts
```

This will output something like:
```
Wallet Address: 0xABC123...
Private Key: 0x1234567890abcdef...
```

Copy the **private key** to your `.env` as `WALLET_PRIVATE_KEY`.

### 3️⃣ Fund Your Wallet with Testnet CELO

Go to the Celo Alfajores Faucet:
👉 https://faucet.celo.org

Paste your wallet address and claim testnet tokens.

### 4️⃣ Deploy the MaonoVault Contract (Optional)

If you need the vault functionality:

```bash
# Set these in .env first:
# - DEPLOYER_PRIVATE_KEY
# - DAO_TREASURY (your DAO's address)
# - MANAGER (vault manager address)
# - CUSD_ADDRESS (already set for Alfajores)

# Deploy the contract
npx ts-node contracts/deploy_maono_vault.ts
```

Output will be:
```
Deploying MaonoVault...
MaonoVault deployed at: 0xDEF456...
```

Copy the deployed address to `.env` as `MAONO_CONTRACT_ADDRESS`.

### 5️⃣ Test Your Setup

```bash
# Run the wallet demo
npx tsx server/agent_wallet.ts

# You should see:
# ✓ Network connection tested
# ✓ Balance operations demonstrated
# ✓ Portfolio management shown
```

---

## 🔍 What Was Fixed

### Before (Caused ENS Error):
```typescript
// ❌ Contract created immediately with empty address
const Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || "";
const maonoVault = new ethers.Contract(
  Maono_CONTRACT_ADDRESS,  // Empty string = ENS error!
  MaonoVaultArtifact.abi,
  signer || provider
);
```

### After (Fixed):
```typescript
// ✅ Lazy initialization with validation
function getMaonoVaultContract(): ethers.Contract {
  if (!Maono_CONTRACT_ADDRESS || Maono_CONTRACT_ADDRESS === "") {
    throw new Error(
      "MAONO_CONTRACT_ADDRESS is not configured. " +
      "Please set it in your .env file or deploy the MaonoVault contract first."
    );
  }

  if (!ethers.isAddress(Maono_CONTRACT_ADDRESS)) {
    throw new Error(`Invalid MAONO_CONTRACT_ADDRESS: "${Maono_CONTRACT_ADDRESS}"`);
  }

  return new ethers.Contract(
    Maono_CONTRACT_ADDRESS,
    MaonoVaultArtifact.abi,
    signer || provider
  );
}
```

---

## 🚀 You Can Now:

1. **Use the wallet without the vault contract** - The error won't occur unless you actually try to use `MaonoVaultService`

2. **Get clear error messages** - If `MAONO_CONTRACT_ADDRESS` is missing or invalid, you'll get a helpful error instead of a cryptic ENS error

3. **Deploy the contract later** - You can work with wallets and tokens first, then deploy the vault when ready

---

## 📚 Related Files

- `server/blockchain.ts` - Fixed contract initialization
- `server/agent_wallet.ts` - Wallet demo script
- `contracts/deploy_maono_vault.ts` - Contract deployment script
- `server/services/tokenService.ts` - Multi-token support

---

## ❓ Troubleshooting

### "Invalid private key format"
- Ensure your private key starts with `0x`
- Total length should be 66 characters (0x + 64 hex chars)
- No spaces or newlines

### "Insufficient balance"
- Fund your wallet from: https://faucet.celo.org
- Wait ~30 seconds for testnet funds to arrive

### "MAONO_CONTRACT_ADDRESS is not configured"
- Either deploy the contract and set the address
- Or don't use `MaonoVaultService` functions yet

---

## ✅ Verification Checklist

- [ ] Created `.env` file with all required variables
- [ ] `WALLET_PRIVATE_KEY` is set and has 0x prefix
- [ ] Wallet is funded with testnet CELO
- [ ] Can run `npx tsx server/agent_wallet.ts` without errors
- [ ] (Optional) Deployed MaonoVault and set `MAONO_CONTRACT_ADDRESS`

