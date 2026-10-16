import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';
import { atr } from './technicalIndicatorLibrary';
import { futuresPositionRepository, type FuturesPosition } from '../repositories/futuresPositionRepository';

interface NormalizedFuturesPosition {
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  contracts: number;
  contractSize: number | null;
  entryPrice: number;
  markPrice: number | null;
  leverage: number;
  marginMode: string | null;
  liquidationPrice: number | null;
  collateral: number | null;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  openedAt: Date | null;
  raw: Record<string, unknown>;
}

interface FundingAccrual {
  cumulativeFundingPaid: number;
  settlementCount: number;
  estimated: boolean;
  since: Date;
}

interface PositionRiskSnapshot {
  position: FuturesPosition;
  funding: FundingAccrual;
  liquidation: LiquidationRisk & { atr: number | null; liquidationDistanceAtr: number | null };
}

interface PositionSizeRequest {
  equity: number;
  riskPercent: number;
  atr: number;
  atrMultiplier: number;
  side: 'long' | 'short';
  entryPrice: number;
  liquidationPrice: number;
  minimumLiquidationDistanceAtr?: number;
}

interface PositionSizeResult {
  accepted: boolean;
  quantity: number;
  riskAmount: number;
  stopDistance: number;
  liquidationDistanceAtr: number;
  minimumLiquidationDistanceAtr: number;
  reason: string | null;
}

// Futures market types
interface FundingRate {
  symbol: string;
  currentRate: number;
  nextTime: number | null;
  predictedRate: number | null;
  rateChange24h: number | null;
  historicalRates: Array<{ timestamp: number; rate: number }>;
  trend: 'bullish' | 'neutral' | 'bearish' | 'unknown';
}

interface LiquidationData {
  symbol: string;
  totalLiquidations24h: number;
  bullishLiquidations: number;
  bearishLiquidations: number;
  largestLiquidation: number;
  avgLiquidationSize: number;
  liquidationCascade: boolean;
  cascadeSeverity: 'low' | 'medium' | 'high' | 'extreme';
  recentLiquidations: Array<{
    timestamp: number;
    price: number;
    amount: number;
    side: 'long' | 'short';
  }>;
}

interface OpenInterest {
  symbol: string;
  totalOpenInterest: number;
  longOpenInterest: number | null;
  shortOpenInterest: number | null;
  longShortRatio: number | null;
  openInterestTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  openInterestChange24h: number | null;
  historicalOI: Array<{ timestamp: number; oi: number }>;
}

interface FundingRatePrediction {
  symbol: string;
  currentRate: number;
  predictedRate24h: number | null;
  predictedRate7d: number | null;
  confidence: number; // 0-100
  factors: {
    openInterestFactor: number | null;
    liquidationFactor: number | null;
    marketSentimentFactor: number | null;
    volatilityFactor: number | null;
  };
  recommendations: string[];
}

interface LiquidationRisk {
  symbol: string;
  symbol_price: number;
  liquidationLevel: number;
  percentToLiquidation: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  liquidationCascadeRisk: boolean;
  recommendation: string;
}

interface FuturesMarketHealth {
  symbol: string;
  fundingRateHealth: number; // 0-100
  liquidationRiskHealth: number; // 0-100
  openInterestHealth: number | null; // 0-100; null when history is unavailable
  overallHealth: number | null; // 0-100; null when required source data is unavailable
  assessment: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unavailable';
  recommendations: string[];
}

/**
 * Futures Market Support Service
 * Tracks funding rates, liquidations, open interest, and futures-specific metrics
 */
class FuturesMarketSupport {
  private fundingRateCache: Map<string, FundingRate> = new Map();
  private liquidationCache: Map<string, LiquidationData> = new Map();
  private openInterestCache: Map<string, OpenInterest> = new Map();
  private static instance: FuturesMarketSupport;

  private constructor() {}

