# Treasury Architecture: Layer 3 Plugs Into Layer 1

## The Relationship

**Layer 1** (treasury.config.ts) = **Allowed capabilities**  
**Layer 3** (treasury-intelligence.ts) = **Smart reasoning about allowed capabilities**

They work **together**, not separately.

---

## How Layer 3 Extends Layer 1

### Layer 1: Defines What's Possible

```typescript
// Layer 1 says: "Collective DAO can have..."
collective: {
  defaultChains: ['CELO', 'ETH'],
  supportedAssets: [
    { symbol: 'CELO', ... },
    { symbol: 'cUSD', ... },
    { symbol: 'USDC', ... },
    { symbol: 'DAI', ... }
  ],
  multisigRequired: true,
  customTokenAllowed: true,
  votingWeightSource: ['tokenHolding', 'deposit']
}

// Translation: "You CAN have these."
```

### Layer 3: Understands What You SHOULD Do

```typescript
// Layer 3 analyzes the actual treasury and says:

classifyAsset('CELO') → {
  assetClass: 'volatile',
  riskProfile: 'high',
  volatilityScore: 75
}

classifyAsset('cUSD') → {
  assetClass: 'stable',
  riskProfile: 'low',
  volatilityScore: 2
}

// Translation: "Here's what they MEAN strategically."
```

---

## Example: Collective DAO Setup

### Step 1: User Selection

```
User: "I want a Collective DAO"
Layer 1: "You can have CELO + cUSD + USDC + DAI, 
         multisig required, 2-5 signers"
User: "I'll use CELO + cUSD"
```

### Step 2: Layer 1 Validation

```typescript
const config = getTreasuryConfigForDAOType('collective');
const validation = validateTreasuryConfiguration({
  daoType: 'collective',
  selectedAssets: [CELO, cUSD],
  multisigEnabled: true,
  multisigSigners: ['elder1', 'elder2', 'elder3']
});

// ✅ Valid - matches Layer 1 rules
```

### Step 3: Treasury Created

```typescript
const treasury = createDefaultTreasury('dao-123', 'collective', [CELO, cUSD]);
// {
//   daoType: 'collective',
//   assets: [
//     { symbol: 'CELO', balance: '0', ... },
//     { symbol: 'cUSD', balance: '0', ... }
//   ],
//   multisigRequired: true,
//   minSigners: 2
// }
```

### Step 4: Layer 3 Intelligence Kicks In

```typescript
const intel = generateTreasuryIntelligence(treasury, priceData);

// Intelligence understands:
intel.crossChainState.exposureByAssetClass = {
  volatile: { /* CELO data */ },
  stable: { /* cUSD data */ }
}

intel.behavior.mode = 'accumulative';  // Collective DAOs accumulate by default

intel.semanticSummary.treasuryCharacter = 'conservative';  // High stable %

intel.recommendedGovernanceFormula = 'timeWeighted';  // Long-term holders matter

intel.risks = [
  "Single-chain (CELO) - add ETH diversification"
];

intel.opportunities = [
  "Yield available on cUSD (Aave)",
  "Add Ethereum assets for cross-chain balance"
];
```

### Step 5: Cognition Layer (Future)

```typescript
// Based on Layer 3 intelligence:

if (intel.behavior.mode === 'accumulative' && 
    intel.exposures().stable > 70) {
  // Recommend: Activate yield
  recommendStrategy({
    type: 'yield',
    asset: 'cUSD',
    pool: 'Aave cUSD v3',
    allocation: 0.5,  // 50% to yield
    reasoning: intel.opportunities[0]
  });
}

if (intel.isFragmented() || intel.chainWithLargestSharePercent > 90) {
  // Recommend: Diversify to ETH
  recommendStrategy({
    type: 'multiChain',
    action: 'addAsset',
    asset: 'USDC',
    chain: 'ETH',
    reasoning: intel.risks[0]
  });
}
```

---

## Mapping: Layer 1 Rules → Layer 3 Intelligence

### Free DAO

| Layer 1 Rule | Layer 3 Understanding | Layer 3 Output |
|---|---|---|
| CELO only | Single volatile asset | Volatile, speculative |
| cUSD + CELO | Limited stability | Can be static if mostly cUSD |
| Optional multisig | Simple governance | Equal voting recommended |
| Single chain | No fragmentation issues | Consolidated exposure |

```
Layer 3 Summary: 
"Free DAOs are typically volatile, static, 
simple. Good for testing. Risky for capital."
```

---

### Collective DAO

| Layer 1 Rule | Layer 3 Understanding | Layer 3 Output |
|---|---|---|
| Multi-chain assets allowed | Can spread across chains | Monitor concentration |
| Custom tokens allowed | Exotic asset classes possible | Classify and risk-score |
| Multisig required | Requires governance weight calculation | Use advanced formulas |
| Peer invites tracked | Member loyalty data available | Can use time-weighted voting |

```
Layer 3 Summary:
"Collective DAOs are typically accumulative, 
conservative, multi-chain. Use time-weighted 
voting. Monitor concentration risk."
```

---

### Governance DAO

| Layer 1 Rule | Layer 3 Understanding | Layer 3 Output |
|---|---|---|
| All assets allowed | Maximum flexibility | Assess full risk matrix |
| Strict multisig (3-7) | Multiple decision-makers | Reputation-weighted voting makes sense |
| 30% quorum | Higher threshold | Need sophisticated voting formula |
| Long voting periods (14d) | Time for deliberation | Community consensus model |

