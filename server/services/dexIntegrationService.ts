import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { tokenService } from './tokenService';
import { tokenRegistry } from './tokenRegistry';

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

// Uniswap V3 Router ABI (compatible with multiple chains)
const UNISWAP_V3_ROUTER_ABI = [
  'function exactInputSingle((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
  'function exactOutputSingle((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum) params) external payable returns (uint256 amountIn)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
  'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum) params) external payable returns (uint256 amountIn)'
];

// Sushiswap Router ABI (V2 compatible)
const SUSHISWAP_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
];

// Curve stable swap ABI
const CURVE_SWAP_ABI = [
  'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256)',
  'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
  'function get_dx(int128 i, int128 j, uint256 dy) external view returns (uint256)'
];

class DEXIntegrationService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  // DEX Router addresses across multiple chains
  private readonly DEX_ROUTERS = {
    // Celo network
    ubeswap_celo: {
      address: '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121',
      name: 'Ubeswap',
      chain: 'celo',
      type: 'uniswap-v2'
    },
    // Ethereum network
    uniswap_v3_ethereum: {
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      name: 'Uniswap V3',
      chain: 'ethereum',
      type: 'uniswap-v3'
    },
    sushiswap_ethereum: {
      address: '0xd9e1cE17f2641f24aE9bAEc3f8e4070Cbc9caBFf',
      name: 'Sushiswap',
      chain: 'ethereum',
      type: 'uniswap-v2'
    },
    // Polygon network
    uniswap_v3_polygon: {
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      name: 'Uniswap V3',
      chain: 'polygon',
      type: 'uniswap-v3'
    },
    sushiswap_polygon: {
      address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      name: 'Sushiswap',
      chain: 'polygon',
      type: 'uniswap-v2'
    },
    // Arbitrum network
    uniswap_v3_arbitrum: {
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      name: 'Uniswap V3',
      chain: 'arbitrum',
      type: 'uniswap-v3'
    },
    sushiswap_arbitrum: {
      address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      name: 'Sushiswap',
      chain: 'arbitrum',
      type: 'uniswap-v2'
    },
    // Optimism network
    uniswap_v3_optimism: {
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      name: 'Uniswap V3',
      chain: 'optimism',
      type: 'uniswap-v3'
    },
    // BSC network
    pancakeswap_bsc: {
      address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      name: 'PancakeSwap',
      chain: 'bsc',
      type: 'uniswap-v2',
      liquidity: '$2B+'
    }
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
    preferredDex: string = 'ubeswap_celo',
    chain: string = 'celo'
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

      // Try on-chain quote first for Celo
      if (chain === 'celo' && this.provider) {
        try {
          const onChain = await this.getOnChainQuote(fromAsset, toAsset, amountIn);
          if (onChain) return onChain;
        } catch (err: any) {
          logger.debug(`[DEXService] On-chain quote failed, falling back to oracle: ${err?.message || err}`);
        }
      }

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
   * Get an on-chain AMM quote via Ubeswap router for Celo
   */
  private async getOnChainQuote(fromAsset: string, toAsset: string, amountIn: number): Promise<SwapQuote | null> {
    if (!this.provider) return null;

    const UBESWAP_ROUTER = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121';
    const ROUTER_ABI = ['function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'];
    const CELO_NATIVE = '0x471EcE3750Da237f93B8E339c536989b8978a438';

    const celoTokens = tokenRegistry.getCeloDEXTokens();
    const fromEntry = celoTokens.get((fromAsset || '').toUpperCase());
    const toEntry = celoTokens.get((toAsset || '').toUpperCase());
    if (!fromEntry || !toEntry) return null;

    const router = new ethers.Contract(UBESWAP_ROUTER, ROUTER_ABI, this.provider);
    const amountInWei = ethers.parseUnits(amountIn.toString(), fromEntry.decimals);

    let amounts: bigint[];
    let path: string[] = [fromEntry.address, toEntry.address];
    try {
      amounts = await (router as any).getAmountsOut(amountInWei, path);
    } catch {
      path = [fromEntry.address, CELO_NATIVE, toEntry.address];
      amounts = await (router as any).getAmountsOut(amountInWei, path);
    }

    const amountOut = amounts[amounts.length - 1];
    const amountOutNum = Number(ethers.formatUnits(amountOut, toEntry.decimals));
    const exchangeRate = amountOutNum / amountIn;
    const priceImpact = Math.abs(1 - exchangeRate); // simplified

    return {
      fromAsset,
      toAsset,
      amountIn,
      estimatedAmountOut: amountOutNum,
      exchangeRate,
      priceImpact: priceImpact * 100,
      estimatedGas: 0.001,
      dex: 'ubeswap',
    };
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
   * Execute real swap via appropriate DEX router
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
      // Get DEX configuration
      const dexConfig = this.DEX_ROUTERS[dex as keyof typeof this.DEX_ROUTERS];
      if (!dexConfig) {
        throw new Error(`Unknown DEX: ${dex}`);
      }

      const routerAddress = dexConfig.address;
      const chain = dexConfig.chain;

      // Route to appropriate swap handler based on DEX type
      if (dexConfig.type === 'uniswap-v3') {
        return await this.executeUniswapV3Swap(quote, slippageTolerance, routerAddress, chain);
      } else if (dexConfig.type === 'uniswap-v2') {
        return await this.executeUniswapV2Swap(quote, slippageTolerance, routerAddress, chain);
      } else {
        // Default to V2 style (Ubeswap, Sushiswap)
        return await this.executeUniswapV2Swap(quote, slippageTolerance, routerAddress, chain);
      }
    } catch (error) {
      logger.error('❌ Real swap execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed',
      };
    }
  }

  /**
   * Execute Uniswap V2 style swap (used by Ubeswap, Sushiswap, etc)
   */
  private async executeUniswapV2Swap(
    quote: SwapQuote,
    slippageTolerance: number,
    routerAddress: string,
    chain: string
  ): Promise<SwapResult> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }

    try {
      // Create router contract
      const router = new ethers.Contract(routerAddress, SUSHISWAP_ROUTER_ABI, this.wallet);

      let fromAddress: string, toAddress: string, fromDecimals: number, toDecimals: number;

      if (chain === 'celo') {
        const celoTokens = tokenRegistry.getCeloDEXTokens();
        const fromEntry = celoTokens.get((quote.fromAsset || '').toUpperCase());
        const toEntry = celoTokens.get((quote.toAsset || '').toUpperCase());

        if (!fromEntry || !toEntry) {
          throw new Error(`Token not found in tokens.config.json: ${quote.fromAsset} or ${quote.toAsset}`);
        }

        fromAddress = fromEntry.address;
        toAddress = toEntry.address;
        fromDecimals = fromEntry.decimals;
        toDecimals = toEntry.decimals;
      } else {
        throw new Error('executeUniswapV2Swap currently supports only Celo chain in this service');
      }

      logger.info(`Token addresses: ${quote.fromAsset} = ${fromAddress}, ${quote.toAsset} = ${toAddress}`);

      // Prepare amounts
      const amountIn = ethers.parseUnits(quote.amountIn.toString(), fromDecimals);
      const estimatedOut = ethers.parseUnits(quote.estimatedAmountOut.toString(), toDecimals);

      // Approve token spending using local approve logic
      await this.approveToken(fromAddress, routerAddress, amountIn, this.wallet);

      // Calculate minimum output with slippage tolerance
      const slippageDecimal = slippageTolerance / 100;
      const amountOutMin = (BigInt(estimatedOut.toString()) * BigInt(Math.floor((1 - slippageDecimal) * 10000))) / BigInt(10000);

      const path = [fromAddress, toAddress];
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now

      logger.info(`Swap params: amountIn=${ethers.formatUnits(amountIn, fromDecimals)} ${quote.fromAsset}, ` +
                  `amountOutMin=${ethers.formatUnits(amountOutMin, toDecimals)} ${quote.toAsset}`);

      // Execute swap (cast to any for dynamic ABI)
      logger.info(`Executing swap on ${quote.dex}...`);
      const swapTx = await (router as any).swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        this.wallet.address,
        deadline,
        {
          gasLimit: 500000,
        }
      );

      logger.info(`⏳ Swap transaction submitted: ${swapTx.hash}`);
      const receipt = await swapTx.wait(2);

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
   * Execute Uniswap V3 style swap (concentrated liquidity)
   */
  private async executeUniswapV3Swap(
    quote: SwapQuote,
    slippageTolerance: number,
    routerAddress: string,
    chain: string
  ): Promise<SwapResult> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }

    try {
      // For V3, we need to construct a path (tokenA -> fee -> tokenB)
      // This is simplified - in production you'd need to determine optimal fees
      logger.info(`🚀 Executing Uniswap V3 swap on ${quote.dex}...`);
      
      // Create router contract with V3 ABI
      const router = new ethers.Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, this.wallet);

      let fromAddress: string, toAddress: string, fromDecimals: number, toDecimals: number;

      if (chain === 'celo') {
        const celoTokens = tokenRegistry.getCeloDEXTokens();
        const fromEntry = celoTokens.get((quote.fromAsset || '').toUpperCase());
        const toEntry = celoTokens.get((quote.toAsset || '').toUpperCase());

        if (!fromEntry || !toEntry) {
          throw new Error(`Token not found in tokens.config.json: ${quote.fromAsset} or ${quote.toAsset}`);
        }

        fromAddress = fromEntry.address;
        toAddress = toEntry.address;
        fromDecimals = fromEntry.decimals;
        toDecimals = toEntry.decimals;

        // Approve token spending
        await this.approveToken(fromAddress, routerAddress, ethers.parseUnits(quote.amountIn.toString(), fromDecimals) as bigint, this.wallet as any);
      } else {
        throw new Error('executeUniswapV3Swap currently supports only Celo chain in this service');
      }

      const amountIn = ethers.parseUnits(quote.amountIn.toString(), fromDecimals);
      const estimatedOut = ethers.parseUnits(quote.estimatedAmountOut.toString(), toDecimals);
      
      const slippageDecimal = slippageTolerance / 100;
      const amountOutMinimum = estimatedOut * BigInt(Math.floor((1 - slippageDecimal) * 10000)) / BigInt(10000);

      // Construct V3 path (simplified - assume 0.3% fee)
      // In production: encode(tokenA, fee, tokenB)
      const fee = 3000; // 0.3%
      
      logger.info(`Executing V3 exactInputSingle: ${quote.fromAsset} -> ${quote.toAsset}`);

      const swapTx = await router.exactInputSingle({
        path: ethers.solidityPacked(['address', 'uint24', 'address'], [fromAddress, fee, toAddress]),
        recipient: this.wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum
      }, {
        gasLimit: 500000
      });

      logger.info(`⏳ V3 Swap transaction submitted: ${swapTx.hash}`);
      const receipt = await swapTx.wait(2);

      if (!receipt) {
        throw new Error('Transaction failed - no receipt');
      }

      logger.info(`✅ V3 Swap completed! Hash: ${receipt.hash}`);

      return {
        success: true,
        transactionHash: receipt.hash,
        amountOut: quote.estimatedAmountOut,
        actualRate: quote.exchangeRate,
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) / 1e18 : undefined,
      };
    } catch (error) {
      logger.error('Uniswap V3 swap failed:', error);
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
   * Approve token with zero-then-set pattern
   */
  private async approveToken(tokenAddress: string, spender: string, amount: bigint, wallet: ethers.Wallet): Promise<void> {
    const ERC20_ABI = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance: bigint = BigInt((await token.allowance(wallet.address, spender)).toString());
    if (allowance >= amount) return;

    try {
      if (allowance > 0n) {
        const tx0 = await token.approve(spender, 0n);
        await tx0.wait(1);
      }
    } catch (err) {
      logger.debug('Zero-allowance reset failed, continuing to set new allowance');
    }

    const tx = await token.approve(spender, amount);
    await tx.wait(1);
    logger.info(`[DEXIntegration] Approved ${amount.toString()} for ${spender} (token ${tokenAddress}) - tx ${tx.hash}`);
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
    // Production-grade price impact estimator combining:
    //  - theoretical AMM constant-product model (approximate)
    //  - empirical square-root market-impact law (ADV-based)
    //  - fee and volatility scaling with sensible caps
    // Returns a fractional impact (e.g. 0.02 => 2%).

    if (!isFinite(tradeSize) || tradeSize <= 0) return 0;

    // Defensive fallback for missing/zero ADV
    const safeVolume = (isFinite(volume24h) && volume24h > 0) ? volume24h : Math.max(tradeSize * 2, 1000);

    // Tunable constants (can be overridden via env)
    const LIQUIDITY_MULTIPLIER = Number(process.env.DEX_IMPACT_LIQUIDITY_MULTIPLIER) || 3; // estimate liquidity ≈ X * daily volume
    const EMPIRICAL_COEFF = Number(process.env.DEX_IMPACT_EMPIRICAL_COEFF) || 0.08; // calibrates sqrt-law term
    const EMPIRICAL_ALPHA = 0.5; // square-root law exponent
    const FEE_ESTIMATE = 0.003; // typical AMM taker fee (0.3%) — included as baseline cost
    const MIN_IMPACT = 1e-4; // 0.01% min
    const MAX_IMPACT = Number(process.env.DEX_IMPACT_MAX) || 0.25; // 25% hard cap

    // Estimate notional pool liquidity (USD) from daily volume — conservative multiplier
    const estimatedLiquidity = Math.max(safeVolume * LIQUIDITY_MULTIPLIER, tradeSize * 2, 1000);

    // Theoretical AMM impact: for a symmetric pool (reserves ≈ liquidity/2 each side),
    // price impact ≈ dx / reserve ≈ 2 * tradeSize / totalLiquidity
    const ammImpact = Math.min(1, 2 * tradeSize / estimatedLiquidity);

    // Empirical square-root market impact: impact ∝ coeff * (trade / ADV)^0.5
    const empiricalImpact = EMPIRICAL_COEFF * Math.pow(tradeSize / safeVolume, EMPIRICAL_ALPHA);

    // Volume ratio multiplier: if trade is a large fraction of ADV, scale up conservatively
    const volumeRatio = tradeSize / safeVolume; // e.g., 0.05 => 5% of ADV
    const volumeScale = Math.min(Math.max(volumeRatio, 1e-6), 10);

    // Blend models with conservative weighting
    const combined = 0.65 * ammImpact + 0.30 * empiricalImpact + 0.05 * empiricalImpact * volumeScale;

    // Add fee floor and apply bounds
    let impact = combined + FEE_ESTIMATE;
    if (!isFinite(impact) || impact <= 0) impact = MIN_IMPACT;
    impact = Math.min(impact, MAX_IMPACT);

    return impact;
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
      // Get quotes from DEXes filtered to the requested chain (prefer Celo)
      const chain = 'celo';
      const relevantDexes = Object.entries(this.DEX_ROUTERS)
        .filter(([, cfg]) => cfg.chain === chain)
        .map(([id]) => id);

      const quotes: SwapQuote[] = [];
      for (const dex of relevantDexes) {
        const quote = await this.getSwapQuote(fromAsset, toAsset, amountIn, dex, chain);
        if (quote) quotes.push(quote);
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
   * Get supported DEXes with details
   */
  getSupportedDEXes(): Array<{name: string; id: string; chain: string; type: string}> {
    return Object.entries(this.DEX_ROUTERS).map(([id, config]) => ({
      id,
      name: config.name,
      chain: config.chain,
      type: config.type
    }));
  }

  /**
   * Get DEXes for a specific chain
   */
  getDEXesByChain(chain: string): Array<{name: string; id: string; type: string}> {
    return Object.entries(this.DEX_ROUTERS)
      .filter(([_, config]) => config.chain === chain)
      .map(([id, config]) => ({
        id,
        name: config.name,
        type: config.type
      }));
  }
}

export const dexService = new DEXIntegrationService();

// Export types for use in other modules
export type { SwapQuote, SwapResult };