/**
 * Exchange-related type definitions
 */

export interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  profitPerUnit: number;
  profitPercent: number;
  buyFee: number;
  sellFee: number;
  netProfit: number;
  netProfitPercent: number;
  volume: number;
  volumeScore: 'excellent' | 'good' | 'fair' | 'poor';
  risk: 'low' | 'medium' | 'high' | 'very_high';
  timestamp: number;
}

export interface ExchangePair {
  exchange: string;
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  volume: number;
  timestamp: number;
}

export interface TechnicalIndicators {
  rsi: { value: number; signal: string };
  macd: { macd: number; signal: number; histogram: number; position: string };
  bollingerBands: { upper: number; middle: number; lower: number };
  sma: { sma20: number; sma50: number; sma200: number };
  ema: { ema12: number; ema26: number };
}

export interface HistoricalMetrics {
  period: string;
  startPrice: number;
  endPrice: number;
  highPrice: number;
  lowPrice: number;
  performance: number;
  performancePercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageReturn: number;
  averageVolume: number;
}

export interface OrderBookMetrics {
  symbol: string;
  exchange: string;
  spread: number;
  spreadBps: number;
  bidWalls: Array<{ price: number; volume: number; strength: string }>;
  askWalls: Array<{ price: number; volume: number; strength: string }>;
  volumeImbalance: number;
  buyPressure: string;
  liquidity: number;
}

export interface LiquidityMetrics {
  spread: number;
  depth: number;
  volume: number;
  stability: number;
  imbalance: number;
  volatility: number;
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface FearGreedMetrics {
  volatility: number;
  momentum: number;
  marketTrend: number;
  dominance: number;
  volume: number;
}

export interface FearGreedIndex {
  score: number;
  classification: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  metrics: FearGreedMetrics;
  description: string;
  emoji: string;
  color: string;
  timestamp: number;
  lastUpdated: string;
}

export interface MarketChangeMetrics {
  period: '1d' | '7d' | '30d' | '90d' | '180d';
  marketCap: number;
  marketCapChange: number;
  marketCapChangePercent: number;
  volume24h: number;
  volumeChange: number;
  volumeChangePercent: number;
  timestamp?: number;
}

export interface BtcDominanceData {
  dominancePercent: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  price: number;
  timestamp: number;
}

export interface MarketSentimentResponse {
  fearGreedIndex: FearGreedIndex;
  marketChanges: MarketChangeMetrics[];
  btcDominance: BtcDominanceData;
  timestamp: number;
}
