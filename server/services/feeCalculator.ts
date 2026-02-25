/**
 * Fee Calculator
 * Comprehensive cost prediction for all withdrawal routing scenarios
 * Estimates gas, bridge fees, slippage, and total costs in USD
 */

import { getMultiChainProvider } from './multiChainProvider';
import { CHAIN_CONFIG, SupportedChain, getBestBridge } from '../../shared/chainConfiguration';
import { Logger } from '../utils/logger';

const logger = new Logger('fee-calculator');

export interface GasEstimate {
  gas: bigint;
  gasUSD: string;
  gasPrice: string;      // In Gwei or native units
  congestionLevel: 'low' | 'medium' | 'high';
  buffer: number;        // Multiplier (1.1 = 10% buffer)
}

export interface BridgeFeeEstimate {
  protocol: string;
  feePercentage: number;
  feeAmount: string;     // In token amount
  feeUSD: string;
  latencySeconds: number;
  minAmount: string;
  maxAmount: string;
}

export interface RoutingCost {
  method: 'direct' | 'bridge' | 'swap_bridge' | 'dex_route';
  
  // Individual cost components (in USD)
  gasSourceChain: string;
  gasTargetChain: string;
  bridgeFee: string;
  swapSlippage?: string;
  
  // Totals
  totalCostUSD: string;
  totalCostPercent: string;    // % of transfer amount
  
  // Timing
  estimatedTimeSeconds: number;
  
  // Details
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  bridgeProtocol?: string;
  recommendation?: string;
}

export interface AllRoutingCosts {
  amount: string;
  sourceChain: SupportedChain;
  targetChain: SupportedChain;
  sourceToken: string;
  targetToken: string;
  
  // All possible routing options
  directTransfer?: RoutingCost;
  bridgeRoute?: RoutingCost;
  swapBridgeRoute?: RoutingCost;
  dexRoute?: RoutingCost;
  
  // Recommendation
  cheapest: RoutingCost;
  fastest: RoutingCost;
  balanced: RoutingCost;
}

interface ChainMetricsCache {
  chain: SupportedChain;
  gasPriceLow: number;
  gasPriceStandard: number;
  gasPriceFast: number;
  tokenPriceUSD: number;
  congestionLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

export class FeeCalculator {
  private metricsCache: Map<SupportedChain, ChainMetricsCache> = new Map();
  private readonly CACHE_TTL = 60 * 1000;  // 1 minute
  private readonly PRICE_API_URLS = {
    coingecko: 'https://api.coingecko.com/api/v3/simple/price',
  };

  /**
   * Estimate gas cost for a native token transfer on a chain
   */
  async estimateNativeTransferGas(chain: SupportedChain): Promise<GasEstimate> {
    try {
      const config = CHAIN_CONFIG[chain];
      if (!config) throw new Error(`Unknown chain: ${chain}`);

      const provider = getMultiChainProvider();
      const feeData = await provider.getFeeData(chain);
      
      // Standard native transfer is 21,000 gas
      const baseGas = BigInt(21000);
      const gasPrice = feeData.gasPrice || BigInt(0);
      
      // Get dynamic buffer based on congestion
      const buffer = await this.getDynamicGasBuffer(chain);
      const bufferedGas = baseGas * BigInt(Math.ceil(buffer * 100)) / BigInt(100);
      
      // Calculate cost in native token
      const gasFeeWei = gasPrice * bufferedGas;
      
      // Get native token price
      const tokenPrice = await this.getTokenPrice(config.nativeToken);
      const gasUSD = (Number(gasFeeWei) / 1e18 * tokenPrice).toFixed(6);
      
      // Get congestion level
      const congestion = await this.getNetworkCongestion(chain);
      
      return {
        gas: bufferedGas,
        gasUSD,
        gasPrice: (Number(gasPrice) / 1e9).toFixed(2), // In Gwei
        congestionLevel: congestion,
        buffer,
      };
    } catch (error) {
      logger.warn(`Failed to estimate gas for ${chain}: ${(error as any).message}, using defaults`);
      const config = CHAIN_CONFIG[chain];
      return {
        gas: BigInt(21000),
        gasUSD: config!.gas.estimatedCostUSD.native.toString(),
        gasPrice: config!.gas.standard.toString(),
        congestionLevel: 'medium',
        buffer: 1.15,
      };
    }
  }

