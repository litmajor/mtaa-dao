/**
 * Gateway Type Definitions
 * Central types for the multi-chain gateway system
 */

// ============================================================================
// MARKET DATA TYPES
// ============================================================================

export interface TokenPrice {
  token: string;
  symbol: string;
  chainId: number;
  price: number;
  currency: string;
  timestamp: number;
  source: 'chainlink' | 'uniswap' | 'coingecko' | 'aggregated';
  confidence: number; // 0-1, how confident we are in this price
}

export interface MarketData {
  tokenA: TokenPrice;
  tokenB: TokenPrice;
  liquidity: {
    poolAddress: string;
    liquidity: string;
    reserve0: string;
    reserve1: string;
  };
  volume24h: string;
  priceChange24h: number;
  timestamp: number;
}

export interface PriceQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  slippage: number;
  route: string[];
  liquidity: string;
  timestamp: number;
}

// ============================================================================
// GAS & FEE TYPES
// ============================================================================

export interface GasPriceFeed {
  chainId: number;
  standard: string;
  fast: string;
  instant: string;
  estimatedTime: {
    standard: number;
    fast: number;
    instant: number;
  };
  timestamp: number;
}

export interface EstimatedGasCost {
  chainId: number;
  baseFee: string;
  priorityFee: string;
  totalFee: string;
  estimatedFeeUSD: number;
  gasLimit: string;
  timestamp: number;
}

export interface BridgeFee {
  source: string; // 'native' | 'stargate' | 'axelar' | etc
  percentage: number;
  fixedAmount?: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface SwapFee {
  protocol: string; // 'uniswap' | 'curve' | 'balance' | etc
  percentage: number;
}

// ============================================================================
// SLIPPAGE & LIQUIDITY TYPES
// ============================================================================

export interface SlippageAnalysis {
  expectedOutput: string;
  minOutput: string;
  slippagePercent: number;
  slippageAmount: string;
  priceImpact: number;
  liquidity: string;
  depth: {
    support: string; // Price support
    resistance: string; // Price resistance
  };
}

export interface LiquidityInfo {
  poolAddress: string;
  chainId: number;
  tokenA: string;
  tokenB: string;
  reserve0: string;
  reserve1: string;
  liquidity: string;
  concentration: number; // 0-1, how concentrated liquidity is
  depth: {
    // How much volume before x% slippage
    slippage1percent: string;
    slippage5percent: string;
    slippage10percent: string;
  };
  fee: number; // Pool fee percentage
}

// ============================================================================
// ON-CHAIN VOLUME TYPES
// ============================================================================

export interface VolumeData {
  chainId: number;
  pair: string;
  volume24h: string;
  volume7d: string;
  volumeMonthly: string;
  volumeUSD24h: number;
  volumeUSD7d: number;
  trades24h: number;
  averageTradeSize: string;
  timestamp: number;
}

export interface ChainVolume {
  chainId: number;
  chainName: string;
  totalVolume24h: string;
  totalVolumeUSD24h: number;
  topPairs: {
    pair: string;
    volume: string;
    volumeUSD: number;
  }[];
  txCount24h: number;
  activeUsers24h: number;
  timestamp: number;
}

// ============================================================================
// ROUTE TYPES
// ============================================================================

export interface RouteStep {
  from: {
    token: string;
    amount: string;
    chainId: number;
  };
  to: {
    token: string;
    amount: string;
    chainId: number;
  };
  protocol: string;
  fee: string;
  slippage: number;
  gasEstimate: string;
}

export interface TransferRoute {
  id: string;
  source: {
    token: string;
    amount: string;
    chainId: number;
    address: string;
  };
  destination: {
    token: string;
    chainId: number;
    address: string;
  };
  steps: RouteStep[];
  expectedOutput: string;
  minOutput: string;
  totalSlippage: number;
  totalGasCost: string;
  totalGasCostUSD: number;
  bridgeMethod: string;
  estimatedTime: number; // in seconds
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface CrossChainSwapRoute extends TransferRoute {
  intermediateTokens: string[];
  protocolsUsed: string[];
  oracles: string[];
}

// ============================================================================
// SECURITY & VALIDATION TYPES
// ============================================================================

export interface SecurityAudit {
  routeId: string;
  checks: {
    slippageWithinThreshold: boolean;
    liquidityAdequate: boolean;
    gasCostAcceptable: boolean;
    bridgeSecure: boolean;
    oracleHealthy: boolean;
    contractVerified: boolean;
  };
  riskFlags: string[];
  riskScore: number; // 0-100, higher = riskier
  isApproved: boolean;
  timestamp: number;
}

export interface RateLimitPolicy {
  maxTransactionsPerHour: number;
  maxVolumePerHour: string;
  maxVolumePerTransaction: string;
  bucketTokens: number;
  refreshRate: number; // ms
}

// ============================================================================
// AGGREGATOR OUTPUT TYPES
// ============================================================================

export interface GatewayMarketSnapshot {
  timestamp: number;
  chains: Record<number, {
    gasPrice: GasPriceFeed;
    volume24h: string;
    topTokens: TokenPrice[];
  }>;
  bridges: Record<string, {
    fee: BridgeFee;
    liquidity: string;
    estimatedTime: number;
  }>;
  swapProtocols: Record<string, {
    fee: SwapFee;
    liquidity: string;
    apr: number;
  }>;
}

export interface GatewayRecommendation {
  operation: 'swap' | 'bridge' | 'transfer';
  optimalRoute: TransferRoute | CrossChainSwapRoute;
  alternatives: (TransferRoute | CrossChainSwapRoute)[];
  rationale: string;
  estimatedTime: number;
  costSavings: {
    percent: number;
    amount: string;
  };
  riskAssessment: SecurityAudit;
}

// ============================================================================
// CACHE & STATE TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
}

export interface GatewayState {
  prices: Map<string, CacheEntry<TokenPrice>>;
  liquidity: Map<string, CacheEntry<LiquidityInfo>>;
  gasFeeds: Map<string, CacheEntry<GasPriceFeed>>;
  volume: Map<string, CacheEntry<VolumeData>>;
  routes: Map<string, CacheEntry<TransferRoute>>;
}

// ============================================================================
// EVENT & NOTIFICATION TYPES
// ============================================================================

export interface GatewayEvent {
  type: 'price_update' | 'liquidity_alert' | 'gas_spike' | 'volume_surge' | 'route_degradation';
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, any>;
  timestamp: number;
  chainId?: number;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  action?: string; // What to do about it
  timestamp: number;
  cleared?: boolean;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface GatewayQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  chainInId: number;
  chainOutId: number;
  slippage?: number;
  maxGasPrice?: string;
}

export interface GatewayQuoteResponse {
  quote: PriceQuote;
  route: TransferRoute;
  alternatives: TransferRoute[];
  risks: string[];
  timestamp: number;
}

export interface GatewayHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  oracles: Record<string, { status: string; latency: number }>;
  bridges: Record<string, { status: string; latency: number }>;
  cacheHitRate: number;
  uptime: number;
  timestamp: number;
}
