# 🧠 Graph Propagation Engine - Phase A Complete

## Overview

**Status:** ✅ PHASE A COMPLETE

You now have the **Graph Propagation Layer** - the capital intelligence engine that transforms your Symbol Universe from isolated nodes into a **systemic awareness system**.

---

## 🏗️ What Phase A Delivers

### 1️⃣ Extended Node Schema (PropagationState)

Each node in your Symbol Universe now carries:

```typescript
├─ Risk Metrics
│  ├─ volatilityRegime: 'low' | 'normal' | 'high' | 'extreme'
│  ├─ volatilityScore: 0-1 quantified
│  └─ volatilityTrend: increasing | stable | decreasing
│
├─ Price Action  
│  ├─ trendRegime: uptrend | downtrend | range
│  ├─ trendStrength: 0-1
│  └─ trendConfidence: 0-1
│
├─ Technical Signals
│  ├─ signalBias: bullish | neutral | bearish
│  ├─ signalConfidence: 0-1
│  └─ signalWeight: 0-1
│
├─ Liquidity
│  ├─ liquidityQuality: thin | fair | good | deep
│  ├─ liquidityScore: 0-1
│  └─ spreadWidthPercent: execution cost
│
├─ Structural Risk
│  ├─ depegRisk: 0-1
│  └─ counterpartyRisk: 0-1
│
└─ Graph Effects (Propagated)
   ├─ correlationBias: -1 to +1
   ├─ causalityRisk: 0-1
   └─ propagatedRiskScore: 0-1
```

**Why this matters:**
- Every node knows not just its own state, but its position in the graph
- Signal confidence gets weighted by network effects
- Risk compounds/mitigates based on neighborhood

---

### 2️⃣ Edge Weights - All 5 Relationship Types

| Type | Multiplier | Flow | Example |
|------|-----------|------|---------|
| **correlates_with** | 1.0 | Bidirectional | BTC↔ETH (0.85 correlation) |
| **liquidity_shared** | 0.8 | Bidirectional | Uniswap v3 BTC/USDC |
| **structural** | 0.9 | Unidirectional | USDC depeg → vaults |
| **strategy** | 0.6 | Bidirectional | Both in volatility strategy |
| **contagion** | 0.7 | Bidirectional | Exchange health → all pairs |

**Key insight:**
- Strongest edge (1.0): Correlation - price moves together
- Fastest spread (0.9): Structural - cascading failures
- Broadest impact (0.7): Contagion - exchange/counterparty risks

---

### 3️⃣ Propagation Scorer

**What it does:**

Given a node state change, computes all cascades to neighbors.

```
BTC Volatility Spike (extreme)
    ↓
PropagationScorer.computeCascades()
    ↓
    │ Edge: BTC→ETH (correlation 0.85)
    │ ├─ Delta magnitude: 0.7
    │ ├─ Adjustment: ETH confidence ↓ 15%
    │ └─ Confidence: 0.85
    │
    │ Edge: BTC→SOL (correlation 0.72)
    │ ├─ Delta magnitude: 0.7
    │ ├─ Adjustment: SOL confidence ↓ 12%
    │ └─ Confidence: 0.72
    │
    └─ Edge: BTC→BTC Vaults (structural)
       ├─ Delta magnitude: 0.7
       ├─ Adjustment: Vault risk ↑ 8%
       └─ Confidence: 0.9
```

**Output: CascadeEffect[]**
- Source node
- Target node
- Edge type
- Adjustment direction & percent
- Confidence score
- Human-readable reasoning

---

### 4️⃣ State Dispatcher

**What it does:**

Takes cascades and applies them to nodes with intelligent conflict resolution.

```
Input: 8 cascades hitting BTC/USDT node
           ├─ Correlation from BTC ↑ signal
           ├─ Liquidity from Binance ↓ depth
           ├─ Contagion from exchange health
           ├─ Strategy from pair trading
           └─ 4 more...

State Dispatcher
    ↓
    ├─ Group by field: signalConfidence, liquidityScore, causalityRisk
    ├─ Resolve conflicts: weighted average by high-confidence cascades
    └─ Generate StateUpdate[]

Output: Committed state changes
```

