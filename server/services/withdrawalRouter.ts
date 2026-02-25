/**
 * Withdrawal Router
 * Decision engine that determines optimal withdrawal routing
 * Direct transfer vs Bridge vs Swap+Bridge
 */

import { SupportedChain, CHAIN_CONFIG } from '../../shared/chainConfiguration';
import { getFeeCalculator, RoutingCost, AllRoutingCosts } from './feeCalculator';
import { getServiceAccountManager } from './serviceAccountManager';
import { db } from '../db';
import { crossChainTransfers } from '../../shared/accountSchema';
import { Logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

const logger = new Logger('withdrawal-router');

export interface WithdrawalRequest {
  userAddress: string;
  targetChain: SupportedChain;
  token: string;
  amount: string;      // In token units (decimal-adjusted)
  priority?: 'cost' | 'speed' | 'balanced';
  maxSlippage?: number; // In percentage (e.g., 0.5 for 0.5%)
  minReceived?: string; // Minimum acceptable amount after all fees
}

export interface RoutingDecision {
  // Request info
  request: WithdrawalRequest;
  
  // Decision
  selectedRoute: RoutingCost;
  alternateRoutes: RoutingCost[];
  
  // Execution plan
  executionSteps: ExecutionStep[];
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
  
  // Metadata
  routingReason: string;
  createdAt: Date;
}

export interface ExecutionStep {
  sequence: number;
  action: 'check_balance' | 'initiate_swap' | 'approve_bridge_contract' | 'initiate_bridge' | 'monitor_confirmation' | 'finalize';
  sourceChain: SupportedChain;
  targetChain?: SupportedChain;
  token?: string;
  amount?: string;
  gasEstimate?: string;
  details: Record<string, any>;
}

interface LiquidityCheck {
  onSourceChain: boolean;
  onTargetChain: boolean;
  sourceBalance: string;
  targetLiquidity: string;
  requiredLiquidity: string;
}

export class WithdrawalRouter {
  private feeCalculator = getFeeCalculator();
  private accountManager = getServiceAccountManager();

  /**
   * Main routing decision logic
   */
  async routeWithdrawal(request: WithdrawalRequest): Promise<RoutingDecision> {
    logger.info(`Routing withdrawal: ${request.token} ${request.amount} to ${request.targetChain}`);

    const decision: RoutingDecision = {
      request,
      selectedRoute: {} as RoutingCost,
      alternateRoutes: [],
      executionSteps: [],
      isValid: true,
      validationErrors: [],
      routingReason: '',
      createdAt: new Date(),
    };

    try {
      // Step 1: Validate request
      const validationErrors = await this.validateRequest(request);
      if (validationErrors.length > 0) {
        decision.isValid = false;
        decision.validationErrors = validationErrors;
        logger.warn(`Withdrawal validation failed: ${validationErrors.join(', ')}`);
        return decision;
      }

      // Step 2: Check liquidity across all chains
      const liquidityMap = await this.checkLiquidityAcrossChains(request);

      // Step 3: Get all routing options
      const routingOptions = await this.feeCalculator.calculateAllRoutingOptions(
        this.findSourceChain(request, liquidityMap),
        request.targetChain,
        request.amount,
        this.findSourceToken(request, liquidityMap),
        request.token
      );

      // Step 4: Select best route based on priority
      const priority = request.priority || 'balanced';
      let selectedRoute: RoutingCost | undefined;

      if (priority === 'cost') {
        selectedRoute = routingOptions.cheapest;
      } else if (priority === 'speed') {
        selectedRoute = routingOptions.fastest;
      } else {
        selectedRoute = routingOptions.balanced;
      }

      if (!selectedRoute || !selectedRoute.method) {
        decision.isValid = false;
        decision.validationErrors.push('No valid routing options found');
        return decision;
      }

      // Step 5: Validate routing choice
      const routingValidation = await this.validateRoutingChoice(request, selectedRoute, liquidityMap);
      if (!routingValidation.isValid) {
        decision.isValid = false;
        decision.validationErrors = routingValidation.errors;
        return decision;
      }

      // Step 6: Build execution plan
      decision.selectedRoute = selectedRoute;
      decision.alternateRoutes = [
        routingOptions.cheapest,
        routingOptions.fastest,
      ].filter(r => r && r.method !== selectedRoute.method);
      
      decision.executionSteps = this.buildExecutionPlan(request, selectedRoute, liquidityMap);
      decision.routingReason = this.generateRoutingReason(selectedRoute, routingOptions);

      // Step 7: Check slippage tolerance
      if (request.maxSlippage && selectedRoute.swapSlippage) {
        const slippagePercent = (parseFloat(selectedRoute.swapSlippage) / parseFloat(request.amount)) * 100;
        if (slippagePercent > request.maxSlippage) {
          decision.isValid = false;
          decision.validationErrors.push(
            `Estimated slippage ${slippagePercent.toFixed(2)}% exceeds tolerance ${request.maxSlippage}%`
          );
        }
      }

      // Step 8: Check minimum received
      if (request.minReceived) {
        const receivedAfterFees = (
          parseFloat(request.amount) - 
          parseFloat(selectedRoute.totalCostUSD || '0')
        ).toFixed(6);
        
        if (parseFloat(receivedAfterFees) < parseFloat(request.minReceived)) {
          decision.isValid = false;
          decision.validationErrors.push(
            `Estimated received ${receivedAfterFees} less than minimum ${request.minReceived}`
          );
        }
      }

      logger.info(`Routing decision made: ${selectedRoute.method} via ${selectedRoute.bridgeProtocol || 'native'}`);
      return decision;
    } catch (error) {
      logger.error(`Routing failed: ${(error as any).message}`);
      decision.isValid = false;
      decision.validationErrors.push(`Routing error: ${(error as any).message}`);
      return decision;
    }
  }

  /**
   * Validate withdrawal request before routing
   */
  private async validateRequest(request: WithdrawalRequest): Promise<string[]> {
    const errors: string[] = [];

    // Validate chain
    if (!Object.keys(CHAIN_CONFIG).includes(request.targetChain)) {
      errors.push(`Invalid target chain: ${request.targetChain}`);
    }

    // Validate amount
    const amount = parseFloat(request.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Invalid amount: ${request.amount}`);
    }

    // Validate token
    if (!request.token || request.token.length === 0) {
      errors.push('Token symbol is required');
    }

    // Validate user address
    if (!request.userAddress || request.userAddress.length === 0) {
      errors.push('User address is required');
    }

    // Validate priority
    if (request.priority && !['cost', 'speed', 'balanced'].includes(request.priority)) {
      errors.push(`Invalid priority: ${request.priority}`);
    }

    // Check if user has service account
    try {
      const accountStatus = await this.accountManager.getStatus();
      if (!accountStatus || !accountStatus.ethereumAddress) {
        errors.push('No service accounts initialized');
      }
    } catch (error) {
      errors.push(`Service account check failed: ${(error as any).message}`);
    }

    return errors;
  }

  /**
   * Check where liquidity is available
   */
  private async checkLiquidityAcrossChains(request: WithdrawalRequest): Promise<LiquidityCheck[]> {
    const checks: LiquidityCheck[] = [];

    try {
      const unifiedLiquidity = await this.accountManager.getUnifiedLiquidity();
      
      // Check all chains for the requested token
      for (const chain of Object.keys(CHAIN_CONFIG) as SupportedChain[]) {
        const chainBalances = unifiedLiquidity.chains.filter(c => c.chain === chain);
        const hasToken = chainBalances.some(cb => cb.token === request.token);
        const tokenBalance = chainBalances.find(cb => cb.token === request.token);
        const hasEnoughBalance = tokenBalance ? parseFloat(tokenBalance.balance) >= parseFloat(request.amount) : false;

        checks.push({
          onSourceChain: !!(hasToken && hasEnoughBalance),
          onTargetChain: !!(chain === request.targetChain && hasToken),
          sourceBalance: tokenBalance?.balance || '0',
          targetLiquidity: chain === request.targetChain ? unifiedLiquidity.totalValueUSD : '0',
          requiredLiquidity: request.amount,
        });
      }
    } catch (error) {
      logger.warn(`Failed to check liquidity: ${(error as any).message}`);
    }

    return checks;
  }

  /**
   * Find the best source chain for this withdrawal
   */
  private findSourceChain(request: WithdrawalRequest, liquidity: LiquidityCheck[]): SupportedChain {
    // Priority 1: Same chain as target
    if (liquidity.find(l => l.onSourceChain && l.onTargetChain)) {
      return request.targetChain;
    }

    // Priority 2: Chain with most of this token
    const richestChain = liquidity.find(
      l => l.onSourceChain && parseFloat(l.sourceBalance) >= parseFloat(request.amount)
    );
    if (richestChain) {
      // Find the chain name from the check
      const allChains = Object.keys(CHAIN_CONFIG) as SupportedChain[];
      return allChains[liquidity.indexOf(richestChain)] || 'ethereum';
    }

    // Priority 3: Any chain with the token (even if amount < request)
    const anyChain = liquidity.find(l => l.onSourceChain);
    if (anyChain) {
      const allChains = Object.keys(CHAIN_CONFIG) as SupportedChain[];
      return allChains[liquidity.indexOf(anyChain)] || 'ethereum';
    }

    // Default to Ethereum
    return 'ethereum';
  }

  /**
   * Find the best source token
   */
  private findSourceToken(request: WithdrawalRequest, liquidity: LiquidityCheck[]): string {
    // If target token is USDC, prefer USDC on source chain (for bridges)
    if (request.token === 'USDC' || request.token === 'USDT') {
      return request.token;
    }

    // Otherwise use requested token
    return request.token;
  }

  /**
   * Validate the selected routing choice
   */
  private async validateRoutingChoice(
    request: WithdrawalRequest,
    route: RoutingCost,
    liquidity: LiquidityCheck[]
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if route method is valid given liquidity
    if (route.method === 'direct' && route.sourceChain !== route.targetChain) {
      errors.push('Direct transfer requires same source and target chain');
    }

    if (route.method === 'bridge' && !route.bridgeProtocol) {
      errors.push('Bridge transfer requires bridge protocol selection');
    }

    // Verify gas estimation is reasonable
    const sourceGasCost = parseFloat(route.gasSourceChain || '0');
    if (sourceGasCost > parseFloat(request.amount) * 10) {
      errors.push(`Gas cost (${sourceGasCost}) is unreasonably high (>10x of amount)`);
    }

    // Verify route is active
    if (!route) {
      errors.push('Selected route is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build execution plan for the selected route
   */
  private buildExecutionPlan(
    request: WithdrawalRequest,
    route: RoutingCost,
    liquidity: LiquidityCheck[]
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let sequence = 1;

    // Step 1: Check balance on source chain
    steps.push({
      sequence: sequence++,
      action: 'check_balance',
      sourceChain: route.sourceChain,
      token: request.token,
      amount: request.amount,
      details: {
        purpose: `Verify ${request.token} balance on ${route.sourceChain}`,
        minimumRequired: request.amount,
      },
    });

    // Step 2: If swap needed, initiate swap
    if (route.method === 'swap_bridge') {
      steps.push({
        sequence: sequence++,
        action: 'initiate_swap',
        sourceChain: route.sourceChain,
        token: request.token,
        amount: request.amount,
        gasEstimate: route.gasSourceChain,
        details: {
          swapProtocol: 'uniswap_v3', // Default, can be configured
          estimatedOutput: 'calculated_by_dex',
          slippageTolerance: 0.5,
          maxSwapGas: route.gasSourceChain,
        },
      });
    }

    // Step 3: If bridge needed, approve bridge contract
    if (route.method === 'bridge' || route.method === 'swap_bridge') {
      steps.push({
        sequence: sequence++,
        action: 'approve_bridge_contract',
        sourceChain: route.sourceChain,
        token: request.token,
        amount: request.amount,
        details: {
          bridgeProtocol: route.bridgeProtocol,
          approvalType: 'unlimited', // or 'limited_to_amount'
        },
      });

      // Step 4: Initiate bridge transfer
      steps.push({
        sequence: sequence++,
        action: 'initiate_bridge',
        sourceChain: route.sourceChain,
        targetChain: route.targetChain,
        token: request.token,
        amount: request.amount,
        gasEstimate: route.gasSourceChain,
        details: {
          bridgeProtocol: route.bridgeProtocol,
          estimatedLatency: route.estimatedTimeSeconds,
          recipient: request.userAddress,
          bridgeFee: route.bridgeFee,
        },
      });

      // Step 5: Monitor confirmation
      steps.push({
        sequence: sequence++,
        action: 'monitor_confirmation',
        sourceChain: route.sourceChain,
        targetChain: route.targetChain,
        details: {
          confirmationThreshold: CHAIN_CONFIG[route.targetChain]!.requiredConfirmations,
          timeoutMinutes: 30,
          checkInterval: 30, // seconds
        },
      });
    }

    // Final step: Finalize and notify
    steps.push({
      sequence: sequence++,
      action: 'finalize',
      sourceChain: route.sourceChain,
      targetChain: route.targetChain,
      details: {
        notifyUser: true,
        updateServiceAccount: true,
        recordMetrics: true,
      },
    });

    return steps;
  }

  /**
   * Generate human-readable routing reason
   */
  private generateRoutingReason(selected: RoutingCost, all: AllRoutingCosts): string {
    const priority = this.determinePriority(selected, all);

    switch (selected.method) {
      case 'direct':
        return `Direct transfer on ${selected.sourceChain} - fastest and cheapest option (${selected.estimatedTimeSeconds}s)`;

      case 'bridge':
        return `Bridge transfer via ${selected.bridgeProtocol || 'auto-selected protocol'} - ` +
          `${selected.totalCostPercent}% of amount (${selected.estimatedTimeSeconds}s)`;

      case 'swap_bridge':
        return `Swap + Bridge - swap ${all.sourceToken} to ${all.targetToken}, ` +
          `then bridge via ${selected.bridgeProtocol || 'auto'}. ` +
          `Total cost: ${selected.totalCostPercent}% (${selected.estimatedTimeSeconds}s)`;

      default:
        return 'Route selected based on optimal criteria';
    }
  }

  /**
   * Determine which priority was used
   */
  private determinePriority(selected: RoutingCost, all: AllRoutingCosts): 'cost' | 'speed' | 'balanced' {
    if (selected === all.cheapest) return 'cost';
    if (selected === all.fastest) return 'speed';
    return 'balanced';
  }

  /**
   * Record withdrawal routing decision in database
   */
  async recordRoutingDecision(decision: RoutingDecision, withdrawalId: string): Promise<void> {
    try {
      await db.insert(crossChainTransfers).values({
        withdrawalId,
        sourceChain: decision.selectedRoute.sourceChain,
        targetChain: decision.selectedRoute.targetChain,
        sourceToken: decision.request.token,
        targetToken: decision.request.token,
        sourceAmount: decision.request.amount,
        targetAmount: decision.request.amount,
        recipientAddress: decision.request.userAddress,
        bridgeProtocol: decision.selectedRoute.bridgeProtocol || 'direct',
        status: 'pending',
        gasFeeSource: decision.selectedRoute.gasSourceChain,
        gasFeeTarget: decision.selectedRoute.gasTargetChain,
        bridgeFee: decision.selectedRoute.bridgeFee,
        swapSlippage: decision.selectedRoute.swapSlippage,
        totalCostUSD: decision.selectedRoute.totalCostUSD,
        estimatedTime: decision.selectedRoute.estimatedTimeSeconds,
        createdAt: new Date(),
      });

      logger.info(`Recorded routing decision for withdrawal ${withdrawalId}`);
    } catch (error) {
      logger.error(`Failed to record routing decision: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Get routing history for a user
   */
  async getRoutingHistory(userAddress: string, limit: number = 10): Promise<AllRoutingCosts[]> {
    try {
      const transfers = await db
        .select()
        .from(crossChainTransfers)
        .where(eq(crossChainTransfers.recipientAddress, userAddress))
        .limit(limit);

      const results: Array<AllRoutingCosts> = [];
      for (const t of transfers) {
        const sourceChainVal = t.sourceChain as unknown as SupportedChain;
        const targetChainVal = t.targetChain as unknown as SupportedChain;
        results.push({
          amount: t.sourceAmount,
          sourceChain: sourceChainVal,
          targetChain: targetChainVal,
          sourceToken: t.sourceToken,
          targetToken: t.targetToken,
          cheapest: {
            method: 'bridge' as const,
            gasSourceChain: t.gasFeeSource,
            gasTargetChain: t.gasFeeTarget,
            bridgeFee: t.bridgeFee,
            totalCostUSD: t.totalCostUSD,
            totalCostPercent: '0',
            estimatedTimeSeconds: t.estimatedTime || 0,
            sourceChain: sourceChainVal,
            targetChain: targetChainVal,
            bridgeProtocol: t.bridgeProtocol,
          },
          fastest: {} as RoutingCost,
          balanced: {} as RoutingCost,
        });
      }
      return results;
    } catch (error) {
      logger.error(`Failed to get routing history: ${(error as any).message}`);
      return [];
    }
  }
}

/**
 * Singleton instance
 */
let instance: WithdrawalRouter | null = null;

export function initializeWithdrawalRouter(): WithdrawalRouter {
  if (!instance) {
    instance = new WithdrawalRouter();
  }
  return instance;
}

export function getWithdrawalRouter(): WithdrawalRouter {
  if (!instance) {
    instance = new WithdrawalRouter();
  }
  return instance;
}

export function destroyWithdrawalRouter(): void {
  instance = null;
}
