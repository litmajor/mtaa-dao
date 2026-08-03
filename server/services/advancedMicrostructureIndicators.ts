import { cacheService } from './cacheService';
import { ccxtService } from './ccxtService';
import { logger } from '../utils/logger';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * CEX Market Microstructure Indicators - v2, corrected
 * ═══════════════════════════════════════════════════════════════════════
 * Scope: centralized order-book exchanges only (via CCXT). AMM/DEX pools
 * have no order book and need entirely different math — see the
 * companion file ammMicrostructureIndicators.ts for that.
 *
 * FIXES FROM v1:
 *   1. calculateDepth returned a PRICE LEVEL, not a liquidity amount, but
 *      was used as if it were USD depth (inventoryRiskIndicator,
 *      liquidityDepth). Replaced with calculateLiquidityUSD(), which
 *      actually sums price*volume across order book levels — a real
 *      dollar figure, matching what the type definitions claim.
 *   2. Toxicity formula had a stray `* 0.75` multiplier capping the
 *      score at 75 out of 100, making the 'severely_toxic' assessment
 *      tier (and its "avoid large trades" recommendation) practically
 *      unreachable, and biasing qualityScore upward. Removed.
 *   3. calculatePriceRecovery/estimateRecoveryTime computed raw price
 *      drift and average inter-trade interval respectively — neither
 *      measured actual impact decay. Replaced with a real impact-event
 *      detection + reversion-tracking approach (detectImpactEvents +
 *      measureRecovery).
 *   4. All .reduce() calls now seeded with 0 — un-seeded reduce on an
 *      empty array (common on thin/rate-limited data) threw uncaught.
 *   5. getComprehensiveMicrostructure now uses Promise.allSettled with
 *      per-component defaults instead of Promise.all, so one thin-data
 *      component failing doesn't kill the entire comprehensive read.
 *   6. Volatility regime now compares a genuine short-window "current"
 *      volatility against the historical population already tracked in
 *      `historicalVolatility` (built up across calls over time), instead
 *      of comparing two overlapping views of the same single window.
 *   7. informationAsymmetry is now volume-weighted and uses the actual
 *      sample size as its denominator, instead of assuming exactly 20
 *      trades and counting occurrences rather than size.
 *   8. Skew/kurtosis no longer multiplied by 100 — they're dimensionless
 *      higher moments, not percentages.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────
// TUNABLE CONSTANTS — named so they can be calibrated/overridden later
// ─────────────────────────────────────────────────────────────────────────

const IMBALANCE_TREND_THRESHOLD = 10;     // % imbalance to call a trend "buying"/"selling"
const IMBALANCE_STRENGTH_WEAK = 5;        // % imbalance below this = 'weak'
const IMBALANCE_STRENGTH_MODERATE = 20;   // % imbalance below this = 'moderate', else 'strong'
const ORDER_BOOK_DEPTH_LEVELS = 20;       // levels summed for liquidity USD figures
const IMPACT_EVENT_SIZE_STDDEV = 1.0;     // trades > mean + N*stdev size count as "impact events"
const RECOVERY_TOLERANCE_FRACTION = 0.5;  // price back within 50% of original impact = "recovered"
const TOXICITY_WEIGHTS = { adverseSelection: 0.4, inventoryRisk: 0.35, infoAsymmetry: 0.25 };

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

interface OrderFlowImbalance {
  symbol: string;
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  imbalance: number; // -100 to +100
  imbalanceRatio: number;
  trend: 'buying' | 'balanced' | 'selling';
  strength: 'weak' | 'moderate' | 'strong';
}

interface VolatilityOfVolatility {
  symbol: string;
  timestamp: number;
  currentVolatility: number;       // recent short-window vol, as %
  historicalMeanVolatility: number; // mean of the tracked historical population, as %
  volatilityOfVolatility: number;  // vol of vol, as %
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  regimeConfidence: 'low' | 'medium' | 'high'; // low if historical population is still small
  skew: number;     // dimensionless (3rd standardized moment)
  kurtosis: number; // dimensionless excess kurtosis
}

