// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────

export const TIER_HIERARCHY = ['free', 'growth', 'professional', 'enterprise'] as const;
export type Tier = typeof TIER_HIERARCHY[number];

export type SubscriptionTierKey = 'free' | 'growth' | 'professional';

export interface SubscriptionTierDefinition {
  key: SubscriptionTierKey;
  name: string;
  priceKES: number;
  featureTier: 'basic' | 'intermediate' | 'advanced';
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

export const SUBSCRIPTION_TIER_CONFIG: readonly SubscriptionTierDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    priceKES: 0,
    featureTier: 'basic',
    description: 'Manual governance and basic treasury tools for small chamas.',
    features: ['Manual proposal creation', 'Basic treasury view', 'Up to 20 members', 'One active vault'],
    cta: 'Start Free',
  },
  {
    key: 'growth',
    name: 'Pro',
    priceKES: 1500,
    featureTier: 'intermediate',
    description: 'Unlock yield, loan scoring, and automated reporting for growing chamas.',
    features: ['Yield farming and staking access', 'Loan risk scoring', 'Auto-rebalancing for savings', 'Up to 100 members'],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    key: 'professional',
    name: 'Collective',
    priceKES: 5000,
    featureTier: 'advanced',
    description: 'Full automation, custom governance, and institutional-grade tooling.',
    features: ['MultiAssetVault with rebalancing agent', 'Custom Sub-DAOs', 'Priority support', 'Unlimited members and vaults'],
    cta: 'Upgrade to Collective',
  },
] as const;

export const LOAN_DEFAULTS = {
  interestModel: 'fixed-flat' as const,
  defaultHandling: 'collateral-seizure' as const,
  loanScoringEnabled: false,
  loanApproval: 'governance-vote' as const,
} as const;

export const getRecommendedSubscriptionTier = (type: DaoTypeKey): SubscriptionTierKey =>
  DAO_TYPE_CONFIG[type].monetization.recommendedTier ?? 'free';

export const getTierUnlocks = (
  type: DaoTypeKey,
  tier: SubscriptionTierKey,
): string[] => [...(DAO_TYPE_CONFIG[type].monetization.tierUnlocks?.[tier] ?? [])];

export type DaoTypeKey = keyof typeof DAO_TYPE_CONFIG;

export const getSpawnFeeKES = (type: DaoTypeKey): number =>
  DAO_TYPE_CONFIG[type].monetization.spawnFeeKES;

export const getActivityFeeBps = (
  type: DaoTypeKey,
  action: keyof (typeof DAO_TYPE_CONFIG)[DaoTypeKey]['monetization']['activityFees'],
): number => DAO_TYPE_CONFIG[type].monetization.activityFees[action] ?? 0;

export const isFeatureImmediate = (
  type: DaoTypeKey,
  persona: 'yuki' | 'amara',
): boolean => {
  const features = DAO_TYPE_CONFIG[type].features[persona];
  if (!features) return false;
  return '_unlockCondition' in features && features._unlockCondition === 'immediate';
};

export const getSpawnContracts = (type: DaoTypeKey): string[] =>
  [...DAO_TYPE_CONFIG[type].contracts.spawnsOnCreate];

export const isTierEligible = (userTier: Tier, requiredTier: Tier): boolean =>
  TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf(requiredTier);

export const getMTAADiscount = (mtaaHeld: number): number => {
  const discountPct = Math.min(50, Math.floor(Math.sqrt(mtaaHeld) * 2.5));
  return discountPct;
};

export const getDiscountedFeeBps = (baseFeeBps: number, mtaaHeld: number): number => {
  const discount = getMTAADiscount(mtaaHeld);
  return Math.floor(baseFeeBps * (100 - discount) / 100);
};

export const MTAA_DISCOUNT_CURVE = 'sqrt-2.5' as const;
// Implementation: discount% = min(50, floor(sqrt(mtaaHeld) * 2.5))

// ─── CONFIG ──────────────────────────────────────────────────────────────────

