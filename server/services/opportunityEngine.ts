/**
 * Opportunity Engine Service
 * 
 * Real-time scanning for DEX/CEX arbitrage opportunities
 * Monitors multiple chains and exchanges simultaneously
 * Broadcasts profitable opportunities via WebSocket
 */

import { logger } from '../utils/logger';
import { findProfitableSymbols, findArbitrageOpportunities, ArbitrageOpportunity } from './arbitrageDetection';
import { dexService } from './dexIntegrationService';
import { orderRouter } from './orderRouter';
import { TokenRegistry } from '../../shared/tokenRegistry';
import pLimit from 'p-limit';
import NodeCache from 'node-cache';

/**
 * Type Definitions
 */
export interface OpportunityData {
  id: string;
  type: 'arbitrage' | 'dex-spread' | 'emerging-token';
  symbol: string;
  chain?: string;
  profitPercent: number;
  profitAmount?: number;
  venue1: string;
  venue2: string;
  price1: number;
  price2: number;
  volume: number;
  risk: 'low' | 'medium' | 'high' | 'very_high';
  timestamp: number;
  confidence: number; // 0-100
  executionRecommendation?: {
    venue: 'dex' | 'cex';
    dex?: string;
    exchange?: string;
    estimatedOutput: number;
  };
}

export interface ScanResult {
  timestamp: number;
  opportunities: OpportunityData[];
  totalScanned: number;
  profitableFound: number;
}

/**
 * Opportunity Engine - Continuous scanning service
 */
class OpportunityEngineService {
  private isScanning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private opportunityCache = new NodeCache({ stdTTL: 300 }); // 5-minute cache
  private opportunityCallbacks: Set<(data: OpportunityData[]) => void> = new Set();
  private readonly limiter = pLimit(3); // Limit concurrent scans

  // Configuration
  private readonly SCAN_INTERVALS = {
    HIGH_PROFIT: 15000,     // 15 seconds for high profit (>5%)
    MEDIUM_PROFIT: 30000,   // 30 seconds for medium (2-5%)
    LOW_PROFIT: 60000,      // 60 seconds for low (<2%)
    EMERGING: 120000        // 120 seconds for emerging tokens
  };

  private readonly SYMBOLS_TO_SCAN = [
    'CELO', 'USDC', 'USDT', 'ETH', 'BTC', 'DAI', 'cUSD', 'cEUR',
    'MATIC', 'AAVE', 'LINK', 'UNI', 'SUSHI'
  ];

  private readonly EXCHANGES = [
    'binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'
  ];

  private readonly CHAINS = [
    'ethereum', 'polygon', 'arbitrum', 'optimism', 'celo'
  ];

  private currentSymbolIndex = 0; // For round-robin scanning

  constructor() {
    logger.info('OpportunityEngine initialized');
  }

  /**
   * Start continuous opportunity scanning
   * @param quickInterval Interval in milliseconds (default 30s to avoid rate limiting)
   */
  async startScanning(quickInterval: number = 30000): Promise<void> {
    if (this.isScanning) {
      logger.warn('Opportunity scanning already in progress');
      return;
    }

    this.isScanning = true;
    logger.info(`🔍 Starting opportunity engine with ${quickInterval}ms interval (smart rate limiting enabled)`);

    // Initial scan
    await this.performScan();

    // Set continuous scanning
    this.scanInterval = setInterval(async () => {
      try {
        await this.performScan();
      } catch (error) {
        logger.error('Error in opportunity scan loop:', error);
      }
    }, quickInterval);
  }

