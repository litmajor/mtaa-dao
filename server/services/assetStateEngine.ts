/**
 * AssetStateEngine v1 - Refactored for Modularity & Scale
 * 
 * Architecture Pattern:
 * ┌─────────────────────────────────────────────┐
 * │ compute()                                   │
 * │ ├── fetchRawLayers()      [Get data]       │
 * │ ├── computeDerivedMetrics() [Analyze]      │
 * │ ├── synthesizeIntelligence() [Combine]     │
 * │ └── assembleAssetState()  [Format]         │
 * └─────────────────────────────────────────────┘
 * 
 * This separation allows:
 * - WebSocket streaming to reuse partial layers
 * - Alerts engine to reuse derived metrics
 * - Backtesting to reuse synthesis logic
 * - Prevents monolithic sprawl
 * 
 * Three-Tier Model:
 * ┌─────────────────────────────────────────────┐
 * │ Tier 1: Market State (Objective)            │
 * │ price, cex, dex, crossExchange, technicals │
 * │ sentiment, regime                           │
 * │ → Pure external truth, no user/AI          │
 * ├─────────────────────────────────────────────┤
 * │ Tier 2: User Context (Subjective)          │
 * │ holding, allocation, PnL, role             │
 * │ → User-specific data                       │
 * ├─────────────────────────────────────────────┤
 * │ Tier 3: Intelligence Layer (Synthetic)     │
 * │ aiInsights, recommendations, warnings      │
 * │ → Derived from tiers 1+2                   │
 * └─────────────────────────────────────────────┘
 */

import { logger } from '../utils/logger';
import { cacheService } from './cacheService';

/**
 * Raw market data layers (Tier 1)
 * Objective external truth - no user/AI interpretation
 */
export interface MarketState {
  price: {
    current: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volatility: {
      current: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    };
  };
  
  cex: {
    sources: Array<{
      exchange: string;
      bid: number;
      ask: number;
      spread: number;
      volume24h: number;
      timestamp: number;
    }>;
    best: {
      buy?: { exchange: string; price: number };
      sell?: { exchange: string; price: number };
    };
    depth?: {
      bidDepth: number;
      askDepth: number;
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  };
  
  dex: {
    sources: Array<{
      protocol: string;
      poolId: string;
      liquidity: number;
      slippage?: number;
      fee?: number;
      timestamp: number;
    }>;
    best?: {
      protocol: string;
      slippage: number;
    };
  };
  
  crossExchange: {
    spread: {
      average: number;
      trend: 'tightening' | 'stable' | 'widening';
    };
    arbitrage: {
      opportunities: Array<{
        route: string;
        profitUsd: number;
        profitPercent: number;
      }>;
    };
  };
  
  technicals: {
    rsi?: { value: number; signal: 'overbought' | 'neutral' | 'oversold' };
    macd?: { line: number; signal: number; histogram: number };
    movingAverages?: { ma20?: number; ma50?: number; ma200?: number };
    trend?: { direction: 'up' | 'down' | 'neutral'; strength: number };
  };
  
  sentiment?: {
    fearGreed?: number;
    socialVolume?: number;
    newsScore?: number;
    trend: 'bullish' | 'neutral' | 'bearish';
  };
  
  regime?: {
    marketPhase: 'accumulation' | 'expansion' | 'distribution' | 'capitulation';
    volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
    liquidityRegime: 'deep' | 'normal' | 'thin';
  };
}

/**
 * User context (Tier 2)
 * Subjective user-specific data
 */
export interface UserContext {
  holding?: {
    amount: number;
    value: number;
    allocation: number;
  };
  performance?: {
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
  };
  role?: 'trader' | 'investor' | 'arbitrageur' | 'holder';
}

/**
 * Intelligence outputs (Tier 3)
 * Derived from market state + user context
 */
export interface IntelligenceLayer {
  aiInsights?: {
    primarySignal?: {
      action: 'BUY' | 'SELL' | 'HOLD' | 'MONITOR' | 'ARBITRAGE';
      confidence: number;
      reasoning?: string;
    };
    warnings?: Array<{
      type: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
    }>;
  };
  
  confidence: {
    overall: number;           // 0-100
    dataFreshness: number;     // How recent?
    exchangeAgreement: number; // Do all CEX agree on price?
    liquidityQuality: number;  // Spread + depth score
    spreadStability: number;   // Has spread been stable?
    indicatorAlignment: number; // Do technicals agree?
  };
}

/**
 * Complete Asset State (All three tiers)
 * Single source of truth for all asset intelligence
 */
export interface AssetState {
  // Tier 1: Market State  
  marketState: MarketState & { timestamp: number };
  
  // Tier 2: User Context (optional)
  userContext?: UserContext;
  
  // Tier 3: Intelligence Layer (optional)
  intelligence?: IntelligenceLayer;
  
