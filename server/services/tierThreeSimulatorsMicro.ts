/**
 * Tier 3: Micro-Transaction Simulators
 * 
 * 4 basic-level simulators for micro-withdrawals, tips, lending, and savings
 * Complexity: 2-3/10 (simple cost/benefit calculations)
 * 
 * File: tierThreeSimulatorsMicro.ts
 * Date: February 13, 2026
 */

import { SimulationService, SimulationParams, SimulationResult, SimulationDepth, SimulationStatus } from './simulationFramework';

/**
 * Micro-Withdrawal Simulator
 * Simulates low-value withdrawal costs and profitability
 */
export class MicroWithdrawalSimulator extends SimulationService {
  simulatorType = 'MICRO_WITHDRAWAL';
  complexity = 2;
  depth = SimulationDepth.BASIC;
  
  constructor() {
    super('MICRO_WITHDRAWAL', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        withdrawalAmount = 5,
        networkType = 'ethereum', // 'ethereum' | 'polygon' | 'optimism' | 'arbitrum'
        gasPrice = 50, // gwei (for ethereum)
      } = params;

      // Network-specific costs
      const networkCosts = this.getNetworkCosts(networkType, gasPrice);

      // Calculate profitability
      const totalFees = networkCosts.fixedFee + networkCosts.gasFeeUSD + networkCosts.percentFee;
      const netAmount = Math.max(0, withdrawalAmount - totalFees);
      const feePercentOfAmount = (totalFees / withdrawalAmount) * 100;

      // Profitability assessment
      const isProfitable = netAmount > 0 && feePercentOfAmount < 50;

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 2;
      const warnings: string[] = [];

      if (feePercentOfAmount > 50) {
        riskLevel = 'HIGH';
        riskScore = 8;
        warnings.push(`Fees exceed 50% of withdrawal amount (${feePercentOfAmount.toFixed(0)}%). Not economical.`);
      } else if (feePercentOfAmount > 20) {
        riskLevel = 'MEDIUM';
        riskScore = 5;
        warnings.push(`Fees are 20-50% of amount (${feePercentOfAmount.toFixed(0)}%). Consider batching.`);
      }

      if (networkType === 'ethereum' && gasPrice > 100) {
        warnings.push('High gas prices on Ethereum. Consider Layer 2 networks.');
      }

      if (withdrawalAmount < 1) {
        warnings.push('Extremely small amount. Consider saving and batching multiple withdrawals.');
      }

      // Recommendations
      const recommendations = this.getWithdrawalRecommendations(
        isProfitable,
        feePercentOfAmount,
        withdrawalAmount,
        networkType
      );

      const summary = 'Micro-withdrawal simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          withdrawalAmount: Number(withdrawalAmount.toFixed(2)),
          networkType,
          networkCosts: {
            fixedFee: Number(networkCosts.fixedFee.toFixed(4)),
            gasFeeUSD: Number(networkCosts.gasFeeUSD.toFixed(4)),
            percentFee: Number(networkCosts.percentFee.toFixed(4)),
            totalFees: Number(totalFees.toFixed(4)),
          },
          netAmount: Number(netAmount.toFixed(2)),
          feePercentOfAmount: Number(feePercentOfAmount.toFixed(1)),
          isProfitable,
          profitability: isProfitable ? `Net: $${netAmount.toFixed(2)}` : 'Not profitable',
          recommendations,
          optimalBatchSize: this.getOptimalBatchSize(networkType, gasPrice),
        },
        delta: {},
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: [],
        warnings: isProfitable ? [] : ['Not economical at current rates'],
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 2,
          maxGracePeriodDays: 7
        },
        summary,
        impactedEntities: [],
        simulationData: {}
      };
    } catch (error: any) {
      return this.createError(error.message, params);
    }
  }

  private getNetworkCosts(
    networkType: string,
    gasPrice: number
  ): { fixedFee: number; gasFeeUSD: number; percentFee: number } {
    const costs: Record<string, any> = {
      ethereum: { fixed: 0, gas: gasPrice * 21000 * 0.000000001 * 2500, percent: 0.01 },
      polygon: { fixed: 0, gas: 0.01, percent: 0.005 },
      optimism: { fixed: 0, gas: 0.05, percent: 0.005 },
      arbitrum: { fixed: 0, gas: 0.08, percent: 0.005 },
    };

    const cost = costs[networkType] || costs.ethereum;
    return {
      fixedFee: cost.fixed,
      gasFeeUSD: cost.gas,
      percentFee: cost.percent,
    };
  }

  private getWithdrawalRecommendations(
    isProfitable: boolean,
    feePercent: number,
    amount: number,
    network: string
  ): string[] {
    const recs = [];

    if (!isProfitable) {
      recs.push('Not profitable to withdraw now. Consider holding or batching.');
      if (network === 'ethereum') {
        recs.push('Try Polygon, Optimism, or Arbitrum for lower fees.');
      }
    } else if (feePercent > 20) {
      recs.push('Proceed with caution. Consider batching multiple withdrawals.');
      recs.push('Wait for lower gas prices if using Ethereum.');
    } else {
      recs.push('Economical withdrawal. Proceed.');
    }

    return recs;
  }

  private getOptimalBatchSize(networkType: string, gasPrice: number): Record<string, any> {
    const baseCosts = this.getNetworkCosts(networkType, gasPrice);
    const costPer5 = (baseCosts.fixedFee + baseCosts.gasFeeUSD + baseCosts.percentFee * 5) / 5;
    const costPer10 = (baseCosts.fixedFee + baseCosts.gasFeeUSD + baseCosts.percentFee * 10) / 10;
    const costPer20 = (baseCosts.fixedFee + baseCosts.gasFeeUSD + baseCosts.percentFee * 20) / 20;

    return {
      batching5: { costPerWithdrawal: Number(costPer5.toFixed(4)), savings: '20%' },
      batching10: { costPerWithdrawal: Number(costPer10.toFixed(4)), savings: '50%' },
      batching20: { costPerWithdrawal: Number(costPer20.toFixed(4)), savings: '75%' },
    };
  }
}

