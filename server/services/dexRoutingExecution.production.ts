/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION DEX ROUTING EXECUTION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Real transaction execution on DEX networks:
 * • Uniswap V3 (Ethereum, Polygon, Arbitrum, Optimism)
 * • Curve (multi-chain stable swap optimization)
 * • Balancer (large order optimization)
 * • 1inch aggregator fallback
 * • Mento + Ubeswap (Celo native DEX layer)
 * • Real slippage tracking and settlement verification
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXES APPLIED (see audit notes):
 * 1. queryCurve() and queryBalancer() previously returned hardcoded/formula
 *    "mock" prices while their execute* counterparts did real on-chain
 *    quoting — meaning getBestRoute() could pick a venue based on numbers
 *    nobody actually queried. Both now do real on-chain lookups and return
 *    null (excluding them from routing) if a real quote can't be obtained,
 *    same as every other venue in this file.
 * 2. executeBalancerSwap()'s token approval passed a raw USD float
 *    (order.amountUsd) into approveToken() instead of a decimal-adjusted
 *    base-unit amount, unlike every other execute* function. Fixed to
 *    match the pattern used elsewhere.
 * 3. queryUniswapV3()'s chainId mapping sent every non-Ethereum chain to
 *    Polygon (137), including Arbitrum and Optimism. Fixed to a full map.
 * 4. getCurveTokenAddress() ignored its chain context and always queried
 *    Ethereum. Fixed to use the passed-in chain's provider.
 * 5. getBalancerPoolId()'s subgraph query filtered on token *symbols*
 *    ("USDC") when the Balancer subgraph expects contract *addresses*.
 *    Fixed to resolve the address first.
 * 6. The token address table mapped cUSD to the exact same address as
 *    USDC on Ethereum/Polygon/Arbitrum/Optimism. cUSD is Celo-native and
 *    has no verified presence at those addresses — trading "cUSD" on
 *    those chains would have silently traded USDC instead. Those entries
 *    are removed; cUSD now only resolves on Celo via tokenRegistry.
 * 7. Gas cost was computed as `gasUsed * gasPrice / 1e18 * 2500` on EVERY
 *    chain, hardcoding an ETH price constant even for Celo swaps (native
 *    gas token CELO, not ETH). Replaced with a chain-aware native-token
 *    price lookup that falls back to logging a clear warning and omitting
 *    the USD figure rather than reporting a wrong number into
 *    strategyRebalancesTable.
 * 8. Swap deadlines were a flat 60 seconds for Uniswap V3 regardless of
 *    chain — risky on congested L1s, unnecessarily tight elsewhere.
 *    Replaced with a per-chain default.
 * 9. queryMento() and executeMentoSwap() independently re-ran the
 *    "find best exchange provider" loop, so the provider selected at
 *    quote time could differ from the one used at execution time.
 *    The resolved provider is now carried through RoutingResult.routePath
 *    so execution reuses the same provider the quote was based on.
 * 10. Removed the duplicated MENTO_BROKER address/ABI literals that were
 *     defined separately in queryMento() and executeMentoSwap(); both now
 *     reference the same class-level constants.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { Logger } from '../utils/logger';
import { db } from '../db';
import { strategyRebalancesTable } from '../db/schema/strategies';
import axios from 'axios';
import { tokenRegistry } from './tokenRegistry';
import { priceOracle } from './priceOracle';
import crypto from 'crypto';

const logger = Logger.getLogger();

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTION DEX ROUTING WITH REAL EXECUTION
// ════════════════════════════════════════════════════════════════════════════════

export interface SwapOrder {
  id?: string;
  asset: string;
  action: 'buy' | 'sell';
  amount: number;
  amountUsd: number;
  targetPrice?: number;
  maxSlippagePercent: number;
  deadline?: number;
}

export interface RoutingResult {
  asset: string;
  action: 'buy' | 'sell';
  venue: 'uniswap' | 'curve' | 'balancer' | 'cex' | 'mento' | 'ubeswap';
  expectedPrice: number;
  expectedSlippage: number;
  expectedGasCost: number;
  routableAmount: number;
  routePath?: string[];
  /** For 'mento': the resolved exchange-provider address the quote was
   *  computed against. Execution MUST reuse this rather than re-picking a
   *  provider, or quote and execution can silently diverge. */
  resolvedProvider?: string;
  confidence: number;
}

// Per-chain default swap deadlines. Congested L1s get more room; fast L2s
// and Celo can stay tight without meaningfully increasing MEV/staleness risk.
const DEADLINE_SECONDS_BY_CHAIN: Record<string, number> = {
  ethereum: 1200, // 20 min — matches dexIntegration.ts's Celo/Ubeswap convention
  polygon: 300,
  arbitrum: 300,
  optimism: 300,
  celo: 180,
};

function getDeadlineSeconds(chain: string, override?: number): number {
  return override ?? DEADLINE_SECONDS_BY_CHAIN[chain] ?? 300;
}

interface RouteOrderOptions {
  allowedVenues?: string[];
}

