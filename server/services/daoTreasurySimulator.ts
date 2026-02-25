/**
 * DAO Treasury Simulators - ADVANCED Depth
 * 
 * Simulates 3 core treasury actions:
 * 1. Treasury Rebalance - Asset allocation adjustments
 * 2. Asset Allocation Change - Strategic portfolio shift
 * 3. Grant Distribution - Distribution of treasury grants
 * 
 * ADVANCED depth: Monte Carlo forecasting, historical volatility analysis
 * Includes capital flow projections, risk metrics (VaR, CVaR), scenario analysis
 */

import { SimulationService, SimulationResult, SimulationParams, SimulationStatus, SimulationDepth } from './simulationFramework';

/**
 * Treasury Rebalance Simulator
 * Simulates rebalancing of treasury assets using Monte Carlo analysis
 * 
 * Input params:
 * - daoId: string
 * - currentAllocations: { [asset]: number } (percentages)
 * - targetAllocations: { [asset]: number } (percentages)
 * - treasuryValue: number
 * - volatilities: { [asset]: number } (historical volatility %)
 * - correlations?: number[][] (asset correlations)
 * - monteCarloSimulations?: number (default 10000)
 */
export class TreasuryRebalanceSimulator extends SimulationService {
  private generateRandomNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  constructor() {
    super('TREASURY_REBALANCE', SimulationDepth.ADVANCED);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['daoId', 'currentAllocations', 'targetAllocations', 'treasuryValue', 'volatilities']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { 
      daoId, 
      currentAllocations, 
      targetAllocations, 
      treasuryValue, 
      volatilities, 
      correlations,
      monteCarloSimulations = 10000,
      timeHorizon = 365, // days
    } = params;

    const assets = Object.keys(currentAllocations);

    // Calculate rebalancing trades required
    const trades: Record<string, number> = {};
    let totalTradeValue = 0;

    for (const asset of assets) {
      const current = currentAllocations[asset] || 0;
      const target = targetAllocations[asset] || 0;
      const delta = target - current;
      trades[asset] = (delta / 100) * treasuryValue;
      totalTradeValue += Math.abs(trades[asset]);
    }

    // Estimate trading fees (0.1% per trade)
    const tradingFees = totalTradeValue * 0.001;

    // Run Monte Carlo simulation - 10,000 scenarios
    const mcResults = this.runMonteCarloForecasting(
      treasuryValue,
      targetAllocations,
      volatilities,
      timeHorizon,
      monteCarloSimulations,
      correlations
    );

    const percentile5 = mcResults.sorted[Math.floor(mcResults.sorted.length * 0.05)];
    const percentile95 = mcResults.sorted[Math.floor(mcResults.sorted.length * 0.95)];

    // Value at Risk (95% confidence)
    const var95 = treasuryValue - percentile5;
    const cvar95 = this.calculateCVaR(mcResults.sorted, 0.05);

    const beforeState = {
      allocations: currentAllocations,
      totalValue: treasuryValue,
      riskMetrics: {
        volatility: Math.sqrt(this.calculatePortfolioVariance(currentAllocations, volatilities, correlations)),
      },
    };

    const afterState = {
      allocations: targetAllocations,
      totalValue: treasuryValue - tradingFees,
      riskMetrics: {
        volatility: Math.sqrt(this.calculatePortfolioVariance(targetAllocations, volatilities, correlations)),
      },
      projectedValue30Day: mcResults.mean30Day,
      projectedValue90Day: mcResults.mean90Day,
      projectedValue1Year: mcResults.mean,
    };

    const delta = {
      allocationChanges: trades,
      tradingFeesCollected: tradingFees,
      riskReduction: beforeState.riskMetrics.volatility - afterState.riskMetrics.volatility,
      expectedValueChange: afterState.projectedValue1Year - treasuryValue,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (delta.riskReduction < 0) {
      riskFactors.push('increased-volatility');
      warnings.push(`Rebalancing increases portfolio volatility by ${Math.abs(delta.riskReduction).toFixed(2)}%`);
    }

    if (var95 > treasuryValue * 0.2) {
      riskFactors.push('high-var');
      warnings.push(`VaR (95%) is ${var95.toFixed(8)} - significant downside risk`);
    }

    if (totalTradeValue > treasuryValue * 0.15) {
      riskFactors.push('large-rebalance');
      warnings.push(`Rebalancing requires ${(totalTradeValue / treasuryValue * 100).toFixed(2)}% of treasury in trades`);
    }

    const confidenceOfPositive = mcResults.sorted.filter((v: number) => v > treasuryValue).length / mcResults.sorted.length;

    const riskLevel = confidenceOfPositive < 0.3 ? 'HIGH' :
                      delta.riskReduction < 0 ? 'MEDIUM' : 'LOW';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 24,
        recommendedGracePeriodHours: 168,
        maxGracePeriodDays: 30,
      },
      summary: `Treasury rebalance from ${JSON.stringify(currentAllocations)} to ${JSON.stringify(targetAllocations)}`,
      impactedEntities: [
        { type: 'dao-treasury', id: daoId, impact: `Value: ${treasuryValue} → ${(treasuryValue - tradingFees).toFixed(8)}` },
        { type: 'market', id: 'spot-markets', impact: `Total trades: ${totalTradeValue.toFixed(8)}` },
      ],
      simulationData: {
        monteCarloSimulations,
        var95,
        cvar95,
        projectedMean: mcResults.mean,
        projectedStdDev: mcResults.stdDev,
        confidenceOfPositive,
        timeHorizon,
        volatilityReduction: delta.riskReduction,
        percentile5,
        percentile95,
      },
    };
  }

  private runMonteCarloForecasting(
    initialValue: number,
    allocations: Record<string, number>,
    volatilities: Record<string, number>,
    timeHorizonDays: number,
    simulations: number,
    correlations?: number[][]
  ): any {
    const results: number[] = [];
    const dt = 1 / 365; // Daily time step

    for (let sim = 0; sim < simulations; sim++) {
      let portfolioValue = initialValue;
      const assets = Object.keys(allocations);

      for (let day = 0; day < timeHorizonDays; day++) {
        let dayReturn = 0;
        
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const allocation = allocations[asset] / 100;
          const volatility = volatilities[asset] || 0;
          
          // GBM: dS = μ*S*dt + σ*S*dW
          // Simplified: assuming 0 drift, only volatility
          const randomReturn = (volatility / 100 / Math.sqrt(365)) * this.generateRandomNormal();
          dayReturn += allocation * randomReturn;
        }

        portfolioValue *= (1 + dayReturn);
      }

      results.push(portfolioValue);
    }

    results.sort((a, b) => a - b);

    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    // 30-day and 90-day projections
    const mean30 = this.projectMean(initialValue, Object.values(volatilities), 30, 1000);
    const mean90 = this.projectMean(initialValue, Object.values(volatilities), 90, 1000);

    return {
      sorted: results,
      mean,
      stdDev,
      mean30Day: mean30,
      mean90Day: mean90,
    };
  }

  private projectMean(initial: number, volatilities: number[], days: number, simulations: number): number {
    let totalValue = 0;
    const avgVol = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;

    for (let i = 0; i < simulations; i++) {
      let value = initial;
      for (let d = 0; d < days; d++) {
        const randomReturn = (avgVol / 100 / Math.sqrt(365)) * this.generateRandomNormal();
        value *= (1 + randomReturn);
      }
      totalValue += value;
    }

    return totalValue / simulations;
  }

  private calculatePortfolioVariance(
    allocations: Record<string, number>,
    volatilities: Record<string, number>,
    correlations?: number[][]
  ): number {
    const assets = Object.keys(allocations);
    let variance = 0;

    for (let i = 0; i < assets.length; i++) {
      const vol_i = volatilities[assets[i]] || 0;
      const w_i = allocations[assets[i]] / 100;
      variance += Math.pow(w_i * (vol_i / 100), 2);

      // Add covariance terms
      if (correlations) {
        for (let j = i + 1; j < assets.length; j++) {
          const vol_j = volatilities[assets[j]] || 0;
          const w_j = allocations[assets[j]] / 100;
          const corr = correlations[i][j] || 0;
          variance += 2 * w_i * w_j * (vol_i / 100) * (vol_j / 100) * corr;
        }
      }
    }

    return variance;
  }

  private calculateCVaR(sortedValues: number[], percentile: number): number {
    const index = Math.floor(sortedValues.length * percentile);
    const tailValues = sortedValues.slice(0, Math.max(1, index));
    return tailValues.reduce((a, b) => a + b, 0) / Math.max(1, tailValues.length);
  }
}

