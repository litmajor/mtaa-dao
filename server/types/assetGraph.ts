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
 *    - Example: bail_fund can't use collateral_pair edges
 *
 * 4. Graph versioning supports:
 *    - Backtesting (use historical graph version)
 *    - A/B testing graph changes
 *    - Audit trail (what graph did this decision use?)
 *
 * ========== FIXES APPLIED ==========
 *
 * FIX #1: daoEligibility changed from hardcoded struct to Record<DaoType, boolean>.
 *         Adding a new DaoType no longer requires a schema migration on every AssetNode.
 *
 * FIX #2: CoreShardData.correlationGraph removed. Snapshot architecture explicitly
 *         forbids embedding correlations — this field directly contradicted the contract
 *         and created a second source of truth alongside CorrelationMatrix.
 *
 * FIX #3: RiskSnapshot.weightedRiskByDaoType removed. CoreShardData already carries
 *         a ⚠️ REMOVED comment for this field with the reasoning "Cognition computes it."
 *         Having it on RiskSnapshot was inconsistent. overallRiskScore (objective) lives
 *         here; DAO-weighted scores are Cognition's responsibility.
 *
 * FIX #4: GraphQueryFilter.edgeTypes typed as Array<AssetEdge['relationshipType']>
 *         instead of string[]. Relationship types are precisely enumerated — string[]
 *         lost all type safety and allowed silent typos in filter calls.
 *
 * FIX #5: edgeDiffFromPreviousVersion.modified changed from AssetEdge[] to
 *         Array<{ edgeId: string; changes: Partial<AssetEdge> }>. Storing complete
 *         objects for modifications defeated the purpose of differential storage.
 *
 * FIX #6: VersionedReasoningGraph gains daoId field. Every other audit field was
 *         present (strategy, graph, correlation versions) but the deciding DAO was
 *         not recorded, making the audit trail incomplete for per-DAO queries.
 */

// =============================================================================
// DOMAIN ENUMS
// =============================================================================

/**
 * DAO Types in the System.
 * Each requires different Cognition logic.
 * FIX #1: All DAO-aware fields now use Record<DaoType, T> so adding a new type
 * here propagates automatically without schema migrations.
 */
export type DaoType =
  | 'free'              // Ad-hoc, no treasury
  | 'short_term'        // 30/60/90 day rotation, member distributions
  | 'long_term'         // Ongoing, multi-sig controlled
  | 'bail_fund'         // Rotation distribution to recipients
  | 'funeral_fund'      // Emergency distributions, mutual aid
  | 'investment_club'   // Yield strategy accumulation
  | 'foundation';       // Governance-heavy, endowment mode

/** Treasury Modes determine Cognition behavior */
export type TreasuryMode =
  | 'accumulative'   // Growth mode, compound returns (investment_club, foundation)
  | 'distributive';  // Payout mode, rotation windows (short_term, bail_fund, funeral_fund)

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
export type SupportedChain = 'celo' | 'ethereum' | 'base' | 'polygon';

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
   * FIX #1: Was a hardcoded struct with one field per DaoType.
   * Now Record<DaoType, boolean> — adding a new DaoType requires only updating
   * the DaoType union above; no schema change needed on AssetNode.
   */
  daoEligibility: Record<DaoType, boolean>;

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

  completeness: number;  // 0-100, % of correlations that were computable
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
   *   bail_fund:       { liquidity: 0.6, risk: 0.3, yield: 0.1 }
   *   short_term:      { liquidity: 0.6, risk: 0.2, yield: 0.2 }
   *   investment_club: { yield: 0.6, risk: 0.3, liquidity: 0.1 }
   *   foundation:      { risk: 0.6, yield: 0.3, liquidity: 0.1 }
   *   long_term:       { risk: 0.4, yield: 0.4, liquidity: 0.2 }
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
 * Why Record<DaoType, T> is still the RIGHT pattern elsewhere:
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

  // Technical Shard (1-hour update cycle)
  technicalRsi14?: number;
  technicalMacd?: { value: number; signal: number; histogram: number };
  technicalTrend?: string;
  technicalMomentum?: number;
  technicalSignals?: Record<string, boolean>;

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
  liquidityDepth5pct?: number;
  liquidityByChain?: Record<SupportedChain, number>;

  // Governance Shard (24-hour update cycle)
  governanceDaoEligibilityTier?: string;  // 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'not_eligible'
  governanceCurationType?: string;         // 'community' | 'professional' | 'elder_curated'
  governanceScores?: {
    daoVotingScore: number;
    /**
     * Record<DaoType, number> is correct here: governance alignment IS a structural
     * property of how well an asset fits each DAO's mandate — not a computed policy.
     * Unlike risk weighting, this doesn't change at Cognition query time.
     */
    governanceAlignmentScore?: Record<DaoType, number>;
  };

  // Relationship Discovery Shard (real-time update)
  relationshipDiscovery?: {
    linkedProtocols: string[];
    dependencyChain: string[];
    impactedBy: string[];
    riskConnections: Array<{
      assetSymbol: string;
      riskType: 'concentration' | 'counterparty' | 'smart_contract';
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
// COGNITION ENGINE INTERFACES
// =============================================================================

/**
 * Pluggable strategy pattern for Cognition queries.
 *
 * Enables:
 * - Governance to upgrade decision logic via strategy voting
 * - DAOs to implement custom strategies
 * - Versioned decision audit trail
 * - Hot-swappable algorithms
 */
export interface CognitionStrategy {
  id: string;       // e.g. 'allocation_analysis', 'allocation_analysis:v2'
  version: string;
  describe(): string;
  execute(query: any, context: TreasuryContext): Promise<any>;
}

/**
 * Versioned Reasoning Graph.
 *
 * Every Cognition decision is fully traceable for institutional auditability.
 *
 * FIX #6: Added daoId field.
 * Previously every audit field was present (strategy version, graph version,
 * correlation version, factors, weights, risk flags) but the deciding DAO was
 * not recorded. This made per-DAO queries impossible:
 * "all decisions made for bail_fund X" or
 * "what did DAO Y decide about AAVE last month" had no reliable answer.
 */
export interface VersionedReasoningGraph {
  // ========== AUDIT IDENTITY (FIX #6) ==========
  daoId: string;          // FIX #6: Which DAO made this decision?
  daoType: DaoType;       // Included for denormalised query convenience

  // ========== VERSION TRACKING ==========
  engineVersion: string;        // Cognition Engine version (e.g. "1.0.0")
  strategyId: string;
  strategyVersion: string;

  graphVersionUsed: number;
  correlationVersionUsed: number;

  // ========== DECISION TRACE ==========
  queryType: string;  // allocation_analysis, liquidity_analysis, etc.

  factors: Array<{
    name: string;             // 'volatility', 'concentration', 'yield', etc.
    weight: number;           // 0-1, contribution to final score
    rawValue: number;
    normalizedScore: number;  // 0-100
    direction: 'higher_is_better' | 'lower_is_better';
    reasoning: string;
  }>;

  objectiveWeights: Record<string, number>;

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