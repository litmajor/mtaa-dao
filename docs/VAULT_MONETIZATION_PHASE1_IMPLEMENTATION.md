# Vault Monetization: Implementation Quick Start

**Status**: Pre-Implementation Phase  
**Priority**: Phase 1 (Vault Costs) → Phase 2-5 (Feature Gating)  
**Effort**: ~4 weeks for Phase 1, ~8 weeks total for all phases  

---

## What's Currently Missing (Gap Analysis)

### MaonoVault.sol ❌

| Feature | Current | Missing | Impact |
|---------|---------|---------|--------|
| **Spawn Cost** | Not implemented | Collection in MTAA | Can't monetize vault creation |
| **Monthly Upkeep** | Not implemented | Tracking + enforcement | Can't collect recurring revenue |
| **Vault Types** | 1 type only | 5 types (Savings/Escrow/Business/Investing/Custom) | Can't differentiate pricing |
| **Burn Logic** | Not implemented | 100%/50%/30% splits | Can't control token economics |
| **Hibernation** | Not implemented | Status + recovery flow | Users stuck if can't pay |
| **Vault Cap** | Not implemented | Max 5 per DAO | Whales can't capture DAO |
| **MTAA Integration** | Not implemented | Token address + transfers | Can't collect fees |

### MaonoVaultFactory.sol ❌

| Feature | Current | Missing | Impact |
|---------|---------|---------|--------|
| **Spawn Fee** | Eth-denominated only | MTAA-based option | Factory still requires native tokens |
| **Vault Type Support** | Hardcoded params | Multiple type templates | Can't spawn different vault types |
| **Cost Calculation** | Not type-aware | Dynamic cost per type | One-size-fits-all pricing |

### Feature Gating ❌ (Completely Missing)

| Contract | Status | Need |
|----------|--------|------|
| FeatureGate.sol | 🚫 | New contract for feature access control |
| PremiumDAOFeatures.sol | 🚫 | New contract for DAO governance upgrades |
| AgentPaymentGateway.sol | 🚫 | New contract for agent fees |

---

## Phase 1: Vault Monetization (4 weeks)

### Step 1.1: Add MTAA Support to MaonoVault

**File**: `contracts/MaonoVault.sol`

**Changes**:

```solidity
// ADD: MTAA token address and state variables
address public mtaaToken; // MTAA token contract
uint256 public vaultType; // 0=savings, 1=escrow, 2=business, 3=investing, 4=custom

// Spawn cost mapping
mapping(uint256 vaultType => uint256 cost) public SPAWN_COSTS = [
    200 ether,  // Savings: 200 MTAA
    300 ether,  // Escrow: 300 MTAA
    500 ether,  // Business: 500 MTAA
    800 ether,  // Investing: 800 MTAA
    1200 ether  // Custom: 1200 MTAA
];

// Upkeep cost mapping
mapping(uint256 vaultType => uint256 cost) public UPKEEP_COSTS = [
    20 ether,   // Savings: 20 MTAA/month
    30 ether,   // Escrow: 30 MTAA/month
    50 ether,   // Business: 50 MTAA/month
    80 ether,   // Investing: 80 MTAA/month
    100 ether   // Custom: 100 MTAA/month
];

// Burn percentage (basis points, 10000 = 100%)
mapping(uint256 vaultType => uint256 percentage) public BURN_PERCENTAGES = [
    10000,      // Savings: 100% burn
    5000,       // Escrow: 50% burn
    5000,       // Business: 50% burn
    3000,       // Investing: 30% burn
    3000        // Custom: 30% burn
];

// Tracking state
mapping(address user => uint256 lastUpkeepPayment) public lastUpkeepPayment;
mapping(address user => Status) public vaultStatus; // ACTIVE, HIBERNATING, CLOSED

enum Status { ACTIVE, HIBERNATING, CLOSED }

// Track hibernation start time
mapping(address user => uint256) public hibernationStarted;

event VaultHibernated(address indexed user, uint256 timestamp);
event VaultResumed(address indexed user, uint256 timestamp);
event UpkeepCollected(address indexed user, uint256 amount, uint256 timestamp);
event UpkeepFailed(address indexed user, uint256 timestamp);
```

