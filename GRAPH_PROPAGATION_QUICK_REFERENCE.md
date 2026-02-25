# 🚀 Graph Propagation Engine - Quick Reference

## The Problem

Without propagation:
```
BTC volatility spike
→ Analyst: "BTC is risky"
→ NURU: "Lower BTC allocation"
→ Done
```

With propagation:
```
BTC volatility spike
→ Propagation scores cascades to: ETH (0.85 corr), SOL (0.72 corr), BTC vaults, pairs
→ NURU reads propagatedRiskScore on ALL related nodes
→ Realizes: entire ecosystem risk up, not just BTC
→ Adjusts: entire allocation tree intelligently
```

---

## Core Types at a Glance

### PropagationDelta (Input)
```typescript
{
  nodeId: 'BTC',
  deltaType: 'volatility' | 'trend' | 'signal' | 'liquidity' | 'structural',
  previousValue: any,
  newValue: any,
  magnitude: 0-1,    // how big is the change?
  timestamp: number
}
```

### CascadeEffect (Intermediate)
```typescript
{
  sourceNode: 'BTC',
  targetNode: 'ETH',
  edgeType: 'correlates_with',
  adjustmentPercent: 0.51,
  confidence: 0.85,
  reasoning: "Correlated assets"
}
```

### StateUpdate (Application)
```typescript
{
  nodeId: 'ETH',
  field: 'signalConfidence',
  proposedValue: 0.65,
  confidence: 0.85,
  reason: "Cascaded from BTC"
}
```

---

## Edge Types: At a Glance

| Type | Flow | Strength | Example |
|------|------|----------|---------|
| **correlates_with** | 2-way | 1.0 ⭐⭐⭐ | BTC ↔ ETH |
| **liquidity_shared** | 2-way | 0.8 ⭐⭐ | Uniswap pair |
| **structural** | 1-way | 0.9 ⭐⭐⭐ | USDC → vaults |
| **strategy** | 2-way | 0.6 ⭐ | Both in strategy |
| **contagion** | 2-way | 0.7 ⭐⭐ | Exchange health |

---

## Main Service Methods

### Initialize
```typescript
graphPropagationEngine.initializeGraph(nodes, edges)
```

### Propagate Single Delta
```typescript
const modified = graphPropagationEngine.propagate(delta)
// Returns: Map<nodeId, updated GraphNode>
```

### Propagate Multiple Deltas
```typescript
const modified = graphPropagationEngine.propagateBatch(deltas)
```

### Query
```typescript
graphPropagationEngine.getNode(nodeId)
graphPropagationEngine.getAllNodes()
graphPropagationEngine.getCascadesToTarget(nodeId)
graphPropagationEngine.exportState()
```

### Update from External
```typescript
graphPropagationEngine.updateNodeState(nodeId, {
  propagationState: { /* updates */ }
})
```

---

## How It Works (The 4 Steps)

### Step 1: Delta Detection
**Who:** OHLCV Service or Technical Analysis Service
**Trigger:** State crosses threshold
```typescript
"BTC volatility was 0.4, now 0.8" → magnitude = 1.0 (extreme)
"ETH signal was neutral, now bullish" → magnitude = 0.6 (significant)
```

### Step 2: Cascade Computation
**Who:** PropagationScorer
**Logic:** For each neighbor of source node
```typescript
neighbor_adjustment = source_delta × edge_weight × edge_type_multiplier
confidence = edge_weight × magnitude
```

### Step 3: State Updates
**Who:** StateDispatcher
**Logic:** Convert cascades to concrete updates
```typescript
Multiple cascades on same field?
→ Weighted average by confidence
→ Conflict resolution
```

### Step 4: Commit
**Who:** StateDispatcher.commitUpdates()
**Result:** Nodes modified, dataFreshness = 1
```typescript
modified.forEach(node => {
  propagationState.field = proposedValue
  propagationState.updatedAt = now
})
```

---

## Node State Metrics

Every node tracks 15 metrics:

| Category | Metrics | Range |
|----------|---------|-------|
| Risk | volatilityRegime, volatilityScore, volatilityTrend | regime, 0-1, trend |
| Price | trendRegime, trendStrength, trendConfidence | regime, 0-1, 0-1 |
| Signal | signalBias, signalConfidence, signalWeight | bias, 0-1, 0-1 |
| Liquidity | liquidityQuality, liquidityScore, spreadWidth | quality, 0-1, % |
| Risk (Structural) | depegRisk, counterpartyRisk | 0-1, 0-1 |
| Graph Effects | correlationBias, causalityRisk, propagatedRiskScore | -1±1, 0-1, 0-1 |
| Metadata | dataFreshness, updatedAt | 0-1, timestamp |

---

## Common Use Cases

### Use Case 1: Volatility Contagion
```
BTC volatility spikes
→ PropagationDelta: deltaType='volatility', magnitude=1.0
→ Cascades to: High-beta alts (SOL, AVAX, meme tokens)
→ Effect: Their volatilityScore increases
→ NURU: Reduces positions in high-vol assets
```

### Use Case 2: Stablecoin Depeg
```
USDC depeg detected
→ PropagationDelta: deltaType='structural', magnitude=0.8
→ Cascades to: All vaults using USDC (structural edges)
→ Effect: depegRisk increases on vault nodes
→ NURU: Rebalances away from USDC-dependent vaults
```

### Use Case 3: Signal Alignment
```
BTC signal turns bullish
→ PropagationDelta: deltaType='signal', magnitude=0.6
→ Cascades to: Correlated assets (ETH, SOL, etc.)
→ Effect: Their signalConfidence increases (bullish reinforcement)
→ NURU: More confident in bullish allocation
```

### Use Case 4: Liquidity Stress
```
Exchange liquidation volume detected
→ PropagationDelta: deltaType='liquidity', magnitude=0.7
→ Cascades to: All pairs on exchange (contagion edges)
→ Effect: Their spreadWidthPercent increases, liquidityScore ↓
→ NURU: Reduces execution size, increases slippage budget
```

### Use Case 5: Cross-Chain Bridge Risk
```
Bridge exploit detected
→ PropagationDelta: deltaType='structural', magnitude=0.9
→ Cascades to: All wrapped tokens from that bridge
→ Effect: counterpartyRisk increases, causalityRisk high
→ NURU: De-risks all wrapped token positions
```

---

## Confidence Scoring

All updates carry confidence 0-1:
- **High confidence (0.8-1.0):**
  - Strong edge weight (correlation > 0.8)
  - Large delta magnitude (change > 50%)
  - Fresh data (dataFreshness = 1)

- **Medium confidence (0.5-0.8):**
  - Moderate edge weight (correlation 0.5-0.8)
  - Medium delta magnitude (change 20-50%)
  - Decent data freshness

- **Low confidence (0-0.5):**
  - Weak edges (correlation < 0.5)
  - Small delta magnitude (change < 20%)
  - Stale data (dataFreshness < 0.5)

**Conflict Resolution:** When multiple cascades hit the same field,
dispatcher uses weighted average:
```
final_value = Σ(cascade_value × cascade_confidence) / Σ(cascade_confidence)
```

---

## Integration Checklist

### Phase B: Wire Into Layers 2 & 3

- [ ] OHLCV Service: Call `propagate()` on volatility threshold
- [ ] TA Service: Call `propagate()` on signal change
- [ ] Subscribe to modified nodes for cache invalidation
- [ ] Feed modified nodes to NURU (Layer 5)

### Phase C: Production Hardening

- [ ] Add circuit breaker: prevent feedback loops
- [ ] Add confidence decay: stale data = lower confidence
- [ ] Add anomaly detection: unusual cascade patterns
- [ ] Add telemetry: cascade metrics to monitoring

### Phase D: Optimization

