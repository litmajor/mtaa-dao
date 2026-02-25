/**
 * Category 4: Investment Operations Simulators (INTERMEDIATE)
 * 
 * 4 simulators for investment and portfolio management operations
 * Uses Monte Carlo simulation and risk analytics
 */

import { SimulationService, SimulationResult, SimulationStatus, SimulationDepth } from './simulationFramework';

/**
 * Portfolio Rebalance Simulator
 * Simulates portfolio rebalancing with drift correction and slippage
 */
export class PortfolioRebalanceSimulator extends SimulationService {
  simulatorType = 'PORTFOLIO_REBALANCE';
  complexity = 5;
  depth = SimulationDepth.INTERMEDIATE;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      portfolioValue = 100000,
      targetAllocation = { stocks: 0.6, bonds: 0.3, crypto: 0.1 },
      currentAllocation = { stocks: 0.75, bonds: 0.15, crypto: 0.1 },
      maxSlippage = 0.01,
      rebalancingFrequency = 'quarterly',
    } = params;

    try {
      // Calculate drift
      const drift = this.calculateAllocationDrift(currentAllocation, targetAllocation);
      
      // Calculate rebalancing trades needed
      const trades = this.calculateRebalancingTrades(
        portfolioValue,
        currentAllocation,
        targetAllocation
      );

      // Estimate transaction costs
      const transactionCosts = this.estimateTransactionCosts(trades, maxSlippage);
      const slippageImpact = this.estimateSlippageImpact(trades, maxSlippage);

      // Run Monte Carlo (1000 scenarios)
      const scenarios = this.runMonteCarlo(1000, {
        portfolioValue,
        trades,
        slippage: maxSlippage,
        rebalancingFrequency,
      });

      // Calculate metrics
      const avgOutcome = scenarios.reduce((a, b) => a + b.finalValue, 0) / scenarios.length;
      const successRate = scenarios.filter(s => s.finalValue >= portfolioValue * 0.95).length / scenarios.length;
      const worstCase = Math.min(...scenarios.map(s => s.finalValue));
      const bestCase = Math.max(...scenarios.map(s => s.finalValue));

      // Warnings
      const warnings = [];
      if (drift > 0.15) warnings.push(`High allocation drift detected (${(drift * 100).toFixed(1)}%)`);
      if (transactionCosts > portfolioValue * 0.01) warnings.push(`High transaction costs (${(transactionCosts / portfolioValue * 100).toFixed(2)}%)`);
      if (successRate < 0.85) warnings.push('Below-average success probability');

      // Risk badge
      const riskScore = Math.min(10, Math.round(drift * 50 + transactionCosts / portfolioValue * 1000));
      const riskLevel = riskScore > 7 ? 'HIGH' : riskScore > 4 ? 'MEDIUM' : 'LOW';

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { portfolioValue, currentAllocation },
        afterState: { portfolioValue: avgOutcome, targetAllocation },
        delta: { valueChange: avgOutcome - portfolioValue, driftReduction: drift },
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: transactionCosts > portfolioValue * 0.01 ? ['high-costs'] : [],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: 7,
        },
        summary: `Portfolio rebalance: ${successRate > 0.85 ? 'high' : 'moderate'} success probability`,
        impactedEntities: [{ type: 'portfolio', id: 'portfolio', impact: `${trades.length} trades, ${(transactionCosts / portfolioValue * 100).toFixed(2)}% cost` }],
        simulationData: { trades: trades.length, transactionCosts, successRate, worstCase, bestCase, rebalancingFrequency },
      };
    } catch (error) {
      return this.createError(`Portfolio rebalance simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }

  private calculateAllocationDrift(current: any, target: any): number {
    let drift = 0;
    for (const asset in target) {
      drift += Math.abs((current[asset] || 0) - target[asset]);
    }
    return drift / 2; // Normalized drift
  }

  private calculateRebalancingTrades(value: number, current: any, target: any): any[] {
    const trades = [];
    for (const asset in target) {
      const currentAmount = (current[asset] || 0) * value;
      const targetAmount = target[asset] * value;
      if (Math.abs(targetAmount - currentAmount) > 100) {
        trades.push({
          asset,
          action: targetAmount > currentAmount ? 'BUY' : 'SELL',
          amount: Math.abs(targetAmount - currentAmount),
        });
      }
    }
    return trades;
  }

  private estimateTransactionCosts(trades: any[], slippage: number): number {
    return trades.reduce((sum, trade) => sum + trade.amount * slippage, 0);
  }

  private estimateSlippageImpact(trades: any[], maxSlippage: number): number {
    const baseSlippage = trades.reduce((sum, trade) => sum + trade.amount, 0) * maxSlippage;
    return baseSlippage * 1.2; // 20% additional impact
  }

  private runMonteCarlo(iterations: number, params: any): any[] {
    const scenarios = [];
    for (let i = 0; i < iterations; i++) {
      const volatility = 0.15 + Math.random() * 0.1;
      const drift = 0.08 + Math.random() * 0.04;
      const slippageMultiplier = 1 - Math.random() * params.slippage;
      
      const finalValue = params.portfolioValue * 
        Math.exp((drift - volatility ** 2 / 2) * 0.25 + volatility * Math.sqrt(0.25) * this.gaussianRandom()) *
        slippageMultiplier;
      
      scenarios.push({ finalValue });
    }
    return scenarios;
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

/**
 * Dividend Reinvestment Simulator
 * Simulates DRIP strategy impact on portfolio growth
 */
export class DividendReinvestmentSimulator extends SimulationService {
  simulatorType = 'DIVIDEND_REINVESTMENT';
  complexity = 4;
  depth = SimulationDepth.INTERMEDIATE;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      portfolioValue = 100000,
      dividendYield = 0.03,
      investmentTerm = 5,
      compoundingFrequency = 'quarterly',
      taxRate = 0.2,
      enableReinvestment = true,
    } = params;

    try {
      // Calculate with DRIP
      const withDrip = this.calculateDripValue(
        portfolioValue,
        dividendYield,
        investmentTerm,
        taxRate
      );

      // Calculate without DRIP (dividend taken as cash)
      const withoutDrip = this.calculateNoDripValue(
        portfolioValue,
        dividendYield,
        investmentTerm,
        taxRate
      );

      const totalGainDrip = withDrip - portfolioValue;
      const totalGainNoDrip = withoutDrip - portfolioValue;
      const dripAdditionalGain = totalGainDrip - totalGainNoDrip;

      // Annual breakdown
      const annualBreakdown = [];
      for (let year = 1; year <= investmentTerm; year++) {
        const value = this.calculateDripValue(portfolioValue, dividendYield, year, taxRate);
        annualBreakdown.push({
          year,
          value: value.toFixed(2),
          gain: (value - portfolioValue).toFixed(2),
        });
      }

      const warnings = [];
      if (taxRate > 0.25) warnings.push('High tax rate significantly impacts DRIP benefits');
      if (dividendYield < 0.02) warnings.push('Low dividend yield limits compounding benefits');

      const riskScore = Math.round(taxRate * 3 + (1 - dividendYield) * 5);

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { portfolioValue, dividendYield, investmentTerm },
        afterState: { withDrip, withoutDrip },
        delta: { dripAdvantage: withDrip - withoutDrip },
        riskLevel: taxRate > 0.3 ? 'MEDIUM' : 'LOW',
        riskFactors: taxRate > 0.3 ? ['tax-impact'] : [],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 24,
          recommendedGracePeriodHours: 48,
          maxGracePeriodDays: 30,
        },
        summary: `Dividend reinvestment: ${((withDrip / portfolioValue - 1) * 100).toFixed(2)}% growth over ${investmentTerm} years`,
        impactedEntities: [{ type: 'portfolio', id: 'drip', impact: `${portfolioValue.toFixed(2)} MTAA base investment` }],
        simulationData: { portfolioValue, dividendYield, withDrip, withoutDrip, investmentTerm, taxRate },
      };
    } catch (error) {
      return this.createError(`DRIP simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }

  private calculateDripValue(principal: number, yield_: number, years: number, taxRate: number): number {
    const afterTaxYield = yield_ * (1 - taxRate);
    return principal * Math.pow(1 + afterTaxYield, years);
  }

  private calculateNoDripValue(principal: number, yield_: number, years: number, taxRate: number): number {
    const afterTaxDividend = principal * yield_ * (1 - taxRate);
    return principal + afterTaxDividend * years;
  }
}

