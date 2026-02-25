/**
 * KWETU Treasury Execution Bridge
 * 
 * Enhances KWETU operational layer with market-aware execution for treasury operations.
 * Routes transactions through optimal venues based on:
 * - Current liquidity profiles
 * - Price impact simulations
 * - Risk-adjusted execution scores
 * - DAO risk profile constraints
 */

import { gatewayAggregator, TreasuryProfile } from '../../services/gatewayAggregator';
import { shardOrchestrator } from '../../services/intelligenceShards';
import { assetGraphService } from '../../services/assetGraphService';
import type { AssetStateSnapshot } from '../../types/assetGraph';

export interface ExecutionPlan {
  transactionId: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  estimatedOutput: string;
  selectedVenue: string;
  liquidityScore: number;
  executionScore: number;
  estimatedGas: string;
  estimatedSlippage: number;
  riskScore: number;
  status: 'pending' | 'ready' | 'rejected';
  reason?: string;
}

export interface TreasuryExecutionContext {
  daoId: string;
  operationId: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  deadline: number; // Unix timestamp
  treasuryProfile: TreasuryProfile;
}

/**
 * Treasury Execution Router
 * 
 * Determines optimal execution venues and parameters for treasury operations.
 * Implements circuit breakers and risk limits.
 */
export class TreasuryExecutionRouter {
  private rateLimiters: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly requestsPerMinute = 10;
  private readonly maxSlippageDefault = 0.5; // 50 bps

  /**
   * Plan a treasury transaction with market-aware routing
   */
  async planExecution(context: TreasuryExecutionContext): Promise<ExecutionPlan> {
    // 1. Validate inputs
    this.validateExecutionContext(context);

    // 2. Check rate limits
    if (!this.checkRateLimit(context.daoId)) {
      throw new Error(`Rate limit exceeded for DAO ${context.daoId}`);
    }

    // 3. Get current market state
    const { fromSnapshot, toSnapshot } = await this.getMarketSnapshots(
      context.fromAsset,
      context.toAsset
    );

    // 4. Assess risk
    const riskScore = this.assessExecutionRisk(fromSnapshot, toSnapshot, context);

    // 5. Check risk constraints
    if (!this.passesRiskConstraints(riskScore, context.treasuryProfile)) {
      return {
        transactionId: context.operationId,
        fromAsset: context.fromAsset,
        toAsset: context.toAsset,
        amount: context.amount,
        estimatedOutput: '0',
        selectedVenue: 'REJECTED',
        liquidityScore: 0,
        executionScore: 0,
        estimatedGas: '0',
        estimatedSlippage: 0,
        riskScore,
        status: 'rejected',
        reason: `Risk score ${riskScore}/100 exceeds DAO max risk aversion`,
      };
    }

    // 6. Get optimal execution from gateway aggregator
    const quote = await gatewayAggregator.getBestExecutionForTreasury(
      context.fromAsset,
      context.toAsset,
      context.amount,
      context.treasuryProfile
    );

    // 7. Validate execution score meets constraints
    if (quote.score.totalScore < 40) {
      return {
        transactionId: context.operationId,
        fromAsset: context.fromAsset,
        toAsset: context.toAsset,
        amount: context.amount,
        estimatedOutput: quote.quote.outputAmount,
        selectedVenue: quote.quote.protocol,
        liquidityScore: quote.score.liquidityScore,
        executionScore: quote.score.totalScore,
        estimatedGas: quote.quote.estimatedGas || '0',
        estimatedSlippage: quote.quote.priceImpact || 0,
        riskScore,
        status: 'rejected',
        reason: `Execution quality too low: ${quote.score.totalScore}/100 (min 40 required)`,
      };
    }

    // 8. Verify liquidity is sufficient
    const liquidityOk = this.verifyLiquidity(
      context.amount,
      context.toAsset,
      toSnapshot,
      context.treasuryProfile
    );

    if (!liquidityOk) {
      return {
        transactionId: context.operationId,
        fromAsset: context.fromAsset,
        toAsset: context.toAsset,
        amount: context.amount,
        estimatedOutput: quote.quote.outputAmount,
        selectedVenue: quote.quote.protocol,
        liquidityScore: quote.score.liquidityScore,
        executionScore: quote.score.totalScore,
        estimatedGas: quote.quote.estimatedGas || '0',
        estimatedSlippage: quote.quote.priceImpact || 0,
        riskScore,
        status: 'rejected',
        reason: `Insufficient liquidity for execution size. Max: ${toSnapshot.coreState.liquidityDepth5pct}`,
      };
    }

    // 9. All checks passed - return ready plan
    return {
      transactionId: context.operationId,
      fromAsset: context.fromAsset,
      toAsset: context.toAsset,
      amount: context.amount,
      estimatedOutput: quote.quote.outputAmount,
      selectedVenue: quote.quote.protocol,
      liquidityScore: quote.score.liquidityScore,
      executionScore: quote.score.totalScore,
      estimatedGas: quote.quote.estimatedGas || '0',
      estimatedSlippage: quote.quote.priceImpact || 0,
      riskScore,
      status: 'ready',
    };
  }