  /** Normalize and persist open positions for one authenticated exchange credential. */
  async trackPositions(credentialId: string, userId: string, exchange: string): Promise<NormalizedFuturesPosition[]> {
    if (!credentialId || !userId || !exchange) throw new Error('credentialId, userId, and exchange are required');
    const normalizedExchange = exchange.toLowerCase();
    const rawPositions = await ccxtService.fetchOpenPositionsForCredential(credentialId, userId);
    const existing = await futuresPositionRepository.getPositionsByCredential(credentialId, normalizedExchange);
    const existingByKey = new Map(existing.map((position) => [`${position.symbol}:${position.side}`, position]));
    const normalized = rawPositions
      .map((raw) => this.normalizePosition(raw, existingByKey))
      .filter((position): position is NormalizedFuturesPosition => position !== null);

    for (const position of normalized) {
      const previous = existingByKey.get(`${position.symbol}:${position.side}`);
      await futuresPositionRepository.upsertPosition({
        user_id: userId,
        credential_id: credentialId,
        exchange: normalizedExchange,
        position_id: position.positionId,
        symbol: position.symbol,
        side: position.side,
        contracts: position.contracts,
        contractSize: position.contractSize ?? undefined,
        entry_price: position.entryPrice,
        current_mark_price: position.markPrice ?? undefined,
        collateral: position.collateral ?? undefined,
        leverage: position.leverage,
        liquidation_price: position.liquidationPrice ?? undefined,
        unrealized_pnl: position.unrealizedPnl,
        unrealized_pnl_pct: position.unrealizedPnlPct,
        realized_pnl: previous?.realized_pnl ?? 0,
        funding_paid: previous?.funding_paid ?? 0,
        funding_is_estimated: previous?.funding_is_estimated ?? true,
        opened_at: position.openedAt ?? previous?.opened_at ?? previous?.created_at ?? new Date(),
      });
    }
    return normalized;
  }

  /** Sum CCXT funding settlement rates since the persisted position open time. */
  async getPositionFundingAccrual(position: FuturesPosition): Promise<FundingAccrual> {
    const existingOpenTime = position.opened_at ?? position.created_at;
    if (!existingOpenTime || !Number.isFinite(new Date(existingOpenTime).getTime())) {
      return { cumulativeFundingPaid: position.funding_paid ?? 0, settlementCount: 0, estimated: true, since: new Date(position.created_at) };
    }
    const rates = await ccxtService.fetchFundingRateHistory(
      position.symbol,
      position.exchange,
      new Date(existingOpenTime).getTime(),
      1000
    );
    const contractSize = Number(position.contractSize ?? 1);
    const contracts = Math.abs(Number(position.contracts));
    const price = Number(position.current_mark_price ?? position.entry_price);
    if (![contractSize, contracts, price].every(Number.isFinite)) throw new Error(`Invalid position values for funding calculation ${position.position_id}`);
    const direction = position.side === 'long' || position.side === 'buy' ? 1 : -1;
    const accrual = rates.reduce((sum, entry) => {
      const rate = this.readNumber(entry.fundingRate, 'historical funding rate');
      const timestamp = this.readNumber(entry.timestamp, 'funding settlement timestamp');
      if (rate === null || timestamp === null || timestamp < new Date(existingOpenTime).getTime()) return sum;
      // Positive values are funding paid; negative values represent funding received.
      return sum + direction * contracts * contractSize * price * rate;
    }, 0);
    await futuresPositionRepository.upsertPosition({
      ...position,
      funding_paid: accrual,
      funding_is_estimated: true,
      opened_at: new Date(existingOpenTime),
    });
    return { cumulativeFundingPaid: accrual, settlementCount: rates.length, estimated: true, since: new Date(existingOpenTime) };
  }

