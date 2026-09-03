
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

interface GasPrice {
  // EIP-1559 fields: raw base and priority, without tier-specific multipliers
  baseFee: string; // base fee per gas (wei)
  priorityFee?: string; // suggested priority fee (wei), may be undefined on legacy chains
  timestamp: number;
  // Tier suggestions (for reference/fallback only)
  // Built inside getOptimalGasStrategy, not here
}

interface GasStrategy {
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

// Fee strategies in basis points (1 bps = 0.01%)
const FEE_STRATEGIES: Record<string, { maxFeeMultiplierBps: number; priorityMultiplierBps: number; replacementBumpPct?: number; fallbackGweiPerChain?: number }> = {
  ethereum: { maxFeeMultiplierBps: 120, priorityMultiplierBps: 150, replacementBumpPct: 10, fallbackGweiPerChain: 1 },
  polygon: { maxFeeMultiplierBps: 150, priorityMultiplierBps: 200, replacementBumpPct: 20, fallbackGweiPerChain: 50 },
  arbitrum: { maxFeeMultiplierBps: 110, priorityMultiplierBps: 120, replacementBumpPct: 8, fallbackGweiPerChain: 1 },
  optimism: { maxFeeMultiplierBps: 115, priorityMultiplierBps: 125, replacementBumpPct: 10, fallbackGweiPerChain: 1 },
  bsc: { maxFeeMultiplierBps: 105, priorityMultiplierBps: 100, replacementBumpPct: 5, fallbackGweiPerChain: 1 },
  base: { maxFeeMultiplierBps: 110, priorityMultiplierBps: 120, replacementBumpPct: 8, fallbackGweiPerChain: 1 },
  avalanche: { maxFeeMultiplierBps: 110, priorityMultiplierBps: 120, replacementBumpPct: 8, fallbackGweiPerChain: 2 },
  celo: { maxFeeMultiplierBps: 115, priorityMultiplierBps: 130, replacementBumpPct: 10, fallbackGweiPerChain: 5 }
};

export class GasPriceOracle {
  private cached: Map<string, { prices: GasPrice; expiry: number }> = new Map();
  private readonly DEFAULT_CACHE_MS = 30 * 1000;

  // Get current gas prices for a specific provider + chain
  // Returns: baseFee + priorityFee only. Tier scaling happens in getOptimalGasStrategy.
  async getCurrentGasPrices(provider: any, chain: string): Promise<GasPrice> {
    const now = Date.now();
    const cacheKey = chain || 'default';
    const cached = this.cached.get(cacheKey);
    if (cached && now < cached.expiry) return cached.prices;

    try {
      // Always use getFeeData (ethers v6 only supports EIP-1559)
      const feeData = await provider.getFeeData();
      
      // Prefer baseFee from latest block when available
      let baseFee: bigint | undefined;
      try {
        const block = await provider.getBlock('latest');
        baseFee = block?.baseFeePerGas as bigint | undefined;
      } catch (e) {
        // If block fetch fails, estimate from feeData.maxFeePerGas - maxPriorityFeePerGas
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          baseFee = BigInt(feeData.maxFeePerGas) - BigInt(feeData.maxPriorityFeePerGas);
          if (baseFee < 0n) baseFee = BigInt(feeData.maxFeePerGas);
        }
      }

      // If we have both baseFee and priorityFee, use EIP-1559 path
      if (baseFee && feeData.maxPriorityFeePerGas) {
        const priorityFee = BigInt(feeData.maxPriorityFeePerGas);
        const prices: GasPrice = {
          baseFee: baseFee.toString(),
          priorityFee: priorityFee.toString(),
          timestamp: now
        };
        this.cached.set(cacheKey, { prices, expiry: now + this.DEFAULT_CACHE_MS });
        return prices;
      }

      // Fallback: use feeData.gasPrice if available (legacy or estimated)
      if (feeData.gasPrice) {
        const gasPrice = BigInt(feeData.gasPrice);
        const prices: GasPrice = {
          baseFee: gasPrice.toString(),
          timestamp: now
        };
        this.cached.set(cacheKey, { prices, expiry: now + this.DEFAULT_CACHE_MS });
        return prices;
      }

      // Total fallback: use chain-specific default
      const strategy = FEE_STRATEGIES[chain] || { maxFeeMultiplierBps: 120, priorityMultiplierBps: 150, fallbackGweiPerChain: 1 };
      const fallbackGwei = strategy.fallbackGweiPerChain || 1;
      const fallbackWei = BigInt(fallbackGwei * 1_000_000_000);
      logger.warn('All gas price sources failed, using chain fallback', { chain, fallbackGwei });
      const prices: GasPrice = {
        baseFee: fallbackWei.toString(),
        timestamp: now
      };
      this.cached.set(cacheKey, { prices, expiry: now + (this.DEFAULT_CACHE_MS / 2) });
      return prices;
    } catch (err: any) {
      logger.warn('Gas price fetch failed, returning conservative defaults', { chain, error: err?.message });
      const strategy = FEE_STRATEGIES[chain] || { maxFeeMultiplierBps: 120, priorityMultiplierBps: 150, fallbackGweiPerChain: 2 };
      const fallbackGwei = strategy.fallbackGweiPerChain || 2;
      const fallbackWei = BigInt(fallbackGwei * 1_000_000_000);
      const prices: GasPrice = {
        baseFee: fallbackWei.toString(),
        timestamp: now
      };
      this.cached.set(cacheKey, { prices, expiry: now + (this.DEFAULT_CACHE_MS / 2) });
      return prices;
    }
  }

