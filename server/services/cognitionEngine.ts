/**
 * Cognition Engine
 *
 * Decision-making layer for DAO treasury intelligence.
 *
 * Consumes:
 * - AssetStateSnapshot (from Intelligence Shards)
 * - TreasuryPosition (current holdings)
 * - TreasuryContext (DAO type, risk tolerance, time horizon)
 *
 * Produces:
 * - CognitionOutput with scored recommendations + reasoning
 *
 * Core Principle: SAME ASSET, DIFFERENT DAO = DIFFERENT DECISION
 *
 * DAO Types (from shared/types/dao.ts) with different Cognition logic:
 * - harambee:     single-payout, urgency-mode emergency/cause fund
 * - shortTerm:    fixed-duration savings, milestone-gated withdrawal
 * - savings:      ongoing accumulation, optional yield, moderate lending
 * - merryGoRound: ROSCA — scheduled rotation payout, hard grace-period deadline
 * - community:    multisig-governed general treasury, full loan facility
 * - investment:   MultiAssetVault, active rebalancing, yield-first
 *
 * ================================================================
 * CHANGES IN THIS REVISION (vs. the version this replaces)
 * ================================================================
 *
 * 1. DaoType now resolves through `../types/assetGraph` to the canonical
 *    6-value union in `shared/types/dao.ts` (harambee, shortTerm, savings,
 *    community, investment, merryGoRound). The old 7-value union (free,
 *    short_term, long_term, bail_fund, funeral_fund, investment_club,
 *    foundation) is gone. Existing persisted AssetNode rows keyed on the
 *    old strings need a separate data migration — this file does not do
 *    that migration.
 *
 * 2. getDefaultObjectiveWeights() and filterGraphByDaoType() were a
 *    switch/if-chain with a silent default branch (generic balanced
 *    weights, or `return true` = unrestricted edge access) for any DaoType
 *    not explicitly named. That meant a newly added DaoType would silently
 *    get the wrong treasury logic instead of failing to compile. Both are
 *    now lookups against DAO_OBJECTIVE_WEIGHTS / DAO_EDGE_RESTRICTIONS,
 *    which are typed as `Record<DaoType, ...>` (a full Record, not
 *    `Partial<...>`). Omitting an entry for any DaoType is now a TypeScript
 *    compile error, not a runtime default. Weight derivations are explained
 *    per-type in the comments above DAO_OBJECTIVE_WEIGHTS.
 *
 * 3. Every `any` in the original file has been replaced with a concrete
 *    type. Doing so surfaced three pre-existing defects that `any` had been
 *    masking — fixed here, not left in place:
 *
 *    a) `this.buildReasoningGraph(query.type, result)` was called with 2
 *       arguments against a 6-parameter method signature (queryType, result,
 *       graphVersion, correlationVersion, context, confidenceFactors). This
 *       would not have compiled even in the original file once `any` return
 *       types stopped hiding it. graphVersion/correlationVersion are not
 *       currently produced anywhere in the query flow (see item 4 below) —
 *       they are threaded through as 0 with an explicit TODO rather than
 *       invented.
 *
 *    b) calculateConfidence() built a `confidenceFactors` array internally
 *       for its own reasoning, then discarded it and returned only the
 *       rounded composite number. buildReasoningGraph() separately expected
 *       to receive that same factors array as a parameter — it never did,
 *       because nothing passed it forward. calculateConfidence() now returns
 *       `{ score, factors }` so the audit trail (VersionedReasoningGraph.
 *       confidenceFactors) actually reflects the computation that already
 *       existed in this file, rather than always being empty.
 *
 *    c) identifyRiskFlags() returned `string[]`, but both
 *       VersionedReasoningGraph.riskFlags and CognitionOutput.riskFlags are
 *       typed as `Array<{ severity; message; affectedAssets? }>`. The
 *       original assignment `riskFlags: this.identifyRiskFlags(...)` inside
 *       querySymbolUniverse's return statement would not type-check against
 *       that shape. identifyRiskFlags() now returns the structured type; the
 *       stub behavior (always empty) is unchanged.
 *
 * 4. NOT changed: none of the analyze*() methods (analyzeAllocation,
 *    analyzeLiquidity, analyzeHedging, optimizeYield, analyzeTrends,
 *    detectArbitrage, analyzeGovernanceImpact, monitorRisk) do real
 *    computation — they return the same static stub objects as the
 *    original file. Fixing (3) required making their *plumbing*
 *    type-correct, but inventing real scoring logic for 8 analysis
 *    functions is a business-logic exercise, not a typing exercise, and
 *    wasn't part of what was asked. Flagging clearly rather than quietly
 *    filling in guessed thresholds: graph/correlation loading methods
 *    (getAssetGraphVersion, getCorrelationMatrix, getGraphContext) are
 *    fully implemented and usable, but none of the analyze*() methods
 *    currently call them — the graph-loading half and the analysis half
 *    of this class are still disconnected, same as before this rewrite.
 *
 * 5. `db: any` replaced with `CognitionDatabaseClient`, a type alias for
 *    Drizzle's `NodePgDatabase`. This assumes a node-postgres driver — if
 *    the real connection uses a different Drizzle driver (postgres-js,
 *    neon-http, neon-serverless), swap the single import at the top of
 *    this file; nothing else needs to change.
 *
 * 6. `strategyRegistry: Map<string, any>` replaced with a keyed object typed
 *    per query type (`Partial<{ [K in CognitionQueryType]:
 *    CognitionStrategy<...> }>`), so a strategy registered under
 *    'allocation_analysis' is checked against AllocationAnalysisQuery /
 *    AllocationAnalysisOutput specifically. Worth flagging: registered
 *    strategies are still not actually invoked anywhere. querySymbolUniverse
 *    always dispatches to the built-in private analyze*() method via the
 *    switch statement, regardless of what's registered — registerStrategy()
 *    only affects the id/version recorded in the audit trail. That gap
 *    predates this rewrite and wasn't introduced by it, but strong typing
 *    makes it more visible: a registered CognitionStrategy now has a real,
 *    checked execute() method that genuinely could run — it just isn't
 *    wired to run. Worth a decision on whether custom strategies should
 *    actually execute before this is relied on for governance-upgradable
 *    logic.
 */

