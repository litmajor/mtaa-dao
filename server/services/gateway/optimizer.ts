/**
 * Route Optimizer
 * Finds optimal paths for cross-chain swaps and transfers
 */

import {
  TransferRoute,
  CrossChainSwapRoute,
  RouteStep,
  GatewayQuoteRequest,
} from './types';

export interface IRouteOptimizer {
  optimizeRoute(params: any): Promise<TransferRoute>;
  getAlternatives(params: any, limit: number): Promise<TransferRoute[]>;
  getQuote(params: any): Promise<any>;
}

export class MultiChainRouteOptimizer implements IRouteOptimizer {
  constructor(
    private liquidityProvider: any,
    private gasProvider: any,
    private priceProvider: any,
    private bridgeAggregator: any
  ) {}

  async optimizeRoute(params: any): Promise<TransferRoute> {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      chainInId,
      chainOutId,
      slippage = 0.5,
    } = params;

    // Same chain swap
    if (chainInId === chainOutId) {
      return this.optimizeSingleChainSwap(
        tokenIn,
        tokenOut,
        amountIn,
        chainInId,
        slippage
      );
    }

    // Cross-chain operation
    return this.optimizeCrossChainRoute(
      tokenIn,
      tokenOut,
      amountIn,
      chainInId,
      chainOutId,
      slippage
    );
  }

  async getAlternatives(params: any, limit: number = 3): Promise<TransferRoute[]> {
    const alternatives: TransferRoute[] = [];

    // Generate alternative routes with different strategies
    const strategies = [
      'best_price',
      'best_speed',
      'most_liquid',
      'lowest_fee',
      'least_slippage',
    ];

    for (let i = 0; i < Math.min(limit, strategies.length); i++) {
      try {
        const route = await this.optimizeRoute({
          ...params,
          strategy: strategies[i],
        });
        alternatives.push(route);
      } catch (error) {
        console.error(`Error generating alternative route:`, error);
      }
    }

    return alternatives;
  }

  async getQuote(params: any): Promise<any> {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      chainInId,
      chainOutId,
    } = params;

    // Get prices
    const priceIn = await this.priceProvider.getPrice(tokenIn, chainInId);
    const priceOut = await this.priceProvider.getPrice(tokenOut, chainOutId);

    if (!priceIn || !priceOut) {
      throw new Error('Unable to fetch prices');
    }

    const amountOutEstimate = (parseFloat(amountIn) * priceIn.price / priceOut.price).toString();

    return {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: amountOutEstimate,
      priceImpact: 0.5,
      slippage: 1.0,
      route: [],
      liquidity: '1000000',
      timestamp: Date.now(),
    };
  }

  private async optimizeSingleChainSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainId: number,
    slippage: number
  ): Promise<TransferRoute> {
    const routeId = this.generateRouteId();

    // Get liquidity info
    const liquidity = await this.liquidityProvider.getLiquidity(tokenIn, tokenOut, chainId);
    if (!liquidity) {
      throw new Error('No liquidity found');
    }

    // Get gas estimate
    const gasEstimate = await this.gasProvider.estimateGasCost(chainId, '150000');
    const gasPrice = await this.priceProvider.getPrice('ETH', chainId);
    const gasCostUSD = gasPrice 
      ? parseFloat(gasEstimate || '0') / 1e18 * gasPrice.price
      : 0;

    // Calculate output
    const expectedOutput = this.calculateSwapOutput(amountIn, liquidity);
    const minOutput = (parseFloat(expectedOutput) * (1 - slippage / 100)).toString();

    const route: TransferRoute = {
      id: routeId,
      source: {
        token: tokenIn,
        amount: amountIn,
        chainId,
        address: '', // Will be filled by user
      },
      destination: {
        token: tokenOut,
        chainId,
        address: '', // Will be filled by user
      },
      steps: [
        {
          from: {
            token: tokenIn,
            amount: amountIn,
            chainId,
          },
          to: {
            token: tokenOut,
            amount: expectedOutput,
            chainId,
          },
          protocol: liquidity.fee ? 'uniswap_v3' : 'uniswap_v2',
          fee: (liquidity.fee || 0.3).toString(),
          slippage: slippage,
          gasEstimate: gasEstimate || '0',
        },
      ],
      expectedOutput,
      minOutput,
      totalSlippage: slippage,
      totalGasCost: gasEstimate || '0',
      totalGasCostUSD: gasCostUSD,
      bridgeMethod: 'none',
      estimatedTime: 30, // ~30 seconds for single-chain swap
      riskLevel: 'low',
      timestamp: Date.now(),
    };

    return route;
  }

  private async optimizeCrossChainRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainInId: number,
    chainOutId: number,
    slippage: number
  ): Promise<TransferRoute> {
    const routeId = this.generateRouteId();
    const steps: RouteStep[] = [];

    // Step 1: Swap on source chain if needed
    if (tokenIn !== 'USDC') {
      const sourceSwap = await this.buildSwapStep(
        tokenIn,
        'USDC',
        amountIn,
        chainInId,
        slippage
      );
      steps.push(sourceSwap);
    }

    // Step 2: Bridge transfer
    const bridgeInfo = await this.bridgeAggregator.getBestBridge(
      'USDC',
      chainInId,
      chainOutId,
      slippage
    );

    const bridgeStep: RouteStep = {
      from: {
        token: 'USDC',
        amount: amountIn,
        chainId: chainInId,
      },
      to: {
        token: 'USDC',
        amount: amountIn,
        chainId: chainOutId,
      },
      protocol: bridgeInfo.bridge,
      fee: bridgeInfo.fee,
      slippage: 0,
      gasEstimate: bridgeInfo.gasEstimate,
    };
    steps.push(bridgeStep);

    // Step 3: Swap on destination chain if needed
    if (tokenOut !== 'USDC') {
      const destSwap = await this.buildSwapStep(
        'USDC',
        tokenOut,
        amountIn,
        chainOutId,
        slippage
      );
      steps.push(destSwap);
    }

    // Calculate totals
    const totalGas = steps.reduce((sum, step) => sum + parseFloat(step.gasEstimate || '0'), 0);
    const gasPrice = await this.priceProvider.getPrice('ETH', chainInId);
    const gasCostUSD = gasPrice ? totalGas / 1e18 * gasPrice.price : 0;

    const expectedOutput = amountIn; // Simplified for now
    const minOutput = (parseFloat(expectedOutput) * (1 - slippage / 100)).toString();

    return {
      id: routeId,
      source: {
        token: tokenIn,
        amount: amountIn,
        chainId: chainInId,
        address: '',
      },
      destination: {
        token: tokenOut,
        chainId: chainOutId,
        address: '',
      },
      steps,
      expectedOutput,
      minOutput,
      totalSlippage: slippage,
      totalGasCost: totalGas.toString(),
      totalGasCostUSD: gasCostUSD,
      bridgeMethod: bridgeInfo.bridge,
      estimatedTime: 300 + (bridgeInfo.estimatedTime || 0),
      riskLevel: this.assessRouteRisk(steps),
      timestamp: Date.now(),
    };
  }

  private async buildSwapStep(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    chainId: number,
    slippage: number
  ): Promise<RouteStep> {
    const liquidity = await this.liquidityProvider.getLiquidity(tokenIn, tokenOut, chainId);
    const gasEstimate = await this.gasProvider.estimateGasCost(chainId, '150000');

    const expectedOutput = liquidity
      ? this.calculateSwapOutput(amount, liquidity)
      : amount;

    return {
      from: {
        token: tokenIn,
        amount,
        chainId,
      },
      to: {
        token: tokenOut,
        amount: expectedOutput,
        chainId,
      },
      protocol: 'uniswap_v2',
      fee: '0.3',
      slippage,
      gasEstimate: gasEstimate || '0',
    };
  }

  private calculateSwapOutput(amountIn: string, liquidity: any): string {
    // Simplified calculation
    const ratio = parseFloat(liquidity.liquidity) / parseFloat(amountIn);
    const output = parseFloat(amountIn) * Math.min(ratio, 1);
    return output.toString();
  }

  private assessRouteRisk(steps: RouteStep[]): 'low' | 'medium' | 'high' {
    // Risk increases with number of steps and complexity
    if (steps.length === 1) return 'low';
    if (steps.length === 2) return 'medium';
    return 'high';
  }

  private generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Security Validator
 * Validates routes for security risks
 */

