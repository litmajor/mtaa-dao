/**
 * Asset Graph Type Definitions
 *
 * Core infrastructure for the Market Nervous System.
 *
 * Represents assets as nodes in a governance-aware, multi-chain graph
 * where edges encode relationships, constraints, and execution costs.
 *
 * This is the foundational L1 layer that feeds all Intelligence Shards
 * and the Cognition Engine.
 *
 * ========== ARCHITECTURAL CONTRACT ==========
 *
 * ATOMIC SNAPSHOTS (AssetStateSnapshot):
 * - Stores ONLY core shard data: price, technical, yield, risk, liquidity
 * - ONE snapshot per asset per update cycle
 * - Small, fast writes (~2KB per asset)
 * - References graph version number, does NOT embed graph or correlations
 *
 * Why not embed graph/correlations in snapshot?
 * - Edges can explode: 1000 assets × 100 edges = 100K edges
 * - Correlations: O(n²) = 500K correlations at 1000 assets
 * - Embedding in every snapshot = 100M records stored redundantly
 * - Performance catastrophe: write latency, storage bloat, query slowness
 *
 * SOLUTION: Separate storage layers
 *
 * AssetGraphVersion:
 * - Stores COMPLETE graph (nodes + edges) at a point in time
 * - Updated ONLY when graph changes (new bridge, new LP, new yield track)
 * - Snapshots reference it by version number
 *
 * CorrelationMatrix:
 * - Stores correlations between all assets — SPARSE
 * - Updated once per 24-hour cycle, independent of snapshot cycle
 * - Indexed by its own version counter (not tied to graph version)
 *
 * Snapshot query flow:
 * 1. Load asset snapshot (lightweight, ~2KB)
 * 2. If Cognition needs edges: load AssetGraphVersion by graphVersion
 * 3. If Cognition needs correlations: load CorrelationMatrix by its version
 * 4. Cache graph + correlations for this request
 *
 * ========== KEY DESIGN DECISIONS ==========
 *
 * 1. Version-based references (not hard foreign keys)
 *    - Allows graph to evolve independently
 *    - Enables point-in-time graph snapshots (backtesting)
 *    - Decouples snapshot cycle from graph update cycle
 *
 * 2. Sparse correlation matrix
 *    - Only store significant correlations
 *    - Quick access indexes: strongPositive, strongNegative
 *    - Reduces storage vs dense matrix
 *
 * 3. DAO-aware graph filtering
 *    - CognitionEngine.filterGraphByDaoType()
 *    - Same asset, different DAO = different available edges
 *    - Example: harambee can't use collateral_pair or derivative edges
 *
 * 4. Graph versioning supports:
 *    - Backtesting (use historical graph version)
 *    - A/B testing graph changes
 *    - Audit trail (what graph did this decision use?)
 */

import type { DaoType } from '../../shared/types/dao';

// Backward-compatible alias — existing consumers can still reference `DaoType`
// while new code should prefer `DaoType` for clarity.
export type DaoTypeKey = DaoType;
export type { DaoType };

// =============================================================================
// DOMAIN ENUMS
// =============================================================================

/** Treasury Modes determine Cognition behavior */
export type TreasuryMode =
  | 'accumulative'   // Growth mode, compound returns (investment, community)
  | 'distributive';  // Payout mode, rotation windows (harambee, shortTerm, merryGoRound)

/** Treasury Size for constraint scaling */
export type TreasurySize =
  | 'small'    // < $1K, conservative
  | 'medium'   // $1K - $100K, balanced
  | 'large';   // > $100K, can support aggressive

/** Risk Profile for Cognition scoring */
export type RiskProfile =
  | 'conservative'  // 70%+ stable assets
  | 'balanced'      // Mixed allocation
  | 'aggressive';   // 40%+ volatile exposure