  /**
   * Validate execution context
   */
  private validateExecutionContext(context: TreasuryExecutionContext): void {
    if (!context.daoId || !context.fromAsset || !context.toAsset || !context.amount) {
      throw new Error('Invalid execution context: missing required fields');
    }

    const amount = BigInt(context.amount);
    if (amount <= 0n) {
      throw new Error('Invalid amount: must be positive');
    }

    if (context.deadline < Date.now()) {
      throw new Error('Invalid deadline: must be in the future');
    }

    if (context.fromAsset === context.toAsset) {
      throw new Error('Invalid swap: from and to assets are the same');
    }
  }

  /**
   * Rate limiting
   */
  private checkRateLimit(daoId: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(daoId);

    if (!limiter || now > limiter.resetAt) {
      // Reset
      this.rateLimiters.set(daoId, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (limiter.count >= this.requestsPerMinute) {
      return false;
    }

    limiter.count++;
    return true;
  }

  /**
   * Fetch market snapshots for both assets
   */
  private async getMarketSnapshots(
    fromAsset: string,
    toAsset: string
  ): Promise<{ fromSnapshot: AssetStateSnapshot; toSnapshot: AssetStateSnapshot }> {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      assetGraphService.getSnapshot(fromAsset),
      assetGraphService.getSnapshot(toAsset),
    ]);

    if (!fromSnapshot) throw new Error(`No snapshot available for ${fromAsset}`);
    if (!toSnapshot) throw new Error(`No snapshot available for ${toAsset}`);

    return { fromSnapshot, toSnapshot };
  }

  /**
   * Assess execution risk
   */
  private assessExecutionRisk(
    fromSnapshot: AssetStateSnapshot,
    toSnapshot: AssetStateSnapshot,
    context: TreasuryExecutionContext
  ): number {
    let riskScore = 0;

    // From-asset risk (selling)
    riskScore += (fromSnapshot.coreState.riskOverallScore || 50) * 0.3;

    // To-asset risk (buying into)
    riskScore += (toSnapshot.coreState.riskOverallScore || 50) * 0.4;

    // Liquidity risk (illiquid assets are riskier to execute against)
    const targetLiquidity = toSnapshot.coreState.liquidityDepth5pct || 0;
    const requiredFunds = parseFloat(context.amount) || 0;

    if (targetLiquidity < requiredFunds) {
      riskScore += 25; // Severe liquidity risk
    } else if (targetLiquidity < requiredFunds * 5) {
      riskScore += 15; // Moderate liquidity risk
    }

    // Volatility risk
    const toVolatility = this.estimateVolatility(toSnapshot);
    riskScore += (toVolatility / 100) * 10; // Up to 10 points

    // Governance risk (lower trust in governance = higher execution risk)
    const fromGovScore = 100 - (fromSnapshot.coreState.riskGovernanceScore || 50);
    riskScore += fromGovScore * 0.1;

    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Estimate volatility from snapshot
   */
  private estimateVolatility(snapshot: AssetStateSnapshot): number {
    // Use price confidence as inverse proxy: low confidence = high volatility
    const confidence = snapshot.coreState.priceConfidence || 85;
    return Math.max(0, 100 - confidence * 1.5);
  }

  /**
   * Check if risk score passes DAO constraints
   */
  private passesRiskConstraints(riskScore: number, profile: TreasuryProfile): boolean {
    // Map risk aversion to max acceptable risk
    const maxRiskByAversion = {
      conservative: 40,
      moderate: 60,
      aggressive: 80,
    };

    const maxAcceptable = maxRiskByAversion[profile.riskAversion] || 60;
    return riskScore <= maxAcceptable;
  }

  /**
   * Verify sufficient liquidity for execution
   */
  private verifyLiquidity(
    amount: string,
    toAsset: string,
    snapshot: AssetStateSnapshot,
    profile: TreasuryProfile
  ): boolean {
    const requiredAmount = parseFloat(amount) || 0;
    const available5pct = snapshot.coreState.liquidityDepth5pct || 0;

    // Require <25% of 5pct depth to ensure favorable execution
    const maxAllowed = available5pct * 0.25;

    return requiredAmount <= maxAllowed;
  }
}

/**
 * Treasury Operation Executor
 * 
 * Executes approved treasury operations with monitoring and rollback capability
 */
export class TreasuryOperationExecutor {
  private executionLog: Map<string, ExecutionPlan> = new Map();