  /** ATR-based liquidation distance, returned in units of current ATR. */
  async getPositionLiquidationRisk(position: FuturesPosition, timeframe = '1h', period = 14): Promise<PositionRiskSnapshot['liquidation']> {
    const liquidationPrice = this.readNumber(position.liquidation_price, 'position liquidation price');
    const entryPrice = this.readNumber(position.entry_price, 'position entry price');
    const markPrice = this.readNumber(position.current_mark_price, 'position mark price') ?? entryPrice;
    if (liquidationPrice === null || entryPrice === null || markPrice === null || markPrice <= 0) {
      throw new Error(`Position ${position.position_id} lacks valid liquidation or mark price data`);
    }
    const candles = await ccxtService.getOHLCVFromExchange(position.exchange, position.symbol, timeframe, Math.max(period * 3, 50));
    const validCandles = Array.isArray(candles) ? candles.filter((candle) => Array.isArray(candle) && candle.length >= 6) : [];
    const atrValues = validCandles.length >= period
      ? atr(validCandles.map((candle) => Number(candle[2])), validCandles.map((candle) => Number(candle[3])), validCandles.map((candle) => Number(candle[4])), period)
      : [];
    const currentAtr = [...atrValues].reverse().find((value) => Number.isFinite(value) && value > 0) ?? null;
    const distance = position.side === 'long' || position.side === 'buy'
      ? markPrice - liquidationPrice
      : liquidationPrice - markPrice;
    const percentToLiquidation = (distance / markPrice) * 100;
    const riskLevel = percentToLiquidation < 2 ? 'critical' : percentToLiquidation < 5 ? 'high' : percentToLiquidation < 10 ? 'medium' : 'low';
    const liquidations = await this.getLiquidationData(position.symbol, position.exchange);
    const liquidationCascadeRisk = liquidations.liquidationCascade && ['high', 'extreme'].includes(liquidations.cascadeSeverity);
    const liquidationDistanceAtr = currentAtr === null ? null : distance / currentAtr;
    return {
      symbol: position.symbol,
      symbol_price: markPrice,
      liquidationLevel: liquidationPrice,
      percentToLiquidation,
      riskLevel,
      liquidationCascadeRisk,
      recommendation: liquidationDistanceAtr === null
        ? 'ATR history unavailable; liquidation distance in volatility units cannot be calculated'
        : liquidationDistanceAtr < 2
          ? 'Liquidation is within 2 ATR; reduce exposure or add collateral'
          : riskLevel === 'critical'
            ? 'Liquidation is imminent; reduce exposure or add collateral immediately'
            : `Liquidation distance is ${liquidationDistanceAtr.toFixed(2)} ATR`,
      atr: currentAtr,
      liquidationDistanceAtr,
    };
  }

  /** Volatility-adjusted risk sizing constrained by a minimum liquidation/ATR buffer. */
  calculatePositionSize(request: PositionSizeRequest): PositionSizeResult {
    const minimumLiquidationDistanceAtr = request.minimumLiquidationDistanceAtr ?? 3;
    const values = [request.equity, request.riskPercent, request.atr, request.atrMultiplier, request.entryPrice, request.liquidationPrice, minimumLiquidationDistanceAtr];
    if (!values.every(Number.isFinite) || request.equity <= 0 || request.riskPercent <= 0 || request.riskPercent > 100 || request.atr <= 0 || request.atrMultiplier <= 0 || request.entryPrice <= 0 || minimumLiquidationDistanceAtr <= 0) {
      throw new Error('Position sizing inputs must be finite and positive; riskPercent must be at most 100');
    }
    const liquidationDistanceAtr = Math.abs(request.entryPrice - request.liquidationPrice) / request.atr;
    const stopDistance = request.atr * request.atrMultiplier;
    const riskAmount = request.equity * request.riskPercent / 100;
    const accepted = liquidationDistanceAtr >= minimumLiquidationDistanceAtr;
    return {
      accepted,
      quantity: accepted ? riskAmount / stopDistance : 0,
      riskAmount,
      stopDistance,
      liquidationDistanceAtr,
      minimumLiquidationDistanceAtr,
      reason: accepted ? null : `Liquidation buffer ${liquidationDistanceAtr.toFixed(2)} ATR is below required ${minimumLiquidationDistanceAtr} ATR`,
    };
  }