/**
 * Tip & Donation Simulator
 * Simulates tipping mechanisms and donation impact
 */
export class TipDonationSimulator extends SimulationService {
  simulatorType = 'TIP_DONATION';
  complexity = 2;
  depth = SimulationDepth.BASIC;
  
  constructor() {
    super('TIP_DONATION', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        tipAmount = 5,
        tipType = 'standard', // 'micro' | 'standard' | 'large' | 'premium'
        recipientType = 'creator', // 'creator' | 'charity'
        recurring = false,
        platformFeePercent = 2.5,
      } = params;

      // Tier definitions
      const tipTiers: Record<string, any> = {
        micro: { min: 0.5, max: 5, name: 'Micro Tip' },
        standard: { min: 5, max: 25, name: 'Standard Tip' },
        large: { min: 25, max: 100, name: 'Large Tip' },
        premium: { min: 100, max: Infinity, name: 'Premium Tip' },
      };

      const tier = tipTiers[tipType];

      // Fee calculation
      const platformFee = (tipAmount * platformFeePercent) / 100;
      const recipientAmount = tipAmount - platformFee;

      // Tax deductibility
      const isTaxDeductible = recipientType === 'charity';
      const taxBenefit = isTaxDeductible ? (tipAmount * 0.22) / 100 : 0; // Assume 22% tax bracket

      // Impact metrics
      const creatorMonthlyEsimate = recurring ? tipAmount * 30 : tipAmount;
      const annualImpact = recurring ? tipAmount * 365 : tipAmount;

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 1;
      const warnings: string[] = [];

      if (platformFeePercent > 5) {
        warnings.push('High platform fee. Consider direct tips if available.');
      }

      if (tipAmount < 1) {
        warnings.push('Very small tip amount. Consider batching multiple tips.');
      }

      const summary = 'Tip/donation simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          tipAmount: Number(tipAmount.toFixed(2)),
          tipTier: tier.name,
          recipientType,
          recurring,
          platformFeePercent,
          platformFeeAmount: Number(platformFee.toFixed(2)),
          recipientAmount: Number(recipientAmount.toFixed(2)),
          recipientPercent: Number(((recipientAmount / tipAmount) * 100).toFixed(1)),
          isTaxDeductible,
          taxBenefit: Number(taxBenefit.toFixed(2)),
          impact: {
            singleTipImpact: `Creator receives $${recipientAmount.toFixed(2)}`,
            monthlyImpact: recurring ? `$${(creatorMonthlyEsimate * 0.975).toFixed(2)} monthly` : 'One-time',
            annualImpact: `$${(annualImpact * 0.975).toFixed(2)} annually`,
          },
          recommendations: this.getTipRecommendations(tipAmount, platformFeePercent, recipientType),
        },
        delta: {},
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: [],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 2,
          maxGracePeriodDays: 7
        },
        summary,
        impactedEntities: [],
        simulationData: {}
      };
    } catch (error: any) {
      return this.createError(error.message, params);
    }
  }

  private getTipRecommendations(amount: number, fee: number, recipientType: string): string[] {
    const recs = [];

    if (amount < 1) {
      recs.push('Consider combining multiple small tips.');
    }

    if (fee > 5) {
      recs.push('Platform fee is high. Look for alternatives.');
    }

    if (recipientType === 'charity') {
      recs.push('Keep receipt for tax deduction.');
      recs.push('Consider monthly recurring gifts for consistency.');
    } else {
      recs.push('Regular tips help creators sustain their work.');
    }

    return recs;
  }
}