**Add Constructor Parameter**:

```solidity
constructor(
    address _asset,
    string memory _name,
    string memory _symbol,
    address _daoTreasury,
    address _manager,
    string[] memory initialDAOs,
    uint256 _vaultType,        // ADD THIS
    address _mtaaToken         // ADD THIS
) ERC4626(_asset) Ownable(msg.sender) {
    vaultType = _vaultType;
    mtaaToken = _mtaaToken;
    // ... rest of constructor
}
```

**Add Spawn Cost Collection**:

```solidity
function collectSpawnCost() internal {
    uint256 cost = SPAWN_COSTS[vaultType];
    require(
        IERC20(mtaaToken).transferFrom(msg.sender, address(this), cost),
        "Spawn cost payment failed"
    );
    
    // Handle burn vs. treasury split
    uint256 burnPercentage = BURN_PERCENTAGES[vaultType];
    uint256 burnAmount = cost * burnPercentage / 10000;
    uint256 treasuryAmount = cost - burnAmount;
    
    if (burnAmount > 0) {
        // Burn: send to dead address or call burn function
        IERC20(mtaaToken).transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount);
    }
    
    if (treasuryAmount > 0) {
        IERC20(mtaaToken).transfer(daoTreasury, treasuryAmount);
    }
    
    emit SpawnCostCollected(msg.sender, cost, burnAmount, treasuryAmount);
}

event SpawnCostCollected(
    address indexed user,
    uint256 totalCost,
    uint256 burnAmount,
    uint256 treasuryAmount
);
```

**Add to Deposit Flow** (modify existing `deposit()` function):

```solidity
function deposit(uint256 assets, address receiver) 
    public 
    override 
    nonReentrant 
    returns (uint256) 
{
    // NEW: Collect spawn cost on first deposit
    if (balanceOf(receiver) == 0) {
        collectSpawnCost();
    }
    
    // ... rest of existing deposit logic
}
```

---

### Step 1.2: Add Upkeep Tracking

**Add to MaonoVault.sol**:

```solidity
function collectMonthlyUpkeep() external nonReentrant {
    require(msg.sender == owner(), "Only vault owner");
    require(
        block.timestamp >= lastUpkeepPayment[msg.sender] + 30 days,
        "Upkeep not due yet"
    );
    
    uint256 upkeepCost = UPKEEP_COSTS[vaultType];
    
    // Check if user can pay
    if (IERC20(mtaaToken).balanceOf(msg.sender) >= upkeepCost) {
        // User can pay: collect upkeep
        require(
            IERC20(mtaaToken).transferFrom(msg.sender, address(this), upkeepCost),
            "Upkeep payment failed"
        );
        
        // Split like spawn cost
        uint256 burnPercentage = BURN_PERCENTAGES[vaultType];
        uint256 burnAmount = upkeepCost * burnPercentage / 10000;
        uint256 treasuryAmount = upkeepCost - burnAmount;
        
        if (burnAmount > 0) {
            IERC20(mtaaToken).transfer(address(0x000000000000000000000000000000000000dEaD), burnAmount);
        }
        if (treasuryAmount > 0) {
            IERC20(mtaaToken).transfer(daoTreasury, treasuryAmount);
        }
        
        lastUpkeepPayment[msg.sender] = block.timestamp;
        emit UpkeepCollected(msg.sender, upkeepCost, block.timestamp);
        
    } else {
        // User can't pay: enter hibernation
        vaultStatus[msg.sender] = Status.HIBERNATING;
        hibernationStarted[msg.sender] = block.timestamp;
        emit VaultHibernated(msg.sender, block.timestamp);
    }
}

function getMonthsHibernating(address user) external view returns (uint256) {
    if (vaultStatus[user] != Status.HIBERNATING) return 0;
    return (block.timestamp - hibernationStarted[user]) / 30 days;
}

function resumeFromHibernation() external nonReentrant {
    require(vaultStatus[msg.sender] == Status.HIBERNATING, "Not hibernating");
    
    // Calculate back-owed upkeep
    uint256 monthsHibernating = (block.timestamp - hibernationStarted[msg.sender]) / 30 days;
    uint256 debtUpkeep = monthsHibernating * UPKEEP_COSTS[vaultType];
    
    require(
        IERC20(mtaaToken).transferFrom(msg.sender, address(this), debtUpkeep),
        "Insufficient MTAA for recovery"
    );
    
    vaultStatus[msg.sender] = Status.ACTIVE;
    lastUpkeepPayment[msg.sender] = block.timestamp;
    
    emit VaultResumed(msg.sender, block.timestamp);
}

// Prevent operations during hibernation
modifier onlyActive() {
    require(
        vaultStatus[msg.sender] == Status.ACTIVE,
        "Vault is hibernating. Call resumeFromHibernation()"
    );
    _;
}

// Apply to deposit, withdraw, etc.
function withdraw(uint256 assets, address receiver, address owner)
    public
    override
    onlyActive
    nonReentrant
    returns (uint256)
{
    // ... existing withdraw logic
}
```