  /** Connect tracked positions to funding attribution and ATR liquidation monitoring. */
  async getTrackedPositionRisk(credentialId: string, userId: string, exchange: string): Promise<PositionRiskSnapshot[]> {
    const tracked = await this.trackPositions(credentialId, userId, exchange);
    if (tracked.length === 0) return [];
    const active = new Set(tracked.map((position) => `${position.symbol}:${position.side}`));
    const positions = (await futuresPositionRepository.getPositionsByCredential(credentialId, exchange.toLowerCase()))
      .filter((position) => active.has(`${position.symbol}:${position.side === 'buy' ? 'long' : position.side === 'sell' ? 'short' : position.side}`));
    return Promise.all(positions.map(async (position) => ({
      position,
      funding: await this.getPositionFundingAccrual(position),
      liquidation: await this.getPositionLiquidationRisk(position),
    })));
  }

  private normalizePosition(raw: Record<string, unknown>, existing: Map<string, FuturesPosition>): NormalizedFuturesPosition | null {
    const contracts = this.readNumber(raw.contracts, 'position contracts') ?? 0;
    if (contracts === 0) return null;
    const sideValue = String(raw.side ?? '').toLowerCase();
    const side = (sideValue === 'long' || sideValue === 'buy' ? 'long' : sideValue === 'short' || sideValue === 'sell' ? 'short' : contracts >= 0 ? 'long' : 'short') as 'long' | 'short';
    const symbol = String(raw.symbol ?? '');
    const prior = existing.get(`${symbol}:${side}`);
    if (!symbol) return null;
    const entryPrice = this.readNumber(raw.entryPrice, 'position entry price');
    if (entryPrice === null || entryPrice <= 0) return null;
    const info = raw.info && typeof raw.info === 'object' ? raw.info as Record<string, unknown> : {};
    const leverage = this.readNumber(raw.leverage ?? info.leverage ?? info.crossLeverage, 'position leverage')
      ?? prior?.leverage ?? 1;
    const marginMode = typeof raw.marginMode === 'string' ? raw.marginMode
      : typeof info.marginMode === 'string' ? info.marginMode
        : typeof info.marginType === 'string' ? info.marginType : null;
    // CCXT position.timestamp is commonly an update time, not the entry time;
    // only trust venue fields that explicitly describe opening/creation time.
    const openedTimestamp = this.readNumber(info.openTime ?? info.createTime ?? info.openedAt, 'position open timestamp');
    const openedAt = openedTimestamp && openedTimestamp > 0 ? new Date(openedTimestamp) : prior?.opened_at ?? prior?.created_at ?? null;
    const unrealizedPnl = this.readNumber(raw.unrealizedPnl, 'unrealized PnL') ?? 0;
    return {
      positionId: String(raw.id ?? raw.positionId ?? `${symbol}:${side}:${openedAt?.getTime() ?? 'tracked'}`),
      symbol,
      side,
      contracts: Math.abs(contracts),
      contractSize: this.readNumber(raw.contractSize, 'contract size'),
      entryPrice,
      markPrice: this.readNumber(raw.markPrice ?? raw.lastPrice, 'position mark price'),
      leverage: leverage > 0 ? leverage : 1,
      marginMode,
      liquidationPrice: this.readNumber(raw.liquidationPrice, 'position liquidation price'),
      collateral: this.readNumber(raw.collateral ?? raw.initialMargin, 'position collateral'),
      unrealizedPnl,
      unrealizedPnlPct: this.readNumber(raw.percentage, 'unrealized PnL percentage') ?? 0,
      openedAt,
      raw,
    };
  }

  static getInstance(): FuturesMarketSupport {
    if (!FuturesMarketSupport.instance) {
      FuturesMarketSupport.instance = new FuturesMarketSupport();
    }
    return FuturesMarketSupport.instance;
  }