/** Asset Classification for treasury composition */
export type AssetClass =
  | 'stable'    // Stablecoins (cUSD, USDT, cEUR)
  | 'volatile'  // Crypto assets (CELO, BTC, ETH)
  | 'yield'     // Yield-generating (in lending vaults)
  | 'lp'        // Liquidity provider tokens (UBE-CELO)
  | 'vault'     // Vault deposits (Moola, etc.)
  | 'nft'       // NFT holdings
  | 'wrapped'   // Wrapped assets (WETH, WBTC)
  | 'exotic';   // Emerging/experimental tokens

/** Supported Chains in the System */
export type SupportedChain =
  | 'celo'
  | 'ethereum'
  | 'base'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'bsc'
  | 'avalanche';

/** Supported Bridge Protocols */
export type BridgeProtocol = 'layerzero' | 'axelar' | 'wormhole' | 'stargate';

/** Yield Strategy Types */
export type YieldStrategyId =
  | 'moola-lending'  // Moola lending pool, ~8.5% APY
  | 'celo-staking'   // Celo validator staking, ~6.2% APY
  | 'ubeswap-lp';    // Ubeswap liquidity provision, ~12.3% APY

// =============================================================================
// CORE GRAPH NODES
// =============================================================================

/**
 * Core Asset Node in the Graph.
 * Represents a tradable asset with chain presence, governance rules,
 * and yield eligibility. Governance-aware and DAO-context-aware.
 */
export interface AssetNode {
  // ========== IDENTITY ==========
  id: string;      // e.g. 'celo:0x765DE816845861e75A25fCA122bb6898B6F02612'
  symbol: string;  // cUSD, CELO, cEUR, BTC, ETH, etc.
  name?: string;

  // ========== CLASSIFICATION ==========
  assetType: 'L1' | 'L2' | 'stablecoin' | 'yield_token' | 'lp_token' | 'vault_token' | 'nft' | 'derivative';
  assetClass: AssetClass;

  // ========== GOVERNANCE & DAO ELIGIBILITY ==========
  /**
   * FIX #1: Was a hardcoded struct with one field per DaoTypeKey.
   * Now Record<DaoTypeKey, boolean> — adding a new DaoTypeKey requires only updating
   * the DaoTypeKey union in shared/types/dao.ts; no schema change needed on AssetNode.
   */
  daoEligibility: Record<DaoTypeKey, boolean>;

  /**
   * Governance tier for curation.
   * Verified = Protocol-reviewed, Community = DAO-curated, Open = Permissionless.
   */
  governanceTier: 'verified' | 'community' | 'open';

  // ========== CHAIN PRESENCE ==========
  chainPresence: {
    [chain in SupportedChain]?: {
      address: string;
      decimals: number;
      isActive: boolean;
      bridges?: {
        [targetChain in SupportedChain]?: {
          protocol: BridgeProtocol;
          bridgeContract?: string;
          minimumAmount: string;
          maximumAmount: string;
          estimatedTime: number;   // seconds
          feePercentage: number;   // 0.1 – 1.0%
          active: boolean;
        };
      };
    };
  };

  // ========== RISK CLASSIFICATION ==========
  riskLevel: 'low' | 'medium' | 'high';
  volatilityProfile: number;  // 0-100, like beta (30-day rolling)
  liquidityScore: number;     // 1-100 aggregate across active chains

  contractRisk?: {
    auditStatus: 'fully_audited' | 'partially_audited' | 'unaudited';
    knownVulnerabilities?: string[];
    ageInDays?: number;
  };

  // ========== YIELD ELIGIBILITY ==========
  yieldEligible: boolean;
  yieldStrategies?: {
    [strategyId in YieldStrategyId]?: {
      apy: number;
      minAmount: string;
      maxAmount?: string;
      chain: SupportedChain;
      protocol: string;
      lockPeriod?: number;  // days
      riskScore: number;    // 0-100
      fees: {
        deposit?: number;
        withdraw?: number;
        performance?: number;
      };
    };
  };

  // ========== LIQUIDITY PROFILE ==========
  minExitTime: number;                 // seconds to liquidate at 5% slippage
  penaltyFreeWithdrawUntil?: Date;
  lockupSchedule?: {
    unlocksAt: Date;
    penaltyPercent?: number;
  }[];

