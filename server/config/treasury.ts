/**
 * Treasury Configuration
 * 
 * Centralized configuration for treasury system
 */

export const treasuryConfig = {
  // Default rate limits (requests per time period)
  rateLimits: {
    balance: { limit: 30, window: '1min' },
    history: { limit: 30, window: '1min' },
    deposit: { limit: 20, window: '10min' },
    withdraw: { limit: 10, window: '10min' },
    approve: { limit: 10, window: '5min' },
    contributionTypes: { limit: 30, window: '1min' },
    contributions: { limit: 30, window: '1min' },
    multisigConfig: { limit: 5, window: '1hour' },
    whitelist: { limit: 30, window: '1min' },
    whitelistRequest: { limit: 10, window: '10min' },
    limits: { limit: 30, window: '1min' },
    limitsUpdate: { limit: 5, window: '1hour' },
    analyze: { limit: 20, window: '5min' },
    formula: { limit: 15, window: '10min' },
    health: { limit: 30, window: '1min' },
    budget: { limit: 20, window: '5min' },
    fraud: { limit: 10, window: '10min' },
    governance: { limit: 10, window: '10min' },
    systemHealth: { limit: 20, window: '5min' },
  },

  // Default treasury limits (per DAO if not configured)
  defaultLimits: {
    dailyWithdrawalPercentage: 10, // % of total treasury
    perTransactionPercentage: 5, // % of total treasury
    multisigThreshold: 50000, // USD amount
    requiredApprovals: 2,
    totalSigners: 5,
  },

  // Multisig configuration
  multisig: {
    defaultThreshold: 50000, // USD
    defaultRequiredApprovals: 2,
    defaultTotalSigners: 5,
    approvalTimeout: 604800, // 7 days in seconds
  },

  // Allowed contribution types (default)
  defaultContributionTypes: [
    {
      id: 'type_grant',
      name: 'Development Grant',
      description: 'Funding for development work',
      minimumAmount: '5000.00',
      maximumAmount: '100000.00',
      requiresApproval: true,
    },
    {
      id: 'type_bounty',
      name: 'Bug Bounty Reward',
      description: 'Security vulnerability rewards',
      minimumAmount: '100.00',
      maximumAmount: '10000.00',
      requiresApproval: true,
    },
    {
      id: 'type_donation',
      name: 'Community Donation',
      description: 'Voluntary contributions from community',
      minimumAmount: '10.00',
      maximumAmount: null,
      requiresApproval: false,
    },
  ],

  // Whitelist categories
  whitelistCategories: [
    'charity',
    'payments',
    'team',
    'disbursements',
    'other',
  ] as const,

  // Audit severity levels
  audit: {
    criticalOperations: [
      'treasury_withdrawal_initiated',
      'treasury_withdrawal_approved',
      'contribution_approved',
      'treasury_limits_updated',
      'multisig_signer_removed',
      'whitelist_entry_approved',
      'treasury_vault_allocated',
      'multisig_approval_signed',
      'treasury_optimization_applied',
    ],
  },

  // Vaults configuration
  vaults: {
    maxVaultsPerDAO: 20,
    riskProfiles: ['low', 'medium', 'high'],
  },

  // Intelligence/Analysis
  intelligence: {
    healthScoreThresholds: {
      excellent: 8.0,
      good: 6.5,
      fair: 4.0,
      poor: 0,
    },
    fraudDetectionMinThreshold: 0.3, // 30% risk
    governanceAnalysisMinThreshold: 0.2, // 20% risk
  },
};

export type TreasuryConfig = typeof treasuryConfig;

export default treasuryConfig;
