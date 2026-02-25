/**
 * Tier 3: Referral Program Simulators
 * 
 * 4 basic-level simulators for referral programs, rewards, tiers, and fraud detection
 * Complexity: 2-3/10 (simple growth models and tier calculations)
 * 
 * File: tierThreeSimulatorsReferral.ts
 * Date: February 13, 2026
 */

import { SimulationService, SimulationParams, SimulationResult, SimulationDepth, SimulationStatus } from './simulationFramework';

/**
 * Referral Generation Simulator
 * Simulates referral growth and viral network effects
 */
export class ReferralGenerationSimulator extends SimulationService {
  constructor() {
    super('REFERRAL_GENERATION', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        startingReferrals = 10,
        monthlyGrowthRate = 0.15, // 15% per month
        viralCoefficient = 1.2, // Each referrer brings 1.2 new users
        projectionMonths = 12,
      } = params;

      // Project growth over 3, 6, 12 months
      const projections: Record<string, any> = {};
      for (let i = 1; i <= projectionMonths; i += 3) {
        const projected = startingReferrals * Math.pow(1 + monthlyGrowthRate, i) * Math.pow(viralCoefficient, i / 3);
        projections[`month_${i}`] = {
          months: i,
          projectedReferrals: Math.round(projected),
          cumulative: Math.round(startingReferrals * ((Math.pow(1 + monthlyGrowthRate, i) - 1) / monthlyGrowthRate)),
        };
      }

      // Viral analysis
      const isViral = viralCoefficient > 1;
      const viralMultiplier = viralCoefficient;

      // Growth trajectory
      let growthStatus = 'DECLINING';
      if (monthlyGrowthRate > 0.3) growthStatus = 'ACCELERATING';
      else if (monthlyGrowthRate > 0.1) growthStatus = 'STEADY';
      else if (monthlyGrowthRate > 0) growthStatus = 'SLOW';

      // Risk assessment
      let riskLevel = 'MEDIUM';
      let riskScore = 5;
      const warnings: string[] = [];

      if (!isViral || viralCoefficient <= 1) {
        riskLevel = 'HIGH';
        riskScore = 7;
        warnings.push('Viral coefficient < 1. Network will decline over time.');
      } else if (viralCoefficient < 1.1) {
        riskLevel = 'MEDIUM';
        riskScore = 5;
        warnings.push('Low viral coefficient. Growth marginal.');
      } else {
        riskLevel = 'LOW';
        riskScore = 2;
      }

      if (monthlyGrowthRate <= 0) {
        warnings.push('Negative or zero growth. Program losing referrals.');
      }

      if (startingReferrals < 5) {
        warnings.push('Small starting base. Highly vulnerable to churn.');
      }

      const summary = 'Referral generation simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          startingReferrals,
          monthlyGrowthRate: Number((monthlyGrowthRate * 100).toFixed(1)),
          viralCoefficient: Number(viralCoefficient.toFixed(2)),
          growthStatus,
          projections,
          breakEvenPoint: viralCoefficient > 1 ? 'N/A - Perpetual growth' : `Month ${Math.ceil(Math.log(1 / (1 - monthlyGrowthRate)) / Math.log(1 + monthlyGrowthRate))}`,
          saturationRisk: monthlyGrowthRate > 0.5 ? 'Could saturate market' : 'Sustainable pace',
          marketPotential: this.estimateMarketPotential(viralCoefficient, startingReferrals),
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

  private estimateMarketPotential(viral: number, start: number): Record<string, any> {
    if (viral <= 1) {
      return {
        potential: 'Limited - Non-viral program',
        estimate: '< 1000 total',
        timeToSaturation: 'Declining',
      };
    }

    const yearProjection = start * Math.pow(viral, 12);
    let potential = 'High';
    let estimate = `${Math.round(yearProjection).toLocaleString()}+`;

    if (yearProjection > 100000) {
      potential = 'Exceptional - Exponential growth';
    } else if (yearProjection > 10000) {
      potential = 'Strong - Solid viral growth';
    }

    return {
      potential,
      estimate,
      doubleTimeMonths: Math.round(Math.log(2) / Math.log(viral)),
    };
  }
}

/**
 * Referral Rewards Simulator
 * Simulates reward structures and payout scenarios
 */
export class ReferralRewardsSimulator extends SimulationService {
  constructor() {
    super('REFERRAL_REWARDS', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        rewardPerReferral = 10, // $ per referral
        activeReferrals = 50, // Number of active referrals
        conversionRate = 0.8, // % that convert to paying
        payoutFrequency = 'weekly', // 'daily' | 'weekly' | 'monthly'
        monthlyActiveReferrals = 15, // New referrals per month
      } = params;

      // Monthly calculations
      const convertedReferrals = Math.round(activeReferrals * conversionRate);
      const monthlyRewardFromBase = convertedReferrals * rewardPerReferral;
      const monthlyRewardFromNew = monthlyActiveReferrals * rewardPerReferral;
      const totalMonthlyReward = monthlyRewardFromBase + monthlyRewardFromNew;

      // Payout schedule
      const payoutAmounts: Record<string, number> = {};
      if (payoutFrequency === 'daily') {
        payoutAmounts.daily = Number((totalMonthlyReward / 30).toFixed(2));
        payoutAmounts.weekly = Number((totalMonthlyReward / 4).toFixed(2));
        payoutAmounts.monthly = totalMonthlyReward;
      } else if (payoutFrequency === 'weekly') {
        payoutAmounts.weekly = Number((totalMonthlyReward / 4).toFixed(2));
        payoutAmounts.monthly = totalMonthlyReward;
      } else {
        payoutAmounts.monthly = totalMonthlyReward;
      }

      // Annual projection
      const annualReward = totalMonthlyReward * 12;

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 2;
      const warnings: string[] = [];

      if (conversionRate < 0.5) {
        riskLevel = 'HIGH';
        riskScore = 7;
        warnings.push('Low conversion rate (<50%). Many referrals not monetizing.');
      } else if (conversionRate < 0.7) {
        riskLevel = 'MEDIUM';
        riskScore = 4;
        warnings.push('Below-average conversion rate. Investigate drop-off.');
      }

      if (rewardPerReferral < 5) {
        warnings.push('Low reward-per-referral. May not incentivize effort.');
      }

      if (monthlyActiveReferrals < 5) {
        warnings.push('Low monthly growth rate. Reward stagnating.');
      }

      // Program sustainability
      const yearlyCost = annualReward;
      const costPerReferral = rewardPerReferral;

      const summary = 'Referral rewards simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          rewardPerReferral: Number(rewardPerReferral.toFixed(2)),
          activeReferrals,
          conversionRate: Number((conversionRate * 100).toFixed(0)),
          convertedReferrals,
          monthlyActiveReferralsCount: monthlyActiveReferrals,
          monthlyRewardFromBase: Number(monthlyRewardFromBase.toFixed(2)),
          monthlyRewardFromNew: Number(monthlyRewardFromNew.toFixed(2)),
          totalMonthlyReward: Number(totalMonthlyReward.toFixed(2)),
          payoutFrequency,
          payoutSchedule: {
            daily: payoutAmounts.daily,
            weekly: payoutAmounts.weekly,
            monthly: payoutAmounts.monthly,
          },
          annualProjection: Number(annualReward.toFixed(2)),
          costPerReferral,
          sustainability: totalMonthlyReward > 100 ? 'Sustainable' : totalMonthlyReward > 50 ? 'Marginal' : 'Unsustainable',
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
}

/**
 * Referral Tier Advancement Simulator
 * Simulates tier progression and tier-based bonus multipliers
 */
export class ReferralTierAdvancementSimulator extends SimulationService {
  constructor() {
    super('REFERRAL_TIER', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        currentReferrals = 5,
        monthlyGrowthRate = 0.2, // 20% monthly growth
        currentTier = 'bronze', // 'bronze' | 'silver' | 'gold' | 'platinum'
      } = params;

      // Tier structure
      const tiers = {
        bronze: { minReferrals: 0, maxReferrals: 10, multiplier: 1 },
        silver: { minReferrals: 11, maxReferrals: 25, multiplier: 1.5 },
        gold: { minReferrals: 26, maxReferrals: 50, multiplier: 2 },
        platinum: { minReferrals: 51, maxReferrals: Infinity, multiplier: 3 },
      };

      const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
      const tierIndex = tierOrder.indexOf(currentTier);
      const tierDef = tiers[currentTier as keyof typeof tiers];

      // Calculate progression
      const referralsUntilNextTier =
        tierIndex < tierOrder.length - 1
          ? tiers[tierOrder[tierIndex + 1] as keyof typeof tiers].minReferrals - currentReferrals
          : 0;

      // Months to next tier
      let monthsToNextTier = Infinity;
      if (referralsUntilNextTier > 0 && monthlyGrowthRate > 0) {
        monthsToNextTier = Math.log(currentReferrals + referralsUntilNextTier) / Math.log(1 + monthlyGrowthRate) - 
                           Math.log(currentReferrals) / Math.log(1 + monthlyGrowthRate);
      }

      // Projections with tier bonuses
      const projection6Months = currentReferrals * Math.pow(1 + monthlyGrowthRate, 6);
      const projectedTier = this.getTierAtReferralCount(projection6Months, tiers);
      const projectedBonus = tiers[projectedTier as keyof typeof tiers].multiplier;

      // Lifetime value projection (base reward $10 per referral)
      const baseRewardPerReferral = 10;
      const currentTierBonus = tierDef.multiplier * baseRewardPerReferral * currentReferrals;
      const projectedTierBonus = projectedBonus * baseRewardPerReferral * Math.round(projection6Months);

      // Risk assessment
      let riskLevel = 'LOW';
      let riskScore = 2;
      const warnings: string[] = [];

      if (monthlyGrowthRate < 0.05) {
        riskLevel = 'MEDIUM';
        riskScore = 5;
        warnings.push('Slow tier advancement. Current tier may be saturating.');
      }

      if (tierIndex === tierOrder.length - 1) {
        warnings.push('Already at max tier. Focus on maintaining growth.');
      }

      if (referralsUntilNextTier > 100) {
        warnings.push('Many referrals needed for next tier. Significant effort required.');
      }

      const summary = 'Referral tier advancement simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          currentTier,
          currentReferrals,
          currentTierMultiplier: tierDef.multiplier,
          referralsUntilNextTier: referralsUntilNextTier > 0 ? referralsUntilNextTier : 0,
          monthlyGrowthRate: Number((monthlyGrowthRate * 100).toFixed(1)),
          monthsToNextTier: monthsToNextTier === Infinity ? 'Never (or >12mo)' : Number(monthsToNextTier.toFixed(1)),
          projection6Months: {
            estimatedReferrals: Math.round(projection6Months),
            projectedTier,
            tierBonus: projectedBonus,
            estimatedRewardBonus: Number((projectedTierBonus - currentReferrals * baseRewardPerReferral).toFixed(2)),
          },
          tierRoadmap: this.getTierRoadmap(currentReferrals, monthlyGrowthRate),
          currentLifetimeValue: Number(currentTierBonus.toFixed(2)),
          projectedLifetimeValue: Number(projectedTierBonus.toFixed(2)),
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

  private getTierAtReferralCount(referralCount: number, tiers: any): string {
    if (referralCount >= 51) return 'platinum';
    if (referralCount >= 26) return 'gold';
    if (referralCount >= 11) return 'silver';
    return 'bronze';
  }

  private getTierRoadmap(startReferrals: number, growthRate: number): Array<{ tier: string; target: number; monthsNeeded: number; feasible: boolean }> {
    const roadmap: Array<{ tier: string; target: number; monthsNeeded: number; feasible: boolean }> = [];
    const tiers = ['silver (11)', 'gold (26)', 'platinum (51)'];
    const targets = [11, 26, 51];

    targets.forEach((target, i) => {
      if (startReferrals < target && growthRate > 0) {
        const monthsNeeded = Math.log(target / Math.max(startReferrals, 1)) / Math.log(1 + growthRate);
        roadmap.push({
          tier: tiers[i],
          target,
          monthsNeeded: Number(monthsNeeded.toFixed(1)),
          feasible: monthsNeeded < 24,
        });
      }
    });

    return roadmap;
  }
}

/**
 * Referral Fraud Detection Simulator
 * Simulates fraud risk assessment for referral networks
 */
export class ReferralFraudDetectionSimulator extends SimulationService {
  constructor() {
    super('REFERRAL_FRAUD_DETECTION', SimulationDepth.BASIC);
  }

