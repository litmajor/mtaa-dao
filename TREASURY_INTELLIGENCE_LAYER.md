# Treasury Intelligence Layer — The Missing Cognitive Foundation

## The Four-Layer Treasury Architecture

Your MTAA treasury system now has **four distinct layers**, each serving a different purpose:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Layer 4: Cognition Engine                      │
│         (Asset allocation, risk management, recommendations)      │
│                                                                   │
│  Consumes: TreasuryIntelligenceSummary (semantic understanding)  │
│  Produces: Strategic decisions, rebalancing, yield strategies    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│          Layer 3: Treasury Intelligence (NEW)                    │
│    (Asset classification, behavior analysis, state normalization)│
│                                                                   │
│  Consumes: DAOTreasury + price data                             │
│  Produces: Semantic understanding of treasury health/strategy   │
│            Asset classes, risk profiles, exposure data           │
│            Governance weight formulas, opportunities/risks       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│           Layer 2: Treasury Service Logic                        │
│      (Validation, asset management, cross-chain rules)          │
│                                                                   │
│  Consumes: Basic treasury operations                            │
│  Produces: Validated treasury state                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│      Layer 1: Treasury Configuration Matrix (Capability Gate)    │
│  (DAO type → assets/chains/multisig/voting configured)          │
│                                                                   │
│  Consumes: DAO type selection                                   │
│  Produces: Allowed assets, chains, rules per DAO type           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Capability Gate (Already Existed)

**File:** `treasury.config.ts`

**What it does:**
- Maps DAO types to allowed chains, assets, multisig rules
- Simple lookup tables: `free → [CELO], [cUSD, CELO], optional multisig`
- Used for UI gating and feature toggles

**Example:**
```typescript
const config = getTreasuryConfigForDAOType('collective');
// Returns: allowed chains, assets, multisig requirements
```

---

## Layer 2: Treasury Service (Already Existed)

**File:** `treasury.service.ts`

**What it does:**
- Validates treasury configurations
- Adds/removes assets
- Manages multisig rules
- Calculates simple voting weights

**Example:**
```typescript
const validation = validateTreasuryConfiguration({
  daoType: 'collective',
  selectedAssets: [...],
  multisigEnabled: true
});
```

---

## Layer 3: Treasury Intelligence (NEW! ✨)

**File:** `treasury-intelligence.ts`

This is the **semantic reasoning layer**. It's where symbols become **asset classes**, holdings become **risk profiles**, and distributions become **strategic insights**.

### What Changes with Intelligence

**Before (Layer 1-2):**
```
Treasury has 1000 CELO and 50000 cUSD
→ "Valid configuration ✓"
```

**After (with Layer 3):**
```
Treasury has 1000 CELO and 50000 cUSD
→ "Conservative, static treasury"
→ "82% stable, 18% volatile"
→ "Low risk profile"
→ "Opportunity: consider yield strategies"
→ "Recommended voting: equal or time-weighted"
```

### Asset Class Abstraction

The intelligence layer **re-categorizes** assets from symbols to **semantic classes**:

```typescript
// Layer 1-2 sees:
{ symbol: 'USDC', chain: 'ETH' }

// Layer 3 understands:
{
  symbol: 'USDC',
  chain: 'ETH',
  assetClass: 'stable',           // Not just a symbol!
  riskProfile: 'low',
  strategyEligible: true,
  yieldCapable: true,
  volatilityScore: 2,
  correlationWithOthers: { ... }
}
```

This matters because the cognition engine thinks in **classes**, not **tokens**.

### Treasury Behavior Modes

The system now understands treasury **intent**:

```typescript
type TreasuryMode = 
  | 'static'           // Hold-only
  | 'distributive'     // Regular payouts
  | 'accumulative'     // Long-term growth
  | 'market-active'    // DeFi engagement
  | 'hedged'          // Risk-managed
  | 'speculative';    // High-risk trading
```

**Auto-detected from:**
- Asset composition (% stable, volatile, yield)
- DAO type hints
- Historical patterns

