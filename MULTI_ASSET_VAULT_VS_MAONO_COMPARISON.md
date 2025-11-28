# MultiAssetVault vs MaonoVault: Comprehensive Comparison

## Overview

You have **TWO different vault architectures** designed for different use cases:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VAULT ARCHITECTURE COMPARISON                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  MAONO VAULT (Flagship Professional Manager)                     │
│  └─ Professional managed fund for DAOs                           │
│  └─ ERC4626 standard (tokenized vault)                           │
│  └─ Focus: High-performance investing with manager fees          │
│  └─ Use Case: Professional wealth management                     │
│  └─ Assets: Single base asset (cUSD, USDC, etc.)               │
│  └─ Manager: Institutional-grade (1 dedicated manager)           │
│  └─ Fee: 15% on profits + 2% annual management                  │
│                                                                   │
│  MULTI-ASSET VAULT (Community Investment Pool)                  │
│  └─ DAO-managed investment pool                                  │
│  └─ Community voting on allocations                              │
│  └─ Focus: Pooled community investing                            │
│  └─ Use Case: Crypto asset diversification                       │
│  └─ Assets: MULTIPLE assets (BTC, ETH, XRP, etc.)              │
│  └─ Manager: DAO governance                                      │
│  └─ Fee: Performance fee only (2%)                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Comparison

### 1. **Core Architecture**

| Feature | MaonoVault | MultiAssetVault |
|---------|-----------|-----------------|
| Standard | ERC4626 (vault standard) | ERC20 (simple token) |
| Asset Type | Single base asset (cUSD) | Multiple assets (BTC, ETH) |
| Share Pricing | Dynamic (NAV-based) | Simple (TVL-based) |
| Management | Professional manager | DAO governance |
| Complexity | Advanced | Beginner-friendly |

### 2. **Asset Handling**

#### MaonoVault
```solidity
// Single underlying asset
address public asset;  // cUSD, USDC, etc.

// Manager invests that asset into:
- Aave (earn yield)
- Uniswap (LP positions)
- Cross-chain pools
- Strategy contracts

// Share price = TVL / Total Shares
// TVL includes ALL positions converted to base asset
```

#### MultiAssetVault
```solidity
// Multiple underlying assets stored DIRECTLY in vault
address public wBTC;   // Bitcoin held in vault
address public wETH;   // Ethereum held in vault

// Asset allocation defined by DAO
btcAllocation = 5000;  // 50%
ethAllocation = 5000;  // 50%

// Share price = (BTC value + ETH value) / Total Shares
// Users can SEE the exact assets they own
```

---

### 3. **Use Cases**

#### MaonoVault Best For:
```
✅ Professional fund management
✅ Complex strategies (AI, hedging, arbitrage)
✅ Institutional investors
✅ Long-term wealth building
✅ Performance-based incentives
✅ Manager expertise + transparency

Example: "Institutional manager uses our $10M in cUSD
to execute proprietary trading strategies and earn 15% 
on profits"
```

#### MultiAssetVault Best For:
```
✅ Community investment pools
✅ Asset diversification
✅ Transparent asset holdings
✅ Decentralized governance
✅ Retail investors
✅ Simple, understandable investing

Example: "1000 community members pool $1M to hold
50% BTC and 50% ETH, vote on allocations, earn fees"
```

---

## How Assets Are Acquired: Your Question

### The KEY Difference in Asset Acquisition

#### MaonoVault Flow:
```
User deposits cUSD → Vault receives cUSD
                   → Manager deploys cUSD
                   → Manager can convert to other assets
                   → NAV tracks ALL positions (via reportPositionValue)

Manager Strategy Example:
1. Receive 1000 cUSD
2. Swap 600 cUSD → 0.3 BTC (via DEX)
3. Swap 400 cUSD → 0.2 ETH (via DEX)
4. Earn yield on positions
5. Report NAV: 0.3 BTC + 0.2 ETH = $1000 value
6. Users' shares now own this mixed portfolio
```

#### MultiAssetVault Flow (Current):
```
User deposits USD VALUE (in stablecoin)
                   → Gets converted to multiple assets
                   → Vault holds the actual tokens
                   → Users can SEE their holdings

Current Implementation:
1. User sends cUSD via invest() call
2. Contract receives USD amount (NO ACTUAL TRANSFER in v1)
3. TVL increases
4. Shares minted based on TVL
5. Rebalance() SHOULD swap to BTC/ETH (not implemented yet)
```

**⚠️ CURRENT ISSUE:** MultiAssetVault doesn't actually acquire the assets!

---

## Asset Acquisition Methods - Your Answer

You asked: **"How are assets acquired - through swaps? Order routing? LP? DEX Swap?"**