  // ========== METADATA ==========
  description?: string;
  website?: string;
  documentation?: string;
  twitter?: string;
  lastUpdated: Date;
  dataQuality: number;  // 1-100 confidence in this node's data
}

// =============================================================================
// GRAPH EDGES
// =============================================================================

/**
 * Relationship type union — centralised here so GraphQueryFilter
 * can reference it with full type safety (FIX #4).
 */
export type AssetEdgeRelationshipType =
  | 'wrapped'            // WETH wraps ETH (fungible, 1:1 conversion)
  | 'lp_pair'            // UBE-CELO is an LP token for that pair
  | 'derivative'         // cUSD derives from USD peg
  | 'bridge_route'       // USDC Ethereum <-> Base via Wormhole
  | 'yield_feed'         // cUSD feeds into Moola yield protocol
  | 'collateral_pair'    // BTC collateral for USDC borrow in Aave
  | 'correlated_upside'  // ETH correlates strongly with CELO
  | 'correlated_hedge'   // USDT is hedge against volatility spikes
  | 'liquidity_source';  // Uniswap provides DEX liquidity for swaps

/**
 * Asset Edge in the Graph.
 * Encodes a typed relationship between two assets including execution
 * costs, liquidity depth, and risk factors.
 */
export interface AssetEdge {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;

  relationshipType: AssetEdgeRelationshipType;

  liquidity: {
    at1PercentSlippage: number;  // USD amount tradeable at 1% slippage
    at5PercentSlippage: number;
    lastUpdated: Date;
  };

  cost: {
    slippageBasisPoints: number;
    bridgeFeePercent?: number;
    swapFeePercent?: number;
    gasCostUsd: number;
  };

  executionTime: {
    minSeconds: number;
    maxSeconds: number;
    avgSeconds: number;
  };

  riskFactor: number;   // 0-1, where 1 is maximal risk
  risks?: string[];     // "bridge_security", "oracle_risk", "slippage_variance"

  isActive: boolean;
  lastUpdated: Date;
}

// =============================================================================
// GRAPH VERSIONING
// =============================================================================

/**
 * Asset Graph Version (Git-Like Design).
 *
 * Stores a snapshot reference to the graph at a point in time.
 * Uses hash-based versioning to avoid O(version × nodes × edges) storage explosion.
 *
 * Adding 1 new edge = 1 new row in assetEdges.
 * NOT creating a full copy of the entire graph.
 *
 * FIX #5: edgeDiffFromPreviousVersion.modified changed from AssetEdge[] to
 * Array<{ edgeId: string; changes: Partial<AssetEdge> }>. Storing full objects
 * for modifications defeated the purpose of differential storage — you'd pay
 * the same cost as a full graph copy for any batch of edge changes.
 */
export interface AssetGraphVersion {
  version: number;   // Incremental version counter (commit-like)
  timestamp: Date;

  // Hash-based references — if hash matches previous version, reload is skippable
  nodeHash: string;  // SHA256 of all nodes
  edgeHash: string;  // SHA256 of all edges

  nodeCount: number;
  edgeCount: number;

  /**
   * FIX #5: modified now stores only what changed, not full AssetEdge objects.
   * Format: { edgeId, changes: Partial<AssetEdge> }
   * Cognition merges changes onto the previous version's edge in memory.
   */
  edgeDiffFromPreviousVersion?: {
    added: AssetEdge[];
    removed: string[];  // AssetEdge IDs
    modified: Array<{
      edgeId: string;
      changes: Partial<AssetEdge>;
    }>;
  };

  changeReason?: 'bridge_added' | 'lp_pair_discovered' | 'yield_strategy_added' | 'edge_pruned' | 'scheduled_refresh' | 'scheduled_audit';
  changeDetails?: string;

  edgeCountByType?: Record<AssetEdgeRelationshipType, number>;
  edgeCountByChain?: Record<SupportedChain, number>;
}

// =============================================================================
// CORRELATION MATRIX (INDEPENDENTLY VERSIONED)
// =============================================================================

/**
 * Relationship strength for correlation-based decisions.
 */