  async simulate(params: SimulationParams): Promise<SimulationResult> {
    try {
      const {
        accountAge = 30, // days
        referralsPerDay = 0.5,
        accountCreationDates = [], // dates of referred accounts
        geographicDiversity = 0.7, // 0-1 scale
        deviceDiversity = 0.5, // 0-1 scale
        emailVerified = true,
        phoneVerified = false,
        recentHighValueReferrals = 0, // count of high-value referrals
      } = params;

      let fraudRiskScore = 0;
      const riskFactors: string[] = [];

      // Account age check
      if (accountAge < 7) {
        fraudRiskScore += 20;
        riskFactors.push('Very new account');
      } else if (accountAge < 30) {
        fraudRiskScore += 10;
        riskFactors.push('Recently created');
      }

      // Referral velocity check
      const dailyReferralRate = referralsPerDay;
      if (dailyReferralRate > 10) {
        fraudRiskScore += 30;
        riskFactors.push('Abnormally high referral velocity');
      } else if (dailyReferralRate > 5) {
        fraudRiskScore += 15;
        riskFactors.push('High referral velocity');
      }

      // Geographic diversity
      if (geographicDiversity < 0.2) {
        fraudRiskScore += 25;
        riskFactors.push('All referrals from same location');
      } else if (geographicDiversity < 0.5) {
        fraudRiskScore += 10;
        riskFactors.push('Low geographic diversity');
      }

      // Device diversity
      if (deviceDiversity < 0.2) {
        fraudRiskScore += 15;
        riskFactors.push('All referrals from same device');
      } else if (deviceDiversity < 0.5) {
        fraudRiskScore += 8;
        riskFactors.push('Low device diversity');
      }

      // Verification status
      if (!emailVerified) {
        fraudRiskScore += 10;
        riskFactors.push('Email not verified');
      }
      if (!phoneVerified) {
        fraudRiskScore += 5;
        riskFactors.push('Phone not verified');
      }

      // High-value referral anomaly
      if (recentHighValueReferrals > 5) {
        fraudRiskScore += 20;
        riskFactors.push(`Unusual high-value referral count (${recentHighValueReferrals})`);
      }

      fraudRiskScore = Math.min(100, fraudRiskScore);

      // Risk classification
      let riskLevel = 'LOW';
      if (fraudRiskScore > 70) riskLevel = 'CRITICAL';
      else if (fraudRiskScore > 50) riskLevel = 'HIGH';
      else if (fraudRiskScore > 30) riskLevel = 'MEDIUM';

      // Clawback probability
      const clawbackProbability = Math.min(100, fraudRiskScore * 0.8);

      // Network health
      const networkHealth = 100 - fraudRiskScore;

      const summary = 'Referral fraud detection simulation complete';
      return {
        status: SimulationStatus.SUCCESS,
        depth: this.depth,
        timestamp: Date.now(),
        executionTimeMs: 0,
        beforeState: {},
        afterState: {
          fraudRiskScore,
          fraudRiskLevel: riskLevel,
          riskFactors,
          clawbackProbability: Number(clawbackProbability.toFixed(0)),
          networkHealthScore: Number(networkHealth.toFixed(0)),
          verificationStatus: {
            emailVerified,
            phoneVerified,
            recommendedVerifications: this.getRecommendedVerifications(emailVerified, phoneVerified),
          },
          accountMetrics: {
            accountAgeDays: accountAge,
            referralsPerDay: Number(referralsPerDay.toFixed(2)),
            geographicDiversity: Number((geographicDiversity * 100).toFixed(0)),
            deviceDiversity: Number((deviceDiversity * 100).toFixed(0)),
          },
          recommendation: this.getFraudRecommendation(fraudRiskScore),
          actions: this.getRecommendedActions(fraudRiskScore),
        },
        delta: {},
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        riskFactors: [],
        warnings: riskLevel !== 'LOW' ? riskFactors : [],
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

  private getRecommendedVerifications(emailVerified: boolean, phoneVerified: boolean): string[] {
    const recs = [];
    if (!emailVerified) recs.push('Email verification');
    if (!phoneVerified) recs.push('Phone verification');
    if (recs.length === 0) recs.push('All key verifications complete');
    return recs;
  }

  private getFraudRecommendation(score: number): string {
    if (score > 70) return 'Account flagged for manual review. Consider temporary suspension of referral rewards.';
    if (score > 50) return 'Enhanced monitoring recommended. Request additional verification.';
    if (score > 30) return 'Moderate risk. Continue monitoring for patterns.';
    return 'Low fraud risk. Account appears legitimate.';
  }

  private getRecommendedActions(score: number): string[] {
    const actions = [];
    if (score > 70) {
      actions.push('Initiate fraud investigation');
      actions.push('Suspend reward payouts pending review');
      actions.push('Request identity verification');
    } else if (score > 50) {
      actions.push('Request phone verification');
      actions.push('Monitor referral patterns');
      actions.push('Request explanation for anomalies');
    } else if (score > 30) {
      actions.push('Continue standard monitoring');
      actions.push('Flag for periodic review');
    } else {
      actions.push('Approve and continue incentivization');
    }
    return actions;
  }
}
