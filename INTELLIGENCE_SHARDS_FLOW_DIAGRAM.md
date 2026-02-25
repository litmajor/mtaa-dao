# Intelligence Shards → Cognition Engine Flow 🔌

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE SHARDS LAYER                        │
│                  (AssetStateSnapshot feeder)                        │
└─────────────────────────────────────────────────────────────────────┘
     │
     ├─→ Market Shards (FAST)
     │   ├─ Price Shard (1 min)        → priceUsd, priceConfidence
     │   ├─ Liquidity Shard (4 hrs)    → liquidityDepth{1,5}pct
     │   └─ Technical Shard (1 hr)     → RSI, MACD, trend, signals
     │
     ├─→ Risk Shards (SLOW)
     │   ├─ Risk Index (24 hrs)        → riskOverallScore
     │   ├─ Smart Contract (24 hrs)    → riskSmartContractScore
     │   └─ Governance Score (24 hrs)  → riskGovernanceScore
     │
     ├─→ Structural Shards
     │   ├─ Correlation Graph (15 min) → correlationGraph
     │   └─ Relationship Discovery (1m) → relationshipDiscovery
     │
     └─→ Governance Shards (24 hrs)
         ├─ DAO Eligibility Tier      → governanceDaoEligibilityTier
         └─ Curation Type             → governanceCurationType
          
          All merge into:
          ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
          
┌─────────────────────────────────────────────────────────────────────┐
│              AssetStateSnapshot.coreState (ATOMIC)                  │
│                                                                     │
│  ✓ priceUsd, priceSources, chainSpecificPrices                    │
│  ✓ technicalRsi14, technicalMacd, technicalTrend                  │  
│  ✓ liquidityDepth1pct, liquidityByChain                           │
│  ✓ riskOverallScore, riskSmartContractScore, riskWeightedByDaoType│
│  ✓ correlationGraph (hedges, trends)                              │
│  ✓ relationshipDiscovery (dependencies, impacts)                  │
│  ✓ governanceDaoEligibilityTier, governanceCurationType           │
│                                                                     │
│  Updated: metadata.shardUpdateStatus tracks freshnessper shard   │
└─────────────────────────────────────────────────────────────────────┘
          ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
          Consumed by:

┌─────────────────────────────────────────────────────────────────────┐
│         COGNITION ENGINE (Decision Layer)                          │
│                                                                     │
│  Core questions:                                                   │
│  Q1: "What's the current risk?" → reads riskOverallScore         │
│  Q2: "How liquid is exit?" → reads liquidityDepth, correlations │
│  Q3: "Should we hedge?" → reads correlationGraph negatives       │
│  Q4: "Best yield source?" → reads yieldStrategies               │
│  Q5: "Can this DAO hold it?" → reads governanceDaoEligibilityTier│
│                                                                     │
│  Plus: Asset Graph for broader network relationships             │
│                                                                     │
│  Output: CognitionOutput with scored recommendations            │
└─────────────────────────────────────────────────────────────────────┘
          ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
          Consumed by:

        ┌──────────────────────────────┐
        │  NURU Agent (Yield Expert)   │
        │  KWETU Agent (Governance)    │
        │  DAO Treasury App (UI)       │
        └──────────────────────────────┘
```

---

## Data Flow Example: Evaluating USDC for Foundation DAO

```
1. INTELLIGENCE SHARDS RUN
   ═════════════════════════════════════════════════════════════
   
   PriceShard (1 min)
   ├─ Query: CoinGecko API, Uniswap TWAP
   ├─ Result: priceUsd = 1.0000
   └─ Confidence: 99% (high trust, stablecoin)
   
   LiquidityShard (4 hrs)
   ├─ Query: Uniswap/Aave liquidity
   ├─ Result: liquidityDepth1pct = $50M USD
   └─ All chains combined
   
   RiskIndexShard (24 hrs)
   ├─ Component Scores:
   │  ├─ SC Risk: 5% (audited, no history)
   │  ├─ Oracle Risk: 3% (native blockchain)
   │  ├─ Governance Risk: 8% (Circle controlled, some risk)
   │  └─ Market Risk: 2% (pegged)
   ├─ Overall: 5.2/100 (low risk)
   └─ DAO-weighted: foundation = 4.8/100 (even better for foundations)
   
   CorrelationGraphShard (15 min)
   ├─ Result: Weak correlation with other assets
   ├─ Can use as hedge against most positions
   
   DaoEligibilityTierShard (24 hrs)
   ├─ Result: tier_1 (safe for all DAOs)
   
   CurationTypeShard (24 hrs)
   ├─ Result: community (no special governance needed)
   
   ⬆ All data merged into AssetStateSnapshot.coreState


