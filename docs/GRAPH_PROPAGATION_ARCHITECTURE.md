# Graph Propagation Engine - Architecture Diagrams

## System Architecture: Layers 1-6

```
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 0: Market Data (External)                                  │
│ Exchanges, Chains, Protocols, On-Chain Data                       │
└───────────┬──────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 1: SYMBOL UNIVERSE (Graph Definition)                      │
│                                                                  │
│  Nodes: Assets, Pairs, Chains, Exchanges, Vaults, DAOs          │
│  Edges: Trades, Bridges, Correlates, Liquidity, Collateral      │
│                                                                  │
│  Status: ✅ FOUNDATION EXISTS (enriched by Layers 2-4)          │
└───────────┬──────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 2: OHLCV SERVICE (Temporal State Annotation)                │
│                                                                  │
│  Input:  Exchange data (price, volume, candles)                  │
│  Output: PropagationDelta (volatility, trend, regime)            │
│  State:  Time-series data on nodes                               │
│                                                                  │
│  Services:                                                       │
│  ├─ ohlcvService.ts         [data fetching]                     │
│  ├─ volatilityMetricsService.ts [volatility scoring]            │
│  └─ Creates: PropagationDelta on threshold                       │
│                                                                  │
│  Status: ✅ EXISTS                                               │
└───────────┬──────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 3: TECHNICAL ANALYSIS SERVICE (Signal Annotation)          │
│                                                                  │
│  Input:  Candles from Layer 2                                   │
│  Output: PropagationDelta (signal changes, regime-aware)         │
│  State:  Indicators on nodes (RSI, MACD, MA, regime)             │
│                                                                  │
│  Services:                                                       │
│  ├─ technicalAnalysisService.ts [indicator computation]         │
│  ├─ timeframeUtils.ts           [flexible timeframes]           │
│  └─ Creates: PropagationDelta on signal flip                     │
│                                                                  │
│  Status: ✅ EXISTS + ENHANCED (Phase 3)                          │
└───────────┬──────────────────────────────────────────────────────┘
            │
            │  PropagationDelta from OHLCV & TA
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 4: GRAPH PROPAGATION ENGINE ⚡ (NEW - Phase A)             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ INPUT: PropagationDelta                                │      │
│  │ {nodeId, deltaType, magnitude, timestamp}              │      │
│  └────────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ PROPAGATION SCORER                                      │      │
│  │ ├─ Find all neighbors via edge map                      │      │
│  │ ├─ Score cascade to each (edge_weight × magnitude)      │      │
│  │ ├─ Calculate confidence                                │      │
│  │ └─ Output: CascadeEffect[]                             │      │
│  └────────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ STATE DISPATCHER                                         │      │
│  │ ├─ Convert cascades → StateUpdate                        │      │
│  │ ├─ Map edge_type → field to update                       │      │
│  │ ├─ Resolve conflicts (weighted avg by confidence)        │      │
│  │ └─ Output: StateUpdate[]                                │      │
│  └────────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────┐      │
│  │ COMMIT TO NODES                                          │      │
│  │ ├─ Update propagationState fields                        │      │
│  │ ├─ Mark dataFreshness = 1                                │      │
│  │ └─ Output: Modified nodes                               │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  Services:                                                       │
│  ├─ graphPropagationEngine.ts [main orchestration]              │
│  ├─ PropagationScorer [cascade computation]                    │
│  ├─ StateDispatcher [conflict resolution]                       │
│  └─ GraphNode [enriched node schema]                            │
│                                                                  │
│  Status: ✅ COMPLETE (Phase A)                                   │
└───────────┬──────────────────────────────────────────────────────┘
            │
            │  Modified nodes with propagationState
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 5: NURU - CAPITAL DECISION LAYER (Ready for wiring)         │
│                                                                  │
│  Input:  Modified nodes with propagatedRiskScore               │
│  Process: Treasury scoring, allocation optimization             │
│  Output:  Allocation decisions                                  │
│                                                                  │
│  Features:                                                       │
│  ├─ Reads: node.propagationState (14 metrics)                   │
│  ├─ Computes: treasury risk by asset                           │
│  ├─ Decides: rebalancing, hedges, position sizes               │
│  └─ Outputs: allocation targets per node                        │
│                                                                  │
│  Status: 🔄 AWAITING Layer 4 integration                         │
└───────────┬──────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 6: KWETU - EXECUTION LAYER (Ready for wiring)              │
│                                                                  │
│  Input:  Allocation targets from Layer 5                        │
│  Process: Order routing, execution, slippage management          │
│  Output:  Execution metrics (filled, slippage, fees)             │
│                                                                  │
│  Feedback Loop:                                                 │
│  └─ Execution metrics → Layer 4 for future cascades             │
│                                                                  │
│  Status: 🔄 AWAITING Layer 4 integration                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Propagation Flow: Step-by-Step

```
EVENT: BTC Volatility Spikes (0.4 → 0.8)
│
├─ OHLCV Service detects
│  └─ volatility crosses threshold
│     └─ Emits PropagationDelta
│        {
│          nodeId: 'BTC',
│          deltaType: 'volatility',
│          magnitude: 1.0 (extreme),
│          timestamp: now
│        }
│
├─ PROPAGATION ENGINE RECEIVES
│  │
│  └─ Step 1: PROPAGATION SCORER
│     │
│     ├─ Find outgoing edges from BTC
│     │  ├─ BTC → ETH (correlates_with, weight=0.85)
│     │  ├─ BTC → SOL (correlates_with, weight=0.72)
│     │  ├─ BTC → ADA (correlates_with, weight=0.6)
│     │  ├─ BTC Vault (structural, weight=0.9)
│     │  └─ ... 15 more edges
│     │
│     ├─ For each edge, compute cascade
│     │  │
│     │  ├─ ETH cascade:
│     │  │  ├─ adjustment% = 0.85 * 1.0 = 0.85 (85% propagation)
│     │  │  ├─ confidence = 0.85 (edge weight)
│     │  │  └─ reasoning: "Highly correlated assets"
│     │  │
│     │  ├─ SOL cascade:
│     │  │  ├─ adjustment% = 0.72 * 1.0 = 0.72 (72% propagation)
│     │  │  ├─ confidence = 0.72
│     │  │  └─ reasoning: "Correlated assets"
│     │  │
│     │  ├─ BTC Vault cascade:
│     │  │  ├─ adjustment% = 0.9 * 1.0 = 0.9 (90% propagation)
│     │  │  ├─ confidence = 0.9 (structural edge strength)
│     │  │  └─ reasoning: "Vaults backing the asset"
│     │  │
│     │  └─ ... etc
│     │
│     └─ Return: CascadeEffect[] (20+ cascades)
│
├─ STATE DISPATCHER
│  │
│  ├─ Convert cascades to field updates
│  │  │
│  │  ├─ ETH updates:
│  │  │  ├─ correlationBias: +0.7 (cascaded bullish bias)
│  │  │  ├─ signalConfidence: +0.35 (cascade boosts confidence)
│  │  │  └─ volatilityScore: +0.25 (vol contagion)
│  │  │
│  │  ├─ SOL updates:
│  │  │  ├─ correlationBias: +0.55
│  │  │  ├─ signalConfidence: +0.25
│  │  │  └─ volatilityScore: +0.2
│  │  │
│  │  └─ BTC Vault updates:
│  │     └─ causalityRisk: +0.4
│  │
│  ├─ Resolve conflicts (none in this example)
│  └─ Return: StateUpdate[] (14 updates)
│
├─ COMMIT TO NODES
│  │
│  ├─ ETH node:
│  │  ├─ volatilityScore = 0.25 + 0.25 = 0.5
│  │  ├─ correlationBias = 0 + 0.7 = 0.7
│  │  ├─ signalConfidence = 0.5 + 0.35 = 0.85
│  │  └─ updatedAt = now, dataFreshness = 1
│  │
│  ├─ SOL node:
│  │  ├─ volatilityScore = 0.35 + 0.2 = 0.55
│  │  ├─ correlationBias = 0 + 0.55 = 0.55
│  │  └─ ...
│  │
│  └─ BTC Vault node:
│     ├─ causalityRisk = 0.3 + 0.4 = 0.7
│     └─ ...
│
└─ OUTPUT: Map<nodeId, Modified GraphNode>
   │
   ├─ 'ETH' → updated node
   ├─ 'SOL' → updated node
   ├─ 'ADA' → updated node
   ├─ 'BTC_Vault' → updated node
   └─ ... etc (20+ modified nodes)
      │
      └─ Ready for NURU to read propagationState
         │
         └─ NURU sees:
            ├─ Volatility spreading through high-beta alts
            ├─ Correlation bias increasing
            ├─ Structural exposure to concentrated BTC
            ├─ Treasury risk score: HIGH
            │
            └─ Decision:
               ├─ Reduce BTC allocation -20%
               ├─ Reduce high-beta alts -15%
               ├─ Increase stablecoins +35%
               └─ Trigger rebalance
