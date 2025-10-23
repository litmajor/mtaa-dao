# Vault Automation Fix

## ✅ Issue Resolved

**Problem:** Vault automation was failing because it was trying to call `previewNAV()` on a non-existent contract address.

**Error:**
```
could not decode result data (value="0x", info={ "method": "previewNAV", "signature": "previewNAV()" }, code=BAD_DATA, version=6.15.0)
```

**Root Cause:** The `MAONO_CONTRACT_ADDRESS` in `.env` was set to a placeholder address (`0x1234567890123456789012345678901234567890`) that doesn't have a deployed contract.

## 🔧 Fixes Applied

### 1. Added Contract Configuration Check (`server/blockchain.ts`)

```typescript
// Helper to check if contract is deployed and valid
function isContractConfigured(): boolean {
  if (!Maono_CONTRACT_ADDRESS || 
      Maono_CONTRACT_ADDRESS === "" || 
      Maono_CONTRACT_ADDRESS === "0x1234567890123456789012345678901234567890") {
    return false;
  }
  return ethers.isAddress(Maono_CONTRACT_ADDRESS);
}
```

### 2. Updated MaonoVaultService

Added validation to prevent calling non-existent contracts:

```typescript
async getNAV() {
  if (!isContractConfigured()) {
    throw new Error("MaonoVault contract not configured. Please deploy the contract and set MAONO_CONTRACT_ADDRESS in .env");
  }
  
  // Verify contract exists on chain
  const code = await provider.getCode(Maono_CONTRACT_ADDRESS);
  if (code === "0x") {
    throw new Error(`No contract found at address ${Maono_CONTRACT_ADDRESS}. Please verify the contract is deployed.`);
  }
  
  return maonoVault.previewNAV();
}
```

### 3. Updated Vault Automation (`server/vaultAutomation.ts`)

- ✅ Skip NAV updates if contract not configured
- ✅ Graceful handling with warning messages
- ✅ Don't retry tasks when contract is missing

```typescript
// Only schedule NAV updates if contract is configured
if (MaonoVaultService.isConfigured()) {
  // Schedule NAV updates...
} else {
  this.logger.warn('⚠️  NAV update automation skipped: MaonoVault contract not configured');
}
```

## 🚀 Next Steps: Deploy MaonoVault Contract

To enable vault automation, you need to deploy the MaonoVault contract:

### Option 1: Deploy to Celo Alfajores Testnet (Recommended for Testing)

```bash
# 1. Set up deployment environment variables in .env
DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
DAO_TREASURY=your_dao_treasury_address
MANAGER=your_manager_address
CUSD_ADDRESS=0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1  # Celo Alfajores cUSD

# 2. Fund deployer wallet with testnet CELO
# Visit: https://faucet.celo.org

# 3. Deploy the contract
npx ts-node contracts/deploy_maono_vault.ts
```

### Option 2: Deploy Using Hardhat

```bash
# 1. Compile contracts
npx hardhat compile

# 2. Deploy to Alfajores testnet
npx hardhat run contracts/deploy_maono_vault.ts --network alfajores
```

### After Deployment

1. **Copy the deployed contract address** from the deployment output
2. **Update `.env`:**
   ```env
   MAONO_CONTRACT_ADDRESS=0xYourActualDeployedAddress
   ```
3. **Restart the server:**
   ```bash
   npm run dev
   ```

You should now see:
```
✅ Vault Automation Service started successfully
```

And NAV updates will work properly!

## 📝 Current Status

**Before Fix:**
```
❌ Task failed: nav_update
NAV update automation failed: Error: could not decode result data
```

**After Fix (No Contract):**
```
⚠️  NAV update automation skipped: MaonoVault contract not configured
   Deploy MaonoVault contract and set MAONO_CONTRACT_ADDRESS in .env to enable automation
✅ Vault Automation Service started successfully
```

**After Deployment:**
```
✅ Vault Automation Service started successfully
🔄 Processing automation task: nav_update
✅ NAV updated successfully
```

## 🔍 Verification

To verify the fix is working, restart your server and check the logs:

```bash
npm run dev
```

You should see:
- ✅ No more NAV update errors
- ✅ Warning message about contract not configured (until you deploy)
- ✅ Server starts successfully

## 📚 Related Files

- `server/blockchain.ts` - Contract configuration and validation
- `server/vaultAutomation.ts` - Automation task scheduling
- `contracts/deploy_maono_vault.ts` - Deployment script
- `contracts/MaonoVault.sol` - Smart contract source

## 🛠️ Troubleshooting

### Issue: "MaonoVault contract not configured"
**Solution:** Deploy the contract (see deployment steps above)

### Issue: "No contract found at address..."
**Solution:** Verify the deployment was successful and the address is correct

### Issue: Deployment fails
**Solution:** 
1. Check deployer wallet has testnet CELO
2. Verify network configuration
3. Check RPC_URL is correct

---

**Status:** ✅ Fixed - Vault automation now gracefully handles missing contracts

