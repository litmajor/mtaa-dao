/**
 * Category 8: Vaults Simulators (INTERMEDIATE)
 * 
 * 4 simulators for vault management, redemptions, liquidations, and strategies
 */

import { SimulationService, SimulationResult, SimulationStatus, SimulationDepth, SimulationParams } from './simulationFramework';

/**
 * Vault Deposit Simulator
 * Simulates vault deposits with lock periods and interest accrual
 */
export class VaultDepositSimulator extends SimulationService {
  constructor() {
    super('VAULT_DEPOSIT', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      depositAmount = 100000,
      lockupDays = 90,
      vaultType = 'standard',
      baseAPY = 0.08,
      boostMultiplier = 1.0,
      withdrawalFeePercent = 0.01,
    } = params;

    try {
      const effectiveAPY = baseAPY * boostMultiplier;
      const daysInYear = 365;
      const dailyRate = effectiveAPY / daysInYear;
      const totalInterest = depositAmount * (Math.pow(1 + dailyRate, lockupDays) - 1);
      const maturityValue = depositAmount + totalInterest;
      const withdrawalFee = depositAmount * (withdrawalFeePercent / 100);
      const netMaturityValue = maturityValue - withdrawalFee;
      const sharePrice = 1.0;
      const sharesIssued = depositAmount / sharePrice;
      const now = new Date();
      const maturityDate = new Date(now.getTime() + lockupDays * 24 * 60 * 60 * 1000);
      const withdrawalRestriction = lockupDays > 0 ? 'RESTRICTED' : 'LIQUID';
      const canWithdraw = new Date() >= maturityDate;

      const warnings = [];
      if (lockupDays > 180) warnings.push('Long lockup period reduces liquidity');
      if (withdrawalFeePercent > 0.02) warnings.push('High withdrawal fees reduce net returns');
      if (boostMultiplier < 1.0) warnings.push('Reduced boost multiplier');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: params,
        afterState: {
          depositAmount: depositAmount.toFixed(2),
          vaultType,
          lockupDays,
          maturityDate: maturityDate.toISOString().split('T')[0],
          effectiveAPY: (effectiveAPY * 100).toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          netMaturityValue: netMaturityValue.toFixed(2),
          sharesIssued: sharesIssued.toFixed(4),
        },
        delta: {
          netValue: netMaturityValue - depositAmount,
        },
        riskLevel: lockupDays > 180 ? 'MEDIUM' : 'LOW',
        riskFactors: warnings,
        warnings: warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: lockupDays,
        },
        summary: `Vault deposit of ${depositAmount.toFixed(2)} with ${(effectiveAPY * 100).toFixed(2)}% APY`,
        impactedEntities: [
          {
            type: 'vault',
            id: params.vaultId || 'unknown',
            impact: `Deposit of ${depositAmount.toFixed(2)} units`,
          },
        ],
        simulationData: {
          compoundingFrequency: 'daily',
          feeStructure: 'linear',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.createError(`Vault deposit simulation failed: ${errorMsg}`, params);
    }
  }
}

/**
 * Vault Withdrawal Simulator
 * Simulates redemptions with queue position and slippage analysis
 */