export interface CorrelationData {
  assetId: string;
  symbol: string;
  correlationCoefficient: number;  // -1.0 to +1.0
  relationship: 'strong_positive' | 'weak_positive' | 'no_correlation' | 'weak_negative' | 'strong_negative';
  lookbackPeriod: '30d' | '90d' | '1y';
  confidence: number;  // 0-100, based on sample size
}

/**
 * Correlation Matrix — INDEPENDENT versioning cycle.
 *
 * Decoupled from AssetGraphVersion because:
 * - Graph changes when: bridge added, new asset, yield strategy added
 * - Correlations change when: market dynamics shift, lookback window moves
 * - These are independent events — recomputing correlations on bridge addition is wasteful
 *
 * Only significant correlations stored (sparse).
 * Convenience indexes for fast access without full matrix load.
 */
export interface CorrelationMatrix {
  matrixVersion: number;  // INDEPENDENT counter, not tied to graphVersion
  timestamp: Date;

  computedAgainstGraphVersion: number;  // Audit trail + compatibility checking

  /**
   * Sparse representation. Only non-zero / significant correlations stored.
   * { asset1_id: { asset2_id: CorrelationData, ... }, ... }
   */
  correlationMatrix: Record<string, Record<string, CorrelationData>>;

  lookbackPeriod: '30d' | '90d' | '1y';

  strongPositiveCorrelations: Array<{ from: string; to: string; coefficient: number }>;
  strongNegativeCorrelations: Array<{ from: string; to: string; coefficient: number }>;

  completeness?: number;  // 0-100, % of correlations that were computable
  createdAt?: Date;
}

// =============================================================================
// TREASURY CONTEXT
// =============================================================================

/**
 * Context passed to the Cognition Engine.
 * Tells the decision engine which DAO and treasury it's reasoning about.
 */
export interface TreasuryContext {
  daoId: string;
  daoType: DaoType;
  treasuryMode: TreasuryMode;
  treasurySize: TreasurySize;
  riskProfile: RiskProfile;

  /**
   * How this DAO weights objectives in Cognition decisions.
   *
   * Defaults per DAO type (applied by Cognition when not overridden):
   *   harambee:      { liquidity: 0.75, risk: 0.20, yield: 0.05 }
   *   shortTerm:     { liquidity: 0.55, risk: 0.35, yield: 0.10 }
   *   savings:       { liquidity: 0.35, risk: 0.35, yield: 0.30 }
   *   merryGoRound:  { liquidity: 0.65, risk: 0.25, yield: 0.10 }
   *   community:     { liquidity: 0.25, risk: 0.40, yield: 0.35 }
   *   investment:    { liquidity: 0.10, risk: 0.25, yield: 0.65 }
   *
   * Override via governance vote for custom allocation strategies.
   */
  objectiveWeights?: {
    risk: number;       // 0-1
    yield: number;      // 0-1
    liquidity: number;  // 0-1
  };

  /**
   * Current asset holdings. Cognition needs this to calculate:
   * - Over-concentration (single asset > 30% of portfolio)
   * - Rebalance delta (current vs target allocation)
   * - Correlation exposure risk
   * - Liquidity stress (can we exit top 3 positions quickly?)
   */
  currentAllocation?: {
    treasuryPositionId: string;
    assetId: string;
    symbol: string;
    weightPercent: number;
    usdValue: number;
    chain: SupportedChain;
  }[];

  nextDistributionWindow?: {
    membersToReceive: number;
    totalToDistribute: string;
    deadline: Date;
  };

  perpetualMode?: {
    targetAnnualSpendRate: number;  // e.g. 0.04 for 4% rule
    minimumPreserveAssets: boolean;
  };

  maxVolatilityAcceptable: number;  // 0-100
  maxDrawdownTolerance: number;     // % drawdown acceptable before rebalance
}

// =============================================================================
// TREASURY POSITION
// =============================================================================

/**
 * Individual position in a DAO's treasury.
 * Represents a holding of an asset across a chain.
 */