import type {
  AssetStateSnapshot,
  AssetNode,
  AssetEdge,
  AssetEdgeRelationshipType,
  AssetGraphVersion,
  CorrelationMatrix,
  TreasuryPosition,
  TreasuryContext,
  DaoType,
  CognitionStrategy,
  CognitionOutput,
  VersionedReasoningGraph,
} from '../types/assetGraph';
import { logger } from '../utils/logger';
import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  assetGraphVersions,
  assetNodes,
  assetEdges,
  correlationMatrices,
} from '../../shared/schema';

// =============================================================================
// DATABASE CLIENT TYPE
// =============================================================================

/**
 * Assumes a node-postgres Drizzle driver. If the real connection is a
 * different driver (postgres-js, neon-http, neon-serverless), change this
 * one import/alias — nothing else in this file references the driver
 * directly.
 */

type CognitionSchema = {
  assetGraphVersions: typeof assetGraphVersions;
  assetNodes: typeof assetNodes;
  assetEdges: typeof assetEdges;
  correlationMatrices: typeof correlationMatrices;
};

type CognitionDatabaseClient = NodePgDatabase<CognitionSchema>;

// =============================================================================
// COGNITION QUERY TYPES
// =============================================================================

// 1. Allocation Analysis: "What should we do with treasury?"
export interface AllocationAnalysisQuery {
  type: 'allocation_analysis';
  treasuryPositions: TreasuryPosition[];
  currentComposition: Map<string, number>; // symbol -> % of treasury
  targetComposition?: Map<string, number>; // optional target allocation
  context: TreasuryContext;
}

export interface AllocationAnalysisOutput {
  currentRiskScore: number;
  currentVolatility: number;
  currentYield: number;

  candidateAssets: Array<{
    symbol: string;
    riskScore: number;
    expectedYield: number;
    correlationToCurrent: number;
    recommendation: 'increase' | 'maintain' | 'decrease' | 'add' | 'remove';
    rationale: string;
  }>;

  compositeScore: number;
  optimalAllocation: Map<string, number>;
  expectedImpact: {
    riskChange: number;
    volatilityChange: number;
    yieldChange: number;
  };
}

// 2. Liquidity Analysis: "Can we exit this position?"
export interface LiquidityAnalysisQuery {
  type: 'liquidity_analysis';
  assetId: string;
  desiredExitAmount: number; // USD
  timeConstraint?: number; // seconds allowed for exit
  maxSlippageTolerance?: number; // % acceptable slippage
  context: TreasuryContext;
}

export interface LiquidityAnalysisOutput {
  canExit: boolean;
  exitSpeed: 'immediate' | 'fast' | 'slow' | 'illiquid';
  estimatedSlippage: number; // %
  estimatedTimeToExit: number; // seconds
  estimatedNetAmount: number; // Amount received after slippage

  executionPlan: {
    chain: string;
    dex: string;
    route: string[]; // Asset swap path
    bridgeRequired: boolean;
    bridgeCost: number; // %
  };

  alternateRoutes: Array<{
    description: string;
    slippage: number;
    timeRequired: number;
    riskLevel: string;
  }>;

  warnings: string[];
}

// 3. Hedging Analysis: "What hedges our downside?"
export interface HedgingAnalysisQuery {
  type: 'hedging_analysis';
  treasuryPositions: TreasuryPosition[];
  targetDownsideProtection: number; // e.g., 10 for 10% max loss
  context: TreasuryContext;
}

export interface HedgingAnalysisOutput {
  currentDownside: number; // Current portfolio downside risk

  hedgingOptions: Array<{
    assetSymbol: string;
    correlation: number; // Negative = hedge
    recommendedAllocation: number;
    expectedProtection: number; // % downside protected
    cost: number; // Drag on returns
    riskOfHedge: string;
  }>;

  optimalHedgeComposition: Map<string, number>;
  expectedPortfolioSharpe: number;
  hedgingCost: number; // % annual drag
}

// 4. Yield Optimization: "Where can we get better returns?"
export interface YieldOptimizationQuery {
  type: 'yield_optimization';
  treasuryPositions: TreasuryPosition[];
  yieldBudget: number; // Risk budget for yield-seeking
  context: TreasuryContext;
}

export interface YieldOptimizationOutput {
  currentAPY: number;
  currentYieldSources: Array<{
    assetId: string;
    strategy: string;
    apy: number;
    riskScore: number;
  }>;

  opportunitiesRanked: Array<{
    assetId: string;
    symbol: string;
    strategy: string;
    apy: number;
    protocol: string;
    lockPeriod?: number;
    riskScore: number;
    allocateAmount: number;
    expectedAPY: number;
    worstCaseAPY: number;
    timeHorizon: number; // days
  }>;

  recommendedReallocation: Map<string, number>;
  projectedAPY: number;
  sharpeRatioImprovement: number;
}

// 5. Trend Analysis: "What's market direction?"
export interface TrendAnalysisQuery {
  type: 'trend_analysis';
  assets: AssetStateSnapshot[];
  context: TreasuryContext;
}

export interface TrendAnalysisOutput {
  marketSentiment: 'strong_uptrend' | 'uptrend' | 'neutral' | 'downtrend' | 'strong_downtrend';
  volatilityCluster: boolean; // Is volatility spiking?
  volatilityLevel: 'low' | 'medium' | 'high';

  assetTrends: Array<{
    symbol: string;
    trend: string;
    momentum: number;
    signals: {
      rsi: string;
      macd: string;
      bollinger: string;
    };
  }>;

  actionableAlerts: string[]; // "RSI oversold on CELO", etc.
}

// 6. Arbitrage Detection: "Where are the spreads?"
export interface ArbitrageDetectionQuery {
  type: 'arbitrage_detection';
  assets: AssetStateSnapshot[];
  minProfitThreshold: number; // % profit threshold
  context: TreasuryContext;
}

