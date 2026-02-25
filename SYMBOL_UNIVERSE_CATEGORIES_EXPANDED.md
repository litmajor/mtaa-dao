# Symbol Universe: Expanded Token Categories

## Executive Summary

**Before**: 8 categories  
**After**: 31+ token categories + intelligent categorization engine

The Symbol Universe now understands the full diversity of the crypto market and can intelligently classify, risk-score, and manage any token type.

---

## New Category System

### **Layer 1 & Layer 2 Networks**
- `l1` - Ethereum, Bitcoin, Solana (native chains) — Risk: 5/100
- `l2` - Arbitrum, Optimism, Polygon (layer 2s) — Risk: 15/100
- `sidechain` - Gnosis, zkSync, StarkNet — Risk: 20/100

### **Stablecoins & Pegged Assets**
- `stablecoin` - USDC, USDT, DAI (fiat-backed) — Risk: 5/100
- `algorithmic_stablecoin` - UST, FEI (algorithmic) — Risk: 50/100
- `rwa_stablecoin` - Real-world assets tokenized — Risk: 45/100

### **DeFi Protocol Tokens**
- `governance_token` - UNI, AAVE, COMP (governance voting) — Risk: 10/100
- `defi_token` - Generic DeFi protocol tokens — Risk: 25/100
- `protocol_token` - Token with multiple utility roles — Risk: 30/100
- `oracle_token` - LINK, API3, BAND (oracle networks) — Risk: 20/100
- `bridge_token` - Portal, Wormhole wrapped assets — Risk: 40/100

### **Liquidity & Yield**
- `lp_token` - Uniswap LP NFTs, Curve LP tokens — Risk: 35/100
- `liquid_staking` - stETH, rETH, cbETH (liquid staking derivatives) — Risk: 30/100
- `yield_token` - aUSDC, cDAI (yield-bearing tokens) — Risk: 35/100
- `rebasing_token` - OHM, gMEMO (rebase mechanics) — Risk: 50/100

### **Wrapped & Synthetic**
- `wrapped` - wETH, wBTC (simple wrapping) — Risk: 15/100
- `synthetic` - sUSD, synth assets — Risk: 40/100
- `derivative` - Perpetual futures tokens, options — Risk: 45/100
- `index_token` - DeFi index tokens, basket tokens — Risk: 35/100

### **Money Markets & Lending**
- `money_market` - AAVE, Compound (lending protocols) — Risk: 25/100
- `collateral` - Collateral-specific tokens — Risk: 30/100
- `lending_token` - Tokens specific to lending markets — Risk: 30/100

### **Specialized Categories**
- `meme_token` - DOGE, SHIB, community tokens — Risk: 70/100
- `gaming_token` - Axie, Sandbox, gaming ecosystems — Risk: 55/100
- `nft_related` - Tokens tied to NFT platforms — Risk: 60/100
- `utility_token` - Ticketing, access tokens — Risk: 40/100
- `fee_sharing` - Fee distribution tokens — Risk: 35/100
- `insurance_token` - Nexus, Unslashed (insurance) — Risk: 50/100
- `crosschain_token` - Multi-chain wrapped variants — Risk: 40/100
- `other` - Unknown or uncategorized — Risk: 60/100

---

## Category Intelligence Features

### **Risk Scoring by Category**

Each category has an inherent risk score (0-100) that affects KWETU execution validation:

```
Blue Chip (5-20):      l1, stablecoin, governance_token, oracle_token
Moderate (25-35):     defi_token, money_market, wrapped, yield_token
Higher Risk (40-50):  bridge_token, synthetic, derivative, insurance_token
Experimental (50+):   meme_token, gaming_token, algorithmic_stablecoin
```

### **Risk Multiplier Calculation**