  /**
   * Stop scanning
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    logger.info('Opportunity scanning stopped');
  }

  /**
   * Perform single scan cycle
   */
  private async performScan(): Promise<ScanResult> {
    const startTime = Date.now();
    const opportunities: OpportunityData[] = [];

    try {
      // Rotate to next symbol set for round-robin scanning
      this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.SYMBOLS_TO_SCAN.length;

      logger.debug(`[Scan] Cycle starting (symbol index: ${this.currentSymbolIndex})`);

      // Rotate through three different scan types
      const scanType = this.currentSymbolIndex % 3;

      if (scanType === 0) {
        // CEX scan - find profitable opportunities across exchanges
        logger.debug(`[Scan] Running CEX arbitrage scan`);
        const cexResults = await this.limiter(() => this.scanCEXArbitrage());
        if (cexResults && cexResults.length > 0) {
          opportunities.push(...cexResults);
        }
      } else if (scanType === 1) {
        // DEX scan - find spreads across chains
        logger.debug(`[Scan] Running DEX spread scan`);
        const dexResults = await this.limiter(() => this.scanDEXSpreads());
        if (dexResults && dexResults.length > 0) {
          opportunities.push(...dexResults);
        }
      } else {
        // Emerging token scan - find new opportunities on supported tokens
        logger.debug(`[Scan] Running emerging token scan`);
        const emergingResults = await this.limiter(() => this.scanEmergingTokens());
        if (emergingResults && emergingResults.length > 0) {
          opportunities.push(...emergingResults);
        }
      }

      // Filter and sort by profitability
      const filtered = opportunities
        .filter(opp => opp.profitPercent >= 0.5) // Minimum 0.5% profit
        .sort((a, b) => b.profitPercent - a.profitPercent);

      // Broadcast to listeners
      if (filtered.length > 0) {
        this.broadcastOpportunities(filtered);
      }

      const elapsed = Date.now() - startTime;
      logger.debug(
        `[Scan] Complete: ${opportunities.length} total, ${filtered.length} profitable in ${elapsed}ms`
      );

      return {
        timestamp: Date.now(),
        opportunities: filtered,
        totalScanned: Math.ceil(this.SYMBOLS_TO_SCAN.length / 3) * Math.ceil(this.EXCHANGES.length / 2),
        profitableFound: filtered.length
      };
    } catch (error) {
      logger.error('[Scan] Error during opportunity scan:', error);
      return {
        timestamp: Date.now(),
        opportunities: [],
        totalScanned: 0,
        profitableFound: 0
      };
    }
  }

  /**
   * Scan CEX arbitrage opportunities
   * Uses round-robin to reduce API calls per cycle
   */
  private async scanCEXArbitrage(): Promise<OpportunityData[]> {
    try {
      const opportunities: OpportunityData[] = [];

      // Round-robin: scan only 3-4 symbols per cycle to avoid rate limiting
      const symbolsToCheck = this.getRotatedSymbols(3);
      logger.debug(`[CexScan] Checking ${symbolsToCheck.length} symbols across ${this.EXCHANGES.length} exchanges`);

      // Scan symbols sequentially to reduce concurrent API calls
      for (const symbol of symbolsToCheck) {
        try {
          const arbs = await findArbitrageOpportunities(symbol, this.EXCHANGES.slice(0, 4), 0.5);
          if (arbs && arbs.length > 0) {
            for (const arb of arbs) {
              // Add smart routing recommendation
              const routing = await orderRouter.comparePrices(
                symbol,
                arb.volume,
                'sell'
              );

              const opportunity: OpportunityData = {
                id: `cex-${symbol}-${arb.buyExchange}-${arb.sellExchange}-${Date.now()}`,
                type: 'arbitrage',
                symbol,
                profitPercent: arb.netProfitPercent,
                profitAmount: arb.netProfit,
                venue1: arb.buyExchange,
                venue2: arb.sellExchange,
                price1: arb.buyPrice,
                price2: arb.sellPrice,
                volume: arb.volume,
                risk: arb.risk,
                timestamp: arb.timestamp,
                confidence: this.calculateConfidence(arb),
                executionRecommendation: routing ? {
                  venue: 'cex',
                  exchange: routing.recommendedVenue || routing.recommendations[0]?.venue,
                  estimatedOutput: arb.netProfit
                } : undefined
              };

              opportunities.push(opportunity);
            }
          }
        } catch (error) {
          logger.warn(`[CexScan] Failed to scan ${symbol}:`, error);
        }
      }

      return opportunities;
    } catch (error) {
      logger.error('[CexScan] Error scanning CEX arbitrage:', error);
      return [];
    }
  }