```

---

## Edge Types & Propagation Effects

```
Source Node State Change
        │
        ▼
┌─────────────────────────────────────────┐
│ EDGE TYPE DETERMINES PROPAGATION        │
└─────────────────────────────────────────┘

1️⃣ CORRELATES_WITH (Strength: 1.0)
   ├─ Example: BTC ↔ ETH
   ├─ Flow: Bidirectional
   ├─ Effect on target:
   │  ├─ signalBias adjusts same direction
   │  ├─ signalConfidence adjusts
   │  └─ correlationBias shifts
   └─ When: Price movements spread by correlation

2️⃣ LIQUIDITY_SHARED (Strength: 0.8)
   ├─ Example: Uniswap v3 BTC/USDC
   ├─ Flow: Bidirectional
   ├─ Effect on target:
   │  ├─ liquidityScore decreases
   │  ├─ spreadWidthPercent increases
   │  └─ execution cost worsens
   └─ When: Liquidity pressure on one side affects other

3️⃣ STRUCTURAL (Strength: 0.9) ⚠️
   ├─ Example: USDC → Aave Vault (depeg risk)
   ├─ Flow: Unidirectional (source → target)
   ├─ Effect on target:
   │  ├─ depegRisk increases
   │  ├─ counterpartyRisk increases
   │  └─ propagatedRiskScore increases
   └─ When: Collateral/backing assets fail