interface OrderBookToxicity {
  symbol: string;
  timestamp: number;
  toxicity: number; // 0-100, full range now reachable
  adverseSelectionIndicator: number; // 0-100
  inventoryRiskIndicator: number;    // 0-100, now a genuine volume imbalance
  informationAsymmetry: number;      // 0-100, volume-weighted
  assessment: 'healthy' | 'moderate' | 'toxic' | 'severely_toxic';
  recommendation: string;
}

interface PriceImpactAnalysis {
  symbol: string;
  timestamp: number;
  shortTermImpact: number;   // %, from detected impact events in last ~20 trades
  mediumTermImpact: number;  // %, impact events in last 1 min
  longTermImpact: number;    // %, impact events in last 5 min
  recoveryTime: number;      // ms, avg time for price to revert toward pre-impact level
  resilience: number;        // 0-100, avg fraction of impact actually recovered
  liquidityDepthUSD: number; // real USD summed across top order book levels
  impactEventsDetected: number; // how many events the estimate is based on (0 = no signal)
}

interface MarketMicrostructureIndicators {
  symbol: string;
  timestamp: number;
  orderFlowImbalance: OrderFlowImbalance | null;
  volatilityOfVolatility: VolatilityOfVolatility | null;
  orderBookToxicity: OrderBookToxicity | null;
  priceImpact: PriceImpactAnalysis | null;
  componentErrors: Partial<Record<'orderFlow' | 'volOfVol' | 'toxicity' | 'priceImpact', string>>;
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient_data';
  recommendations: string[];
}

interface AdvancedMicrostructureAlert {
  symbol: string;
  type: 'imbalance' | 'toxicity' | 'volatility' | 'impact' | 'cascade';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  message: string;
  timestamp: number;
  actionable: boolean;
}

interface ImpactEvent {
  timestamp: number;
  priceBefore: number;
  priceAtEvent: number;
  impactPct: number;
  recoveredWithinWindow: boolean;
  recoveryTimeMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────

class AdvancedMicrostructureIndicators {
  private historicalVolatility: Map<string, number[]> = new Map();
  private historicalImbalance: Map<string, number[]> = new Map();
  private alerts: Map<string, AdvancedMicrostructureAlert[]> = new Map();
  private static instance: AdvancedMicrostructureIndicators;

  private constructor() {}

  static getInstance(): AdvancedMicrostructureIndicators {
    if (!AdvancedMicrostructureIndicators.instance) {
      AdvancedMicrostructureIndicators.instance = new AdvancedMicrostructureIndicators();
    }
    return AdvancedMicrostructureIndicators.instance;
  }

  // ── Order flow imbalance ────────────────────────────────────────────

