# Monetization Implementation: Where to Start

**Status**: Pre-Implementation (Ready to Execute)  
**Date**: April 24, 2026  
**Owner**: Core Team  

---

## The Path Forward: 3 Phases

### PHASE 0: Foundation & Fixes (This Week - 5 days)
**Goal**: Fix critical issues before any code lands

- [ ] **Day 1: Audit & Document**
  - [ ] Read MtaaGovernance.sol → Document all DAO types (see DAO_TYPES_AUDIT.md below)
  - [ ] Identify which chain we're deploying to → Update all fee specs
  - [ ] Verify MTAA contract has `burn()` function
  - [ ] Identify M-Pesa on-ramp integration point

- [ ] **Day 2-3: Core Decision Making**
  - [ ] Decide: Vault cap per **user** or per **DAO**? 
    - Recommendation: Per user (more flexible for large DAOs)
  - [ ] Choose chain: Polygon / Base / Ethereum / Other?
    - Recommendation: **Polygon** (cheap gas, Kenya presence)
  - [ ] Agent pricing: Decide KES rates
    - Recommendation: Same structure as DAO tiers (free/pro/enterprise)
  - [ ] Hibernation recovery: Approve reactivation fee (1.5× one month) not full backpay?
    - Recommendation: **YES** (user retention killer otherwise)

- [ ] **Day 4-5: Update Specs**
  - [ ] Create corrected Phase 1 implementation guide (with all fixes)
  - [ ] Create DAO types audit + monetization mapping
  - [ ] Create Chama vault specification
  - [ ] Create referral contract specification

---

### PHASE 1: Core Vault Monetization (Weeks 2-3, ~10 days execution)
**Goal**: Ship Phase 1 with all 6 critical fixes applied

**The 6 Critical Fixes** (all in one implementation):

1. ✅ **Spawn cost collected in factory at deployment** (not on first deposit)
2. ✅ **Burn calls `burn()` function** (not transfer to dead address)
3. ✅ **Vault cap per user** (internally tracked per DAO member)
4. ✅ **Hibernation recovery = reactivation fee** (not full backpay debt)
5. ✅ **Dynamic pricing oracle specified** (Chainlink + floor/ceiling)
6. ✅ **Chain-specific gas accounting** (if Polygon: $0.01 per upkeep collection)

**Deliverables**:
- [ ] Updated MaonoVault.sol (with all fixes)
- [ ] Updated MaonoVaultFactory.sol (spawn cost moved)
- [ ] New FeatureGate.sol (light version for Phase 1)
- [ ] Test suite (spawn cost factory, upkeep, hibernation recovery)
- [ ] Deployment script (Polygon/Base specific)

---

### PHASE 2: DAO & Agent Monetization (Weeks 4-5)
**Goal**: Wire agents to KES pricing + DAO tiers to features

**Deliverables**:
- [ ] AgentPaymentGateway.sol (dual KES + MTAA pricing)
- [ ] Agent fee configuration (Scorekeeper, Treasurer, etc.)
- [ ] DAO subscription tracking (SaaS model)
- [ ] Agent execution flow (backend + frontend)

---

## Immediate Actions (Next 48 Hours)

### Action 1: DAO Type Audit
**Read**: `contracts/MtaaGovernance.sol` (or wherever DAOs are defined)

**Document**:
- How many DAO types exist?
- What are their differences?
- Which use vaults? Which use escrow?
- Which would spawn multiple vaults vs. single?

**Then map each DAO type to monetization**:

```
DAO Type | Typical Size | Typical Vaults | Spawn Cost | Upkeep | SaaS Fee
---------|--------------|----------------|------------|--------|----------
Community | 50-200 | 3-5 | 1,500-2,500 MTAA | 50-100 MTAA | 2,500 KES
Investment | 10-30 | 2-3 | 1,200-1,800 MTAA | 40-80 MTAA | 7,500 KES
Chama | 5-15 | 1-2 | 300-500 MTAA | 20-30 MTAA | 1,500 KES
Treasury | Varies | 1 | 800 MTAA | 50 MTAA | 5,000 KES
Event/Campaign | 20-100 | 0-1 | 200-500 MTAA | 0-20 MTAA | 1,000 KES
```