---

### Step 1.3: Add Vault Type Support to Factory

**File**: `contracts/MaonoVaultFactory.sol`

**Modify `deployVault()` function**:

```solidity
function deployVault(
    address asset,
    address manager,
    address daoTreasury,
    string memory vaultName,
    string memory vaultSymbol,
    string[] memory initialDAOs,
    VaultConfig memory config,
    uint256 vaultType,                  // ADD THIS: 0-4
    address mtaaToken                   // ADD THIS
) external payable returns (address vault) {
    if (!supportedAssets[asset]) revert UnsupportedAsset();
    if (msg.value != deploymentFee) revert InsufficientDeploymentFee();
    if (manager == address(0) || daoTreasury == address(0)) revert InvalidAddress();
    if (vaultType > 4) revert InvalidVaultType();              // ADD: Validate type

    // Validate config
    if (config.performanceFee > 5000 || config.managementFee > 1000) revert InvalidConfig();

    // Deploy new vault with vault type and MTAA address
    vault = address(new MaonoVault(
        asset,
        vaultName,
        vaultSymbol,
        daoTreasury,
        manager,
        initialDAOs,
        vaultType,                      // ADD THIS
        mtaaToken                       // ADD THIS
    ));

    // ... rest of existing logic
}
```

**Add error**:

```solidity
error InvalidVaultType();
```

---

### Step 1.4: Update DAO Configuration Contract

**Location**: Modify your existing DAO contract (e.g., `MtaaGovernance.sol` or wherever DAO creation happens)

**Add**:

```solidity
// Track vault count per DAO
mapping(bytes32 daoId => uint256) public vaultCount;
uint256 public constant MAX_VAULTS_PER_DAO = 5;

function canSpawnVault(bytes32 daoId) external view returns (bool) {
    return vaultCount[daoId] < MAX_VAULTS_PER_DAO;
}

function recordVaultSpawn(bytes32 daoId) external {
    require(msg.sender == address(vaultFactory), "Only factory");
    vaultCount[daoId]++;
}
```

---

## Quick Testing Checklist

### Unit Tests

