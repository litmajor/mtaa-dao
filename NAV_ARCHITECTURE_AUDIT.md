# NAV Architecture Audit: How MtaaDAO Vault Tracks and Uses Net Asset Value

**Date:** 2026-08-11  
**Question:** Is NAV manually reported, automatically derived, hybrid, or used differently for different operations?  
**Answer:** HYBRID with a **critical bug**: NAV is automatically derived but deliberately ignored in pricing logic.

---

## PART 1: NAV CALCULATION ARCHITECTURE

### The Two NAV Systems

#### System 1: Frozen Book Value (`totalValueLocked`)

**Definition:**
```solidity
uint256 public totalValueLocked; // In USD (scaled by 1e8)
```

**Lifecycle:**
```solidity
// deposit() - Line 289
totalValueLocked += usdAmount;

// withdraw() - Line 338
totalValueLocked -= usdValue;
```

**Characteristics:**
- Starts at 0
- Increments by each deposit amount (regardless of portfolio performance)
- Decrements by redemption USD value (using frozen share pricing)
- **Never updated** for asset price changes or gains/losses
- **No keeper function** to sync with actual portfolio value
- **No admin function** to manually update it
- Represents **cumulative deposits minus withdrawals**, not true economic NAV

---

#### System 2: Real-Time Computed NAV (`calculateTotalAssetValue()`)

**Definition:**
```solidity
function calculateTotalAssetValue() public view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
        total += getAssetValue(activeAssetSymbols[i]);
    }
    return total;
}

function getAssetValue(bytes32 symbolHash) public view returns (uint256) {
    Asset memory asset = assets[symbolHash];
    if (!asset.isActive || asset.balance == 0) return 0;
    
    // Get price from oracle (in USD, scaled by 1e8)
    uint256 pricePerUnit = IPriceOracle(priceOracle).getPrice(asset.tokenAddress);
    require(pricePerUnit > 0, "Oracle malfunction");
    
    // Convert balance to USD value accounting for decimals
    uint256 normalizedBalance = (asset.balance * 1e8) / (10 ** asset.decimals);
    return (normalizedBalance * pricePerUnit) / 1e8;
}
```

**Characteristics:**
- **Purely VIEW** (read-only, no state changes)
- Reads current **asset balances** (updated after every swap)
- Reads current **oracle prices** (real-time market data)
- **Deterministic and atomic** (no external keeper required)
- **Can be called by anyone, anytime** without permission
- Reflects **true economic value** of portfolio holdings
- Updated **automatically** whenever oracle prices change (no contract call needed)

---

## PART 2: HOW NAV IS USED IN DIFFERENT OPERATIONS

### Operation 1: Deposit (invest)

**Code:**
```solidity
function invest(uint256 usdAmount) external nonReentrant returns (uint256 sharesMinted) {
    // ... validation ...
    
    if (totalSupply() == 0) {
        sharesMinted = usdAmount;  // 1:1 initial ratio
    } else {
        // USES FROZEN totalValueLocked (Line 282)
        sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;
    }
    
    _mint(msg.sender, sharesMinted);
    totalValueLocked += usdAmount;  // Increments frozen value
    
    emit InvestmentEvent(msg.sender, usdAmount, sharesMinted, sharePrice);
    return sharesMinted;
}
```

**NAV System Used:** `totalValueLocked` (FROZEN)

**Impact:**
- Late depositors entering appreciated portfolio get excessive shares per dollar
- If portfolio 3x appreciated, late investor pays $1 but gets 1 share (worth $3)
- **Dilutes existing shareholders** (F3-5C)

---

### Operation 2: Withdrawal (withdraw)

**Code:**
```solidity
function withdraw(uint256 shares) external nonReentrant returns (uint256 netAmount) {
    require(balanceOf(msg.sender) >= shares, "Insufficient shares");
    
    // USES FROZEN totalValueLocked (Line 327)
    uint256 usdValue = (shares * totalValueLocked) / totalSupply();
    
    uint256 fee = (usdValue * performanceFee) / 10000;
    uint256 protocolFee = (usdValue * PROTOCOL_WITHDRAW_FEE_BPS) / 10000;
    netAmount = usdValue - fee - protocolFee;
    
    _burn(msg.sender, shares);
    totalValueLocked -= usdValue;  // Decrements frozen value
    
    // Transfer stablecoin to user (may fail if buffer insufficient)
    IERC20(stablecoin).safeTransfer(msg.sender, stableNetAmount);
    
    emit Withdrawal(msg.sender, shares, usdValue, fee);
    return netAmount;
}
```