export interface ArbitrageDetectionOutput {
  opportunities: Array<{
    id: string;
    description: string; // "USDC ETH→Base via Wormhole"
    fromChain: string;
    toChain: string;
    fromDex: string;
    toDex: string;
    buyPrice: number;
    sellPrice: number;
    spread: number; // %
    estimatedProfit: number; // USD
    slippageCost: number; // USD
    bridgeCost: number; // USD
    netProfit: number; // USD
    executionTime: number; // seconds
    riskLevel: string;
    confidence: number; // 0-100
  }>;

  topOpportunity?: {
    description: string;
    estimatedProfit: number;
  };
}

// 7. Governance Impact: "How do we propose a rebalance?"
export interface GovernanceImpactQuery {
  type: 'governance_impact';
  proposedChanges: Map<string, number>; // symbol -> new allocation %
  context: TreasuryContext;
}

export interface GovernanceImpactOutput {
  isEligible: boolean; // Does DAO meet governance rules?
  quorumRequired: number;
  eligibilityChecks: Array<{
    check: string;
    passed: boolean;
    reason?: string;
  }>;

  projectedImpact: {
    riskDelta: number;
    volatilityDelta: number;
    yieldDelta: number;
  };

  proposalNarrative: string; // Suggested text for proposal
  recommendedVotingPeriod: number; // hours
  estimatedExecutionTime: number; // hours
}

// 8. Risk Monitoring: "Are we over-concentrated/volatile?"
export interface RiskMonitoringQuery {
  type: 'risk_monitoring';
  treasuryPositions: TreasuryPosition[];
  context: TreasuryContext;
}

export interface RiskMonitoringOutput {
  overallRiskScore: number; // 0-100
  isHealthy: boolean; // Within DAO's risk tolerance?

  violations: Array<{
    type: 'concentration' | 'volatility' | 'liquidity' | 'smart_contract' | 'oracle';
    severity: 'warning' | 'critical';
    description: string;
    affectedAssets: string[];
  }>;

  concentrationMetrics: {
    herfindahl: number; // 0-1, 0 = perfectly diversified
    topThreeExposure: number; // % of portfolio
    recommendation: string;
  };

  recommendations: string[];
}

/**
 * Maps each query type's discriminant literal to its query/output pair.
 * This is what lets querySymbolUniverse, the strategy registry, and the
 * reasoning-graph builder stay fully typed per query type instead of
 * collapsing everything to `any` or a lossy union.
 */
interface QueryTypeMap {
  allocation_analysis: { query: AllocationAnalysisQuery; output: AllocationAnalysisOutput };
  liquidity_analysis: { query: LiquidityAnalysisQuery; output: LiquidityAnalysisOutput };
  hedging_analysis: { query: HedgingAnalysisQuery; output: HedgingAnalysisOutput };
  yield_optimization: { query: YieldOptimizationQuery; output: YieldOptimizationOutput };
  trend_analysis: { query: TrendAnalysisQuery; output: TrendAnalysisOutput };
  arbitrage_detection: { query: ArbitrageDetectionQuery; output: ArbitrageDetectionOutput };
  governance_impact: { query: GovernanceImpactQuery; output: GovernanceImpactOutput };
  risk_monitoring: { query: RiskMonitoringQuery; output: RiskMonitoringOutput };
}

export type CognitionQueryType = keyof QueryTypeMap;
export type CognitionQuery = QueryTypeMap[CognitionQueryType]['query'];
export type CognitionQueryOutput = QueryTypeMap[CognitionQueryType]['output'];

// =============================================================================
// DAO OBJECTIVE WEIGHTS — derived from DAO_TYPE_CONFIG behavior, not carried
// over from the old 7-value DaoType union. See per-type reasoning below.
// =============================================================================

export interface ObjectiveWeights {
  risk: number;
  yield: number;
  liquidity: number;
}

/**
 * Each row derived from DAO_TYPE_CONFIG's actual product behavior (vault
 * type, withdrawal model, loan terms, yield-unlock timing), not from
 * name-matching against the old DaoType union:
 *
 * - harambee:     single-payout, urgencyMode, auto-hibernate after
 *                 disbursement, no yield features at all (yuki: null).
 *                 Liquidity-dominant, yield near-irrelevant.
 * - shortTerm:    milestone-gated withdrawal, still no yield opt-in
 *                 (yuki: null) even as an option.
 * - savings:      request-and-cooldown withdrawal, yield opt-in exists
 *                 behind governance vote, moderate loan terms
 *                 (maxLoanRatio 0.70, interest 0.10). Closest to balanced.
 * - merryGoRound: rotation-scheduled withdrawal with an explicit
 *                 payoutGracePeriodHours (72h) — the product itself
 *                 encodes a hard liquidity deadline. Tightest loan terms
 *                 of any type (repaymentPeriod: 'before-payout').
 * - community:    multisig-proposal withdrawal, 48h timelock, 60% quorum —
 *                 nothing time-pressured. Full loan facility with scoring
 *                 and a collateral-seizure-then-reserve fallback; yield on
 *                 reserves unlocked immediately (not gated).
 * - investment:   MultiAssetVault + rebalancing agent, yield/dex features
 *                 unlocked immediately, margin-call threshold present,
 *                 weighted-stake governance. Straight rename of the old
 *                 investment_club — reused because the purpose is
 *                 unchanged, not because it was convenient.
 *
 * These six rows are each derived independently from that type's own
 * config fields, not allocated from a fixed risk+yield+liquidity=1 budget
 * across all types. If strict per-row normalization is wanted later, that
 * is a follow-up decision, not something silently assumed here.
 */
