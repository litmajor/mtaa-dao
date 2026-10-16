import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { priceOracle } from './priceOracle';
import { productionDexRouting, type SwapOrder, type RoutingResult } from './dexRoutingExecution.production';
import { executeTreasurySwap, routeTreasuryOrder } from './treasuryDexRouting';

export interface SwapQuote {
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  estimatedAmountOut: number;
  exchangeRate: number;
  priceImpact: number;
  estimatedGas: number;
  dex: string;
}

export interface SwapResult {
  success: boolean;
  transactionHash?: string;
  amountOut?: number;
  actualRate?: number;
  gasUsed?: number;
  error?: string;
}

class DexRoutingService {
  private normalizeAsset(asset: string): string {
    return String(asset || '').toUpperCase();
  }

  private async toSwapOrder(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    maxSlippagePercent: number,
    chain: string = 'celo'
  ): Promise<SwapOrder> {
    const chainName = String(chain).toLowerCase();
    const fromUC = this.normalizeAsset(fromAsset);
    const toUC = this.normalizeAsset(toAsset);

    const isCeloChain = chainName === 'celo';
    const isTreasuryOnlyPath = isCeloChain && !fromUC.includes('CUSD') && !toUC.includes('CUSD');
    if (isTreasuryOnlyPath) {
      throw new Error(
        `dexIntegration only supports cUSD-anchored pairs on Celo today for treasury-safe routing. ` +
          `Requested ${fromAsset}→${toAsset} has neither leg as cUSD; refusing to silently execute a different pair than requested.`
      );
    }

    const priceMap = await priceOracle.getValuationPrices([fromAsset, toAsset]);
    const fromValuation = priceMap.get(fromUC);
    const fromPrice = fromValuation?.haircutPriceUsd ?? fromValuation?.priceUsd;

    if (typeof fromPrice !== 'number' || !Number.isFinite(fromPrice) || fromPrice <= 0) {
      throw new Error(
        `No valid USD price available for ${fromAsset}; refusing to size a swap off a fabricated reference price.`
      );
    }

    if (!isCeloChain) {
      const toValuation = priceMap.get(toUC);
      const toPrice = toValuation?.haircutPriceUsd ?? toValuation?.priceUsd;

      if (typeof toPrice !== 'number' || !Number.isFinite(toPrice) || toPrice <= 0) {
        throw new Error(
          `No valid USD price available for ${toAsset}; refusing to size a swap off a fabricated reference price.`
        );
      }
    }

    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error(`Invalid amountIn: ${amountIn}`);
    }