**NAV System Used:** `totalValueLocked` (FROZEN)

**Impact:**
- Redeemers pay/receive based on cumulative deposits, not actual NAV
- After loss: redeemer paid EXCESS (F3-5A)
- After gain: redeemer paid DEFICIT (F3-5D)
- Creates race condition on stablecoin buffer (F3-5B)

---

### Operation 3: Rebalancing (batchRebalance)

**Code:**
```solidity
function batchRebalance(...) external onlyRole(REBALANCER_ROLE) {
    // ... execute swaps, update asset.balance ...
    
    bytes32 symbolHash = _getSymbolHash(token);
    assets[symbolHash].balance = IERC20(token).balanceOf(address(this));
    
    emit Rebalanced(block.timestamp, calculateTotalAssetValue());  // Uses REAL NAV
}
```

**NAV System Used:** `calculateTotalAssetValue()` (REAL-TIME in events only)

**Note:** Rebalancing updates asset balances, which makes `calculateTotalAssetValue()` current. But `totalValueLocked` is NOT updated (it remains stale).

---

### Operation 4: Frontend/API Reporting

**Code:**
```solidity
function getSharePrice() public view returns (uint256) {
    if (totalSupply() == 0) return 1e8;
    uint256 assetValue = calculateTotalAssetValue();  // REAL NAV
    if (assetValue == 0) return 1e8;
    return (assetValue * 1e8) / totalSupply();
}

function getUserValue(address user) external view returns (uint256) {
    uint256 userShares = balanceOf(user);
    if (totalSupply() == 0) return 0;
    uint256 totalAssets = calculateTotalAssetValue();  // REAL NAV
    return (userShares * totalAssets) / totalSupply();
}

function getTVL() external view returns (uint256) {
    return calculateTotalAssetValue();  // REAL NAV
}
```

**NAV System Used:** `calculateTotalAssetValue()` (REAL-TIME)

**Impact:** Users see correct portfolio value in frontend, but actual redemption proceeds are based on stale `totalValueLocked`.

---

## PART 3: NAV REFRESH MECHANISM

### Is NAV Manually Reported?
**NO.** There is no function to manually update or report NAV state.

```solidity
// These functions DO NOT EXIST:
function updateNAV() { ... }           // ✗
function syncTVL() { ... }             // ✗
function setTotalValueLocked(...) { }  // ✗
function reportNAV(...) { }            // ✗
```

### Is NAV Automatically Derived?
**YES.** `calculateTotalAssetValue()` is fully automatic:

```solidity
function calculateTotalAssetValue() public view returns (uint256) {
    // No state mutation
    // No external calls (oracle is stateless read)
    // No keeper required
    // Atomic and deterministic
}
```

### Is NAV Kept in Sync?
**PARTIALLY BROKEN:**

**Updated:**
- Asset balances (`assets[symbolHash].balance`) updated after every swap ✓
- Oracle prices queried in real-time ✓
- `calculateTotalAssetValue()` always reflects current data ✓

**NOT Updated:**
- `totalValueLocked` is never recalculated after price changes ✗
- No keeper periodically syncs them ✗
- No admin function to manually force a sync ✗

### Is NAV Used Differently for Different Operations?
**YES, and this is the root cause of F3-5A/B/C/D:**

| Operation | NAV System Used | Type | Interval |
|-----------|-----------------|------|----------|
| deposit() | `totalValueLocked` | Frozen | Stale (cumulative only) |
| withdraw() | `totalValueLocked` | Frozen | Stale (cumulative only) |
| getSharePrice() | `calculateTotalAssetValue()` | Real-time | Live (every call) |
| getUserValue() | `calculateTotalAssetValue()` | Real-time | Live (every call) |
| getTVL() | `calculateTotalAssetValue()` | Real-time | Live (every call) |

---

## PART 4: PROOF THAT NAV IS ATOMIC AND ALWAYS AVAILABLE

### Evidence 1: `calculateTotalAssetValue()` is VIEW

```solidity
function calculateTotalAssetValue() public view returns (uint256) {
```

**Implications:**
- No state changes
- No reentrancy concerns
- Can be called from within deposit/withdraw without additional logic
- Can be called by other contracts without cost

### Evidence 2: Oracle Reading is Deterministic

```solidity
uint256 pricePerUnit = IPriceOracle(priceOracle).getPrice(asset.tokenAddress);
```