export interface TreasuryPosition {
  id: string;
  daoId: string;
  assetId: string;
  symbol: string;
  chain: SupportedChain;
  balance: string;  // Raw balance (consider decimals)
  decimals: number;
  usdValue: number;
  weightPercent: number;
  acquiredAt: Date;
  yieldStrategy?: YieldStrategyId;
  yieldRate?: number;  // Current APY if earning yield
}

// =============================================================================
// COGNITION QUERY TYPES — Discriminated Union
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
export interface QueryTypeMap {
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
// COGNITION STRATEGY (Pluggable)
// =============================================================================

/**
 * Pluggable strategy pattern for Cognition queries.
 *
 * Enables:
 * - Governance to upgrade decision logic via strategy voting
 * - DAOs to implement custom strategies
 * - Versioned decision audit trail
 * - Hot-swappable algorithms
 *
 * Generic over query type K so that a strategy registered for
 * 'allocation_analysis' is type-checked against AllocationAnalysisQuery
 * and AllocationAnalysisOutput specifically.
 */
export interface CognitionStrategy<K extends CognitionQueryType = CognitionQueryType> {
  id: string;       // e.g. 'allocation_analysis', 'allocation_analysis:v2'
  version: string;
  describe(): string;
  execute(
    query: QueryTypeMap[K]['query'],
    context: TreasuryContext,
  ): Promise<QueryTypeMap[K]['output']>;
}

// =============================================================================
// COGNITION OUTPUT
// =============================================================================

/**
 * Output from the Cognition Engine.
 * Contains decision, reasoning, and provenance for audit trail.
 */
export interface CognitionOutput {
  context: TreasuryContext;
  decisionType: CognitionQueryType;  // Query type that was answered
  recommendedAction: string;  // Natural language action to take
  confidenceScore: number;  // 0-100
  reasoningGraph: VersionedReasoningGraph;  // Structured reasoning with strategy/graph/correlation versions
  riskFlags: Array<{  // Was string[] — now structured to match VersionedReasoningGraph
    severity: 'info' | 'warning' | 'critical';
    message: string;
    affectedAssets?: string[];
  }>;
  executionHints?: Record<string, unknown>;  // Was { priority: 'high'|'medium'|'low'; ... } — now flexible
}

// =============================================================================
// GRAPH QUERY FILTER
// =============================================================================

/**
 * Filter passed to Cognition when requesting a subgraph.
 *
 * FIX #4: edgeTypes is now Array<AssetEdgeRelationshipType> instead of string[].
 * Relationship types are precisely enumerated — string[] allowed silent typos
 * in filter calls with no compile-time error.
 */
export interface GraphQueryFilter {
  assetIds?: string[];
  chains?: SupportedChain[];
  edgeTypes?: Array<AssetEdgeRelationshipType>;  // FIX #4: was string[]
  daoType?: DaoType;
  maxDepth?: number;
  minLiquidity?: number;
}

// =============================================================================
// SHARD SNAPSHOTS
// =============================================================================

/** Technical analysis snapshot (used by Technical Shard) */
export interface TechnicalSnapshot {
  assetId: string;
  timestamp: Date;
  rsi14: number;  // 0-100
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  trend: 'strong_uptrend' | 'uptrend' | 'sideways' | 'downtrend' | 'strong_downtrend';
  momentum: number;  // -100 to +100
  signals: {
    rsiOversold: boolean;   // RSI < 30
    rsiOverbought: boolean; // RSI > 70
    macdCrossover: 'bullish' | 'bearish' | 'none';
    bollingerBounce: boolean;
  };
}

/** Yield analysis snapshot (used by Yield Shard) */
export interface YieldSnapshot {
  assetId: string;
  timestamp: Date;
  strategies: {
    [strategyId in YieldStrategyId]?: {
      apy: number;
      tvl: number;
      riskScore: number;  // 0-100
      lastReward?: Date;
      compound: number;
    };
  };
  estimatedYieldUsd30d?: number;
  estimatedYieldUsd1y?: number;
  volatilityOfRewards?: number;
}

/**
 * Risk analysis snapshot (used by Risk Shard).
 *
 * FIX #3: weightedRiskByDaoType REMOVED.
 *
 * CoreShardData already carries a ⚠️ REMOVED comment for this field with
 * the reasoning "Cognition computes weightedRisk = overallScore × daoSensitivity."
 * Having it on RiskSnapshot contradicted that contract — the same data would
 * exist in two places with potentially different values.
 *
 * overallRiskScore (objective, neutral) lives here.
 * DAO-specific weighting is Cognition's responsibility at query time.
 *
 * Why Record<DaoTypeKey, T> is still the RIGHT pattern elsewhere:
 * - governanceAlignmentScore on CoreShardData is structural, not computed
 * - Risk weighting is a Cognition policy decision, not a shard output
 */
export interface RiskSnapshot {
  assetId: string;
  timestamp: Date;