/**
 * Micro-Lending Simulator
 * Simulates micro-loan economics and repayment schedules
 */
export class MicroLoanSimulator extends SimulationService {
  simulatorType = 'MICRO_LOAN';
  complexity = 3;
  depth = SimulationDepth.BASIC;
  
  constructor() {
    super('MICRO_LOAN', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        loanAmount = 50,
        interestRatePercent = 80, // Annual APR
        repaymentPeriodDays = 14,
        loanType = 'payday', // 'payday' | 'weekly' | 'biweekly'
        borrowerAnnualIncome = 20000,
      } = params;

      // Calculate interest and total cost
      const dailyRate = interestRatePercent / 365;
      const interestAmount = (loanAmount * dailyRate * repaymentPeriodDays) / 100;
      const totalRepayment = loanAmount + interestAmount;
      const daysToRepay = repaymentPeriodDays;

      // Repayment schedule
      const dailyPayment = totalRepayment / daysToRepay;
      const weeklyPayment = totalRepayment / (daysToRepay / 7);
      const biweeklyPayment = totalRepayment / (daysToRepay / 14);

      // Affordability analysis
      const monthlyIncome = borrowerAnnualIncome / 12;
      const dailyIncome = monthlyIncome / 30;
      const dailyPaymentPercent = (dailyPayment / dailyIncome) * 100;

      // Default probability estimation
      let defaultProbability = 0;
      if (dailyPaymentPercent > 50) defaultProbability += 25;
      if (dailyPaymentPercent > 30) defaultProbability += 15;
      if (loanAmount > monthlyIncome * 0.2) defaultProbability += 10;

      defaultProbability = Math.min(100, defaultProbability);

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 2;

      if (defaultProbability > 50) {
        riskLevel = 'HIGH';
        riskScore = 8;
      } else if (defaultProbability > 30) {
        riskLevel = 'MEDIUM';
        riskScore = 5;
      }

      const warnings: string[] = [];
      if (interestRatePercent > 100) {
        warnings.push(`Extremely high APR (${interestRatePercent}%). Verify legal compliance.`);
      }
      if (defaultProbability > 30) {
        warnings.push(`Significant default risk (${defaultProbability.toFixed(0)}%).`);
      }

      const summary = 'Micro-loan simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          loanAmount: Number(loanAmount.toFixed(2)),
          loanType,
          interestRateAnnualPercent: interestRatePercent,
          repaymentPeriodDays: daysToRepay,
          interestAmountDue: Number(interestAmount.toFixed(2)),
          totalRepayment: Number(totalRepayment.toFixed(2)),
          repaymentSchedule: {
            daily: Number(dailyPayment.toFixed(2)),
            weekly: Number(weeklyPayment.toFixed(2)),
            biweekly: Number(biweeklyPayment.toFixed(2)),
          },
          affordability: {
            monthlyIncome: Number(monthlyIncome.toFixed(2)),
            dailyPaymentAmount: Number(dailyPayment.toFixed(2)),
            dailyPaymentPercentOfIncome: Number(dailyPaymentPercent.toFixed(1)),
          },
          defaultProbability: Number(defaultProbability.toFixed(0)),
          defaultRisk: defaultProbability > 50 ? 'Very High' : defaultProbability > 30 ? 'High' : 'Moderate',
          recommendations: this.getLoanRecommendations(defaultProbability, interestRatePercent),
        },
        delta: {},
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: [],
        warnings: defaultProbability > 50
          ? [`Loan appears unaffordable for borrower. Default probability: ${defaultProbability.toFixed(0)}%`]
          : [],
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 2,
          maxGracePeriodDays: 7
        },
        summary,
        impactedEntities: [],
        simulationData: {}
      };
    } catch (error: any) {
      return this.createError(error.message, params);
    }
  }

  private getLoanRecommendations(defaultProb: number, apr: number): string[] {
    const recs = [];

    if (defaultProb > 50) {
      recs.push('Loan appears unaffordable. Consider smaller amount or longer term.');
      recs.push('Verify borrower income before approval.');
    } else if (defaultProb > 30) {
      recs.push('Moderate default risk. Require income verification and payment guarantees.');
    } else {
      recs.push('Loan appears affordable. Proceed with standard underwriting.');
    }

    if (apr > 200) {
      recs.push('Verify APR complies with local usury laws.');
    }

    recs.push('Consider offering longer-term repayment to reduce default risk.');

    return recs;
  }
}