### Answer: **Multiple Methods Depending on Use Case**

#### Method 1: DEX Swaps (Simplest - Recommended for v1)
```solidity
// Example: Convert cUSD to BTC via Uniswap

interface IUniswapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

function acquireAsset(
    address tokenIn,
    address tokenOut,
    uint256 amount,
    uint256 minAmount
) public onlyRole(MANAGER_ROLE) {
    IUniswapRouter router = IUniswapRouter(UNISWAP_ROUTER);
    
    address[] memory path = new address[](2);
    path[0] = tokenIn;   // cUSD
    path[1] = tokenOut;  // wBTC
    
    IERC20(tokenIn).approve(UNISWAP_ROUTER, amount);
    router.swapExactTokensForTokens(
        amount,
        minAmount,
        path,
        address(this),
        block.timestamp + 300
    );
}
```

#### Method 2: Order Routing (Best Execution - For Later)
```solidity
// Route through multiple DEXs to find best price
// Example: 0x protocol, 1inch API

// Find best swap across DEXs:
- Uniswap V3 (0.3 BTC for cUSD)
- Curve (0.25 BTC for cUSD)
- Balancer (0.28 BTC for cUSD)
// → Use Uniswap V3 (best)

// Implementation via 0x or similar
function acquireAssetBestExecution(
    address tokenIn,
    address tokenOut,
    uint256 amount
) public onlyRole(MANAGER_ROLE) {
    // Call 0x API to find best swap
    // Execute swap with highest output
}
```

#### Method 3: Liquidity Pool Provision
```solidity
// Provide liquidity to earn swap fees

function provideLiquidityAndEarn(
    address token0,
    address token1,
    uint256 amount0,
    uint256 amount1
) public onlyRole(MANAGER_ROLE) {
    // Add liquidity: cUSD + wBTC
    // Earn protocol fees on swaps through the pool
    // Earn trading fees (0.05% - 1% depending on tier)
}
```

#### Method 4: LP with Revenue Share
```solidity
// Provide liquidity and earn % of pool fees

function addLPAndEarn(
    address pool,
    uint256 lpAmount
) public onlyRole(MANAGER_ROLE) {
    // Users own % of LP position
    // Earn swap fees automatically
    // Share price increases as fees accrue
}
```

### Recommendation for MultiAssetVault v1:
**Use DEX Swaps (Method 1)** because:
- ✅ Simplest to implement
- ✅ Direct asset acquisition
- ✅ Transparent pricing
- ✅ No complex routing needed
- ⏸️ Add order routing (Method 2) in v2

---

## Your 11 Proposed Assets

Let me analyze your list for MultiAssetVault:

```
Proposed Assets for MultiAssetVault:
1. ✅ XRP      - Major, liquid, cross-chain bridge friendly
2. ✅ TRX      - Good liquidity, Asian market strong
3. ✅ DOGE     - High volume, good for retail appeal
4. ✅ CELO     - Native chain, strategic
5. ✅ SOL      - Major ecosystem, good for diversification
6. ✅ AAVE     - Defi protocol token, governance value
7. ✅ LTC      - Bitcoin's sister, strong alternative
8. ✅ XLM      - Payment focus, remittance friendly
9. ✅ BNB      - Binance ecosystem, major DEX liquidity
10. ✅ MATIC   - Layer 2, strong in Africa/emerging markets
11. ✅ TON     - Emerging, telegram ecosystem

Current: BTC, ETH (2 assets)
Proposed: 13 total assets
```

### Phased Rollout Recommendation:

```
PHASE 1 (MVP - MVP Access):
├─ BTC (Bitcoin) - Store of value anchor
├─ ETH (Ethereum) - DeFi hub
└─ CELO (Celo) - Native asset

PHASE 2 (Beta - Top DAOs):
├─ Previous
├─ SOL (Solana) - Major ecosystem
├─ MATIC (Polygon) - Layer 2 scaling
└─ BNB (Binance) - Exchange ecosystem

PHASE 3 (Full Launch):
├─ All Phase 2
├─ AAVE (Protocol token)
├─ XRP (Cross-chain)
├─ LTC (Alternative store)
└─ TRX (Emerging markets)

PHASE 4 (Extended - Post-MVP):
├─ All Phase 3
├─ DOGE (Community token)
├─ XLM (Remittances)
└─ TON (Telegram ecosystem)
```

---

## Key Parameters You Need to Configure

### 1. **TVL (Total Value Locked) - TRACKED**
```solidity
uint256 public totalValueLocked;  // Already exists
// Sum of all assets in USD equivalent
// Updated on each deposit/withdrawal
```