export const DAO_OBJECTIVE_WEIGHTS = {
  harambee: { liquidity: 0.75, risk: 0.20, yield: 0.05 },
  shortTerm: { liquidity: 0.55, risk: 0.35, yield: 0.10 },
  savings: { liquidity: 0.35, risk: 0.35, yield: 0.30 },
  merryGoRound: { liquidity: 0.65, risk: 0.25, yield: 0.10 },
  community: { liquidity: 0.25, risk: 0.40, yield: 0.35 },
  investment: { liquidity: 0.10, risk: 0.25, yield: 0.65 },
} satisfies Record<DaoType, ObjectiveWeights>;

/**
 * Replaces the old switch-statement version. No default branch: every
 * DaoType has an entry in DAO_OBJECTIVE_WEIGHTS, enforced at compile time
 * by the `satisfies Record<DaoType, ObjectiveWeights>` above. A DaoType
 * added to shared/types/dao.ts with no corresponding row here fails the
 * build instead of silently defaulting to some other type's weights.
 */
export function getDefaultObjectiveWeights(daoType: DaoType): ObjectiveWeights {
  return DAO_OBJECTIVE_WEIGHTS[daoType];
}

// =============================================================================
// DAO EDGE ELIGIBILITY — which AssetEdgeRelationshipTypes each DaoType may
// traverse. Inferred from DAO_TYPE_CONFIG.loanFacility presence/sophistication
// per type — a config-shape inference, not a stated product rule. Worth a
// sanity check against product intent before this gates real money movement.
// =============================================================================

interface DaoEdgeRestriction {
  /**
   * Relationship types this DAO type may never traverse, regardless of
   * what other filtering logic runs later. Everything NOT listed here is
   * allowed by default — mirrors the old code's "everyone gets everything
   * except these named cases" behavior, just made exhaustive over DaoType
   * instead of falling through silently for unrecognized types.
   */
  deniedEdgeTypes: AssetEdgeRelationshipType[];
  reason: string;
}

/**
 * Explicit `Record<DaoType, DaoEdgeRestriction>` annotation (rather than
 * `satisfies`) so each `deniedEdgeTypes` array widens to
 * `AssetEdgeRelationshipType[]` instead of being inferred as a narrow
 * literal tuple. Still a full Record — omitting a DaoType key is still a
 * compile error either way.
 */
export const DAO_EDGE_RESTRICTIONS: Record<DaoType, DaoEdgeRestriction> = {
  harambee: {
    deniedEdgeTypes: ['collateral_pair', 'derivative'],
    reason: 'no loanFacility in DAO_TYPE_CONFIG; single-payout/urgency vehicle',
  },
  shortTerm: {
    deniedEdgeTypes: ['collateral_pair', 'derivative'],
    reason: 'no loanFacility in DAO_TYPE_CONFIG',
  },
  savings: {
    deniedEdgeTypes: ['collateral_pair'],
    reason: 'loanFacility present (vault-shares collateral) but no scoring/margin calls',
  },
  merryGoRound: {
    deniedEdgeTypes: ['collateral_pair'],
    reason: 'loanFacility collateralType is rotation-claim, not open DeFi collateral',
  },
  community: {
    deniedEdgeTypes: [],
    reason: 'full loanFacility with scoring + collateral-seizure-then-reserve fallback',
  },
  investment: {
    deniedEdgeTypes: [],
    reason: 'full loanFacility with scoring + marginCallThreshold',
  },
};

/**
 * A graph, as loaded by getAssetGraphVersion(): AssetGraphVersion metadata
 * plus the actual node/edge arrays reconstructed from separate tables.
 */
export interface LoadedAssetGraph extends AssetGraphVersion {
  assetNodes: AssetNode[];
  assetEdges: AssetEdge[];
}

/**
 * Replaces the old if/else-if/else chain. No `return true` catch-all: every
 * DaoType's restrictions are looked up explicitly via DAO_EDGE_RESTRICTIONS,
 * and a DaoType with no entry is a compile error rather than a silent
 * "allow everything" default.
 */
export function filterGraphByDaoType(
  graph: LoadedAssetGraph | null,
  daoType: DaoType,
): LoadedAssetGraph | null {
  if (!graph) return null;

  const denied = new Set(DAO_EDGE_RESTRICTIONS[daoType].deniedEdgeTypes);

  return {
    ...graph,
    assetEdges: graph.assetEdges.filter((edge) => !denied.has(edge.relationshipType)),
  };
}

// =============================================================================
// STRATEGY REGISTRY
// =============================================================================

/** Metadata used when attributing a decision to a strategy in the audit trail. */
interface StrategyDescriptor {
  id: string;
  version: string;
}

/**
 * Keyed per query type instead of `Map<string, any>`, so a registered
 * strategy's execute() signature is checked against the specific
 * query/output pair for the key it's registered under.
 *
 * NOTE: see file header item 6 — registered strategies are not currently
 * invoked by querySymbolUniverse. This registry only supplies metadata for
 * the reasoning-graph audit trail today.
 */
type StrategyRegistry = {
  [K in CognitionQueryType]?: CognitionStrategy<K>;
};

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

interface ConfidenceFactor {
  factor: string;
  score: number;
  reasoning: string;
}

interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactor[];
}

/**
 * Optional signal used to adjust confidence. Not every query type has an
 * AssetStateSnapshot on hand (e.g. LiquidityAnalysisQuery doesn't carry
 * one) — callers that have a relevant snapshot pass it; others omit it and
 * get the neutral defaults for freshness/liquidity/volatility factors.
 */
interface ConfidenceSignal {
  isStale?: boolean;
  createdAt?: Date;
  liquidityDepth5pct?: number;
  technicalMomentum?: number;
  technicalRsi14?: number;
  signalConflict?: boolean;
  allSignalsAlign?: boolean;
}

// =============================================================================
// MAIN COGNITION ENGINE (Strategy Registry Pattern)
// =============================================================================

/**
 * Orchestrates all query types with swappable strategies.
 *
 * Design:
 * - Strategies are pluggable (governance can upgrade logic) — see file
 *   header item 6 for the current gap between "registered" and "invoked".
 * - Each strategy is versioned independently
 * - Decisions include full provenance (which strategy, version, graph,
 *   correlation)
 * - Enables institutional auditability and governance
 */
