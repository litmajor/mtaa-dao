/**
 * Exchange Fee Service
 * Manages trading fees for different exchanges and trading pairs
 * 
 * Features:
 * - Per-exchange fee structures
 * - Maker/taker distinction
 * - Volume-based tier discounts
 * - Fee caching
 * - Stablecoin-specific rates
 */

export interface FeeStructure {
  maker: number; // Maker fee (percentage)
  taker: number; // Taker fee (percentage)
  withdrawal?: number; // Network withdrawal fee
  deposit?: number; // Deposit fee
}

export interface VolumeTier {
  volumeThreshold: number; // USD 30-day volume threshold
  maker: number; // Maker fee at this tier
  taker: number; // Taker fee at this tier
}

export interface ExchangeFeeInfo {
  exchange: string;
  baseStructure: FeeStructure;
  volumeTiers: VolumeTier[];
  stablecoinPairs: FeeStructure; // Lower fees for stablecoin trades
}

/**
 * Exchange fee data (typical as of 2026)
 * Based on public fee schedules from major exchanges
 */
const EXCHANGE_FEES: Record<string, ExchangeFeeInfo> = {
  binance: {
    exchange: 'binance',
    baseStructure: {
      maker: 0.001, // 0.1%
      taker: 0.001, // 0.1%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.001, taker: 0.001 },
      { volumeThreshold: 50000, maker: 0.0009, taker: 0.001 },
      { volumeThreshold: 500000, maker: 0.0008, taker: 0.001 },
      { volumeThreshold: 5000000, maker: 0.0007, taker: 0.0998 },
      { volumeThreshold: 50000000, maker: 0.0006, taker: 0.0995 },
    ],
    stablecoinPairs: {
      maker: 0.0001, // 0.01%
      taker: 0.0001, // 0.01%
    },
  },
  kraken: {
    exchange: 'kraken',
    baseStructure: {
      maker: 0.0016, // 0.16%
      taker: 0.0026, // 0.26%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0016, taker: 0.0026 },
      { volumeThreshold: 50000, maker: 0.0014, taker: 0.0024 },
      { volumeThreshold: 250000, maker: 0.0012, taker: 0.0022 },
      { volumeThreshold: 1000000, maker: 0.001, taker: 0.002 },
      { volumeThreshold: 5000000, maker: 0.0008, taker: 0.0018 },
    ],
    stablecoinPairs: {
      maker: 0.0002, // 0.02%
      taker: 0.0004, // 0.04%
    },
  },
  coinbase: {
    exchange: 'coinbase',
    baseStructure: {
      maker: 0.004, // 0.4%
      taker: 0.006, // 0.6%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.004, taker: 0.006 },
      { volumeThreshold: 100000, maker: 0.003, taker: 0.005 },
      { volumeThreshold: 1000000, maker: 0.0025, taker: 0.0045 },
      { volumeThreshold: 10000000, maker: 0.002, taker: 0.003 },
    ],
    stablecoinPairs: {
      maker: 0.0005, // 0.05%
      taker: 0.001, // 0.1%
    },
  },
  bybit: {
    exchange: 'bybit',
    baseStructure: {
      maker: 0.0001, // 0.01%
      taker: 0.0001, // 0.01%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0001, taker: 0.0001 },
      { volumeThreshold: 1000000, maker: 0.00008, taker: 0.0001 },
      { volumeThreshold: 10000000, maker: 0.00007, taker: 0.0001 },
    ],
    stablecoinPairs: {
      maker: 0.00001, // 0.001%
      taker: 0.00001, // 0.001%
    },
  },
  kucoin: {
    exchange: 'kucoin',
    baseStructure: {
      maker: 0.001, // 0.1%
      taker: 0.0015, // 0.15%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.001, taker: 0.0015 },
      { volumeThreshold: 100000, maker: 0.0008, taker: 0.0013 },
      { volumeThreshold: 1000000, maker: 0.0006, taker: 0.0011 },
      { volumeThreshold: 10000000, maker: 0.0004, taker: 0.0009 },
    ],
    stablecoinPairs: {
      maker: 0.0001, // 0.01%
      taker: 0.0002, // 0.02%
    },
  },
  okx: {
    exchange: 'okx',
    baseStructure: {
      maker: 0.0002, // 0.02%
      taker: 0.0003, // 0.03%
    },
    volumeTiers: [
      { volumeThreshold: 0, maker: 0.0002, taker: 0.0003 },
      { volumeThreshold: 500000, maker: 0.00015, taker: 0.00025 },
      { volumeThreshold: 5000000, maker: 0.0001, taker: 0.0002 },
      { volumeThreshold: 50000000, maker: 0.00005, taker: 0.00015 },
    ],
    stablecoinPairs: {
      maker: 0.00001, // 0.001%
      taker: 0.00002, // 0.002%
    },
  },
};

