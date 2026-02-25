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
 * ========== CRITICAL ARCHITECTURAL REFINEMENT ==========
 * 
 * ATOMIC SNAPSHOTS (Asset State Snapshot):
 * - Stores ONLY core shard data: price, technical, yield, risk, liquidity
 * - ONE snapshot per asset per update cycle
 * - Small, fast writes (~2KB per asset)
 * - References graph version number, does NOT embed graph
 * 
 * Why not embed graph in snapshot?
 * - Edges can explode: 1000 assets × 100 edges each = 100K edges
 * - Correlations: O(n²) = 500K correlations at 1000 assets
 * - If embedded in every snapshot: 100K+ edges × 1000 assets = 100M records stored redundantly
 * - Performance catastrophe: write latency, storage bloat, query slowness
 * 
 * SOLUTION: Separate storage layers
 * 
 * AssetGraphVersion:
 * - Stores COMPLETE graph (nodes + edges) at a point in time
 * - Updated ONLY when graph changes (new bridge, new LP, new yield track)
 * - Not updated with every shard cycle
 * - Snapshots reference it by version number
 * - Cognition can load when needed for full traversal/filtering
 * - Different DAO types can request filtered subgraphs
 * 
 * CorrelationMatrix:
 * - Stores correlations between all assets
 * - SPARSE matrix: { from_id: { to_id: CorrelationData } }
 * - Updated once per 24-hour cycle (independent of snapshot cycle)
 * - Indexed by version number
 * - Cognition loads when analyzing hedging/diversification
 * 
 * Snapshot query flow:
 * 1. Load asset snapshot (lightweight, ~2KB)
 * 2. If Cognition needs edges for hedging: Load AssetGraphVersion by graphVersion number
 * 3. If Cognition needs correlations: Load CorrelationMatrix by graphVersion number
 * 4. Cache graph + correlations for this request (not redundantly stored)
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
 */

/**
 * DAO Types in the System
 * Each requires different Cognition logic
 */
export type DaoType = 
  | 'free'                  // Ad-hoc, no treasury
  | 'short_term'            // 30/60/90 day rotation, member distributions
  | 'long_term'             // Ongoing, multi-sig controlled
  | 'bail_fund'             // Rotation distribution to recipients
  | 'funeral_fund'          // Emergency distributions, mutual aid
  | 'investment_club'       // Yield strategy accumulation
  | 'foundation';           // Governance-heavy, endowment mode

/**
 * Treasury Modes determine Cognition behavior
 */
export type TreasuryMode = 
  | 'accumulative'          // Growth mode, compound returns (investment_club, foundation)
  | 'distributive';         // Payout mode, rotation windows (short_term, bail_fund, funeral_fund)

/**
 * Treasury Size for constraint scaling
 */
export type TreasurySize = 
  | 'small'                 // < $1K, conservative
  | 'medium'                // $1K - $100K, balanced
  | 'large';                // > $100K, can support aggressive

/**
 * Risk Profile for Cognition scoring
 */
export type RiskProfile = 
  | 'conservative'          // 70%+ stable assets
  | 'balanced'              // Mixed allocation
  | 'aggressive';           // 40%+ volatile exposure

/**
 * Asset Classification for treasury composition
 */
export type AssetClass = 
  | 'stable'                // Stablecoins (cUSD, USDT, cEUR)
  | 'volatile'              // Crypto assets (CELO, BTC, ETH)
  | 'yield'                 // Yield-generating (in lending vaults)
  | 'lp'                    // Liquidity provider tokens (UBE-CELO)
  | 'vault'                 // Vault deposits (Moola, etc.)
  | 'nft'                   // NFT holdings
  | 'wrapped'               // Wrapped assets (WETH, WBTC)
  | 'exotic';               // Emerging/experimental tokens

/**
 * Supported Chains in the System
 */
export type SupportedChain = 'celo' | 'ethereum' | 'base' | 'polygon';

/**
 * Supported Bridge Protocols
 */
export type BridgeProtocol = 'layerzero' | 'axelar' | 'wormhole' | 'stargate';

/**
 * Yield Strategy Types
 */
export type YieldStrategyId = 
  | 'moola-lending'         // Moola lending pool, 8.5% APY
  | 'celo-staking'          // Celo validator staking, 6.2% APY
  | 'ubeswap-lp';           // Ubeswap liquidity provide, 12.3% APY