  // Compute optimal gas strategy with chain-specific scaling
  // Urgency levels determine the multiplier applied to baseFee + priorityFee
  async getOptimalGasStrategy(provider: any, chain: string, urgency: 'slow' | 'standard' | 'fast' | 'instant' = 'standard'): Promise<GasStrategy> {
    const strategy = FEE_STRATEGIES[chain] || { maxFeeMultiplierBps: 120, priorityMultiplierBps: 150, replacementBumpPct: 10 };
    const prices = await this.getCurrentGasPrices(provider, chain);
    const baseFee = BigInt(prices.baseFee);

    // Tier-specific fee multipliers (in basis points, no longer stored in prices object)
    const tierMultipliersBps: Record<string, { maxFeeBps: number; priorityBps: number }> = {
      slow: { maxFeeBps: 110, priorityBps: 100 },        // base * 1.1, minimal tip
      standard: { maxFeeBps: strategy.maxFeeMultiplierBps, priorityBps: strategy.priorityMultiplierBps },
      fast: { maxFeeBps: 150, priorityBps: 200 },
      instant: { maxFeeBps: 200, priorityBps: 300 }
    };

    const tierMultipliers = tierMultipliersBps[urgency] || tierMultipliersBps.standard;

    // For EIP-1559:
    // maxFeePerGas = baseFee + (priorityFee * multiplier)
    // maxPriorityFeePerGas = priorityFee * multiplier
    if (prices.priorityFee) {
      const priorityFee = BigInt(prices.priorityFee);
      
      // Calculate maxFeePerGas without double-counting:
      // scale the priority, then add base
      const scaledPriority = priorityFee * BigInt(tierMultipliers.priorityBps) / BigInt(10000);
      const maxFeePerGas = baseFee + scaledPriority;

      return {
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: scaledPriority.toString()
      };
    }

    // Legacy (no priorityFee available): scale baseFee directly
    const scaledGasPrice = baseFee * BigInt(tierMultipliers.maxFeeBps) / BigInt(10000);
    return { gasPrice: scaledGasPrice.toString() };
  }

  // Provide a replacement price to bump a stuck transaction by a percentage
  async getReplacementPrice(provider: any, chain: string, currentGasPrice: bigint | string, bumpPct?: number): Promise<string> {
    const strategy = FEE_STRATEGIES[chain] || { maxFeeMultiplierBps: 120, priorityMultiplierBps: 150, replacementBumpPct: 10 };
    const bump = bumpPct ?? strategy.replacementBumpPct ?? 10;
    const current = typeof currentGasPrice === 'string' ? BigInt(currentGasPrice) : currentGasPrice;

    // Fetch latest standard strategy to avoid underbidding
    const standardStrat = await this.getOptimalGasStrategy(provider, chain, 'standard');
    const latest = BigInt(standardStrat.maxFeePerGas || standardStrat.gasPrice || '0');
    if (latest === 0n) return current.toString(); // Fallback
    const bumped = latest > current ? latest + (latest * BigInt(bump) / BigInt(100)) : current + (current * BigInt(bump) / BigInt(100));
    return bumped.toString();
  }

  clearCache(chain?: string) {
    if (chain) this.cached.delete(chain);
    else this.cached.clear();
  }
}

export const gasPriceOracle = new GasPriceOracle();