  /**
   * Scan DEX spreads across chains
   * Uses round-robin to reduce API calls per cycle
   */
  private async scanDEXSpreads(): Promise<OpportunityData[]> {
    try {
      const opportunities: OpportunityData[] = [];

      // Round-robin: scan only 2-3 symbols per cycle to avoid rate limiting
      const symbolsToCheck = this.getRotatedSymbols(2);
      const chainsToCheck = this.getRotatedChains(1); // Only 1 chain per cycle

      logger.debug(`[DexScan] Checking ${symbolsToCheck.length} symbols on ${chainsToCheck.length} chains`);

      for (const chain of chainsToCheck) {
        try {
          for (const symbol of symbolsToCheck) {
            const dexOpp = await this.checkDEXOpportunity(symbol, chain);
            if (dexOpp) {
              opportunities.push(dexOpp);
            }
          }
        } catch (error) {
          logger.warn(`[DexScan] Error scanning DEX on ${chain}:`, error);
        }
      }

      return opportunities;
    } catch (error) {
      logger.error('[DexScan] Error scanning DEX spreads:', error);
      return [];
    }
  }

  /**
   * Get rotated set of symbols (for round-robin scanning)
   */
  private getRotatedSymbols(count: number): string[] {
    const symbols = this.SYMBOLS_TO_SCAN;
    const rotated: string[] = [];
    for (let i = 0; i < count; i++) {
      rotated.push(symbols[(this.currentSymbolIndex + i) % symbols.length]);
    }
    return rotated;
  }

  /**
   * Get rotated set of chains (for round-robin scanning)
   */
  private getRotatedChains(count: number): string[] {
    const chains = this.CHAINS;
    const rotated: string[] = [];
    for (let i = 0; i < count; i++) {
      rotated.push(chains[(this.currentSymbolIndex + i) % chains.length]);
    }
    return rotated;
  }

  /**
   * Check single DEX opportunity
   */
  private async checkDEXOpportunity(symbol: string, chain: string): Promise<OpportunityData | null> {
    try {
      const stablecoins = ['USDC', 'USDT', 'DAI', 'cUSD'];
      const counterAsset = stablecoins[0];

      // Get quotes from different DEXes on same chain
      const quote1 = await dexService.getSwapQuote(symbol, counterAsset, 100, undefined, chain);
      const quote2 = await dexService.getSwapQuote(symbol, counterAsset, 100, undefined, chain);

      if (!quote1 || !quote2 || quote1.exchangeRate === quote2.exchangeRate) {
        return null;
      }

      const spread = Math.abs(quote1.exchangeRate - quote2.exchangeRate) / quote2.exchangeRate * 100;

      if (spread < 0.5) {
        return null;
      }

      return {
        id: `dex-${symbol}-${chain}-${Date.now()}`,
        type: 'dex-spread',
        symbol,
        chain,
        profitPercent: spread,
        venue1: quote1.dex,
        venue2: quote2.dex,
        price1: quote1.exchangeRate,
        price2: quote2.exchangeRate,
        volume: 100,
        risk: spread > 2 ? 'low' : 'medium',
        timestamp: Date.now(),
        confidence: 75
      };
    } catch (error) {
      // Silent fail - expected for some chains/symbols
      return null;
    }
  }