  // Component scores (objective)
  smartContractScore: number;  // 0-100, higher = safer
  oracleScore: number;
  governanceScore: number;
  liquidationRisk: number;     // For collateral assets

  // Composite objective score — Cognition multiplies this by daoSensitivity
  overallRiskScore: number;  // 0-100

  // Explainability
  riskFactors: {
    factor: string;   // 'smart_contract', 'oracle', 'governance', 'concentration'
    weight: number;   // 0-1, contribution to overall score
    reason: string;
  }[];
}

/** Price snapshot (used by Price Shard) */
export interface PriceSnapshot {
  assetId: string;
  timestamp: Date;
  usd: number;          // Primary price in USD
  confidence: number;   // 0-100
  sources: string[];    // coingecko, binance, uniswap, etc.

  chainSpecific?: {
    [chain in SupportedChain]?: {
      price: number;
      dexPrice?: number;
      confidence: number;
    };
  };

  priceAge: number;  // seconds since last update
  updateFrequency: 'realtime' | '1min' | '5min' | '1hour';
}

// =============================================================================
// CORE SHARD DATA (SNAPSHOT PAYLOAD)
// =============================================================================

/**
 * Core Shard Data — lightweight payload embedded in AssetStateSnapshot.
 *
 * Contains ONLY Intelligence Shard outputs.
 * Does NOT embed graph edges or correlation data (see architectural contract above).
 *
 * FIX #2: correlationGraph REMOVED from this interface.
 *
 * This field directly contradicted the snapshot architectural contract:
 * the header forbids embedding correlations in snapshots because they're O(n²)
 * and have an independent update cycle. Having a mini-correlation summary here
 * created two sources of truth alongside the proper CorrelationMatrix interface,
 * risking divergence between the inline summary and the real matrix.
 *
 * Cognition fetches the full CorrelationMatrix when it needs correlation data.
 * The snapshot is strictly for per-asset shard outputs.
 */
export interface CoreShardData {
  // Price Shard (1-minute update cycle)
  priceUsd: number;
  priceConfidence: number;  // 0-100
  priceSources: string[];
  chainSpecificPrices?: {
    [chain in SupportedChain]?: number;
  };
  priceLastUpdated?: Date | string;

  // Technical Shard (1-hour update cycle)
  technicalRsi14?: number;
  technicalMacd?: { value: number; signal: number; histogram: number };
  technicalTrend?: string;
  technicalMomentum?: number;
  technicalSignals?: Record<string, boolean>;
  technicalLastUpdated?: Date | string;

  // Yield Shard (variable update cycle)
  yieldStrategies?: Record<string, {
    apy: number;
    tvl: number;
    riskScore: number;
  }>;

  // Risk Shard (24-hour update cycle)
  // Objective scores only — DAO-weighted risk is computed by Cognition at query time
  riskSmartContractScore?: number;
  riskOracleScore?: number;
  riskGovernanceScore?: number;
  riskOverallScore?: number;