4️⃣ STRATEGY (Strength: 0.6)
   ├─ Example: Both in mean reversion strategy
   ├─ Flow: Bidirectional
   ├─ Effect on target:
   │  ├─ volatilityScore adjusts
   │  ├─ signalConfidence adjusts
   │  └─ strategy viability changes
   └─ When: Regime shifts affect strategy class

5️⃣ CONTAGION (Strength: 0.7) ⚠️
   ├─ Example: All pairs on FTX during exchange failure
   ├─ Flow: Bidirectional
   ├─ Effect on target:
   │  ├─ causalityRisk increases
   │  ├─ counterpartyRisk increases
   │  └─ propagatedRiskScore increases
   └─ When: Counterparty/exchange health degrades
```

---

## PropagationState Enrichment

```
Before Propagation (Solo Node):
┌────────────────────────────────────────┐
│ GraphNode: BTC/USDT                    │
├────────────────────────────────────────┤
│ Price: $42,500                         │
│ Volume: 5.2B                           │
│                                        │
│ PropagationState:                      │
│ ├─ volatilityScore: 0.6                │
│ ├─ signalBias: neutral                 │
│ ├─ signalConfidence: 0.6               │
│ ├─ liquidityScore: 0.85                │
│ ├─ trendStrength: 0.5                  │
│ └─ correlationBias: 0 (isolated)       │
└────────────────────────────────────────┘

After Propagation (Graph-Aware):
┌────────────────────────────────────────┐
│ GraphNode: BTC/USDT (ENRICHED)         │
├────────────────────────────────────────┤
│ Price: $42,500                         │
│ Volume: 5.2B                           │
│                                        │
│ PropagationState (UPDATED by cascades):│
│ ├─ volatilityScore: 0.65 (+0.05)      │
│   └─ From: contagion edges (exchange) │
│ ├─ signalBias: bullish (changed!)      │
│   └─ From: correlation edges (ETH up) │
│ ├─ signalConfidence: 0.75 (+0.15)     │
│   └─ From: correlated assets voting   │
│ ├─ liquidityScore: 0.82 (-0.03)        │
│   └─ From: liquidity_shared edges      │
│ ├─ trendStrength: 0.75 (+0.25)        │
│   └─ From: trend propagation          │
│ ├─ correlationBias: 0.65 (now aware!) │
│   └─ From: correlated strength        │
│ ├─ causalityRisk: 0.2 (new awareness!)│
│   └─ From: contagion exposure         │
│ └─ propagatedRiskScore: 0.35          │
│   └─ Aggregate of all graph effects    │
└────────────────────────────────────────┘

Why it matters:
OLD: "BTC is neutral, confidence 0.6" → maybe trade it
NEW: "BTC is bullish, but correlated alts show signs of weakness
     and exchange risk is elevated; confidence 0.75 but with
     caution on execution cost" → better decision
```

---

## Cascade Conflict Resolution

```
Scenario: Multiple cascades hit same node field

