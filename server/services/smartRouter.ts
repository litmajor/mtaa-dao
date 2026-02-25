/**
 * Smart Router Service
 * Calculates optimal trading routes across exchanges
 * 
 * Features:
 * - Multi-exchange price comparison
 * - Slippage calculation
 * - Fee factoring
 * - Route optimization
 * - Best execution guarantee
 */

import { CEXPriceBackgroundJob } from './cexPriceBackgroundJob';
import { ExchangeFeeService, FeeStructure } from './exchangeFeeService';

export interface TradePrice {
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

export interface SlippageCalculation {
  basePrice: number;
  slippagePercent: number;
  slippageAmount: number;
  executionPrice: number;
}

export interface RouteCost {
  exchange: string;
  basePrice: number;
  slippageCalculation: SlippageCalculation;
  feeStructure: FeeStructure;
  makerFee: number;
  takerFee: number;
  totalCost: number;
  netPrice: number; // Price paid including all fees
  profitability: number; // Positive = profitable vs best market price
}

export interface OptimalRoute {
  tradingPair: string;
  amount: number;
  bestExchange: string;
  bestPrice: number;
  totalCost: number;
  netPrice: number; // Final price per unit including slippage + fees
  costBreakdown: {
    basePrice: number;
    slippage: number;
    fees: number;
  };
  alternatives: RouteCost[];
  savings: number; // vs worst option
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
  isProfitable: boolean;
  timestamp: number;
}

/**
 * Smart routing engine for optimal trade execution
 */
export class SmartRouter {
  private priceJob: CEXPriceBackgroundJob;
  private feeService: ExchangeFeeService;
  private static instance: SmartRouter;

  // Slippage configuration (as percentage)
  private readonly SLIPPAGE_RATES = {
    low: 0.001,      // 0.1% for < $10k
    medium: 0.005,   // 0.5% for $10k-$100k
    high: 0.01,      // 1% for > $100k
    veryHigh: 0.02,  // 2% for > $1M
  };