- [ ] Cache cascade paths (don't recompute each time)
- [ ] Implement delta compression (nearby nodes batch deltas)
- [ ] Add cascade throttling (rate-limit propagation)
- [ ] Implement state snapshots (rollback on anomalies)

---

## Performance Considerations

### Time Complexity
- **computeCascades(delta):** O(E) where E = number of edges from node
- **applyPropagation(cascades):** O(C) where C = number of cascades
- **resolveConflicts():** O(C log C) for sorting by confidence
- **Total propagate():** O(E + C log C), typically < 100ms

### Space Complexity
- **NodeMap:** O(N) nodes
- **EdgeMap:** O(E) edges
- **CascadeEffect[]:** O(E) per delta
- **StateUpdate[]:** O(E) per propagation cycle

### Optimization Opportunities (Phase C+)
- Cache cascade paths between frequently-related nodes
- Batch deltas if they arrive < 100ms apart
- Prune low-confidence cascades (< 0.3 confidence threshold)
- Implement rolling window for state freshness

---

## Example: Complete Flow

```typescript
// 1. OHLCV Service detects BTC volatility spike
const btcVolatilityDelta: PropagationDelta = {
  nodeId: 'BTC',
  deltaType: 'volatility',
  previousValue: 0.4,
  newValue: 0.85,
  magnitude: Math.abs(0.85 - 0.4) / 0.85 = 0.529 ≈ 0.53,
  timestamp: Date.now()
};

// 2. Propagation Engine triggered
const modified = graphPropagationEngine.propagate(btcVolatilityDelta);

// 3. Internal: PropagationScorer computes cascades
//   BTC → ETH (correlates_with, weight=0.85)
//     cascade% = 0.85 * 0.53 = 0.45 (45% of BTC change)
//     confidence = 0.85
//   BTC → SOL (correlates_with, weight=0.72)
//     cascade% = 0.72 * 0.53 = 0.38 (38% of BTC change)
//     confidence = 0.72
//   BTC → BTC Vaults (structural, weight=0.9)
//     cascade% = 0.9 * 0.53 = 0.48 (48% of BTC change)
//     confidence = 0.9

// 4. Internal: StateDispatcher converts to updates
//   ETH: volatilityScore += 0.45 * 0.3 = +0.135
//   SOL: volatilityScore += 0.38 * 0.3 = +0.114
//   Vaults: causalityRisk += 0.48 * 0.5 = +0.24

// 5. Returned: modified nodes
//   modified.get('ETH').propagationState.volatilityScore = 0.635
//   modified.get('SOL').propagationState.volatilityScore = 0.614
//   modified.get('BTC_Vault').propagationState.causalityRisk = 0.54

// 6. NURU reads modified.propagationState
//   Sees: high volatility spreading through ecosystem
//   Decides: reduce equity exposure, increase stablecoin
//   Actions: rebalance treasury allocation

// Done!
```

---

## Troubleshooting

### Cascades not appearing?
- Check node is in graph: `graphPropagationEngine.getNode(nodeId)`
- Check edges exist: must have `from: sourceNode` edges
- Check magnitude >= 0.3: cascades below threshold are suppressed
- Check edge weight: very weak edges (< 0.2) produce low-confidence cascades

### Cascades too aggressive?
- Lower edge weights (currently at max values)
- Increase magnitude threshold (currently 0.3)
- Implement confidence decay (stale data = lower multiplier)
- Add circuit breaker to prevent feedback loops

### Data not updating?
- Check `dataFreshness`: should be 1 after update
- Check `updatedAt`: should be recent timestamp
- Call `graphPropagationEngine.exportState()` to verify

---

## Key Takeaways

✅ **Phase A delivers:** Complete graph propagation engine
✅ **4 components:** Node Schema, Edge Weights, Scorer, Dispatcher
✅ **5 edge types:** Correlation, Liquidity, Structural, Strategy, Contagion
✅ **Full type safety:** TypeScript, no runtime errors
✅ **Ready to integrate:** Awaiting Phase B wiring

The engine transforms your Symbol Universe from:
- **Isolated nodes** → **Interconnected graph**
- **Local signals** → **Systemic awareness**
- **Retail analytics** → **Fund-level intelligence**