/**
 * Service for managing exchange fees
 */
export class ExchangeFeeService {
  private static instance: ExchangeFeeService;
  private userVolumes: Map<string, number> = new Map(); // userId -> 30-day volume

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ExchangeFeeService {
    if (!ExchangeFeeService.instance) {
      ExchangeFeeService.instance = new ExchangeFeeService();
    }
    return ExchangeFeeService.instance;
  }

  /**
   * Get fee structure for exchange and pair
   */
  getFeeStructure(exchange: string, tradingPair: string): FeeStructure {
    const feeInfo = EXCHANGE_FEES[exchange.toLowerCase()];
    if (!feeInfo) {
      // Default if exchange not found
      return { maker: 0.002, taker: 0.002 };
    }

    // Check if stablecoin pair (USDT, USDC, DAI, etc.)
    if (this.isStablecoinPair(tradingPair)) {
      return feeInfo.stablecoinPairs;
    }

    return feeInfo.baseStructure;
  }

  /**
   * Get fee structure with volume discounts
   */
  getFeeStructureWithVolume(
    exchange: string,
    tradingPair: string,
    userVolume30Day: number
  ): FeeStructure {
    const feeInfo = EXCHANGE_FEES[exchange.toLowerCase()];
    if (!feeInfo) {
      return { maker: 0.002, taker: 0.002 };
    }

    // Check if stablecoin pair
    if (this.isStablecoinPair(tradingPair)) {
      return feeInfo.stablecoinPairs;
    }

    // Find applicable tier based on volume
    let applicableTier = feeInfo.baseStructure;
    for (const tier of feeInfo.volumeTiers) {
      if (userVolume30Day >= tier.volumeThreshold) {
        applicableTier = {
          maker: tier.maker,
          taker: tier.taker,
        };
      } else {
        break;
      }
    }

    return applicableTier;
  }

  /**
   * Calculate fee amount
   */
  calculateFee(
    baseAmount: number,
    feePercentage: number
  ): number {
    return baseAmount * feePercentage;
  }

  /**
   * Calculate total cost including fees
   */
  calculateTotalCost(
    baseAmount: number,
    exchange: string,
    tradingPair: string,
    isMaker: boolean = false,
    userVolume30Day: number = 0
  ): { amount: number; fee: number; total: number } {
    const feeStructure = this.getFeeStructureWithVolume(
      exchange,
      tradingPair,
      userVolume30Day
    );
    const feePercentage = isMaker ? feeStructure.maker : feeStructure.taker;
    const fee = this.calculateFee(baseAmount, feePercentage);

    return {
      amount: baseAmount,
      fee,
      total: baseAmount + fee,
    };
  }

  /**
   * Get all exchanges with their base fees
   */
  getExchangeFeeSummary(): Record<string, FeeStructure> {
    const summary: Record<string, FeeStructure> = {};
    for (const [key, info] of Object.entries(EXCHANGE_FEES)) {
      summary[key] = info.baseStructure;
    }
    return summary;
  }

  /**
   * Get fee comparison for a pair across all exchanges
   */
  getFeeComparison(
    tradingPair: string,
    isMaker: boolean = false,
    userVolume30Day: number = 0
  ): Array<{ exchange: string; maker: number; taker: number; applied: number }> {
    const comparison = [];

    for (const [exchange, feeInfo] of Object.entries(EXCHANGE_FEES)) {
      const structure = this.getFeeStructureWithVolume(
        exchange,
        tradingPair,
        userVolume30Day
      );

      comparison.push({
        exchange,
        maker: structure.maker,
        taker: structure.taker,
        applied: isMaker ? structure.maker : structure.taker,
      });
    }

    // Sort by applied fee (ascending)
    return comparison.sort((a, b) => a.applied - b.applied);
  }

  /**
   * Set user's 30-day trading volume
   */
  setUserVolume(userId: string, volume: number): void {
    this.userVolumes.set(userId, volume);
  }

  /**
   * Get user's cached volume
   */
  getUserVolume(userId: string): number {
    return this.userVolumes.get(userId) || 0;
  }

  /**
   * Check if pair is a stablecoin pair
   */
  private isStablecoinPair(tradingPair: string): boolean {
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
    const [, quote] = tradingPair.split('/');
    return stablecoins.includes(quote?.toUpperCase() || '');
  }

  /**
   * Get supported exchanges
   */
  getSupportedExchanges(): string[] {
    return Object.keys(EXCHANGE_FEES);
  }
}
