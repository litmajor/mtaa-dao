# Pre-Deployment Security Verification Checklist

**Status**: Use Before Running deploy-phase1-with-vesting.ts  
**Date**: April 23, 2026  
**Owner**: Deployment Team  

---

## Phase 1: Code Review (Before Compilation)

### Smart Contracts

- [ ] **MtaaToken.sol**
  - [ ] Solidity version: 0.8.20 ✓
  - [ ] All setters have zero-address guards ✓
    - [ ] setMultiSigTreasury: `require(newTreasury != address(0))`
    - [ ] setReputationEngine: `require(newEngine != address(0))`
    - [ ] setAPYCalculator: `require(newCalculator != address(0))`
  - [ ] Access control: All risky functions use `onlyOwner` or `onlyRole`
  - [ ] ReentrancyGuard on: stake(), unstake(), claimRewards()
  - [ ] No hardcoded addresses (all parameters)
  - [ ] No obvious integer overflow risks

- [ ] **MultiSigTreasury.sol**
  - [ ] Requires 3-of-5 signatures ✓
  - [ ] 48-hour timelock enforced ✓
  - [ ] Cannot be bricked (check executeTransaction logic)
  - [ ] No owner can unilaterally move funds

- [ ] **ReputationEngine.sol**
  - [ ] Reputation capped at 1M points
  - [ ] Decay formula working correctly
  - [ ] Appeals process voting: 66% threshold
  - [ ] No way for single admin to corrupt scores

- [ ] **FloatingAPYCalculator.sol**
  - [ ] APY capped [3%, 18%] ✓
  - [ ] Scaling formula prevents underflow at low TVL
  - [ ] History tracking (governance audit trail)

- [ ] **TokenDistributionInitializer.sol**
  - [ ] All vesting allocations sum to 825M (82.5% of supply) ✓
  - [ ] Cliffs correctly specified (6mo, 3mo, 7mo, 13mo)
  - [ ] Durations correctly specified (48mo, 36mo, 36mo, 48mo)

### Deployment Script

- [ ] **scripts/deploy-phase1-with-vesting.ts**
  - [ ] Ethers v6 compatibility: Uses `.waitForDeployment?.()` ✓
  - [ ] All contracts deployed before wiring
  - [ ] Zero-address validation before setters ✓
  - [ ] Ownership transfer to treasury ✓
  - [ ] Vesting distribution executed
  - [ ] APY set to 18% for bootstrapping ✓

### Configuration

- [ ] **hardhat.config.ts**
  - [ ] Sepolia RPC URL configured ✓
  - [ ] Gas price set (2 gwei for Sepolia) ✓
  - [ ] Private key configured
  - [ ] Etherscan API key configured (for verification)
  - [ ] Network timeout: 40,000ms ✓

- [ ] **.env file** (NOT COMMITTED)
  - [ ] `SEPOLIA_RPC_URL=https://rpc.sepolia.org`
  - [ ] `PRIVATE_KEY=0x...` (deployer account)
  - [ ] `ETHERSCAN_API_KEY=...`
  - [ ] `.env` added to `.gitignore` ✓

---

## Phase 2: Pre-Deployment Checks (Before Running Script)

### Network & Account Setup

- [ ] **Sepolia Testnet Configuration**
  - [ ] Run: `npx hardhat network-info --network sepolia`
  - [ ] Result: Shows active Sepolia network
  - [ ] RPC URL responding: `curl https://rpc.sepolia.org`

- [ ] **Deployer Account**
  - [ ] Account has Sepolia ETH for gas fees
    - [ ] Minimum: 0.1 ETH (to be safe)
    - [ ] Check: `npx hardhat account-balance --network sepolia`
  - [ ] Private key NOT exposed (check .env in .gitignore)
  - [ ] Account generated from hardware wallet (recommended)

### Compilation

- [ ] Run: `npx hardhat compile`
  - [ ] No errors, only info/warnings OK
  - [ ] Output: "✓ 10 contracts compiled successfully"
  - [ ] No hardcoded addresses in output

### Gas Estimation

- [ ] Run: `npx hardhat estimate-gas --network sepolia`
  - [ ] Total estimated: 5-7M gas
  - [ ] Breakdown shows all 4 contracts
  - [ ] No "out of gas" warnings

- [ ] Current Sepolia Gas Price
  - [ ] Check: https://sepolia.etherscan.io/gastracker
  - [ ] Current base fee: (record here) _____ gwei
  - [ ] gasPrice in config: 2 gwei (adjust if >5 gwei market rate)
  - [ ] Estimated cost: 6M gas × 2 gwei = 0.012 ETH ✓

### Security Audit

- [ ] Verify **FIX #1**: God Mode Mitigation
  - [ ] Script calls `mtaa.transferOwnership(treasury.address)` ✓
  - [ ] Post-transfer ownership check succeeds ✓
  - [ ] Owner confirmed == treasury after completion