/**
 * Core Asset Node in the Graph
 * Represents a tradable asset with chain presence, governance rules,
 * and yield eligibility. Is governance-aware and DAO-context-aware.
 */
export interface AssetNode {
  // ========== IDENTITY ==========
  id: string;               // Unique asset ID (e.g., 'celo:0x765DE816845861e75A25fCA122bb6898B6F02612')
  symbol: string;           // cUSD, CELO, cEUR, BTC, ETH, UNI, etc.
  name?: string;            // Full name if available
  
  // ========== CLASSIFICATION ==========
  assetType: 'L1' | 'L2' | 'stablecoin' | 'yield_token' | 'lp_token' | 'vault_token' | 'nft' | 'derivative';
  assetClass: AssetClass;   // For treasury composition tracking
  
  // ========== GOVERNANCE & DAO ELIGIBILITY ==========
  /**
   * Which DAO types can hold this asset?
   * Constraints inherited from asset type, chain, and liquidity
   */
  daoEligibility: {
    free: boolean;
    short_term: boolean;
    long_term: boolean;
    bail_fund: boolean;
    funeral_fund: boolean;
    investment_club: boolean;
    foundation: boolean;
  };
  
  /**
   * Governance tier for curation
   * Verified = Protocol-reviewed, Community = DAO-curated, Open = Permissionless
   */
  governanceTier: 'verified' | 'community' | 'open';
  
  // ========== CHAIN PRESENCE (CRITICAL FOR MULTI-CHAIN TREASURY) ==========
  chainPresence: {
    [chain in SupportedChain]?: {
      address: string;              // Smart contract address
      decimals: number;
      isActive: boolean;
      
      // Bridge options if moving to other chains
      bridges?: {
        [targetChain in SupportedChain]?: {
          protocol: BridgeProtocol;
          bridgeContract?: string;
          minimumAmount: string;
          maximumAmount: string;
          estimatedTime: number;    // seconds
          feePercentage: number;    // 0.1 - 1.0%
          active: boolean;
        };
      };
    };
  };
  
  // ========== RISK CLASSIFICATION ==========
  riskLevel: 'low' | 'medium' | 'high';
  volatilityProfile: number;        // 0-100, like beta (30 day rolling)
  liquidityScore: number;           // 1-100 aggregate across chains where active
  
  /**
   * Smart contract risk factors
   * Used by Risk Shard for scoring
   */
  contractRisk?: {
    auditStatus: 'fully_audited' | 'partially_audited' | 'unaudited';
    knownVulnerabilities?: string[];
    ageInDays?: number;              // Time since contract deployment
  };
  
  // ========== YIELD ELIGIBILITY (FOR ACCUMULATIVE TREASURIES) ==========
  yieldEligible: boolean;
  yieldStrategies?: {
    [strategyId in YieldStrategyId]?: {
      apy: number;                  // Annual percentage yield
      minAmount: string;            // Minimum deposit
      maxAmount?: string;           // Maximum deposit cap
      chain: SupportedChain;        // Which chain this strategy is available on
      protocol: string;             // Moola, Celo Validators, Ubeswap, etc.
      lockPeriod?: number;          // Days, if applicable
      riskScore: number;            // 0-100, protocol-specific risk
      fees: {
        deposit?: number;           // % fee on deposit
        withdraw?: number;          // % fee on withdrawal
        performance?: number;       // % fee on yield earned
      };
    };
  };
  
  // ========== LIQUIDITY PROFILE (FOR EXECUTION PLANNING) ==========
  /**
   * Estimated time to liquidate at 5% slippage
   * Critical for rotation DAOs with hard payout deadlines
   */
  minExitTime: number;              // seconds
  
  /**
   * For locked positions (e.g., time-locked vaults)
   * When can this asset be withdrawn penalty-free?
   */
  penaltyFreeWithdrawUntil?: Date;
  
  /**
   * For redemption windows (e.g., Aave deposits)
   * Some positions might have unlock times
   */
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
  dataQuality: number;              // 1-100 confidence in this node's data
}