  /**
   * Scan for emerging tokens with liquidity
   * Uses TokenRegistry to identify supported tokens and findProfitableSymbols for opportunities
   */
  private async scanEmergingTokens(): Promise<OpportunityData[]> {
    try {
      const opportunities: OpportunityData[] = [];

      // Get all tokens and filter for emerging ones
      const allTokens = TokenRegistry.getAllTokens();
      const emergingTokens = allTokens
        .filter((token: { emerging?: boolean; riskLevel?: string }) => 
          token.emerging === true || token.riskLevel === 'low'
        )
        .map((token: { symbol: string }) => token.symbol)
        .slice(0, 20); // Increased from 5 to 20 tokens per scan cycle for better coverage

      if (emergingTokens.length === 0) {
        logger.debug('[EmergingScan] No emerging tokens to scan');
        return [];
      }

      logger.debug(`[EmergingScan] Scanning ${emergingTokens.length} emerging tokens`);

      // Use findProfitableSymbols to find arbitrage opportunities
      const profitable = await findProfitableSymbols(
        emergingTokens,
        this.EXCHANGES.slice(0, 4), // Use subset to reduce load
        0.3 // Lower threshold (0.3%) for emerging tokens
      );

      for (const item of profitable) {
        const arb = item.bestOpportunity;
        opportunities.push({
          id: `emerging-${item.symbol}-${Date.now()}`,
          type: 'emerging-token',
          symbol: item.symbol,
          profitPercent: arb.netProfitPercent,
          profitAmount: arb.netProfit,
          venue1: arb.buyExchange,
          venue2: arb.sellExchange,
          price1: arb.buyPrice,
          price2: arb.sellPrice,
          volume: arb.volume,
          risk: arb.risk,
          timestamp: arb.timestamp,
          confidence: this.calculateConfidence(arb)
        });
      }

      logger.debug(`[EmergingScan] Found ${opportunities.length} emerging token opportunities`);
      return opportunities;
    } catch (error) {
      logger.warn('[EmergingScan] Error scanning emerging tokens:', error);
      // Return empty array - don't fail the entire scan
      return [];
    }
  }
  private calculateConfidence(arb: ArbitrageOpportunity): number {
    let confidence = 100;

    // Reduce confidence based on risk
    if (arb.risk === 'medium') confidence -= 10;
    if (arb.risk === 'high') confidence -= 25;
    if (arb.risk === 'very_high') confidence -= 40;

    // Reduce based on volume score
    if (arb.volumeScore === 'good') confidence -= 5;
    if (arb.volumeScore === 'fair') confidence -= 15;
    if (arb.volumeScore === 'poor') confidence -= 30;

    // Base confidence on profit percent (capped at 100)
    confidence = Math.max(confidence, Math.min(100, 50 + (arb.netProfitPercent * 5)));

    // Reduce if profit is very high (too good to be true)
    if (arb.netProfitPercent > 10) confidence -= 20;

    return Math.max(30, Math.min(100, confidence));
  }

  /**
   * Register callback for opportunity updates
   */
  onOpportunitiesFound(callback: (data: OpportunityData[]) => void): void {
    this.opportunityCallbacks.add(callback);
  }

  /**
   * Remove callback
   */
  offOpportunitiesFound(callback: (data: OpportunityData[]) => void): void {
    this.opportunityCallbacks.delete(callback);
  }

  /**
   * Broadcast opportunities to all listeners
   */
  private broadcastOpportunities(opportunities: OpportunityData[]): void {
    for (const callback of this.opportunityCallbacks) {
      try {
        callback(opportunities);
      } catch (error) {
        logger.error('Error in opportunity callback:', error);
      }
    }
  }

  /**
   * Get scanning status
   */
  getStatus(): {
    isScanning: boolean;
    cacheSize: number;
    listenerCount: number;
  } {
    return {
      isScanning: this.isScanning,
      cacheSize: Object.keys(this.opportunityCache.getStats()).length,
      listenerCount: this.opportunityCallbacks.size
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.opportunityCache.flushAll();
    logger.info('Opportunity cache cleared');
  }
}

// Export singleton
export const opportunityEngine = new OpportunityEngineService();