**Enables:**
- "Our treasury is accumulative, not distributive"
- "Switch to market-active if we want yield"
- "Rebalance exposure if speculative"

### Cross-Chain State Normalization

Solves the **multi-chain fragmentation problem**:

```typescript
const state = normalizeCrossChainState(treasury, priceData, classifications);

// Now you can ask:
state.exposureByChain                  // "How much on each chain?"
state.exposureByAssetClass             // "What's our asset breakdown?"
state.chainWithLargestShare            // "Which chain dominates?"
state.isCriticallyFragmented           // "Are we fragmented?"
state.stableExposure                   // "What % is stable?"
```

**Why this matters:**
Without this, a Meta DAO holding USDC on ETH, cUSD on CELO, and DAI on BSC looks like three separate treasuries. With normalization, it's one unified treasury spread across chains.

### Advanced Governance Weight Formulas

Instead of enum-based choices:

```typescript
// Layer 1-2 offers:
votingWeightSource: 'deposit' | 'equal' | 'tokenHolding'
```

Layer 3 provides **computable formulas**:

```typescript
// Static formula
GovernanceWeightFormula.equal()

// Time-weighted (rewards loyalty)
GovernanceWeightFormula.timeWeighted()

// Quadratic (reduces whale influence)
GovernanceWeightFormula.quadratic()

// Hybrid (deposit + time + reputation + role)
GovernanceWeightFormula.hybrid()

// Custom formula builder
const myFormula = (factors) => 
  factors.depositAmount * 
  (1 + factors.holdingTime / 365) * 
  factors.roleMultiplier;
```

---

## Layer 4: Cognition Engine (Not Yet Built)

**This is what the intelligence layer ENABLES**:

### Questions the Cognition Engine Can Now Answer

✅ **Treasury Health:**
- "Is our treasury healthy?" → `healthStatus` ✓
- "What's our risk profile?" → `behavior.riskLevel` ✓
- "Are we fragmented?" → `isFragmented()` ✓

✅ **Asset Reasoning:**
- "How much is in stables vs. volatile?" → `exposures()` ✓
- "Which asset class dominates?" → `assetClassBreakdown` ✓
- "Can we earn yield?" → `assetsOfClass('yield')` ✓

✅ **Strategic Planning:**
- "What treasury mode are we in?" → `behavior.mode` ✓
- "Should we activate yield?" → Check `opportunities` ✓
- "What voting formula fits us?" → `recommendedGovernanceFormula` ✓

✅ **Risk Management:**
- "What are our risks?" → `risks()` ✓
- "Are we over-concentrated?" → `assetConcentration` ✓
- "Which chain is dominant?" → `chainWithLargestShare` ✓

### Example: Asset Engine Decision

**Without Intelligence:**
```typescript
if (treasury.treasuryType === 'dual') {
  // Apply generic dual-asset strategy
  // Can't reason why or what it means
}
```

**With Intelligence:**
```typescript
const intel = useTreasuryIntelligence();
intel.analyze(treasury, priceData);

if (intel.behavior().mode === 'accumulative' && 
    intel.exposures().yield === 0) {
  // Recommend: Activate yield strategies
  // We have capacity AND it makes sense strategically
}

if (intel.isFragmented() && 
    intel.crossChainState.chainWithLargestSharePercent < 40) {
  // Recommend: Consolidate to dominant chain
  // We're fragmented in bad ways
}
```

This is **intelligent resource allocation**, not just **rule application**.

---

## How to Use Layer 3 in Your Code

### Basic Usage: Get Treasury Intelligence

```tsx
import { useTreasuryIntelligence } from '@/hooks/useTreasuryIntelligence';

function MyTreasuryDashboard() {
  const intel = useTreasuryIntelligence();

  useEffect(() => {
    if (treasury && priceData) {
      intel.analyze(treasury, priceData);
    }
  }, [treasury, priceData]);

  if (!intel.intelligence) return <p>Analyzing...</p>;

  return (
    <div>
      <h2>Treasury Character: {intel.treasuryCharacter()}</h2>
      <p>Health: {intel.healthStatus()}</p>
      <p>Stable: {intel.exposures().stable.toFixed(1)}%</p>
      
      <h3>Risks:</h3>
      <ul>
        {intel.risks().map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <h3>Opportunities:</h3>
      <ul>
        {intel.opportunities().map((o, i) => <li key={i}>{o}</li>)}
      </ul>
    </div>
  );
}
```