    return {
      asset: toAsset,
      action: 'buy',
      amount: Number(amountIn),
      amountUsd: Number(amountIn) * Number(fromPrice),
      maxSlippagePercent: Number(maxSlippagePercent) || 0.5,
      deadline: undefined,
    };
  }

  private getAllowedVenues(dex?: string): Array<'mento' | 'ubeswap'> | undefined {
    if (!dex) return undefined;

    const normalized = String(dex || '').toLowerCase();
    if (normalized.includes('mento')) return ['mento'];
    if (normalized.includes('ubeswap')) return ['ubeswap'];
    return undefined;
  }

  private async routeOrderForChain(
    order: SwapOrder,
    chain: string,
    preferredDex?: string
  ): Promise<RoutingResult> {
    const chainName = String(chain).toLowerCase();
    if (chainName === 'celo') {
      return productionDexRouting.routeOrderOnCelo(order, {
        allowedVenues: this.getAllowedVenues(preferredDex),
      });
    }

    return productionDexRouting.routeOrder(order, chainName);
  }

  async getSwapQuote(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    preferredDex?: string,
    chain: string = 'celo'
  ): Promise<SwapQuote | null> {
    try {
      const order = await this.toSwapOrder(fromAsset, toAsset, amountIn, 0.5, chain);
      const route = await this.routeOrderForChain(order, chain, preferredDex);

      return {
        fromAsset,
        toAsset,
        amountIn,
        estimatedAmountOut: route.expectedPrice * order.amountUsd,
        exchangeRate: route.expectedPrice,
        priceImpact: route.expectedSlippage,
        estimatedGas: route.expectedGasCost,
        dex: route.venue,
      };
    } catch (error) {
      logger.warn(`[DexRoutingService] Quote generation failed for ${fromAsset}→${toAsset}:`, { error });
      return null;
    }
  }

  async executeSwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    recipientAddressOrSlippage?: string | number,
    slippageToleranceOrDex?: number | string,
    dex?: string
  ): Promise<SwapResult> {
    productionDexRouting.initializeWallet('celo');
    let recipientAddress: string | undefined;
    let slippageTolerance = 0.5;
    let selectedDex = dex;

    if (typeof recipientAddressOrSlippage === 'string' && ethers.isAddress(recipientAddressOrSlippage)) {
      recipientAddress = recipientAddressOrSlippage;
      if (typeof slippageToleranceOrDex === 'number') {
        slippageTolerance = slippageToleranceOrDex;
      } else if (typeof slippageToleranceOrDex === 'string' && /^\d+(\.\d+)?$/.test(slippageToleranceOrDex)) {
        slippageTolerance = Number(slippageToleranceOrDex);
      }
      if (typeof slippageToleranceOrDex === 'string' && !/^\d+(\.\d+)?$/.test(slippageToleranceOrDex)) {
        selectedDex = slippageToleranceOrDex;
      }
    } else {
      if (typeof recipientAddressOrSlippage === 'number') {
        slippageTolerance = recipientAddressOrSlippage;
      } else if (typeof recipientAddressOrSlippage === 'string' && /^\d+(\.\d+)?$/.test(recipientAddressOrSlippage)) {
        slippageTolerance = Number(recipientAddressOrSlippage);
      }
      if (typeof slippageToleranceOrDex === 'string' && !/^\d+(\.\d+)?$/.test(slippageToleranceOrDex)) {
        selectedDex = slippageToleranceOrDex;
      }
    }

    if (!recipientAddress) {
      return {
        success: false,
        error: 'A valid recipientAddress is required to execute a swap.',
      };
    }

    try {
      const order = await this.toSwapOrder(fromAsset, toAsset, amountIn, Number(slippageTolerance) || 0.5, 'celo');
      const route = await this.routeOrderForChain(order, 'celo', selectedDex);
      const result = await productionDexRouting.executeSwap(order, route, 'celo', recipientAddress);
      const amountOut = typeof (result as { amountOutActual?: number }).amountOutActual === 'number'
        ? (result as { amountOutActual?: number }).amountOutActual
        : order.amount;

      return {
        success: true,
        transactionHash: result.txHash,
        amountOut,
        actualRate: route.expectedPrice,
        gasUsed: result.gasCostActual,
      };
    } catch (error) {
      logger.error(`[DexRoutingService] Swap execution failed for ${fromAsset}→${toAsset}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed',
      };
    }
  }

  async executeTreasurySwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    recipientAddress: string,
    slippageTolerance: number = 0.5
  ): Promise<SwapResult> {
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      return {
        success: false,
        error: 'A valid recipientAddress is required to execute a treasury swap.',
      };
    }

    try {
      const order = await this.toSwapOrder(fromAsset, toAsset, amountIn, Number(slippageTolerance) || 0.5, 'celo');
      const route = await routeTreasuryOrder(order);
      const result = await executeTreasurySwap(order, recipientAddress);
      const amountOut = typeof (result as { amountOutActual?: number }).amountOutActual === 'number'
        ? (result as { amountOutActual?: number }).amountOutActual
        : order.amount;

      return {
        success: true,
        transactionHash: result.txHash,
        amountOut,
        actualRate: route.expectedPrice,
        gasUsed: result.gasCostActual,
      };
    } catch (error) {
      logger.error(`[DexRoutingService] Treasury swap execution failed for ${fromAsset}→${toAsset}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Treasury swap execution failed',
      };
    }
  }

  async executeMultipleSwaps(
    swaps: Array<{ fromAsset: string; toAsset: string; amount: number; recipientAddress: string }>,
    options: { delayMs?: number; sequential?: boolean } = {}
  ): Promise<Array<SwapResult>> {
    const { delayMs = 1000, sequential = true } = options;
    const results: SwapResult[] = [];

    for (const swap of swaps) {
      const result = await this.executeSwap(swap.fromAsset, swap.toAsset, swap.amount, swap.recipientAddress);
      results.push(result);
      if (sequential && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  async getBestRoute(fromAsset: string, toAsset: string, amountIn: number, chain: string = 'celo'): Promise<SwapQuote | null> {
    return this.getSwapQuote(fromAsset, toAsset, amountIn, undefined, chain);
  }

  isAvailable(): boolean {
    return true;
  }

  getSupportedDEXes(): Array<{ name: string; id: string; chain: string; type: string }> {
    return [
      { name: 'Mento', id: 'mento', chain: 'celo', type: 'mento' },
      { name: 'Ubeswap', id: 'ubeswap', chain: 'celo', type: 'ubeswap' },
      { name: 'Uniswap', id: 'uniswap', chain: 'ethereum', type: 'uniswap' },
      { name: 'Curve', id: 'curve', chain: 'ethereum', type: 'curve' },
      { name: 'Balancer', id: 'balancer', chain: 'ethereum', type: 'balancer' },
      { name: 'SushiSwap', id: 'sushiswap', chain: 'ethereum', type: 'sushiswap' },
    ];
  }

  getDEXesByChain(chain: string): Array<{ name: string; id: string; chain: string; type: string }> {
    const chainName = String(chain).toLowerCase();
    if (chainName === 'celo') {
      return [
        { name: 'Mento', id: 'mento', chain: 'celo', type: 'mento' },
        { name: 'Ubeswap', id: 'ubeswap', chain: 'celo', type: 'ubeswap' },
      ];
    }

    return this.getSupportedDEXes().filter((dex) => dex.chain === chainName || dex.chain === 'ethereum').map(({ name, id, chain, type }) => ({ name, id, chain, type }));
  }
}

export const dexService = new DexRoutingService();