  private constructor() {
    this.priceJob = CEXPriceBackgroundJob.getInstance();
    this.feeService = ExchangeFeeService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SmartRouter {
    if (!SmartRouter.instance) {
      SmartRouter.instance = new SmartRouter();
    }
    return SmartRouter.instance;
  }

  /**
   * Calculate optimal route for a trade
   */
  async calculateOptimalRoute(
    tradingPair: string,
    amount: number,
    isMaker: boolean = false,
    userVolume30Day: number = 0
  ): Promise<OptimalRoute> {
    const collector = this.priceJob.getCollector();
    const prices = await collector.getPairPrices(tradingPair);

    if (prices.size === 0) {
      throw new Error(`No prices available for ${tradingPair}`);
    }

    // Convert map to array and calculate costs
    const routeCosts: RouteCost[] = [];

    for (const [exchange, priceData] of prices) {
      const cost = this.calculateRouteCost(
        exchange,
        tradingPair,
        amount,
        priceData.price,
        isMaker,
        userVolume30Day
      );
      routeCosts.push(cost);
    }

    // Sort by net price (ascending = best deal)
    routeCosts.sort((a, b) => a.netPrice - b.netPrice);

    const bestRoute = routeCosts[0];
    const worstRoute = routeCosts[routeCosts.length - 1];

    return {
      tradingPair,
      amount,
      bestExchange: bestRoute.exchange,
      bestPrice: bestRoute.basePrice,
      totalCost: bestRoute.totalCost,
      netPrice: bestRoute.netPrice,
      costBreakdown: {
        basePrice: bestRoute.basePrice,
        slippage: bestRoute.slippageCalculation.slippageAmount,
        fees: bestRoute.makerFee + bestRoute.takerFee,
      },
      alternatives: routeCosts,
      savings: worstRoute.totalCost - bestRoute.totalCost,
      timestamp: Date.now(),
    };
  }

  /**
   * Find arbitrage opportunities
   */
  async findArbitrageOpportunities(
    tradingPair: string,
    minProfitPercent: number = 0.5
  ): Promise<ArbitrageOpportunity[]> {
    const collector = this.priceJob.getCollector();
    const prices = await collector.getPairPrices(tradingPair);

    if (prices.size < 2) {
      return [];
    }

    const opportunities: ArbitrageOpportunity[] = [];
    const priceArray = Array.from(prices.entries());

    // Compare all exchange pairs
    for (let i = 0; i < priceArray.length; i++) {
      for (let j = i + 1; j < priceArray.length; j++) {
        const [buyExchange, buyPrice] = priceArray[i];
        const [sellExchange, sellPrice] = priceArray[j];

        // Try both directions
        const opp1 = this.calculateArbitrage(
          tradingPair,
          buyExchange,
          buyPrice.price,
          sellExchange,
          sellPrice.price,
          minProfitPercent
        );

        if (opp1) opportunities.push(opp1);

        const opp2 = this.calculateArbitrage(
          tradingPair,
          sellExchange,
          sellPrice.price,
          buyExchange,
          buyPrice.price,
          minProfitPercent
        );

        if (opp2) opportunities.push(opp2);
      }
    }

    // Sort by profit (descending)
    return opportunities.sort((a, b) => b.profitAfterFees - a.profitAfterFees);
  }

  /**
   * Compare prices across all exchanges
   */
  async comparePrices(tradingPair: string): Promise<PriceComparison> {
    const collector = this.priceJob.getCollector();
    const prices = await collector.getPairPrices(tradingPair);

    if (prices.size === 0) {
      throw new Error(`No prices available for ${tradingPair}`);
    }

    const allPrices: TradePrice[] = [];
    let bestBidPrice = 0;
    let bestBidExchange = '';
    let bestAskPrice = Infinity;
    let bestAskExchange = '';

    for (const [exchange, priceData] of prices) {
      allPrices.push({
        exchange,
        price: parseFloat(priceData.price),
        bid: parseFloat(priceData.bid),
        ask: parseFloat(priceData.ask),
        volume: parseFloat(priceData.volume),
        timestamp: priceData.timestamp,
      });

      // Track best bid (highest price to sell at)
      const bid = parseFloat(priceData.bid);
      if (bid > bestBidPrice) {
        bestBidPrice = bid;
        bestBidExchange = exchange;
      }

      // Track best ask (lowest price to buy at)
      const ask = parseFloat(priceData.ask);
      if (ask < bestAskPrice) {
        bestAskPrice = ask;
        bestAskExchange = exchange;
      }
    }

    const spread = bestBidPrice - bestAskPrice;
    const spreadPercent = (spread / bestAskPrice) * 100;

    return {
      tradingPair,
      allPrices: allPrices.sort((a, b) => a.price - b.price),
      bestBid: { exchange: bestBidExchange, price: bestBidPrice },
      bestAsk: { exchange: bestAskExchange, price: bestAskPrice },
      priceSpread: spread,
      spreadPercent,
      timestamp: Date.now(),
    };
  }

  /**
   * Get recommended execution strategy
   */
  async getExecutionStrategy(
    tradingPair: string,
    amount: number,
    side: 'buy' | 'sell'
  ): Promise<any> {
    const route = await this.calculateOptimalRoute(tradingPair, amount);
    const comparison = await this.comparePrices(tradingPair);

    // Analyze market conditions
    const marketTightness = comparison.spreadPercent < 0.1 ? 'tight' : 'loose';
    const recommendedType = marketTightness === 'tight' ? 'maker' : 'taker';

    return {
      tradingPair,
      amount,
      side,
      recommendedExchange: route.bestExchange,
      recommendedPrice: route.bestPrice,
      recommendedOrderType: recommendedType,
      expectedCost: route.totalCost,
      expectedNetPrice: route.netPrice,
      marketConditions: {
        tightness: marketTightness,
        spreadPercent: comparison.spreadPercent,
        volatility: this.calculateVolatility(comparison.allPrices),
      },
      riskLevel: this.assessRisk(route, comparison),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate cost for a specific route
   */
  private calculateRouteCost(
    exchange: string,
    tradingPair: string,
    amount: number,
    basePrice: number,
    isMaker: boolean,
    userVolume30Day: number
  ): RouteCost {
    // Calculate slippage
    const slippage = this.calculateSlippage(amount);
    const slippageAmount = basePrice * slippage;
    const executionPrice = basePrice + slippageAmount;

    // Get fee structure
    const feeStructure = this.feeService.getFeeStructureWithVolume(
      exchange,
      tradingPair,
      userVolume30Day
    );

    const makerFee = amount * feeStructure.maker;
    const takerFee = amount * feeStructure.taker;
    const totalFees = isMaker ? makerFee : takerFee;

    const totalCost = amount * executionPrice + totalFees;
    const netPrice = totalCost / amount; // Price per unit including everything

    return {
      exchange,
      basePrice,
      slippageCalculation: {
        basePrice,
        slippagePercent: slippage * 100,
        slippageAmount,
        executionPrice,
      },
      feeStructure,
      makerFee,
      takerFee,
      totalCost,
      netPrice,
      profitability: basePrice - netPrice, // Negative = cost
    };
  }

  /**
   * Calculate slippage based on order size
   */
  private calculateSlippage(amount: number): number {
    // $1 = 1 unit for simplicity
    if (amount < 10000) return this.SLIPPAGE_RATES.low;
    if (amount < 100000) return this.SLIPPAGE_RATES.medium;
    if (amount < 1000000) return this.SLIPPAGE_RATES.high;
    return this.SLIPPAGE_RATES.veryHigh;
  }

  /**
   * Calculate arbitrage opportunity
   */
  private calculateArbitrage(
    tradingPair: string,
    buyExchange: string,
    buyPrice: number,
    sellExchange: string,
    sellPrice: number,
    minProfitPercent: number
  ): ArbitrageOpportunity | null {
    const spread = sellPrice - buyPrice;
    const spreadPercent = (spread / buyPrice) * 100;

    // Get fees for both exchanges
    const buyFeeStructure = this.feeService.getFeeStructure(buyExchange, tradingPair);
    const sellFeeStructure = this.feeService.getFeeStructure(sellExchange, tradingPair);

    // Calculate fees on $1 trade
    const buyFee = buyPrice * buyFeeStructure.taker;
    const sellFee = sellPrice * sellFeeStructure.taker;
    const totalFees = buyFee + sellFee;

    const profitAfterFees = spread - totalFees;
    const profitPercent = (profitAfterFees / buyPrice) * 100;

    const isProfitable = profitPercent > minProfitPercent;

    if (!isProfitable) return null;

    return {
      tradingPair,
      buyExchange,
      buyPrice,
      sellExchange,
      sellPrice,
      spread,
      spreadPercent,
      profitAfterFees,
      isProfitable,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate volatility from price data
   */
  private calculateVolatility(prices: TradePrice[]): number {
    if (prices.length < 2) return 0;

    const values = prices.map(p => p.price);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b) / values.length;
    const stdDev = Math.sqrt(variance);

    return (stdDev / mean) * 100; // As percentage
  }

  /**
   * Assess risk level of a route
   */
  private assessRisk(route: OptimalRoute, comparison: PriceComparison): string {
    // Risk factors:
    // 1. High slippage > 1%
    // 2. Volatile market (price spread > 1%)
    // 3. Low volume

    let riskScore = 0;

    if (route.costBreakdown.slippage / route.bestPrice > 0.01) riskScore += 2;
    if (comparison.spreadPercent > 1) riskScore += 2;

    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }
}