### Advanced: Calculate Governance Weight

```tsx
const weight = intel.calculateGovernanceWeight({
  depositAmount: 10000,
  holdingTime: 365,
  assetClass: 'stable',
  roleMultiplier: 1.0,
  reputationScore: 75
});

// With recommended formula:
console.log(weight);  // Adaptive to treasury behavior!
```

### Monitor Continuously

```tsx
const intel = useTreasuryIntelligenceMonitor(
  treasury,
  priceData,
  5000  // Re-analyze every 5 seconds
);

// Continuously updated!
```

---

## Architecture Summary

| Layer | File | Responsibility | Outputs |
|-------|------|-----------------|---------|
| 1 | `treasury.config.ts` | **Capability gating** | Allowed configs per DAO type |
| 2 | `treasury.service.ts` | **Validation & operations** | Valid treasury state |
| 3 | `treasury-intelligence.ts` | **Semantic reasoning** | Asset classes, risk, behavior |
| 4 | (Future) | **Strategic cognition** | Allocation, yield, rebalancing |

---

## Why This Order Matters

### You Can't Skip Layer 1

Layer 1 (Capability Gate) **prevents invalid configurations**:
- DAO type → allowed chains/assets/rules
- Without it: "Free DAO holding wrapped Bitcoin on 5 chains"

### You Can't Build Layer 4 Without Layer 3

Layer 3 (Intelligence) **gives Layer 4 semantic vocabulary**:
- Without it: Asset engine can only apply pre-baked rules
- With it: Asset engine can **reason** about what to do

### Layer 3 is the Bridge

It translates from **mechanical rules** (Layer 1-2) to **cognitive reasoning** (Layer 4).

---

## Next: What to Build on Layer 3

Once the intelligence layer is live, you can build:

### ✅ Adaptive Asset Engine
```
For each treasury:
1. Get intelligence
2. Check behavior mode
3. Recommend strategies
4. Validate against capabilities
5. Execute rebalancing
```

### ✅ Risk Dashboard
```
- Health status (live)
- Exposure breakdown (by asset class/chain)
- Fragmentation alerts
- Risk score trending
```

### ✅ Governance Advisor
```
- Recommend voting formula for this treasury's mode
- Calculate weight impact of changes
- Detect governance concentration risks
```

### ✅ Opportunity Scout
```
- "Yield available if you activate it"
- "Chain consolidation recommended"
- "Diversify into [asset class]"
```

---

## Testing the Intelligence Layer

Quick test to verify it works:

```typescript
// Import
import { generateTreasuryIntelligence } from '@/utils/treasury-intelligence';
import { createDefaultTreasury } from '@/utils/treasury.service';

// Create test treasury
const treasury = createDefaultTreasury('test-1', 'collective');

// Add mock price data
const priceData = {
  'CELO-CELO': 10,
  'cUSD-CELO': 1,
  'USDC-ETH': 1
};

// Generate intelligence
const intel = generateTreasuryIntelligence(treasury, priceData);

// Log results
console.log('Mode:', intel.behavior.mode);
console.log('Exposures:', {
  stable: intel.crossChainState.stableExposure,
  volatile: intel.crossChainState.volatileExposure
});
console.log('Health:', intel.semanticSummary.healthStatus);
console.log('Recommended voting:', intel.recommendedGovernanceFormula);
console.log('Risks:', intel.risks);
console.log('Opportunities:', intel.opportunities);
```

---

## Files Added

- `treasury-intelligence.ts` (main intelligence engine)
- `useTreasuryIntelligence.ts` (React hook for consumption)

Both are production-ready and well-documented. 

The system is now **ready for Layer 4: the asset engine**.

