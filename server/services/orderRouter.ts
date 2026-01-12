/**
 * Smart Order Router Service
 * 
 * Compares DEX vs CEX prices and recommends optimal execution venue
 * Features:
 * - Price comparison across DEX and multiple CEX
 * - Order splitting for large orders
 * - Slippage and fee calculation
 * - Best execution recommendation
 */

import { ccxtService } from './ccxtService';
import { dexService } from './dexIntegrationService';
import { tokenService } from './tokenService';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

/**
 * Type Definitions
 */
export interface VenueOption {
  venue: 'dex' | 'cex';
  exchange?: string; // Name if CEX
  price: number;
  totalCost: number;
  slippage?: number;
  gasCost?: number;
  fee?: number;
  totalWithCosts: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface RoutingResult {
  symbol: string;
  amount: number;
  side: 'buy' | 'sell';
  recommendations: VenueOption[];
  recommended: 'dex' | 'cex';
  recommendedVenue?: string;
  savings: number;
  savingsPercent: number;
  timestamp: number;
}

export interface OrderSplit {
  venue: 'dex' | 'cex';
  exchange?: string;
  amount: number;
  price: number;
  cost: number;
  percentage: number;
}

export interface SplitRoutingResult {
  symbol: string;
  totalAmount: number;
  splits: OrderSplit[];
  totalCost: number;
  averagePrice: number;
  recommendation: string;
}

export interface LimitOrder {
  id?: string;
  userId: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'canceled' | 'expired';
  filledAmount?: number;
  filledPrice?: number;
  orderId?: string;
  createdAt?: Date;
  expiresAt?: Date;
  filledAt?: Date;
}

class OrderRouter {
  private routingCache = new NodeCache({ stdTTL: 30 }); // 30-second cache for routing decisions

  constructor() {
    logger.info('✅ Order Router Service initialized');
  }

  /**
   * Compare DEX vs CEX prices for a given symbol and amount
   */
  async comparePrices(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    exchanges: string[] = ['binance', 'coinbase', 'kraken']
  ): Promise<RoutingResult> {
    const cacheKey = `routing:${symbol}:${amount}:${side}`;
    const cached = this.routingCache.get<RoutingResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const recommendations: VenueOption[] = [];

      // Get DEX price
      const dexOption = await this.getDEXPrice(symbol, amount, side);
      if (dexOption) {
        recommendations.push(dexOption);
      }

      // Get CEX prices
      const cexOptions = await this.getCEXPrices(symbol, amount, side, exchanges);
      recommendations.push(...cexOptions);

      // Sort by total cost (ascending for buy, descending for sell)
      recommendations.sort((a, b) => {
        return side === 'buy'
          ? a.totalWithCosts - b.totalWithCosts
          : b.totalWithCosts - a.totalWithCosts;
      });

      // Determine best option
      const recommended = recommendations[0];
      const secondBest = recommendations[1] || recommendations[0];

      // Calculate savings
      let savings = 0;
      let savingsPercent = 0;

      if (recommendations.length > 1) {
        savings = Math.abs(recommended.totalWithCosts - secondBest.totalWithCosts);
        savingsPercent = (savings / secondBest.totalWithCosts) * 100;
      }

      const result: RoutingResult = {
        symbol,
        amount,
        side,
        recommendations,
        recommended: recommended.venue,
        recommendedVenue: recommended.exchange,
        savings,
        savingsPercent,
        timestamp: Date.now()
      };

      this.routingCache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      logger.error(`Error comparing prices for ${symbol}:`, error);
      throw new Error(`Failed to compare prices: ${error.message}`);
    }
  }