  /**
   * Estimate gas cost for ERC20 transfer (higher than native)
   */
  async estimateERC20TransferGas(chain: SupportedChain): Promise<GasEstimate> {
    try {
      const config = CHAIN_CONFIG[chain];
      if (!config) throw new Error(`Unknown chain: ${chain}`);

      const provider = getMultiChainProvider();
      const feeData = await provider.getFeeData(chain);
      
      // ERC20 transfer is ~65,000 gas
      const baseGas = BigInt(65000);
      const gasPrice = feeData.gasPrice || BigInt(0);
      
      // Get dynamic buffer
      const buffer = await this.getDynamicGasBuffer(chain);
      const bufferedGas = baseGas * BigInt(Math.ceil(buffer * 100)) / BigInt(100);
      
      // Calculate cost
      const gasFeeWei = gasPrice * bufferedGas;
      const tokenPrice = await this.getTokenPrice(config.nativeToken);
      const gasUSD = (Number(gasFeeWei) / 1e18 * tokenPrice).toFixed(6);
      
      const congestion = await this.getNetworkCongestion(chain);
      
      return {
        gas: bufferedGas,
        gasUSD,
        gasPrice: (Number(gasPrice) / 1e9).toFixed(2),
        congestionLevel: congestion,
        buffer,
      };
    } catch (error) {
      logger.warn(`Failed to estimate ERC20 gas for ${chain}: ${(error as any).message}`);
      const config = CHAIN_CONFIG[chain];
      return {
        gas: BigInt(65000),
        gasUSD: config!.gas.estimatedCostUSD.erc20.toString(),
        gasPrice: config!.gas.standard.toString(),
        congestionLevel: 'medium',
        buffer: 1.15,
      };
    }
  }