/**
 * Asset Edge in the Graph
 * Represents a typed relationship between two assets
 * 
 * Examples:
 * - WETH wraps ETH (wrapped relationship)
 * - UBE-CELO is an LP pair (liquidity_pair relationship)
 * - cUSD is a stablecoin derivative of USD (derivative relationship)
 * - USDC bridges to USDCe via Wormhole (bridge_route relationship)
 */
export interface AssetEdge {
  // ========== IDENTITY ==========
  id: string;               // Unique edge ID
  sourceAssetId: string;    // From asset node
  targetAssetId: string;    // To asset node
  
  // ========== RELATIONSHIP TYPE ==========
  relationshipType: 
    | 'wrapped'             // WETH wraps ETH (fungible, 1:1 conversion)
    | 'lp_pair'             // UBE-CELO is an LP token for that pair
    | 'derivative'          // cUSD derives from USD peg
    | 'bridge_route'        // USDC Ethereum <-> Base via Wormhole
    | 'yield_feed'          // cUSD feeds into Moola yield protocol
    | 'collateral_pair'     // BTC collateral for USDC borrow in Aave
    | 'correlated_upside'   // ETH correlates strongly with CELO (both volatile)
    | 'correlated_hedge'    // USDT is hedge against volatility spikes
    | 'liquidity_source';   // Uniswap provides DEX liquidity for swaps
  
  // ========== EDGE PROPERTIES (CRITICAL FOR EXECUTION) ==========
  /**
   * Can we actually execute this edge?
   * Dollar amount at given slippage threshold
   */
  liquidity: {
    at1PercentSlippage: number;      // USD amount tradeable at 1% slippage
    at5PercentSlippage: number;      // USD amount tradeable at 5% slippage
    lastUpdated: Date;
  };
  
  /**
   * What does it cost to traverse this edge?
   */
  cost: {
    slippageBasisPoints: number;     // Default slippage % * 100
    bridgeFeePercent?: number;       // If bridge_route
    swapFeePercent?: number;         // If swap edge
    gasCostUsd: number;              // Denominated in USD for easy comparison
  };
  
  /**
   * How long does this take?
   * Critical for rotation DAOs with hard deadlines
   */
  executionTime: {
    minSeconds: number;              // Best case
    maxSeconds: number;              // Worst case (network congestion)
    avgSeconds: number;              // Expected
  };
  
  /**
   * How risky is this edge?
   */
  riskFactor: number;               // 0-1, where 1 is maximal risk
  risks?: string[];                 // "bridge_security", "oracle_risk", "slippage_variance", etc.
  
  // ========== METADATA ==========
  isActive: boolean;                // Is this edge currently tradeable?
  lastUpdated: Date;
}

/**
 * Context passed to Cognition Engine
 * Tells the decision engine which DAO and treasury we're reasoning about
 */
export interface TreasuryContext {
  daoId: string;
  daoType: DaoType;
  treasuryMode: TreasuryMode;
  treasurySize: TreasurySize;
  riskProfile: RiskProfile;
  