export const DAO_TYPE_CONFIG = {

  harambee: {
    requiredTier: 'free' as Tier,
    primaryPersona: 'okedi',

    constraints: {
      maxMembers: 100,
      minMembers: 2,
      defaultDurationDays: 14,
      durationRange: [7, 30] as [number, number],
    },

    monetization: {
      spawnFeeKES: 500,
      spawnRewardMTAA: 100,
      activityFees: {
        deposit: 15,
        withdrawal: 25,
        rotationPayout: 0,
        loanOrigination: 0,
        yieldClaim: 0,
      },
      subscriptionKES: 0,
      recommendedTier: 'free' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
    },

    mtaaRewards: {
      onSpawn: 100,
      onFirstDeposit: 5,
      onRotationComplete: 0,
      onLoanRepaidOnTime: 0,
      onMonthlyUpkeep: 0,
      onReferral: 50,
    },

    contracts: {
      required: ['MaonoVault:escrow'],
      optional: [],
      spawnsOnCreate: ['MaonoVault:escrow'],
    },

    features: {
      okedi: {
        singleDisbursement: true,
        urgencyMode: true,
        autoClose: true,
        transparentProgress: true,
      },
      yuki: null,
      amara: null,
    },

    vaultBehavior: {
      type: 'escrow',
      autoHibernateAfterDisbursement: true,
      withdrawalModel: 'single-payout',
      multisig: { min: 1, max: 2 },
    },

    governance: {
      model: '1-person-1-vote',
      quorum: 51,
      votingPeriod: '24h',
      proposalTypes: ['disbursement', 'emergency'],
      roles: ['member', 'admin'],
    },

    upgradePathTo: ['shortTerm', 'savings'],
    upgradePathFrom: [],
  },

  shortTerm: {
    requiredTier: 'free' as Tier,
    primaryPersona: 'okedi',

    constraints: {
      maxMembers: 100,
      minMembers: 2,
      defaultDurationDays: 60,
      durationRange: [30, 90] as [number, number],
    },

    monetization: {
      spawnFeeKES: 800,
      spawnRewardMTAA: 150,
      activityFees: {
        deposit: 15,
        withdrawal: 20,
        rotationPayout: 0,
        loanOrigination: 0,
        yieldClaim: 0,
      },
      subscriptionKES: 0,
      recommendedTier: 'free' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
    },

    mtaaRewards: {
      onSpawn: 150,
      onFirstDeposit: 10,
      onRotationComplete: 0,
      onLoanRepaidOnTime: 0,
      onMonthlyUpkeep: 10,
      onReferral: 50,
    },

    contracts: {
      required: ['MaonoVault:savings'],
      optional: [
        {
          contract: 'MaonoVault:escrow',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'escrow-activation',
        },
      ],
      spawnsOnCreate: ['MaonoVault:savings'],
    },

    features: {
      okedi: {
        milestones: true,
        progressTracking: true,
        partialWithdrawal: true,
        contributionSchedule: true,
      },
      yuki: null,
      amara: null,
    },

    vaultBehavior: {
      type: 'savings',
      withdrawalModel: 'milestone-gated',
      multisig: { min: 2, max: 3 },
    },

    governance: {
      model: '1-person-1-vote',
      quorum: 50,
      votingPeriod: '3d',
      proposalTypes: ['withdrawal', 'milestone-update', 'extension'],
      roles: ['member', 'admin'],
    },

    upgradePathTo: ['savings', 'merryGoRound', 'community'],
    upgradePathFrom: ['harambee'],
  },

  savings: {
    requiredTier: 'free' as Tier,
    primaryPersona: 'okedi',
    secondaryPersona: 'yuki',

    constraints: {
      maxMembers: null,
      minMembers: 3,
      defaultDurationDays: null,
      durationRange: null,
    },

    monetization: {
      spawnFeeKES: 1000,
      spawnRewardMTAA: 150,
      activityFees: {
        deposit: 15,
        withdrawal: 20,
        rotationPayout: 0,
        loanOrigination: 40,
        yieldClaim: 500,
      },
      subscriptionKES: 0,
      recommendedTier: 'growth' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
    },

    mtaaRewards: {
      onSpawn: 150,
      onFirstDeposit: 10,
      onRotationComplete: 0,
      onLoanRepaidOnTime: 20,
      onMonthlyUpkeep: 15,
      onReferral: 50,
    },

    contracts: {
      required: ['MaonoVault:savings'],
      optional: [
        {
          contract: 'MaonoVault:investing',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'yield-activation',
        },
        {
          contract: 'LoanFacility',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'loan-activation',
        },
      ],
      spawnsOnCreate: ['MaonoVault:savings'],
    },

    features: {
      okedi: {
        recurringDeposits: true,
        withdrawalRequests: true,
        withdrawalCooldown: true,
        contributionSchedule: true,
        memberLoans: true,
      },
      yuki: {
        yieldOptIn: true,
        yieldReporting: true,
        _unlockCondition: 'governance-vote',
      },
      amara: null,
    },

    vaultBehavior: {
      type: 'savings',
      withdrawalModel: 'request-and-cooldown',
      yieldRouting: 'optional',
      multisig: { min: 2, max: 3 },
    },

    loanFacility: {
      ...LOAN_DEFAULTS,
      collateralType: 'vault-shares',
      maxLoanRatio: 0.70,
      interestRate: 0.10,
      repaymentPeriod: '30-90d',
    },

    governance: {
      model: '1-person-1-vote',
      quorum: 50,
      votingPeriod: '7d',
      proposalTypes: [
        'withdrawal', 'loan-approval', 'yield-activation',
        'rate-change', 'member-removal',
      ],
      roles: ['member', 'proposer', 'treasurer', 'admin'],
    },

    upgradePathTo: ['merryGoRound', 'community', 'investment'],
    upgradePathFrom: ['harambee', 'shortTerm'],
  },

  merryGoRound: {
    requiredTier: 'growth' as Tier,
    primaryPersona: 'okedi',
    secondaryPersona: 'yuki',

    constraints: {
      maxMembers: 30,
      minMembers: 3,
      defaultDurationDays: null,
      durationRange: null,
    },

    monetization: {
      spawnFeeKES: 1200,
      spawnRewardMTAA: 100,
      activityFees: {
        deposit: 15,
        withdrawal: 0,          // rotation payouts not charged separately
        rotationPayout: 20,     // per rotation cycle completed
        loanOrigination: 40,
        yieldClaim: 500,
      },
      subscriptionKES: 0,
      recommendedTier: 'growth' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
    },

    mtaaRewards: {
      onSpawn: 100,
      onFirstDeposit: 10,
      onRotationComplete: 5,
      onLoanRepaidOnTime: 20,
      onMonthlyUpkeep: 15,
      onReferral: 50,
    },

    contracts: {
      required: ['MaonoVault:escrow', 'RotationModule'],
      optional: [
        {
          contract: 'LoanFacility',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'loan-activation',
        },
        {
          contract: 'MaonoVault:savings',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'reserve-pool-activation',
        },
      ],
      spawnsOnCreate: ['MaonoVault:escrow', 'RotationModule'],
    },

    features: {
      okedi: {
        rotationSchedule: true,
        payoutOrder: true,
        missedContributionHandling: true,
        disputeProposal: true,
        guaranteePool: true,
      },
      yuki: {
        floatYield: true,
        yieldDistributedToMembers: true,
        _unlockCondition: 'governance-vote',
      },
      amara: null,
    },

    vaultBehavior: {
      type: 'escrow',
      withdrawalModel: 'rotation-scheduled',
      floatYieldRouting: 'optional',
      multisig: { min: 2, max: 3 },
    },

    rotationModule: {
      selectionMethods: ['sequential', 'random', 'voted'],
      frequency: ['weekly', 'biweekly', 'monthly'],
      missedContributionPolicy: ['pause-rotation', 'penalty-fee', 'skip-turn'],
      earlyExitPolicy: 'governance-vote-required',
      // Grace period before vault hibernation blocks a payout
      payoutGracePeriodHours: 72,
    },

    loanFacility: {
      ...LOAN_DEFAULTS,
      collateralType: 'rotation-claim',
      maxLoanRatio: 0.50,
      interestRate: 0.05,
      repaymentPeriod: 'before-payout',
    },

    governance: {
      model: '1-person-1-vote',
      quorum: 51,
      votingPeriod: '3d',
      proposalTypes: [
        'rotation-reorder', 'missed-contribution',
        'early-exit', 'yield-activation', 'dispute',
      ],
      roles: ['member', 'treasurer', 'admin'],
    },

    upgradePathTo: ['community', 'savings'],
    upgradePathFrom: ['shortTerm', 'savings'],
  },

  community: {
    requiredTier: 'growth' as Tier,
    primaryPersona: 'okedi',
    secondaryPersona: 'yuki',

    constraints: {
      maxMembers: null,
      minMembers: 5,
      defaultDurationDays: null,
      durationRange: null,
    },

    monetization: {
      spawnFeeKES: 2000,
      spawnRewardMTAA: 150,
      activityFees: {
        deposit: 25,
        withdrawal: 25,
        rotationPayout: 0,
        loanOrigination: 50,
        yieldClaim: 500,
      },
      // Optional subscription unlocks loan scoring + analytics
      subscriptionKES: 500,
      recommendedTier: 'growth' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
      subscriptionUnlocks: ['loanScoring', 'memberAnalytics', 'budgetReports'],
    },

    mtaaRewards: {
      onSpawn: 150,
      onFirstDeposit: 10,
      onRotationComplete: 0,
      onLoanRepaidOnTime: 20,
      onMonthlyUpkeep: 15,
      onReferral: 50,
    },

    contracts: {
      required: [
        'ChamaTreasury',
        'MaonoVault:business',
        'LoanFacility',
        'GovernanceAccessManager',
      ],
      optional: [
        {
          contract: 'MaonoVault:savings',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'reserve-activation',
        },
        {
          contract: 'MaonoVault:investing',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'yield-activation',
        },
        {
          contract: 'RotationModule',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'rotation-activation',
        },
      ],
      spawnsOnCreate: [
        'ChamaTreasury',
        'MaonoVault:business',
        'LoanFacility',
        'GovernanceAccessManager',
      ],
    },

    features: {
      okedi: {
        proposals: true,
        elections: true,
        committees: true,
        memberLoans: true,
        budgetCategories: true,
        memberScoring: true,
        disputeResolution: true,
        multiSig: true,
      },
      yuki: {
        yieldOnReserves: true,
        loanInterestAccrual: true,
        dividendDistribution: true,
        _unlockCondition: 'immediate',
      },
      amara: {
        onChainDataViews: true,
        _unlockCondition: 'governance-vote',
      },
    },

    vaultBehavior: {
      primaryVault: 'business',
      withdrawalModel: 'multisig-proposal',
      multisig: { min: 3, max: 5 },
      timelockHours: 48,
    },

    loanFacility: {
      ...LOAN_DEFAULTS,
      collateralType: 'vault-shares',
      maxLoanRatio: 0.75,
      interestModel: 'reducing-balance',
      interestRate: 0.12,
      repaymentPeriod: '30-180d',
      defaultHandling: 'collateral-seizure-then-reserve',
      loanScoringEnabled: true,
    },

    governance: {
      model: '1-person-1-vote',
      quorum: 60,
      votingPeriod: '7d',
      proposalTypes: [
        'general', 'budget', 'loan-approval', 'member-removal',
        'policy', 'emergency', 'election', 'yield-strategy',
      ],
      roles: [
        'member', 'proposer', 'elder',
        'treasurer', 'loan-officer', 'admin',
      ],
    },

    upgradePathTo: ['investment'],
    upgradePathFrom: ['shortTerm', 'savings', 'merryGoRound'],
  },

  investment: {
    requiredTier: 'professional' as Tier,
    primaryPersona: 'yuki',
    secondaryPersona: 'amara',
    tertiaryPersona: 'okedi',

    constraints: {
      maxMembers: null,
      minMembers: 3,
      defaultDurationDays: null,
      durationRange: null,
    },

    monetization: {
      spawnFeeKES: 3000,
      spawnRewardMTAA: 200,
      activityFees: {
        deposit: 15,
        withdrawal: 25,
        rotationPayout: 0,
        loanOrigination: 50,
        yieldClaim: 500,
        rebalance: 15,          // per batchRebalance execution
      },
      // Subscription unlocks full MultiAssetVault + rebalancing agents
      subscriptionKES: 1000,
      recommendedTier: 'professional' as SubscriptionTierKey,
      tierUnlocks: {
        free: ['basic_governance', 'manual_treasury', 'member_limit_20'],
        growth: ['yield_opt_in', 'loan_scoring', 'member_limit_100', 'auto_reports'],
        professional: ['multi_asset_vault', 'rebalancing', 'custom_strategies', 'unlimited'],
      },
      subscriptionRequired: false,
      billingModel: 'treasury-managed' as const,
      subscriptionUnlocks: [
        'multiAssetVault', 'rebalancingAgent',
        'performanceReports', 'priceAlerts',
      ],
    },

    mtaaRewards: {
      onSpawn: 200,
      onFirstDeposit: 15,
      onRotationComplete: 0,
      onLoanRepaidOnTime: 25,
      onMonthlyUpkeep: 20,
      onReferral: 50,
    },

    contracts: {
      required: [
        'ChamaTreasury',
        'MultiAssetVault',
        'MaonoVault:investing',
        'GovernanceAccessManager',
        'LoanFacility',
      ],
      optional: [
        {
          contract: 'MaonoVault:custom',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'custom-strategy-activation',
        },
        {
          contract: 'RotationModule',
          unlockCondition: 'governance-vote',
          unlockProposalType: 'profit-rotation-activation',
        },
      ],
      spawnsOnCreate: [
        'ChamaTreasury',
        'MultiAssetVault',
        'MaonoVault:investing',
        'GovernanceAccessManager',
        'LoanFacility',
      ],
    },

    features: {
      okedi: {
        memberScoring: true,
        dividendDistribution: true,
        governanceVotes: true,
        multiSig: true,
      },
      yuki: {
        portfolioTracking: true,
        rebalancing: true,
        performanceReports: true,
        yieldOptimisation: true,
        dividendDistribution: true,
        priceAlerts: true,
        _unlockCondition: 'immediate',
      },
      amara: {
        multiAssetExposure: true,
        dexSwaps: true,
        yieldRouting: true,
        onChainAnalytics: true,
        customVaultStrategies: true,
        _unlockCondition: 'immediate',
      },
    },

    vaultBehavior: {
      primaryVault: 'investing',
      multiAssetVault: {
        enabled: true,
        phase: 1,
        rebalancingEnabled: true,
        oraclePriced: true,
      },
      withdrawalModel: 'share-redemption',
      multisig: { min: 3, max: 5 },
      timelockHours: 48,
    },

    loanFacility: {
      ...LOAN_DEFAULTS,
      collateralType: 'vault-shares',
      maxLoanRatio: 0.60,
      interestModel: 'reducing-balance',
      interestRate: 0.15,
      repaymentPeriod: '30-90d',
      defaultHandling: 'liquidate-collateral',
      loanScoringEnabled: true,
      marginCallThreshold: 0.80,
    },

    governance: {
      model: 'weighted-stake',
      quorum: 60,
      votingPeriod: '7d',
      proposalTypes: [
        'investment-decision', 'rebalance-approval',
        'strategy-change', 'loan-approval',
        'dividend-declaration', 'member-removal',
        'asset-addition', 'emergency',
      ],
      roles: [
        'member', 'analyst', 'portfolio-manager',
        'risk-officer', 'admin',
      ],
    },

    upgradePathTo: [],
    upgradePathFrom: ['community'],
  },

} as const;