/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ASSET GRAPH TYPES - USER-CENTRIC POSITION TRACKING
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Powers the Amara Dashboard:
 * • Portfolio overview (all positions across protocols)
 * • Risk analysis (liquidation, IL, protocol exposure)
 * • Yield tracking (APY, earned, projected)
 * • Cross-protocol navigation (where are my assets?)
 */

export type AssetNodeType = 
  | 'direct_holding'        // Raw token in wallet
  | 'protocol_position'     // Position within a protocol (supply, borrow)
  | 'vault_share'           // Share token from vault (yToken, cToken)
  | 'lp_share'              // LP token from DEX
  | 'collateral'            // Locked as collateral
  | 'debt'                  // Owed to protocol
  | 'derivative'            // Staking (stETH), yield (aToken)
  | 'composite';            // Calculated exposure

export type EdgeRelationshipType =
  | 'supplies'              // Provides → receives aToken
  | 'stakes'                // Stakes → receives stToken
  | 'borrows'               // Borrows → debt
  | 'provides_liquidity'    // LPs → receives LP token
  | 'shares_treasury'       // DAO member → owns vault share
  | 'locks_as_collateral'   // Locks → mints debt
  | 'wraps'                 // BTC → WBTC (technical)
  | 'earns_yield'           // Token → accrues interest
  | 'equivalent_to'         // aUSDC ≈ USDC (different representations)
  | 'risk_exposure';        // Demonstrates risk relationship

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface AssetGraphNode {
  // IDENTIFICATION
  id: string;                    // "user:protocol:symbol"
  userId: string;
  
  type: AssetNodeType;
  symbol: string;                // "stETH", "aUSDC", "yUSDC"
  underlyingSymbol?: string;     // "ETH" for stETH
  
  // LOCATION & PROTOCOL
  protocol?: string;             // "lido", "aave", "curve", "makerdao"
  chain: string;                 // "ethereum", "polygon", "arbitrum"
  address?: string;              // wallet or contract address
  decimals: number;
  
  // QUANTITY & VALUE
  balance: number;               // Raw balance
  balanceUSD: number;            // USD market value
  underlyingBalance?: number;    // Balance in underlying asset (for derivatives)
  
  // CONVERSION & EXCHANGE RATE
  exchangeRate?: number;         // stETH:ETH = 1:1.005
  exchangeRateExplanation?: string;
  
  // YIELD INFORMATION
  apyRate?: number;              // % APY (3.5 for Aave, 5.5 for Lido)
  apyMode?: 'fixed' | 'variable' | 'compounding' | 'rebasing';
  yieldType?: 'staking' | 'lending' | 'trading_fees' | 'governance' | 'token_inflation';
  estimatedYearlyYieldUSD?: number;
  
  // LOCK-IN & EXIT
  lockedUntil?: number;          // Timestamp when can exit
  unlocked: boolean;
  exitCost?: number;             // Exit fee in USD
  exitGasEstimate?: number;      // Estimated gas in USD
  
  // RISK ASSESSMENT
  riskLevel: RiskLevel;
  riskFactors?: string[];        // ["smart_contract_risk", "impermanent_loss", "liquidation"]
  
  // AMARA DASHBOARD METADATA
  tags?: string[];               // ["yield", "vault", "collateral"]
  url?: string;                  // Link to position UI
  lastUpdated: number;
  priceLastUpdated?: number;     // When price was last synced from OHLCV
  dataSource: 'wallet_rpc' | 'protocol_subgraph' | 'coingecko' | 'manual' | 'ohlcv';
}

export interface AssetGraphEdge {
  id: string;
  
  // TOPOLOGY
  source: string;                // Node ID
  target: string;                // Node ID
  relationship: EdgeRelationshipType;
  
  // QUANTITY FLOW
  srcAmount: number;
  tgtAmount: number;
  
  // TERMS
  rate?: number;                 // APY, conversion rate, etc
  ratioExplanation?: string;     // Human-readable explanation
  
  // CONDITIONS
  lockedUntil?: number;
  unlocked: boolean;
  exitCost?: number;
  exitGasEstimate?: number;
  
  // RISK
  impermanentLossRisk?: boolean;
  liquidationRisk?: boolean;
  
  // TIMESTAMPS
  createdAt: number;
  lastUpdated: number;
  
  // AMARA SPECIFIC
  visibility: 'primary' | 'secondary' | 'detail'; // How prominently to show
}

export interface CompositeExposure {
  /**
   * Aggregated exposure across multiple nodes
   * Shown as collapsible sections in Amara Dashboard
   */
  id: string;                    // "user:btc:net_exposure"
  userId: string;
  