/**
 * Margin Lending Simulator
 * Simulates margin borrowing and repayment with interest costs
 */
export class MarginLendingSimulator extends SimulationService {
  simulatorType = 'MARGIN_LENDING';
  complexity = 6;
  depth = SimulationDepth.INTERMEDIATE;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      loanAmount = 50000,
      collateralValue = 100000,
      loanDuration = 12,
      annualInterestRate = 0.08,
      collateralAsset = 'BTC',
      priceVolatility = 0.4,
    } = params;

    try {
      const collateralRatio = collateralValue / loanAmount;
      const liquidationPrice = collateralValue / (loanAmount * 1.5);
      const totalInterest = this.calculateTotalInterest(loanAmount, annualInterestRate, loanDuration);
      
      // Run Monte Carlo for price scenarios
      const priceScenarios = this.runPriceScenarios(100, collateralValue, priceVolatility, loanDuration);
      const liquidationRisk = priceScenarios.filter(s => s.finalPrice < liquidationPrice).length / priceScenarios.length;

      const warnings = [];
      if (collateralRatio < 1.5) warnings.push('⚠️ Collateral ratio below safety threshold');
      if (liquidationRisk > 0.2) warnings.push('⚠️ Significant liquidation risk detected');
      if (annualInterestRate > 0.1) warnings.push('⚠️ High interest rate impacts profitability');

      const riskScore = Math.min(10, Math.round((1 - liquidationRisk) * 5 + (1 - collateralRatio / 3) * 5));

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { loanAmount, collateralValue, annualInterestRate },
        afterState: { totalInterest, liquidationPrice },
        delta: { interestCost: totalInterest, collateralUsed: loanAmount },
        riskLevel: liquidationRisk > 0.2 ? 'HIGH' : 'MEDIUM',
        riskFactors: liquidationRisk > 0.2 ? ['liquidation-risk'] : [],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 6,
          maxGracePeriodDays: 30,
        },
        summary: `Margin loan: ${loanAmount.toFixed(2)} MTAA at ${(annualInterestRate * 100).toFixed(2)}% APR`,
        impactedEntities: [{ type: 'margin', id: 'loan', impact: `${loanAmount.toFixed(2)} MTAA borrowed` }],
        simulationData: { loanAmount, collateralRatio, liquidationPrice, annualInterestRate },
      };
    } catch (error) {
      return this.createError(`Margin lending simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }

  private calculateTotalInterest(principal: number, rate: number, months: number): number {
    return principal * rate * (months / 12);
  }

  private runPriceScenarios(iterations: number, basePrice: number, volatility: number, timeperiods: number): any[] {
    const scenarios = [];
    for (let i = 0; i < iterations; i++) {
      let price = basePrice;
      for (let t = 0; t < timeperiods; t++) {
        const drift = 0.01;
        const shock = volatility * this.gaussianRandom() * Math.sqrt(1 / 12);
        price *= Math.exp(drift / 12 + shock);
      }
      scenarios.push({ finalPrice: price });
    }
    return scenarios;
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

/**
 * Fixed Income Investment Simulator
 * Simulates bond, treasury, and fixed income strategies
 */
export class FixedIncomeSimulator extends SimulationService {
  simulatorType = 'FIXED_INCOME';
  complexity = 4;
  depth = SimulationDepth.INTERMEDIATE;

  async simulate(params: any): Promise<SimulationResult> {
    const startTime = Date.now();
    const {
      investmentAmount = 100000,
      bondType = 'corporate', // corporate, government, municipal, high-yield
      maturityYears = 5,
      couponRate = 0.04,
      creditRating = 'A',
      marketYieldChange = 0.01,
    } = params;

    try {
      // Calculate bond value
      const presentValue = this.calculateBondValue(
        investmentAmount,
        couponRate,
        maturityYears,
        marketYieldChange
      );

      const priceChange = presentValue - investmentAmount;
      const ytm = this.calculateYield(investmentAmount, couponRate, maturityYears, investmentAmount);

      // Duration analysis
      const duration = this.calculateDuration(couponRate, maturityYears, ytm);
      const durationRisk = (duration * marketYieldChange * 100).toFixed(2);

      // Credit risk based on rating
      const defaultRisk = this.getDefaultRiskByRating(creditRating);
      const defaultProbability = defaultRisk * (6 - creditRating.length); // Simplified

      // Tax impact
      const taxableIncome = investmentAmount * couponRate * maturityYears;
      const afterTaxIncome = taxableIncome * 0.8; // 20% tax rate

      const warnings = [];
      if (maturityYears > 10) warnings.push('Long duration increases interest rate risk');
      if (creditRating === 'B' || creditRating === 'C') warnings.push('Non-investment grade: Higher default risk');
      if (couponRate < 0.02) warnings.push('Low coupon rate relative to current environment');

      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        beforeState: { investmentAmount, bondType, couponRate, maturityYears, creditRating, marketYieldChange },
        afterState: { presentValue, yieldToMaturity: ytm, priceChange, afterTaxIncome },
        delta: { priceChange, yieldChange: (ytm - couponRate).toFixed(4) },
        riskLevel: defaultRisk > 0.05 ? 'HIGH' : defaultRisk > 0.02 ? 'MEDIUM' : 'LOW',
        riskFactors: [
          ...(parseFloat(durationRisk) > 5 ? ['duration-risk'] : []),
          ...(defaultRisk > 0.02 ? ['default-risk'] : []),
          ...(priceChange < 0 ? ['price-risk'] : []),
        ],
        warnings,
        errors: [],
        reversibilityWindow: {
          minGracePeriodHours: 1,
          recommendedGracePeriodHours: 24,
          maxGracePeriodDays: 30,
        },
        summary: `Fixed income analysis: ${bondType} bond, ${maturityYears}yr, ${creditRating} rated, YTM: ${ytm.toFixed(2)}%`,
        impactedEntities: [{ type: 'bond', id: 'bond-position', impact: `Value: ${presentValue.toFixed(2)}, Tax: ${(taxableIncome * 0.2).toFixed(2)}` }],
        simulationData: {
          investmentAmount: investmentAmount.toFixed(2),
          bondType,
          maturityYears,
          couponRate: (couponRate * 100).toFixed(2) + '%',
          creditRating,
          currentValue: presentValue.toFixed(2),
          priceChange: priceChange.toFixed(2),
          yieldToMaturity: ytm.toFixed(2),
          annualCoupon: (investmentAmount * couponRate).toFixed(2),
          totalCouponIncome: taxableIncome.toFixed(2),
          afterTaxIncome: afterTaxIncome.toFixed(2),
          duration: duration.toFixed(2) + ' years',
          durationRisk: durationRisk + '%',
          defaultProbability: (defaultProbability * 100).toFixed(2) + '%',
          pricingDate: new Date().toISOString(),
          marketYieldChange: (marketYieldChange * 100).toFixed(2) + '%',
        },
      };
    } catch (error) {
      return this.createError(`Fixed income simulation failed: ${error instanceof Error ? error.message : String(error)}`, params);
    }
  }

  private calculateBondValue(faceValue: number, couponRate: number, years: number, yieldChange: number): number {
    const yields = couponRate + yieldChange;
    let pv = 0;
    for (let t = 1; t <= years; t++) {
      pv += (faceValue * couponRate) / Math.pow(1 + yields, t);
    }
    pv += faceValue / Math.pow(1 + yields, years);
    return pv;
  }

  private calculateYield(price: number, coupon: number, years: number, faceValue: number): number {
    // Simplified YTM calculation
    const annualCoupon = faceValue * coupon;
    const gainPerYear = (faceValue - price) / years;
    return (annualCoupon + gainPerYear) / ((price + faceValue) / 2);
  }

  private calculateDuration(coupon: number, years: number, yield_: number): number {
    // Macaulay duration approximation
    return (1 + yield_) / yield_ - (years / (Math.pow(1 + yield_, years) - 1));
  }

  private getDefaultRiskByRating(rating: string): number {
    const risks: any = { AAA: 0.001, AA: 0.003, A: 0.008, BBB: 0.02, BB: 0.05, B: 0.1, C: 0.2 };
    return risks[rating] || 0.05;
  }
}