```
multiplier = 1.0 + (categoryRiskScore / 100)

Example:
- USDC (stablecoin, 5/100)   → 1.05x multiplier
- ETH (l1, 5/100)             → 1.05x multiplier  
- UNI (defi_token, 25/100)    → 1.25x multiplier
- SHIB (meme_token, 70/100)   → 1.70x multiplier
```

Applied to base asset risk from intelligence shards:
```
Final Risk = (Base Risk Score × Category Multiplier) / 100
```

---

## New Methods for NURU & KWETU

### **Auto-Categorization**

```typescript
// Infer category from symbol + name
symbolUniverse.inferCategory('ARB', 'Arbitrum')
  → 'l2'

symbolUniverse.inferCategory('DOGE', 'Dogecoin')
  → 'meme_token'

// Get suggested categories
symbolUniverse.suggestCategories('ARB', 'Arbitrum')
  → ['l2', 'bridge_token', 'governance_token'] (top 3)
```

### **Category Filtering**

```typescript
// Get all tokens in a category
symbolUniverse.getAssetsByCategory('liquid_staking')
  → [stETH, rETH, cbETH, ...]

// Get multiple categories
symbolUniverse.getAssetsByCategories(['stablecoin', 'l1'])
  → [ETH, BTC, USDC, DAI, ...]

// Safe categories only (for conservative DAOs)
symbolUniverse.getAssetsByCategories(
  symbolUniverse.getSafeCategories()
)
  → [ETH, USDC, DAI, UNI, AAVE, ...]
```

### **Risk Analysis**

```typescript
// Get category risk score
symbolUniverse.getCategoryRiskScore('liquid_staking')
  → 30

// Get risk multiplier
symbolUniverse.getCategoryRiskMultiplier('meme_token')
  → 1.70

// Check if high risk
symbolUniverse.isHighRiskCategory('algorithmic_stablecoin')
  → true
```

### **Portfolio Composition Analysis**

```typescript
// Analyze portfolio category composition
const composition = symbolUniverse.analyzeCategoryComposition(
  ['ETH', 'USDC', 'UNI', 'SHIB']
);

// Output:
[
  { category: 'l1', count: 1, avgRisk: 5, symbols: ['ETH'] },
  { category: 'stablecoin', count: 1, avgRisk: 5, symbols: ['USDC'] },
  { category: 'governance_token', count: 1, avgRisk: 10, symbols: ['UNI'] },
  { category: 'meme_token', count: 1, avgRisk: 70, symbols: ['SHIB'] }
]
```

Used by NURU to understand:
- Overall portfolio risk profile
- Concentration risk
- Asset mix alignment with DAO risk tolerance

### **Safe Alternatives**

```typescript
// Find safer alternative in same use case
symbolUniverse.findSaferAlternativesInCategory('SHIB', 'defi_token')
  → [UNI, AAVE, CRV, SUSHI, LIDO]

// Used by NURU when suggesting "safer alternatives"
```

---

## Integration with KWETU Execution

### **Execution Risk Assessment**

```typescript
// In TreasuryExecutionRouter.planExecution():

const riskScore = calculateBaseRisk(asset);  // From intelligence shards
const categoryMultiplier = symbolUniverse.getCategoryRiskMultiplier(asset.category);
const adjustedRisk = (riskScore × categoryMultiplier) / 100;

if (adjustedRisk > maxAllowedRisk) {
  return ExecutionPlan { status: 'rejected', reason: 'Category risk too high' };
}
```

### **Execution Quality Scoring**

Category risk contributes to overall execution quality:

```
Execution Quality Score = 100
  - (Category Risk × 0.3)    // 30% weight
  - (Slippage × 0.3)         // 30% weight  
  - (Oracle Risk × 0.2)      // 20% weight
  - (Liquidity Risk × 0.2)   // 20% weight

Minimum threshold: 40/100
```

---

## Discovery & Categorization Workflow

When a new token is discovered via CCXT/Uniswap:

```
1. Symbol discovered (e.g., "ARB")
   ↓
2. Auto-infer category
   symbolUniverse.inferCategory("ARB", "Arbitrum")
   ↓
3. Register with category
   registerAsset("ARB", {
     symbol: "ARB",
     category: "l2",        ← Auto-inferred
     tier: "tier_2",        ← From liquidity
     riskProfile: "established"
   })
   ↓
4. Get secondary suggestions
   categories = suggestCategories("ARB", "Arbitrum")
   ↓
5. Store as tags for enrichment
   metadata.tags = ["bridge_token", "governance_token"]
   ↓
6. NURU/KWETU can use for context
```

---

## Tier vs Category: Key Difference

| Dimension | Tier (1-4) | Category (31+) |
|-----------|-----------|----------------|
| **Purpose** | Market maturity | Functional type |
| **Governance** | Market cap, volume, adoption | Token mechanics, use case |
| **Examples** | tier_1: ETH, BTC, USDC | l1, governance_token, yield_token |
| **Risk Factor** | Market adoption (5-100 score) | Functional complexity (5-70 score) |
| **Update Freq** | Less frequent (quarterly) | Dynamic (on discovery) |

---

## Examples: Real Token Classification

### ETH (Ethereum)
```typescript
{
  symbol: 'ETH',
  category: 'l1',
  tier: 'tier_1',
  riskProfile: 'blue_chip',
  riskScore: 5,      // l1 category risk
  tags: ['governance_token']  // Secondary suggestion
}
```

### stETH (Lido Staking)
```typescript
{
  symbol: 'stETH',
  category: 'liquid_staking',
  tier: 'tier_2',
  riskProfile: 'established',
  riskScore: 30,     // liquid_staking risk
  tags: ['yield_token', 'wrapped']
}
```

### UNI (Uniswap Governance)
```typescript
{
  symbol: 'UNI',
  category: 'governance_token',
  tier: 'tier_2',
  riskProfile: 'established',
  riskScore: 10,     // governance_token risk
  tags: ['defi_token', 'protocol_token']
}
```

### SHIB (Meme Token)
```typescript
{
  symbol: 'SHIB',
  category: 'meme_token',
  tier: 'tier_3',
  riskProfile: 'emerging',
  riskScore: 70,     // meme_token risk (HIGH)
  tags: ['defi_token']
}
```

---

## Statistics & Reporting

```typescript
symbolUniverse.getStats() returns:

{
  totalAssets: 1024,
  hardcodedAssets: 20,
  discoveredAssets: 1004,
  
  byCategory: {
    'l1': 12,
    'stablecoin': 45,
    'governance_token': 23,
    'defi_token': 523,
    'meme_token': 156,
    'gaming_token': 78,
    ... // all categories
  },
  
  byTier: {
    'tier_1': 8,
    'tier_2': 156,
    'tier_3': 234,
    'tier_4': 626
  },
  
  totalDeployments: 3421,
  lastSyncedAt: 1708366800
}
```

NURU can use this to:
- Understand market composition
- Identify emerging sectors
- Suggest diversification strategies

---

## Next Steps

1. ✅ **Categorization Engine** - Auto-infer from symbol + name
2. ✅ **Risk Scoring** - Per-category risk multipliers
3. ✅ **Category Analysis** - Portfolio composition analysis
4. 🔄 **CoinGecko Integration** - Enrich discovered tokens with official categories
5. 🔄 **Subgraph Integration** - Query on-chain data for precise categorization
6. 🔄 **Community Scoring** - Integrate governance analysis for tier refinement

---

## Summary

Symbol Universe now provides:
- **31+ token categories** covering entire DeFi ecosystem
- **Intelligent auto-categorization** of newly discovered tokens
- **Risk scoring by category** for KWETU execution validation
- **Portfolio analysis** for NURU recommendations
- **Safe alternative suggestions** for risk management

This enables NURU & KWETU to make smart decisions about any token, not just pre-hardcoded ones.