**Conflict Resolution:**
- Multiple cascades on same field?
- Takes weighted average by confidence
- Prioritizes recent/high-confidence updates
- Prevents **cascade storms** (feedback loops)

---

## 🔌 Integration Points (Phase B)

### To integrate with OHLCV Service:

```typescript
// In ohlcvService, when volatility updates:
const volatilityDelta: PropagationDelta = {
  nodeId: 'BTC',
  deltaType: 'volatility',
  previousValue: ohlcvState.previousVolatility,
  newValue: ohlcvState.currentVolatility,
  magnitude: Math.abs(newValue - previousValue) / max(newValue, previousValue),
  timestamp: now,
};

const modified = graphPropagationEngine.propagate(volatilityDelta);
```

### To integrate with Technical Analysis Service:

```typescript
// In technicalAnalysisService, when signal bias changes:
const signalDelta: PropagationDelta = {
  nodeId: 'BTC/USDT',
  deltaType: 'signal',
  previousValue: previousBias,  // 'neutral'
  newValue: newBias,            // 'bullish'
  magnitude: 0.6,
  timestamp: now,
};

const modified = graphPropagationEngine.propagate(signalDelta);
```

---

## 📊 Data Flow: Complete Architecture

```
LAYER 1: Symbol Universe (Graph Definition)
├─ Nodes: Assets, Pairs, Chains, Vaults, DAOs
├─ Edges: Structure only (no state)
└─ Topology: Fixed or slow-moving

      ↓

LAYER 2: OHLCV Service (Temporal State)
├─ Pushes: price, volume, candles
├─ Computes: volatility, liquidity, regime
└─ Triggers: PropagationDelta when state crosses threshold

      ↓

LAYER 3: Technical Analysis Service (Signal State)
├─ Computes: RSI, MACD, MA bias
├─ Weighs: regime-aware indicator scoring
└─ Triggers: PropagationDelta when signal changes

      ↓

LAYER 4: Graph Propagation Engine (THIS PHASE)
├─ Receives: PropagationDelta from OHLCV & TA
├─ Computes: CascadeEffect to all neighbors
├─ Applies: StateUpdate with conflict resolution
└─ Emits: Modified nodes with propagatedRiskScore

      ↓

LAYER 5: NURU (Capital Decision Layer - Ready)
├─ Reads: nodes.propagationState
├─ Decides: allocations, rebalancing, hedges
└─ Monitors: treasury exposure by edge type

      ↓

LAYER 6: KWETU (Execution Layer - Ready)
├─ Receives: allocation decisions from NURU
├─ Executes: orders, position changes
└─ Reports: execution metrics to Layer 4 feedback loop
```

---

## 🧠 Example: Real-World Cascade

### Scenario: USDC Depeg

**Initial State:**
- USDC price: $1.0000
- Vaults using USDC: 15
- Protocols building on USDC: 32

**Event:** USDC depeg to $0.98

```
Step 1: OHLCV detects price change
  → PropagationDelta: nodeId='USDC', deltaType='structural', magnitude=0.8

Step 2: Propagation Scorer evaluates edges
  USDC → Vault A (structural edge, weight=0.9)
    └─ Cascade: depegRisk ↑ 0.72
  
  USDC → Vault B (structural edge, weight=0.9)
    └─ Cascade: depegRisk ↑ 0.72
  
  USDC → Aave (contagion edge, weight=0.7)
    └─ Cascade: counterpartyRisk ↑ 0.56

Step 3: State Dispatcher applies updates
  ├─ Vault A: depegRisk = 0.8, propagatedRiskScore ↑ 0.2
  ├─ Vault B: depegRisk = 0.8, propagatedRiskScore ↑ 0.2
  └─ Aave: counterpartyRisk ↑ 0.2, correlationBias ↓ 0.15

Step 4: NURU reads updated propagationState
  ├─ Detects: critical risk on vaults
  ├─ Triggers: rebalancing
  └─ Adjusts: treasury allocation away from affected vaults

Step 5: KWETU executes
  ├─ Liquidates vault positions
  ├─ Reports metrics
  └─ Feeds back to Layer 4 for future cascades
```