```
Layer 3 Summary:
"Governance DAOs are typically market-active, 
balanced-to-aggressive. Use reputation or 
hybrid voting. Monitor risks actively."
```

---

### Meta DAO

| Layer 1 Rule | Layer 3 Understanding | Layer 3 Output |
|---|---|---|
| All chains | Expect fragmentation | Normalize cross-chain state |
| All assets | Complex exposure matrix | Asset class reasoning critical |
| Max multisig (15 signers) | Distributed governance | Weighted by region/role |
| 40% quorum | Supermajority needed | Consensus-driven |

```
Layer 3 Summary:
"Meta DAOs are typically complex, federated, 
market-active. Use chain-aware normalization. 
Monitor for critical fragmentation."
```

---

## The Intelligence Workflow

For any treasury, Layer 3 follows this pattern:

```
Input: DAOTreasury + Price Data
  ↓
Classify: Each asset → asset class
  ↓
Analyze: Assets → treasury behavior mode
  ↓
Normalize: Holdings → cross-chain state
  ↓
Assess: Risks & opportunities
  ↓
Recommend: Governance formula for this mode
  ↓
Output: TreasuryIntelligenceSummary
```

---

## Data Flow Example

### Collective DAO with CELO + cUSD

**Input:**
```typescript
treasury = {
  daoType: 'collective',
  assets: [
    { symbol: 'CELO', balance: '100000000000000000000', decimals: 18 },
    { symbol: 'cUSD', balance: '50000000000000000000', decimals: 18 }
  ]
}
priceData = {
  'CELO-CELO': 10,
  'cUSD-CELO': 1
}
```

**Layer 3 Processing:**

```typescript
// 1. Classify
CELO → volatile, high risk, 75 volatility score
cUSD → stable, low risk, 2 volatility score

// 2. Calculate values
CELO: 100 * 10 = $1000
cUSD: 50 * 1 = $50
Total: $1050

// 3. Analyze composition
Volatile: 95% = speculative? NO
Stable: 5% = insufficient? Maybe
Mode: static → accumulative (Collective DAO typical)

// 4. Normalize state
exposureByAssetClass: {
  volatile: $1000 (95%),
  stable: $50 (5%)
}
exposureByChain: {
  CELO: $1050 (100%)
}

// 5. Assess
Risks: ["Over-weighted to volatile CELO", "Single-chain concentrated"]
Opportunities: ["Add stable assets", "Diversify to ETH"]

// 6. Recommend
For 95% volatile + accumulative mode:
  - Formula: time-weighted (long-term focus)
  - Action: Add cUSD to 50/50 balance
  - Yield: Activate on 50% cUSD deposit
```

**Output:**
```typescript
{
  assetClassBreakdown: { volatile: 1, stable: 1 },
  behavior: {
    mode: 'accumulative',
    confidence: 75,
    indicators: ["High volatile ratio (95%)"],
    recommendations: ["Add stablecoins for balance", "Activate yield"]
  },
  crossChainState: {
    stableExposure: 5,
    volatileExposure: 95,
    isCriticallyFragmented: false,
    chainWithLargestShare: 'CELO',
    chainWithLargestSharePercent: 100
  },
  semanticSummary: {
    treasuryCharacter: 'aggressive',
    healthStatus: 'caution',
    keyInsights: [
      'Over-concentrated in volatile assets',
      'Single-chain exposure',
      'Opportunity to diversify'
    ]
  }
}
```

---

## Key Insight: Layer 1 + Layer 3 = Smart System

### Without Layer 3
```
DAO: "I have CELO + cUSD"
Layer 1: "Valid ✓"
Layer 2: "Valid ✓"
System: "OK, you're done."
⚠️ No strategic guidance!
```

### With Layer 3
```
DAO: "I have CELO + cUSD (95% CELO, 5% cUSD)"
Layer 1: "Valid ✓"
Layer 2: "Valid ✓"
Layer 3: "Over-concentrated in volatile assets.
         For accumulative DAO, recommend:
         1) Rebalance to 50/50 stable/volatile
         2) Activate yield on stable portion
         3) Add ETH for diversification
         4) Use time-weighted voting"
✅ Strategic guidance provided!
```

---

## Integration Point: create-dao.tsx

In the treasury step (Step 5), Layer 3 helps show:

```tsx
// After user selects assets and treasury is initialized
const intel = useTreasuryIntelligence();
intel.analyze(treasury, mockPrices);

if (intel.intelligence) {
  <Card>
    <h3>Treasury Character</h3>
    <Badge>{intel.treasuryCharacter()}</Badge>
    
    <h3>Exposures</h3>
    <Progress stable={intel.exposures().stable} />
    
    <h3>Risks</h3>
    <AlertBox items={intel.risks()} />
    
    <h3>Recommendations</h3>
    <CardBox items={intel.opportunities()} />
    
    <h3>Governance</h3>
    <p>Recommended formula: {intel.getRecommendedFormula()}</p>
  </Card>
}
```

---

## Summary

**Layer 1** = The Rules Engine (What's allowed?)  
**Layer 3** = The Intelligence Engine (What's smart?)

Together they make the system both **safe** and **intelligent**.

- Layer 1 prevents invalid configurations
- Layer 3 promotes optimal configurations

This is the foundation for Layer 4 (the Asset Engine).