```typescript
// tests/MaonoVault.test.ts

describe("MaonoVault Monetization", () => {
  
  it("should collect spawn cost on first deposit", async () => {
    const spawnCost = ethers.parseUnits("500", 18); // 500 MTAA
    await mtaa.approve(vault.address, spawnCost);
    
    await vault.deposit(usdc100, user.address);
    
    // Verify MTAA transferred
    const burnedBalance = await mtaa.balanceOf(DEAD_ADDRESS);
    expect(burnedBalance).to.equal(spawnCost / 2); // 50% burn for escrow
  });

  it("should enforce monthly upkeep", async () => {
    // Deposit to activate vault
    await vault.deposit(usdc100, user.address);
    
    // Try to collect upkeep immediately - should fail
    await expect(vault.collectMonthlyUpkeep())
      .to.revertedWith("Upkeep not due yet");
    
    // Jump 30 days
    await time.increase(30 * 24 * 60 * 60);
    
    // Now should succeed
    const upkeepCost = ethers.parseUnits("30", 18); // 30 MTAA
    await mtaa.approve(vault.address, upkeepCost);
    await vault.collectMonthlyUpkeep();
    
    expect(await vault.lastUpkeepPayment(user.address)).to.be.gt(0);
  });

  it("should hibernateate vault if upkeep not paid", async () => {
    // Deposit to activate
    await vault.deposit(usdc100, user.address);
    
    // Jump 30 days
    await time.increase(30 * 24 * 60 * 60);
    
    // Don't approve upkeep payment - just try to collect
    await vault.collectMonthlyUpkeep();
    
    // Vault should be hibernating
    expect(await vault.vaultStatus(user.address)).to.equal(1); // HIBERNATING
  });

  it("should recover from hibernation after paying debt", async () => {
    // ... set up hibernating vault first ...
    
    // Calculate debt: 2 months * 30 MTAA = 60 MTAA
    const debt = ethers.parseUnits("60", 18);
    await mtaa.approve(vault.address, debt);
    
    await vault.resumeFromHibernation();
    
    expect(await vault.vaultStatus(user.address)).to.equal(0); // ACTIVE
  });

  it("should prevent operations during hibernation", async () => {
    // ... set up hibernating vault ...
    
    // Try to withdraw - should fail
    await expect(vault.withdraw(usdc50, user.address, user.address))
      .to.revertedWith("Vault is hibernating");
  });

  it("should not allow more than 5 vaults per DAO", async () => {
    // Try to spawn 6 vaults - 6th should fail
    for (let i = 0; i < 5; i++) {
      await vaultFactory.deployVault(...);
    }
    
    await expect(vaultFactory.deployVault(...))
      .to.revertedWith("Max vaults per DAO reached");
  });
});
```

---

## Deployment Checklist (Phase 1)

- [ ] **Contract Changes**
  - [ ] Update MaonoVault.sol with MTAA costs
  - [ ] Update MaonoVaultFactory.sol with vault type support
  - [ ] Update DAO contract with vault counting
  - [ ] Compile and verify no errors

- [ ] **Testing**
  - [ ] Write spawn cost unit tests (✓ see above)
  - [ ] Write upkeep collection tests
  - [ ] Write hibernation tests
  - [ ] Write vault cap tests
  - [ ] Integration test: DAO → Factory → Vault → Costs

- [ ] **Deployment Process**
  - [ ] Deploy updated MaonoVault
  - [ ] Deploy updated MaonoVaultFactory
  - [ ] Verify factory can create vaults with costs
  - [ ] Point DAO contract to new factory

- [ ] **Frontend Updates**
  - [ ] Show vault type selector on create
  - [ ] Display spawn cost before confirmation
  - [ ] Show monthly upkeep amount
  - [ ] Add hibernation status indicator
  - [ ] Add "Resume Vault" button

- [ ] **Monitoring**
  - [ ] Track spawn cost collections
  - [ ] Track upkeep collections
  - [ ] Track burn vs. treasury splits
  - [ ] Track hibernated vs. active vaults

---

## Files to Create/Modify Summary

| File | Change | Priority |
|------|--------|----------|
| contracts/MaonoVault.sol | Add spawn cost, upkeep, hibernation | P1 |
| contracts/MaonoVaultFactory.sol | Add vault type support | P1 |
| contracts/MtaaGovernance.sol (or DAO) | Add vault counting | P1 |
| contracts/FeatureGate.sol | NEW - Feature access control | P2 |
| contracts/PremiumDAOFeatures.sol | NEW - DAO governance upgrades | P2 |
| contracts/AgentPaymentGateway.sol | NEW - Agent fees | P3 |
| tests/MaonoVault.test.ts | Add monetization tests | P1 |

---

## Next: Phase 2 (Weeks 5-8)

Once Phase 1 is deployed and tested:

1. **Create FeatureGate.sol**: Core feature access control
2. **Create PremiumDAOFeatures.sol**: DAO governance upgrades  
3. **Wire Features to Gates**: Analytics, weighted voting, etc.
4. **Frontend Integration**: Feature unlock modals

See MONETIZATION_STRATEGY_COMPREHENSIVE.md for Phase 2-5 details.