  /**
   * Estimate bridge fees
   */
  async estimateBridgeFees(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    amount: string,
    priority: 'cost' | 'speed' = 'cost'
  ): Promise<BridgeFeeEstimate | null> {
    try {
      const bestBridge = getBestBridge(sourceChain, targetChain, priority);
      if (!bestBridge) return null;

      const amountNum = parseFloat(amount);
      const feeAmount = (amountNum * bestBridge.feePercentage / 100).toFixed(6);
      
      // Get token price for USD conversion
      const tokenPrice = await this.getTokenPrice('USDC'); // Assuming USDC for bridge estimates
      const feeUSD = (parseFloat(feeAmount) * tokenPrice).toFixed(6);
      
      return {
        protocol: bestBridge.protocol,
        feePercentage: bestBridge.feePercentage,
        feeAmount,
        feeUSD,
        latencySeconds: bestBridge.estimatedLatency,
        minAmount: bestBridge.minAmount,
        maxAmount: bestBridge.maxAmount,
      };
    } catch (error) {
      logger.warn(`Failed to estimate bridge fees: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Calculate total cost for direct transfer (same token, same chain)
   */
  async calculateDirectTransferCost(
    chain: SupportedChain,
    amount: string,
    isNativeToken: boolean = false
  ): Promise<RoutingCost | null> {
    try {
      const gasEstimate = isNativeToken
        ? await this.estimateNativeTransferGas(chain)
        : await this.estimateERC20TransferGas(chain);

      const totalCostUSD = gasEstimate.gasUSD;
      const amountNum = parseFloat(amount) || 1;
      const costPercent = ((parseFloat(totalCostUSD) / amountNum) * 100).toFixed(4);

      return {
        method: 'direct',
        gasSourceChain: gasEstimate.gasUSD,
        gasTargetChain: '0',
        bridgeFee: '0',
        totalCostUSD,
        totalCostPercent: costPercent,
        estimatedTimeSeconds: CHAIN_CONFIG[chain]!.blockTime * CHAIN_CONFIG[chain]!.requiredConfirmations,
        sourceChain: chain,
        targetChain: chain,
        recommendation: `Direct transfer on ${chain}. Fastest and cheapest.`,
      };
    } catch (error) {
      logger.error(`Failed to calculate direct transfer cost: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Calculate cost for bridge transfer (same token, different chains)
   */
  async calculateBridgeTransferCost(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    amount: string,
    token: string = 'USDC'
  ): Promise<RoutingCost | null> {
    try {
      // Gas on source chain
      const sourceGasEstimate = await this.estimateERC20TransferGas(sourceChain);
      
      // Gas on target chain (for finalization if needed)
      const targetGasEstimate = await this.estimateNativeTransferGas(targetChain);
      
      // Bridge fees
      const bridgeEstimate = await this.estimateBridgeFees(sourceChain, targetChain, amount, 'cost');
      if (!bridgeEstimate) return null;

      const totalCostUSD = (
        parseFloat(sourceGasEstimate.gasUSD) +
        parseFloat(targetGasEstimate.gasUSD) +
        parseFloat(bridgeEstimate.feeUSD)
      ).toFixed(6);

      const amountNum = parseFloat(amount) || 1;
      const costPercent = ((parseFloat(totalCostUSD) / amountNum) * 100).toFixed(4);

      return {
        method: 'bridge',
        gasSourceChain: sourceGasEstimate.gasUSD,
        gasTargetChain: targetGasEstimate.gasUSD,
        bridgeFee: bridgeEstimate.feeUSD,
        totalCostUSD,
        totalCostPercent: costPercent,
        estimatedTimeSeconds: bridgeEstimate.latencySeconds + 60, // Include some buffer
        sourceChain,
        targetChain,
        bridgeProtocol: bridgeEstimate.protocol,
        recommendation: `Bridge via ${bridgeEstimate.protocol} (${bridgeEstimate.latencySeconds}s latency)`,
      };
    } catch (error) {
      logger.error(`Failed to calculate bridge transfer cost: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Calculate cost for swap + bridge (token mismatch)
   */
  async calculateSwapBridgeCost(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    sourceToken: string,
    targetToken: string,
    amount: string
  ): Promise<RoutingCost | null> {
    try {
      // Estimate swap slippage (assume 0.3% for DEX + 0.1% impact for amount)
      const swapSlippagePercent = 0.4;
      const swapSlippageAmountNum = parseFloat(amount) * swapSlippagePercent / 100;
      const targetTokenPrice = await this.getTokenPrice(targetToken);
      const swapSlippageUSD = (swapSlippageAmountNum * targetTokenPrice).toFixed(6);
      
      // Swap gas on source chain
      const swapGas = await this.estimateERC20TransferGas(sourceChain);
      
      // Bridge fees (for bridged amount after swap)
      const bridgedAmount = (parseFloat(amount) * (1 - swapSlippagePercent / 100)).toFixed(6);
      const bridgeEstimate = await this.estimateBridgeFees(sourceChain, targetChain, bridgedAmount, 'cost');
      
      // Gas on target chain
      const targetGas = await this.estimateNativeTransferGas(targetChain);
      
      const totalCostUSD = (
        parseFloat(swapGas.gasUSD || '0') +
        parseFloat(swapSlippageUSD || '0') +
        parseFloat((bridgeEstimate?.feeUSD) || '0') +
        parseFloat(targetGas.gasUSD || '0')
      ).toFixed(6);

      const amountNum = parseFloat(amount) || 1;
      const costPercent = ((parseFloat(totalCostUSD) / amountNum) * 100).toFixed(4);

      return {
        method: 'swap_bridge',
        gasSourceChain: swapGas.gasUSD,
        gasTargetChain: targetGas.gasUSD,
        bridgeFee: bridgeEstimate?.feeUSD || '0',
        swapSlippage: swapSlippageUSD,
        totalCostUSD,
        totalCostPercent: costPercent,
        estimatedTimeSeconds: 300 + (bridgeEstimate?.latencySeconds || 300) + 60,
        sourceChain,
        targetChain,
        bridgeProtocol: bridgeEstimate?.protocol,
        recommendation: `Swap ${sourceToken}→${targetToken}, then bridge via ${bridgeEstimate?.protocol || 'auto'}`,
      };
    } catch (error) {
      logger.error(`Failed to calculate swap+bridge cost: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Calculate all possible routing options and recommend best
   */
  async calculateAllRoutingOptions(
    sourceChain: SupportedChain,
    targetChain: SupportedChain,
    amount: string,
    sourceToken: string = 'USDC',
    targetToken: string = 'USDC'
  ): Promise<AllRoutingCosts> {
    const results: AllRoutingCosts = {
      amount,
      sourceChain,
      targetChain,
      sourceToken,
      targetToken,
      cheapest: {} as RoutingCost,
      fastest: {} as RoutingCost,
      balanced: {} as RoutingCost,
    };

    // Calculate all routing options
    if (sourceChain === targetChain && sourceToken === targetToken) {
      // Direct transfer possible
      const direct = await this.calculateDirectTransferCost(sourceChain, amount, sourceToken === CHAIN_CONFIG[sourceChain]?.nativeToken);
      if (direct) results.directTransfer = direct;
    } else if (sourceToken === targetToken) {
      // Bridge transfer possible
      const bridge = await this.calculateBridgeTransferCost(sourceChain, targetChain, amount, sourceToken);
      if (bridge) results.bridgeRoute = bridge;
    }

    // Swap + Bridge always possible
    const swapBridge = await this.calculateSwapBridgeCost(sourceChain, targetChain, sourceToken, targetToken, amount);
    if (swapBridge) results.swapBridgeRoute = swapBridge;

    // Determine recommendations
    const allOptions = [results.directTransfer, results.bridgeRoute, results.swapBridgeRoute, results.dexRoute].filter((x): x is RoutingCost => x !== undefined);
    
    if (allOptions.length > 0) {
      // Cheapest
      results.cheapest = allOptions.reduce((min, current) =>
        parseFloat(current.totalCostUSD) < parseFloat(min.totalCostUSD) ? current : min
      );

      // Fastest
      results.fastest = allOptions.reduce((min, current) =>
        current.estimatedTimeSeconds < min.estimatedTimeSeconds ? current : min
      );

      // Balanced (lowest cost + time combined)
      results.balanced = allOptions.reduce((best, current) => {
        const currentScore = parseFloat(current.totalCostUSD) + (current.estimatedTimeSeconds / 60); // weighted
        const bestScore = parseFloat(best.totalCostUSD) + (best.estimatedTimeSeconds / 60);
        return currentScore < bestScore ? current : best;
      });
    }

    return results;
  }

  /**
   * Get dynamic gas buffer based on network congestion
   */
  private async getDynamicGasBuffer(chain: SupportedChain): Promise<number> {
    try {
      const congestion = await this.getNetworkCongestion(chain);
      
      switch (congestion) {
        case 'low':
          return 1.1;    // 10% buffer
        case 'medium':
          return 1.2;    // 20% buffer
        case 'high':
          return 1.3;    // 30% buffer
        default:
          return 1.15;   // Default 15%
      }
    } catch {
      return 1.15;
    }
  }

  /**
   * Get network congestion level
   */
  private async getNetworkCongestion(chain: SupportedChain): Promise<'low' | 'medium' | 'high'> {
    try {
      const provider = getMultiChainProvider();
      const block = await provider.getBlock(chain, 'latest');
      
      if (!block) return 'medium';
      
      // Simple heuristic: if block gas used is > 80% of gas limit, congestion is high
      const gasUsageRatio = Number(block.gasUsed) / Number(block.gasLimit);
      
      if (gasUsageRatio > 0.8) return 'high';
      if (gasUsageRatio > 0.5) return 'medium';
      return 'low';
    } catch {
      return 'medium';
    }
  }

  /**
   * Get token price in USD
   */
  private async getTokenPrice(token: string): Promise<number> {
    try {
      // Simple cache check
      const cached = this.priceCache.get(token);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.price;
      }

      // Map token to CoinGecko ID
      const coinGeckoId = this.mapTokenToCoinGeckoId(token);
      
      const response = await fetch(
        `${this.PRICE_API_URLS.coingecko}?ids=${coinGeckoId}&vs_currencies=usd`
      );

      if (!response.ok) throw new Error(`Failed to fetch price: ${response.statusText}`);
      
      const data = await response.json() as Record<string, { usd: number }>;
      const price = data[coinGeckoId]?.usd || 1;
      
      // Cache the price
      this.priceCache.set(token, { price, timestamp: Date.now() });
      
      return price;
    } catch (error) {
      logger.warn(`Failed to get price for ${token}: ${(error as any).message}, using 1.0`);
      return 1;
    }
  }

  private priceCache = new Map<string, { price: number; timestamp: number }>();

  /**
   * Map token symbol to CoinGecko ID
   */
  private mapTokenToCoinGeckoId(token: string): string {
    const mapping: Record<string, string> = {
      ETH: 'ethereum',
      BTC: 'bitcoin',
      USDC: 'usd-coin',
      USDT: 'tether',
      cUSD: 'celo-dollar',
      CELO: 'celo',
      MATIC: 'matic-network',
      BNB: 'binancecoin',
      AVAX: 'avalanche-2',
      TRX: 'tron',
    };

    return mapping[token] || token.toLowerCase();
  }
}

/**
 * Singleton instance
 */
let instance: FeeCalculator | null = null;

export function initializeFeeCalculator(): FeeCalculator {
  if (!instance) {
    instance = new FeeCalculator();
  }
  return instance;
}

export function getFeeCalculator(): FeeCalculator {
  if (!instance) {
    instance = new FeeCalculator();
  }
  return instance;
}