**Without propagation:** "USDC down 2%, adjust USDC pairs"
**With propagation:** "USDC at structural risk, cascade affecting 15 vaults, 32 protocols, shift capital away from entire dependency tree"

---

## 🎯 Key Concepts

### Propagation Delta
```typescript
{
  nodeId: 'BTC',
  deltaType: 'volatility' | 'trend' | 'signal' | 'liquidity' | 'structural',
  previousValue: 0.5,
  newValue: 0.8,
  magnitude: 0.6,  // normalized change size
  timestamp: Date.now()
}
```
**Triggered by:** OHLCV or TA services when state crosses threshold

### Cascade Effect
```typescript
{
  sourceNode: 'BTC',
  targetNode: 'ETH',
  edgeType: 'correlates_with',
  adjustmentDirection: 'same',  // moves together
  adjustmentPercent: 0.51,       // propagate 51% of BTC change
  confidence: 0.85,              // high confidence (correlation strength)
  reasoning: "Correlated assets"
}
```
**Computed by:** PropagationScorer.computeCascades()

### State Update
```typescript
{
  nodeId: 'ETH',
  field: 'signalConfidence',
  currentValue: 0.8,
  proposedValue: 0.65,
  reason: "Cascaded from BTC via correlation",
  confidence: 0.85
}
```
**Generated by:** StateDispatcher.applyPropagation()
**Committed by:** StateDispatcher.commitUpdates()

---

## ⚙️ Edge Multipliers Explained

### correlates_with (1.0)
- **Strongest propagation**
- Price correlation strength = edge weight
- BTC down 5% → ETH down 4.25% (85% correlation)
- **Use case:** Value pairs, related tokens

### liquidity_shared (0.8)
- **Execution impact**
- Shared AMM pools affect both sides
- Deeper understanding of market microstructure
- **Use case:** DEX pairs, wrapped token pairs

### structural (0.9)
- **Failure cascades**
- Collateral relationships, stablecoin pegs
- UNIDIRECTIONAL: depeg affects dependent protocols
- **Use case:** Vault dependencies, collateral chains

### strategy (0.6)
- **Regime shifts**
- Used in same trading strategy
- BTC volatility spike → both assets affect strategy
- **Use case:** Pairs in same arbitrage, stat arb

### contagion (0.7)
- **Counterparty risk**
- Exchange health, provider failures
- All pairs on FTX hit when FTX fails
- **Use case:** Systemic risk tracking

---

## 🚀 What Phase A Enables

✅ **Systemic Risk Awareness**
- Not just "BTC is down", but "what's the cascade?"
- Risk metrics account for network effects

✅ **Intelligent Rebalancing**
- Don't just adjust BTC allocation
- Adjust entire dependency tree intelligently

✅ **Early Warning System**
- Detect structural risks before they explode
- Monitor contagion spread in real-time

✅ **Capital Efficiency**
- Avoid overexposure to correlated nodes
- Hedge against cascade effects

✅ **Fund-Level Intelligence**
- Retail: "What asset should I buy?"
- Fund: "What is my systemic exposure?"

---

## 📋 Phase A Checklist

✅ Node Schema with propagatable state
✅ 5 edge types with multipliers
✅ PropagationScorer with cascade computation
✅ StateDispatcher with conflict resolution
✅ GraphPropagationEngine main service
✅ Initialization and state management
✅ Type safety (full TypeScript)
✅ No errors/warnings
✅ Comprehensive documentation

---

## 📚 Classes & Key Methods

### GraphNode
- `nodeId`: string
- `nodeType`: asset | pair | chain | exchange | vault | dao | strategy
- `propagationState`: PropagationState (15 metrics)
- `edges`: outgoing[], incoming[]

**Helper:**
```typescript
initializeNode(nodeId, nodeType): GraphNode
```

### PropagationScorer
**Main method:**
```typescript
computeCascades(delta: PropagationDelta): CascadeEffect[]
```