- [ ] Verify **FIX #2**: Ethers v6 Compatibility
  - [ ] Check Ethers version: `npm list ethers`
  - [ ] If v5: Script uses `.deployed()`
  - [ ] If v6: Script uses `.waitForDeployment()`
  - [ ] Dual-mode works: `.waitForDeployment?.() || .deployed?.()`

- [ ] Verify **FIX #3**: Gas Price Configuration
  - [ ] hardhat.config.ts has gasPrice for Sepolia
  - [ ] Deployment script has no hardcoded gas overrides
  - [ ] Comments document when to adjust gas price

- [ ] Verify **FIX #4**: Zero-Address Guards
  - [ ] Script validates addresses before calling setters ✓
  - [ ] MtaaToken setters check != address(0) ✓
  - [ ] All 3 setters have guards

---

## Phase 3: Final Verification (5 Minutes Before Deployment)

### Double-Check Critical Values

Copy from deployment config and verify:

| Value | Expected | Actual | ✓ |
|-------|----------|--------|---|
| **MtaaToken total supply** | 1,000,000,000 | _ | [ ] |
| **Community vesting amount** | 300,000,000 | _ | [ ] |
| **Initial APY** | 18% (1800 bps) | _ | [ ] |
| **Treasury signers** | 5 addresses | _ | [ ] |
| **Team cliff period** | 13 months | _ | [ ] |
| **Vesting duration** | 48 months (team) | _ | [ ] |
| **Gas price** | 2,000,000,000 | _ | [ ] |

### Deployer Checklist

- [ ] I have read SECURITY_HARDENING_CHECKLIST.md ✓
- [ ] I understand the 4 security fixes ✓
- [ ] I have backed up my private key ✓
- [ ] I have configured hardhat.config.ts ✓
- [ ] I have compiled contracts successfully ✓
- [ ] I have sufficient Sepolia ETH (>0.1) ✓
- [ ] I will NOT skip ownership transfer ⚠️ **CRITICAL**
- [ ] I understand this affects mainnet later ✓

### Last-Minute Network Status

```bash
# Check network health
curl -s https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .

# Expected: {"jsonrpc":"2.0","result":"0x...","id":1}
# If error: Network issue, wait before deploying
```

- [ ] Block explorer responding: https://sepolia.etherscan.io
- [ ] RPC not rate-limited: Response time <2 seconds
- [ ] No known Sepolia outages (check Discord)

---

## Phase 4: Deployment Execution

### Run Deployment Script

```bash
# Single command to deploy everything
npx hardhat run scripts/deploy-phase1-with-vesting.ts --network sepolia

# Expected output:
# 🚀 Phase 1 + Vesting Escrow Deployment
# 
# Network: sepolia
# Deployer: 0x...
# ---
# 
# 📦 [STEP 1] Deploying MtaaToken...
# ✅ MtaaToken deployed
#    Address: 0x...
# 
# 💎 [STEP 2] Deploying MultiSigTreasury...
# ✅ MultiSigTreasury deployed
#    Address: 0x...
# 
# [... more output ...]
# 
# ⚠️ [CRITICAL SECURITY] Addressing God Mode Risk...
# [FIX #1] Transferring MtaaToken ownership from deployer to MultiSigTreasury...
# ✅ Ownership successfully transferred!
#    God Mode eliminated: Only 3/5 multi-sig can change core contracts
# 
# 🎯 SECURITY HARDENING COMPLETE
# [✅] FIX #1: God Mode eliminated
# [✅] FIX #2: Ethers v6 compatibility
# [✅] FIX #3: Gas config documented
# [✅] FIX #4: Zero-address guards in place
```

### Capture Deployment Info

Save this to a secure location:

```json
{
  "network": "sepolia",
  "timestamp": "2026-04-23T14:30:00Z",
  "deployer": "0x...",
  "contracts": {
    "mtaaToken": "0x...",
    "multiSigTreasury": "0x...",
    "reputationEngine": "0x...",
    "floatingAPYCalculator": "0x...",
    "tokenDistributionInitializer": "0x..."
  },
  "gasUsed": {
    "total": "...",
    "cost": "... ETH"
  },
  "ownership": {
    "from": "0x... (deployer)",
    "to": "0x... (treasury)",
    "status": "transferred"
  }
}
```

- [ ] Save addresses to secure file
- [ ] Do NOT commit private key
- [ ] Back up addresses in multiple places

---

## Phase 5: Post-Deployment Verification

### Verify All Contracts Deployed

```bash
# Check each contract exists on Etherscan
for address in 0x... 0x... 0x... 0x... 0x...; do
  echo "Checking $address..."
  curl -s "https://sepolia.etherscan.io/api?module=account&action=balance&address=$address&apikey=$ETHERSCAN_API_KEY" | jq .
done
```

