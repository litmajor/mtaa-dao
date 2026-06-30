 /**
 * Graph Propagation Engine - Layer 4: Capital Intelligence
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Symbol Universe (Graph)                               │
 * │ ├─ Nodes: Assets, Pairs, Chains, Vaults, DAOs        │
 * │ └─ Edges: Trades, Correlates, Bridges, etc.          │
 * ├─────────────────────────────────────────────────────────┤
 * │ OHLCV Service (State Annotation)                      │
 * │ └─ Time-series data on nodes                          │
 * ├─────────────────────────────────────────────────────────┤
 * │ Technical Analysis Service (Signal Annotation)        │
 * │ └─ Indicators & regime signals                        │
 * ├─────────────────────────────────────────────────────────┤
 * │ Graph Propagation Engine (THIS LAYER)             │
 * │ ├─ Node State Schema (extended)                       │
 * │ ├─ Edge Weights (5 types)                             │
 * │ ├─ Propagation Scorer (cascade logic)                 │
 * │ └─ State Dispatcher (apply changes)                   │
 * ├─────────────────────────────────────────────────────────┤
 * │ Capital Decision Layer (NURU - reads propagated state)│
 * │ └─ Treasury scoring, allocation decisions             │
 * └─────────────────────────────────────────────────────────┘
 * 
 * Without propagation: "BTC is bullish" (local signal)
 * With propagation: "BTC bullish + correlated alts bullish + liquidity deep" (systemic)
 */

import { logger } from '../utils/logger';
import { cacheService } from './cacheService';

// ════════════════════════════════════════════════════════════════════════════════
// 1️⃣ NODE SCHEMA - Extended Symbol Universe with Propagatable State
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Node Types in the Graph
 */
export type NodeType = 'asset' | 'pair' | 'chain' | 'exchange' | 'vault' | 'dao' | 'strategy';

/**
 * Propagatable State on Nodes
 * This enriches Symbol Universe with market-derived state
 */
export interface PropagationState {
  // Risk metrics
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  volatilityScore: number; // 0-1, quantified
  volatilityTrend: 'increasing' | 'stable' | 'decreasing';
  
  // Price action
  trendRegime: 'uptrend' | 'downtrend' | 'range';
  trendStrength: number; // 0-1
  trendConfidence: number; // 0-1
  
  // Technical signals
  signalBias: 'bullish' | 'neutral' | 'bearish'; // majority vote
  signalConfidence: number; // 0-1, how aligned are indicators
  signalWeight: number; // composite strength
  
  // Liquidity metrics
  liquidityQuality: 'thin' | 'fair' | 'good' | 'deep';
  liquidityScore: number; // 0-1
  spreadWidthPercent: number; // execution cost
  
  // Structural risk
  depegRisk: number; // 0-1, stablecoins
  counterpartyRisk: number; // 0-1, centralized venues
  
  // Derived from graph propagation
  correlationBias: number; // -1 to +1, biased by connected nodes
  causalityRisk: number; // 0-1, risk of contagion from neighbors
  propagatedRiskScore: number; // 0-1, combined graph effects
  
  // Confidence metadata
  dataFreshness: number; // 0-1, 1 = fresh, 0 = stale
  updatedAt: number; // timestamp
}

/**
 * Full Node Definition
 */
export interface GraphNode {
  // Identity
  nodeId: string; // e.g., "BTC", "BTC/USDT", "ethereum", "aave-vault"
  nodeType: NodeType;
  symbol?: string;
  chain?: string;
  
  // Relationships
  edges: {
    outgoing: string[]; // references to connected node IDs
    incoming: string[];
  };
  
  // Base attributes (from Symbol Universe)
  attributes: {
    marketCap?: number;
    volume24h?: number;
    liquidity?: number;
    decimals?: number;
    chains?: string[];
    exchanges?: string[];
  };
  
  // Market state (from OHLCV + TA)
  currentPrice?: number;
  priceChange24h?: number;
  
  // Propagatable state (Layer 4)
  propagationState: PropagationState;
  
