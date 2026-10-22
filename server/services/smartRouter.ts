/**
 * Smart Router Service (Production)
 *
 * Multi-exchange best-execution helper.
 * Uses CEX bid/ask (not mid), size-aware slippage, and fee tiers.
 *
 * Does NOT depend on priceOracle — only on CEX price job + fee service.
 */

import { CEXPriceBackgroundJob } from './cexPriceBackgroundJob';
import { ExchangeFeeService, type FeeStructure } from './exchangeFeeService';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TradePrice {
  exchange: string;
  price: number; // last / mid
  bid: number;
  ask: number;
  volume: number; // quote volume preferred
  timestamp: number;
}

export interface SlippageCalculation {
  basePrice: number;
  side: 'buy' | 'sell';
  slippagePercent: number;
  slippageAmount: number;
  executionPrice: number;
}

export interface RouteCost {
  exchange: string;
  side: 'buy' | 'sell';
  basePrice: number;
  slippageCalculation: SlippageCalculation;
  feeStructure: FeeStructure;
  feePaid: number;
  scheduleStale: boolean;
  totalCost: number; // quote currency total
  netPrice: number; // effective price per base unit
  dataAgeMs: number;
}

export interface OptimalRoute {
  tradingPair: string;
  side: 'buy' | 'sell';
  quantity: number; // base asset
  notionalUsd: number;
  bestExchange: string;
  bestPrice: number;
  totalCost: number;
  netPrice: number;
  costBreakdown: {
    basePrice: number;
    slippage: number;
    fees: number;
  };
  alternatives: RouteCost[];
  savingsVsWorst: number;
  timestamp: number;
}

export interface PriceComparison {
  tradingPair: string;
  allPrices: TradePrice[];
  bestBid: { exchange: string; price: number };
  bestAsk: { exchange: string; price: number };
  priceSpread: number;
  spreadPercent: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  tradingPair: string;
  buyExchange: string;
  buyPrice: number;
  sellExchange: string;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  profitAfterFees: number;
  profitPercent: number;
  isProfitable: boolean;
  timestamp: number;
}

