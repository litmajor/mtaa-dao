/**
 * Category 10: Recurring Payments Simulators (BASIC)
 * Category 11: Bounties Simulators (BASIC)
 * Category 12: Bill Split Simulators (BASIC)
 * 
 * 9 simulators for subscriptions, bounty programs, and shared expenses
 */

import { SimulationService, SimulationResult, SimulationStatus, SimulationDepth } from './simulationFramework';

// ============================================================================
// CATEGORY 10: RECURRING PAYMENTS (3 simulators)
// ============================================================================

/**
 * Subscription Management Simulator
 * Simulates recurring subscription payments and cancellation
 */
export class SubscriptionSimulator extends SimulationService {
  simulatorType = 'SUBSCRIPTION';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      monthlyPayment = 99,
      subscriptionDuration = 24,
      cancellationCancellationFeePercent = 0,
      renewalReminder = true,
      autoRenewal = true,
    } = params;

    try {
      const totalPayments = monthlyPayment * subscriptionDuration;
      const cancellationFee = totalPayments * (cancellationCancellationFeePercent / 100);
      const costToCancel = cancellationFee;
      const remainingValue = totalPayments - costToCancel;

      const warnings = [];
      if (autoRenewal && !renewalReminder) warnings.push('⚠️ Auto-renewal enabled without reminder - set reminder');
      if (cancellationCancellationFeePercent > 10) warnings.push('⚠️ High cancellation fee (>10%)');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { subscriptionDuration, autoRenewal },
        afterState: { remainingValue },
        delta: { totalPayments, costToCancel },
        riskLevel: autoRenewal && !renewalReminder ? 'MEDIUM' : 'LOW',
        riskFactors: autoRenewal && !renewalReminder ? ['auto-renewal-risk'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 72, maxGracePeriodDays: 30 },
        summary: `Subscription: $${monthlyPayment.toFixed(2)}/mo for ${subscriptionDuration} months, ${autoRenewal ? 'auto-renews' : 'no auto-renewal'}`,
        impactedEntities: [{ type: 'subscription', id: 'subscription-1', impact: `$${totalPayments.toFixed(2)} total cost` }],
        simulationData: {
          monthlyPayment: monthlyPayment.toFixed(2),
          subscriptionDuration: subscriptionDuration + ' months',
          totalPayments: totalPayments.toFixed(2),
          cancellationFeePercent: cancellationCancellationFeePercent.toFixed(2) + '%',
          cancellationFee: cancellationFee.toFixed(2),
          costToCancel: costToCancel.toFixed(2),
          remainingValue: remainingValue.toFixed(2),
          autoRenewal,
          renewalReminder,
        },
      };
    } catch (error) {
      return this.createError(`Subscription simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

/**
 * Payment Installment Simulator
 * Simulates installment payments with interest
 */
export class InstallmentSimulator extends SimulationService {
  simulatorType = 'INSTALLMENT';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      principalAmount = 10000,
      installmentCount = 12,
      annualInterestRate = 0.05,
      downPayment = 0,
    } = params;

    try {
      const loanAmount = principalAmount - downPayment;
      const monthlyRate = annualInterestRate / 12;
      const monthlyPayment = this.calculateMonthlyPayment(loanAmount, monthlyRate, installmentCount);
      const totalPayments = monthlyPayment * installmentCount;
      const totalInterest = totalPayments - loanAmount;

      const warnings = [];
      if (annualInterestRate > 0.15) warnings.push('⚠️ High interest rate (>15%)');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { principalAmount, downPayment, annualInterestRate },
        afterState: { monthlyPayment, totalInterest },
        delta: { loanAmount, totalPayments },
        riskLevel: annualInterestRate > 0.1 ? 'MEDIUM' : 'LOW',
        riskFactors: annualInterestRate > 0.1 ? ['high-interest-rate'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 72, maxGracePeriodDays: 365 },
        summary: `Installment: $${monthlyPayment.toFixed(2)}/mo for ${installmentCount} months, ${(annualInterestRate * 100).toFixed(2)}% APR`,
        impactedEntities: [{ type: 'loan', id: 'installment-1', impact: `$${totalInterest.toFixed(2)} interest` }],
        simulationData: {
          principalAmount: principalAmount.toFixed(2),
          downPayment: downPayment.toFixed(2),
          loanAmount: loanAmount.toFixed(2),
          installmentCount,
          annualInterestRate: (annualInterestRate * 100).toFixed(2) + '%',
          monthlyPayment: monthlyPayment.toFixed(2),
          totalPayments: totalPayments.toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          totalInterestPercent: ((totalInterest / loanAmount) * 100).toFixed(2) + '%',
        },
      };
    } catch (error) {
      return this.createError(`Installment simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }

  private calculateMonthlyPayment(principal: number, monthlyRate: number, months: number): number {
    if (monthlyRate === 0) return principal / months;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  }
}