  // Liquidity Shard (4-hour update cycle)
  liquidityDepth1pct?: number;  // USD tradeable at 1% slippage
  liquidityDepth2pct?: number;  // USD tradeable at 2% slippage
  liquidityDepth5pct?: number;
  liquidityByChain?: Record<SupportedChain, number>;
  liquidityAggregateUsd?: number;
  liquidityLastUpdated?: Date | string;
  liquidityAggregatedProfile?: {
    token: string;
    totalLiquidity: number;
    weightedAverageFee: number;
    depthCurve: {
      impact1Pct: number;
      impact2Pct: number;
      impact5Pct: number;
    };
    perAdapter: Array<{
      protocol: string;
      liquidity: number;
      percentOfTotal: number;
      pools: Array<{
        id: string;
        liquidity: number;
        fee?: number;
        concentration?: number;
      }>;
    }>;
    timestamp: Date;
  };
  liquidityTreasuryReady?: {
    canExecute1pctSlippage: boolean;
    canExecute5pctSlippage: boolean;
    recommendedVenueCount: number;
  };

  // Governance Shard (24-hour update)
  governanceDaoEligibilityTier?: string;  // 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'not_eligible'
  governanceCurationType?: string;         // 'community' | 'professional' | 'elder_curated'
  governanceScores?: {
    daoVotingScore: number;
    participationRate?: number;
    /**
     * Record<DaoTypeKey, number> is correct here: governance alignment IS a structural
     * property of how well an asset fits each DAO's mandate — not a computed policy.
     * Unlike risk weighting, this doesn't change at Cognition query time.
     */
    governanceAlignmentScore?: Record<DaoTypeKey, number>;
  };
  governanceHealth?: string;
  governanceParticipation?: number;
  governanceDelegatedVotingPower?: number;
  governanceHolderConcentration?: number;
  governanceProposalCount?: number;
  governanceLastUpdated?: Date | string;
  governanceTierReasoning?: {
    riskScore: number;
    governanceScore: number;
    liquidityDepth5pct: number;
    determinedAt: string;
  };
  curationTypeReasoning?: {
    tier: string;
    governanceScore: number;
    participationRate: number;
  };
  governanceMetrics?: {
    daoId: string;
    daoName: string;
    totalVotingPower: number;
    delegatedVotingPower: number;
    delegationRatio: number;
    voterCount: number;
    governanceToken: string;
    proposalCount: number;
    activeProposals: number;
    avgProposalDuration: number;
    avgVotingParticipation: number;
  };
  delegationProfile?: {
    governanceScore: number;
    topHolderConcentration: number;
    concentrationStatus: 'high' | 'moderate' | 'low';
    healthStatus: string;
  };

  // Correlation graph summary
  correlationGraph?: {
    strongCorrelations: Array<{
      assetSymbol: string;
      correlation: number;
      relationshipType: 'trend_following' | 'hedge';
    }>;
    weakCorrelations: Array<{
      assetSymbol: string;
      correlation: number;
    }>;
  };

  // Execution Planner Shard
  executionPlan?: {
    protocol: string;
    inputToken: string;
    outputToken: string;
    executionPrice: number;
    priceImpact: number;
    slippageTolerance: number;
    timestamp: Date;
  };
  executionScore?: {
    protocol: string;
    baseScore: number;
    riskScore: number;
    liquidityScore: number;
    gasScore: number;
    totalScore: number;
  };

  // Risk Assessment Shard
  riskMetrics?: {
    priceDeviation: number;
    deviationThreshold: number;
    status: 'WARN' | 'OK' | string;
    venuCount: number;
    timestamp: Date;
  };
  priceDeviation?: number;