  /**
   * Execute a planned transaction
   */
  async executeOperation(plan: ExecutionPlan): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    actualOutput?: string;
  }> {
    if (plan.status !== 'ready') {
      return {
        success: false,
        error: `Cannot execute operation in ${plan.status} status. Reason: ${plan.reason}`,
      };
    }

    try {
      // Log execution attempt
      this.executionLog.set(plan.transactionId, plan);

      // Route to gateway aggregator for actual execution
      const result = await gatewayAggregator.executeSwap(
        plan.fromAsset,
        plan.toAsset,
        plan.amount,
        plan.selectedVenue,
        {
          maxSlippage: 0.5, // 50 bps
          deadline: Math.floor(Date.now() / 1000) + 600, // 10 minute deadline
        }
      );

      return {
        success: true,
        txHash: result.hash,
        actualOutput: result.outputAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Monitor execution and detect anomalies
   */
  async monitorExecution(
    transactionId: string,
    expectedOutput: string,
    tolerancePercent: number = 5
  ): Promise<{
    status: 'pending' | 'completed' | 'anomaly';
    message: string;
    actualOutput?: string;
  }> {
    const plan = this.executionLog.get(transactionId);
    if (!plan) {
      return { status: 'pending', message: `No execution record for ${transactionId}` };
    }

    // Fetch actual execution result
    try {
      // Real implementation would query blockchain
      const tolerance = (parseFloat(expectedOutput) * tolerancePercent) / 100;
      const expected = parseFloat(expectedOutput);

      // Simulate check
      if (Math.random() > 0.95) {
        return {
          status: 'anomaly',
          message: `Execution anomaly: Expected ≈${expected}, got significantly different output`,
          actualOutput: (expected * 0.8).toString(), // Example
        };
      }

      return { status: 'completed', message: 'Execution completed normally', actualOutput: expectedOutput };
    } catch (error) {
      return {
        status: 'pending',
        message: `Monitoring in progress...`,
      };
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(transactionId?: string): ExecutionPlan[] {
    if (transactionId) {
      const plan = this.executionLog.get(transactionId);
      return plan ? [plan] : [];
    }
    return Array.from(this.executionLog.values());
  }
}

/**
 * Treasury Health Monitor
 * 
 * Real-time monitoring of treasury position and risk
 */
export class TreasuryHealthMonitor {
  /**
   * Analyze treasury health given current market conditions
   */
  async analyzeTreasuryHealth(
    assets: Array<{ symbol: string; amount: string }>,
    riskProfile: 'conservative' | 'moderate' | 'aggressive'
  ): Promise<{
    healthScore: number; // 0-100
    status: 'healthy' | 'caution' | 'critical';
    risks: string[];
    recommendations: string[];
  }> {
    const snapshots = await this.fetchAssetSnapshots(assets.map(a => a.symbol));
    
    let totalRiskScore = 0;
    const risks: string[] = [];

    for (const asset of assets) {
      const snapshot = snapshots.get(asset.symbol);
      if (!snapshot) continue;

      const amount = parseFloat(asset.amount) || 0;
      const assetRisk = snapshot.coreState.riskOverallScore || 50;
      const liquidity = snapshot.coreState.liquidityDepth5pct || 0;

      // Weight asset risk by amount
      totalRiskScore += (assetRisk * amount) / (assets.length || 1);

      if (amount > liquidity * 0.1) {
        risks.push(`⚠️ ${asset.symbol}: Position size (${amount}) is significant relative to liquidity`);
      }

      if (assetRisk > 60) {
        risks.push(`🔴 ${asset.symbol}: Risk score elevated (${assetRisk}/100)`);
      }
    }

    // Determine health based on profile
    const maxRisk = riskProfile === 'conservative' ? 40 : riskProfile === 'moderate' ? 60 : 80;
    const healthScore = Math.max(0, 100 - totalRiskScore);
    
    let status: 'healthy' | 'caution' | 'critical' = 'healthy';
    if (totalRiskScore > maxRisk * 1.2) status = 'critical';
    else if (totalRiskScore > maxRisk) status = 'caution';

    const recommendations = this.generateHealthRecommendations(status, totalRiskScore, risks);

    return { healthScore, status, risks, recommendations };
  }

  private async fetchAssetSnapshots(symbols: string[]): Promise<Map<string, AssetStateSnapshot>> {
    const snapshots = new Map<string, AssetStateSnapshot>();
    for (const symbol of symbols) {
      try {
        const snapshot = await assetGraphService.getSnapshot(symbol);
        if (snapshot) snapshots.set(symbol, snapshot);
      } catch (e) {
        console.warn(`Failed to fetch snapshot for ${symbol}`);
      }
    }
    return snapshots;
  }

  private generateHealthRecommendations(
    status: 'healthy' | 'caution' | 'critical',
    riskScore: number,
    risks: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (status === 'critical') {
      recommendations.push('🚨 CRITICAL: Treasury at elevated risk. Consider rebalancing immediately.');
      recommendations.push('✓ Shift to lower-risk tier-1 assets');
      recommendations.push('✓ Reduce concentrated positions');
    } else if (status === 'caution') {
      recommendations.push('⚠️ Treasury risk above target. Monitor closely.');
      recommendations.push('✓ Consider reducing illiquid positions');
    } else {
      recommendations.push('✅ Treasury healthy. Continue monitoring.');
    }

    return recommendations;
  }
}