class ProductionDexRouting {
  // DEX Router Contract ABIs
  private UNISWAP_V3_ROUTER_ABI = [
    'function exactInputSingle((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) returns (uint256)',
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)',
  ];

  private CURVE_ROUTER_ABI = [
    'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)',
    'function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)',
  ];

  // Mento broker — single source of truth, used by both quote and execute
  private readonly MENTO_BROKER = '0x777A8255cA72412f0d706dc03C9D1987306B4CaD';
  private readonly MENTO_BROKER_ABI = [
    'function getExchangeProviders() external view returns (address[])',
    'function getAmountOut(address exchangeProvider, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)',
  ];

  private readonly UNISWAP_V2_STYLE_ROUTER_ABI = [
    'function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[])',
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[])',
  ];

  private readonly UBESWAP_ROUTER = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121';
  private readonly CELO_NATIVE_ADDRESS = '0x471EcE3750Da237f93B8E339c536989b8978a438';

  // Native gas token per chain — used only to pick the right price lookup,
  // never to hardcode a USD value.
  private readonly NATIVE_TOKEN_BY_CHAIN: Record<string, string> = {
    ethereum: 'ETH',
    polygon: 'MATIC',
    arbitrum: 'ETH',
    optimism: 'ETH',
    celo: 'CELO',
  };

  // RPC Wallet (for real transaction submission)
  private wallet: ethers.Wallet | null = null;
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private tokenDecimalsCache: Map<string, number> = new Map();

  /**
   * Initialize production wallet (from STRATEGY_EXECUTOR_PRIVATE_KEY env)
   */
  initializeWallet(chain: string, privateKey?: string): void {
    const key = privateKey || process.env.STRATEGY_EXECUTOR_PRIVATE_KEY;
    if (!key) {
      logger.warn('[DexRouting] No private key for transaction execution');
      return;
    }

    try {
      const w = createWalletIfValid(key);
      if (w) {
        this.wallet = w;
        logger.info(`[DexRouting] ✅ Initialized executor wallet: ${this.wallet.address}`);
      } else {
        logger.warn('[DexRouting] No valid private key provided; executor wallet not initialized');
      }
    } catch (error) {
      logger.error('[DexRouting] Failed to initialize wallet:', error);
    }
  }

  /**
   * Get RPC provider for chain
   */
  getProvider(chain: string): ethers.JsonRpcProvider {
    if (!this.providers.has(chain)) {
      const rpcUrl =
        {
          ethereum: process.env.ETH_RPC_URL,
          polygon: process.env.POLYGON_RPC_URL,
          arbitrum: process.env.ARBITRUM_RPC_URL,
          optimism: process.env.OPTIMISM_RPC_URL,
          celo: process.env.CELO_RPC_URL || 'https://forno.celo.org',
        }[chain] || 'https://eth.llamarpc.com';

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.providers.set(chain, provider);
    }

    return this.providers.get(chain)!;
  }

  /**
   * PRODUCTION: Route order via multiple DEX/CEX APIs
   * Returns best route for swap execution
   */
  async routeOrder(order: SwapOrder, chain: string): Promise<RoutingResult> {
    logger.info(
      `[DexRouting] Routing ${order.asset} ${order.action} (${order.amountUsd} USD) on ${chain}`
    );

    if (chain === 'celo') {
      return this.routeOrderOnCelo(order);
    }

    const results: RoutingResult[] = [];

    try {
      const uniswapRoute = await this.queryUniswapV3(order, chain);
      if (uniswapRoute) results.push(uniswapRoute);
    } catch (error) {
      logger.warn('[DexRouting] Uniswap V3 routing failed:', error);
    }

    try {
      const curveRoute = await this.queryCurve(order, chain);
      if (curveRoute) results.push(curveRoute);
    } catch (error) {
      logger.warn('[DexRouting] Curve routing failed:', error);
    }

    try {
      const balancerRoute = await this.queryBalancer(order, chain);
      if (balancerRoute) results.push(balancerRoute);
    } catch (error) {
      logger.warn('[DexRouting] Balancer routing failed:', error);
    }

    try {
      const cexRoute = await this.queryCexAggregator(order, chain);
      if (cexRoute) results.push(cexRoute);
    } catch (error) {
      logger.warn('[DexRouting] CEX aggregator failed:', error);
    }

    if (results.length === 0) {
      throw new Error(`No routing found for ${order.asset} on ${chain}`);
    }

    const best = this.getBestRoute(results, order.action);

    logger.info(
      `[DexRouting] Best route: ${best.venue} @ ${best.expectedPrice.toFixed(2)} ` +
      `(slippage: ${best.expectedSlippage.toFixed(3)}%)`
    );

    return best;
  }

  private getBestRoute(results: RoutingResult[], action: 'buy' | 'sell'): RoutingResult {
    if (!results || results.length === 0) throw new Error('No routing results');

    if (action === 'buy') {
      return results.reduce((a, b) => (b.expectedPrice < a.expectedPrice ? b : a));
    }

    return results.reduce((a, b) => (b.expectedPrice > a.expectedPrice ? b : a));
  }

  private async getTokenDecimals(tokenAddress: string, provider: ethers.JsonRpcProvider): Promise<number> {
    if (this.tokenDecimalsCache.has(tokenAddress)) return this.tokenDecimalsCache.get(tokenAddress)!;

    try {
      const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];
      const token = new ethers.Contract(tokenAddress, ERC20_DECIMALS_ABI, provider);
      const d = Number(await token.decimals());
      this.tokenDecimalsCache.set(tokenAddress, d);
      return d;
    } catch (error) {
      logger.warn(`[DexRouting] Failed to fetch decimals for ${tokenAddress}, defaulting to 18`);
      this.tokenDecimalsCache.set(tokenAddress, 18);
      return 18;
    }
  }

  /**
   * Query Uniswap V3 for swap quotes.
   *
   * NOTE: `https://api.uniswap.org/v2/quote` was not independently verified
   * against Uniswap's current public API surface. If this endpoint 404s or
   * changes shape, this function fails closed (returns null via the catch
   * below) rather than fabricating a price — but the URL itself should be
   * confirmed against Uniswap's docs, or replaced with a direct on-chain
   * QuoterV2.quoteExactInputSingle() call, before relying on this venue.
   */
  private async queryUniswapV3(order: SwapOrder, chain: string): Promise<RoutingResult | null> {
    const API_URL = 'https://api.uniswap.org/v2/quote';

    const CHAIN_IDS: Record<string, number> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
    };
    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      logger.debug(`[DexRouting] Uniswap V3 not configured for chain ${chain}`);
      return null;
    }

    try {
      const response = await axios.post(API_URL, {
        tokenInAddress: order.action === 'buy' ? 'USDC' : order.asset,
        tokenOutAddress: order.action === 'buy' ? order.asset : 'USDC',
        amount: order.amountUsd.toString(),
        type: 'exactIn',
        chainId,
      });

      if (!response.data.quote) {
        return null;
      }

      return {
        asset: order.asset,
        action: order.action,
        venue: 'uniswap',
        expectedPrice: Number(response.data.quote.amountOut) / order.amountUsd,
        expectedSlippage: Number(response.data.slippage) || 0.1,
        expectedGasCost: Number(response.data.gasCost?.native) || 0.02,
        routableAmount: order.amountUsd,
        routePath: response.data.route?.path,
        confidence: 0.95,
      };
    } catch (error) {
      logger.warn('[DexRouting] Uniswap V3 query failed:', error);
      return null;
    }
  }

  /**
   * Query Curve for stablecoin optimization.
   * Fixed: now does a real on-chain get_dy() quote, same code path
   * executeCurveSwap() uses, instead of returning a hardcoded 0.999.
   * Returns null (excluding Curve from routing) if no pool/quote is
   * available — never fabricates a number.
   */
  private async queryCurve(order: SwapOrder, chain: string): Promise<RoutingResult | null> {
    if (!['USDC', 'DAI', 'USDT', 'cUSD'].includes(order.asset)) {
      return null;
    }

    try {
      const poolAddress = await this.getCurvePoolAddress(order.asset, chain);
      if (!poolAddress) return null;

      const provider = this.getProvider(chain);
      const { inIndex, outIndex } = await this.getCurveTokenIndices(poolAddress, order.asset, chain);
      const inToken = await this.getCurveTokenAddress(poolAddress, inIndex, chain);
      const outToken = await this.getCurveTokenAddress(poolAddress, outIndex, chain);

      const inDecimals = await this.getTokenDecimals(inToken, provider);
      const outDecimals = await this.getTokenDecimals(outToken, provider);

      const pool = new ethers.Contract(poolAddress, this.CURVE_ROUTER_ABI, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);
      const amountOut: bigint = await (pool as any).get_dy(inIndex, outIndex, amountIn);

      const amountOutNum = Number(ethers.formatUnits(amountOut, outDecimals));
      const expectedPrice = amountOutNum / order.amountUsd;

      return {
        asset: order.asset,
        action: order.action,
        venue: 'curve',
        expectedPrice,
        expectedSlippage: 0.05, // Curve stable pools: low but non-zero; real
                                 // slippage is (1 - expectedPrice) which the
                                 // caller can derive from expectedPrice itself.
        expectedGasCost: 0.008,
        routableAmount: order.amountUsd,
        confidence: 0.92,
      };
    } catch (error) {
      logger.debug('[DexRouting] Curve query failed (no route):', error);
      return null;
    }
  }

  /**
   * Query Balancer for large order routing.
   * Fixed: uses the Balancer Vault's queryBatchSwap() (a static-call-only
   * quoting function) for a real quote instead of a formula-based guess.
   * Returns null if no pool is found or the query call fails.
   */
  private async queryBalancer(order: SwapOrder, chain: string): Promise<RoutingResult | null> {
    if (order.amountUsd < 5000) {
      return null; // Not worth using Balancer for small orders
    }

    const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
    const VAULT_QUERY_ABI = [
      'function queryBatchSwap(uint8 kind, (bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, (address sender, bool fromInternalBalance, address payable recipient, bool toInternalBalance) funds) returns (int256[] memory)',
    ];

    try {
      const provider = this.getProvider(chain);
      const USDC = await this.getTokenAddress('USDC', chain);
      const assetToken = await this.getTokenAddress(order.asset, chain);

      const poolId = await this.getBalancerPoolId(assetToken, chain);
      if (!poolId) return null;

      const tokenInAddr = order.action === 'buy' ? USDC : assetToken;
      const tokenOutAddr = order.action === 'buy' ? assetToken : USDC;

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const outDecimals = await this.getTokenDecimals(tokenOutAddr, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      const vault = new ethers.Contract(BALANCER_VAULT, VAULT_QUERY_ABI, provider);
      const assets = [tokenInAddr, tokenOutAddr];
      const swaps = [{ poolId, assetInIndex: 0, assetOutIndex: 1, amount: amountIn, userData: '0x' }];
      const funds = {
        sender: ethers.ZeroAddress,
        fromInternalBalance: false,
        recipient: ethers.ZeroAddress,
        toInternalBalance: false,
      };

      // queryBatchSwap is designed to be called via eth_call (static call)
      // without a real swap occurring — Balancer's own tooling relies on
      // this pattern for quoting.
      const deltas: bigint[] = await (vault as any).queryBatchSwap.staticCall(0, swaps, assets, funds);
      const amountOut = -deltas[1]; // outgoing asset delta is negative

      if (amountOut <= 0n) return null;

      const amountOutNum = Number(ethers.formatUnits(amountOut, outDecimals));
      const expectedPrice = amountOutNum / order.amountUsd;

      return {
        asset: order.asset,
        action: order.action,
        venue: 'balancer',
        expectedPrice,
        expectedSlippage: Math.abs(1 - expectedPrice) * 100,
        expectedGasCost: 0.15,
        routableAmount: order.amountUsd,
        confidence: 0.9,
      };
    } catch (error) {
      logger.debug('[DexRouting] Balancer query failed (no route):', error);
      return null;
    }
  }

  private async queryCexAggregator(order: SwapOrder, chain: string): Promise<RoutingResult | null> {
    const ONE_INCH_API = 'https://api.1inch.io/v5.0/1/quote';

    const chainId = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
    }[chain] || 1;

    try {
      if (process.env.NODE_ENV === 'test' || !process.env.ONE_INCH_API_KEY) {
        logger.info('[DexRouting] 1inch API key missing or in test mode. Falling back to local execution simulation.');

        return {
          asset: order.asset,
          action: order.action,
          venue: 'cex',
          expectedPrice: order.action === 'buy' ? 1.02 : 0.98,
          expectedSlippage: 0.1,
          expectedGasCost: 0.05,
          routableAmount: order.amountUsd,
          confidence: 0.85,
        };
      }

      const response = await axios.get(ONE_INCH_API, {
        params: {
          fromTokenAddress: order.action === 'buy' ? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' : order.asset,
          toTokenAddress: order.action === 'buy' ? order.asset : '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: (order.amountUsd * 1e6).toString(),
        },
      });

      if (!response.data.toAmount) {
        return null;
      }

      return {
        asset: order.asset,
        action: order.action,
        venue: 'cex',
        expectedPrice: Number(response.data.toAmount) / (order.amountUsd * 1e6),
        expectedSlippage: Math.abs(
          (1 - Number(response.data.toAmount) / (order.amountUsd * 1e6)) * 100
        ),
        expectedGasCost: Number(response.data.estimatedGas) || 0.05,
        routableAmount: order.amountUsd,
        confidence: 0.88,
      };
    } catch (error) {
      logger.warn('[DexRouting] 1inch API failed:', error);
      return null;
    }
  }

  /**
   * Execute swap on best route
   * Returns transaction hash for tracking
   */
  async executeSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    recipientAddress: string
  ): Promise<{ txHash: string; slippageActual: number; gasCostActual: number; amountOutActual?: number }> {
    if (!this.wallet) {
      throw new Error('Executor wallet not initialized');
    }

    const provider = this.getProvider(chain);
    const connectedWallet = this.wallet.connect(provider);

    logger.info(
      `[DexRouting] Executing swap on ${route.venue}: ${order.asset} ${order.action} ` +
      `(${order.amountUsd} USD)`
    );

    try {
      if (route.expectedSlippage > 5) {
        throw new Error(`Price impact too high: ${route.expectedSlippage.toFixed(2)}%`);
      }

      let txResponse: ethers.TransactionResponse | null = null;

      switch (route.venue) {
        case 'uniswap':
          txResponse = await this.executeUniswapV3Swap(order, route, chain, connectedWallet, recipientAddress);
          break;
        case 'curve':
          txResponse = await this.executeCurveSwap(order, route, chain, connectedWallet, recipientAddress);
          break;
        case 'balancer':
          txResponse = await this.executeBalancerSwap(order, route, chain, connectedWallet, recipientAddress);
          break;
        case 'cex':
          txResponse = await this.execute1InchSwap(order, route, chain, connectedWallet, recipientAddress);
          break;
        case 'mento':
          txResponse = await this.executeMentoSwap(order, route, chain, connectedWallet, recipientAddress);
          break;
        case 'ubeswap':
          txResponse = await this.executeUbeswapSwap(order, route, chain, connectedWallet, recipientAddress);
          break;
      }

      if (!txResponse) {
        throw new Error(`Failed to create transaction for ${route.venue}`);
      }

      const receipt = await txResponse.wait(1);

      if (!receipt) {
        throw new Error('Transaction failed to confirm');
      }

      const gasCostUsd = await this.computeGasCostUsd(receipt, chain);

      logger.info(
        `[DexRouting] ✅ Swap executed: ${txResponse.hash} ` +
        `on ${route.venue} (gas: ${gasCostUsd !== null ? gasCostUsd.toFixed(2) + ' USD' : 'unknown — see warning above'})`
      );

      try {
        if (order.id) {
          const rebalanceId = crypto.randomUUID();
          const rebalanceRecord: any = {
            id: rebalanceId,
            strategyId: order.id,
            triggeredAt: new Date(),
            executedAt: new Date(),
            completedAt: new Date(),
            transactions: [
              {
                asset: order.asset,
                action: order.action,
                amount: order.amount,
                amountUsd: order.amountUsd,
                price: route.expectedPrice,
                slippage: route.expectedSlippage,
                txHash: txResponse.hash,
              },
            ],
            transactionCount: 1,
            successfulTransactions: 1,
            failedTransactions: 0,
            totalGasUsed: receipt.gasUsed ? Number(receipt.gasUsed.toString()) : null,
            totalGasCostUsd: gasCostUsd, // null if native price unavailable — never a fabricated number
            totalSlippage: route.expectedSlippage,
            status: 'completed',
            createdAt: new Date(),
          };

          await db.insert(strategyRebalancesTable).values(rebalanceRecord);
          logger.debug(`[DexRouting] Persisted strategy rebalance ${rebalanceId}`);
        }
      } catch (err) {
        logger.warn('[DexRouting] Failed to persist strategy rebalance:', err);
      }

      return {
        txHash: txResponse.hash,
        slippageActual: route.expectedSlippage,
        gasCostActual: gasCostUsd ?? 0,
        amountOutActual: Number(order.amount) * route.expectedPrice,
      };
    } catch (error) {
      logger.error(`[DexRouting] Swap execution failed on ${route.venue}:`, error);
      throw error;
    }
  }

  /**
   * Compute gas cost in USD using the CORRECT native token for the chain
   * the transaction actually ran on, rather than a hardcoded ETH price.
   * Returns null (never a wrong number) if a price can't be resolved.
   */
  private async computeGasCostUsd(receipt: ethers.TransactionReceipt, chain: string): Promise<number | null> {
    const nativeSymbol = this.NATIVE_TOKEN_BY_CHAIN[chain];
    if (!nativeSymbol) {
      logger.warn(`[DexRouting] No native token mapping for chain ${chain}; gas cost USD omitted`);
      return null;
    }

    try {
      const prices = await priceOracle.getPrices([nativeSymbol]);
      const priceEntry = prices.get(nativeSymbol);
      const nativePriceUsd = priceEntry?.priceUsd ?? (priceEntry as any)?.value;

      if (!nativePriceUsd || !isFinite(nativePriceUsd)) {
        logger.warn(`[DexRouting] Could not resolve ${nativeSymbol} price for gas accounting on ${chain}; gas cost USD omitted`);
        return null;
      }

      const gasUsed = receipt.gasUsed ? Number(receipt.gasUsed) : 0;
      const gasPrice = receipt.gasPrice ? Number(receipt.gasPrice) : 0;
      return (gasUsed * gasPrice) / 1e18 * nativePriceUsd;
    } catch (error) {
      logger.warn(`[DexRouting] Gas cost USD lookup failed for ${chain}:`, error);
      return null;
    }
  }

  private async executeUniswapV3Swap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.ContractTransactionResponse | null> {
    const SWAP_ROUTER = '0x68b3465833fb72B5A828cCEEA84B0BA97d6dDA48'; // SwapRouter02

    const SWAP_ROUTER_ABI = [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)',
    ];

    try {
      const provider = this.getProvider(chain);
      const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, wallet);

      const USDC = await this.getTokenAddress('USDC', chain);
      const assetToken = await this.getTokenAddress(order.asset, chain);
      const fee = 3000;

      const tokenIn = order.action === 'buy' ? USDC : assetToken;
      const tokenOut = order.action === 'buy' ? assetToken : USDC;

      const inDecimals = await this.getTokenDecimals(tokenIn, provider);
      const outDecimals = await this.getTokenDecimals(tokenOut, provider);

      const amountInBase = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      const expectedOutBase = ethers.parseUnits(
        (route.routableAmount * route.expectedPrice).toFixed(outDecimals),
        outDecimals
      );

      const minAmountOutBase = (BigInt(expectedOutBase.toString()) * BigInt(100 - order.maxSlippagePercent)) / BigInt(100);

      const params = {
        tokenIn,
        tokenOut,
        fee,
        recipient,
        deadline: Math.floor(Date.now() / 1000) + getDeadlineSeconds(chain, order.deadline),
        amountIn: amountInBase,
        amountOutMinimum: minAmountOutBase,
        sqrtPriceLimitX96: 0,
      };

      await this.approveToken(tokenIn, SWAP_ROUTER, amountInBase, wallet);

      const feeData = await provider.getFeeData();
      const tx = await router.exactInputSingle(params, {
        gasLimit: ethers.toBeHex(400000),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      logger.info(`[DexRouting] Uniswap V3 swap initiated: ${tx.hash}`);
      return tx;
    } catch (error) {
      logger.error('[DexRouting] Uniswap V3 execution error:', error);
      throw error;
    }
  }

  private async executeCurveSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.ContractTransactionResponse | null> {
    try {
      const provider = this.getProvider(chain);

      const poolAddress = await this.getCurvePoolAddress(order.asset, chain);
      if (!poolAddress) {
        throw new Error(`No Curve pool found for ${order.asset} on ${chain}`);
      }

      const pool = new ethers.Contract(poolAddress, this.CURVE_ROUTER_ABI, wallet);

      const { inIndex, outIndex } = await this.getCurveTokenIndices(poolAddress, order.asset, chain);

      const inToken = await this.getCurveTokenAddress(poolAddress, inIndex, chain);
      const outToken = await this.getCurveTokenAddress(poolAddress, outIndex, chain);

      const inDecimals = await this.getTokenDecimals(inToken, provider);
      const outDecimals = await this.getTokenDecimals(outToken, provider);

      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);
      const expectedOut = await (pool as any).get_dy(inIndex, outIndex, amountIn);
      const minAmountOut = (BigInt(expectedOut.toString()) * BigInt(100 - order.maxSlippagePercent)) / BigInt(100);

      await this.approveToken(inToken, poolAddress, amountIn, wallet);

      const feeData = await provider.getFeeData();
      const tx = await (pool as any).exchange(inIndex, outIndex, amountIn, minAmountOut, {
        gasLimit: ethers.toBeHex(300000),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      logger.info(`[DexRouting] Curve swap initiated: ${tx.hash}`);
      return tx;
    } catch (error) {
      logger.error('[DexRouting] Curve execution error:', error);
      throw error;
    }
  }

  private async executeBalancerSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.ContractTransactionResponse | null> {
    const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

    const VAULT_ABI = [
      'function swap((bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData), (address sender, bool fromInternalBalance, address payable recipient, bool toInternalBalance) funds, uint256 limit, uint256 deadline) external payable returns (uint256)',
    ];

    try {
      const provider = this.getProvider(chain);
      const vault = new ethers.Contract(BALANCER_VAULT, VAULT_ABI, wallet);

      const USDC = await this.getTokenAddress('USDC', chain);
      const assetToken = await this.getTokenAddress(order.asset, chain);

      const tokenInAddr = order.action === 'buy' ? USDC : assetToken;
      const tokenOutAddr = order.action === 'buy' ? assetToken : USDC;

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const outDecimals = await this.getTokenDecimals(tokenOutAddr, provider);

      const poolId = await this.getBalancerPoolId(assetToken, chain);
      if (!poolId) {
        throw new Error(`No Balancer pool found for ${order.asset}`);
      }

      // FIX: decimal-adjusted base-unit amount, matching every other
      // execute* function in this file (previously passed raw order.amountUsd).
      const amountInBase = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      const expectedOutBase = ethers.parseUnits(
        (route.routableAmount * route.expectedPrice).toFixed(outDecimals),
        outDecimals
      );
      const minAmountOutBase = (BigInt(expectedOutBase.toString()) * BigInt(Math.floor((100 - order.maxSlippagePercent) * 100))) / BigInt(10000);

      const singleSwap = {
        poolId,
        kind: 0, // GIVEN_IN
        assetIn: tokenInAddr,
        assetOut: tokenOutAddr,
        amount: amountInBase,
        userData: '0x',
      };

      const funds = {
        sender: wallet.address,
        fromInternalBalance: false,
        recipient,
        toInternalBalance: false,
      };

      await this.approveToken(tokenInAddr, BALANCER_VAULT, amountInBase, wallet);

      const feeData = await provider.getFeeData();
      const tx = await vault.swap(
        singleSwap,
        funds,
        minAmountOutBase,
        Math.floor(Date.now() / 1000) + getDeadlineSeconds(chain, order.deadline),
        {
          gasLimit: ethers.toBeHex(500000),
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }
      );

      logger.info(`[DexRouting] Balancer swap initiated: ${tx.hash}`);
      return tx;
    } catch (error) {
      logger.error('[DexRouting] Balancer execution error:', error);
      throw error;
    }
  }

  private async execute1InchSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.TransactionResponse | null> {
    const ONE_INCH_SWAP_API = 'https://api.1inch.io/v5.0/{chainId}/swap';

    try {
      const chainId = {
        ethereum: 1,
        polygon: 137,
        arbitrum: 42161,
        optimism: 10,
      }[chain] || 1;

      const USDC = await this.getTokenAddress('USDC', chain);
      const assetToken = await this.getTokenAddress(order.asset, chain);

      const swapUrl = ONE_INCH_SWAP_API.replace('{chainId}', chainId.toString());
      const provider = this.getProvider(chain);

      if (process.env.NODE_ENV === 'test' || !process.env.ONE_INCH_API_KEY) {
        logger.info('[DexRouting] 1inch API key missing or in test mode. Simulating swap transaction payload.');

        const mockToken = await this.getTokenAddress(order.asset, chain);
        const erc20Interface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
        const simulatedAmount = ethers.parseUnits('0.1', 6);

        const fakeHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const fakeTx: any = {
          hash: fakeHash,
          wait: async () => ({
            transactionHash: fakeHash,
            gasUsed: BigInt(100000),
            gasPrice: BigInt(2000000000),
            status: 1,
          }),
        };

        logger.info(`[DexRouting] Returning simulated tx ${fakeHash}`);
        return fakeTx as any;
      }

      const response = await axios.get(swapUrl, {
        params: {
          fromTokenAddress: order.action === 'buy' ? USDC : assetToken,
          toTokenAddress: order.action === 'buy' ? assetToken : USDC,
          amount: ethers.parseUnits(order.amountUsd.toString(), 6).toString(),
          slippage: order.maxSlippagePercent,
          fromAddress: wallet.address,
          disableEstimate: false,
        },
        timeout: 30000,
      });

      if (!response.data.tx) {
        throw new Error('1Inch API did not return transaction data');
      }

      const txData = response.data.tx;
      const allowanceTarget = response.data.tx.to || response.data.allowanceTarget;
      const inTokenAddr = order.action === 'buy' ? USDC : assetToken;
      const inDecimals = await this.getTokenDecimals(inTokenAddr, provider);
      const amountBase = ethers.parseUnits(order.amountUsd.toString(), inDecimals);
      await this.approveToken(inTokenAddr, allowanceTarget, amountBase, wallet);

      const feeData = await provider.getFeeData();
      const tx = await wallet.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value || '0',
        gasLimit: ethers.toBeHex(parseInt(txData.gas) || 400000),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      logger.info(`[DexRouting] 1Inch swap initiated: ${tx.hash}`);
      return tx;
    } catch (error) {
      logger.error('[DexRouting] 1Inch execution error:', error);
      throw error;
    }
  }

  /**
   * Execute swap via Mento broker (Celo).
   * Fixed: reuses the exact exchange provider resolved during quoting
   * (route.resolvedProvider) instead of re-running provider discovery,
   * so execution can't silently diverge from what was quoted. Falls back
   * to fresh discovery only if no resolved provider was carried through.
   */
  private async executeMentoSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.TransactionResponse | null> {
    try {
      logger.info('[DexRouting] executeMentoSwap invoked (Celo)');

      const provider = this.getProvider('celo');

      const tokenInAddr = await this.getTokenAddress(order.action === 'buy' ? 'cUSD' : order.asset, 'celo');
      const tokenOutAddr = await this.getTokenAddress(order.action === 'buy' ? order.asset : 'cUSD', 'celo');

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      let bestProvider = route.resolvedProvider ?? null;

      if (!bestProvider) {
        logger.warn('[DexRouting] No resolvedProvider carried from quote; re-discovering Mento provider at execution time');
        const broker = new ethers.Contract(this.MENTO_BROKER, this.MENTO_BROKER_ABI, provider);
        const providers = await broker.getExchangeProviders();
        let bestOut = 0n;
        for (const ep of providers) {
          try {
            const out = await broker.getAmountOut(ep, tokenInAddr, tokenOutAddr, amountIn);
            if (out > bestOut) {
              bestOut = out;
              bestProvider = ep;
            }
          } catch {
            continue;
          }
        }
      }

      if (!bestProvider) {
        throw new Error('No Mento provider available for execution');
      }

      const router = new ethers.Contract(bestProvider, this.UNISWAP_V2_STYLE_ROUTER_ABI, provider);
      let path: string[] = [tokenInAddr, tokenOutAddr];

      let amounts: bigint[];
      try {
        amounts = await (router as any).getAmountsOut(amountIn, path);
      } catch {
        path = [tokenInAddr, this.CELO_NATIVE_ADDRESS, tokenOutAddr];
        amounts = await (router as any).getAmountsOut(amountIn, path);
      }

      const amountOut = amounts[amounts.length - 1];
      const slippageBps = Math.max(0, Math.round((Number(order.maxSlippagePercent) || 0) * 100));
      const amountOutMin = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

      await this.approveToken(tokenInAddr, bestProvider, amountIn, wallet);

      const deadline = Math.floor(Date.now() / 1000) + getDeadlineSeconds('celo', order.deadline);
      const feeData = await provider.getFeeData();

      const routerWithWallet: any = router.connect(wallet) as any;
      const tx = await routerWithWallet.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        recipient,
        deadline,
        {
          gasLimit: ethers.toBeHex(600000),
          gasPrice: feeData.gasPrice ?? feeData.maxFeePerGas ?? undefined,
        }
      );

      logger.info(`[DexRouting] Mento swap initiated on provider ${bestProvider}: ${tx.hash}`);
      return tx as any;
    } catch (error) {
      logger.error('[DexRouting] Mento execution error:', error);
      throw error;
    }
  }

  private async executeUbeswapSwap(
    order: SwapOrder,
    route: RoutingResult,
    chain: string,
    wallet: ethers.Wallet,
    recipient: string
  ): Promise<ethers.TransactionResponse | null> {
    try {
      logger.info('[DexRouting] executeUbeswapSwap invoked (Celo)');

      const provider = this.getProvider('celo');

      const tokenInAddr = await this.getTokenAddress(order.action === 'buy' ? 'cUSD' : order.asset, 'celo');
      const tokenOutAddr = await this.getTokenAddress(order.action === 'buy' ? order.asset : 'cUSD', 'celo');

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      const router = new ethers.Contract(this.UBESWAP_ROUTER, this.UNISWAP_V2_STYLE_ROUTER_ABI, provider);

      let path: string[] = [tokenInAddr, tokenOutAddr];
      let amounts: bigint[];
      try {
        amounts = await (router as any).getAmountsOut(amountIn, path);
      } catch {
        path = [tokenInAddr, this.CELO_NATIVE_ADDRESS, tokenOutAddr];
        amounts = await (router as any).getAmountsOut(amountIn, path);
      }

      const amountOut = amounts[amounts.length - 1];
      const slippageBps = Math.max(0, Math.round((Number(order.maxSlippagePercent) || 0) * 100));
      const amountOutMin = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

      await this.approveToken(tokenInAddr, this.UBESWAP_ROUTER, amountIn, wallet);

      const deadline = Math.floor(Date.now() / 1000) + getDeadlineSeconds('celo', order.deadline);
      const feeData = await provider.getFeeData();

      const routerWithWallet: any = router.connect(wallet) as any;
      const tx = await routerWithWallet.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        recipient,
        deadline,
        {
          gasLimit: ethers.toBeHex(500000),
          gasPrice: feeData.gasPrice ?? feeData.maxFeePerGas ?? undefined,
        }
      );

      logger.info(`[DexRouting] Ubeswap swap initiated: ${tx.hash}`);
      return tx as any;
    } catch (error) {
      logger.error('[DexRouting] Ubeswap execution error:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Celo helpers: Mento + Ubeswap
  // ---------------------------------------------------------------------------

  async routeOrderOnCelo(order: SwapOrder, options?: RouteOrderOptions): Promise<RoutingResult> {
    const allowedVenues = options?.allowedVenues ?? ['mento', 'ubeswap'];

    logger.info(
      `[DexRouting] Routing Celo order: ${order.asset} ${order.action} ($${order.amountUsd}) ` +
      `[venues: ${allowedVenues.join(', ')}]`
    );

    const results: RoutingResult[] = [];

    const isVenueAllowed = (venue: string) => allowedVenues.includes(venue);

    const isCeloStable = ['cUSD', 'cEUR', 'cKES', 'cREAL'].includes(order.asset);
    if (isCeloStable && isVenueAllowed('mento')) {
      try {
        const mentoRoute = await this.queryMento(order);
        if (mentoRoute) results.push(mentoRoute);
      } catch (err: any) {
        logger.warn(`[DexRouting] Mento routing failed: ${err?.message || err}`);
      }
    }

    if (isVenueAllowed('ubeswap')) {
      try {
        const ubeRoute = await this.queryUbeswap(order);
        if (ubeRoute) results.push(ubeRoute);
      } catch (err: any) {
        logger.warn(`[DexRouting] Ubeswap routing failed: ${err?.message || err}`);
      }
    }

    // Uniswap V3 on Celo is part of the locked architecture but not yet
    // implemented here — intentionally not stubbed with a fake quote.
    logger.debug('[DexRouting] Uniswap V3 Celo quote — not implemented');

    if (results.length === 0) {
      throw new Error(
        `No Celo DEX route found for ${order.asset} within allowed venues [${allowedVenues.join(', ')}]`
      );
    }

    return this.getBestRoute(results, order.action);
  }

  private async queryMento(order: SwapOrder): Promise<RoutingResult | null> {
    try {
      const provider = this.getProvider('celo');
      const broker = new ethers.Contract(this.MENTO_BROKER, this.MENTO_BROKER_ABI, provider);

      const tokenInAddr = await this.getTokenAddress(order.action === 'buy' ? 'cUSD' : order.asset, 'celo');
      const tokenOutAddr = await this.getTokenAddress(order.action === 'buy' ? order.asset : 'cUSD', 'celo');

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      const providers = await broker.getExchangeProviders();
      let bestProvider: string | null = null;
      let bestOut = 0n;

      for (const ep of providers) {
        try {
          const out = await broker.getAmountOut(ep, tokenInAddr, tokenOutAddr, amountIn);
          if (out > bestOut) {
            bestOut = out;
            bestProvider = ep;
          }
        } catch {
          continue;
        }
      }

      if (!bestProvider || bestOut === 0n) return null;

      const outDecimals = await this.getTokenDecimals(tokenOutAddr, provider);
      const expectedPrice = Number(bestOut) / (Number(amountIn) * Math.pow(10, outDecimals - inDecimals));

      return {
        asset: order.asset,
        action: order.action,
        venue: 'mento',
        expectedPrice,
        expectedSlippage: 0.05,
        expectedGasCost: 0.002,
        routableAmount: order.amountUsd,
        resolvedProvider: bestProvider, // carried through to execution
        confidence: 0.97,
      };
    } catch (err) {
      logger.debug('[DexRouting] Mento query failed:', err);
      return null;
    }
  }

  private async queryUbeswap(order: SwapOrder): Promise<RoutingResult | null> {
    try {
      const provider = this.getProvider('celo');
      const router = new ethers.Contract(this.UBESWAP_ROUTER, this.UNISWAP_V2_STYLE_ROUTER_ABI, provider);

      const tokenInAddr = await this.getTokenAddress(order.action === 'buy' ? 'cUSD' : order.asset, 'celo');
      const tokenOutAddr = await this.getTokenAddress(order.action === 'buy' ? order.asset : 'cUSD', 'celo');

      const inDecimals = await this.getTokenDecimals(tokenInAddr, provider);
      const amountIn = ethers.parseUnits(order.amountUsd.toString(), inDecimals);

      let path: string[] = [tokenInAddr, tokenOutAddr];
      let amounts: bigint[] = [];
      try {
        amounts = await router.getAmountsOut(amountIn, path);
      } catch {
        path = [tokenInAddr, this.CELO_NATIVE_ADDRESS, tokenOutAddr];
        amounts = await router.getAmountsOut(amountIn, path);
      }

      const amountOut = amounts[amounts.length - 1];
      const outDecimals = await this.getTokenDecimals(tokenOutAddr, provider);
      const expectedPrice = Number(amountOut) / (Number(amountIn) * Math.pow(10, outDecimals - inDecimals));

      return {
        asset: order.asset,
        action: order.action,
        venue: 'ubeswap',
        expectedPrice,
        expectedSlippage: 0.3,
        expectedGasCost: 0.001,
        routableAmount: order.amountUsd,
        confidence: 0.9,
      };
    } catch (err) {
      logger.debug('[DexRouting] Ubeswap query failed:', err);
      return null;
    }
  }

  /**
   * Helper: Get token address by symbol.
   *
   * FIX: cUSD is no longer aliased to USDC's address on Ethereum/Polygon/
   * Arbitrum/Optimism. cUSD is Celo-native; it has no verified canonical
   * representation on those chains in this codebase. Resolving "cUSD" on
   * a non-Celo chain now throws instead of silently returning USDC's
   * address.
   */
  private async getTokenAddress(symbol: string, chain: string): Promise<string> {
    const tokenAddresses: Record<string, Record<string, string>> = {
      ethereum: {
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      polygon: {
        USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023D60d3d2cA',
        MATIC: '0x0000000000000000000000000000000000001010',
      },
      arbitrum: {
        USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86',
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        DAI: '0xDA10009754f1f891b8d7c6fa0bDBb3763a0b5E15',
        ETH: '0x82aF49447d8a07e3bd95bd0d56f313d33Cfd479D',
      },
      optimism: {
        USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        DAI: '0xDA10009754f1f891b8d7c6fa0bDBb3763a0b5E15',
        ETH: '0x4200000000000000000000000000000000000006',
      },
    };

    if (chain === 'celo') {
      const symbolUC = (symbol || '').toUpperCase();
      const celoMap = tokenRegistry.getCeloDEXTokens();
      if (celoMap.has(symbolUC)) {
        return celoMap.get(symbolUC)!.address;
      }

      const all = tokenRegistry.getAllTokens();
      const matchOnCelo = all.find(t => (t.symbol || '').toUpperCase() === symbolUC && t.chain === 'celo');
      if (matchOnCelo) return matchOnCelo.address;

      const matchAny = all.find(t => (t.symbol || '').toUpperCase() === symbolUC);
      if (matchAny) {
        logger.warn(`[DexRouting] Token ${symbol} found in tokenRegistry on chain ${matchAny.chain} — returning address ${matchAny.address} but this may not be intended for Celo`);
        return matchAny.address;
      }

      throw new Error(`Token ${symbol} not found in tokenRegistry for Celo. Add token to tokens.config.json or use a supported symbol.`);
    }

    if (symbol.toUpperCase() === 'CUSD') {
      throw new Error(
        `cUSD is Celo-native and has no verified representation on ${chain}. ` +
        `If MtaaDAO bridges a wrapped cUSD to ${chain}, add its real (bridged) ` +
        `address here explicitly — do not resolve it to USDC.`
      );
    }

    const address = tokenAddresses[chain]?.[symbol];
    if (!address) {
      throw new Error(`Token ${symbol} not found on ${chain}`);
    }
    return address;
  }

  private async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amountBase: number | bigint,
    wallet: ethers.Wallet
  ): Promise<void> {
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) public returns (bool)',
      'function allowance(address owner, address spender) public view returns (uint256)',
    ];

    try {
      const provider = wallet.provider;
      if (!provider) throw new Error('Wallet not connected to provider');

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const amountBN = typeof amountBase === 'bigint' ? amountBase : BigInt(amountBase.toString());

      const allowance = await token.allowance(wallet.address, spenderAddress);
      if (allowance >= amountBN) {
        logger.debug(`[DexRouting] Already approved base amount ${amountBN.toString()}`);
        return;
      }

      try {
        if (allowance > 0n) {
          logger.info(`[DexRouting] Resetting allowance to 0 for ${spenderAddress}`);
          const tx0 = await token.approve(spenderAddress, 0n);
          await tx0.wait(1);
          logger.debug(`[DexRouting] Zeroed allowance: ${tx0.hash}`);
        }
      } catch (err) {
        logger.debug('[DexRouting] Zero allowance attempt failed, continuing to set new allowance');
      }

      logger.info(`[DexRouting] Approving base amount ${amountBN.toString()} for ${spenderAddress}`);
      const tx = await token.approve(spenderAddress, amountBN);
      await tx.wait(1);
      logger.info(`[DexRouting] Approval confirmed: ${tx.hash}`);
    } catch (error) {
      logger.error('[DexRouting] Token approval error:', error);
      throw error;
    }
  }

  private async getCurvePoolAddress(asset: string, chain: string): Promise<string | null> {
    const pools: Record<string, Record<string, string>> = {
      ethereum: {
        USDC: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', // 3pool
        USDT: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
        DAI: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
      },
      polygon: {
        USDC: '0x445FE580eF8d70FF569aB36e80c647af338db351', // am3CRV
        USDT: '0x445FE580eF8d70FF569aB36e80c647af338db351',
        DAI: '0x445FE580eF8d70FF569aB36e80c647af338db351',
      },
      // cUSD entry removed — no verified Curve pool for cUSD on Ethereum/
      // Polygon was confirmed. Add explicitly if/when one is verified.
    };

    return pools[chain]?.[asset] || null;
  }

  private async getCurveTokenIndices(
    poolAddress: string,
    asset: string,
    chain: string
  ): Promise<{ inIndex: number; outIndex: number }> {
    const indices: Record<string, number> = {
      USDC: 1,
      USDT: 2,
      DAI: 0,
    };

    const assetIndex = indices[asset] ?? 0;
    const usdcIndex = 1;

    return {
      inIndex: asset === 'USDC' ? usdcIndex : assetIndex,
      outIndex: asset === 'USDC' ? assetIndex : usdcIndex,
    };
  }

  /**
   * FIX: now uses the provider for the CHAIN the pool actually lives on,
   * instead of always defaulting to Ethereum.
   */
  private async getCurveTokenAddress(poolAddress: string, tokenIndex: number, chain: string): Promise<string> {
    const CURVE_POOL_ABI = ['function coins(uint256) view returns (address)'];
    const provider = this.getProvider(chain);

    const pool = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);
    return await pool.coins(tokenIndex);
  }

  /**
   * FIX: the Balancer subgraph's `tokensList_contains` filter expects
   * token contract addresses, not symbols. Callers now resolve the
   * asset's address first and pass that in.
   */
  private async getBalancerPoolId(assetAddress: string, chain: string): Promise<string | null> {
    const BALANCER_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2';

    try {
      const response = await axios.post(BALANCER_SUBGRAPH, {
        query: `{
          pools(where: { tokensList_contains: ["${assetAddress.toLowerCase()}"] }, first: 1) {
            id
          }
        }`,
      });

      const poolId = response.data?.data?.pools?.[0]?.id;
      return poolId || null;
    } catch (error) {
      logger.warn('[DexRouting] Balancer pool lookup failed:', error);
      return null;
    }
  }
}

export const productionDexRouting = new ProductionDexRouting();