  /**
   * Get current funding rate with historical data
   */
  async getFundingRate(symbol: string, exchange: string = 'binance'): Promise<FundingRate> {
    const cacheKey = `funding-rate:${symbol}:${exchange}`;
    const cached = await cacheService.get<FundingRate>(cacheKey);
    if (cached) return cached;

    try {
      // Get current funding rate from exchange
      const fundingRate = await ccxtService.fetchFundingRate(symbol, exchange);
      const currentRate = this.readNumber(fundingRate.fundingRate, 'fundingRate');
      if (currentRate === null) throw new Error(`Exchange did not provide a current funding rate for ${symbol}`);
      const rawHistory = await ccxtService.fetchFundingRateHistory(symbol, exchange, Date.now() - 24 * 60 * 60 * 1000, 100);
      const historicalRates = rawHistory
        .map((entry) => ({
          timestamp: this.readNumber(entry.timestamp, 'funding history timestamp'),
          rate: this.readNumber(entry.fundingRate, 'historical funding rate'),
        }))
        .filter((entry): entry is { timestamp: number; rate: number } =>
          entry.timestamp !== null && entry.rate !== null
        )
        .sort((left, right) => left.timestamp - right.timestamp);
      const rateChange24h = historicalRates.length > 0
        ? currentRate - historicalRates[0].rate
        : null;
      const predictedRate = historicalRates.length >= 2
        ? currentRate + (historicalRates[historicalRates.length - 1].rate - historicalRates[historicalRates.length - 2].rate)
        : null;
      const trend = predictedRate === null
        ? 'unknown'
        : predictedRate > currentRate * 1.1
          ? 'bullish'
          : predictedRate < currentRate * 0.9
            ? 'bearish'
            : 'neutral';

      const result: FundingRate = {
        symbol,
        currentRate: currentRate * 100, // Convert to basis points
        nextTime: this.readNumber(fundingRate.fundingTimestamp, 'next funding timestamp'),
        predictedRate: predictedRate === null ? null : predictedRate * 100,
        rateChange24h: rateChange24h === null ? null : rateChange24h * 100,
        historicalRates: historicalRates.map(r => ({
          timestamp: r.timestamp,
          rate: r.rate * 100
        })),
        trend
      };

      await cacheService.set<FundingRate>(cacheKey, result, 3600); // 1 hour TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch funding rate', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Get liquidation data and cascade detection
   */
  async getLiquidationData(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<LiquidationData> {
    const cacheKey = `liquidations:${symbol}:${exchange}`;
    const cached = await cacheService.get<LiquidationData>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch liquidation data
      const liquidations = await ccxtService.fetchLiquidations(symbol, exchange, Date.now() - 24 * 60 * 60 * 1000, 500);

      // Calculate statistics
      const events = liquidations.map((entry) => ({
        timestamp: this.readNumber(entry.timestamp, 'liquidation timestamp'),
        price: this.readNumber(entry.price, 'liquidation price'),
        amount: this.readNumber(entry.amount ?? entry.contracts, 'liquidation amount'),
        orderSide: entry.side,
      })).filter((entry): entry is { timestamp: number; price: number; amount: number; orderSide: string } =>
        entry.timestamp !== null && entry.price !== null && entry.amount !== null &&
        (entry.orderSide === 'buy' || entry.orderSide === 'sell')
      );

      // CCXT's liquidation side describes the closing order: selling closes a
      // long, while buying closes a short.
      const bullish = events.filter((event) => event.orderSide === 'buy').length;
      const bearish = events.filter((event) => event.orderSide === 'sell').length;
      const totalSize = events.reduce((sum, event) => sum + event.amount, 0);
      const avgSize = events.length > 0 ? totalSize / events.length : 0;
      const largestSize = Math.max(...events.map((event) => event.amount), 0);

      // Detect liquidation cascade
      const cascade = this.detectLiquidationCascade(events);
      const cascadeSeverity = this.calculateCascadeSeverity(events, cascade);

      // Get recent liquidations (last 100)
      const recentLiquidations = events
        .slice(-100)
        .map((event) => ({
          timestamp: event.timestamp,
          price: event.price,
          amount: event.amount,
          side: event.orderSide === 'sell' ? 'long' as const : 'short' as const,
        }));

      const result: LiquidationData = {
        symbol,
        totalLiquidations24h: events.length,
        bullishLiquidations: bullish,
        bearishLiquidations: bearish,
        largestLiquidation: largestSize,
        avgLiquidationSize: avgSize,
        liquidationCascade: cascade,
        cascadeSeverity,
        recentLiquidations
      };

      await cacheService.set<LiquidationData>(cacheKey, result, 1800); // 30 min TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch liquidation data', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Get open interest data
   */
  async getOpenInterest(symbol: string, exchange: string = 'binance'): Promise<OpenInterest> {
    const cacheKey = `open-interest:${symbol}:${exchange}`;
    const cached = await cacheService.get<OpenInterest>(cacheKey);
    if (cached) return cached;

    try {
      const oiData = await ccxtService.fetchOpenInterest(symbol, exchange);
      const totalOpenInterest = this.readNumber(oiData.openInterestAmount ?? oiData.openInterest, 'open interest');
      if (totalOpenInterest === null) throw new Error(`Exchange did not provide open interest for ${symbol}`);
      const rawHistory = await ccxtService.fetchOpenInterestHistory(symbol, exchange, Date.now() - 24 * 60 * 60 * 1000, 100);
      const historicalOI = rawHistory
        .map((entry) => ({
          timestamp: this.readNumber(entry.timestamp, 'open-interest history timestamp'),
          oi: this.readNumber(entry.openInterestAmount ?? entry.openInterest, 'historical open interest'),
        }))
        .filter((entry): entry is { timestamp: number; oi: number } => entry.timestamp !== null && entry.oi !== null)
        .sort((left, right) => left.timestamp - right.timestamp);
      const previousOI = historicalOI[0]?.oi;
      const openInterestChange24h = previousOI && previousOI > 0
        ? ((totalOpenInterest - previousOI) / previousOI) * 100
        : null;
      const trend = openInterestChange24h === null
        ? 'unknown'
        : openInterestChange24h > 5
          ? 'increasing'
          : openInterestChange24h < -5
            ? 'decreasing'
            : 'stable';
      const longOpenInterest = this.readNumber(oiData.longOpenInterest, 'long open interest');
      const shortOpenInterest = this.readNumber(oiData.shortOpenInterest, 'short open interest');

      const result: OpenInterest = {
        symbol,
        totalOpenInterest,
        longOpenInterest,
        shortOpenInterest,
        longShortRatio: longOpenInterest !== null && shortOpenInterest !== null && shortOpenInterest > 0
          ? longOpenInterest / shortOpenInterest
          : null,
        openInterestTrend: trend,
        openInterestChange24h,
        historicalOI
      };

      await cacheService.set<OpenInterest>(cacheKey, result, 3600); // 1 hour TTL
      return result;
    } catch (error) {
      logger.error('Failed to fetch open interest', { symbol, exchange, error });
      throw error;
    }
  }

  /**
   * Predict funding rate based on historical data
   */
  async predictFundingRate(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<FundingRatePrediction> {
    try {
      const fundingRate = await this.getFundingRate(symbol, exchange);
      const openInterest = await this.getOpenInterest(symbol, exchange);
      const liquidations = await this.getLiquidationData(symbol, exchange);

      // Calculate prediction factors
      const oiFactor = openInterest.openInterestChange24h === null
        ? null
        : (openInterest.openInterestChange24h / 100) * 0.3;
      const liquidationTotal = liquidations.bullishLiquidations + liquidations.bearishLiquidations;
      const liquidationFactor = liquidationTotal === 0
        ? null
        : ((liquidations.bullishLiquidations - liquidations.bearishLiquidations) / liquidationTotal) * 0.2;
      const sentimentFactor = openInterest.longShortRatio === null
        ? null
        : (openInterest.longShortRatio - 1) * 0.3;
      const volatilityFactor = fundingRate.historicalRates.length < 2
        ? null
        : this.calculateFundingVolatilityFactor(fundingRate.historicalRates);
      const observedFactors = [oiFactor, liquidationFactor, sentimentFactor, volatilityFactor]
        .filter((factor): factor is number => factor !== null);
      const totalFactor = observedFactors.reduce((sum, factor) => sum + factor, 0);
      const canForecast = fundingRate.predictedRate !== null && observedFactors.length > 0;
      const predictedRate24h = canForecast
        ? fundingRate.predictedRate! + fundingRate.currentRate * totalFactor * 0.1
        : null;
      const predictedRate7d = canForecast
        ? fundingRate.predictedRate! + fundingRate.currentRate * totalFactor * 0.7
        : null;

      const confidence = canForecast
        ? Math.round((observedFactors.length / 4) * Math.min(100, Math.max(0, 70 - Math.abs(totalFactor) * 30)))
        : 0;

      return {
        symbol,
        currentRate: fundingRate.currentRate,
        predictedRate24h,
        predictedRate7d,
        confidence,
        factors: {
          openInterestFactor: oiFactor,
          liquidationFactor,
          marketSentimentFactor: sentimentFactor,
          volatilityFactor
        },
        recommendations: this.generateFundingRateRecommendations(
          fundingRate.currentRate,
          predictedRate24h,
          confidence
        )
      };
    } catch (error) {
      logger.error('Failed to predict funding rate', { symbol, error });
      throw error;
    }
  }

  /**
   * Detect liquidation risk for a position
   */
  async detectLiquidationRisk(
    symbol: string,
    entryPrice: number,
    leverage: number = 1,
    exchange: string = 'binance'
  ): Promise<LiquidationRisk> {
    try {
      const ticker = await ccxtService.fetchTicker(symbol, exchange);
      const currentPrice = ticker.last;

      // Calculate liquidation price (assuming 5% maintenance margin)
      const liquidationPrice = entryPrice / (1 + leverage * 0.05);
      const percentToLiquidation = ((currentPrice - liquidationPrice) / currentPrice) * 100;

      // Assess risk level
      const riskLevel =
        percentToLiquidation < 2
          ? 'critical'
          : percentToLiquidation < 5
          ? 'high'
          : percentToLiquidation < 10
          ? 'medium'
          : 'low';

      // Check for cascade risk
      const liquidations = await this.getLiquidationData(symbol, exchange);
      const cascadeRisk = liquidations.liquidationCascade && liquidations.cascadeSeverity === 'high';

      return {
        symbol,
        symbol_price: currentPrice,
        liquidationLevel: liquidationPrice,
        percentToLiquidation,
        riskLevel,
        liquidationCascadeRisk: cascadeRisk,
        recommendation:
          riskLevel === 'critical'
            ? '🚨 CLOSE POSITION IMMEDIATELY - liquidation imminent'
            : riskLevel === 'high'
            ? '⚠️ HIGH RISK - consider reducing leverage or taking profit'
            : riskLevel === 'medium'
            ? '📊 Monitor closely - potential liquidation risk'
            : '✅ Safe margin level'
      };
    } catch (error) {
      logger.error('Failed to detect liquidation risk', { symbol, entryPrice, error });
      throw error;
    }
  }

  /**
   * Get overall futures market health
   */
  async getFuturesMarketHealth(
    symbol: string,
    exchange: string = 'binance'
  ): Promise<FuturesMarketHealth> {
    try {
      const [fundingRate, liquidations, openInterest] = await Promise.all([
        this.getFundingRate(symbol, exchange),
        this.getLiquidationData(symbol, exchange),
        this.getOpenInterest(symbol, exchange)
      ]);

      // Calculate component health scores
      const fundingRateHealth = Math.max(
        0,
        100 - Math.abs(fundingRate.currentRate) * 100
      );

      const liquidationRiskHealth = Math.max(
        0,
        100 - (liquidations.totalLiquidations24h / 10) - (liquidations.cascadeSeverity === 'extreme' ? 50 : 0)
      );

      const openInterestHealth = openInterest.openInterestChange24h === null
        ? null
        : Math.max(0, 100 - Math.abs(openInterest.openInterestChange24h) * 5);

      const overallHealth = openInterestHealth === null
        ? null
        : Math.round(fundingRateHealth * 0.4 + liquidationRiskHealth * 0.35 + openInterestHealth * 0.25);

      const assessment = overallHealth === null
        ? 'Unavailable'
        : overallHealth >= 75
          ? 'Excellent'
          : overallHealth >= 50
            ? 'Good'
            : overallHealth >= 25
              ? 'Fair'
              : 'Poor';

      return {
        symbol,
        fundingRateHealth,
        liquidationRiskHealth,
        openInterestHealth,
        overallHealth,
        assessment,
        recommendations: this.generateFuturesHealthRecommendations(
          fundingRate,
          liquidations,
          openInterest
        )
      };
    } catch (error) {
      logger.error('Failed to get futures market health', { symbol, exchange, error });
      throw error;
    }
  }

  // Helper methods

  private readNumber(value: unknown, field: string): number | null {
    if (value === null || value === undefined) return null;
    const result = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(result)) throw new Error(`Exchange returned invalid ${field}`);
    return result;
  }

  private calculateFundingVolatilityFactor(history: Array<{ timestamp: number; rate: number }>): number {
    const rates = history.map((entry) => entry.rate);
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    if (mean === 0) return 0;
    const variance = rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / rates.length;
    const standardDeviation = Math.sqrt(variance);
    const direction = rates[rates.length - 1] - rates[0];
    return Math.max(-0.2, Math.min(0.2, Math.sign(direction) * (standardDeviation / Math.abs(mean)) * 0.1));
  }

  private detectLiquidationCascade(liquidations: any[]): boolean {
    // Cascade detected if many liquidations in short period
    const last10mins = liquidations.filter(
      l => Date.now() - l.timestamp < 10 * 60 * 1000
    );
    return last10mins.length > 5;
  }

  private calculateCascadeSeverity(
    liquidations: any[],
    cascade: boolean
  ): 'low' | 'medium' | 'high' | 'extreme' {
    if (!cascade || liquidations.length === 0) return 'low';

    const totalSize = liquidations.reduce((sum: number, l: any) => sum + l.amount, 0);
    const avgSize = totalSize / liquidations.length;
    const largestSize = Math.max(...liquidations.map((l: any) => l.amount));

    if (largestSize > avgSize * 100) return 'extreme';
    if (largestSize > avgSize * 50) return 'high';
    if (largestSize > avgSize * 20) return 'medium';
    return 'low';
  }

  private generateFundingRateRecommendations(
    current: number,
    predicted: number | null,
    confidence: number
  ): string[] {
    const recommendations: string[] = [];

    if (current > 0.05) {
      recommendations.push('High positive funding - good opportunity for shorts');
    } else if (current < -0.05) {
      recommendations.push('High negative funding - good opportunity for longs');
    }

    if (predicted !== null && predicted > current * 1.2 && confidence > 70) {
      recommendations.push('Funding rate expected to increase - consider hedging');
    } else if (predicted !== null && predicted < current * 0.8 && confidence > 70) {
      recommendations.push('Funding rate expected to decrease - reduce hedging');
    }

    if (predicted === null) recommendations.push('Insufficient exchange history for a funding-rate forecast');

    if (confidence < 50) {
      recommendations.push('Low prediction confidence - monitor closely');
    }

    return recommendations;
  }

  private generateFuturesHealthRecommendations(
    fundingRate: FundingRate,
    liquidations: LiquidationData,
    openInterest: OpenInterest
  ): string[] {
    const recommendations: string[] = [];

    if (liquidations.cascadeSeverity === 'extreme') {
      recommendations.push('🚨 LIQUIDATION CRISIS - extreme volatility risk');
    } else if (liquidations.cascadeSeverity === 'high') {
      recommendations.push('⚠️ HIGH LIQUIDATION ACTIVITY - reduce leverage');
    }

    if (fundingRate.trend === 'bullish') {
      recommendations.push('Bullish funding rate trend - favorable for longs');
    } else if (fundingRate.trend === 'bearish') {
      recommendations.push('Bearish funding rate trend - favorable for shorts');
    }

    if (openInterest.openInterestChange24h !== null && openInterest.openInterestChange24h > 20) {
      recommendations.push('Rapid OI increase - may indicate trend formation');
    } else if (openInterest.openInterestChange24h !== null && openInterest.openInterestChange24h < -20) {
      recommendations.push('OI declining - potentially reversal warning');
    }

    return recommendations;
  }
}

export const futuresMarketSupport = FuturesMarketSupport.getInstance();

export type {
  FundingRate,
  LiquidationData,
  OpenInterest,
  FundingRatePrediction,
  LiquidationRisk,
  FuturesMarketHealth
};