  // ========== OBJECTIVE WEIGHTING (PERSONA + GOVERNANCE OVERRIDE) ==========
  /**
   * How this DAO weights different objectives in Cognition decisions.
   * 
   * Default per DAO type:
   * - bail_fund:           { liquidity: 0.6, risk: 0.3, yield: 0.1 }
   * - short_term:          { liquidity: 0.6, risk: 0.2, yield: 0.2 }
   * - investment_club:     { yield: 0.6, risk: 0.3, liquidity: 0.1 }
   * - foundation:          { risk: 0.6, yield: 0.3, liquidity: 0.1 }
   * - long_term:           { risk: 0.4, yield: 0.4, liquidity: 0.2 }
   * \n   * Override via governance vote for custom allocation strategies.
   * \n   * When provided, overrides default persona weights.\n   * Enables institutional treasuries to customize decision logic.\n   */\n  objectiveWeights?: {\n    risk: number;                  // 0-1, how much focus on reducing downside?\n    yield: number;                 // 0-1, how much focus on returns?\n    liquidity: number;             // 0-1, how much focus on exit speed?\n  };\n  \n  // ========== CURRENT ALLOCATION (CRITICAL FOR COGNITION) ==========\n  /**\n   * Current asset holdings by position ID\n   * \n   * Cognition needs this to calculate:\n   * - Over-concentration (single asset > 30% of portfolio)\n   * - Rebalance delta (current vs target allocation)\n   * - Correlation exposure risk (cumulative risk from related assets)\n   * - Liquidity stress (can we exit top 3 positions quickly?)\n   * \n   * Without this, cognition can't reason about portfolio-level decisions\n   */\n  currentAllocation?: {\n    treasuryPositionId: string;     // Links to treasuryPositions table\n    assetId: string;\n    symbol: string;\n    weightPercent: number;           // % of total treasury value\n    usdValue: number;\n    chain: SupportedChain;\n  }[];\n  \n  // ========== TIME CONSTRAINTS ==========\n  \n  // For rotation DAOs\n  nextDistributionWindow?: {\n    membersToReceive: number;\n    totalToDistribute: string;       // USD amount\n    deadline: Date;                  // Hard cutoff for paying members\n  };\n  \n  // For accumulative treasuries\n  perpetualMode?: {\n    targetAnnualSpendRate: number;  // e.g., 0.04 for 4% rule (endowment)\n    minimumPreserveAssets: boolean;  // Keep core capital intact?\n  };\n  \n  // ========== RISK TOLERANCE ==========\n  maxVolatilityAcceptable: number;  // 0-100\n  maxDrawdownTolerance: number;     // % drawdown acceptable before rebalance\n}

/**
 * Relationship strength for correlation-based decisions
 */
export interface CorrelationData {
  assetId: string;
  symbol: string;
  correlationCoefficient: number;   // -1.0 to +1.0
  relationship: 'strong_positive' | 'weak_positive' | 'no_correlation' | 'weak_negative' | 'strong_negative';
  lookbackPeriod: '30d' | '90d' | '1y';
  confidence: number;               // 0-100, based on sample size
}

/**
 * Asset Graph Version (Git-Like Design)
 * 
 * Stores a snapshot reference to the graph at a point in time.
 * Uses hash-based versioning to avoid O(version * nodes * edges) storage explosion.
 * 
 * Graph storage is SEPARATE from versioning:
 * - assetNodes table: indexed, queryable by version
 * - assetEdges table: indexed, queryable by version
 * - assetGraphVersions: just metadata + hashes
 * 
 * This way:
 * - Adding 1 new edge = 1 new row in assetEdges
 * - NOT creating a full copy of entire graph
 * - Snapshots reference version efficiently
 * - Supports efficient diffs (edgeDiffFromPreviousVersion)
 */
export interface AssetGraphVersion {
  version: number;                  // Incremental version counter (commit-like)
  timestamp: Date;                  // When was this version created?
  
  // ========== HASH-BASED REFERENCES (NOT FULL COPIES) ==========
  /**
   * SHA256 hash of all nodes in this version
   * If hash == previous version, nodes haven't changed
   * Cognition can skip reloading nodes
   */
  nodeHash: string;
  
  /**
   * SHA256 hash of all edges in this version
   * If hash == previous version, edges haven't changed
   */
  edgeHash: string;
  
  // ========== STORAGE REFERENCES ==========
  /**
   * Counts (for quick stats without full load)
   */
  nodeCount: number;
  edgeCount: number;
  
  /**
   * Differential storage: only changed edges from previous version
   * If populated, means not ALL edges changed, just these
   */
  edgeDiffFromPreviousVersion?: {
    added: AssetEdge[];
    removed: string[];  // AssetEdge IDs
    modified: AssetEdge[];
  };
  
  /**
   * Why this version was created
   */
  changeReason?: 'bridge_added' | 'lp_pair_discovered' | 'yield_strategy_added' | 'edge_pruned' | 'scheduled_refresh' | 'scheduled_audit';
  changeDetails?: string;
  
  /**
   * For efficient queries when full graph not needed:
   * Pre-computed indexes by type/chain
   * Stored as reference IDs, not full objects
   */
  edgeCountByType?: Record<string, number>;
  edgeCountByChain?: Record<SupportedChain, number>;
}

/**
 * Correlation Matrix (INDEPENDENT Versioning)
 * 
 * Stores correlations between ALL assets.
 * 
 * CRITICAL: Decoupled from AssetGraphVersion
 * 
 * Why?
 * - Graph changes when: bridge added, new asset, yield strategy added
 * - Correlation changes when: market dynamics shift, 30/90/1y lookback window moves
 * - These are INDEPENDENT events
 * 
 * Bad design: recompute correlations every time a bridge edge is added
 * Good design: correlation cycle independent from graph cycle
 * 
 * Example:
 * - v1 graph: 100 edges
 * - v1 correlation: 500K correlations (30d lookback)
 * - Bridge added
 * - v2 graph: 101 edges (new bridge)
 * - v1 correlation STILL VALID (no need to recompute)
 * - 24h later
 * - v2 correlation: 500K correlations (NEW 30d lookback)
 * - Can use v2 graph + v2 correlation, or v2 graph + v1 correlation
 */
export interface CorrelationMatrix {
  matrixVersion: number;            // INDEPENDENT version counter (not tied to graphVersion)
  timestamp: Date;
  
  /**
   * Which graph version was this correlation computed against?
   * For audit trail and compatibility checking
   */
  computedAgainstGraphVersion: number;
  
  /**
   * Sparse matrix representation:
   * {
   *   "asset1_id": {
   *     "asset2_id": { coefficient: 0.85, relationship: "strong_positive", ... },
   *     "asset3_id": { coefficient: -0.42, relationship: "strong_negative", ... }
   *   }
   * }
   * 
   * Only stores non-zero or significant correlations to save space
   */
  correlationMatrix: Record<string, Record<string, CorrelationData>>;
  
  /**
   * Lookback period used for this matrix
   * 30d correlations are different from 90d
   */
  lookbackPeriod: '30d' | '90d' | '1y';
  
  /**
   * Convenience indexes (for quick access without full matrix load)
   */
  strongPositiveCorrelations: Array<{from: string; to: string; coefficient: number}>;
  strongNegativeCorrelations: Array<{from: string; to: string; coefficient: number}>;
  
  /**
   * Data quality
   */
  completeness: number;             // 0-100, what % of correlations were computable?
}

/**
 * Graph Query Filter
 * 
 * When Cognition needs a subgraph, it requests with filters
 */
export interface GraphQueryFilter {
  assetIds?: string[];              // Only these assets
  chains?: SupportedChain[];        // Only these chains
  edgeTypes?: string[];             // Only these edge types
  daoType?: DaoType;                // DAO-aware filtering (some edges not relevant for bail_fund)
  maxDepth?: number;                // Graph traversal depth limit
  minLiquidity?: number;            // Only edges with this much liquidity
}

/**
 * Technical analysis snapshot (used by Technical Shard)
 */
export interface TechnicalSnapshot {
  assetId: string;
  timestamp: Date;
  rsi14: number;                    // 0-100
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
  momentum: number;                 // -100 to +100
  signals: {
    rsiOversold: boolean;           // RSI < 30
    rsiOverbought: boolean;         // RSI > 70
    macdCrossover: 'bullish' | 'bearish' | 'none';
    bollingerBounce: boolean;
  };
}

/**
 * Yield analysis snapshot (used by Yield Shard)
 */
export interface YieldSnapshot {
  assetId: string;
  timestamp: Date;
  strategies: {
    [strategyId in YieldStrategyId]?: {
      apy: number;
      tvl: number;
      riskScore: number;            // 0-100
      lastReward?: Date;
      compound: number;              // How yield compounds
    };
  };
  estimatedYieldUsd30d?: number;    // 30-day projection
  estimatedYieldUsd1y?: number;     // 1-year projection
  volatilityOfRewards?: number;     // Does this strategy pay consistently?
}

/**
 * Risk analysis snapshot (used by Risk Shard)
 * 
 * DYNAMIC DAO-WEIGHTED RISKS (Future-Proof)
 * 
 * Why Record<DaoType, number> instead of hardcoded fields?
 * - New DAO types emerge
 * - Hardcoded fields require schema migrations
 * - Record<> is elastic: add new DaoType, doesn't break schema
 * - Risk weighting is governance decision, not structural
 * 
 * This design survives:
 * - Adding new DAO types
 * - Changing risk weighting formulas
 * - Historical analysis (can reweight old data)
 */
export interface RiskSnapshot {
  assetId: string;
  timestamp: Date;
  
  // ========== COMPONENT SCORES ==========
  smartContractScore: number;       // 0-100, higher = safer
  oracleScore: number;
  governanceScore: number;
  liquidationRisk: number;          // For collateral assets
  
  // ========== COMPOSITE SCORE ==========
  overallRiskScore: number;         // 0-100, composite (neutral weighting)
  
  // ========== DAO-WEIGHTED RISKS (DYNAMIC) ==========
  /**
   * Key: DaoType (enum: 'free', 'short_term', 'long_term', 'bail_fund', 'funeral_fund', 'investment_club', 'foundation')
   * Value: risk score weighted for that DAO type (0-100)
   * 
   * Same asset, different DAO = different perceived risk
   * Example:
   * - AAVE deposit: foundation scores it 40 (stable, audited)
   * - AAVE deposit: bail_fund scores it 75 (collateral risk, lock-in risk)
   * 
   * When new DAO type added:
   * Simply add new entry, no schema migration
   */
  weightedRiskByDaoType: Record<DaoType, number>;
  
  // ========== EXPLAINABILITY ==========
  riskFactors: {
    factor: string;                 // 'smart_contract', 'oracle', 'governance', 'concentration', etc
    weight: number;                 // 0-1, contribution to overall score
    reason: string;                 // Human-readable explanation
  }[];
}

/**
 * Price snapshot (used by Price Shard)
 * Prices vary by chain due to fees/slippage
 */
export interface PriceSnapshot {
  assetId: string;
  timestamp: Date;
  usd: number;                      // Primary price in USD
  confidence: number;               // 0-100, how trusted?
  sources: string[];                // coingecko, binance, uniswap, etc.
  
  // Chain-specific prices (can vary due to bridge fees, slippage)
  chainSpecific?: {
    [chain in SupportedChain]?: {
      price: number;
      dexPrice?: number;
      confidence: number;
    };
  };
  
  priceAge: number;                 // seconds since last update
  updateFrequency: 'realtime' | '1min' | '5min' | '1hour'; // How often do we check?
}

/**
 * Cognition Strategy Interface
 * 
 * Pluggable strategy pattern for Cognition queries.
 * 
 * Enables:
 * - Governance to upgrade decision logic via strategy voting
 * - DAOs to implement custom strategies
 * - Versioned decision audit trail
 * - Hot-swappable algorithms
 * 
 * Strategies are stored in a registry, selected at query time.
 * Each strategy can be versioned and independently upgraded.
 */
export interface CognitionStrategy {
  /**
   * Strategy identifier (e.g., 'allocation_analysis', 'allocation_analysis:v2')
   */
  id: string;
  
  /**
   * Version string for audit trail and compatibility checking
   */
  version: string;
  
  /**
   * Human-readable description of this strategy
   */
  describe(): string;
  
  /**
   * Execute the strategy with query and context
   * Returns the decision output
   */
  execute(query: any, context: TreasuryContext): Promise<any>;
}

/**
 * Versioned Reasoning Graph
 * 
 * Enables institutional-grade provenance and auditability.
 * 
 * Every decision is traceable to:
 * - Which strategy version made the decision
 * - Which graph version was used
 * - Which correlation matrix was used
 * - What factors influenced the score
 * - What weights were applied
 * - What risks were flagged
 * 
 * This makes decisions reproducible, verifiable, and defensible.
 */
export interface VersionedReasoningGraph {
  // ========== VERSION TRACKING ==========
  engineVersion: string;            // Cognition Engine version (e.g., "1.0.0")
  strategyId: string;               // Which strategy was used
  strategyVersion: string;          // Version of that strategy
  
  graphVersionUsed: number;         // Which graph version?
  correlationVersionUsed: number;   // Which correlation matrix?
  
  // ========== DECISION TRACE ==========
  queryType: string;                // allocation_analysis, liquidity_analysis, etc.
  
  /**
   * What factors were considered?
   */
  factors: Array<{
    name: string;                 // 'volatility', 'concentration', 'yield', etc.
    weight: number;               // 0-1, contribution to final score
    rawValue: number;             // The actual value from snapshot
    normalizedScore: number;      // 0-100, after normalization
    direction: 'higher_is_better' | 'lower_is_better';
    reasoning: string;            // Explanation of factor
  }>;
  
  /**
   * What objective weights were used?
   */
  objectiveWeights: Record<string, number>;
  
  /**
   * Final composite score
   */
  compositeScore: number;           // 0-100
  
  // ========== CONFIDENCE & RELIABILITY ==========
  confidenceScore: number;          // 0-100
  confidenceFactors: Array<{
    factor: string;               // 'data_freshness', 'signal_agreement', 'liquidity_reliability'
    score: number;                // 0-100
    reasoning: string;
  }>;
  
  // ========== RISKS & CONCERNS ==========
  riskFlags: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    affectedAssets?: string[];
  }>;
  
  /**
   * When was this reasoning generated?
   */
  timestamp: Date;
}

/**
 * Core Shard Data (Lightweight)
 * 
 * Contains ONLY the output from Intelligence Shards.
 * Does NOT embed graph data (edges, correlations).
 * 
 * Kept separate because:
 * - Each shard updates at different frequency
 * - Snapshot should be atomic (one write per update)
 * - Graph is dynamic (bridges, LP pairs change; correlations recompute)
 */
export interface CoreShardData {
  // Price Shard (1-minute update cycle)
  priceUsd: number;
  priceConfidence: number;           // 0-100
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
  riskSmartContractScore?: number;
  riskOracleScore?: number;
  riskGovernanceScore?: number;
  riskOverallScore?: number;
  // ⚠️ REMOVED: riskWeightedByDaoType
  // Reason: Risk should be OBJECTIVE here.
  // Cognition layer computes: weightedRisk = overallScore * daoSensitivity
  // This keeps shards testable and governance overrides possible.
  