export class CognitionEngine {
  private db?: CognitionDatabaseClient;
  private strategyRegistry: StrategyRegistry = {};
  private readonly engineVersion = '1.0.0';

  constructor(db?: CognitionDatabaseClient) {
    if (db) {
      this.db = db;
    }
    this.registerDefaultStrategies();
  }

  /**
   * Register default strategies. Currently a no-op: built-in logic is
   * inline in the private analyze*() methods rather than expressed as
   * registered CognitionStrategy objects. Left as an explicit extension
   * point rather than removed.
   */
  private registerDefaultStrategies(): void {
    // Strategies will be registered here
    // For now, using inline logic, but this enables hot-swapping
  }

  /**
   * Register a custom strategy for a given query type. Governance-approved
   * strategies can be registered at runtime. See file header item 6: this
   * currently affects audit-trail attribution only, not actual dispatch.
   */
  registerStrategy<K extends CognitionQueryType>(
    queryType: K,
    strategy: CognitionStrategy<K>,
  ): void {
    // TypeScript cannot verify a write into a mapped type through a generic
    // index. The method's signature already guarantees the strategy is
    // correctly typed for the provided query type.
    (this.strategyRegistry as Record<CognitionQueryType, CognitionStrategy<CognitionQueryType> | undefined>)[queryType] = strategy;
    logger.info('Strategy registered', { queryType, id: strategy.id, version: strategy.version });
  }

  /**
   * Get strategy descriptor for a query type, for audit-trail attribution.
   * Falls back to a default descriptor if no custom strategy is registered.
   */
  private getStrategyDescriptor(queryType: CognitionQueryType): StrategyDescriptor {
    const custom = this.strategyRegistry[queryType];
    if (custom) return { id: custom.id, version: custom.version };
    return { id: queryType, version: '1.0.0' };
  }

  // ========== GRAPH & CORRELATION LOADING ==========