  // Signal history (for delta tracking)
  previousSignalBias?: 'bullish' | 'neutral' | 'bearish';
  signalChanged?: boolean;
  confidenceShift?: number; // confidence change from previous cycle
}

/**
 * Initialize node with default propagation state
 */
export function initializeNode(nodeId: string, nodeType: NodeType): GraphNode {
  return {
    nodeId,
    nodeType,
    edges: {
      outgoing: [],
      incoming: [],
    },
    attributes: {},
    propagationState: {
      volatilityRegime: 'normal',
      volatilityScore: 0.5,
      volatilityTrend: 'stable',
      trendRegime: 'range',
      trendStrength: 0.5,
      trendConfidence: 0.5,
      signalBias: 'neutral',
      signalConfidence: 0.5,
      signalWeight: 0.5,
      liquidityQuality: 'fair',
      liquidityScore: 0.5,
      spreadWidthPercent: 0.1,
      depegRisk: 0,
      counterpartyRisk: 0.3,
      correlationBias: 0,
      causalityRisk: 0.3,
      propagatedRiskScore: 0.3,
      dataFreshness: 1,
      updatedAt: Date.now(),
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 2️⃣ EDGE WEIGHTS - All 5 Relationship Types
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 5 Edge Types with Multipliers for Propagation
 */
export type EdgeType =
  | 'correlates_with'    // Price correlation (strongest)
  | 'liquidity_shared'   // Pool/liquidity connections
  | 'structural'        // Stablecoin pegs, collateral relationships
  | 'strategy'          // Used in same strategies
  | 'contagion';        // Exchange/counterparty links

/**
 * Edge in the graph with directional weight
 */
export interface GraphEdge {
  from: string; // source node ID
  to: string;   // target node ID
  edgeType: EdgeType;
  
  // Weight: 0-1, how strongly does state flow?
  weight: number;
  
  // Directional: one-way or two-way
  directional: boolean;
  
  // Multiplier by edge type: how much effect does it have?
  typeMultiplier: number;
  
  // Metadata
  metadata?: {
    correlation?: number; // for correlates_with
    poolId?: string;      // for liquidity_shared
    collateralRatio?: number; // for structural
  };
  
  updatedAt: number;
}

/**
 * Edge Type Definitions - Multipliers & Rules
 */
export const EDGE_DEFINITIONS = {
  correlates_with: {
    description: 'Price correlation - when one moves, the other tends to move similarly',
    baseMultiplier: 1.0,  // strongest effect
    bidirectional: true,
    riskCategory: 'systemic',
    example: 'BTC → ETH (0.85 correlation)',
  },
  
  liquidity_shared: {
    description: 'Shared liquidity pools - AMM pairs, DEX connections',
    baseMultiplier: 0.8,
    bidirectional: true,
    riskCategory: 'execution',
    example: 'BTC/USDC in Uniswap v3 → affects both sides',
  },
  
  structural: {
    description: 'Stablecoin pegs, collateral backing, vault compositions',
    baseMultiplier: 0.9,
    bidirectional: false, // unidirectional (depeg affects collateral)
    riskCategory: 'structural',
    example: 'USDC depeg → vaults using USDC as collateral',
  },
  
  strategy: {
    description: 'Used in same strategy - mean reversion pairs, spread trades',
    baseMultiplier: 0.6,
    bidirectional: true,
    riskCategory: 'opportunity',
    example: 'BTC & ETH both in volatility strategy → regime shifts affect both',
  },
  
  contagion: {
    description: 'Exchange/counterparty links - exchange failure affects all pairs on it',
    baseMultiplier: 0.7,
    bidirectional: true,
    riskCategory: 'counterparty',
    example: 'FTX exchange → all pairs on FTX at risk',
  },
};

/**
 * Calculate edge multiplier based on type and metadata
 */
export function calculateEdgeMultiplier(
  edgeType: EdgeType,
  metadata?: Record<string, any>
): number {
  const base = EDGE_DEFINITIONS[edgeType]?.baseMultiplier || 0.5;
  
  // Adjust by metadata
  if (edgeType === 'correlates_with' && metadata?.correlation) {
    // Higher correlation = stronger propagation
    return base * Math.abs(metadata.correlation);
  }
  
  return base;
}

// ════════════════════════════════════════════════════════════════════════════════
// 3️⃣ PROPAGATION SCORER - Computes Cascade Effects
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Propagation Delta: What changed at a node?
 */
export interface PropagationDelta {
  nodeId: string;
  deltaType: 'volatility' | 'trend' | 'signal' | 'liquidity' | 'structural';
  
  // What changed
  previousValue: number | string;
  newValue: number | string;
  magnitude: number; // 0-1, how big is this change?
  threshold: number; // was magnitude >= some threshold?
  
  timestamp: number;
}

/**
 * Cascade Effect: How does this delta propagate to neighbors?
 */
export interface CascadeEffect {
  sourceNode: string;
  targetNode: string;
  edgeType: EdgeType;
  edgeWeight: number;
  
  // Adjustment to target node
  adjustmentDirection: 'same' | 'opposite'; // does target move with or against source?
  adjustmentPercent: number; // 0-1, what % of source delta flows to target?
  
  // Confidence
  confidence: number; // 0-1, how sure are we of this cascade?
  
  // Metadata
  reasoning: string; // why is this cascade happening?
  // Hop distance from original source (1 = direct neighbor)
  hop?: number;
}

/**
 * The Propagation Scorer: Given a delta at a node,
 * compute cascades to all connected neighbors
 */
export class PropagationScorer {
  private nodeMap: Map<string, GraphNode> = new Map();
  private edgeMap: Map<string, Map<string, GraphEdge>> = new Map(); // from → (to → edge)
  
  constructor(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ) {
    // Build internal maps for traversal
    nodes.forEach(n => this.nodeMap.set(n.nodeId, n));
    
    edges.forEach(e => {
      if (!this.edgeMap.has(e.from)) {
        this.edgeMap.set(e.from, new Map());
      }
      this.edgeMap.get(e.from)!.set(e.to, e);
      
      if (!e.directional) {
        if (!this.edgeMap.has(e.to)) {
          this.edgeMap.set(e.to, new Map());
        }
        this.edgeMap.get(e.to)!.set(e.from, {
          ...e,
          from: e.to,
          to: e.from,
        });
      }
    });
  }
  
  /**
   * Main entry point: Given a node state change,
   * return all cascades to neighbors
   */
  computeCascades(delta: PropagationDelta): CascadeEffect[] {
    const sourceNode = this.nodeMap.get(delta.nodeId);
    if (!sourceNode) return [];

    const cascades: CascadeEffect[] = [];

    // Multi-hop BFS traversal with dampening
    const maxHops = 3;
    const visited = new Set<string>();
    visited.add(delta.nodeId);

    type QueueEntry = { currentId: string; edge: GraphEdge; hop: number; };
    const queue: QueueEntry[] = [];

    // Seed with direct neighbors
    const neighbors = this.edgeMap.get(delta.nodeId) || new Map();
    neighbors.forEach((edge, targetId) => {
      const targetNode = this.nodeMap.get(targetId);
      if (!targetNode) return;
      queue.push({ currentId: targetId, edge, hop: 1 });
    });

    while (queue.length > 0) {
      const entry = queue.shift()!;
      const { currentId, edge, hop } = entry;

      if (visited.has(currentId)) continue;

      const targetNode = this.nodeMap.get(currentId);
      if (!targetNode) continue; // safety

      const cascade = this.scoreCascade(sourceNode, targetNode, edge, delta, hop);
      if (cascade) {
        cascade.hop = hop;
        cascades.push(cascade);
      }

      visited.add(currentId);

      if (hop < maxHops) {
        const nextNeighbors = this.edgeMap.get(currentId) || new Map();
        nextNeighbors.forEach((nextEdge, nextId) => {
          if (visited.has(nextId)) return;
          queue.push({ currentId: nextId, edge: nextEdge, hop: hop + 1 });
        });
      }
    }

    return cascades;
  }
  
  /**
   * Score a single cascade: sourceNode → targetNode via edge
   */
  private scoreCascade(
    sourceNode: GraphNode,
    targetNode: GraphNode,
    edge: GraphEdge,
    delta: PropagationDelta,
    hop: number = 1
  ): CascadeEffect | null {
    // Effective magnitude considers edge weight, type multiplier, correlation metadata, and hop dampening
    const typeMult = edge.typeMultiplier || 1;
    const corrFactor = edge.edgeType === 'correlates_with' && edge.metadata?.correlation
      ? Math.abs(edge.metadata.correlation)
      : 1;

    const hopDampening = Math.pow(0.6, hop - 1);

    const effectiveMagnitude = delta.magnitude * (edge.weight || 1) * typeMult * corrFactor * hopDampening;

    // Edge-specific thresholding (contagion is more sensitive)
    const baseThreshold = delta.threshold || 0.3;
    const edgeThreshold = edge.edgeType === 'contagion' ? Math.min(0.12, baseThreshold * 0.6) : baseThreshold * Math.pow(0.8, hop - 1);

    if (effectiveMagnitude < edgeThreshold) return null;

    const adjustment = this.calculateAdjustment(
      sourceNode,
      targetNode,
      edge,
      delta,
      hop,
      effectiveMagnitude
    );

    return {
      sourceNode: sourceNode.nodeId,
      targetNode: targetNode.nodeId,
      edgeType: edge.edgeType,
      edgeWeight: edge.weight,
      adjustmentDirection: adjustment.direction,
      adjustmentPercent: adjustment.percent,
      confidence: this.calculateConfidence(edge, delta) * Math.pow(0.9, hop - 1),
      reasoning: this.generateReasoning(edge, delta),
    };
  }
  
  /**
   * Calculate which direction and how much adjustment
   */
  private calculateAdjustment(
    sourceNode: GraphNode,
    targetNode: GraphNode,
    edge: GraphEdge,
    delta: PropagationDelta,
    hop: number,
    effectiveMagnitude: number
  ): { direction: 'same' | 'opposite'; percent: number } {
    // Direction: inverse correlation causes opposite adjustment
    const isInverseCorrelation =
      edge.edgeType === 'correlates_with' &&
      edge.metadata?.correlation &&
      edge.metadata.correlation < -0.5;

    const direction = isInverseCorrelation ? 'opposite' : 'same';

    // Base percent starts from effectiveMagnitude (already includes edge weight and hop dampening)
    let percent = effectiveMagnitude;

    // Use propagation state context to modulate percent
    const sourceState = sourceNode.propagationState;
    const targetState = targetNode.propagationState;

    const sourceBoost = (sourceState.signalConfidence || 0) * 0.25 + (sourceState.volatilityScore || 0) * 0.15;
    const targetDamp = (targetState.liquidityScore || 0) * 0.35; // deeper liquidity dampens propagation

    percent = percent * (1 + sourceBoost - targetDamp);

    // If edge has explicit correlation metadata, scale by that
    if (edge.edgeType === 'correlates_with' && edge.metadata?.correlation) {
      percent = percent * Math.abs(edge.metadata.correlation);
    }

    // Clamp
    percent = Math.max(0, Math.min(1, percent));

    return {
      direction,
      percent,
    };
  }
  
  /**
   * Confidence in this cascade
   */
  private calculateConfidence(edge: GraphEdge, delta: PropagationDelta): number {
    // Confidence based on:
    // - Edge weight (stronger edges more confident)
    // - Data freshness (stale data = lower confidence)
    // - Delta magnitude (bigger changes more certain)
    
    const edgeConfidence = edge.weight;
    const magnitudeConfidence = Math.min(delta.magnitude, 1);
    
    return (edgeConfidence + magnitudeConfidence) / 2;
  }
  
  /**
   * Generate human-readable explanation
   */
  private generateReasoning(edge: GraphEdge, delta: PropagationDelta): string {
    const prefix = `${delta.deltaType} at source`;
    const linkage = EDGE_DEFINITIONS[edge.edgeType]?.description || 'connected';
    return `${prefix} → ${linkage} → affects target`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 4️⃣ STATE DISPATCHER - Applies Adjustments to Neighbor Nodes
// ════════════════════════════════════════════════════════════════════════════════

/**
 * State Update: What to change on a node
 */
export interface StateUpdate {
  nodeId: string;
  field: keyof PropagationState;
  currentValue: number;
  proposedValue: number;
  reason: string; // which cascade caused this?
  confidence: number; // 0-1
}

/**
 * The State Dispatcher: Takes cascades and applies them to nodes,
 * with conflict resolution for multiple cascades hitting same field
 */
export class StateDispatcher {
  private nodeMap: Map<string, GraphNode>;
  
  constructor(nodes: GraphNode[]) {
    this.nodeMap = new Map(nodes.map(n => [n.nodeId, n]));
  }
  
  /**
   * Apply cascades to nodes: generates proposed state updates
   */
  applyPropagation(cascades: CascadeEffect[]): StateUpdate[] {
    const updateMap = new Map<string, StateUpdate[]>(); // nodeId → updates
    
    // Group cascades by target node
    cascades.forEach(cascade => {
      const targetNode = this.nodeMap.get(cascade.targetNode);
      if (!targetNode) return;
      
      // Convert cascade to state updates
      const updates = this.cascadeToUpdates(cascade, targetNode);
      
      if (!updateMap.has(cascade.targetNode)) {
        updateMap.set(cascade.targetNode, []);
      }
      updateMap.get(cascade.targetNode)!.push(...updates);
    });
    
    // Resolve conflicts: multiple cascades on same field
    const finalUpdates: StateUpdate[] = [];
    updateMap.forEach((updates, nodeId) => {
      finalUpdates.push(...this.resolveConflicts(updates));
    });
    
    return finalUpdates;
  }
  
  /**
   * Convert a cascade effect to concrete state updates
   */
  private cascadeToUpdates(cascade: CascadeEffect, targetNode: GraphNode): StateUpdate[] {
    const updates: StateUpdate[] = [];
    const state = targetNode.propagationState;
    
    // Map cascade to specific field updates based on edge type
    switch (cascade.edgeType) {
      case 'correlates_with':
        // Correlation cascades affect: signalBias, correlationBias
        updates.push({
          nodeId: cascade.targetNode,
          field: 'correlationBias',
          currentValue: state.correlationBias,
          proposedValue: this.adjustBias(
            state.correlationBias,
            cascade.adjustmentPercent,
            cascade.adjustmentDirection
          ),
          reason: `Cascaded from ${cascade.sourceNode} via correlation`,
          confidence: cascade.confidence,
        });
        break;
        
      case 'liquidity_shared':
        // Liquidity cascades affect: liquidityScore, spreadWidthPercent
        updates.push({
          nodeId: cascade.targetNode,
          field: 'liquidityScore',
          currentValue: state.liquidityScore,
          proposedValue: Math.max(
            0,
            state.liquidityScore - cascade.adjustmentPercent * 0.2
          ),
          reason: `Cascaded from ${cascade.sourceNode} via shared liquidity`,
          confidence: cascade.confidence,
        });
        break;
        
      case 'structural':
        // Structural cascades affect: depegRisk, counterpartyRisk
        updates.push({
          nodeId: cascade.targetNode,
          field: 'depegRisk',
          currentValue: state.depegRisk,
          proposedValue: Math.min(
            1,
            state.depegRisk + cascade.adjustmentPercent
          ),
          reason: `Cascaded from ${cascade.sourceNode} via structural link`,
          confidence: cascade.confidence,
        });
        break;
        
      case 'strategy':
        // Strategy cascades affect: signalConfidence, volatilityScore
        updates.push({
          nodeId: cascade.targetNode,
          field: 'volatilityScore',
          currentValue: state.volatilityScore,
          proposedValue: Math.min(
            1,
            state.volatilityScore + cascade.adjustmentPercent * 0.3
          ),
          reason: `Cascaded from ${cascade.sourceNode} via strategy link`,
          confidence: cascade.confidence,
        });
        break;
        
      case 'contagion':
        // Contagion cascades affect: causalityRisk, propagatedRiskScore
        updates.push({
          nodeId: cascade.targetNode,
          field: 'causalityRisk',
          currentValue: state.causalityRisk,
          proposedValue: Math.min(
            1,
            state.causalityRisk + cascade.adjustmentPercent
          ),
          reason: `Cascaded from ${cascade.sourceNode} via contagion`,
          confidence: cascade.confidence,
        });
        break;
    }
    
    return updates;
  }
  
  /**
   * Helper: adjust a bias value (-1 to +1) by percentage
   */
  private adjustBias(
    current: number,
    percent: number,
    direction: 'same' | 'opposite'
  ): number {
    const adjustment = percent * (direction === 'same' ? 1 : -1);
    const newValue = current + adjustment;
    return Math.max(-1, Math.min(1, newValue)); // clamp to [-1, 1]
  }
  
  /**
   * Conflict resolution: multiple cascades hitting same field
   * Takes weighted average, prioritizes high-confidence updates
   */
  private resolveConflicts(updates: StateUpdate[]): StateUpdate[] {
    // Group by field
    const byField = new Map<keyof PropagationState, StateUpdate[]>();
    
    updates.forEach(u => {
      if (!byField.has(u.field)) {
        byField.set(u.field, []);
      }
      byField.get(u.field)!.push(u);
    });
    
    // Resolve each field
    const resolved: StateUpdate[] = [];
    byField.forEach((fieldUpdates, field) => {
      if (fieldUpdates.length === 1) {
        // No conflict
        resolved.push(fieldUpdates[0]);
      } else {
        // Multiple updates: weighted average by confidence
        const totalConfidence = fieldUpdates.reduce(
          (sum, u) => sum + u.confidence,
          0
        );
        
        const proposedValue =
          fieldUpdates.reduce(
            (sum, u) =>
              sum + (u.proposedValue as number) * (u.confidence / totalConfidence),
            0
          );
        
        resolved.push({
          nodeId: fieldUpdates[0].nodeId,
          field,
          currentValue: fieldUpdates[0].currentValue,
          proposedValue,
          reason: `Aggregated from ${fieldUpdates.length} cascades`,
          confidence: Math.min(1, totalConfidence / fieldUpdates.length),
        });
      }
    });
    
    return resolved;
  }
  
  /**
   * Commit state updates: actually modify nodes
   */
  commitUpdates(updates: StateUpdate[]): Map<string, GraphNode> {
    const modified = new Map<string, GraphNode>();
    
    updates.forEach(update => {
      const node = this.nodeMap.get(update.nodeId);
      if (!node) return;
      
      // For numeric fields, update directly
      if (typeof update.proposedValue === 'number') {
        (node.propagationState[update.field] as number) = update.proposedValue;
        node.propagationState.updatedAt = Date.now();
        node.propagationState.dataFreshness = 1; // Mark as fresh
      }
      
      // Recompute propagatedRiskScore based on updated state
      try {
        node.propagationState.propagatedRiskScore = this.computePropagatedRiskScore(node.propagationState);
      } catch (e) {
        // if recompute fails, keep previous value
      }

      modified.set(update.nodeId, node);
    });
    
    return modified;
  }

  /**
   * Compute a conservative propagated risk score from propagation state
   * Weighted composite of structural/contagion/volatility/liquidity factors
   */
  private computePropagatedRiskScore(state: PropagationState): number {
    const causality = state.causalityRisk || 0;
    const depeg = state.depegRisk || 0;
    const counterparty = state.counterpartyRisk || 0;
    const volatility = state.volatilityScore || 0;
    const liquidity = typeof state.liquidityScore === 'number' ? state.liquidityScore : 0.5;

    // Weighted combination (tunable)
    const raw =
      0.35 * causality +
      0.25 * depeg +
      0.2 * counterparty +
      0.15 * volatility +
      0.05 * (1 - liquidity);

    return Math.max(0, Math.min(1, raw));
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN SERVICE: Graph Propagation Engine
// ════════════════════════════════════════════════════════════════════════════════

export class GraphPropagationEngine {
  private scorer: PropagationScorer;
  private dispatcher: StateDispatcher;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private initialized: boolean = false;
  
  constructor() {
    this.scorer = new PropagationScorer([], []);
    this.dispatcher = new StateDispatcher([]);
  }
  
  /**
   * Initialize graph from Symbol Universe + OHLCV + TA state
   */
  initializeGraph(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.nodes = new Map(nodes.map(n => [n.nodeId, n]));
    this.edges = new Map(edges.map((e, i) => [`${e.from}->${e.to}`, e]));
    
    this.scorer = new PropagationScorer(nodes, edges);
    this.dispatcher = new StateDispatcher(nodes);
    this.initialized = true;
    
    logger.info(`📊 Graph initialized: ${nodes.length} nodes, ${edges.length} edges`);
  }
  
  /**
   * Main propagation cycle:
   * 1. Detect node state change
   * 2. Score cascades to neighbors
   * 3. Apply state updates with conflict resolution
   * 4. Return modified nodes
   */
  propagate(delta: PropagationDelta): Map<string, GraphNode> {
    if (!this.initialized) {
      logger.warn(`Attempted to propagate before engine initialized: ${delta.nodeId}`);
      return new Map();
    }

    logger.info(
      `⚡ Propagating ${delta.deltaType} change on ${delta.nodeId} (magnitude: ${delta.magnitude})`
    );
    
    // Guard: ensure source node exists
    if (!this.nodes.has(delta.nodeId)) {
      logger.warn(`Propagate called for unknown node: ${delta.nodeId}`);
      return new Map();
    }
    
    // Step 1: Score cascades
    const cascades = this.scorer.computeCascades(delta);
    logger.debug(`  ├─ Found ${cascades.length} cascades`);
    
    // Step 2: Apply to nodes
    const updates = this.dispatcher.applyPropagation(cascades);
    logger.debug(`  ├─ Generated ${updates.length} state updates`);
    
    // Step 3: Commit changes
    const modified = this.dispatcher.commitUpdates(updates);
    logger.debug(`  └─ Modified ${modified.size} nodes`);
    
    return modified;
  }
  
  /**
   * Batch propagation: multiple deltas in one cycle
   */
  propagateBatch(deltas: PropagationDelta[]): Map<string, GraphNode> {
    const allModified = new Map<string, GraphNode>();
    if (!this.initialized) {
      logger.warn('Attempted batch propagate before engine initialized');
      return allModified;
    }

    // Collect cascades for all deltas first (snapshot behavior)
    const allCascades: CascadeEffect[] = [];
    deltas.forEach(delta => {
      if (!this.nodes.has(delta.nodeId)) {
        logger.warn(`Batch propagate: unknown source node ${delta.nodeId}, skipping`);
        return;
      }
      const cascades = this.scorer.computeCascades(delta);
      if (cascades && cascades.length > 0) {
        allCascades.push(...cascades);
      }
    });

    // Apply all cascades at once and commit a single update set
    const updates = this.dispatcher.applyPropagation(allCascades);
    const modified = this.dispatcher.commitUpdates(updates);

    modified.forEach((node, nodeId) => allModified.set(nodeId, node));

    return allModified;
  }
  
  /**
   * Get node state
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }
  
  /**
   * Get all nodes
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Update node from external source (OHLCV, TA)
   */
  updateNodeState(
    nodeId: string,
    updates: Partial<GraphNode>
  ): GraphNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    
    Object.assign(node, updates);
    node.propagationState.updatedAt = Date.now();
    
    return node;
  }
  
  /**
   * Get cascades to specific target (for visibility)
   */
  getCascadesToTarget(sourceNodeId: string): CascadeEffect[] {
    const delta: PropagationDelta = {
      nodeId: sourceNodeId,
      deltaType: 'signal',
      previousValue: 'neutral',
      newValue: 'bullish',
      magnitude: 0.5,
      threshold: 0.5,
      timestamp: Date.now(),
    };
    
    return this.scorer.computeCascades(delta);
  }
  
  /**
   * Export state for caching/monitoring
   */
  exportState(): {
    nodes: GraphNode[];
    edges: GraphEdge[];
    timestamp: number;
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      timestamp: Date.now(),
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 🎯 SINGLETON INSTANCE
// ════════════════════════════════════════════════════════════════════════════════

export const graphPropagationEngine = new GraphPropagationEngine();

export default graphPropagationEngine;