---

### Action 2: Chain Decision
**Question**: Which chain for launch?

**Constraints**:
- $0.10 per upkeep collection must be < $1 (comfortable)
- $5 per vault spawn must be < $10 (comfortable)
- Must support M-Pesa on-ramp (via Kotani/Valtech/similar)

**Gas Cost Comparison**:

| Chain | Avg Gas Price | Upkeep (20 MTAA transfer) | Spawn (factory deploy) | M-Pesa Support |
|-------|---------------|--------------------------|----------------------|----------------|
| **Polygon** | 50-100 Gwei | $0.05-0.10 | $0.50-1.50 | ✅ Kotani |
| **Base** | 100-200 Gwei | $0.10-0.20 | $1.00-3.00 | ✅ Bridge |
| **Ethereum** | 5000+ Gwei | $5-15 | $50-150 | ❌ Too expensive |
| **Celo** | 100-500 wei | $0.001-0.005 | $0.01-0.05 | ❌ No M-Pesa |

**Recommendation**: **Polygon mainnet** or **Polygon testnet (Mumbai)** initially
- Cheapest viable
- M-Pesa support via Kotani
- EA user base present
- Can bridge to Celo/Base later

---

### Action 3: MTAA Burn Function Verification

**Check**: Does MtaaToken.sol have `burn()` function?

```bash
grep -n "function burn" contracts/MtaaToken.sol
```

If **YES**: Use it directly
```solidity
IMTAAToken(mtaaToken).burn(burnAmount);
```

If **NO**: Add before Phase 1 ships
```solidity
function burn(uint256 amount) external {
    _burn(msg.sender, amount);
}
```

---

### Action 4: M-Pesa On-Ramp Flow Definition

**Question**: How do users get MTAA from KES?

**Current Options**:

1. **Kotani Pay** → KES → Polygon USDC → DEX → MTAA
2. **Yellow Pay** → KES → Stable → DEX → MTAA
3. **In-app fiat gateway** → Direct KES → MTAA conversion

**Recommended Fee Structure**:
- On-ramp 1% fee (100 KES → 99 KES worth of MTAA)
- Split: 50% burn, 50% treasury
- Show price before confirmation

**Example**:
```
User: "I want 10,000 KES of MTAA"
System: "10,000 KES - 100 KES fee = 9,900 KES → ~1,000 MTAA @ 10 KES/MTAA"
User approves
→ 500 MTAA burned (magic sink)
→ 500 MTAA to treasury
```

This creates a **native fiat-to-token sink** outside vaults — bonus revenue + deflationary pressure.

---

## DAO Types Audit Template

**Find this in contracts/MtaaGovernance.sol (or equivalent)**:

Create a document: `DAO_TYPES_AUDIT.md`

```markdown
# DAO Types Currently Implemented

## Type 1: [Name]
- **Members**: [typical range]
- **Features**: [list core features]
- **Current Fee**: [if charged]
- **Vault Usage**: [likely vaults]
- **Monetization Potential**: [estimate MTAA/month]
- **Revenue Fit**: [DAO SaaS, Vaults, Agents, or combo]

## Type 2: [Name]
...
```

---

## Critical Fixes: The 6 Changes (Code Blueprint)

### Fix #1: Spawn Cost in Factory ✅

**Before** (WRONG):
```solidity
// In MaonoVault.deposit()
if (balanceOf(receiver) == 0) {
    collectSpawnCost(); // Paid by first depositor? ❌
}
```