  // Metadata
  identification: {
    symbol: string;
    name?: string;
    pair: string;
    category?: 'L1' | 'L2' | 'DeFi' | 'Stablecoin';
  };
  
  status: {
    dataFreshness: number;
    isLiquid: boolean;
    lastUpdated: number;
  };
}

/**
 * AssetStateEngine Service
 * 
 * Single integration point for all asset intelligence
 */
export class AssetStateEngine {
  private static instance: AssetStateEngine;
  
  private constructor() {}

  static getInstance(): AssetStateEngine {
    if (!AssetStateEngine.instance) {
      AssetStateEngine.instance = new AssetStateEngine();
    }
    return AssetStateEngine.instance;
  }

  /**
   * Compute complete AssetState for a symbol
   * 
   * Integrates:
   * - priceOracle (pricing)
   * - ccxtService (CEX data)
   * - dexIntegrationService (DEX liquidity)
   * - arbitrageDetector (cross-venue opportunities)
   * - marketAnalyticsService (spread trends)
   * - indicators.ts (technical analysis)
   * - Portfolio service (user holdings)
   * - Morio agents (AI guidance)
   */
  async compute(
    symbol: string,
    userContext?: { userId: string; daoId?: string }
  ): Promise<AssetState> {
    const startTime = Date.now();

    try {
      // Check cache first (5 second TTL for real-time feel)
      const cacheKey = `asset-state:${symbol}:${userContext?.userId || 'guest'}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached as AssetState;
      }

      logger.info(`Computing AssetState for ${symbol}...`);

      // ============ LAYER 1: PRICE & VOLATILITY ============
      const priceData = await this.getPriceData(symbol);

      // ============ LAYER 2: CEX DATA ============
      const cexData = await this.getCEXData(symbol);

      // ============ LAYER 3: DEX DATA ============
      const dexData = await this.getDEXData(symbol);

      // ============ LAYER 4: CROSS-EXCHANGE ANALYSIS ============
      const crossExchangeData = await this.getCrossExchangeData(symbol, cexData, dexData);

      // ============ LAYER 5: TECHNICAL INDICATORS ============
      const technicalData = await this.getTechnicalData(symbol);

      // ============ USER CONTEXT ============
      const userContextData = userContext
        ? await this.getUserContext(userContext.userId, symbol)
        : undefined;

      // ============ AI GUIDANCE ============
      const aiData = userContext
        ? await this.getAIGuidance(symbol, technicalData, crossExchangeData)
        : undefined;

      // ============ ASSEMBLE ASSET STATE ============
      const assetState: AssetState = {
        identification: {
          symbol,
          name: priceData.name,
          pair: `${symbol}/USDT`,
          timestamp: Date.now(),
        },

        price: priceData,

        cex: cexData,

        dex: dexData,

        crossExchange: crossExchangeData,

        technicals: technicalData,

        userContext: userContextData,

        aiInsights: aiData,

        status: {
          dataFreshness: Date.now() - startTime,
          isLiquid: this.checkLiquidity(cexData, dexData),
          confidence: this.calculateConfidence(cexData, dexData),
          lastUpdated: Date.now(),
        },
      };

      // Cache for 5 seconds
      await cacheService.set(cacheKey, assetState, 5);

      return assetState;
    } catch (error) {
      logger.error(`Failed to compute AssetState for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get price and volatility data
   * @todo Integrate with priceOracle service
   */
  private async getPriceData(symbol: string): Promise<AssetState['price']> {
    // PLACEHOLDER: Replace with actual priceOracle integration
    return {
      current: 65000,
      change24h: 1500,
      changePercent24h: 2.4,
      high24h: 66500,
      low24h: 64200,
      volatility: {
        current: 2.1,
        trend: 'stable',
      },
    };
  }

  /**
   * Get CEX liquidity data
   * @todo Integrate with ccxtService
   */
  private async getCEXData(symbol: string): Promise<AssetState['cex']> {
    // PLACEHOLDER: Replace with actual ccxtService integration
    return {
      sources: [
        {
          exchange: 'binance',
          bid: 65000,
          ask: 65002,
          spread: 0.003,
          volume24h: 1200000,
          timestamp: Date.now(),
        },
      ],
      best: {
        buy: { exchange: 'binance', price: 65000 },
        sell: { exchange: 'coinbase', price: 65025 },
      },
      depth: {
        bidDepth: 100,
        askDepth: 100,
        quality: 'excellent',
      },
    };
  }

  /**
   * Get DEX liquidity data
   * @todo Integrate with dexIntegrationService
   */
  private async getDEXData(symbol: string): Promise<AssetState['dex']> {
    // PLACEHOLDER: Replace with actual dexIntegrationService
    return {
      sources: [
        {
          protocol: 'uniswap',
          poolId: 'USDC/ETH',
          liquidity: 50000000,
          slippage: 0.8,
          fee: 0.3,
          timestamp: Date.now(),
        },
      ],
      best: {
        protocol: 'curve',
        slippage: 0.5,
      },
    };
  }

  /**
   * Get cross-exchange intelligence (spreads, arbitrage)
   * @todo Integrate with arbitrageDetector, spreadAnalysis
   */
  private async getCrossExchangeData(
    symbol: string,
    cexData: AssetState['cex'],
    dexData: AssetState['dex']
  ): Promise<AssetState['crossExchange']> {
    // PLACEHOLDER: Replace with actual arbitrage/spread logic
    return {
      spread: {
        average: 0.02,
        trend: 'tightening',
      },
      arbitrage: {
        opportunities: [
          {
            route: 'Buy CEX → Sell DEX',
            profitUsd: 500,
            profitPercent: 0.77,
          },
        ],
      },
    };
  }

  /**
   * Calculate technical indicators
   * @todo Integrate with indicators.ts library
   */
  private async getTechnicalData(symbol: string): Promise<AssetState['technicals']> {
    // PLACEHOLDER: Replace with actual indicators.ts calculations
    // When implemented, you'll receive candle data and run:
    // 
    // const closes = candles.map(c => c.close);
    // const highs = candles.map(c => c.high);
    // const lows = candles.map(c => c.low);
    // 
    // const rsiVals = indicators.rsi(closes, 14);
    // const macdData = indicators.macd(closes);
    // const bbands = indicators.bollingerBands(closes, 20);
    // const mas = {
    //   ma20: indicators.sma(closes, 20),
    //   ma50: indicators.sma(closes, 50),
    //   ma200: indicators.sma(closes, 200),
    // };
    
    return {
      rsi: {
        value: 58,
        signal: 'neutral',
      },
      macd: {
        line: 500,
        signal: 450,
        histogram: 50,
      },
      movingAverages: {
        ma20: 64800,
        ma50: 64500,
        ma200: 63200,
      },
      trend: {
        direction: 'up',
        strength: 65,
      },
    };
  }

  /**
   * Get user portfolio context
   * @todo Integrate with wallet/portfolio service
   */
  private async getUserContext(userId: string, symbol: string): Promise<AssetState['userContext']> {
    // PLACEHOLDER: Replace with actual user portfolio query
    return {
      holding: {
        amount: 0.5,
        value: 32500,
        allocation: 35,
      },
      performance: {
        unrealizedPnL: 2500,
        unrealizedPnLPercent: 8.3,
      },
    };
  }

  /**
   * Get AI guidance from Morio agents
   * @todo Integrate with morio agents
   */
  private async getAIGuidance(
    symbol: string,
    technicals: AssetState['technicals'],
    crossExchange: AssetState['crossExchange']
  ): Promise<AssetState['aiInsights']> {
    // PLACEHOLDER: Replace with actual Morio signal generation
    return {
      primarySignal: {
        action: 'HOLD',
        confidence: 65,
        reasoning: 'RSI neutral, MACD bullish. Spreads tightening—good liquidity.',
      },
      warnings: [
        {
          type: 'volatility',
          severity: 'warning',
          message: 'Volatility increased 20%—consider tighter stop losses.',
        },
      ],
    };
  }

  /**
   * Check if asset is liquid enough to trade
   */
  private checkLiquidity(cexData: AssetState['cex'], dexData: AssetState['dex']): boolean {
    const hasCEX = cexData.sources && cexData.sources.length > 0;
    const hasDEX = dexData.sources && dexData.sources.length > 0;
    const goodSpread = cexData.best?.buy?.price && 
      ((cexData.best.sell?.price ?? 0) - (cexData.best.buy.price)) / (cexData.best.buy.price) < 0.01;
    
    return hasCEX && (hasDEX || goodSpread);
  }

  /**
   * Calculate overall confidence score (0-100)
   */
  private calculateConfidence(cexData: AssetState['cex'], dexData: AssetState['dex']): number {
    let confidence = 50;

    // More CEX sources = higher confidence
    const cexSources = cexData.sources?.length ?? 0;
    confidence += Math.min(cexSources * 10, 25);

    // More DEX sources = higher confidence
    const dexSources = dexData.sources?.length ?? 0;
    confidence += Math.min(dexSources * 5, 15);

    // Tight spreads = higher confidence
    const bestSpread = cexData.best?.sell?.price ?? 0;
    const bestBuy = cexData.best?.buy?.price ?? 0;
    if (bestSpread > 0 && bestBuy > 0) {
      const spreadPct = (bestSpread - bestBuy) / bestBuy;
      if (spreadPct < 0.001) confidence += 10;
    }

    return Math.min(confidence, 100);
  }
}

// Singleton export
export const assetStateEngine = AssetStateEngine.getInstance();