  // Relationship Discovery Shard (real-time update)
  relationshipDiscovery?: {
    linkedProtocols: string[];
    dependencyChain: string[];
    impactedBy: string[];
    riskConnections: Array<{
      assetSymbol: string;
      riskType: 'concentration' | 'counterparty' | 'smart_contract' | 'oracle_dependency';
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

// =============================================================================
// ASSET STATE SNAPSHOT
// =============================================================================

/**
 * Complete Asset State Snapshot.
 *
 * ATOMIC unit: One snapshot per asset per timestamp.
 * Written by Intelligence Shards. Read by Cognition Engine.
 *
 * Does NOT embed correlations or full edges (see architectural contract).
 * graphVersion points to the AssetGraphVersion needed for edge traversal.
 */
export interface AssetStateSnapshot {
  assetId: string;
  symbol: string;
  timestamp: Date;

  coreState: CoreShardData;

  /**
   * Points to the AssetGraphVersion this snapshot was computed against.
   * Cognition uses this to load the correct graph when edge traversal is needed.
   */
  graphVersion: number;

  isStale: boolean;
  completeness: number;  // 0-100, % of shards that are fresh

  /**
   * Dynamic shard tracking — new shards auto-tracked without schema changes.
   * Key: shard name. Value: last update timestamp.
   */
  shardUpdateStatus?: Record<string, Date>;
}

// =============================================================================
// LOADED ASSET GRAPH (Reconstructed from DB tables)
// =============================================================================

/**
 * A graph, as loaded by getAssetGraphVersion(): AssetGraphVersion metadata
 * plus the actual node/edge arrays reconstructed from separate tables.
 */
export interface LoadedAssetGraph extends AssetGraphVersion {
  assetNodes: AssetNode[];
  assetEdges: AssetEdge[];
}

// =============================================================================
// DAO OBJECTIVE WEIGHTS
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

// =============================================================================
// DAO EDGE RESTRICTIONS
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
// CONFIDENCE SCORING TYPES
// =============================================================================

export interface ConfidenceFactor {
  factor: string;
  score: number;
  reasoning: string;
}

export interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactor[];
}

/**
 * Optional signal used to adjust confidence. Not every query type has an
 * AssetStateSnapshot on hand (e.g. LiquidityAnalysisQuery doesn't carry
 * one) — callers that have a relevant snapshot pass it; others omit it and
 * get the neutral defaults for freshness/liquidity/volatility factors.
 */
export interface ConfidenceSignal {
  isStale?: boolean;
  createdAt?: Date;
  liquidityDepth5pct?: number;
  technicalMomentum?: number;
  technicalRsi14?: number;
  signalConflict?: boolean;
  allSignalsAlign?: boolean;
}

// =============================================================================
// VERSIONED REASONING GRAPH
// =============================================================================

/**
 * Versioned Reasoning Graph.
 *
 * Every Cognition decision is fully traceable for institutional auditability.
 *
 * FIX #6: Added daoId field.
 * Previously every audit field was present (strategy version, graph version,
 * correlation version, factors, weights, risk flags) but the deciding DAO was
 * not recorded. This made per-DAO queries impossible:
 * "all decisions made for harambee X" or
 * "what did DAO Y decide about AAVE last month" had no reliable answer.
 */
export interface VersionedReasoningGraph {
  // ========== AUDIT IDENTITY (FIX #6) ==========
  daoId: string;          // FIX #6: Which DAO made this decision?
  daoType: DaoTypeKey;    // Included for denormalised query convenience

  // ========== VERSION TRACKING ==========
  engineVersion: string;        // Cognition Engine version (e.g. "1.0.0")
  strategyId: string;
  strategyVersion: string;

  graphVersionUsed: number;
  correlationVersionUsed: number;

  // ========== DECISION TRACE ==========
  queryType: CognitionQueryType;  // allocation_analysis, liquidity_analysis, etc.

  factors: Array<{
    name: string;             // 'volatility', 'concentration', 'yield', etc.
    weight: number;           // 0-1, contribution to final score
    rawValue: number;
    normalizedScore: number;  // 0-100
    direction: 'higher_is_better' | 'lower_is_better';
    reasoning: string;
  }>;

  objectiveWeights: ObjectiveWeights;

  compositeScore: number;  // 0-100

  // ========== CONFIDENCE & RELIABILITY ==========
  confidenceScore: number;  // 0-100
  confidenceFactors: Array<{
    factor: string;    // 'data_freshness', 'signal_agreement', 'liquidity_reliability'
    score: number;
    reasoning: string;
  }>;

  // ========== RISKS & CONCERNS ==========
  riskFlags: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    affectedAssets?: string[];
  }>;

  timestamp: Date;
}