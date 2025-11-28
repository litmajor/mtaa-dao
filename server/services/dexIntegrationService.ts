import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { tokenService } from './tokenService';
import { TokenRegistry } from '../../shared/tokenRegistry';

/**
 * DEX Integration Service
 * Framework for executing real asset swaps on decentralized exchanges
 * Phase 4: Full integration with real on-chain swaps via Ubeswap
 */

interface SwapQuote {
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  estimatedAmountOut: number;
  exchangeRate: number;
  priceImpact: number; // percentage
  estimatedGas: number;
  dex: string;
}

interface SwapResult {
  success: boolean;
  transactionHash?: string;
  amountOut?: number;
  actualRate?: number;
  gasUsed?: number;
  error?: string;
}

// Ubeswap Router ABI for Celo
const UBESWAP_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactCELOForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactCELO(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
];

class DEXIntegrationService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  // DEX Router addresses on Celo
  private readonly DEX_ROUTERS = {
    ubeswap: '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121', // Celo Ubeswap Router
  };

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize blockchain provider
   */
  private initializeProvider(): void {
    try {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        logger.warn('RPC_URL not configured, DEX integration disabled');
        return;
      }

      // Use tokenService provider which is already configured
      this.provider = tokenService.provider;
      this.wallet = tokenService.signer || null;
      
      if (this.wallet) {
        logger.info('✅ DEX service initialized with wallet integration');
      } else {
        logger.info('⚠️ DEX service initialized without wallet (read-only mode)');
      }
    } catch (error) {
      logger.error('Error initializing DEX provider:', error);
      this.provider = null;
    }
  }

  /**
   * Get a quote for swapping assets
   */
  async getSwapQuote(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    preferredDex: string = 'ubeswap'
  ): Promise<SwapQuote | null> {
    try {
      // Get current prices from Gateway Agent (primary) or fallback to priceOracle
      let fromPrice, toPrice;

      try {
        const { getGatewayAgentService } = await import('../core/agents/gateway/service');
        const gatewayService = getGatewayAgentService();

        if (gatewayService.isHealthy()) {
          const priceRequest = await gatewayService.requestPrices([fromAsset, toAsset], ['celo']);
          const prices = priceRequest?.payload?.data || [];

          fromPrice = prices.find((p: any) => p.asset?.symbol === fromAsset);
          toPrice = prices.find((p: any) => p.asset?.symbol === toAsset);

          logger.info(`📊 Gateway prices: ${fromAsset}=$${fromPrice?.value}, ${toAsset}=$${toPrice?.value}`);
        }
      } catch (gatewayError) {
        logger.warn('Gateway unavailable, using fallback price oracle');
      }

      // Fallback to priceOracle if Gateway fails
      if (!fromPrice || !toPrice) {
        const prices = await priceOracle.getPrices([fromAsset, toAsset]);
        fromPrice = prices.get(fromAsset);
        toPrice = prices.get(toAsset);
      }

      if (!fromPrice || !toPrice) {
        logger.warn(`Price data not available for ${fromAsset} or ${toAsset}`);
        return null;
      }

      // Use Gateway value format or fallback format
      const fromPriceValue = fromPrice.value || fromPrice.priceUsd;
      const toPriceValue = toPrice.value || toPrice.priceUsd;

      // Calculate estimated output based on current market prices
      const fromValueUsd = amountIn * fromPriceValue;
      const estimatedAmountOut = fromValueUsd / toPriceValue;

      // Calculate exchange rate
      const exchangeRate = toPriceValue / fromPriceValue;

      // Estimate price impact (simplified - in reality, this depends on liquidity)
      const volume = fromPrice.metadata?.volume24h || fromPrice.volume24h || 1000000;
      const priceImpact = DEXIntegrationService.estimatePriceImpact(amountIn * fromPriceValue, volume);

      // Estimate gas (average for Celo)
      const estimatedGas = 0.001; // ~0.001 CELO

      return {
        fromAsset,
        toAsset,
        amountIn,
        estimatedAmountOut: estimatedAmountOut * (1 - priceImpact), // Account for slippage
        exchangeRate,
        priceImpact: priceImpact * 100, // Convert to percentage
        estimatedGas,
        dex: preferredDex,
      };
    } catch (error) {
      logger.error('Error getting swap quote:', error);
      return null;
    }
  }

  /**
   * Execute a real swap on-chain
   */
  async executeSwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    slippageTolerance: number = 0.5,
    dex: string = 'ubeswap'
  ): Promise<SwapResult> {
    try {
      // Get quote first
      const quote = await this.getSwapQuote(fromAsset, toAsset, amountIn, dex);
      if (!quote) {
        return {
          success: false,
          error: 'Unable to get swap quote',
        };
      }

      // Check if price impact is too high
      if (quote.priceImpact > 5) {
        return {
          success: false,
          error: `Price impact too high: ${quote.priceImpact.toFixed(2)}%`,
        };
      }

      // Execute real swap on-chain
      if (!this.wallet || !this.provider) {
        logger.warn('⚠️ No wallet configured, cannot execute real swap');
        return {
          success: false,
          error: 'No wallet configured for swap execution',
        };
      }

      try {
        logger.info(`🔄 Executing real swap: ${amountIn} ${fromAsset} → ${toAsset}`);
        logger.info(`   DEX: ${dex}, Estimated output: ${quote.estimatedAmountOut.toFixed(6)}`);
        
        return await this.executeRealSwap(quote, slippageTolerance, dex);
      } catch (error) {
        logger.error('❌ Real swap execution failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Swap execution failed',
        };
      }
    } catch (error) {
      logger.error('Error executing swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute real swap via Ubeswap router
   */
  private async executeRealSwap(
    quote: SwapQuote,
    slippageTolerance: number,
    dex: string
  ): Promise<SwapResult> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }

    try {
      // Get router address
      const routerAddress = this.DEX_ROUTERS[dex as keyof typeof this.DEX_ROUTERS];
      if (!routerAddress) {
        throw new Error(`Unknown DEX: ${dex}`);
      }

      // Create router contract
      const router = new ethers.Contract(routerAddress, UBESWAP_ROUTER_ABI, this.wallet);

      // Get token addresses
      const network = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
      const fromToken = TokenRegistry.getToken(quote.fromAsset);
      const toToken = TokenRegistry.getToken(quote.toAsset);

      if (!fromToken || !toToken) {
        throw new Error(`Token not found in registry: ${quote.fromAsset} or ${quote.toAsset}`);
      }

      const fromAddress = fromToken.address[network];
      const toAddress = toToken.address[network];

      if (!fromAddress || !toAddress) {
        throw new Error(`Token address not configured for network: ${network}`);
      }

      logger.info(`Token addresses: ${quote.fromAsset} = ${fromAddress}, ${quote.toAsset} = ${toAddress}`);

      // Approve token spending
      logger.info(`📝 Approving ${quote.fromAsset} for spending...`);
      const approvalTx = await tokenService.approveToken(
        quote.fromAsset,
        routerAddress,
        quote.amountIn.toString()
      );
      logger.info(`✅ Approval tx: ${approvalTx}`);

      // Prepare swap parameters
      const amountIn = ethers.parseUnits(quote.amountIn.toString(), fromToken.decimals);
      const estimatedOut = ethers.parseUnits(quote.estimatedAmountOut.toString(), toToken.decimals);
      
      // Calculate minimum output with slippage tolerance
      const slippageDecimal = slippageTolerance / 100;
      const amountOutMin = estimatedOut * BigInt(Math.floor((1 - slippageDecimal) * 10000)) / BigInt(10000);

      const path = [fromAddress, toAddress];
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now

      logger.info(`Swap params: amountIn=${ethers.formatUnits(amountIn, fromToken.decimals)} ${quote.fromAsset}, ` +
                  `amountOutMin=${ethers.formatUnits(amountOutMin, toToken.decimals)} ${quote.toAsset}`);

      // Execute swap
      logger.info(`🚀 Executing swap on ${dex}...`);
      const swapTx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        this.wallet.address,
        deadline,
        {
          gasLimit: 500000, // Reasonable gas limit for swap
          maxFeePerGas: undefined, // Let ethers estimate
          maxPriorityFeePerGas: undefined
        }
      );

      logger.info(`⏳ Swap transaction submitted: ${swapTx.hash}`);
      
      // Wait for confirmation
      const receipt = await swapTx.wait(2); // Wait for 2 confirmations

      if (!receipt) {
        throw new Error('Transaction failed - no receipt');
      }

      logger.info(`✅ Swap completed! Hash: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        amountOut: quote.estimatedAmountOut,
        actualRate: quote.exchangeRate,
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) / 1e18 : undefined,
      };
    } catch (error) {
      logger.error('DEX swap failed:', error);
      throw error;
    }
  }

  /**
   * Simulate swap (fallback when wallet not configured)
   */
  private async simulateSwap(quote: SwapQuote, dex: string): Promise<SwapResult> {
    const simulatedTxHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    return {
      success: true,
      transactionHash: simulatedTxHash,
      amountOut: quote.estimatedAmountOut,
      actualRate: quote.exchangeRate,
      gasUsed: quote.estimatedGas,
    };
  }

  /**
   * Execute multiple swaps (for rebalancing)
   */
  async executeMultipleSwaps(
    swaps: Array<{
      fromAsset: string;
      toAsset: string;
      amount: number;
    }>
  ): Promise<Array<SwapResult>> {
    const results: SwapResult[] = [];

    for (const swap of swaps) {
      const result = await this.executeSwap(
        swap.fromAsset,
        swap.toAsset,
        swap.amount
      );
      results.push(result);

      // Add small delay between swaps to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Estimate price impact based on trade size and liquidity
   */
  static estimatePriceImpact(tradeSize: number, volume24h: number): number {
    if (volume24h === 0) return 0.05; // Default 5% if no volume data

    // Simplified price impact calculation
    // In reality, this depends on the specific liquidity pool
    const tradeSizeUsd = tradeSize; // Assuming USD value
    const impactFactor = tradeSizeUsd / volume24h;

    // Price impact increases non-linearly with trade size
    return Math.min(impactFactor * 100, 0.10); // Cap at 10%
  }

  /**
   * Get best route for a swap across multiple DEXes
   */
  async getBestRoute(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapQuote | null> {
    try {
      // Get quotes from multiple DEXes
      const quotes: SwapQuote[] = [];

      for (const dex of Object.keys(this.DEX_ROUTERS)) {
        const quote = await this.getSwapQuote(fromAsset, toAsset, amountIn, dex);
        if (quote) {
          quotes.push(quote);
        }
      }

      if (quotes.length === 0) return null;

      // Return the quote with the best output (accounting for gas)
      return quotes.reduce((best, current) => {
        const bestNet = best.estimatedAmountOut - (best.estimatedGas * 1000); // Convert gas to USD
        const currentNet = current.estimatedAmountOut - (current.estimatedGas * 1000);
        return currentNet > bestNet ? current : best;
      });
    } catch (error) {
      logger.error('Error getting best route:', error);
      return null;
    }
  }

  /**
   * Check if DEX integration is available
   */
  isAvailable(): boolean {
    return this.provider !== null;
  }

  /**
   * Get supported DEXes
   */
  getSupportedDEXes(): string[] {
    return Object.keys(this.DEX_ROUTERS);
  }
}

export const dexService = new DEXIntegrationService();

// Export types for use in other modules
export type { SwapQuote, SwapResult };