  /**
   * Load AssetGraphVersion by version number (metadata only)
   * Use this first to check if nodes/edges have changed (via hashes)
   */
  async getAssetGraphVersionMetadata(graphVersion: number): Promise<AssetGraphVersion | null> {
    if (!this.db) {
      logger.warn('Database not initialized, returning null graph metadata');
      return null;
    }

    try {
      const rows = await this.db
        .select()
        .from(assetGraphVersions)
        .where(eq(assetGraphVersions.version, graphVersion))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      // Nullable DB columns come back as `T | null`; AssetGraphVersion's
      // optional fields are `T | undefined`. Map explicitly rather than
      // returning the raw row cast to the domain type.
      return {
        version: row.version,
        timestamp: row.timestamp,
        nodeHash: row.nodeHash,
        edgeHash: row.edgeHash,
        nodeCount: row.nodeCount,
        edgeCount: row.edgeCount,
        edgeDiffFromPreviousVersion: row.edgeDiffFromPreviousVersion as AssetGraphVersion['edgeDiffFromPreviousVersion'] | undefined,
        changeReason: row.changeReason as AssetGraphVersion['changeReason'] | undefined,
        changeDetails: row.changeDetails ?? undefined,
        edgeCountByType: row.edgeCountByType as AssetGraphVersion['edgeCountByType'] | undefined,
        edgeCountByChain: row.edgeCountByChain as AssetGraphVersion['edgeCountByChain'] | undefined,
      };
    } catch (error) {
      logger.error('Failed to load asset graph version metadata', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load all AssetNodes for a specific graph version
   */
  async getAssetNodesForVersion(graphVersion: number): Promise<AssetNode[]> {
    if (!this.db) return [];

    try {
      const rows = await this.db
        .select()
        .from(assetNodes)
        .where(eq(assetNodes.version, graphVersion));

      return rows.map((row) => row.nodeData as AssetNode);
    } catch (error) {
      logger.error('Failed to load asset nodes', { error, graphVersion });
      return [];
    }
  }

  /**
   * Load all AssetEdges for a specific graph version
   */
  async getAssetEdgesForVersion(graphVersion: number): Promise<AssetEdge[]> {
    if (!this.db) return [];

    try {
      const rows = await this.db
        .select()
        .from(assetEdges)
        .where(eq(assetEdges.version, graphVersion));

      return rows.map((row) => row.edgeData as AssetEdge);
    } catch (error) {
      logger.error('Failed to load asset edges', { error, graphVersion });
      return [];
    }
  }

  /**
   * Load AssetGraphVersion (full graph) by version number.
   * Loads from separate tables and reconstructs the graph object.
   */
  async getAssetGraphVersion(graphVersion: number): Promise<LoadedAssetGraph | null> {
    if (!this.db) {
      logger.warn('Database not initialized, returning null graph');
      return null;
    }

    try {
      const [metadata, nodes, edges] = await Promise.all([
        this.getAssetGraphVersionMetadata(graphVersion),
        this.getAssetNodesForVersion(graphVersion),
        this.getAssetEdgesForVersion(graphVersion),
      ]);

      if (!metadata) return null;

      return {
        ...metadata,
        assetNodes: nodes,
        assetEdges: edges,
      };
    } catch (error) {
      logger.error('Failed to load asset graph', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load CorrelationMatrix by matrixVersion number (independent of graphVersion)
   */
  async getCorrelationMatrix(matrixVersion: number): Promise<CorrelationMatrix | null> {
    if (!this.db) {
      logger.warn('Database not initialized, returning null correlations');
      return null;
    }

    try {
      const rows = await this.db
        .select()
        .from(correlationMatrices)
        .where(eq(correlationMatrices.matrixVersion, matrixVersion))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        matrixVersion: row.matrixVersion,
        timestamp: row.timestamp,
        computedAgainstGraphVersion: row.computedAgainstGraphVersion,
        correlationMatrix: row.correlationMatrix as CorrelationMatrix['correlationMatrix'],
        strongPositiveCorrelations: row.strongPositiveCorrelations as CorrelationMatrix['strongPositiveCorrelations'],
        strongNegativeCorrelations: row.strongNegativeCorrelations as CorrelationMatrix['strongNegativeCorrelations'],
        lookbackPeriod: row.lookbackPeriod as CorrelationMatrix['lookbackPeriod'],
        completeness: row.completeness ?? undefined,
        createdAt: row.createdAt ?? undefined,
      };
    } catch (error) {
      logger.error('Failed to load correlation matrix', { error, matrixVersion });
      return null;
    }
  }

  /**
   * Get latest CorrelationMatrix that matches a graph version
   * (for cases where you want compatible correlations)
   */
  async getLatestCorrelationForGraphVersion(graphVersion: number): Promise<CorrelationMatrix | null> {
    if (!this.db) return null;

    try {
      const rows = await this.db
        .select()
        .from(correlationMatrices)
        .where(eq(correlationMatrices.computedAgainstGraphVersion, graphVersion))
        .orderBy(desc(correlationMatrices.timestamp))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        matrixVersion: row.matrixVersion,
        timestamp: row.timestamp,
        computedAgainstGraphVersion: row.computedAgainstGraphVersion,
        correlationMatrix: row.correlationMatrix as CorrelationMatrix['correlationMatrix'],
        strongPositiveCorrelations: row.strongPositiveCorrelations as CorrelationMatrix['strongPositiveCorrelations'],
        strongNegativeCorrelations: row.strongNegativeCorrelations as CorrelationMatrix['strongNegativeCorrelations'],
        lookbackPeriod: row.lookbackPeriod as CorrelationMatrix['lookbackPeriod'],
        completeness: row.completeness ?? undefined,
        createdAt: row.createdAt ?? undefined,
      };
    } catch (error) {
      logger.error('Failed to load correlation for graph version', { error, graphVersion });
      return null;
    }
  }

  /**
   * Load AssetGraphVersion and CorrelationMatrix together.
   * Convenience method for queries that need both.
   */
  async getGraphContext(
    graphVersion: number,
    matrixVersion?: number,
  ): Promise<{ graph: LoadedAssetGraph | null; correlationMatrix: CorrelationMatrix | null }> {
    const [graph, correlationMatrix] = await Promise.all([
      this.getAssetGraphVersion(graphVersion),
      matrixVersion
        ? this.getCorrelationMatrix(matrixVersion)
        : this.getLatestCorrelationForGraphVersion(graphVersion),
    ]);

    return { graph, correlationMatrix };
  }

  /**
   * Main entry point for Cognition.
   * Routes queries based on type and applies DAO-context-aware scoring.
   *
   * Takes the plain `CognitionQuery` union rather than a generic
   * `Extract<CognitionQuery, { type: K }>` — TypeScript's switch-based
   * discriminated-union narrowing only works reliably against a concrete
   * union, not one wrapped in a still-generic type parameter. The
   * trade-off: callers get `CognitionOutput<CognitionQueryType>` rather
   * than a per-call-site-narrowed `CognitionOutput<'allocation_analysis'>`
   * — still fully typed, just one level less precise at the call site.
   */
  async querySymbolUniverse(query: CognitionQuery): Promise<CognitionOutput> {
    try {
      const { result, compositeScore, factors } = await this.executeQuery(query);

      const confidence = this.calculateConfidence(query.context, undefined);
      const riskFlags = this.identifyRiskFlags(query.context, result);

      // TODO: graphVersion/correlationVersion are not currently produced
      // anywhere in the query flow — none of the CognitionQuery variants
      // carry a graphVersion today, and the analyze*() methods don't call
      // getGraphContext()/getAssetGraphVersion() yet (see file header
      // item 4). Threaded through as 0 rather than invented; wire these up
      // to the real values once the analyze methods actually load a graph.
      const reasoningGraph = this.buildReasoningGraph(
        query.type,
        query.context,
        0,
        0,
        compositeScore,
        factors,
        confidence.score,
        confidence.factors,
        riskFlags,
      );

      return {
        context: query.context,
        decisionType: query.type,
        recommendedAction: this.synthesizeAction(query.type, result),
        confidenceScore: confidence.score,
        reasoningGraph,
        riskFlags,
        executionHints: this.generateExecutionHints(query.type, result),
      };
    } catch (error) {
      logger.error('Cognition Engine error', { error, query });
      throw error;
    }
  }

  /**
   * Dispatches to the correct analyze*() method and extracts the
   * query-type-specific composite score / factors used in the audit trail.
   * Split out from querySymbolUniverse so the switch's per-case type
   * narrowing stays in one place.
   */
  private async executeQuery(query: CognitionQuery): Promise<{
    result: CognitionQueryOutput;
    compositeScore: number;
    factors: VersionedReasoningGraph['factors'];
  }> {
    switch (query.type) {
      case 'allocation_analysis': {
        const result = await this.analyzeAllocation(query);
        return { result, compositeScore: result.compositeScore, factors: [] };
      }
      case 'liquidity_analysis': {
        const result = await this.analyzeLiquidity(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'hedging_analysis': {
        const result = await this.analyzeHedging(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'yield_optimization': {
        const result = await this.optimizeYield(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'trend_analysis': {
        const result = await this.analyzeTrends(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'arbitrage_detection': {
        const result = await this.detectArbitrage(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'governance_impact': {
        const result = await this.analyzeGovernanceImpact(query);
        return { result, compositeScore: 0, factors: [] };
      }
      case 'risk_monitoring': {
        const result = await this.monitorRisk(query);
        return { result, compositeScore: result.overallRiskScore, factors: [] };
      }
    }
  }

  // ========== DAO-SPECIFIC COGNITION LOGIC ==========

  /**
   * Allocation Analysis
   * Different DAO types optimize different objectives (see
   * DAO_OBJECTIVE_WEIGHTS for the per-DaoType breakdown).
   */
  private async analyzeAllocation(query: AllocationAnalysisQuery): Promise<AllocationAnalysisOutput> {
    const context = query.context;

    // DAO-specific weights (can be overridden via governance)
    const objectiveWeights = context.objectiveWeights ?? getDefaultObjectiveWeights(context.daoType);

    // Score each asset based on DAO objectives.
    // Not yet implemented: scoring against real snapshots/graph data.
    // objectiveWeights is resolved above and available to that future logic.
    void objectiveWeights;

    return {
      currentRiskScore: 50,
      currentVolatility: 30,
      currentYield: 5.5,
      candidateAssets: [],
      compositeScore: 75,
      optimalAllocation: new Map(),
      expectedImpact: { riskChange: -5, volatilityChange: -10, yieldChange: 1.2 },
    };
  }

  /**
   * Liquidity Analysis
   * Can we exit? How fast? At what cost?
   */
  private async analyzeLiquidity(query: LiquidityAnalysisQuery): Promise<LiquidityAnalysisOutput> {
    void query;
    // Query AssetStateSnapshot for liquidity data.
    // Compute exit feasibility based on:
    // - DEX liquidity depth
    // - Bridge availability if needed
    // - Time constraints (especially for merryGoRound's payoutGracePeriodHours)

    return {
      canExit: true,
      exitSpeed: 'fast',
      estimatedSlippage: 2.5,
      estimatedTimeToExit: 300, // 5 minutes
      estimatedNetAmount: 9750,
      executionPlan: {
        chain: 'celo',
        dex: 'ubeswap',
        route: ['CELO', 'cUSD'],
        bridgeRequired: false,
        bridgeCost: 0,
      },
      alternateRoutes: [],
      warnings: [],
    };
  }

  /**
   * Hedging Analysis
   * Find assets that hedge portfolio downside
   */
  private async analyzeHedging(query: HedgingAnalysisQuery): Promise<HedgingAnalysisOutput> {
    void query;
    // Find highly negative correlations to current positions.
    // Score hedges by: correlation, cost, effectiveness.

    return {
      currentDownside: 25,
      hedgingOptions: [],
      optimalHedgeComposition: new Map(),
      expectedPortfolioSharpe: 1.5,
      hedgingCost: 0.5,
    };
  }

  /**
   * Yield Optimization
   * Maximize returns within risk budget
   */
  private async optimizeYield(query: YieldOptimizationQuery): Promise<YieldOptimizationOutput> {
    void query;
    // For savings/community/investment DAOs — rank yield strategies by
    // APY, risk, and lock period.

    return {
      currentAPY: 5.5,
      currentYieldSources: [],
      opportunitiesRanked: [],
      recommendedReallocation: new Map(),
      projectedAPY: 7.2,
      sharpeRatioImprovement: 0.3,
    };
  }

  /**
   * Trend Analysis
   * Market direction and volatility signals
   */
  private async analyzeTrends(query: TrendAnalysisQuery): Promise<TrendAnalysisOutput> {
    void query;
    // Aggregate technical signals from snapshots.
    // Identify volatility clusters and momentum.

    return {
      marketSentiment: 'neutral',
      volatilityCluster: false,
      volatilityLevel: 'medium',
      assetTrends: [],
      actionableAlerts: [],
    };
  }

  /**
   * Arbitrage Detection
   * Find profitable spreads
   */
  private async detectArbitrage(query: ArbitrageDetectionQuery): Promise<ArbitrageDetectionOutput> {
    void query;
    // For sophisticated DAOs (community, investment) — scan for price
    // discrepancies across DEXes and chains. Account for bridge fees and
    // slippage.

    return {
      opportunities: [],
      topOpportunity: undefined,
    };
  }

  /**
   * Governance Impact
   * Assess proposal feasibility and impact
   */
  private async analyzeGovernanceImpact(query: GovernanceImpactQuery): Promise<GovernanceImpactOutput> {
    void query;
    // Check DAO governance rules (quorum, voting period from
    // DAO_TYPE_CONFIG.governance). Project risk/yield/volatility impact.
    // Generate proposal narrative.

    return {
      isEligible: true,
      quorumRequired: 20,
      eligibilityChecks: [],
      projectedImpact: { riskDelta: -5, volatilityDelta: -10, yieldDelta: 1.2 },
      proposalNarrative: 'Rebalance to reduce volatility...',
      recommendedVotingPeriod: 72,
      estimatedExecutionTime: 48,
    };
  }

  /**
   * Risk Monitoring
   * Check for violations
   */
  private async monitorRisk(query: RiskMonitoringQuery): Promise<RiskMonitoringOutput> {
    void query;
    // Score concentration, volatility, smart contract risk.
    // Flag violations vs DAO's risk profile.

    return {
      overallRiskScore: 45,
      isHealthy: true,
      violations: [],
      concentrationMetrics: {
        herfindahl: 0.3,
        topThreeExposure: 60,
        recommendation: 'Consider diversifying away from CELO',
      },
      recommendations: [],
    };
  }

  // ========== SYNTHESIS & SCORING ==========

  private synthesizeAction(queryType: CognitionQueryType, result: CognitionQueryOutput): string {
    void result;
    // Convert query result into actionable recommendation.
    return `Based on ${queryType} analysis, recommend...`;
  }

  /**
   * Calculate institutional-grade confidence score.
   *
   * Combines multiple factors to prevent blind automation disasters:
   * - Data freshness (old data = lower confidence)
   * - Signal agreement (conflicting signals = lower confidence)
   * - Liquidity reliability (sparse market depth = lower confidence)
   * - Volatility regime stability (markets in shock = lower confidence)
   * - DAO time horizon alignment (short-turnaround DAO + long-term data =
   *   misalignment)
   *
   * Returns both the composite score AND the per-factor breakdown, so
   * callers (querySymbolUniverse) can forward the breakdown into the
   * reasoning graph instead of it being computed and discarded.
   */
  private calculateConfidence(context: TreasuryContext, signal: ConfidenceSignal | undefined): ConfidenceResult {
    const factors: ConfidenceFactor[] = [];

    // 1. Data Freshness: How old is the snapshot?
    let freshnessScore = 100;
    if (signal?.isStale) {
      freshnessScore = 40; // Stale data = low confidence
    } else if (signal?.createdAt) {
      const ageSeconds = (Date.now() - signal.createdAt.getTime()) / 1000;
      // Exponential decay: full confidence < 1hr, decay by 1% per hour after
      freshnessScore = Math.max(50, 100 - Math.pow(ageSeconds / 3600, 1.5));
    }
    factors.push({
      factor: 'data_freshness',
      score: freshnessScore,
      reasoning: `Data age: ${freshnessScore.toFixed(0)}% fresh`,
    });

    // 2. Signal Agreement: Do independent indicators agree?
    let signalAgreementScore = 85; // Default: moderate agreement
    if (signal?.signalConflict === true) {
      signalAgreementScore = 50;
    } else if (signal?.allSignalsAlign === true) {
      signalAgreementScore = 95;
    }
    factors.push({
      factor: 'signal_agreement',
      score: signalAgreementScore,
      reasoning: `Cross-signal consistency: ${signalAgreementScore.toFixed(0)}%`,
    });

    // 3. Liquidity Reliability: Is the market deep enough?
    let liquidityScore = 75;
    if (signal?.liquidityDepth5pct !== undefined && signal.liquidityDepth5pct < 10000) {
      liquidityScore = 40; // Shallow market = unreliable pricing
    } else if (signal?.liquidityDepth5pct !== undefined && signal.liquidityDepth5pct > 500000) {
      liquidityScore = 95; // Deep market = high confidence
    }
    factors.push({
      factor: 'liquidity_reliability',
      score: liquidityScore,
      reasoning: `Market depth (5% slippage): ${liquidityScore.toFixed(0)}%`,
    });

    // 4. Volatility Regime Stability: Is the market in shock?
    let volatilityScore = 85;
    if (signal?.technicalMomentum !== undefined && Math.abs(signal.technicalMomentum) > 80) {
      volatilityScore = 60; // Extreme momentum = unstable regime
    } else if (signal?.technicalRsi14 !== undefined) {
      const isOverbought = signal.technicalRsi14 > 70;
      const isOversold = signal.technicalRsi14 < 30;
      if (isOverbought || isOversold) {
        volatilityScore = 65; // Regime extremes = lower confidence
      }
    }
    factors.push({
      factor: 'volatility_stability',
      score: volatilityScore,
      reasoning: `Regime stability: ${volatilityScore.toFixed(0)}%`,
    });

    // 5. Time Horizon Alignment: Is decision timeline reasonable?
    let timeHorizonScore = 90;
    if (context.nextDistributionWindow) {
      const timeUntilDeadline = context.nextDistributionWindow.deadline.getTime() - Date.now();
      const hoursToDeadline = timeUntilDeadline / (1000 * 3600);

      // If decision horizon is too short for market to settle, lower confidence
      if (hoursToDeadline < 1) {
        timeHorizonScore = 30; // Immediate deadline = high uncertainty
      } else if (hoursToDeadline < 24) {
        timeHorizonScore = 60;
      } else if (hoursToDeadline > 365 * 24) {
        timeHorizonScore = 100; // Long horizon = stable assumptions
      }
    }
    factors.push({
      factor: 'time_horizon_alignment',
      score: timeHorizonScore,
      reasoning: `Timeline feasibility: ${timeHorizonScore.toFixed(0)}%`,
    });

    // Composite: Geometric mean of factors (one low score doesn't destroy
    // confidence if others are high)
    const compositeConfidence = Math.pow(
      freshnessScore * signalAgreementScore * liquidityScore * volatilityScore * timeHorizonScore,
      1 / 5,
    );

    return {
      score: Math.round(Math.min(100, Math.max(0, compositeConfidence))),
      factors,
    };
  }

  /**
   * Build versioned reasoning graph for auditability.
   *
   * This is institutional-grade provenance:
   * - Which engine version?
   * - Which graph version was data from?
   * - Which correlation version?
   * - What factors influenced scoring?
   * - What weights were used?
   * - What risks were flagged?
   *
   * Every decision is reproducible AND defensible.
   *
   * NOTE: daoId is required by VersionedReasoningGraph (FIX #6 in
   * assetGraph.ts) but is not present on TreasuryContext as given —
   * TreasuryContext.daoId exists, so it's read from there directly.
   */
  private buildReasoningGraph(
    queryType: CognitionQueryType,
    context: TreasuryContext,
    graphVersion: number,
    correlationVersion: number,
    compositeScore: number,
    factors: VersionedReasoningGraph['factors'],
    confidenceScore: number,
    confidenceFactors: VersionedReasoningGraph['confidenceFactors'],
    riskFlags: VersionedReasoningGraph['riskFlags'],
  ): VersionedReasoningGraph {
    const strategy = this.getStrategyDescriptor(queryType);

    return {
      daoId: context.daoId,
      daoType: context.daoType,

      engineVersion: this.engineVersion,
      strategyId: strategy.id,
      strategyVersion: strategy.version,
      graphVersionUsed: graphVersion,
      correlationVersionUsed: correlationVersion,

      queryType,
      factors,
      objectiveWeights: context.objectiveWeights ?? getDefaultObjectiveWeights(context.daoType),
      compositeScore,

      confidenceScore,
      confidenceFactors,

      riskFlags,

      timestamp: new Date(),
    };
  }

  private identifyRiskFlags(
    context: TreasuryContext,
    result: CognitionQueryOutput,
  ): VersionedReasoningGraph['riskFlags'] {
    void context;
    void result;
    // Extract warnings from result. Not yet implemented — no analyze*()
    // method currently populates anything that would map to a risk flag.
    return [];
  }

  private generateExecutionHints(
    queryType: CognitionQueryType,
    result: CognitionQueryOutput,
  ): Record<string, unknown> {
    void queryType;
    void result;
    // Specific instructions for agents executing this recommendation.
    return {};
  }
}

// Singleton instance
export const cognitionEngine = new CognitionEngine();