/**
 * Savings Challenge Simulator
 * Simulates savings challenges and goal achievement probability
 */
export class SavingsChallengeSimulator extends SimulationService {
  simulatorType = 'SAVINGS_CHALLENGE';
  complexity = 2;
  depth = SimulationDepth.BASIC;
  
  constructor() {
    super('SAVINGS_CHALLENGE', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        goalAmount = 1000,
        dailyDepositAmount = 5,
        challengeType = '52week', // '52week' | '100day' | 'roundup' | 'custom'
        daysInChallenge = 365,
        annualInterestRate = 4, // APY on savings
      } = params;

      // Total savings projection
      let totalSaved = 0;
      let projectedCompletionDate = new Date();

      if (challengeType === '52week') {
        // 52-week challenge: $1 week 1, $2 week 2, etc.
        totalSaved = (52 * 53) / 2; // Sum of 1 to 52
        projectedCompletionDate.setDate(projectedCompletionDate.getDate() + 365);
      } else if (challengeType === '100day') {
        // 100-day challenge
        totalSaved = dailyDepositAmount * 100;
        projectedCompletionDate.setDate(projectedCompletionDate.getDate() + 100);
      } else {
        // Custom daily saving
        totalSaved = dailyDepositAmount * daysInChallenge;
        projectedCompletionDate.setDate(projectedCompletionDate.getDate() + daysInChallenge);
      }

      // Interest calculation (simple daily compounding)
      const dailyInterestRate = annualInterestRate / 365 / 100;
      let balanceWithInterest = 0;
      let dailyBalance = 0;

      for (let day = 0; day < daysInChallenge; day++) {
        dailyBalance += dailyDepositAmount;
        dailyBalance *= 1 + dailyInterestRate;
      }

      balanceWithInterest = dailyBalance;

      // Achievement probability based on behavior analysis
      // Higher daily amounts = lower completion rate
      let achievementProbability = 100;
      if (dailyDepositAmount > 20) achievementProbability -= 20;
      if (dailyDepositAmount > 50) achievementProbability -= 30;
      if (daysInChallenge > 180) achievementProbability -= 15; // Longer challenges have lower completion
      if (daysInChallenge > 365) achievementProbability -= 20;

      achievementProbability = Math.max(20, achievementProbability);

      // Goal analysis
      const willMeetGoal = totalSaved >= goalAmount;
      const shortfall = Math.max(0, goalAmount - totalSaved);
      const surplus = Math.max(0, totalSaved - goalAmount);

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 2;
      const warnings: string[] = [];

      if (achievementProbability < 50) {
        riskLevel = 'HIGH';
        riskScore = 7;
        warnings.push(`Low completion probability (${Math.round(achievementProbability)}%). Challenge may be too ambitious.`);
      } else if (achievementProbability < 70) {
        riskLevel = 'MEDIUM';
        riskScore = 4;
        warnings.push(`Moderate completion risk (${Math.round(achievementProbability)}%). Requires commitment.`);
      }

      if (daysInChallenge > 365) {
        warnings.push('Long-term challenge. Plan for life changes and emergencies.');
      }

      if (!willMeetGoal) {
        warnings.push(`Will fall short by $${shortfall.toFixed(2)}. Consider automating or increasing daily amount.`);
      }

      const summary = 'Savings challenge simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          goalAmount: Number(goalAmount.toFixed(2)),
          challengeType,
          dailyDepositAmount: Number(dailyDepositAmount.toFixed(2)),
          daysInChallenge,
          totalSavedWithoutInterest: Number(totalSaved.toFixed(2)),
          annualInterestRate,
          interestEarned: Number((balanceWithInterest - totalSaved).toFixed(2)),
          totalSavedWithInterest: Number(balanceWithInterest.toFixed(2)),
          projectedCompletionDate: projectedCompletionDate.toISOString().split('T')[0],
          goalMet: {
            willMeetGoal,
            amount: willMeetGoal ? Number(surplus.toFixed(2)) : Number(shortfall.toFixed(2)),
            status: willMeetGoal ? `Surplus: $${surplus.toFixed(2)}` : `Shortfall: $${shortfall.toFixed(2)}`,
          },
          achievementProbability: Math.round(achievementProbability),
          motivation: this.getMotivationMessage(achievementProbability, willMeetGoal),
          tips: this.getSavingsTips(dailyDepositAmount, daysInChallenge, achievementProbability),
        },
        delta: {},
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: [],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 2,
          maxGracePeriodDays: 7
        },
        summary,
        impactedEntities: [],
        simulationData: {}
      };
    } catch (error: any) {
      return this.createError(error.message, params);
    }
  }

  private getMotivationMessage(probability: number, willMeetGoal: boolean): string {
    if (probability > 80 && willMeetGoal) {
      return '🎯 Excellent goal! You\'re very likely to succeed and exceed your target.';
    } else if (probability > 60 && willMeetGoal) {
      return '✅ Good challenge! With discipline, you can meet your goal.';
    } else if (probability > 40) {
      return '⚠️ Ambitious goal - doable but requires commitment and consistency.';
    } else {
      return '💡 Very challenging - consider starting smaller or increasing daily savings.';
    }
  }

  private getSavingsTips(dailyAmount: number, days: number, probability: number): string[] {
    const tips = [];

    if (dailyAmount < 1) {
      tips.push('Small daily amounts add up! This is very achievable.');
    } else if (dailyAmount > 50) {
      tips.push('High daily savings - automate to ensure consistency.');
      tips.push('Consider reducing amount if struggling.');
    }

    if (days > 365) {
      tips.push('Long-term challenge - build flexibility for emergencies.');
      tips.push('Review progress quarterly.');
    }

    if (probability > 80) {
      tips.push('High success probability - start immediately!');
    } else if (probability < 50) {
      tips.push('Increase odds: Set up automatic transfers to savings account.');
      tips.push('Track progress weekly for motivation.');
    }

    tips.push('Emergency access - keep savings accessible but separate.');

    return tips;
  }
}
