
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

interface GasPrice {
  slow: string;
  standard: string;
  fast: string;
  instant: string;
  baseFee?: string;
  priorityFee?: string;
  timestamp: number;
}

interface GasStrategy {
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

const FEE_STRATEGIES: Record<string, { multiplier: number; priority: number; replacementBumpPct?: number }> = {
  ethereum: { multiplier: 1.2, priority: 1.5, replacementBumpPct: 10 },
  polygon: { multiplier: 1.5, priority: 2.0, replacementBumpPct: 20 },
  arbitrum: { multiplier: 1.1, priority: 1.2, replacementBumpPct: 8 },
  optimism: { multiplier: 1.15, priority: 1.25, replacementBumpPct: 10 },
  bsc: { multiplier: 1.05, priority: 1.0, replacementBumpPct: 5 },
  base: { multiplier: 1.1, priority: 1.2, replacementBumpPct: 8 },
  avalanche: { multiplier: 1.1, priority: 1.2, replacementBumpPct: 8 }
};

export class GasPriceOracle {
  private cached: Map<string, { prices: GasPrice; expiry: number }> = new Map();
  private readonly DEFAULT_CACHE_MS = 30 * 1000;

  // Get current gas prices for a specific provider + chain
  async getCurrentGasPrices(provider: any, chain: string): Promise<GasPrice> {
    const now = Date.now();
    const cacheKey = chain || 'default';
    const cached = this.cached.get(cacheKey);
    if (cached && now < cached.expiry) return cached.prices;

    try {
      // Prefer EIP-1559 fee data when available
      const feeData = await provider.getFeeData();
      let baseFee: bigint | undefined;
      let priorityFee: bigint | undefined;
      try {
        const block = await provider.getBlock('latest');
        baseFee = block?.baseFeePerGas as bigint | undefined;
      } catch (e) {
        // ignore
      }

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && baseFee) {
        priorityFee = feeData.maxPriorityFeePerGas as bigint;
        const base = baseFee as bigint;
        const prices: GasPrice = {
          slow: (base * BigInt(110) / BigInt(100)).toString(),
          standard: (base * BigInt(120) / BigInt(100) + priorityFee).toString(),
          fast: (base * BigInt(150) / BigInt(100) + priorityFee * BigInt(2)).toString(),
          instant: (base * BigInt(200) / BigInt(100) + priorityFee * BigInt(3)).toString(),
          baseFee: base.toString(),
          priorityFee: priorityFee.toString(),
          timestamp: now
        };
        this.cached.set(cacheKey, { prices, expiry: now + this.DEFAULT_CACHE_MS });
        return prices;
      }

      // Legacy gasPrice fallback
      const gasPrice = await provider.getGasPrice();
      const prices: GasPrice = {
        slow: (gasPrice * BigInt(90) / BigInt(100)).toString(),
        standard: gasPrice.toString(),
        fast: (gasPrice * BigInt(120) / BigInt(100)).toString(),
        instant: (gasPrice * BigInt(150) / BigInt(100)).toString(),
        timestamp: now
      };

      this.cached.set(cacheKey, { prices, expiry: now + this.DEFAULT_CACHE_MS });
      return prices;
    } catch (err: any) {
      logger.warn('Gas price fetch failed, returning conservative defaults', { chain, error: err?.message });
      const fallback = BigInt(2_000_000_000); // 2 Gwei
      const prices: GasPrice = {
        slow: (fallback * BigInt(80) / BigInt(100)).toString(),
        standard: fallback.toString(),
        fast: (fallback * BigInt(120) / BigInt(100)).toString(),
        instant: (fallback * BigInt(150) / BigInt(100)).toString(),
        timestamp: now
      };
      this.cached.set(cacheKey, { prices, expiry: now + (this.DEFAULT_CACHE_MS / 2) });
      return prices;
    }
  }

  // Compute optimal gas strategy with chain-specific scaling
  async getOptimalGasStrategy(provider: any, chain: string, urgency: 'slow' | 'standard' | 'fast' | 'instant' = 'standard'): Promise<GasStrategy> {
    const strategy = FEE_STRATEGIES[chain] || { multiplier: 1.2, priority: 1.5, replacementBumpPct: 10 };
    const prices = await this.getCurrentGasPrices(provider, chain);

    // Selected base price
    const selected = BigInt(prices[urgency]);
    const scaled = selected * BigInt(Math.floor(strategy.multiplier * 100)) / BigInt(100);

    if (prices.baseFee && prices.priorityFee) {
      const priority = BigInt(prices.priorityFee);
      return {
        maxFeePerGas: scaled.toString(),
        maxPriorityFeePerGas: (priority * BigInt(Math.floor(strategy.priority * 100)) / BigInt(100)).toString()
      };
    }

    return { gasPrice: scaled.toString() };
  }

  // Provide a replacement price to bump a stuck transaction by a percentage
  async getReplacementPrice(provider: any, chain: string, currentGasPrice: bigint | string, bumpPct?: number): Promise<string> {
    const strategy = FEE_STRATEGIES[chain] || { multiplier: 1.2, priority: 1.5, replacementBumpPct: 10 };
    const bump = bumpPct ?? strategy.replacementBumpPct ?? 10;
    const current = typeof currentGasPrice === 'string' ? BigInt(currentGasPrice) : currentGasPrice;

    // Fetch latest standard price to avoid underbidding
    const latest = await this.getCurrentGasPrices(provider, chain).then(p => BigInt(p.standard));
    const bumped = latest > current ? latest + (latest * BigInt(bump) / BigInt(100)) : current + (current * BigInt(bump) / BigInt(100));
    return bumped.toString();
  }

  clearCache(chain?: string) {
    if (chain) this.cached.delete(chain);
    else this.cached.clear();
  }
}

export const gasPriceOracle = new GasPriceOracle();
