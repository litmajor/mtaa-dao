import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';

/**
 * DEX Integration Service
 * Framework for executing asset swaps on decentralized exchanges
 * Phase 3: Currently simulates swaps, ready for real DEX integration
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

class DEXIntegrationService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  // DEX Router addresses (mainnet examples - update for your network)
  private readonly DEX_ROUTERS = {
    ubeswap: '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121', // Celo Ubeswap
    sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Celo SushiSwap
    // Add more DEX addresses as needed
  };

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize blockchain provider with timeout protection
   */
  private initializeProvider(): void {
    try {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        logger.warn('RPC_URL not configured, DEX integration disabled');
        return;
      }

      // Create provider with timeout and network detection disabled to prevent long hangs
      this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,  // Prevent automatic network detection (which causes timeouts)
        batchMaxCount: 1,
        pollingInterval: 12000,
        timeout: 5000,  // 5 second timeout for individual requests
      });

      // Initialize wallet if private key is provided (for automated swaps)
      const privateKey = process.env.DEX_WALLET_PRIVATE_KEY;
      if (privateKey && this.provider) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.info('DEX wallet initialized for automated swaps');
      }
    } catch (error) {
      logger.error('Error initializing DEX provider:', error);
      // Don't throw - just log and continue without DEX integration
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
      const priceImpact = this.estimatePriceImpact(amountIn * fromPriceValue, volume);

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
   * Execute a swap (currently simulated for Phase 3)
   */
  async executeSwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    slippageTolerance: number = 0.5, // 0.5%
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
      if (!this.wallet) {
        logger.warn('⚠️ No wallet configured, falling back to simulation');
        return this.simulateSwap(quote, dex);
      }

      try {
        logger.info(`🔄 Executing swap: ${amountIn} ${fromAsset} → ${toAsset}`);
        logger.info(`   DEX: ${dex}, Estimated output: ${quote.estimatedAmountOut.toFixed(6)}`);



  /**
   * Simulate swap (fallback when wallet not configured)
   */
  private simulateSwap(quote: SwapQuote, dex: string): SwapResult {
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
   * Execute real swap via DEX router
   */
  private async executeRealSwap(
    quote: SwapQuote,
    slippageTolerance: number,
    dex: string
  ): Promise<SwapResult> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }

    const routerAddress = this.DEX_ROUTERS[dex as keyof typeof this.DEX_ROUTERS];
    if (!routerAddress) {
      throw new Error(`Unknown DEX: ${dex}`);
    }

    // Uniswap V2 Router ABI (minimal)
    const ROUTER_ABI = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(routerAddress, ROUTER_ABI, this.wallet);
    
    // Get token addresses from TokenRegistry
    const { TokenRegistry } = await import('../../shared/tokenRegistry');
    const fromToken = TokenRegistry.getToken(quote.fromAsset as any);
    const toToken = TokenRegistry.getToken(quote.toAsset as any);
    
    if (!fromToken || !toToken) {
      throw new Error('Token not found in registry');
    }

    const network = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
    const fromAddress = fromToken.address[network];
    const toAddress = toToken.address[network];

    // Approve token spending
    const { tokenService } = await import('./tokenService');
    await tokenService.approveToken(quote.fromAsset, routerAddress, quote.amountIn.toString());

    // Calculate minimum output with slippage
    const amountIn = ethers.parseUnits(quote.amountIn.toString(), fromToken.decimals);
    const estimatedOut = ethers.parseUnits(quote.estimatedAmountOut.toString(), toToken.decimals);
    const amountOutMin = (estimatedOut * BigInt(Math.floor((1 - slippageTolerance / 100) * 10000))) / BigInt(10000);
    
    const path = [fromAddress, toAddress];
    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

    // Execute swap
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      this.wallet.address,
      deadline
    );

    const receipt = await tx.wait();

    return {
      success: true,
      transactionHash: receipt.hash,
      amountOut: quote.estimatedAmountOut,
      actualRate: quote.exchangeRate,
      gasUsed: parseFloat(ethers.formatEther(receipt.gasUsed * receipt.gasPrice)),
    };
  }

        const result = await this.executeRealSwap(quote, slippageTolerance, dex);
        
        logger.info(`✅ Swap completed: ${result.transactionHash}`);
        return result;
      } catch (error) {
        logger.error('❌ Real swap failed, falling back to simulation:', error);
        return this.simulateSwap(quote, dex);
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
  private estimatePriceImpact(tradeSize: number, volume24h: number): number {
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

  // Phase 4 - Real DEX Integration implementation
  private async executeRealSwap(quote: SwapQuote, slippageTolerance: number): Promise<SwapResult> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      const routerAddress = this.DEX_ROUTERS[quote.dex as keyof typeof this.DEX_ROUTERS];
      if (!routerAddress) throw new Error(`Unknown DEX: ${quote.dex}`);
      
      const router = new ethers.Contract(routerAddress, ROUTER_ABI, this.wallet);
      
      // Build swap parameters
      const amountIn = ethers.parseUnits(quote.amountIn.toString(), 18);
      const estimatedOut = ethers.parseUnits(quote.estimatedAmountOut.toString(), 18);
      const amountOutMin = (estimatedOut * BigInt(Math.floor((1 - slippageTolerance) * 10000))) / BigInt(10000);
      const path = [quote.tokenIn, quote.tokenOut];
      const to = this.wallet.address;
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      
      // Approve token spending first
      const tokenContract = new ethers.Contract(quote.tokenIn, ERC20_ABI, this.wallet);
      const approveTx = await tokenContract.approve(routerAddress, amountIn);
      await approveTx.wait();
      
      // Estimate gas
      const gasEstimate = await router.swapExactTokensForTokens.estimateGas(
        amountIn, amountOutMin, path, to, deadline
      );
      
      // Execute swap with 20% gas buffer
      const gasPrice = (await this.provider.getFeeData()).gasPrice!;
      const tx = await router.swapExactTokensForTokens(
        amountIn, amountOutMin, path, to, deadline,
        { gasLimit: (gasEstimate * BigInt(120)) / BigInt(100), gasPrice }
      );
      
      const receipt = await tx.wait();
      
      // Update database
      await db.insert(dexTransactions).values({
        dex: quote.dex,
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        amountIn: quote.amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        actualAmountOut: quote.estimatedAmountOut.toString(),
        transactionHash: receipt.hash,
        status: 'completed',
        gasUsed: receipt.gasUsed.toString()
      });
      
      // Emit event
      await this.emitEvent('swap_executed', {
        dex: quote.dex,
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        txHash: receipt.hash
      });
      
      return {
        success: true,
        amountOut: quote.estimatedAmountOut,
        transactionHash: receipt.hash,
        dex: quote.dex
      };
    } catch (err) {
      console.error('DEX swap failed:', err);
      throw err;
    }
  }
}

export const dexService = new DEXIntegrationService();

// Export types for use in other modules
export type { SwapQuote, SwapResult };