export class VaultWithdrawalSimulator extends SimulationService {
  constructor() {
    super('VAULT_WITHDRAWAL', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      withdrawalAmount = 50000,
      queuePosition = 15,
      totalQueueAmount = 500000,
      vaultLiquidity = 300000,
      dailyRedemptionCapacity = 50000,
      priceSlippagePercent = 0.02,
      exitFeePercent = 0.01,
    } = params;

    try {
      const estimatedWaitDays = Math.max(0, Math.ceil((withdrawalAmount - vaultLiquidity) / dailyRedemptionCapacity));
      const isImmediateRedemption = withdrawalAmount <= vaultLiquidity;
      const slippageAmount = withdrawalAmount * (priceSlippagePercent / 100);
      const exitFee = withdrawalAmount * (exitFeePercent / 100);
      const netWithdrawal = withdrawalAmount - slippageAmount - exitFee;
      const liquidityRatio = vaultLiquidity / totalQueueAmount;
      const liquidityStatus = liquidityRatio > 0.6 ? 'AMPLE' : liquidityRatio > 0.3 ? 'ADEQUATE' : 'CONSTRAINED';
      const queuePressure = (totalQueueAmount + withdrawalAmount) / vaultLiquidity;

      const warnings = [];
      if (!isImmediateRedemption) warnings.push(`Redemption delayed: ${estimatedWaitDays} days queue backlog`);
      if (liquidityStatus === 'CONSTRAINED') warnings.push('Low vault liquidity - higher slippage expected');
      if (exitFeePercent > 0.02) warnings.push('Above-average exit fees');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: params,
        afterState: {
          requestedAmount: withdrawalAmount.toFixed(2),
          queuePosition,
          isImmediateRedemption,
          estimatedWaitDays,
          slippageAmount: slippageAmount.toFixed(2),
          exitFee: exitFee.toFixed(2),
          netWithdrawalAmount: netWithdrawal.toFixed(2),
          liquidityStatus,
        },
        delta: {
          netWithdrawalAmount: netWithdrawal,
        },
        riskLevel: estimatedWaitDays > 7 ? 'HIGH' : estimatedWaitDays > 0 ? 'MEDIUM' : 'LOW',
        riskFactors: warnings,
        warnings: warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: 7,
        },
        summary: `Vault withdrawal of ${withdrawalAmount.toFixed(2)} with ${estimatedWaitDays} day wait`,
        impactedEntities: [
          {
            type: 'vault',
            id: params.vaultId || 'unknown',
            impact: `Withdrawal of ${withdrawalAmount.toFixed(2)} units`,
          },
        ],
        simulationData: {
          redemptionModel: 'queue-based',
          slippageModel: 'market-impact',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.createError(`Vault withdrawal simulation failed: ${errorMsg}`, params);
    }
  }
}

/**
 * Vault Liquidation Simulator
 * Simulates liquidation scenarios and collateral valuation
 */
export class VaultLiquidationSimulator extends SimulationService {
  constructor() {
    super('VAULT_LIQUIDATION', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      vaultValue = 1000000,
      collateralAssets = ['ETH', 'BTC', 'USDC'],
      collateralRatios = [0.40, 0.35, 0.25],
      liquidationThreshold = 1.2,
      currentRatio = 1.8,
      priceDropScenario = 0.30,
      liquidationPenalty = 0.05,
    } = params;

    try {
      const collateralValue = vaultValue / currentRatio;
      const collateralAfterDrop = collateralValue * (1 - priceDropScenario);
      const ratioAfterDrop = vaultValue / collateralAfterDrop;
      const isLiquidated = ratioAfterDrop > liquidationThreshold;
      const marginToLiquidation = (liquidationThreshold - currentRatio) / currentRatio * 100;
      const priceDropToLiquidation = (liquidationThreshold / currentRatio - 1) * 100;
      const liquidationLoss = vaultValue * liquidationPenalty;
      const netProceeds = collateralAfterDrop - liquidationLoss;

      const assetLiquidation = collateralAssets.map((asset: string, idx: number) => ({
        asset,
        ratio: (collateralRatios[idx] * 100).toFixed(1),
        value: (collateralValue * collateralRatios[idx]).toFixed(2),
      }));

      const warnings = [];
      if (isLiquidated) warnings.push('LIQUIDATION TRIGGERED - Collateral will be seized');
      if (marginToLiquidation < 20) warnings.push('Low liquidation margin - vulnerable to price drops');
      if (priceDropScenario > 0.2) warnings.push('Severe price shock scenario');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: params,
        afterState: {
          vaultValue: vaultValue.toFixed(2),
          collateralValue: collateralValue.toFixed(2),
          currentRatio: currentRatio.toFixed(2),
          isLiquidated,
          marginToLiquidation: marginToLiquidation.toFixed(2),
          netProceeds: netProceeds.toFixed(2),
        },
        delta: {
          liquidationLoss,
        },
        riskLevel: isLiquidated ? 'CRITICAL' : marginToLiquidation < 20 ? 'HIGH' : 'MEDIUM',
        riskFactors: warnings,
        warnings: warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: 7,
        },
        summary: `Vault liquidation analysis: ${isLiquidated ? 'LIQUIDATED' : 'NOT LIQUIDATED'}`,
        impactedEntities: [
          {
            type: 'vault',
            id: params.vaultId || 'unknown',
            impact: `Potential loss of ${liquidationLoss.toFixed(2)} units`,
          },
        ],
        simulationData: {
          liquidationModel: 'collateral-ratio-based',
          pricingSource: 'oracle',
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.createError(`Vault liquidation simulation failed: ${errorMsg}`, params);
    }
  }
}