/**
 * Asset Allocation Change Simulator
 * Strategic portfolio shift with impact analysis
 */
export class AssetAllocationSimulator extends SimulationService {
  constructor() {
    super('ASSET_ALLOCATION_CHANGE', SimulationDepth.ADVANCED);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['daoId', 'currentAllocation', 'newAllocation', 'treasuryValue']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { daoId, currentAllocation, newAllocation, treasuryValue, historicalReturns = {} } = params;

    // Calculate changes
    const assets = Object.keys(newAllocation);
    const changes: Record<string, { old: number; new: number; change: number }> = {};

    for (const asset of assets) {
      changes[asset] = {
        old: currentAllocation[asset] || 0,
        new: newAllocation[asset] || 0,
        change: (newAllocation[asset] || 0) - (currentAllocation[asset] || 0),
      };
    }

    // Project returns under different market conditions
    const scenarios = this.projectScenarios(
      treasuryValue,
      newAllocation,
      historicalReturns,
      365
    );

    const expectedReturn = scenarios.bullish * 0.25 + 
                          scenarios.base * 0.50 +
                          scenarios.bearish * 0.25;

    const downside = treasuryValue - scenarios.bearish;

    const beforeState = {
      allocation: currentAllocation,
      value: treasuryValue,
      historicalReturn: 0,
    };

    const afterState = {
      allocation: newAllocation,
      value: treasuryValue,
      projectedReturn: expectedReturn,
      projectedValue: treasuryValue + expectedReturn,
      bullishScenario: scenarios.bullish,
      baseScenario: scenarios.base,
      bearishScenario: scenarios.bearish,
    };

    const delta = {
      allocationShifts: changes,
      projectedReturnChange: expectedReturn,
      downsideRisk: downside,
      opportunityCost: scenarios.bullish - expectedReturn,
    };

    const riskFactors: string[] = [];
    const warnings: string[] = [];

    if (Math.abs(changes[assets[0]]?.change || 0) > 30) {
      riskFactors.push('significant-allocation-shift');
      warnings.push('Major allocation shift may impact market pricing and execution');
    }

    if (scenarios.bearish < treasuryValue * 0.8) {
      riskFactors.push('high-downside-risk');
      warnings.push(`Bearish scenario could reduce treasury value by ${((1 - scenarios.bearish / treasuryValue) * 100).toFixed(2)}%`);
    }

    if (downside > treasuryValue * 0.3) {
      riskFactors.push('excessive-downside');
      warnings.push(`Maximum downside risk is ${(downside / treasuryValue * 100).toFixed(2)}% of treasury`);
    }

    const riskLevel = scenarios.bearish < treasuryValue * 0.7 ? 'CRITICAL' :
                      scenarios.bearish < treasuryValue * 0.85 ? 'HIGH' : 'MEDIUM';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 48,
        recommendedGracePeriodHours: 336,
        maxGracePeriodDays: 90,
      },
      summary: `Asset allocation shift: treasury projected to ${afterState.projectedValue.toFixed(8)} (${(expectedReturn / treasuryValue * 100).toFixed(2)}% return)`,
      impactedEntities: [
        { type: 'dao-treasury', id: daoId, impact: `Allocation: ${JSON.stringify(changes)}` },
        { type: 'portfolio', id: 'strategic-portfolio', impact: `Expected return: ${expectedReturn.toFixed(8)}` },
      ],
      simulationData: {
        expectedReturn,
        bullishProjection: scenarios.bullish,
        baseProjection: scenarios.base,
        bearishProjection: scenarios.bearish,
        downside,
        upside: scenarios.bullish - treasuryValue,
      },
    };
  }

  private projectScenarios(
    treasury: number,
    allocation: Record<string, number>,
    returns: Record<string, number>,
    days: number
  ): any {
    const assets = Object.keys(allocation);
    
    // Simplified scenario projections
    let bullish = 0, base = 0, bearish = 0;

    for (const asset of assets) {
      const weight = allocation[asset] / 100;
      const ret = returns[asset] || 0;

      bullish += treasury * weight * (ret * 1.5);
      base += treasury * weight * ret;
      bearish += treasury * weight * (ret * 0.5);
    }

    return {
      bullish: treasury + bullish,
      base: treasury + base,
      bearish: treasury + bearish,
    };
  }
}

