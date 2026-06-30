/**
 * Trading Agent Types & Interfaces
 * Unified smart routing for DEX/CEX fragmentation
 */

import { AgentMetrics } from '../framework/base-agent';

export enum TradingRouteType {
  DIRECT_DEX = 'direct_dex',           // Single DEX swap
  AGGREGATED_DEX = 'aggregated_dex',   // Multi-path optimal split
  CEX_ARBITRAGE = 'cex_arbitrage',     // Cross-exchange arbitrage
  MARKET_MAKING = 'market_making',     // MM strategy for liquidity
  LIQUIDATION = 'liquidation'          // Emergency liquidation
}

export enum LiquidityPool {
  UNISWAP_V3 = 'uniswap-v3',
  UNISWAP_V4 = 'uniswap-v4',
  CURVE = 'curve',
  BALANCER = 'balancer',
  AAVE = 'aave',
  COMPOUND = 'compound'
}

export interface LiquiditySource {
  pool: LiquidityPool;
  token0: string;
  token1: string;
  fee: number;
  liquidity: string;
  concentration?: number; // For v3/v4
  apy?: number;
}

export interface RoutingPath {
  id: string;
  type: TradingRouteType;
  hops: Array<{
    source: LiquidityPool;
    inputToken: string;
    outputToken: string;
    amount: string;
    expectedOutput: string;
    slippage: number;
  }>;
  totalInputAmount: string;
  expectedOutputAmount: string;
  slippage: number;
  estimatedGas: string;
  priceImpact: number;
  executionTime: number;
  successRate: number;
  profitability: {
    estimatedProfit: string;
    roi: number;
    gasAdjustedProfit: string;
  };
}

export interface TradeQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  timestamp: Date;
  expiresAt: Date;
  routes: RoutingPath[];
  bestRoute: RoutingPath;
  spreadAnalysis: {
    bestPrice: string;
    worstPrice: string;
    spread: number;
  };
}

export interface ExecutionResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  actualInput: string;
  actualOutput: string;
  actualSlippage: number;
  gasCost: string;
  priceAtExecution: string;
  timestamp: Date;
}

export interface ArbOpportunity {
  id: string;
  pair: string;
  dexPrice: string;
  cexPrice: string;
  spread: number;
  roi: number;
  volume: string;
  liquidity: string;
  risk: 'low' | 'medium' | 'high';
  estimatedProfit: string;
  window: { start: Date; end: Date; durationSeconds: number };
}

export interface TradingMetrics extends AgentMetrics {
  totalSwaps: number;
  successfulSwaps: number;
  failedSwaps: number;
  totalVolumeTraded: string;
  totalProfitGenerated: string;
  averageSlippage: number;
  averageExecutionTime: number;
  bestRouteUtilization: Map<TradingRouteType, number>;
  arbOpportunitiesDetected: number;
  arbOpportunitiesCaptured: number;
  lastRebalance: Date | null;
}

export enum PriceDataType {
  SPOT = 'spot',
  TWAP = 'twap',
  VWAP = 'vwap',
  ORACLE = 'oracle'
}

export interface PriceData {
  token: string;
  type: PriceDataType;
  price: string;
  timestamp: Date;
  confidence: number;
  sources: string[];
}