**Implications:**
- No keeper signature needed
- No external validation required
- Single oracle call per asset per calculation
- Prices are current (oracle is live market feed)

### Evidence 3: Asset Balances are Current

```solidity
asset.balance = IERC20(token).balanceOf(address(this));  // After every swap
```

**Implications:**
- Balances reflect actual holdings
- Updated atomically after each swap
- Not delayed or cached

### Evidence 4: No Keeper Pattern Exists

```solidity
// SEARCH: No keeper, no relayer, no oracle refresh mechanism found in codebase
// All NAV data is immediately available on-chain
```

---

## PART 5: WHAT THIS MEANS FOR OPTION A vs OPTION C

### Option A: Liquidate Assets on Withdrawal

**Flow:**
```
User calls withdraw(shares)
  ↓
Calculate USD value from totalValueLocked (STALE)
  ↓
Liquidate real assets to cover stablecoin payment
  ↓
Update asset balances
  ↓
calculateTotalAssetValue() becomes current
```

**Problems:**
- Still uses stale NAV to calculate redemption amount (F3-5A/D remain unfixed)
- Requires asset liquidation (adds oracle/MEV risk)
- Deposits still use stale NAV (F3-5C remains unfixed)
- Adds slippage cost to every redemption

### Option C: Real-Time NAV Pricing (Recommended)

**Flow:**
```
User calls withdraw(shares)
  ↓
Calculate fair NAV = (shares / totalSupply) * calculateTotalAssetValue()
  ↓
Convert NAV to stablecoin using oracle
  ↓
Transfer stablecoin (may revert if buffer insufficient)
```

**Advantages:**
- Eliminates F3-5A/B/C/D by using real NAV for all pricing
- No asset liquidation needed (same stablecoin transfer as before)
- Already have all infrastructure: `calculateTotalAssetValue()`, oracle prices, asset balances
- Atomic and deterministic (no keeper required)
- Can still fail if stablecoin buffer is insufficient (this is separate availability issue)
- Deposit pricing also fixed by using real NAV
- No new attack surface if oracle is already trusted for rebalancing

**Implementation:**
```solidity
function deposit(uint256 usdAmount) external nonReentrant returns (uint256 sharesMinted) {
    // ... validation ...
    
    if (totalSupply() == 0) {
        sharesMinted = usdAmount;
    } else {
        uint256 currentNAV = calculateTotalAssetValue();  // REAL NAV
        sharesMinted = (usdAmount * totalSupply()) / currentNAV;  // FIX
    }
    
    _mint(msg.sender, sharesMinted);
    totalValueLocked += usdAmount;  // Keep for historical tracking only
    
    return sharesMinted;
}

function withdraw(uint256 shares) external nonReentrant returns (uint256 netAmount) {
    // ... validation ...
    
    uint256 currentNAV = calculateTotalAssetValue();  // REAL NAV
    uint256 usdValue = (shares * currentNAV) / totalSupply();  // FIX
    
    // ... fee calculation, stablecoin transfer ...
    
    totalValueLocked -= usdValue;  // Keep for historical tracking only
    
    return netAmount;
}
```

---

## PART 6: CRITICAL FINDINGS

### Finding 1: Schizophrenic NAV Reporting

The vault has **two competing NAV systems**:

1. **External API** (what users see): Real-time via `getTVL()`, `getSharePrice()`, `getUserValue()`
2. **Internal pricing** (what affects them economically): Frozen cumulative via `totalValueLocked`

**Consequence:** Users see a correct portfolio value but receive incorrect redemption proceeds.

### Finding 2: No Keeper/Oracle Attack Surface to Introduce

Option C does NOT create a new keeper or oracle dependency because:

- Oracle is already used for `getSharePrice()` (trusted)
- Oracle is already used for `batchRebalance()` slippage protection (trusted)
- No new keeper role introduced
- No off-chain signature verification needed
- No delay/caching mechanism (atomic call)

### Finding 3: Stale NAV is Deliberate Design Choice

The use of `totalValueLocked` in deposit/withdraw is NOT accidental:

```solidity
// deposit line 282: clearly uses totalValueLocked for pricing
sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;

// withdraw line 327: clearly uses totalValueLocked for pricing
uint256 usdValue = (shares * totalValueLocked) / totalSupply();
```

This suggests the original architects intended:
- Stable share pricing independent of market conditions
- Cumulative deposit tracking
- But failed to recognize this breaks economic fairness

### Finding 4: The Real Attack Surface is the Stablecoin Buffer