  /**
   * Get DEX price and cost breakdown
   */
  private async getDEXPrice(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell'
  ): Promise<VenueOption | null> {
    try {
      const quote = await dexService.getSwapQuote(
        side === 'buy' ? 'cUSD' : symbol,
        side === 'buy' ? symbol : 'cUSD',
        amount,
        'ubeswap'
      );

      if (!quote) {
        return null;
      }

      const price = quote.exchangeRate;
      const slippage = (quote.priceImpact / 100) * (amount * price);
      const gasCost = quote.estimatedGas || 2; // Estimated in USD

      const totalCost = amount * price + slippage + gasCost;

      return {
        venue: 'dex',
        price,
        totalCost: amount * price,
        slippage,
        gasCost,
        totalWithCosts: totalCost,
        confidence: 'high',
        reasoning: `Ubeswap DEX with ${quote.priceImpact.toFixed(2)}% slippage`
      };
    } catch (error: any) {
      logger.warn(`Could not get DEX price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get CEX prices from multiple exchanges
   */
  private async getCEXPrices(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell',
    exchanges: string[]
  ): Promise<VenueOption[]> {
    const options: VenueOption[] = [];

    try {
      const prices = await ccxtService.getPricesFromMultipleExchanges(symbol, exchanges);

      for (const [exchange, priceData] of Object.entries(prices)) {
        if (!priceData) continue;

        // Select bid (sell) or ask (buy) price
        const price = side === 'buy' ? priceData.ask : priceData.bid;

        // Calculate fee (0.1% taker fee typical for CEX)
        const takerFee = 0.001;
        const feeAmount = amount * price * takerFee;
        const totalCost = amount * price + feeAmount;

        options.push({
          venue: 'cex',
          exchange,
          price,
          totalCost: amount * price,
          fee: feeAmount,
          totalWithCosts: totalCost,
          confidence: 'high',
          reasoning: `${exchange} with 0.1% taker fee`
        });
      }

      return options;
    } catch (error: any) {
      logger.warn(`Could not get CEX prices:`, error.message);
      return [];
    }
  }

  /**
   * Find the best execution venue
   */
  async findBestExecutionVenue(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy'
  ): Promise<VenueOption | null> {
    try {
      const routing = await this.comparePrices(symbol, amount, side);
      return routing.recommendations[0] || null;
    } catch (error: any) {
      logger.error('Error finding best execution venue:', error);
      return null;
    }
  }

  /**
   * Split order between DEX and CEX for optimal execution
   */
  async splitOrder(
    symbol: string,
    totalAmount: number,
    side: 'buy' | 'sell' = 'buy',
    maxDEXLiquidity: number = 5000 // Max DEX liquidity in units
  ): Promise<SplitRoutingResult> {
    try {
      const routing = await this.comparePrices(symbol, totalAmount, side);

      const splits: OrderSplit[] = [];
      let remainingAmount = totalAmount;

      // Try to use DEX first (usually better pricing for small orders)
      const dexOption = routing.recommendations.find(r => r.venue === 'dex');
      if (dexOption && totalAmount > maxDEXLiquidity) {
        // Split: Use DEX for max liquidity, rest on CEX
        const dexAmount = maxDEXLiquidity;
        splits.push({
          venue: 'dex',
          amount: dexAmount,
          price: dexOption.price,
          cost: dexAmount * dexOption.price + (dexOption.gasCost || 0),
          percentage: (dexAmount / totalAmount) * 100
        });
        remainingAmount = totalAmount - dexAmount;
      } else if (dexOption && totalAmount <= maxDEXLiquidity) {
        // Entire order on DEX
        splits.push({
          venue: 'dex',
          amount: totalAmount,
          price: dexOption.price,
          cost: totalAmount * dexOption.price + (dexOption.gasCost || 0),
          percentage: 100
        });
        remainingAmount = 0;
      }

      // Use best CEX for remaining amount
      const cexOption = routing.recommendations.find(r => r.venue === 'cex');
      if (remainingAmount > 0 && cexOption) {
        splits.push({
          venue: 'cex',
          exchange: cexOption.exchange,
          amount: remainingAmount,
          price: cexOption.price,
          cost: remainingAmount * cexOption.price + (cexOption.fee || 0),
          percentage: (remainingAmount / totalAmount) * 100
        });
      }

      // Calculate totals
      const totalCost = splits.reduce((sum, split) => sum + split.cost, 0);
      const averagePrice = totalCost / totalAmount;

      return {
        symbol,
        totalAmount,
        splits,
        totalCost,
        averagePrice,
        recommendation: splits.length === 1
          ? `Execute entire order on ${splits[0].venue === 'dex' ? 'DEX' : splits[0].exchange}`
          : `Split order: ${splits.map(s => `${s.percentage.toFixed(0)}% on ${s.venue === 'dex' ? 'DEX' : s.exchange}`).join(', ')}`
      };
    } catch (error: any) {
      logger.error('Error splitting order:', error);
      throw error;
    }
  }

  /**
   * Execute optimal swap (simplified - actual execution handled by DEX/CEX services)
   */
  async executeOptimalSwap(
    symbol: string,
    amount: number,
    side: 'buy' | 'sell' = 'buy',
    userPreferences?: {
      preferredVenue?: 'dex' | 'cex';
      preferredExchange?: string;
      maxSlippage?: number;
    }
  ): Promise<any> {
    try {
      const routing = await this.comparePrices(symbol, amount, side);

      // Respect user preference if specified
      let selectedVenue = routing.recommendations[0];
      if (userPreferences?.preferredVenue) {
        selectedVenue =
          routing.recommendations.find(
            r =>
              r.venue === userPreferences.preferredVenue &&
              (userPreferences.preferredVenue === 'cex'
                ? r.exchange === userPreferences.preferredExchange
                : true)
          ) || selectedVenue;
      }

      logger.info(`Executing optimal swap on ${selectedVenue.venue} (${selectedVenue.exchange || 'DEX'})`);

      return {
        venue: selectedVenue.venue,
        exchange: selectedVenue.exchange,
        symbol,
        amount,
        side,
        estimatedPrice: selectedVenue.price,
        estimatedCost: selectedVenue.totalWithCosts,
        reasoning: selectedVenue.reasoning
      };
    } catch (error: any) {
      logger.error('Error executing optimal swap:', error);
      throw error;
    }
  }

  /**
   * Place a persistent limit order on CEX
   */
  async placeLimitOrder(
    userId: string,
    exchange: string,
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    expiresInDays: number = 7
  ): Promise<LimitOrder> {
    try {
      const ccxtOrderResult = await ccxtService.placeLimitOrder(
        exchange,
        symbol,
        side,
        amount,
        price
      );

      const limitOrder: LimitOrder = {
        userId,
        exchange,
        symbol,
        side,
        amount,
        price,
        status: 'pending',
        orderId: ccxtOrderResult.orderId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      };

      logger.info(`Placed limit order: ${exchange} ${side} ${amount} ${symbol} @ ${price}`);
      return limitOrder;
    } catch (error: any) {
      logger.error('Error placing limit order:', error);
      throw error;
    }
  }

  /**
   * Check and update limit order status
   */
  async checkLimitOrderStatus(exchange: string, orderId: string, symbol?: string): Promise<any> {
    try {
      const status = await ccxtService.checkOrderStatus(exchange, orderId, symbol);
      return status;
    } catch (error: any) {
      logger.error('Error checking order status:', error);
      throw error;
    }
  }

  /**
   * Cancel a limit order
   */
  async cancelLimitOrder(exchange: string, orderId: string, symbol?: string): Promise<boolean> {
    try {
      const success = await ccxtService.cancelOrder(exchange, orderId, symbol);
      logger.info(`Cancelled order: ${exchange} ${orderId}`);
      return success;
    } catch (error: any) {
      logger.error('Error canceling order:', error);
      throw error;
    }
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routingCache.flushAll();
    logger.info('Order routing cache cleared');
  }
}

export const orderRouter = new OrderRouter();