2. COGNITION ENGINE READS SNAPSHOT
   ═════════════════════════════════════════════════════════════
   
   Query Type: allocation_analysis
   DAO Type: foundation
   
   Engine reads:
   ├─ Current USDC holding: 2M USD
   ├─ Risk score: 5.2/100 (very safe)
   ├─ Yield sources: 4.5% APY on Aave
   ├─ Liquidity: Instant exit possible
   ├─ Governance eligibility: All DAOs can hold
   └─ Correlations: Safe as stabilizer
   
   Plus: Asset Graph shows USDC's role in ecosystem
   
   Decision Engine outputs:
   ├─ Risk classification: MINIMAL
   ├─ Volatility impact: -0.2% (reduces portfolio volatility!)
   ├─ Yield impact: +$90K/year if moved to Aave
   └─ Recommendation: INCREASE from 10% → 15% allocation
       Rationale: Risk budget underutilized, stable income source


3. NURU AGENT CONSUMES RECOMMENDATION
   ═════════════════════════════════════════════════════════════
   
   "Foundation DAO should move $500K USDC to Aave for 4.5% APY"
   
   ├─ Safety check: tier_1 + low volatility ✓
   ├─ Tax implications: Stablecoin swap (neutral) ✓
   ├─ Liquidity check: $50M available (no slippage) ✓
   └─ Proposes governance vote
   
   
4. KWETU AGENT VALIDATES GOVERNANCE
   ═════════════════════════════════════════════════════════════
   
   "Checking: Can this DAO add USDC to their treasury?"
   
   ├─ Tier: tier_1 (community-curated) ✓
   ├─ Risk profile: foundation DAOs = risk-averse ✓
   ├─ Governance alignment: 85/100 ✓
   └─ Approval: YES, any foundation can hold

⬇ Treasury updated with recommendation
```

---

## Key Design Advantages

### 1. **Separation of Concerns**
- Shards: Data collection & normalization
- Cognition: Decision logic
- Agents: Action execution

### 2. **Parallel Processing**
```typescript
// All shards run simultaneously
const updates = await Promise.all([
  priceShard.compute(),      // 100ms
  technicalShard.compute(),  // 200ms
  riskShard.compute(),       // 300ms
  ...more shards...
]);
// Total time: 300ms (not 900ms!)
```

### 3. **Atomic Snapshots**
Each `AssetStateSnapshot` is completely self-contained. No dangling references. Can:
- Cache freely
- Version easily
- Compare historicallyRollback cleanly

### 4. **Flexible Update Scheduling**
```typescript
// Run only the stale shards
const staleness = checkStaleness(snapshot);

if (staleness['price'] > 1_min) {
  await orchest.updateSnapshot(snapshot, ['price']);
}
if (staleness['risk_index'] > 24_hrs) {
  await orchest.updateSnapshot(snapshot, ['risk_index']);
}
```

### 5. **Real-World Data Ready**
Each shard is structured for real integrations:
- PriceShard → CoinGecko, Uniswap, Chainlink
- LiquidityShard → DEX APIs, orderbooks
- RiskShards → Audit databases, CVE feeds
- GovernanceShards → Snapshot voting, DAO tools

---

## What Gets Stored vs. Computed

### STORED in snapshot.coreState:
- Price (changes frequently)
- Technical indicators (computed from history)
- Liquidity depths (from DEX queries)
- Risk scores (from audits + on-chain)
- Governance tiers (from policies)
- Correlations (computed from history)

### QUERIED SEPARATELY (not in snapshot):
- Correlation Matrix (n² for n assets = huge)
- Edge list (constantly changing)
- LP pair data (explodes with new bridges)
- Historical price candles (stored separately)

Keeps `AssetStateSnapshot` lightweight & queryable ✓

---

## Next Integration Points

```
intelligenceShards.ts (✓ DONE)
├─→ cognitionEngine.ts
│   ├─ Reads snapshot.coreState for risk/yield/liquidity
│   └─ Uses Asset Graph for correlations
│
├─→ agents/nuru.ts (TO WIRE)
│   ├─ Consumes CognitionOutput
│   └─ Generates yield recommendations
│
└─→ agents/kwetu.ts (TO WIRE)
    ├─ Reads governance shards
    └─ Validates DAO eligibility
```

---

**Ready for:** NURU & KWETU agent wiring 🚀