export interface ExecutionStrategy {
  tradingPair: string;
  quantity: number;
  side: 'buy' | 'sell';
  recommendedExchange: string;
  recommendedPrice: number;
  recommendedOrderType: 'maker' | 'taker';
  expectedCost: number;
  expectedNetPrice: number;
  marketConditions: {
    tightness: 'tight' | 'loose';
    spreadPercent: number;
    volatilityPercent: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  dataAgeMs: number;
  timestamp: number;
}

export interface SmartRouterOptions {
  /** Reject quotes older than this (ms) */
  maxQuoteAgeMs?: number;
  /** Minimum quote volume (USD-ish) to consider a venue */
  minVolume?: number;
  /** Skip venues with spread wider than this (%) */
  maxSpreadPercent?: number;
  /** Default min arb profit after fees (%) */
  minArbProfitPercent?: number;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  maxQuoteAgeMs: Number(process.env.SMART_ROUTER_MAX_QUOTE_AGE_MS ?? 5_000),
  minVolume: Number(process.env.SMART_ROUTER_MIN_VOLUME ?? 1_000),
  maxSpreadPercent: Number(process.env.SMART_ROUTER_MAX_SPREAD_PCT ?? 2),
  minArbProfitPercent: Number(process.env.SMART_ROUTER_MIN_ARB_PCT ?? 0.5),
};

/** Slippage as fraction of price, keyed by notional USD */
const SLIPPAGE_TIERS: Array<{ maxNotional: number; rate: number }> = [
  { maxNotional: 10_000, rate: 0.001 }, // 0.1%
  { maxNotional: 100_000, rate: 0.005 }, // 0.5%
  { maxNotional: 1_000_000, rate: 0.01 }, // 1%
  { maxNotional: Infinity, rate: 0.02 }, // 2%
];

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class SmartRouter {
  private static instance: SmartRouter;
  private priceJob: CEXPriceBackgroundJob;
  private feeService: ExchangeFeeService;
  private opts: Required<SmartRouterOptions>;
  private warnedFeeIssues = new Set<string>();

  private constructor(options: SmartRouterOptions = {}) {
    this.priceJob = CEXPriceBackgroundJob.getInstance();
    this.feeService = ExchangeFeeService.getInstance();
    this.opts = {
      maxQuoteAgeMs: options.maxQuoteAgeMs ?? DEFAULTS.maxQuoteAgeMs,
      minVolume: options.minVolume ?? DEFAULTS.minVolume,
      maxSpreadPercent: options.maxSpreadPercent ?? DEFAULTS.maxSpreadPercent,
      minArbProfitPercent:
        options.minArbProfitPercent ?? DEFAULTS.minArbProfitPercent,
    };
  }

  static getInstance(options?: SmartRouterOptions): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter(options);
    }
    return SmartRouter.instance;
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Best venue for a trade after slippage + fees.
   * @param quantity Base-asset size (e.g. 0.5 BTC)
   * @param side buy → uses ask; sell → uses bid
   */
  async calculateOptimalRoute(
    tradingPair: string,
    quantity: number,
    side: 'buy' | 'sell',
    isMaker = false,
    userId?: string
  ): Promise<OptimalRoute> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('quantity must be a positive number (base asset)');
    }

    const prices = await this.getUsablePrices(tradingPair);
    if (prices.length === 0) {
      throw new Error(`No usable prices for ${tradingPair}`);
    }

    const routeCosts: RouteCost[] = [];
    const effectiveUserVolume = userId ? this.feeService.getUserVolume(userId) : 0;
    for (const p of prices) {
      const basePrice = side === 'buy' ? p.ask : p.bid;
      if (!Number.isFinite(basePrice) || basePrice <= 0) continue;

      const routeCost = this.calculateRouteCost({
        exchange: p.exchange,
        tradingPair,
        quantity,
        basePrice,
        side,
        isMaker,
        userVolume30Day: effectiveUserVolume,
        userId,
        dataAgeMs: Date.now() - p.timestamp,
      });
      if (routeCost) routeCosts.push(routeCost);
    }

    if (routeCosts.length === 0) {
      throw new Error(`No valid routes for ${tradingPair}`);
    }

    // Buy: lowest net price wins. Sell: highest net price wins.
    routeCosts.sort((a, b) =>
      side === 'buy' ? a.netPrice - b.netPrice : b.netPrice - a.netPrice
    );

    const best = routeCosts[0];
    const worst = routeCosts[routeCosts.length - 1];
    const mid = prices[0]?.price || best.basePrice;
    const notionalUsd = quantity * mid;

    return {
      tradingPair,
      side,
      quantity,
      notionalUsd,
      bestExchange: best.exchange,
      bestPrice: best.basePrice,
      totalCost: best.totalCost,
      netPrice: best.netPrice,
      costBreakdown: {
        basePrice: best.basePrice,
        slippage: best.slippageCalculation.slippageAmount,
        fees: best.feePaid,
      },
      alternatives: routeCosts,
      savingsVsWorst: Math.abs(worst.totalCost - best.totalCost),
      timestamp: Date.now(),
    };
  }

  async findArbitrageOpportunities(
    tradingPair: string,
    minProfitPercent = this.opts.minArbProfitPercent
  ): Promise<ArbitrageOpportunity[]> {
    const prices = await this.getUsablePrices(tradingPair);
    if (prices.length < 2) return [];

    const opportunities: ArbitrageOpportunity[] = [];

    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i === j) continue;
        const buy = prices[i];
        const sell = prices[j];
        // Buy on i at ask, sell on j at bid
        const opp = this.calculateArbitrage(
          tradingPair,
          buy.exchange,
          buy.ask,
          sell.exchange,
          sell.bid,
          minProfitPercent
        );
        if (opp) opportunities.push(opp);
      }
    }

    return opportunities.sort((a, b) => b.profitAfterFees - a.profitAfterFees);
  }

  async comparePrices(tradingPair: string): Promise<PriceComparison> {
    const prices = await this.getUsablePrices(tradingPair);
    if (prices.length === 0) {
      throw new Error(`No usable prices for ${tradingPair}`);
    }

    let bestBid = { exchange: '', price: 0 };
    let bestAsk = { exchange: '', price: Infinity };

    for (const p of prices) {
      if (p.bid > bestBid.price) bestBid = { exchange: p.exchange, price: p.bid };
      if (p.ask < bestAsk.price && p.ask > 0) {
        bestAsk = { exchange: p.exchange, price: p.ask };
      }
    }

    const spread = bestBid.price - bestAsk.price;
    const spreadPercent =
      bestAsk.price > 0 ? (spread / bestAsk.price) * 100 : 0;

    return {
      tradingPair,
      allPrices: [...prices].sort((a, b) => a.price - b.price),
      bestBid,
      bestAsk,
      priceSpread: spread,
      spreadPercent,
      timestamp: Date.now(),
    };
  }

  async getExecutionStrategy(
    tradingPair: string,
    quantity: number,
    side: 'buy' | 'sell',
    userId?: string
  ): Promise<ExecutionStrategy> {
    const route = await this.calculateOptimalRoute(tradingPair, quantity, side, false, userId);
    const comparison = await this.comparePrices(tradingPair);

    const tightness =
      comparison.spreadPercent < 0.1 ? 'tight' : 'loose';
    const recommendedOrderType: 'maker' | 'taker' =
      tightness === 'tight' ? 'maker' : 'taker';

    const ages = route.alternatives.map((r) => r.dataAgeMs);
    const dataAgeMs = ages.length ? Math.max(...ages) : 0;

    return {
      tradingPair,
      quantity,
      side,
      recommendedExchange: route.bestExchange,
      recommendedPrice: route.bestPrice,
      recommendedOrderType,
      expectedCost: route.totalCost,
      expectedNetPrice: route.netPrice,
      marketConditions: {
        tightness,
        spreadPercent: comparison.spreadPercent,
        volatilityPercent: this.calculateVolatility(comparison.allPrices),
      },
      riskLevel: this.assessRisk(route, comparison),
      dataAgeMs,
      timestamp: Date.now(),
    };
  }

  // ── Internals ──────────────────────────────────────────────

  private async getUsablePrices(tradingPair: string): Promise<TradePrice[]> {
    const collector = this.priceJob.getCollector();
    const raw = await collector.getPairPrices(tradingPair);
    const now = Date.now();
    const out: TradePrice[] = [];

    for (const [exchange, priceData] of raw) {
      const bid = Number(priceData.bid);
      const ask = Number(priceData.ask);
      const last = Number(priceData.price);
      const volume = Number(priceData.volume ?? 0);
      const timestamp = Number(priceData.timestamp ?? 0);

      if (!Number.isFinite(bid) || bid <= 0) continue;
      if (!Number.isFinite(ask) || ask <= 0) continue;
      if (ask < bid) continue; // crossed book — skip
      if (now - timestamp > this.opts.maxQuoteAgeMs) continue;
      if (volume < this.opts.minVolume) continue;

      const mid = last > 0 ? last : (bid + ask) / 2;
      const spreadPct = ((ask - bid) / bid) * 100;
      if (spreadPct > this.opts.maxSpreadPercent) continue;

      out.push({
        exchange,
        price: mid,
        bid,
        ask,
        volume,
        timestamp,
      });
    }

    return out;
  }

  private calculateRouteCost(args: {
    exchange: string;
    tradingPair: string;
    quantity: number;
    basePrice: number;
    side: 'buy' | 'sell';
    isMaker: boolean;
    userVolume30Day: number;
    userId?: string;
    dataAgeMs: number;
  }): RouteCost | null {
    const {
      exchange,
      tradingPair,
      quantity,
      basePrice,
      side,
      isMaker,
      userVolume30Day,
      userId,
      dataAgeMs,
    } = args;

    const notional = quantity * basePrice;
    const slipRate = this.slippageRate(notional);
    // Buy: pay more; Sell: receive less
    const executionPrice =
      side === 'buy' ? basePrice * (1 + slipRate) : basePrice * (1 - slipRate);
    const slippageAmount = Math.abs(executionPrice - basePrice);

    const resolvedFees = this.feeService.resolveFees(
      exchange,
      tradingPair,
      side,
      { isMaker, userVolume30Day, userId }
    );
    if (!resolvedFees) {
      this.warnFeeIssue(
        `unknown:${exchange.toLowerCase()}`,
        `Excluding ${exchange} for ${tradingPair}: exchange fee schedule is unknown`
      );
      return null;
    }
    if (resolvedFees.scheduleStale) {
      this.warnFeeIssue(
        `stale:${exchange.toLowerCase()}`,
        `Using stale ${exchange} fee schedule (${resolvedFees.scheduleAsOf})`
      );
    }

    const gross = quantity * executionPrice;
    const tradeCost = this.feeService.calculateTotalCost(
      gross,
      exchange,
      tradingPair,
      side,
      { isMaker, userVolume30Day, userId }
    );
    if (!tradeCost) {
      this.warnFeeIssue(
        `unresolved:${exchange.toLowerCase()}`,
        `Excluding ${exchange} for ${tradingPair}: unable to resolve trade fees`
      );
      return null;
    }
    const feeStructure = { maker: resolvedFees.maker, taker: resolvedFees.taker };
    const feePaid = tradeCost.fee;
    const totalCost = tradeCost.total;
    const netPrice = totalCost / quantity;

    return {
      exchange,
      side,
      basePrice,
      slippageCalculation: {
        basePrice,
        side,
        slippagePercent: slipRate * 100,
        slippageAmount,
        executionPrice,
      },
      feeStructure,
      feePaid,
      scheduleStale: tradeCost.scheduleStale,
      totalCost,
      netPrice,
      dataAgeMs,
    };
  }

  private slippageRate(notionalUsd: number): number {
    for (const tier of SLIPPAGE_TIERS) {
      if (notionalUsd < tier.maxNotional) return tier.rate;
    }
    return SLIPPAGE_TIERS[SLIPPAGE_TIERS.length - 1].rate;
  }

  private calculateArbitrage(
    tradingPair: string,
    buyExchange: string,
    buyAsk: number,
    sellExchange: string,
    sellBid: number,
    minProfitPercent: number
  ): ArbitrageOpportunity | null {
    if (sellBid <= buyAsk) return null;

    const spread = sellBid - buyAsk;
    const spreadPercent = (spread / buyAsk) * 100;

    const buyFees = this.feeService.resolveFees(buyExchange, tradingPair, 'buy');
    const sellFees = this.feeService.resolveFees(sellExchange, tradingPair, 'sell');
    if (!buyFees || !sellFees) {
      const unknownExchange = !buyFees ? buyExchange : sellExchange;
      this.warnFeeIssue(
        `unknown:${unknownExchange.toLowerCase()}`,
        `Excluding arbitrage ${tradingPair}: fee schedule unknown for ${unknownExchange}`
      );
      return null;
    }
    if (buyFees.scheduleStale || sellFees.scheduleStale) {
      for (const [exchange, stale] of [
        [buyExchange, buyFees.scheduleStale],
        [sellExchange, sellFees.scheduleStale],
      ] as const) {
        if (stale) {
          this.warnFeeIssue(
            `stale:${exchange.toLowerCase()}`,
            `Using stale ${exchange} fee schedule for arbitrage`
          );
        }
      }
    }

    // Per 1 unit of base
    const buyCost = this.feeService.calculateTotalCost(buyAsk, buyExchange, tradingPair, 'buy');
    const sellProceeds = this.feeService.calculateTotalCost(sellBid, sellExchange, tradingPair, 'sell');
    if (!buyCost || !sellProceeds) {
      this.warnFeeIssue(
        'unresolved-arbitrage-fees',
        `Excluding arbitrage ${tradingPair}: fee calculation unavailable`
      );
      return null;
    }
    const profitAfterFees = sellProceeds.total - buyCost.total;
    const profitPercent = (profitAfterFees / buyAsk) * 100;

    if (profitPercent < minProfitPercent) return null;

    return {
      tradingPair,
      buyExchange,
      buyPrice: buyAsk,
      sellExchange,
      sellPrice: sellBid,
      spread,
      spreadPercent,
      profitAfterFees,
      profitPercent,
      isProfitable: true,
      timestamp: Date.now(),
    };
  }

  private warnFeeIssue(key: string, message: string): void {
    if (this.warnedFeeIssues.has(key)) return;
    this.warnedFeeIssues.add(key);
    console.warn(`[SmartRouter] ${message}`);
  }

  private calculateVolatility(prices: TradePrice[]): number {
    if (prices.length < 2) return 0;
    const values = prices.map((p) => p.price);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return (Math.sqrt(variance) / mean) * 100;
  }

  private assessRisk(
    route: OptimalRoute,
    comparison: PriceComparison
  ): 'low' | 'medium' | 'high' {
    let score = 0;
    if (route.costBreakdown.slippage / route.bestPrice > 0.01) score += 2;
    if (comparison.spreadPercent > 1) score += 2;
    if (route.alternatives[0]?.dataAgeMs > this.opts.maxQuoteAgeMs) score += 1;
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}