  // Liquidity Shard (4-hour update cycle)
  liquidityDepth1pct?: number;       // USD tradeable at 1% slippage
  liquidityDepth5pct?: number;
  liquidityByChain?: Record<SupportedChain, number>;
  
  // Governance Shard (24-hour update cycle)
  governanceDaoEligibilityTier?: string;  // 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'not_eligible'
  governanceCurationType?: string;        // 'community' | 'professional' | 'elder_curated'
  governanceScores?: {
    daoVotingScore: number;               // How well this asset fits DAO voting criteria
    governanceAlignmentScore?: Record<DaoType, number>;
  };
  
  // Structural Shards (real-time update)
  correlationGraph?: {
    strongCorrelations: Array<{
      assetSymbol: string;
      correlation: number;                // -1 to 1
      relationshipType: 'hedge' | 'trend_following' | 'uncorrelated';
    }>;
    weakCorrelations?: Array<{
      assetSymbol: string;
      correlation: number;
    }>;
  };
  
  relationshipDiscovery?: {
    linkedProtocols: string[];            // Protocols that use this asset
    dependencyChain: string[];            // Assets this depends on
    impactedBy: string[];                 // What influences this asset
    riskConnections: Array<{
      assetSymbol: string;
      riskType: 'concentration' | 'counterparty' | 'smart_contract';
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

/**
 * Complete Asset State Snapshot
 * 
 * ATOMIC unit: One snapshot per asset per timestamp.
 * 
 * Written by Intelligence Shards.
 * Read by Cognition Engine.
 * 
 * KEY DESIGN: Does NOT embed correlations or full edges.
 * Reasons:
 * - Correlations = O(n²), would bloat every snapshot
 * - Edges can explode (bridges, LP pairs, yield feeds)
 * - Graph updates independently of shard updates
 * - Cognition can request graph separately when needed
 */
export interface AssetStateSnapshot {
  // ========== IDENTITY ==========
  assetId: string;
  symbol: string;
  timestamp: Date;
  
  // ========== CORE SHARD DATA ==========
  coreState: CoreShardData;
  
  // ========== GRAPH REFERENCE ==========
  /**
   * Points to which version of the Asset Graph this snapshot references.
   * If Cognition needs edges or correlations:
   * 1. Load snapshot (fast, lightweight)
   * 2. Load AssetGraphVersion using graphVersion number
   * 3. Load CorrelationMatrix using graphVersion number
   */
  graphVersion: number;
  
  // ========== METADATA ==========
  isStale: boolean;                 // Is this older than expected for the shard?
  completeness: number;             // 0-100, how complete? (% of shards fresh)
  shardUpdateStatus?: Record<string, Date>;  // ✓ DYNAMIC: Tracks all shards automatically
                                              // Instead of hardcoded field names
                                              // New shards auto-tracked without schema changes
}