### 2. **Performance Fee - CONFIGURABLE**
```solidity
uint256 public performanceFee = 200;  // 2% (basis points)
// Can be adjusted via setPerformanceFee()
// Charged on withdrawal

function setPerformanceFee(uint256 newFee) 
    external onlyRole(MANAGER_ROLE) 
{
    require(newFee <= 1000, "Max 10%");
    performanceFee = newFee;
}
```

### 3. **Minimum Investment - CONFIGURABLE**
```solidity
uint256 public minimumInvestment = 10 * 1e8;  // $10 USD
// Prevents dust deposits
// Configurable via setMinimumInvestment()
```

### 4. **Fee Collection - IMPLEMENTED**
```solidity
address public feeCollector;  // DAO Treasury
// Receives performance fees
```

### 5. **Min Share & USD Value - BASED ON SHARE CALCULATION**
```solidity
// Current implementation:
sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;

// Share price = totalValueLocked / totalSupply();

// Example:
// Initial: 1 user deposits $100
//   → totalValueLocked = 100
//   → totalSupply = 100 shares
//   → sharePrice = 100/100 = $1/share

// User 2 deposits $100
//   → sharesMinted = (100 * 100) / 100 = 100 shares
//   → totalValueLocked = 200
//   → sharePrice = 200/200 = $1/share

// After $20 profit:
//   → totalValueLocked = 220
//   → sharePrice = 220/200 = $1.10/share
//   → User 1's value: 100 shares × $1.10 = $110
```

---

## Current Implementation vs. Your Needs

### What's DONE ✅
```
✅ Share calculation (ERC20 based)
✅ Basic invest/withdraw
✅ Performance fee charging
✅ Minimum investment check
✅ Asset allocation tracking (BTC/ETH %)
✅ TVL tracking
✅ User investment history
✅ Fee collector address
```

### What's MISSING ⚠️
```
⚠️ Actual asset acquisition (swaps not implemented)
⚠️ Oracle price feeds (hardcoded pricing)
⚠️ Rebalancing logic (empty function)
⚠️ Multi-asset withdrawal (only TVL-based)
⚠️ Admin/governance controls for asset additions
⚠️ Emergency withdrawal functions
⚠️ Timelock on manager functions
```

---

## Your Deployment Plan

```
📋 DEPLOYMENT ROADMAP

1️⃣ MVP PHASE (Internal Testing)
   └─ Assets: BTC, ETH, CELO (3)
   └─ Access: Internal team only
   └─ Status: Test on Celo Alfajores

2️⃣ BETA PHASE (Top DAOs)
   └─ Assets: Add SOL, MATIC, BNB (6 total)
   └─ Access: Invite-only, top DAOs
   └─ Status: Celo mainnet, capped TVL
   └─ Goal: Get feedback on multi-asset mechanics

3️⃣ FULL LAUNCH (Public)
   └─ Assets: Add all 11+ assets (13 total)
   └─ Access: Public
   └─ Status: Full production
   └─ Goal: Major community adoption

4️⃣ EXPANSION (Future)
   └─ Add options/derivatives
   └─ Add cross-chain rebalancing
   └─ Add leverage/farming strategies
```

---

## Summary: Quick Comparison

```
┌──────────────────────────────────────────────────────┐
│                 QUICK REFERENCE                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ MaonoVault:                                          │
│ ✓ Single asset (cUSD) + manager strategies          │
│ ✓ Professional fund structure                        │
│ ✓ ERC4626 standard (advanced)                        │
│ ✓ High fees (15% on profits)                         │
│ ✓ For: Institutional wealth management              │
│                                                      │
│ MultiAssetVault:                                     │
│ ✓ Multiple assets (BTC, ETH, etc.)                  │
│ ✓ Community pool structure                           │
│ ✓ ERC20 standard (simple)                            │
│ ✓ Lower fees (2% performance only)                  │
│ ✓ For: Community investment diversification         │
│                                                      │
│ Your Use: Investment Pools Feature                  │
│ → MultiAssetVault is the RIGHT choice               │
│ → Users pool funds                                   │
│ → Invest in top assets                              │
│ → Earn diversified returns                          │
│ → Governance decides allocations                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Add 11 Assets to MultiAssetVault** (Contract update)
2. **Implement DEX Swap Integration** (Asset acquisition)
3. **Add Oracle Price Feeds** (Accurate TVL calculation)
4. **Implement Rebalancing Logic** (Maintain target allocations)
5. **Add Governance Controls** (DAO voting on changes)
6. **Deploy to Testnet** (Internal testing)
7. **Beta Launch** (Top DAOs only)
8. **Full Production Launch** (Public access)