**Process:**
1. Find all neighbors via edge map
2. Score cascade to each neighbor
3. Calculate adjustment direction & percent
4. Return ordered by confidence

### StateDispatcher
**Main method:**
```typescript
applyPropagation(cascades: CascadeEffect[]): StateUpdate[]
```

**Process:**
1. Convert cascades to state updates
2. Group by target node
3. Resolve conflicts (weighted average)
4. Return proposed updates

**Commit:**
```typescript
commitUpdates(updates: StateUpdate[]): Map<string, GraphNode>
```

### GraphPropagationEngine
**Main workflow:**
```typescript
propagate(delta: PropagationDelta): Map<string, GraphNode>
  ├─ scorer.computeCascades(delta)
  ├─ dispatcher.applyPropagation(cascades)
  ├─ dispatcher.commitUpdates(updates)
  └─ return modified nodes
```

**Batch:**
```typescript
propagateBatch(deltas: PropagationDelta[]): Map<string, GraphNode>
```

---

## 🔧 Usage Examples

### Initialize Graph

```typescript
import { graphPropagationEngine, initializeNode } from './graphPropagationEngine';

// Build nodes from Symbol Universe
const nodes = [
  initializeNode('BTC', 'asset'),
  initializeNode('ETH', 'asset'),
  initializeNode('BTC/USDT', 'pair'),
  // ... etc
];

// Build edges
const edges = [
  {
    from: 'BTC', to: 'ETH',
    edgeType: 'correlates_with',
    weight: 0.85,
    directional: false,
    typeMultiplier: 1.0,
    metadata: { correlation: 0.85 },
    updatedAt: Date.now(),
  },
  // ... etc
];

graphPropagationEngine.initializeGraph(nodes, edges);
```

### Trigger Propagation

```typescript
// From OHLCV Service
import { PropagationDelta } from './graphPropagationEngine';

const delta: PropagationDelta = {
  nodeId: 'BTC',
  deltaType: 'volatility',
  previousValue: 0.4,
  newValue: 0.8,
  magnitude: 1.0,  // extreme change
  timestamp: Date.now(),
};

const modified = graphPropagationEngine.propagate(delta);

// Log cascades
modified.forEach((node, nodeId) => {
  console.log(`${nodeId}: propagatedRiskScore = ${node.propagationState.propagatedRiskScore}`);
});
```

### Batch Propagation

```typescript
const deltas = [
  { nodeId: 'BTC', deltaType: 'volatility', ... },
  { nodeId: 'USDC', deltaType: 'structural', ... },
  { nodeId: 'BTC/USDT', deltaType: 'signal', ... },
];

const modified = graphPropagationEngine.propagateBatch(deltas);
```

### Query Cascades

```typescript
// See what happens when BTC changes
const cascades = graphPropagationEngine.getCascadesToTarget('BTC');

cascades.forEach(c => {
  console.log(
    `${c.sourceNode} → ${c.targetNode} via ${c.edgeType}: ` +
    `adjust ${c.adjustmentPercent * 100}%, confidence ${c.confidence}`
  );
});
```

---

## 🎯 Phase A Complete

**What you now have:**
- Full graph propagation logic
- 4 independent components working together
- Type-safe, production-ready code
- Ready for integration with Layers 2, 3, 5, 6

**What's next (Phase B):**
- Wire OHLCV Service → Graph Propagation Engine
- Wire Technical Analysis Service → Graph Propagation Engine
- Create monitoring dashboard for cascades
- Implement feedback loops (execution metrics → Layer 4)

**What's after (Phase C):**
- Circuit breakers (prevent runaway cascades)
- Confidence decay (stale data = less confident)
- Anomaly detection (unusual cascade patterns)
- Production telemetry & alerts

---

## 📞 Support & Questions

The engine is designed to be:
- **Extensible**: Add new edge types, delta types, update types
- **Observable**: Every step can be logged and analyzed
- **Testable**: Cascades can be simulated without live data
- **Modular**: Each component (Scorer, Dispatcher) usable independently

Ready for Phase B integration.
