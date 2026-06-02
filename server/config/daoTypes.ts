export const DAO_TYPE_CONFIG: Record<string, any> = {
  harambee: {
    requiredTier: 'free',
    label: 'Harambee / Emergency Fund',
    description: 'Collect fast for an urgent need, pay out once, then close',
    modules: ['basic-treasury'],
    smartDefaults: { governanceModel: '1-person-1-vote', quorum: 51, votingPeriod: '24h' },
    multisigRange: [1, 2],
    defaultDuration: 14,
    durationRange: [7, 30],
    features: { autoClose: true, singleDisbursement: true, urgencyMode: true }
  },
  shortTerm: {
    requiredTier: 'free',
    label: 'Short-Term Savings',
    description: 'Save toward a goal over 1-3 months',
    modules: ['basic-treasury', 'milestones'],
    smartDefaults: { governanceModel: '1-person-1-vote', quorum: 50, votingPeriod: '3d' },
    multisigRange: [2, 3],
    defaultDuration: 60,
    durationRange: [30, 90],
    features: { milestones: true, progressTracking: true, partialWithdrawal: true }
  },
  savings: {
    requiredTier: 'free',
    label: 'Savings Group',
    description: 'Ongoing contributions and withdrawals',
    modules: ['basic-treasury'],
    smartDefaults: { governanceModel: '1-person-1-vote', quorum: 50, votingPeriod: '7d' },
    multisigRange: [2, 3],
    durationRequired: false,
    features: { recurringDeposits: true, withdrawalRequests: true }
  },
  merryGoRound: {
    requiredTier: 'growth',
    label: 'Merry-Go-Round',
    description: 'Rotate payouts in a fixed order (rotating savings)',
    modules: ['rotation', 'basic-treasury'],
    smartDefaults: { governanceModel: '1-person-1-vote', quorum: 51, votingPeriod: '3d' },
    multisigRange: [2, 3],
    durationRequired: false,
    features: { rotationSchedule: true, payoutOrder: true }
  },
  community: {
    requiredTier: 'growth',
    label: 'Community Group',
    description: 'Governance and treasury for ongoing decisions',
    modules: ['basic-treasury', 'governance'],
    smartDefaults: { governanceModel: '1-person-1-vote', quorum: 60, votingPeriod: '7d' },
    multisigRange: [2, 4],
    durationRequired: false,
    features: { proposals: true, elections: true, committees: true }
  },
  investment: {
    requiredTier: 'professional',
    label: 'Investment Club',
    description: 'Weighted stakes, returns tracking, reporting',
    modules: ['basic-treasury', 'investments', 'reporting'],
    smartDefaults: { governanceModel: 'weighted-stake', quorum: 60, votingPeriod: '7d' },
    multisigRange: [2, 4],
    durationRequired: false,
    features: { portfolioTracking: true, dividendDistribution: true, performanceReports: true }
  }
};