/**
 * Payment Automation Simulator
 * Simulates automated payment scheduling and failure recovery
 */
export class PaymentAutomationSimulator extends SimulationService {
  simulatorType = 'PAYMENT_AUTOMATION';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalAmount = 100000,
      frequencyDaysInterval = 30,
      numberOfPayments = 12,
      failureRate = 0.02,
      retryAttempts = 3,
    } = params;

    try {
      const amountPerPayment = totalAmount / numberOfPayments;
      const expectedSuccessfulPayments = numberOfPayments * (1 - failureRate) * Math.pow(failureRate, retryAttempts);
      const likelySuccessfulPayments = Math.round(expectedSuccessfulPayments);
      const failedPayments = numberOfPayments - likelySuccessfulPayments;

      const warnings = [];
      if (failureRate > 0.05) warnings.push('⚠️ High payment failure rate (>5%)');
      if (failedPayments > 1) warnings.push(`⚠️ Estimated ${failedPayments} failed payments`);

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { numberOfPayments, failureRate },
        afterState: { likelySuccessfulPayments },
        delta: { failedPayments },
        riskLevel: failureRate > 0.05 ? 'MEDIUM' : 'LOW',
        riskFactors: failureRate > 0.05 ? ['payment-failure-risk'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 48, maxGracePeriodDays: 7 },
        summary: `Payment automation: ${likelySuccessfulPayments}/${numberOfPayments} expected successful, ${(failureRate * 100).toFixed(2)}% failure rate`,
        impactedEntities: [{ type: 'payment-automation', id: 'auto-pay-1', impact: `$${totalAmount.toFixed(2)} total` }],
        simulationData: {
          totalAmount: totalAmount.toFixed(2),
          numberOfPayments,
          amountPerPayment: amountPerPayment.toFixed(2),
          frequencyDaysInterval,
          failureRate: (failureRate * 100).toFixed(2) + '%',
          retryAttempts,
          successRate: ((1 - failureRate) * 100).toFixed(2) + '%',
          expectedSuccessfulPayments: likelySuccessfulPayments,
          estimatedFailedPayments: failedPayments,
          totalExpectedPayouts: (amountPerPayment * likelySuccessfulPayments).toFixed(2),
        },
      };
    } catch (error) {
      return this.createError(`Payment automation simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

// ============================================================================
// CATEGORY 11: BOUNTIES (3 simulators)
// ============================================================================

/**
 * Bounty Program Simulator
 * Simulates bug bounty program economics and claim distribution
 */
export class BountyProgramSimulator extends SimulationService {
  simulatorType = 'BOUNTY_PROGRAM';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalBountyPool = 100000,
      bugReportCount = 50,
      criticalBugPercent = 10,
      averagePayout = 1000,
      duplicateSubmissionRate = 0.15,
    } = params;

    try {
      const criticalBugs = Math.round(bugReportCount * (criticalBugPercent / 100));
      const uniqueSubmissions = Math.round(bugReportCount * (1 - duplicateSubmissionRate));
      const totalPayouts = uniqueSubmissions * averagePayout;
      const remainingPool = totalBountyPool - totalPayouts;
      const utilisationRate = (totalPayouts / totalBountyPool) * 100;

      const warnings = [];
      if (utilisationRate > 95) warnings.push('⚠️ Bounty pool almost depleted');
      if (duplicateSubmissionRate > 0.2) warnings.push('⚠️ High duplicate submission rate');
      if (utilisationRate < 20) warnings.push('⚠️ Low bounty pool utilization');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { bugReportCount, totalBountyPool },
        afterState: { remainingPool },
        delta: { totalPayouts },
        riskLevel: utilisationRate > 90 ? 'HIGH' : utilisationRate > 70 ? 'MEDIUM' : 'LOW',
        riskFactors: utilisationRate > 90 ? ['pool-depletion'] : utilisationRate > 70 ? ['high-utilization'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 0, recommendedGracePeriodHours: 24, maxGracePeriodDays: 30 },
        summary: `Bounty program: $${totalPayouts.toFixed(2)} paid across ${uniqueSubmissions} submissions, ${utilisationRate.toFixed(1)}% pool utilized`,
        impactedEntities: [{ type: 'bounty-pool', id: 'bounty-1', impact: `$${totalPayouts.toFixed(2)} distributed` }],
        simulationData: {
          totalBountyPool: totalBountyPool.toFixed(2),
          bugReportCount,
          criticalBugPercent: criticalBugPercent.toFixed(1) + '%',
          criticalBugCount: criticalBugs,
          duplicateSubmissionRate: (duplicateSubmissionRate * 100).toFixed(1) + '%',
          uniqueSubmissions,
          averagePayout: averagePayout.toFixed(2),
          totalPayouts: totalPayouts.toFixed(2),
          remainingPool: remainingPool.toFixed(2),
          utilisationRate: utilisationRate.toFixed(1) + '%',
        },
      };
    } catch (error) {
      return this.createError(`Bounty program simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

/**
 * Reward Distribution Simulator
 * Simulates reward distribution across multiple recipients
 */
export class RewardDistributionSimulator extends SimulationService {
  simulatorType = 'REWARD_DISTRIBUTION';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalRewards = 50000,
      recipientCount = 100,
      distributionMethod = 'proportional', // proportional, equal, tiered
      vetingCost = 100,
      processingFeePercent = 0.5,
    } = params;

    try {
      const totalVettingCost = recipientCount * vetingCost;
      const processingFee = totalRewards * (processingFeePercent / 100);
      const totalCosts = totalVettingCost + processingFee;
      const netRewards = totalRewards - totalCosts;
      const averagePerRecipient = netRewards / recipientCount;

      const warnings = [];
      if (totalCosts > totalRewards * 0.1) warnings.push('⚠️ High overhead costs (>10% of pool)');
      if (averagePerRecipient < 100) warnings.push('⚠️ Low average reward per recipient');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { recipientCount, totalRewards },
        afterState: { netRewards },
        delta: { totalCosts },
        riskLevel: totalCosts > totalRewards * 0.1 ? 'MEDIUM' : 'LOW',
        riskFactors: totalCosts > totalRewards * 0.1 ? ['high-overhead'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 72, maxGracePeriodDays: 30 },
        summary: `Reward distribution: ${recipientCount} recipients, $${netRewards.toFixed(2)} net rewards, ${((totalCosts / totalRewards) * 100).toFixed(2)}% overhead`,
        impactedEntities: [{ type: 'reward-pool', id: 'rewards-1', impact: `$${totalRewards.toFixed(2)} distributed` }],
        simulationData: {
          totalRewards: totalRewards.toFixed(2),
          recipientCount,
          distributionMethod,
          averagePerRecipient: averagePerRecipient.toFixed(2),
          totalVettingCost: totalVettingCost.toFixed(2),
          vetingCostPerRecipient: vetingCost.toFixed(2),
          processingFeePercent: processingFeePercent.toFixed(2) + '%',
          processingFee: processingFee.toFixed(2),
          totalCosts: totalCosts.toFixed(2),
          netRewards: netRewards.toFixed(2),
          overheadPercent: ((totalCosts / totalRewards) * 100).toFixed(2) + '%',
        },
      };
    } catch (error) {
      return this.createError(`Reward distribution simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

/**
 * Bounty Completion Simulator
 * Simulates bounty completion timelines and incentive alignment
 */
export class BountyCompletionSimulator extends SimulationService {
  simulatorType = 'BOUNTY_COMPLETION';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      bountyAmount = 5000,
      targetCompletionDays = 30,
      incentiveMultiplier = 1.2,
      earlyCompletionDays = 14,
    } = params;

    try {
      const earlyIncentive = bountyAmount * (incentiveMultiplier - 1);
      const maxReward = bountyAmount + earlyIncentive;
      const baseCostOfCapital = (bountyAmount * 0.05 * (targetCompletionDays / 365));

      const warnings = [];
      if (targetCompletionDays > 60) warnings.push('⚠️ Long target completion window');
      if (incentiveMultiplier > 1.5) warnings.push('⚠️ High early completion bonus');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { bountyAmount, targetCompletionDays },
        afterState: { maxReward: maxReward },
        delta: { earlyIncentive },
        riskLevel: targetCompletionDays > 60 ? 'MEDIUM' : 'LOW',
        riskFactors: targetCompletionDays > 60 ? ['long-completion-window'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 72, maxGracePeriodDays: 90 },
        summary: `Bounty completion: $${bountyAmount.toFixed(2)} base, ${targetCompletionDays} days target, ${incentiveMultiplier}x early multiplier`,
        impactedEntities: [{ type: 'bounty', id: 'bounty-1', impact: `Max reward: $${maxReward.toFixed(2)}` }],
        simulationData: {
          bountyAmount: bountyAmount.toFixed(2),
          targetCompletionDays,
          baseReward: bountyAmount.toFixed(2),
          incentiveMultiplier: incentiveMultiplier.toFixed(2) + 'x',
          earlyCompletionDays,
          earlyIncentive: earlyIncentive.toFixed(2),
          maxPossibleReward: maxReward.toFixed(2),
          costOfCapital: baseCostOfCapital.toFixed(2),
          netBountyValue: (bountyAmount - baseCostOfCapital).toFixed(2),
        },
      };
    } catch (error) {
      return this.createError(`Bounty completion simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

// ============================================================================
// CATEGORY 12: BILL SPLIT (3 simulators)
// ============================================================================

/**
 * Bill Split Calculator Simulator
 * Simulates expense splitting and settlement
 */
export class BillSplitSimulator extends SimulationService {
  simulatorType = 'BILL_SPLIT';
  complexity = 2;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalExpense = 150,
      participantCount = 3,
      splitMethod = 'equal', // equal, proportional, itemized
      applicationFeePercent = 1.5,
    } = params;

    try {
      const baseAmountPerPerson = totalExpense / participantCount;
      const applicationFee = totalExpense * (applicationFeePercent / 100);
      const totalWithFee = totalExpense + applicationFee;
      const amountPerPersonWithFee = totalWithFee / participantCount;

      const warnings = [];
      if (applicationFeePercent > 2) warnings.push('⚠️ High application fee');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { totalExpense, participantCount },
        afterState: { totalWithFee },
        delta: { applicationFee },
        riskLevel: 'LOW',
        riskFactors: [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 0, recommendedGracePeriodHours: 24, maxGracePeriodDays: 7 },
        summary: `Bill split: $${totalExpense.toFixed(2)} among ${participantCount} people, $${amountPerPersonWithFee.toFixed(2)} per person with fee`,
        impactedEntities: [{ type: 'expense-split', id: 'bill-1', impact: `$${totalExpense.toFixed(2)} total` }],
        simulationData: {
          totalExpense: totalExpense.toFixed(2),
          participantCount,
          splitMethod,
          baseAmountPerPerson: baseAmountPerPerson.toFixed(2),
          applicationFeePercent: applicationFeePercent.toFixed(2) + '%',
          applicationFee: applicationFee.toFixed(2),
          totalWithFee: totalWithFee.toFixed(2),
          amountPerPersonWithFee: amountPerPersonWithFee.toFixed(2),
        },
      };
    } catch (error) {
      return this.createError(`Bill split simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

/**
 * Expense Reimbursement Simulator
 * Simulates expense tracking and reimbursement workflows
 */
export class ExpenseReimbursementSimulator extends SimulationService {
  simulatorType = 'EXPENSE_REIMBURSEMENT';
  complexity = 2;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalExpense = 500,
      advancedByPerson = 'Alice',
      participants = ['Alice', 'Bob', 'Charlie'],
      approvalTime = 3,
      paymentTime = 5,
    } = params;

    try {
      const perPersonShare = totalExpense / participants.length;
      const reimbursementsNeeded: Array<{ person: string; owes: string }> = participants
        .filter((p: string) => p !== advancedByPerson)
        .map((p: string) => ({
          person: p,
          owes: perPersonShare.toFixed(2),
        }));

      const totalTimeDays = approvalTime + paymentTime;

      const warnings = [];
      if (totalTimeDays > 10) warnings.push('⚠️ Slow reimbursement timeline');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { totalExpense, participantCount: participants.length },
        afterState: { totalReimbursements: reimbursementsNeeded.length * perPersonShare },
        delta: { perPersonShare },
        riskLevel: 'LOW',
        riskFactors: totalTimeDays > 10 ? ['slow-reimbursement'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 48, maxGracePeriodDays: 14 },
        summary: `Expense reimbursement: ${participants.length} people, $${totalExpense.toFixed(2)} total, $${perPersonShare.toFixed(2)} per person`,
        impactedEntities: [{ type: 'expense-reimbursement', id: 'reimburse-1', impact: `$${(reimbursementsNeeded.length * perPersonShare).toFixed(2)} to distribute` }],
        simulationData: {
          totalExpense: totalExpense.toFixed(2),
          participantCount: participants.length,
          advancedByPerson,
          sharePerPerson: perPersonShare.toFixed(2),
          reimbursementsNeeded,
          approvalTime: approvalTime + ' days',
          paymentTime: paymentTime + ' days',
          totalTimeDays,
        },
      };
    } catch (error) {
      return this.createError(`Expense reimbursement simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}

/**
 * Group Settlement Simulator
 * Simulates optimal settlement of multi-party debts
 */
export class GroupSettlementSimulator extends SimulationService {
  simulatorType = 'GROUP_SETTLEMENT';
  complexity = 3;
  depth = SimulationDepth.BASIC;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      totalExpenses = 1000,
      participantCount = 5,
      debtsComplexity = 'high', // low, medium, high
      settlementCost = 25,
    } = params;

    try {
      // Estimate complexity
      const estimatedTransactions = debtsComplexity === 'high' ? (participantCount - 1) : (participantCount * 0.5);
      const totalSettlementCost = estimatedTransactions * settlementCost;
      const averageDebt = totalExpenses / participantCount;
      const totalCostPercent = (totalSettlementCost / totalExpenses) * 100;

      const warnings = [];
      if (totalCostPercent > 5) warnings.push('⚠️ Settlement costs exceed 5% of total');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { totalExpenses, participantCount },
        afterState: { netAfterCosts: totalExpenses - totalSettlementCost },
        delta: { totalSettlementCost },
        riskLevel: totalCostPercent > 5 ? 'MEDIUM' : 'LOW',
        riskFactors: totalCostPercent > 5 ? ['high-settlement-cost'] : [],
        warnings,
        errors: [],
        reversibilityWindow: { minGracePeriodHours: 24, recommendedGracePeriodHours: 72, maxGracePeriodDays: 30 },
        summary: `Group settlement: ${participantCount} participants, ${debtsComplexity} complexity, ${Math.ceil(estimatedTransactions)} transactions, ${totalCostPercent.toFixed(2)}% cost`,
        impactedEntities: [{ type: 'group-settlement', id: 'settlement-1', impact: `$${totalExpenses.toFixed(2)} expenses settled` }],
        simulationData: {
          totalExpenses: totalExpenses.toFixed(2),
          participantCount,
          debtsComplexity,
          averageDebtPerPerson: averageDebt.toFixed(2),
          estimatedTransactions: Math.ceil(estimatedTransactions),
          costPerTransaction: settlementCost.toFixed(2),
          totalSettlementCost: totalSettlementCost.toFixed(2),
          totalCostPercent: totalCostPercent.toFixed(2) + '%',
          netAfterCosts: (totalExpenses - totalSettlementCost).toFixed(2),
        },
      };
    } catch (error) {
      return this.createError(`Group settlement simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }
}