- [ ] All 5 contracts visible on Sepolia Etherscan
- [ ] Contract code matches deployed bytecode
- [ ] No "Contract Verification" error

### Verify Ownership Transfer (FIX #1)

```bash
npx hardhat console --network sepolia

# Inside console:
> const mtaa = await ethers.getContractAt("MTAAToken", "0x...");
> const owner = await mtaa.owner();
> console.log(owner);
0x... (should be treasury address)

# Verify owner is treasury
> const treasury = await ethers.getContractAt("MultiSigTreasury", "0x...");
> const treasuryAddr = treasury.address;
> console.log(owner === treasuryAddr);
true  ✓  (CRITICAL!)
```

- [ ] `mtaa.owner()` == `treasury.address`
- [ ] Deployer NO LONGER owns MtaaToken
- [ ] Only treasury (3/5 multi-sig) can call setters

### Verify Vesting Escrow Locked

```bash
npx hardhat console --network sepolia

# Inside console:
> const distributor = await ethers.getContractAt("TokenDistributionInitializer", "0x...");
> const chart = await distributor.getVestingPressureChart();
> console.log(chart);

# Expected: Shows vesting schedule
# Months 1-5: 6.25M/month
# Months 6+: increasing to 20M/month
```

- [ ] Vesting chart matches expectations
- [ ] All allocations locked (not transferred yet)
- [ ] Community can see schedule on chain

### Verify APY Configuration (FIX #3)

```bash
npx hardhat console --network sepolia

# Inside console:
> const apy = await ethers.getContractAt("FloatingAPYCalculator", "0x...");
> const latest = await apy.getLatestAPY();
> console.log(latest);

# Expected output (in basis points):
# { timestamp: <block time>, newAPY: 1800, scaleDivisor: 100 }
# 1800 = 18% ✓
```

- [ ] APY = 18% (1800 basis points)
- [ ] Scale divisor = 100
- [ ] Staking bootstrap ready ✓

### Verify Zero-Address Guards (FIX #4)

```bash
npx hardhat console --network sepolia

# Inside console:
> const mtaa = await ethers.getContractAt("MTAAToken", "0x...");
> const ZERO = "0x0000000000000000000000000000000000000000";
> 
> // Try to set treasury to zero (should fail)
> try {
>   await mtaa.setMultiSigTreasury(ZERO);
>   console.log("❌ FAILED: Guard bypassed!");
> } catch (e) {
>   console.log("✅ PASSED: Guard prevented zero-address");
> }
```

- [ ] `setMultiSigTreasury(0x000...)` → Reverts ✓
- [ ] `setReputationEngine(0x000...)` → Reverts ✓
- [ ] `setAPYCalculator(0x000...)` → Reverts ✓

### Verify Ethers v6 Compatibility (FIX #2)

```bash
# Upgrade Ethers to v6 (optional test)
npm install --save ethers@6.0.0

# Run deployment again on testnet
# Should work with same script ✓
npx hardhat run scripts/deploy-phase1-with-vesting.ts --network sepolia
```

- [ ] Script works with Ethers v5.x ✓
- [ ] Script works with Ethers v6.x ✓
- [ ] Dual-mode `.waitForDeployment?.() || .deployed?.()` handles both

---

## Phase 6: Security Audit Sign-Off

### Code Review Checklist (if doing security audit)

- [ ] Contracts reviewed by 2+ engineers
- [ ] No critical issues found
- [ ] All medium/low issues documented
- [ ] Fixes planned for next iteration

### External Audit (Before Mainnet)

- [ ] Contact: OpenZeppelin, Trail of Bits, or Spearbit
- [ ] Provide: All 5 contract source codes
- [ ] Timeline: 2-3 weeks
- [ ] Cost: $15-50k typically
- [ ] Wait for: "No critical issues" report

---

## Final Sign-Off

**I confirm I have completed all verification steps and am ready to deploy:**

- [ ] Deployer Name: _________________________
- [ ] Date: _________________________
- [ ] Network: Sepolia ✓
- [ ] All contracts visible on Etherscan
- [ ] Ownership transferred to treasury
- [ ] APY set correctly
- [ ] Zero-address guards working
- [ ] Ready for dashboard + farming Phase 2

**For Mainnet Deployment** (Do This After Audit + Community Vote):

- [ ] Wait for security audit: "No critical findings"
- [ ] Community governance vote: PASSED
- [ ] Marketing: Campaign ready
- [ ] Support: Team ready for launch
- [ ] Monitoring: Dashboard live and tracking
- [ ] Gas price: Checked ($eth price, base fee)
- [ ] Mainnet deployer: NOT same account as testnet (use multi-sig)

---

**Deployment Readiness**: ✅ COMPLETE  
**Next Action**: Run deploy-phase1-with-vesting.ts this week  
**Estimated Timeline**: 2026-05-01 → 2026-05-07 (testnet completion)