**After** (CORRECT):
```solidity
// In MaonoVaultFactory.deployVault()
vault = address(new MaonoVault(...));

// Collect spawn cost immediately
uint256 spawnCost = SPAWN_COSTS[vaultType];
require(
    IERC20(mtaaToken).transferFrom(msg.sender, address(this), spawnCost),
    "Spawn cost payment failed"
);
_splitAndDistribute(spawnCost, burnPercentage); // Handle burn/treasury

emit VaultCreated(vault, msg.sender, spawnCost);
```

---

### Fix #2: Burn Calls burn() ✅

**Before** (WRONG):
```solidity
IERC20(mtaaToken).transfer(address(0x000...dEaD), burnAmount);
```

**After** (CORRECT):
```solidity
// Assuming MtaaToken has burn() function
try IMTAAToken(mtaaToken).burn(burnAmount) {
    emit TokenBurned(burnAmount);
} catch {
    // Fallback to dead address if burn not available
    IERC20(mtaaToken).transfer(DEAD_ADDRESS, burnAmount);
}
```

---

### Fix #3: Vault Cap Per User ✅

**Before** (WRONG):
```solidity
mapping(bytes32 daoId => uint256 vaultCount) public vaultCountPerDAO;
uint256 public constant MAX_VAULTS_PER_DAO = 5; // Entire DAO = 5 vaults ❌
```

**After** (CORRECT):
```solidity
mapping(address user => uint256 vaultCount) public vaultCountPerUser;
uint256 public constant MAX_VAULTS_PER_USER = 5; // Each member = 5 vaults ✅

function canSpawnVault(address user) external view returns (bool) {
    return vaultCountPerUser[user] < MAX_VAULTS_PER_USER;
}
```

---

### Fix #4: Hibernation Recovery = Reactivation Fee ✅

**Before** (WRONG):
```solidity
// Calculate ALL back months
uint256 monthsHibernating = (block.timestamp - hibernationStarted[user]) / 30 days;
uint256 debtUpkeep = monthsHibernating * UPKEEP_COSTS[vaultType]; // ❌ Cliff
```

**After** (CORRECT):
```solidity
// Only charge 1.5× one month forward
uint256 reactivationFee = UPKEEP_COSTS[vaultType] * 150 / 100; // 1.5×
require(
    IERC20(mtaaToken).transferFrom(msg.sender, address(this), reactivationFee),
    "Reactivation fee insufficient"
);

// Reset history (vault features back to base tier, but funds preserved)
vaultStatus[user] = Status.ACTIVE;
lastUpkeepPayment[user] = block.timestamp;
vaultHistory[user].hibernationPeriods++;

emit VaultReactivated(user, reactivationFee);
```

---

### Fix #5: Dynamic Pricing Oracle ✅

**Configuration** (before Phase 1 ships):

```solidity
// Price Oracle Configuration
address public constant CHAINLINK_PRICE_FEED = 0x...; // MTAA/USD
uint256 public constant MIN_SPAWN_COST_MTAA = 100 ether; // Floor: always >= 100 MTAA
uint256 public constant MAX_SPAWN_COST_MTAA = 2000 ether; // Ceiling: never > 2000 MTAA
uint256 public constant TARGET_SPAWN_COST_USD = 500 usd_cents; // Always try for $5

function getSpawnCostInMTAA(uint256 vaultType) external view returns (uint256) {
    uint256 baseCost = SPAWN_COSTS[vaultType]; // 200-1200 MTAA at $1
    uint256 mtaaPrice = priceOracle.latestAnswer(); // From Chainlink
    
    // If MTAA = $2, cut spawn cost by 50%
    uint256 targetMTAA = (TARGET_SPAWN_COST_USD * 1e18) / mtaaPrice;
    
    // Bound between floor and ceiling
    uint256 finalCost = Math.max(MIN_SPAWN_COST_MTAA, Math.min(MAX_SPAWN_COST_MTAA, targetMTAA));
    
    return finalCost;
}

// Only owner can update oracle (multi-sig recommended)
function setPriceOracle(address newOracle) external onlyOwner {
    require(newOracle != address(0));
    priceOracle = newOracle;
    emit PriceOracleUpdated(newOracle);
}
```