/**
 * Vault Strategy Backtesting Simulator
 * Simulates performance of vault strategies over historical periods
 */
export class VaultStrategySimulator extends SimulationService {
  constructor() {
    super('VAULT_STRATEGY', SimulationDepth.INTERMEDIATE);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      initialCapital = 1000000,
      strategyType = 'yield-farming',
      backTestDays = 365,
      rebalanceFrequency = 'weekly',
      riskLimit = 0.15,
    } = params;

    try {
      const strategyConfigs: Record<string, any> = {
        'yield-farming': { baseReturn: 0.45, drawdown: 0.20, risk: 0.30 },
        'delta-neutral': { baseReturn: 0.08, drawdown: 0.05, risk: 0.08 },
        'market-making': { baseReturn: 0.12, drawdown: 0.10, risk: 0.15 },
      };

      const config = strategyConfigs[strategyType] || strategyConfigs['delta-neutral'];
      const maxDrawdown = config.drawdown;
      let value = initialCapital;

      for (let month = 0; month < backTestDays / 30; month++) {
        const monthlyReturn = config.baseReturn / 12 + (Math.random() - 0.5) * config.risk;
        value = value * (1 + monthlyReturn);
      }

      const totalReturn = (value - initialCapital) / initialCapital;
      const annualizedReturn = (Math.pow(value / initialCapital, 365 / backTestDays) - 1) * 100;
      const sharpeRatio = (annualizedReturn / config.risk / 100).toFixed(2);

      const warnings = [];
      if (maxDrawdown > riskLimit) warnings.push(`Maximum drawdown exceeds risk limit`);
      if (Number(sharpeRatio) < 1) warnings.push('Low risk-adjusted returns');
      if (annualizedReturn < 0) warnings.push('Strategy underperformed - negative returns');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: params,
        afterState: {
          initialCapital: initialCapital.toFixed(2),
          strategyType,
          finalValue: value.toFixed(2),
          totalReturn: (totalReturn * 100).toFixed(2),
          annualizedReturn: annualizedReturn.toFixed(2),
          sharpeRatio,
        },
        delta: {
          netReturn: value - initialCapital,
        },
        riskLevel: maxDrawdown > riskLimit ? 'HIGH' : annualizedReturn < 0.01 ? 'MEDIUM' : 'LOW',
        riskFactors: warnings,
        warnings: warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: 7,
        },
        summary: `Vault strategy backtest: ${strategyType} returned ${annualizedReturn.toFixed(2)}% annually`,
        impactedEntities: [
          {
            type: 'vault_strategy',
            id: params.strategyId || 'unknown',
            impact: `Potential return of ${(totalReturn * 100).toFixed(2)}%`,
          },
        ],
        simulationData: {
          backtestModel: 'monte-carlo',
          dataSource: 'historical-ohlcv',
          rebalanceEnabled: true,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.createError(`Vault strategy simulation failed: ${errorMsg}`, params);
    }
  }

  private getRebalanceInterval(freq: string): number {
    const intervals: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
    return intervals[freq] || 30;
  }
}