  exposureName: string;          // "BTC Exposure"
  baseAsset: string;             // "BTC"
  
  // COMPONENTS
  components: Array<{
    nodeId: string;
    symbol: string;
    quantity: number;
    direction: 'long' | 'short';
    weight: number;             // Percentage of total
    protocol?: string;
    valueUSD: number;
  }>;
  
  // AGGREGATES
  netLongQuantity: number;
  netShortQuantity: number;
  netQuantity: number;
  netValueUSD: number;
  
  // RISK
  riskLevel: RiskLevel;
  concentration: number;          // 0-100 (100% = all in one place)
  
  lastCalculatedAt: number;
  dataQuality: 'fresh' | 'cached' | 'stale';
}

export interface LiquidationRisk {
  edgeId: string;
  collateralSymbol: string;
  collateralAmount: number;
  debtSymbol: string;
  debtAmount: number;
  
  currentPrice: number;
  liquidationPrice: number;
  margin: number;                // (currentPrice - liquidationPrice) / currentPrice
  marginPercent: number;          // margin * 100
  
  atRisk: boolean;               // margin < 0.1 (10%)
  criticalRisk: boolean;         // margin < 0.05 (5%)
  
  estimatedLossUSD?: number;     // If liquidated now
  timeToLiquidation?: number;    // Minutes until at risk
}

export interface UserAssetGraph {
  userId: string;
  
  // CORE GRAPH
  nodes: Map<string, AssetGraphNode>;
  edges: Map<string, AssetGraphEdge>;
  
  // INDICES FOR QUICK LOOKUP
  byProtocol: Map<string, string[]>;    // "aave" → [node1, node2]
  bySymbol: Map<string, string[]>;      // "ETH" → [node1, node2]
  byChain: Map<string, string[]>;       // "ethereum" → [nodes]
  byYield: Map<string, string[]>;       // "staking" → [nodes]
  
  // CALCULATED VIEWS
  compositeExposures: Map<string, CompositeExposure>;
  liquidationRisks: LiquidationRisk[];
  
  // PORTFOLIO TOTALS (for Amara Dashboard header)
  portfolioMetrics: {
    totalValueUSD: number;
    totalYieldUSD: number;           // Earned so far
    totalYieldAPY: number;            // Blended APY
    totalYieldProjectedAnnual: number; // If held for 1 year
    
    protocolExposureCount: number;   // How many protocols
    uniqueAssets: number;             // How many different tokens
    
    riskScore: number;               // 0-100
    liquidationRiskCount: number;
    
    lastSyncedAt: number;
    completeness: number;            // 0-100 (%) of positions tracked
  };
}

export interface AmaraPortfolioView {
  /**
   * Specific to Amara Dashboard rendering
   */
  userId: string;
  
  // DASHBOARD SECTIONS
  sections: {
    overview: {
      totalValueUSD: number;
      totalYieldUSD: number;
      yieldAPY: number;
      riskScore: number;
    };
    
    positions: {
      direct: AssetGraphNode[];        // Direct holdings
      protocol: AssetGraphNode[];      // Aave supplies, borrows, etc
      vault: AssetGraphNode[];         // yTokens, cTokens, etc
      lp: AssetGraphNode[];            // LP shares
    };
    
    exposures: {
      byAsset: CompositeExposure[];    // Net BTC, Net ETH, etc
      byProtocol: Array<{
        protocol: string;
        valueUSD: number;
        nodes: AssetGraphNode[];
        riskLevel: RiskLevel;
      }>;
      byChain: Array<{
        chain: string;
        valueUSD: number;
        nodes: AssetGraphNode[];
      }>;
    };
    
    risks: {
      liquidation: LiquidationRisk[];
      impermanentLoss: Array<{
        nodeId: string;
        estimatedLossPercent: number;
        volatility: number;
      }>;
      protocolRisks: Array<{
        protocol: string;
        tvl: number;
        auditStatus: string;
        exploits?: Array<{ date: number; loss: number }>;
      }>;
    };
    
    yields: {
      earned: Array<{
        nodeId: string;
        symbol: string;
        protocol: string;
        earned: number;
        apy: number;
        projected: number; // Annual projection
      }>;
      opportunities: Array<{
        protocol: string;
        assetSymbol: string;
        currentAPY: number;
        comparison: string; // "2.5% higher than Compound"
      }>;
    };
  };
  
  lastUpdatedAt: number;
  updateFrequency: 'real-time' | '5min' | '15min' | '1hour';
}