Source: BTC volatility ↑
Cascades:
  1. BTC → ETH via correlates_with (confidence: 0.85)
     └─ signalConfidence: +0.35
  
  2. BTC → ETH via strategy (same strategy)
     └─ signalConfidence: +0.2
  
  3. BTC → ETH via liquidity_shared
     └─ signalConfidence: -0.1 (liquidity stress)

All three propose changes to 'signalConfidence'

DISPATCHER LOGIC:
├─ Group by field: signalConfidence
├─ Weighted average by confidence:
│  conf_1: 0.85, value: +0.35
│  conf_2: 0.6,  value: +0.2
│  conf_3: 0.4,  value: -0.1
│
├─ total_weight = 0.85 + 0.6 + 0.4 = 1.85
├─ final_value = (0.35×0.85 + 0.2×0.6 + -0.1×0.4) / 1.85
│              = (0.2975 + 0.12 - 0.04) / 1.85
│              = 0.3775 / 1.85
│              = 0.204 ≈ +0.20
│
└─ Result: signalConfidence += 0.20 (net positive)
   └─ Reasoning: "Aggregated from 3 cascades"
```

---

## Phase A Components Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│            GraphPropagationEngine (Main Service)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Private State:                                                  │
│  ├─ nodeMap: Map<nodeId, GraphNode>                              │
│  ├─ edgeMap: Map<fromId, Map<toId, GraphEdge>>                   │
│  ├─ scorer: PropagationScorer                                   │
│  └─ dispatcher: StateDispatcher                                 │
│                                                                  │
│  Public Methods:                                                 │
│  ├─ initializeGraph(nodes[], edges[])                            │
│  ├─ propagate(delta) → Map<nodeId, GraphNode>                    │
│  ├─ propagateBatch(deltas[]) → Map<nodeId, GraphNode>           │
│  ├─ getNode(nodeId) → GraphNode                                  │
│  ├─ getAllNodes() → GraphNode[]                                  │
│  ├─ updateNodeState(nodeId, updates) → GraphNode                │
│  ├─ getCascadesToTarget(sourceId) → CascadeEffect[]             │
│  └─ exportState() → {nodes[], edges[], timestamp}                │
│                                                                  │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
               ▼                             ▼
    ┌────────────────────────┐ ┌──────────────────────────┐
    │ PropagationScorer      │ │ StateDispatcher          │
    ├────────────────────────┤ ├──────────────────────────┤
    │ Input:                 │ │ Input:                   │
    │ - PropagationDelta     │ │ - CascadeEffect[]        │
    │                        │ │                          │
    │ Process:               │ │ Process:                 │
    │ - Find neighbors       │ │ - Cascade → StateUpdate  │
    │ - Score each cascade   │ │ - Group by field         │
    │ - Calculate confidence │ │ - Resolve conflicts      │
    │ - Generate reasoning   │ │ - Weighted average       │
    │                        │ │                          │
    │ Output:                │ │ Output:                  │
    │ - CascadeEffect[]      │ │ - StateUpdate[]          │
    └────────────────────────┘ └──────────────────────────┘
                                       │
                                       ▼
                             ┌──────────────────────────┐
                             │ Commit to Nodes          │
                             ├──────────────────────────┤
                             │ For each StateUpdate:    │
                             │ - Get target node        │
                             │ - Update field value     │
                             │ - Set dataFreshness=1    │
                             │ - Update timestamp       │
                             │                          │
                             │ Return: Modified nodes   │
                             └──────────────────────────┘
```

---

## Integration Ready Point

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE A: COMPLETE ✅                                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ✅ Node Schema: PropagationState (15 metrics)                 │
│ ✅ Edge Weights: All 5 types with multipliers                 │
│ ✅ Scorer: Cascade computation logic                          │
│ ✅ Dispatcher: Conflict resolution & commit                   │
│ ✅ Engine: Orchestration & lifecycle                          │
│ ✅ TypeScript: Full type safety, zero errors                  │
│ ✅ Documentation: Complete with examples                      │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ READY FOR PHASE B: Integration                          │  │
│ │                                                          │  │
│ │ TODO:                                                    │  │
│ │ ├─ Wire OHLCV Service → graphPropagationEngine          │  │
│ │ ├─ Wire TA Service → graphPropagationEngine             │  │
│ │ ├─ Wire graphPropagationEngine → NURU                   │  │
│ │ ├─ Add cascade monitoring/telemetry                     │  │
│ │ ├─ Add circuit breaker (prevent loops)                  │  │
│ │ └─ Performance testing at scale                         │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
