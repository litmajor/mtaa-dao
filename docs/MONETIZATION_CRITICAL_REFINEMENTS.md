# Monetization Model: Critical Refinements & DAO Type Audit

**Status**: Pre-Phase 1 Corrections Required  
**Severity**: P0 fixes + Medium enhancements  
**Date**: April 23, 2026  

---

## Part 1: Critical Issues & Fixes

### ISSUE #1: Burn Operation is Broken ❌

**Problem**:
```solidity
IERC20(mtaaToken).transfer(address(0x000...dEaD), burnAmount);
```

This transfers to a dead address wallet. `totalSupply()` never decreases. All metrics based on "deflationary" token are false:
- Staking rewards calculations break
- MAX_SUPPLY caps become meaningless
- Token appreciation math assumes reduction in circulating supply (doesn't happen)

**Fix**:
```solidity
// Option A: Call MtaaToken.burn() directly (requires BURNER_ROLE)
IMTAAToken(mtaaToken).burn(burnAmount);

// Option B: If Factory has approval, call burn on MtaaToken
// Requires: MtaaToken has public burn() function
// function burn(uint256 amount) external { _burn(msg.sender, amount); }

// Option C: Use burner contract pattern (recommended for security)
interface IBurner {
    function burn(address token, uint256 amount) external;
}

// In MaonoVault:
function collectSpawnCost() internal {
    uint256 cost = SPAWN_COSTS[vaultType];
    IERC20(mtaaToken).transferFrom(msg.sender, address(this), cost);
    
    uint256 burnAmount = cost * BURN_PERCENTAGES[vaultType] / 10000;
    uint256 treasuryAmount = cost - burnAmount;
    
    // Burn: call MtaaToken.burn()
    try IMTAAToken(mtaaToken).burn(burnAmount) {
        // Success
    } catch {
        // Fallback: send to dead address if burn not supported (but document this!)
        IERC20(mtaaToken).transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount);
    }
    
    // Treasury: normal transfer
    IERC20(mtaaToken).transfer(daoTreasury, treasuryAmount);
}
```

**Action**: Verify MtaaToken.sol has `burn()` function. If not, add it:
```solidity
// In MtaaToken.sol
function burn(uint256 amount) external {
    _burn(msg.sender, amount);
    emit Burn(msg.sender, amount);
}
```

---

### ISSUE #2: Spawn Cost Collected at Wrong Stage ❌

**Problem**:
```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    if (balanceOf(receiver) == 0) {
        collectSpawnCost();  // WRONG: anyone can trigger this, not vault creator
    }
    // ...
}
```

Issues:
- First depositor ≠ vault creator (DAO admin pays indirectly)
- If deposit fails midway, MTAA already spent
- No clarity on who initiated vault creation
- Cost can be triggered multiple times if multiple users deposit simultaneously

**Fix**: Move spawn cost to factory at vault creation time:

```solidity
// In MaonoVaultFactory.sol
function deployVault(
    address asset,
    address manager,
    address daoTreasury,
    string memory vaultName,
    string memory vaultSymbol,
    VaultConfig memory config,
    uint256 vaultType,
    address mtaaToken
) external payable returns (address vault) {
    // ... validation ...
    
    // STEP 1: Collect spawn cost from deployer BEFORE vault exists
    uint256 spawnCost = SPAWN_COSTS[vaultType];
    require(
        IERC20(mtaaToken).transferFrom(msg.sender, address(this), spawnCost),
        "Spawn cost payment failed"
    );
    
    // Split burn vs. treasury
    uint256 burnAmount = spawnCost * BURN_PERCENTAGES[vaultType] / 10000;
    uint256 treasuryAmount = spawnCost - burnAmount;
    
    if (burnAmount > 0) {
        IMTAAToken(mtaaToken).burn(burnAmount);
    }
    if (treasuryAmount > 0) {
        IERC20(mtaaToken).transfer(daoTreasury, treasuryAmount);
    }
    
    // STEP 2: Deploy vault (no more cost collection in vault itself)
    vault = address(new MaonoVault(
        asset,
        vaultName,
        vaultSymbol,
        daoTreasury,
        manager,
        initialDAOs,
        vaultType,
        mtaaToken
    ));
    
    // STEP 3: Register and track
    vaultInfo[vault] = VaultInfo({...});
    deployedVaults.push(vault);
    
    emit VaultDeployed(vault, msg.sender, manager, asset, vaultName, vaultSymbol);
    return vault;
}
```

**Benefit**: Spawn cost is now a one-time gate at creation. Vault contract only handles upkeep. Clean separation of concerns.

---

### ISSUE #3: Vault Cap Specification is Ambiguous ❌

**Current Spec**:
> "5 per DAO per user prevents whale capture"

**Problem**: This is contradictory:
- **5 per DAO** = 5 total vaults for entire DAO (e.g., 20 members, 5 vaults max) = WAY too restrictive
- **5 per user within a DAO** = 5 per member × 20 members = 100 vaults per DAO = different system

**Decision**: Choose one, then spec it clearly.

**Recommended Model**: **5 per user within a DAO**

```solidity
// In DAO contract
mapping(bytes32 daoId => mapping(address user => uint256)) public userVaultCount;
mapping(bytes32 daoId => mapping(address user => address[])) public userVaults;

uint256 public constant MAX_VAULTS_PER_USER_PER_DAO = 5;

function canUserSpawnVault(bytes32 daoId, address user) external view returns (bool) {
    return userVaultCount[daoId][user] < MAX_VAULTS_PER_USER_PER_DAO;
}

// Called by factory after successful vault deploy
function recordVaultSpawn(bytes32 daoId, address user, address vault) external onlyFactory {
    require(userVaultCount[daoId][user] < MAX_VAULTS_PER_USER_PER_DAO, "Max vaults reached");
    userVaultCount[daoId][user]++;
    userVaults[daoId][user].push(vault);
    emit VaultSpawned(daoId, user, vault, userVaultCount[daoId][user]);
}
```

**Why this works**:
- Prevents individual whale dominance (one person can't have 50 vaults)
- Allows scaling for large DAOs (20 members × 5 vaults = healthy 100-vault DAO)
- Clear per-user accountability

---

### ISSUE #4: Agent Payment Model Breaks at Launch ❌

**Problem**: 
- Agent Defender audit = 500 MTAA
- At launch: MTAA = $0.01 → 500 MTAA = $5
- At $1 MTAA: 500 MTAA = $500
- **Price elasticity kills demand at both extremes**

**Current Spec**: MTAA-only agents
- Scorekeeper: 10 MTAA
- Treasurer: 50 MTAA
- Strategist: 100 MTAA
- Elder: 200 MTAA
- Defender: 500 MTAA

**Fix**: Dual-price agents (KES + MTAA) from day one, like DAOs

```solidity
// New: AgentPaymentGateway.sol
enum PaymentCurrency { KES, MTAA }

struct AgentFee {
    uint256 costKES;      // Fixed KES price
    uint256 costMTAA;     // Equivalent MTAA (recalculated monthly based on price)
    uint256 lastUpdated;  // When MTAA equivalent was last recalculated
}

mapping(AgentType => AgentFee) public agentFees;

function setAgentFeeKES(AgentType agentType, uint256 costKES) external onlyOwner {
    agentFees[agentType].costKES = costKES;
    // Recalculate MTAA equivalent at current oracle price
    _updateMTAAEquivalent(agentType);
    emit AgentFeeUpdated(agentType, costKES, agentFees[agentType].costMTAA);
}

function _updateMTAAEquivalent(AgentType agentType) internal {
    uint256 mtaaPrice = priceOracle.getPrice(mtaaToken); // USD cents, e.g., 50 = $0.50
    uint256 kesInUSD = agentFees[agentType].costKES * 1e18 / 100; // KES 100 = 1 USD
    uint256 mtaaEquivalent = kesInUSD * 1e18 / mtaaPrice;
    
    agentFees[agentType].costMTAA = mtaaEquivalent;
    agentFees[agentType].lastUpdated = block.timestamp;
}

function executeAgent(
    bytes32 daoId,
    AgentType agentType,
    PaymentCurrency currency
) external returns (bytes32 reportId) {
    AgentFee memory fee = agentFees[agentType];
    
    if (currency == PaymentCurrency.KES) {
        // Pay in KES
        require(IERC20(kesToken).transferFrom(msg.sender, treasury, fee.costKES));
    } else {
        // Pay in MTAA
        require(IERC20(mtaaToken).transferFrom(msg.sender, address(this), fee.costMTAA));
        // Burn 20% (keeps token deflationary), 80% to treasury
        _burnOrTreasury(fee.costMTAA);
    }
    
    reportId = keccak256(abi.encodePacked(daoId, agentType, block.timestamp));
    emit AgentExecutionRequested(daoId, agentType, reportId, currency);
    return reportId;
}
```

**Fixed Agent Pricing** (KES + MTAA equivalents):

| Agent | Cost (KES) | Cost (MTAA @ $0.05) | Cost (MTAA @ $1.00) |
|-------|-----------|-------------------|-------------------|
| Scorekeeper | 500 | 100 MTAA | 5 MTAA |
| Treasurer | 2,500 | 500 MTAA | 25 MTAA |
| Strategist | 5,000 | 1,000 MTAA | 50 MTAA |
| Elder | 10,000 | 2,000 MTAA | 100 MTAA |
| Defender | 25,000 | 5,000 MTAA | 250 MTAA |

**Benefit**: Users always get a clear KES price. MTAA price becomes a discount incentive, not the primary price point.

---

### ISSUE #5: Hibernation Recovery Creates Cliff ❌

**Problem**: 
```solidity
uint256 debtUpkeep = monthsHibernating * UPKEEP_COSTS[vaultType]; // 4 months × 30 MTAA = 120 MTAA
require(IERC20(mtaaToken).transferFrom(user, address(this), debtUpkeep));
```

- User hibernates for 4 months = 120 MTAA backpay cliff
- Most users can't/won't pay → permanent vault abandonment
- Funds are safe but user is discouraged from returning

**Fix**: Forgiving recovery model

```solidity
enum RecoveryOption {
    PAY_ONE_MONTH,      // Resume by paying 1 forward month (no backpay)
    PAY_WITH_PENALTY,   // Pay 1.5× one month = recovery fee, debts forgiven
    RESET_FEATURES      // Free resume but lose tier, reset to basic
}

function resumeFromHibernation(RecoveryOption option) external nonReentrant {
    require(vaultStatus[msg.sender] == Status.HIBERNATING, "Not hibernating");
    
    if (option == RecoveryOption.PAY_ONE_MONTH) {
        // Simple: just pay forward looking
        uint256 upkeepCost = UPKEEP_COSTS[vaultType];
        require(
            IERC20(mtaaToken).transferFrom(msg.sender, address(this), upkeepCost),
            "Insufficient MTAA"
        );
        _splitBurnTreasury(upkeepCost);
    } 
    else if (option == RecoveryOption.PAY_WITH_PENALTY) {
        // Penalty model: pay 1.5× but debts waived
        uint256 recoveryFee = UPKEEP_COSTS[vaultType] * 150 / 100; // 1.5×
        require(
            IERC20(mtaaToken).transferFrom(msg.sender, address(this), recoveryFee),
            "Insufficient MTAA for recovery"
        );
        _splitBurnTreasury(recoveryFee);
    }
    else if (option == RecoveryOption.RESET_FEATURES) {
        // Free resume but features reset (no penalty payment)
        vaultTierLevel[msg.sender] = TierLevel.BASIC; // Reset to base tier
        emit VaultTierReset(msg.sender, TierLevel.BASIC);
    }
    
    vaultStatus[msg.sender] = Status.ACTIVE;
    lastUpkeepPayment[msg.sender] = block.timestamp;
    hibernationStarted[msg.sender] = 0;
    
    emit VaultResumed(msg.sender, option, block.timestamp);
}
```

**Why this works**:
- PAY_ONE_MONTH: For engaged users who want to stay caught up
- PAY_WITH_PENALTY: Revenue play; users willing to pay premium to keep features
- RESET_FEATURES: User retention fallback; costs protocol nothing, user gets funds back

**Expected outcome**: 70% pick RESET_FEATURES, 25% pick PAY_ONE_MONTH, 5% pick PAY_WITH_PENALTY (still net positive revenue)

---

### ISSUE #6: Dynamic Pricing Oracle Spec Missing ❌

**Problem**: Identified the risk (token appreciation crushes vault demand) but implementation underspecified.

**Fix**: Complete oracle spec

```solidity
// In MonetizedVaultFactory.sol

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256); // Returns USD cents
    function lastUpdate(address token) external view returns (uint256); // Timestamp
}

address public priceOracle;
address public oracleAdmin; // Separate from owner for safety

struct SpawnPriceDynamics {
    uint256 basePrice;           // e.g., 500 MTAA at $0.10 MTAA = $50 USD cost
    uint256 targetUSDCost;       // Target cost in USD (e.g., $50)
    uint256 mtaaPriceFloor;      // Min MTAA required (prevent free vaults)
    uint256 mtaaPriceCeiling;    // Max MTAA required (prevent unreasonable costs)
    uint256 recalculationFreq;   // How often to update (e.g., 7 days)
}

mapping(uint256 vaultType => SpawnPriceDynamics) public pricingDynamics;

function getSpawnCostInMTAA(uint256 vaultType) external view returns (uint256) {
    SpawnPriceDynamics memory dyn = pricingDynamics[vaultType];
    uint256 mtaaPrice = IPriceOracle(priceOracle).getPrice(mtaaToken); // USD cents
    
    // Calculate: targetUSD / mtaaPrice = MTAA required
    uint256 dynamicCost = (dyn.targetUSDCost * 1e8) / mtaaPrice / 1e6; // USD cents → MTAA
    
    // Apply floor and ceiling
    if (dynamicCost < dyn.mtaaPriceFloor) return dyn.mtaaPriceFloor;
    if (dynamicCost > dyn.mtaaPriceCeiling) return dyn.mtaaPriceCeiling;
    
    return dynamicCost;
}

function setOracleAddress(address newOracle) external {
    require(msg.sender == oracleAdmin, "Only oracle admin");
    require(newOracle != address(0), "Invalid oracle");
    
    // Verify new oracle is valid
    try IPriceOracle(newOracle).getPrice(mtaaToken) {
        // Success: oracle responds
    } catch {
        revert("Oracle not responding");
    }
    
    priceOracle = newOracle;
    emit OracleUpdated(newOracle, block.timestamp);
}

function setPricingDynamics(uint256 vaultType, uint256 targetUSD, uint256 floor, uint256 ceiling) external onlyOwner {
    require(targetUSD > 0 && floor > 0 && ceiling > floor, "Invalid pricing params");
    
    pricingDynamics[vaultType] = SpawnPriceDynamics({
        basePrice: SPAWN_COSTS[vaultType],
        targetUSDCost: targetUSD,
        mtaaPriceFloor: floor,
        mtaaPriceCeiling: ceiling,
        recalculationFreq: 7 days
    });
    
    emit PricingDynamicsUpdated(vaultType, targetUSD, floor, ceiling);
}
```

**Safety Guards**:
- Oracle admin ≠ owner (separates responsibility)
- Floor prevents free vaults (e.g., min 200 MTAA always)
- Ceiling prevents unreasonable costs (e.g., max 2,000 MTAA)
- Verification check when oracle address changes
- Quarterly admin review of pricing dynamics

---

## Part 2: Chain Specification & Infrastructure

### ISSUE #7: No Chain Specified ❌

**Problem**: Entire financial model assumes negligible gas costs. This is only true on specific chains.

| Chain | Gas Cost (Monthly Vault Upkeep @20 MTAA) | Viable? |
|-------|------------------------------------------|---------|
| Ethereum L1 | $50-200 | ❌ No (upkeep = 20 MTAA at $1 = $20) |
| Polygon | $0.10-0.50 | ✅ Yes |
| Base | $0.05-0.20 | ✅ Yes |
| Arbitrum | $0.10-0.30 | ✅ Yes |
| Celo | $0.01-0.05 | ✅ Yes (but limited DEX liquidity) |

**Decision**: Launch on **Polygon mainnet** (recommended for Kenya)

**Why Polygon for EA Kenya**:
- Mobile-friendly (Polygon has mobile SDK integrations)
- Local on-ramp partners (e.g., KuCoin, Binance P2P)
- Consistent sub-$1 gas for all transactions
- Stablecoin infrastructure (USDC, DAI available)

**Specification**:

```markdown
## Chain & Infrastructure Requirements

### Mainnet: Polygon PoS
- RPC: Alchemy (or QuickNode backup)
- Contracts: All ERC-20 vault + governance contracts deploy to Polygon
- Stablecoin: USDC (Circle), DAI (aave)
- Oracle: Chainlink (price feeds)

### Testnet: Polygon Mumbai
- Pre-launch testing for all Phase 1-2
- Faucet: Alchemy Mumbai faucet

### M-Pesa Bridge
- Off-chain: M-Pesa KES → USDC via Kotani Pay or similar
- Gas optimization: Batch user deposits (e.g., collect 50 deposits, execute 1 transaction)
- Staking rewards: On-chain weekly sweeps, batch distributions

### Cost Targets (after Polygon deployment)
- Vault spawn: <$0.50 gas
- Monthly upkeep: <$0.10 gas
- Agent report submission: <$1.00 gas
- Trade execution (Yuki): <$1.00 gas
```

---

## Part 3: Medium Issues & Enhancements

### ISSUE #8: Free Tier Revenue Leakage

**Problem**: 15% of DAOs on free tier consume infrastructure (RPC, indexing, storage) with zero token interaction.

**Solution**: Soft utility requirement for free tier

```solidity
uint256 public FREE_TIER_MTAA_HOLD_REQUIREMENT = 100 * 1e18; // Hold 100 MTAA

function createDAO(string memory name, bytes32 daoType) external returns (bytes32 daoId) {
    DAOTier tier = _determineTier(msg.sender);
    
    if (tier == DAOTier.FREE) {
        // Free tier requires holding 100 MTAA (not spending, just holding)
        require(
            IERC20(mtaaToken).balanceOf(msg.sender) >= FREE_TIER_MTAA_HOLD_REQUIREMENT,
            "Free tier requires 100 MTAA holding"
        );
    }
    
    // ... create DAO ...
    emit DaoCreated(daoId, msg.sender, tier);
}
```

**Benefit**: 
- Holds token even at $0.01, prevents abandonment
- Creates soft token demand for free users
- Users believe in project → likely to upgrade to paid tier later

---

### ISSUE #9: Financial Model Denominated in Wrong Price

**Problem**: 
> Conservative Scenario... $100K-$500K/year @ 1 MTAA = $1

That's Year 3+ numbers, not Year 1. At launch MTAA = $0.03-0.05.

**Fix**: Rebase financials at launch price

**Year 1 Projection @ MTAA = $0.05**:

| Revenue Stream | Units/Month | Price/Unit | Monthly KES | Annual KES |
|---|---|---|---|---|
| DAO SaaS (50 DAOs) | 50 | 2,500 KES | 125,000 | 1,500,000 |
| Vault Spawn (200 vaults) | 100 MTAA | 5 KES/MTAA | 500 | 6,000 |
| Vault Upkeep (200 vaults) | 8,000 MTAA | 5 KES/MTAA | 40,000 | 480,000 |
| Agent Reports (500 @ KES avg) | 500 | 2,500 KES avg | 1,250,000 | 15,000,000 |
| Trading Fees (MTAA @ 0.25% vol) | varies | — | ~5,000 | ~60,000 |
| **Total Revenue** | — | — | **1,420,000 KES** | **17,046,000 KES** |
| **USD Equivalent** | — | — | ~$11,360 | ~$136,368 |

**The Insight**: DAO SaaS + Agent fees (KES) are your revenue backbone, not MTAA token economics. MTAA is the utility lever, not the revenue stream.

---

### ISSUE #10: On-Chain Report Storage is Expensive

**Problem**: 
```solidity
reports[reportId] = reportData; // Storing strings on-chain
```

Strategist report (5KB) = $5-50 on Ethereum, $0.05-0.20 on Polygon.

**Fix**: IPFS + on-chain CID pointer

```solidity
// In AgentPaymentGateway.sol

struct Report {
    bytes32 ipfsCID;      // IPFS content hash
    uint256 timestamp;
    address submitter;
    uint256 costPaid;     // MTAA or KES paid
}

mapping(bytes32 reportId => Report) public reports;

function submitReport(
    bytes32 reportId,
    bytes32 ipfsCID,  // IPFS multihash (split if needed)
    bytes32 ipfsCID2  // Second half of CID if > 32 bytes
) external onlyAgent {
    require(pendingReports[reportId].daoId != 0, "No pending report");
    
    reports[reportId] = Report({
        ipfsCID: ipfsCID,  // Store reference, not data
        timestamp: block.timestamp,
        submitter: msg.sender,
        costPaid: pendingReports[reportId].costPaid
    });
    
    emit ReportSubmitted(reportId, ipfsCID, block.timestamp);
}

function getReportCID(bytes32 reportId) external view returns (string memory) {
    bytes32 cid = reports[reportId].ipfsCID;
    // Convert bytes32 to IPFS string (Qm... format)
    return _cidToString(cid);
}
```

**Cost Reduction**: $0.10 on-chain + free IPFS storage instead of $5+ on-chain.

---

## Part 4: DAO Type Audit & Monetization

### Current DAO Architecture (From Governance & Admin Docs)

DAO types are **not explicitly defined** in smart contracts. They're implicit in configuration.

**What's Missing**: Explicit DAO type enum with pricing/features tied to type.

---

### Recommended DAO Type System

```solidity
enum DAOType {
    COLLECTIVE,      // 0: Community, long-term (2,500 KES/month)
    SHORT_TERM,      // 1: Events, campaigns (1,000 KES/month)
    ENTERPRISE,      // 2: 50+ members, analytics (7,500 KES/month)
    FREE_TIER,       // 3: <10 members, limited features (requires 100 MTAA hold)
    ECOSYSTEM,       // 4: Partner DAOs, special pricing (negotiated)
    CHAMA            // 5: Rotating savings (chama-specific, 1,500 KES/month)
}

struct DAOConfig {
    DAOType daoType;
    uint256 monthlyFeesKES;
    uint256 maxMembers;
    bool canSpawnVaults;
    uint256 maxVaultsPerMember;
    uint256 maxVaultValue;
    bool hasPremiumAnalytics;
    bool hasGovernanceTokens;
    bool hasReputationScores;
    bool hasMultiSigTreasury;
}

mapping(DAOType => DAOConfig) public daoConfigs;

function initDaoConfigs() internal {
    daoConfigs[DAOType.COLLECTIVE] = DAOConfig({
        daoType: DAOType.COLLECTIVE,
        monthlyFeesKES: 2500,
        maxMembers: 9999,
        canSpawnVaults: true,
        maxVaultsPerMember: 5,
        maxVaultValue: 100000000, // 100M KES
        hasPremiumAnalytics: false,
        hasGovernanceTokens: false,
        hasReputationScores: true,
        hasMultiSigTreasury: true
    });
    
    daoConfigs[DAOType.SHORT_TERM] = DAOConfig({
        daoType: DAOType.SHORT_TERM,
        monthlyFeesKES: 1000,
        maxMembers: 100,
        canSpawnVaults: true,
        maxVaultsPerMember: 2,
        maxVaultValue: 10000000, // 10M KES
        hasPremiumAnalytics: false,
        hasGovernanceTokens: false,
        hasReputationScores: true,
        hasMultiSigTreasury: false
    });
    
    daoConfigs[DAOType.ENTERPRISE] = DAOConfig({
        daoType: DAOType.ENTERPRISE,
        monthlyFeesKES: 7500,
        maxMembers: 9999,
        canSpawnVaults: true,
        maxVaultsPerMember: 10,
        maxVaultValue: 1000000000, // 1B KES
        hasPremiumAnalytics: true,
        hasGovernanceTokens: true,
        hasReputationScores: true,
        hasMultiSigTreasury: true
    });
    
    daoConfigs[DAOType.CHAMA] = DAOConfig({
        daoType: DAOType.CHAMA,
        monthlyFeesKES: 1500,
        maxMembers: 30,  // Typical chama size
        canSpawnVaults: true,
        maxVaultsPerMember: 1,  // One savings vault per member
        maxVaultValue: 5000000, // 5M KES cap for safety
        hasPremiumAnalytics: false,
        hasGovernanceTokens: false,
        hasReputationScores: true,  // Contribution tracking
        hasMultiSigTreasury: true   // ROSCA rotating withdrawal
    });
    
    daoConfigs[DAOType.FREE_TIER] = DAOConfig({
        daoType: DAOType.FREE_TIER,
        monthlyFeesKES: 0,
        maxMembers: 10,
        canSpawnVaults: false,
        maxVaultsPerMember: 0,
        maxVaultValue: 0,
        hasPremiumAnalytics: false,
        hasGovernanceTokens: false,
        hasReputationScores: false,
        hasMultiSigTreasury: false
    });
}
```

---

### DAO Type Monetization Matrix

| DAO Type | Monthly Fee (KES) | Can Spawn Vaults | Max Vaults/Member | Premium Analytics | MTAA Reserve Req | Target Users |
|----------|------------------|-----------------|-------------------|------------------|-----------------|------------|
| **Collective** | 2,500 | ✅ | 5 | Optional (pay extra) | None | Communities, groups |
| **Short-Term** | 1,000 | ✅ | 2 | No | None | Events, campaigns |
| **Enterprise** | 7,500 | ✅ | 10 | ✅ Included | 1,000 MTAA | Large organizations |
| **Chama** | 1,500 | ✅ | 1 | No | None | Rotating savings |
| **Free** | 0 | ❌ | 0 | No | **100 MTAA** | Exploration |
| **Ecosystem** | Custom | ✅ | Custom | ✅ | Negotiated | Partners |

---

## Part 5: Untapped Opportunities

### A. Referral/Affiliate System for DAOs 🎯

**Model**: DAO-to-DAO referral rewards (organic growth in EA markets)

```solidity
// New: DAOReferralProgram.sol

struct ReferralReward {
    bytes32 referrerDAOId;
    bytes32 referredDAOId;
    uint256 totalFeesGenerated;
    uint256 referralRewardPercentage; // 10% of referred DAO fees for 6 months
    uint256 rewardStartTime;
    uint256 rewardEndTime;
}

mapping(bytes32 => ReferralReward) public referrals;
mapping(bytes32 => bytes32[]) public referrerDAOs; // DAOs referred by referrer

function registerReferral(bytes32 referrerDAOId, bytes32 referredDAOId) external {
    require(
        msg.sender == daoAdmin[referredDAOId],
        "Only referred DAO admin can register"
    );
    require(
        referrals[referredDAOId].referrerDAOId == bytes32(0),
        "Already has referrer"
    );
    
    referrals[referredDAOId] = ReferralReward({
        referrerDAOId: referrerDAOId,
        referredDAOId: referredDAOId,
        totalFeesGenerated: 0,
        referralRewardPercentage: 1000, // 10% (basis points)
        rewardStartTime: block.timestamp,
        rewardEndTime: block.timestamp + 26 weeks
    });
    
    referrerDAOs[referrerDAOId].push(referredDAOId);
    emit ReferralRegistered(referrerDAOId, referredDAOId);
}

function distributeReferralRewards() external {
    // Called monthly by protocol when DAO fees collected
    for each referral where rewardEndTime > now:
        uint256 monthlyFeeReferred = daoMonthlyFees[referral.referredDAOId];
        uint256 referralReward = monthlyFeeReferred * referral.referralRewardPercentage / 10000;
        
        // Send to referrer DAO treasury
        payable(daoTreasury[referral.referrerDAOId]).transfer(referralReward);
        
        emit ReferralRewardDistributed(
            referral.referrerDAOId,
            referral.referredDAOId,
            referralReward
        );
}
```

**Expected Impact**:
- DAO A refers DAO B
- DAO B pays 2,500 KES/month → DAO A gets 250 KES/month for 6 months
- Organic growth loop (each DAO becomes recruiter)
- At 50 DAOs, 10% referral rate = 5 DAOs = 1,250 KES/month distributed

---

### B. Chama Vault Type (Specific Implementation) 🎯

**Why This Matters**: Chamas are Kenya's actual grassroots financial infrastructure. 2M+ chamas exist, handling billions in savings and loans.

```solidity
// New: ChamaVault.sol (extends MaonoVault)
// Features: ROSCA rotating withdrawals, contribution tracking, reputation scores

contract ChamaVault is MaonoVault {
    // Chama-specific state
    enum ChamaStatus { ACTIVE, ON_BREAK, CLOSED }
    
    struct ChamaMember {
        address wallet;
        uint256 monthlyContribution;
        uint256 missedPayments;
        uint256 reputationScore;
        bool receivedPayout;
        uint256 payoutRound;
    }
    
    ChamaMember[] public members;
    uint256 public contributionPeriod; // e.g., 7 days
    uint256 public payoutRound = 0;
    uint256 public nextPayoutDate;
    uint256 public totalMembersInRound;
    ChamaStatus public chamaStatus;

    // Track rotational payouts (ROSCA: Rotating Savings and Credit Association)
    struct ROSCARound {
        uint256 roundNumber;
        address payoutRecipient;
        uint256 roundStartTime;
        uint256 roundEndTime;
        uint256 targetAmount;
        uint256 actualAmount;
        bool completed;
    }
    
    mapping(uint256 => ROSCARound) public roscarounds;
    
    function contributeToCham(uint256 amount) external {
        require(chamaStatus == ChamaStatus.ACTIVE, "Chama not active");
        require(isChamaMember(msg.sender), "Not a chama member");
        
        ChamaMember storage member = getMember(msg.sender);
        require(amount == member.monthlyContribution, "Invalid contribution amount");
        
        // Collect in underlying asset
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        
        // Attempt to reach next payout target
        uint256 totalBalance = IERC20(asset).balanceOf(address(this));
        uint256 targetForRound = members.length * getMember(roscarounds[payoutRound].payoutRecipient).monthlyContribution;
        
        if (totalBalance >= targetForRound) {
            // Execute payout
            _executeROSCAPayout(payoutRound);
        }
        
        emit ChamaContributionMade(msg.sender, amount, block.timestamp);
    }
    
    function _executeROSCAPayout(uint256 roundNumber) internal {
        ROSCARound storage round = roscarounds[roundNumber];
        require(!round.completed, "Round already completed");
        
        ChamaMember storage recipient = getMember(round.payoutRecipient);
        uint256 payoutAmount = round.targetAmount;
        
        // Transfer payout
        IERC20(asset).transfer(recipient.wallet, payoutAmount);
        
        // Update reputation scores
        for each member: {
            if (member.contributedThisRound) {
                member.reputationScore += 10; // Reward consistent members
            } else {
                member.missedPayments++;
                member.reputationScore -= 20; // Penalty for non-contribution
            }
        }
        
        recipient.receivedPayout = true;
        recipient.payoutRound = roundNumber;
        round.completed = true;
        round.actualAmount = payoutAmount;
        
        // Advance to next round
        payoutRound++;
        emit ROSCAPayoutExecuted(roundNumber, recipient.wallet, payoutAmount);
    }
    
    function getMemberReputationScore(address member) external view returns (uint256) {
        ChamaMember storage m = getMember(member);
        return m.reputationScore;
    }
}
```

**Why Chamas Are Valuable**:
1. **Market Size**: 2M+ chamas in Kenya alone, each handling 5M-50M KES annually
2. **MTAA Adoption Path**: Chama → vault → staking → governance
3. **Revenue**: 1,500 KES/month × 50,000 chamas = 75M KES/month eventually
4. **Regulatory Alignment**: Chamas are informal financial groups (no banking license needed for basic operations)
5. **Switching Cost**: Once chama settles into your system, they rarely switch

**Chama Vault Pricing**:
- Spawn cost: 300 MTAA (cheaper than standard vaults, but ROSCA features)
- Monthly upkeep: 15 MTAA (handles rotation automation)
- Burn: 50% (community feature get discount)

---

## Summary: P0 Fixes Before Phase 1

| Issue | Fix | Priority | Effort |
|-------|-----|----------|--------|
| Burn is broken | Call MtaaToken.burn() instead of transfer | P0 | 2 hours |
| Spawn cost at wrong stage | Move to factory at creation time | P0 | 4 hours |
| Vault cap ambiguous | Clarify as 5 per user, implement per DAO | P0 | 2 hours |
| Agent fees MTAA-only | Add dual KES+MTAA pricing | P0 | 6 hours |
| Hibernation recovery cliff | Add three recovery options | P0 | 4 hours |
| Oracle spec missing | Add oracle validation, floor/ceiling | P0 | 3 hours |
| Chain not specified | Declare Polygon mainnet + Mumbai testnet | P1 | 1 hour |
| Free tier leakage | Require 100 MTAA hold for free tier | P1 | 2 hours |
| Financials wrong price | Rebase at $0.03-0.05 MTAA launch price | P1 | 2 hours |
| Report storage expensive | Use IPFS + on-chain CID | P1 | 4 hours |
| **Subtotal** | | | **~30 hours (~1 week)** |
| Referral system | New contract + integration | P2 | 8 hours |
| Chama vault type | New vault contract + ROSCA logic | P2 | 16 hours |

**Timeline**:
- **Week 1**: Fix all P0 issues
- **Week 2-3**: Implement Phase 1 vault monetization
- **Week 4-5**: Phase 2 feature gating
- **Post-Phase 2**: Referral system + Chama vaults launch