/**
 * Grant Distribution Simulator
 * Simulate distribution of treasury grants
 */
export class GrantDistributionSimulator extends SimulationService {
  constructor() {
    super('GRANT_DISTRIBUTION', SimulationDepth.ADVANCED);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const startTime = Date.now();

    const missing = this.validateRequired(params, ['daoId', 'totalGrant', 'recipients', 'treasuryBalance']);
    if (missing.length > 0) {
      return this.createError(`Missing required parameters: ${missing.join(', ')}`, params);
    }

    const { daoId, totalGrant, recipients, treasuryBalance, vesting = {} } = params;

    if (totalGrant > treasuryBalance) {
      return this.createError(`Grant amount exceeds treasury balance. Grant: ${totalGrant}, Balance: ${treasuryBalance}`, params);
    }

    // Calculate grant details
    const recipientCount = recipients.length;
    const averageGrant = totalGrant / recipientCount;

    // Simulate vesting schedules
    let totalVestingYears = 0;
    let totalVestedAtYear1 = 0;

    for (const recipient of recipients) {
      const vestingYears = vesting[recipient.id]?.years || 4;
      const vestingCliff = vesting[recipient.id]?.cliff || 1;
      
      totalVestingYears += vestingYears;
      
      // Calculate year-1 vesting
      if (vestingCliff === 0) {
        totalVestedAtYear1 += recipient.amount / vestingYears;
      } else if (vestingCliff === 1) {
        totalVestedAtYear1 += recipient.amount / vestingYears;
      }
    }

    const averageVestingYears = totalVestingYears / recipientCount;

    // Treasury impact over vesting periods
    const treasuryAtYear1 = treasuryBalance - totalVestedAtYear1;
    const treasuryAfterFullVesting = treasuryBalance - totalGrant;

    // Risk factors
    const riskFactors: string[] = [];
    const warnings: string[] = [];

    // Check concentration risk
    const maxGrant = Math.max(...recipients.map((r: any) => r.amount));
    const concentrationRatio = maxGrant / totalGrant;

    if (concentrationRatio > 0.3) {
      riskFactors.push('high-recipient-concentration');
      warnings.push(`Largest grant is ${(concentrationRatio * 100).toFixed(2)}% of total - concentration risk`);
    }

    // Check runway
    const annualBurn = totalVestedAtYear1;
    const runwayMonths = (treasuryBalance / (annualBurn / 12)) || 999;

    if (runwayMonths < 24) {
      riskFactors.push('short-runway');
      warnings.push(`Treasury runway is only ${runwayMonths.toFixed(0)} months at current burn rate`);
    }

    // Check if grants dilute governance
    if (recipients.some((r: any) => r.hasVotingRights)) {
      riskFactors.push('governance-dilution');
      warnings.push('Grants include voting rights - may dilute governance');
    }

    const beforeState = {
      treasuryBalance,
      totalGrants: 0,
      recipientCount: 0,
    };

    const afterState = {
      treasuryBalance: treasuryAfterFullVesting,
      totalGrants: totalGrant,
      recipientCount,
      averageGrantSize: averageGrant,
      averageVestingYears,
      vestingSchedule: {
        year1: totalVestedAtYear1,
        year2: totalVestedAtYear1,
        year3: totalVestedAtYear1,
        year4: totalGrant - (totalVestedAtYear1 * 3),
      },
    };

    const delta = {
      treasuryBurnRate: annualBurn,
      grantTotal: totalGrant,
      vestingCashflowYear1: totalVestedAtYear1,
    };

    const riskLevel = runwayMonths < 12 ? 'CRITICAL' :
                      runwayMonths < 24 ? 'HIGH' :
                      concentrationRatio > 0.3 ? 'MEDIUM' : 'LOW';

    return {
      status: SimulationStatus.SUCCESS,
      depth: this.depth,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime,
      beforeState,
      afterState,
      delta,
      riskLevel,
      riskFactors,
      warnings,
      errors: [],
      reversibilityWindow: {
        minGracePeriodHours: 72,
        recommendedGracePeriodHours: 720,
        maxGracePeriodDays: 30,
      },
      summary: `Grant distribution: ${totalGrant.toFixed(8)} to ${recipientCount} recipients over ${averageVestingYears} years`,
      impactedEntities: [
        { type: 'dao-treasury', id: daoId, impact: `Balance: ${treasuryBalance} → ${treasuryAfterFullVesting}` },
        { type: 'recipients', id: `${recipientCount}-recipients`, impact: `Average grant: ${averageGrant.toFixed(8)}` },
      ],
      simulationData: {
        totalGrant,
        recipientCount,
        averageGrant,
        averageVestingYears,
        concentrationRatio,
        treasuryRunwayMonths: runwayMonths,
        year1Burn: totalVestedAtYear1,
        annualBurnRate: annualBurn,
      },
    };
  }
}