import { SecurityAudit } from './types';

export interface ISecurityValidator {
  validate(route: TransferRoute): Promise<SecurityAudit>;
}

export class RouteSecurityValidator implements ISecurityValidator {
  async validate(route: TransferRoute): Promise<SecurityAudit> {
    const riskFlags: string[] = [];

    // Check slippage
    const slippageAcceptable = route.totalSlippage <= 10;
    if (!slippageAcceptable) riskFlags.push('High slippage');

    // Check liquidity
    const liquidityAdequate = true; // Placeholder
    if (!liquidityAdequate) riskFlags.push('Insufficient liquidity');

    // Check gas costs
    const gasCostAcceptable = route.totalGasCostUSD <= 100; // Example threshold
    if (!gasCostAcceptable) riskFlags.push('High gas costs');

    // Check bridge security
    const bridgeSecure = this.isBridgeSecure(route.bridgeMethod);
    if (!bridgeSecure) riskFlags.push('Bridge not verified');

    // Check contract verification
    const contractVerified = true; // Placeholder

    const riskScore = this.calculateRiskScore({
      slippageWithinThreshold: slippageAcceptable,
      liquidityAdequate,
      gasCostAcceptable,
      bridgeSecure,
      oracleHealthy: true,
      contractVerified,
    });

    return {
      routeId: route.id,
      checks: {
        slippageWithinThreshold: slippageAcceptable,
        liquidityAdequate,
        gasCostAcceptable,
        bridgeSecure,
        oracleHealthy: true,
        contractVerified,
      },
      riskFlags,
      riskScore,
      isApproved: riskScore <= 30,
      timestamp: Date.now(),
    };
  }

  private isBridgeSecure(bridge: string): boolean {
    const secureBridges = ['stargate', 'axelar', 'wormhole', 'layerzero'];
    return secureBridges.includes(bridge.toLowerCase());
  }

  private calculateRiskScore(checks: any): number {
    let score = 0;
    Object.values(checks).forEach(value => {
      if (value === false) score += 20;
    });
    return score;
  }
}