---

### Fix #6: Chain-Specific Gas Accounting ✅

**For Polygon**:

```solidity
// Polygon gas assumptions (April 2026)
// ~50 Gwei base + 50 priority = 100 Gwei typical
// 20 MTAA transfer = ~21,000 gas = 0.0021 ETH = $0.042 at $20 ETH

uint256 public constant POLYGON_UPKEEP_GAS_BUFFER = 50000; // 50k extra for safety
uint256 public constant POLYGON_SPAWN_GAS_BUFFER = 200000; // 200k for factory + vault creation

// These are captured in the UPKEEP_COSTS and SPAWN_COSTS
// But we track them separately for transparency
```

Adjust upkeep costs accordingly:

```
If Polygon gas: 50 Gwei, 21k upkeep gas = $0.04
Then upkeep_mtaa_charge should >> $0.04 worth so users can afford it

At $0.05 MTAA = 1,000 MTAA = $50 spawn cost
At $1 MTAA = 50 MTAA = $50 spawn cost
→ Dynamic pricing bridges this
```

---

## Next 5 Days: Concrete Deliverables

### Day 1 (Today)
- [ ] Open MtaaGovernance.sol, list all DAO types
- [ ] Confirm which chain (recommend Polygon)
- [ ] Verify MTAA burn() function exists
- [ ] Create DAO_TYPES_AUDIT.md

### Day 2-3
- [ ] Update VAULT_MONETIZATION_PHASE1_IMPLEMENTATION.md with all 6 fixes
- [ ] Create DAO_MONETIZATION_MAPPING.md (tiers per DAO type)
- [ ] Create CHAMA_VAULT_SPECIFICATION.md
- [ ] Create REFERRAL_CONTRACT_SPECIFICATION.md

### Day 4
- [ ] Code review with team on all fixes
- [ ] Approve corrected implementation guide
- [ ] Assign Phase 1 contract work

### Day 5
- [ ] Start MaonoVault.sol modifications (spawn cost in factory)
- [ ] Start test suite
- [ ] Setup Polygon testnet (Mumbai)

---

## Success Criteria (Phase 0 → Phase 1 Handoff)

✅ **All 6 critical fixes documented in code**  
✅ **DAO types audited + monetization mapped**  
✅ **Chain confirmed (Polygon recommended)**  
✅ **Gas accounting verified**  
✅ **MTAA burn() function confirmed**  
✅ **Team consensus on recovery mechanics**  
✅ **Updated implementation guide ready**  
✅ **Test suite outline ready**  

---

## Files to Create This Week

1. **DAO_TYPES_AUDIT.md** — Current DAO types + monetization fit
2. **DAO_MONETIZATION_MAPPING.md** — SaaS fees per DAO type
3. **CHAMA_VAULT_SPECIFICATION.md** — Rotating savings vault spec
4. **REFERRAL_CONTRACT_SPECIFICATION.md** — DAO-to-DAO referral program
5. **PHASE1_CORRECTED_IMPLEMENTATION.md** — All 6 fixes applied

---

## Then: Weeks 2-3 (Phase 1 Execution)

Once Phase 0 is approved:

1. **Modify MaonoVault.sol** (6 fixes, ~150 lines changes)
2. **Modify MaonoVaultFactory.sol** (2-3 fixes, ~50 lines changes)
3. **Create FeatureGate.sol** (light version, ~100 lines)
4. **Write test suite** (~500 lines tests)
5. **Deploy to Polygon Mumbai** (testnet)
6. **Integration test with DAO creation flow**

**Ship date**: End of Week 3 → Ready for agent integration

---

**Status**: Ready to start  
**Bottleneck**: DAO type audit (let's start there)
**Next call**: Review DAO_TYPES_AUDIT.md results