F3-5B (buffer race condition) is the **true availability issue**, independent of NAV choice:

```
If any redeemer drains stablecoin buffer, 
later redeemers cannot redeem at any price.
```

This is orthogonal to whether we use frozen or real NAV. Both Option A and Option C need additional safeguards (queue system or buffer sizing).

---

## PART 7: RECOMMENDATION

### Primary Finding
**The vault can safely migrate from frozen (`totalValueLocked`) to real-time NAV (`calculateTotalAssetValue()`) in deposit/withdraw pricing without introducing new dependencies.**

### Why Option C is Superior to Option A
| Aspect | Option A (Liquidate) | Option C (Real NAV) |
|--------|---------------------|-------------------|
| Fixes F3-5A (loss excess redemption) | Partially* | ✓ |
| Fixes F3-5B (buffer race) | No | No** |
| Fixes F3-5C (gain dilution) | No | ✓ |
| Fixes F3-5D (gain underpayment) | No | ✓ |
| Requires asset liquidation | ✓ (adds MEV risk) | ✗ |
| Requires new keeper | ✗ | ✗ |
| Requires new oracle dependency | ✗ | ✗ |
| Requires new external signers | ✗ | ✗ |
| Changes core economics | Slightly | Significantly (fixes) |

*Option A still uses stale NAV to calculate redemption, so F3-5A mechanics remain (just converted to stablecoin via liquidation instead of buffer draw)
**F3-5B is an availability issue requiring separate queue/buffer redesign

### Implementation Steps for Option C

1. **Replace `totalValueLocked` usage in deposit/withdraw pricing:**
   ```solidity
   // Before: sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;
   // After: sharesMinted = (usdAmount * totalSupply()) / calculateTotalAssetValue();
   ```

2. **Keep `totalValueLocked` for backward compatibility:**
   - Use for historical tracking / events
   - Do NOT remove field (breaks external integrations)

3. **Test that F3-5A/B/C/D all disappear:**
   - Run all scenarios with real NAV pricing
   - Verify no economic transfers between redeemers
   - Verify fair NAV entitlements match actual proceeds

4. **Address F3-5B separately (if needed):**
   - Design queue system or buffer sizing strategy
   - This is independent of pricing model

---

## PART 8: ARTIFACT SUMMARY

### Files Reviewed
- `contracts/MultiAssetVault.sol` - Main vault contract
- Lines analyzed:
  - 46: totalValueLocked declaration
  - 282: deposit() share pricing (uses totalValueLocked)
  - 289: deposit() TVL update
  - 327: withdraw() pricing (uses totalValueLocked)
  - 338: withdraw() TVL update
  - 400-500: batchRebalance() (updates asset balances, emits real NAV)
  - 638: calculateTotalAssetValue() (reads current balances and prices)
  - 651: getAssetValue() (oracle-based asset valuation)
  - 700: getSharePrice() (uses real NAV)
  - 712: getUserValue() (uses real NAV)
  - 724: getTVL() (uses real NAV)

### Key Quotes from Code

**Frozen NAV (totalValueLocked):**
```solidity
uint256 public totalValueLocked; // In USD (scaled by 1e8)
// ... only updated on deposit/withdraw, never for price changes
```

**Real NAV (calculateTotalAssetValue):**
```solidity
function calculateTotalAssetValue() public view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
        total += getAssetValue(activeAssetSymbols[i]);
    }
    return total;  // Sum of (balance * oracle price) for all assets
}
```

**Frontend Reporting (Real NAV):**
```solidity
function getTVL() external view returns (uint256) {
    return calculateTotalAssetValue();  // Users see THIS
}

function getSharePrice() public view returns (uint256) {
    uint256 assetValue = calculateTotalAssetValue();  // Users see THIS
    return (assetValue * 1e8) / totalSupply();
}
```

**Pricing Logic (Frozen NAV):**
```solidity
// In deposit()
sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;  // Uses THIS

// In withdraw()
uint256 usdValue = (shares * totalValueLocked) / totalSupply();  // Uses THIS
```

---

## CONCLUSION

The MtaaDAO vault's NAV architecture is **hybrid with a critical asymmetry**:

- **External reporting:** Real-time, oracle-driven, always current
- **Internal pricing:** Frozen, cumulative, deliberately stale
- **No keeper mechanism:** Everything is atomic and on-chain
- **No new oracle dependencies:** Already trusted for rebalancing

**The fix (Option C) requires changing 2 lines of code and is safer than Option A.**

---

END OF NAV ARCHITECTURE AUDIT