  async analyzeOrderFlowImbalance(symbol: string, exchange = 'binance'): Promise<OrderFlowImbalance> {
    const cacheKey = `order-flow-imbalance:${symbol}:${exchange}`;
    const cached = await cacheService.get<OrderFlowImbalance>(cacheKey);
    if (cached) return cached;

    const trades = await ccxtService.fetchTrades(exchange, symbol, 100) ?? [];
    if (trades.length === 0) {
      throw new Error(`No trade history available for ${symbol} on ${exchange} — cannot compute imbalance`);
    }

    const buyVolume = trades.filter((t: any) => t.side === 'buy').reduce((s: number, t: any) => s + t.amount, 0);
    const sellVolume = trades.filter((t: any) => t.side === 'sell').reduce((s: number, t: any) => s + t.amount, 0);
    const totalVolume = buyVolume + sellVolume;

    if (totalVolume === 0) {
      throw new Error(`No trade volume available for ${symbol} on ${exchange} — cannot compute imbalance`);
    }

    const imbalance = ((buyVolume - sellVolume) / totalVolume) * 100;
    const imbalanceRatio = sellVolume > 0 ? buyVolume / sellVolume : buyVolume > 0 ? Infinity : 1;

    const trend: OrderFlowImbalance['trend'] =
      imbalance > IMBALANCE_TREND_THRESHOLD ? 'buying'
      : imbalance < -IMBALANCE_TREND_THRESHOLD ? 'selling'
      : 'balanced';

    const strength: OrderFlowImbalance['strength'] =
      Math.abs(imbalance) < IMBALANCE_STRENGTH_WEAK ? 'weak'
      : Math.abs(imbalance) < IMBALANCE_STRENGTH_MODERATE ? 'moderate'
      : 'strong';

    const result: OrderFlowImbalance = {
      symbol, timestamp: Date.now(), buyVolume, sellVolume, imbalance, imbalanceRatio, trend, strength,
    };

    this.trackHistoricalImbalance(symbol, imbalance);
    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  // ── Volatility of volatility ────────────────────────────────────────

  async calculateVolatilityOfVolatility(
    symbol: string,
    exchange = 'binance',
    periods = 24,
  ): Promise<VolatilityOfVolatility> {
    const cacheKey = `vol-of-vol:${symbol}:${exchange}`;
    const cached = await cacheService.get<VolatilityOfVolatility>(cacheKey);
    if (cached) return cached;

    const ohlcv = await ccxtService.getOHLCVFromExchange(exchange, symbol, '1h', periods);
    if (!ohlcv || ohlcv.length < 7) {
      throw new Error(`Insufficient candles for vol-of-vol on ${symbol}/${exchange}: got ${ohlcv?.length ?? 0}, need >= 7`);
    }

    const returns: number[] = [];
    const rollingVols: number[] = [];
    const WINDOW = 5;

    for (let i = 1; i < ohlcv.length; i++) {
      returns.push(Math.log(ohlcv[i][4] / ohlcv[i - 1][4]));
      if (returns.length >= WINDOW) {
        const window = returns.slice(-WINDOW);
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
        rollingVols.push(Math.sqrt(variance));
      }
    }

    if (rollingVols.length === 0) {
      throw new Error(`Not enough data to compute rolling volatility for ${symbol}`);
    }

    // "Current" volatility = the MOST RECENT rolling window's vol — a
    // genuinely short-window figure, not the same aggregate as the mean below.
    const currentVol = rollingVols[rollingVols.length - 1];

    const meanRollingVol = rollingVols.reduce((a, b) => a + b, 0) / rollingVols.length;
    const volOfVolVariance = rollingVols.reduce((a, b) => a + (b - meanRollingVol) ** 2, 0) / rollingVols.length;
    const volOfVol = Math.sqrt(volOfVolVariance);

    const skew = this.calculateSkew(returns);
    const kurtosis = this.calculateKurtosis(returns);

    // Regime: compare current (short-window) vol against the HISTORICAL
    // POPULATION tracked across many past calls — a genuine current-vs-history
    // comparison, not two views of the same in-sample window.
    const history = this.historicalVolatility.get(symbol) ?? [];
    let regime: VolatilityOfVolatility['volatilityRegime'] = 'normal';
    let regimeConfidence: VolatilityOfVolatility['regimeConfidence'] = 'low';

    if (history.length >= 20) {
      const histMean = history.reduce((a, b) => a + b, 0) / history.length;
      const histVariance = history.reduce((a, b) => a + (b - histMean) ** 2, 0) / history.length;
      const histStd = Math.sqrt(histVariance);
      const currentPct = currentVol * 100;

      if (currentPct < histMean - histStd) regime = 'low';
      else if (currentPct < histMean + histStd) regime = 'normal';
      else if (currentPct < histMean + 2 * histStd) regime = 'high';
      else regime = 'extreme';

      regimeConfidence = history.length >= 100 ? 'high' : 'medium';
    }
    // else: insufficient history yet — return 'normal' with 'low' confidence
    // rather than fabricate a regime from too little data.

    const result: VolatilityOfVolatility = {
      symbol,
      timestamp: Date.now(),
      currentVolatility: currentVol * 100,
      historicalMeanVolatility: history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : currentVol * 100,
      volatilityOfVolatility: volOfVol * 100,
      volatilityRegime: regime,
      regimeConfidence,
      skew,
      kurtosis,
    };

    this.trackHistoricalVolatility(symbol, currentVol * 100);
    await cacheService.set(cacheKey, result, 3600);
    return result;
  }

  // ── Order book toxicity ─────────────────────────────────────────────

  async detectOrderBookToxicity(symbol: string, exchange = 'binance'): Promise<OrderBookToxicity> {
    const cacheKey = `order-book-toxicity:${symbol}:${exchange}`;
    const cached = await cacheService.get<OrderBookToxicity>(cacheKey);
    if (cached) return cached;

    const [orderBook, tradesRaw, ticker] = await Promise.all([
      ccxtService.fetchOrderBook(exchange, symbol, 50),
      ccxtService.fetchTrades(exchange, symbol, 50),
      ccxtService.getTickerFromExchange(exchange, symbol),
    ]);

    const trades = tradesRaw ?? [];
    if (trades.length === 0) {
      throw new Error(`No trade history available for ${symbol} on ${exchange} — cannot compute toxicity`);
    }
    if (!ticker) {
      throw new Error(`Ticker unavailable for ${symbol} on ${exchange} — cannot compute toxicity`);
    }

    const midPrice = (ticker.bid + ticker.ask) / 2;
    const spreadBps = midPrice > 0 ? ((ticker.ask - ticker.bid) / midPrice) * 10000 : 0;
    const adverseSelectionIndicator = Math.min(100, spreadBps / 2);

    // Inventory risk: REAL liquidity USD on each side, not a price-level artifact
    const bidLiquidityUSD = this.calculateLiquidityUSD(orderBook.bids, ORDER_BOOK_DEPTH_LEVELS);
    const askLiquidityUSD = this.calculateLiquidityUSD(orderBook.asks, ORDER_BOOK_DEPTH_LEVELS);
    const totalLiquidity = bidLiquidityUSD + askLiquidityUSD;
    const inventoryRiskIndicator = totalLiquidity > 0
      ? (Math.abs(bidLiquidityUSD - askLiquidityUSD) / totalLiquidity) * 100
      : 0;

    // Information asymmetry: volume-weighted, sample-size-agnostic
    const recentTrades = trades.slice(-20);
    const buyVol = recentTrades.filter((t: any) => t.side === 'buy').reduce((s: number, t: any) => s + t.amount, 0);
    const sellVol = recentTrades.filter((t: any) => t.side === 'sell').reduce((s: number, t: any) => s + t.amount, 0);
    const totalRecentVol = buyVol + sellVol;
    const informationAsymmetry = totalRecentVol > 0
      ? (Math.abs(buyVol - sellVol) / totalRecentVol) * 100
      : 0;

    // Toxicity: weights sum to 1.0, no stray compression multiplier —
    // full 0-100 range is now reachable and assessment tiers mean what they say.
    const toxicity = Math.round(
      adverseSelectionIndicator * TOXICITY_WEIGHTS.adverseSelection +
      inventoryRiskIndicator * TOXICITY_WEIGHTS.inventoryRisk +
      informationAsymmetry * TOXICITY_WEIGHTS.infoAsymmetry,
    );

    const assessment: OrderBookToxicity['assessment'] =
      toxicity < 25 ? 'healthy' : toxicity < 50 ? 'moderate' : toxicity < 75 ? 'toxic' : 'severely_toxic';

    const recommendation =
      assessment === 'healthy' ? '✅ Order book health: excellent'
      : assessment === 'moderate' ? '📊 Moderate toxicity - execute with caution'
      : assessment === 'toxic' ? '⚠️ High toxicity - consider smaller orders'
      : '🚨 Severe toxicity - avoid large trades';

    const result: OrderBookToxicity = {
      symbol, timestamp: Date.now(), toxicity, adverseSelectionIndicator,
      inventoryRiskIndicator, informationAsymmetry, assessment, recommendation,
    };

    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  // ── Price impact ─────────────────────────────────────────────────────

  /**
   * Genuine impact-decay measurement: detects unusually large trades
   * ("impact events") and tracks whether/how fast price reverts toward
   * its pre-event level afterward. Replaces the old calculatePriceRecovery
   * (which just measured raw drift) and estimateRecoveryTime (which
   * measured average inter-trade interval, not recovery at all).
   */
  async analyzePriceImpact(symbol: string, exchange = 'binance'): Promise<PriceImpactAnalysis> {
    const cacheKey = `price-impact:${symbol}:${exchange}`;
    const cached = await cacheService.get<PriceImpactAnalysis>(cacheKey);
    if (cached) return cached;

    const [orderBook, tradesRaw] = await Promise.all([
      ccxtService.fetchOrderBook(exchange, symbol, 100),
      ccxtService.fetchTrades(exchange, symbol, 100),
    ]);

    const trades = tradesRaw ?? [];
    if (trades.length === 0) {
      throw new Error(`No trade history available for ${symbol} on ${exchange} — cannot compute price impact`);
    }

    const liquidityDepthUSD = this.calculateLiquidityUSD(orderBook.asks, ORDER_BOOK_DEPTH_LEVELS)
      + this.calculateLiquidityUSD(orderBook.bids, ORDER_BOOK_DEPTH_LEVELS);

    const now = Date.now();
    const shortTermTrades = trades.slice(-20);
    const mediumTermTrades = trades.filter((t: any) => now - t.timestamp < 60_000);
    const longTermTrades = trades.filter((t: any) => now - t.timestamp < 300_000);

    const shortEvents = this.detectImpactEvents(shortTermTrades);
    const mediumEvents = this.detectImpactEvents(mediumTermTrades);
    const longEvents = this.detectImpactEvents(longTermTrades);

    const allEvents = [...shortEvents, ...mediumEvents, ...longEvents];
    const avgImpact = (events: ImpactEvent[]) =>
      events.length > 0 ? events.reduce((s, e) => s + Math.abs(e.impactPct), 0) / events.length : 0;

    const recoveredEvents = allEvents.filter(e => e.recoveryTimeMs !== null);
    const recoveryTime = recoveredEvents.length > 0
      ? recoveredEvents.reduce((s, e) => s + (e.recoveryTimeMs ?? 0), 0) / recoveredEvents.length
      : 0;

    const resilience = allEvents.length > 0
      ? Math.round((allEvents.filter(e => e.recoveredWithinWindow).length / allEvents.length) * 100)
      : 100; // no impact events detected = nothing to recover from = fully resilient by default

    const result: PriceImpactAnalysis = {
      symbol,
      timestamp: Date.now(),
      shortTermImpact: avgImpact(shortEvents),
      mediumTermImpact: avgImpact(mediumEvents),
      longTermImpact: avgImpact(longEvents),
      recoveryTime,
      resilience,
      liquidityDepthUSD,
      impactEventsDetected: allEvents.length,
    };

    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Detect trades whose size is a statistical outlier (mean + N stdev)
   * within the given window, then check whether subsequent trades in
   * the same window show price reverting back toward the pre-event level.
   */
  private detectImpactEvents(trades: any[]): ImpactEvent[] {
    if (trades.length < 5) return []; // not enough data to establish a baseline

    const sizes = trades.map(t => t.amount ?? 0);
    const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const sizeVariance = sizes.reduce((a, b) => a + (b - meanSize) ** 2, 0) / sizes.length;
    const sizeStd = Math.sqrt(sizeVariance);
    const threshold = meanSize + IMPACT_EVENT_SIZE_STDDEV * sizeStd;

    const events: ImpactEvent[] = [];

    for (let i = 1; i < trades.length; i++) {
      if ((trades[i].amount ?? 0) <= threshold) continue;

      const priceBefore = trades[i - 1].price;
      const priceAtEvent = trades[i].price;
      if (!priceBefore || priceBefore === 0) continue;

      const impactPct = ((priceAtEvent - priceBefore) / priceBefore) * 100;
      if (impactPct === 0) continue;

      // Scan forward for reversion within RECOVERY_TOLERANCE_FRACTION of the impact
      let recoveredWithinWindow = false;
      let recoveryTimeMs: number | null = null;
      const recoveryTarget = priceAtEvent - impactPct * RECOVERY_TOLERANCE_FRACTION / 100 * priceBefore;

      for (let j = i + 1; j < trades.length; j++) {
        const reverted = impactPct > 0
          ? trades[j].price <= recoveryTarget
          : trades[j].price >= recoveryTarget;
        if (reverted) {
          recoveredWithinWindow = true;
          recoveryTimeMs = trades[j].timestamp - trades[i].timestamp;
          break;
        }
      }

      events.push({ timestamp: trades[i].timestamp, priceBefore, priceAtEvent, impactPct, recoveredWithinWindow, recoveryTimeMs });
    }

    return events;
  }

  // ── Comprehensive read ───────────────────────────────────────────────

  /**
   * Uses Promise.allSettled so one component failing on thin data (e.g.
   * a freshly-listed symbol with too few candles for vol-of-vol) doesn't
   * take down the entire comprehensive response — it degrades gracefully
   * with that component set to null and the error recorded.
   */
  async getComprehensiveMicrostructure(symbol: string, exchange = 'binance'): Promise<MarketMicrostructureIndicators> {
    const [orderFlowR, volOfVolR, toxicityR, priceImpactR] = await Promise.allSettled([
      this.analyzeOrderFlowImbalance(symbol, exchange),
      this.calculateVolatilityOfVolatility(symbol, exchange),
      this.detectOrderBookToxicity(symbol, exchange),
      this.analyzePriceImpact(symbol, exchange),
    ]);

    const orderFlow = orderFlowR.status === 'fulfilled' ? orderFlowR.value : null;
    const volOfVol = volOfVolR.status === 'fulfilled' ? volOfVolR.value : null;
    const toxicity = toxicityR.status === 'fulfilled' ? toxicityR.value : null;
    const priceImpact = priceImpactR.status === 'fulfilled' ? priceImpactR.value : null;

    const componentErrors: MarketMicrostructureIndicators['componentErrors'] = {};
    if (orderFlowR.status === 'rejected') componentErrors.orderFlow = String(orderFlowR.reason?.message ?? orderFlowR.reason);
    if (volOfVolR.status === 'rejected') componentErrors.volOfVol = String(volOfVolR.reason?.message ?? volOfVolR.reason);
    if (toxicityR.status === 'rejected') componentErrors.toxicity = String(toxicityR.reason?.message ?? toxicityR.reason);
    if (priceImpactR.status === 'rejected') componentErrors.priceImpact = String(priceImpactR.reason?.message ?? priceImpactR.reason);

    let overallQuality: MarketMicrostructureIndicators['overallQuality'] = 'insufficient_data';

    if (toxicity && priceImpact && orderFlow) {
      const qualityScore = Math.round(
        (100 - toxicity.toxicity) * 0.4 +
        priceImpact.resilience * 0.3 +
        (100 - Math.abs(orderFlow.imbalance)) * 0.3,
      );
      overallQuality = qualityScore >= 80 ? 'excellent' : qualityScore >= 60 ? 'good' : qualityScore >= 40 ? 'fair' : 'poor';
    }

    const recommendations = this.generateMicrostructureRecommendations(orderFlow, volOfVol, toxicity, priceImpact);

    return {
      symbol, timestamp: Date.now(),
      orderFlowImbalance: orderFlow, volatilityOfVolatility: volOfVol,
      orderBookToxicity: toxicity, priceImpact,
      componentErrors, overallQuality, recommendations,
    };
  }

  async generateMicrostructureAlerts(symbol: string, exchange = 'binance'): Promise<AdvancedMicrostructureAlert[]> {
    const indicators = await this.getComprehensiveMicrostructure(symbol, exchange);
    const alerts: AdvancedMicrostructureAlert[] = [];
    const now = Date.now();

    if (indicators.orderFlowImbalance && Math.abs(indicators.orderFlowImbalance.imbalance) > 40) {
      alerts.push({
        symbol, type: 'imbalance',
        severity: Math.abs(indicators.orderFlowImbalance.imbalance) > 60 ? 'critical' : 'alert',
        message: `Extreme ${indicators.orderFlowImbalance.trend} - ${Math.abs(indicators.orderFlowImbalance.imbalance).toFixed(1)}% imbalance`,
        timestamp: now, actionable: true,
      });
    }

    if (indicators.orderBookToxicity && indicators.orderBookToxicity.toxicity > 70) {
      alerts.push({
        symbol, type: 'toxicity',
        severity: indicators.orderBookToxicity.toxicity > 85 ? 'critical' : 'alert',
        message: `Order book toxicity high: ${indicators.orderBookToxicity.assessment}`,
        timestamp: now, actionable: true,
      });
    }

    if (indicators.volatilityOfVolatility?.volatilityRegime === 'extreme' && indicators.volatilityOfVolatility.regimeConfidence !== 'low') {
      alerts.push({
        symbol, type: 'volatility', severity: 'critical',
        message: 'Extreme volatility regime detected - sharp price moves likely',
        timestamp: now, actionable: true,
      });
    }

    if (indicators.priceImpact && indicators.priceImpact.impactEventsDetected > 0 && indicators.priceImpact.shortTermImpact > 0.5) {
      alerts.push({
        symbol, type: 'impact',
        severity: indicators.priceImpact.shortTermImpact > 1.0 ? 'critical' : 'warning',
        message: `High price impact: ${indicators.priceImpact.shortTermImpact.toFixed(2)}%`,
        timestamp: now, actionable: true,
      });
    }

    this.alerts.set(symbol, alerts);
    return alerts;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private trackHistoricalVolatility(symbol: string, volatility: number): void {
    if (!this.historicalVolatility.has(symbol)) this.historicalVolatility.set(symbol, []);
    const history = this.historicalVolatility.get(symbol)!;
    history.push(volatility);
    if (history.length > 1000) history.shift();
  }

  private trackHistoricalImbalance(symbol: string, imbalance: number): void {
    if (!this.historicalImbalance.has(symbol)) this.historicalImbalance.set(symbol, []);
    const history = this.historicalImbalance.get(symbol)!;
    history.push(imbalance);
    if (history.length > 1000) history.shift();
  }

  private calculateSkew(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const n = returns.length;
    const m3 = returns.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
    const m2 = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const sd = Math.sqrt(m2);
    return sd > 0 ? m3 / sd ** 3 : 0;
  }

  private calculateKurtosis(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const n = returns.length;
    const m4 = returns.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
    const m2 = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    return m2 > 0 ? m4 / m2 ** 2 - 3 : 0;
  }

  /** Real USD liquidity across the top N order book levels — replaces calculateDepth. */
  private calculateLiquidityUSD(levels: [number, number][], maxLevels = ORDER_BOOK_DEPTH_LEVELS): number {
    return levels.slice(0, maxLevels).reduce((sum, [price, volume]) => sum + price * volume, 0);
  }

  private generateMicrostructureRecommendations(
    orderFlow: OrderFlowImbalance | null,
    volOfVol: VolatilityOfVolatility | null,
    toxicity: OrderBookToxicity | null,
    priceImpact: PriceImpactAnalysis | null,
  ): string[] {
    const recommendations: string[] = [];

    if (orderFlow?.strength === 'strong') {
      recommendations.push(`Strong ${orderFlow.trend} pressure - follow the flow`);
    }
    if (volOfVol?.volatilityRegime === 'extreme' && volOfVol.regimeConfidence !== 'low') {
      recommendations.push('Extreme volatility regime - reduce position size');
    }
    if (toxicity?.assessment === 'healthy') {
      recommendations.push('Excellent order book health - good time to trade');
    } else if (toxicity?.assessment === 'severely_toxic') {
      recommendations.push('Avoid large trades - market structure deteriorated');
    }
    if (priceImpact && priceImpact.impactEventsDetected > 0 && priceImpact.resilience < 30) {
      recommendations.push('Low market resilience - expect delayed recovery from large trades');
    }

    return recommendations;
  }
}

export const advancedMicrostructureIndicators = AdvancedMicrostructureIndicators.getInstance();

export type {
  OrderFlowImbalance,
  VolatilityOfVolatility,
  OrderBookToxicity,
  PriceImpactAnalysis,
  MarketMicrostructureIndicators,
  AdvancedMicrostructureAlert,
};