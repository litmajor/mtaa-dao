
import { Logger } from '../utils/logger';
import { tokenService } from './tokenService';

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
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice?: string;
}

export class GasPriceOracle {
  private cachedPrices: GasPrice | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly SAFETY_MULTIPLIER = 1.2; // 20% buffer for network spikes

  /**
   * Get current gas prices from the network
   */
  async getCurrentGasPrices(): Promise<GasPrice> {
    const now = Date.now();
    
    // Return cached prices if still valid
    if (this.cachedPrices && now < this.cacheExpiry) {
      return this.cachedPrices;
    }

    try {
      const provider = tokenService.provider;
      
      // Try EIP-1559 pricing first (Celo supports this)
      try {
        const feeData = await provider.getFeeData();
        const block = await provider.getBlock('latest');
        
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && block?.baseFeePerGas) {
          const baseFee = block.baseFeePerGas;
          const priorityFee = feeData.maxPriorityFeePerGas;
          
          this.cachedPrices = {
            slow: (baseFee * BigInt(110) / BigInt(100)).toString(), // 1.1x base
            standard: (baseFee * BigInt(120) / BigInt(100) + priorityFee).toString(), // 1.2x base + priority
            fast: (baseFee * BigInt(150) / BigInt(100) + priorityFee * BigInt(2)).toString(), // 1.5x base + 2x priority
            instant: (baseFee * BigInt(200) / BigInt(100) + priorityFee * BigInt(3)).toString(), // 2x base + 3x priority
            baseFee: baseFee.toString(),
            priorityFee: priorityFee.toString(),
            timestamp: now
          };
        }
      } catch (eip1559Error) {
        logger.warn('EIP-1559 not available, falling back to legacy gas pricing');
      }

      // Fallback to legacy gas pricing
      if (!this.cachedPrices) {
        const gasPrice = await provider.getGasPrice();
        
        this.cachedPrices = {
          slow: (gasPrice * BigInt(90) / BigInt(100)).toString(), // 0.9x
          standard: gasPrice.toString(),
          fast: (gasPrice * BigInt(120) / BigInt(100)).toString(), // 1.2x
          instant: (gasPrice * BigInt(150) / BigInt(100)).toString(), // 1.5x
          timestamp: now
        };
      }

      this.cacheExpiry = now + this.CACHE_DURATION;
      return this.cachedPrices;
      
    } catch (error) {
      logger.error('Failed to fetch gas prices:', error);
      // Return reasonable defaults instead of throwing to keep system operational
      const defaultPrice = BigInt('2000000000'); // 2 Gwei fallback
      this.cachedPrices = {
        slow: (defaultPrice * BigInt(80) / BigInt(100)).toString(),
        standard: defaultPrice.toString(),
        fast: (defaultPrice * BigInt(120) / BigInt(100)).toString(),
        instant: (defaultPrice * BigInt(150) / BigInt(100)).toString(),
        timestamp: now
      };
      this.cacheExpiry = now + (this.CACHE_DURATION / 2); // Shorter cache for fallback
      logger.warn('Using fallback gas prices due to RPC error');
      return this.cachedPrices;
    }
  }

  /**
   * Get optimal gas strategy based on urgency and network conditions
   */
  async getOptimalGasStrategy(urgency: 'slow' | 'standard' | 'fast' | 'instant' = 'standard'): Promise<GasStrategy> {
    const prices = await this.getCurrentGasPrices();
    
    // Apply safety multiplier to prevent transaction failures during spikes
    const selectedPrice = BigInt(prices[urgency]);
    const safePrice = selectedPrice * BigInt(Math.floor(this.SAFETY_MULTIPLIER * 100)) / BigInt(100);

    // EIP-1559 strategy
    if (prices.baseFee && prices.priorityFee) {
      const baseFee = BigInt(prices.baseFee);
      const priorityFee = BigInt(prices.priorityFee);
      
      return {
        maxFeePerGas: safePrice.toString(),
        maxPriorityFeePerGas: (priorityFee * BigInt(Math.floor(this.SAFETY_MULTIPLIER * 100)) / BigInt(100)).toString()
      };
    }

    // Legacy strategy
    return {
      gasPrice: safePrice.toString()
    };
  }

  /**
   * Estimate if current gas prices are high (network congestion)
   */
  async isNetworkCongested(): Promise<boolean> {
    const prices = await this.getCurrentGasPrices();
    const standardPrice = BigInt(prices.standard);
    const slowPrice = BigInt(prices.slow);
    
    // Network is congested if standard is >50% higher than slow
    return standardPrice > (slowPrice * BigInt(150) / BigInt(100));
  }

  /**
   * Get recommended wait time in seconds based on urgency
   */
  async getRecommendedWaitTime(urgency: 'slow' | 'standard' | 'fast' | 'instant'): Promise<number> {
    const isCongested = await this.isNetworkCongested();
    
    const baseWaitTimes = {
      slow: isCongested ? 180 : 120,      // 2-3 minutes
      standard: isCongested ? 90 : 60,    // 1-1.5 minutes
      fast: isCongested ? 45 : 30,        // 30-45 seconds
      instant: isCongested ? 20 : 15      // 15-20 seconds
    };
    
    return baseWaitTimes[urgency];
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedPrices = null;
    this.cacheExpiry = 0;
  }
}

export const gasPriceOracle = new GasPriceOracle();
