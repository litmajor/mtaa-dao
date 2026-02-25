/**
 * Simulation Framework - Complete Simulator Index (TIER 3 COMPLETE)
 * 
 * This file exports all simulators across all categories:
 * 
 * TIER 1 (23 simulators):
 * - Category 1: Payment Flow (5 actions) - BASIC depth ✅
 * - Category 2: Trading & DEX (5 actions) - INTERMEDIATE depth ✅
 * - Category 7: DAO Treasury (3 actions) - ADVANCED depth ✅
 * - Category 9: Governance (5 actions) - ADVANCED depth ✅
 * - Agent Deployment (2) - ADVANCED depth ✅
 * 
 * TIER 2 (29 simulators):
 * - Category 4: Investment Operations (4) - INTERMEDIATE depth ✅
 * - Category 9: Staking (4) - INTERMEDIATE depth ✅
 * - Category 6: Escrow & Settlements (4) - INTERMEDIATE depth ✅
 * - Category 8: Vaults (4) - INTERMEDIATE depth ✅
 * - Category 5: Cross-Chain Bridges (2) - INTERMEDIATE depth ✅
 * - Category 10: Recurring Payments (3) - BASIC depth ✅
 * - Category 11: Bounties (3) - BASIC depth ✅
 * - Category 12: Bill Split (3) - BASIC depth ✅
 * 
 * TIER 3 (12 simulators):
 * - Category 13: NFT Operations (4) - BASIC depth ✅
 * - Category 14: Referral Programs (4) - BASIC depth ✅
 * - Category 15: Micro-Transactions (4) - BASIC depth ✅
 * 
 * Total: 64 simulators covering all major operations + convenience features
 */

// Base Framework
export { 
  SimulationService, 
  SimulationResult, 
  SimulationParams, 
  SimulationStatus, 
  SimulationDepth 
} from './simulationFramework';

// Category 1: Payment Flow Simulators (BASIC)
export {
  PaymentDepositSimulator,
  PaymentWithdrawalSimulator,
  PaymentP2PTransferSimulator,
  RecurringPaymentSetupSimulator,
  PaymentSettlementSimulator,
} from './paymentFlowSimulator';

// Category 2: Trading & DEX Simulators (INTERMEDIATE)
export {
  SpotTradeSimulator,
  MarginTradeSimulator,
  PerpetualsFuturesSimulator,
  DexSwapSimulator,
  FlashLoanSimulator,
} from './tradingDexSimulator';

// Category 4: Investment Operations Simulators (INTERMEDIATE)
export {
  PortfolioRebalanceSimulator,
  DividendReinvestmentSimulator,
  MarginLendingSimulator,
  FixedIncomeSimulator,
} from './investmentOperationsSimulator';

// Category 5: Cross-Chain Bridges Simulators (INTERMEDIATE)
export {
  BridgeTransferSimulator,
  CrossChainArbitrageSimulator,
} from './crossChainBridgesSimulator';

// Category 6: Escrow & Settlements Simulators (INTERMEDIATE)
export {
  EscrowReleaseSimulator,
  DisputeResolutionSimulator,
  SettlementFinalitySimulator,
  EscrowRecoverySimulator,
} from './escrowSettlementsSimulator';

// Category 7: DAO Treasury Simulators (ADVANCED)
export {
  TreasuryRebalanceSimulator,
  AssetAllocationSimulator,
  GrantDistributionSimulator,
} from './daoTreasurySimulator';

// Category 8: Vaults Simulators (INTERMEDIATE)
export {
  VaultDepositSimulator,
  VaultWithdrawalSimulator,
  VaultLiquidationSimulator,
  VaultStrategySimulator,
} from './vaultsSimulator';

// Category 9: Governance Simulators (ADVANCED)
export {
  CreateProposalSimulator,
  VoteOnProposalSimulator,
  ExecuteProposalSimulator,
  ParameterChangeSimulator,
  PermissionGrantSimulator,
} from './governanceSimulator';

// Category 9: Staking Simulators (INTERMEDIATE)
export {
  SoloStakingSimulator,
  PoolStakingSimulator,
  LiquidityPoolSimulator,
  YieldFarmingSimulator,
} from './stakingSimulator';

// Category 10: Recurring Payments Simulators (BASIC)
// Category 11: Bounties Simulators (BASIC)
// Category 12: Bill Split Simulators (BASIC)
export {
  SubscriptionSimulator,
  InstallmentSimulator,
  PaymentAutomationSimulator,
  BountyProgramSimulator,
  RewardDistributionSimulator,
  BountyCompletionSimulator,
  BillSplitSimulator,
  ExpenseReimbursementSimulator,
  GroupSettlementSimulator,
} from './recurringAndBillSimulator';

// Agent Deployment (ADVANCED)
export {
  AgentDeploymentSimulator,
  MultiAgentDeploymentSimulator,
} from './agentDeploymentSimulator';

// Category 13: NFT Operations Simulators (BASIC - TIER 3)
export {
  NFTMintingSimulator,
  NFTMarketplaceListingSimulator,
  NFTPurchaseSimulator,
  NFTRoyaltyTrackingSimulator,
} from './tierThreeSimulatorsNFT';

// Category 14: Referral Program Simulators (BASIC - TIER 3)
export {
  ReferralGenerationSimulator,
  ReferralRewardsSimulator,
  ReferralTierAdvancementSimulator,
  ReferralFraudDetectionSimulator,
} from './tierThreeSimulatorsReferral';

// Category 15: Micro-Transaction Simulators (BASIC - TIER 3)
export {
  MicroWithdrawalSimulator,
  TipDonationSimulator,
  MicroLoanSimulator,
  SavingsChallengeSimulator,
} from './tierThreeSimulatorsMicro';

/**
 * Simulator Registry
 * Map of all available simulators for dynamic instantiation (64 total)
 */
export const SimulatorRegistry = {
  // Category 1: Payment Flow
  PAYMENT_DEPOSIT: () => new (require('./paymentFlowSimulator').PaymentDepositSimulator)(),
  PAYMENT_WITHDRAWAL: () => new (require('./paymentFlowSimulator').PaymentWithdrawalSimulator)(),
  PAYMENT_P2P: () => new (require('./paymentFlowSimulator').PaymentP2PTransferSimulator)(),
  RECURRING_PAYMENT: () => new (require('./paymentFlowSimulator').RecurringPaymentSetupSimulator)(),
  PAYMENT_SETTLEMENT: () => new (require('./paymentFlowSimulator').PaymentSettlementSimulator)(),

  // Category 2: Trading & DEX
  SPOT_TRADE: () => new (require('./tradingDexSimulator').SpotTradeSimulator)(),
  MARGIN_TRADE: () => new (require('./tradingDexSimulator').MarginTradeSimulator)(),
  PERPETUALS_FUTURES: () => new (require('./tradingDexSimulator').PerpetualsFuturesSimulator)(),
  DEX_SWAP: () => new (require('./tradingDexSimulator').DexSwapSimulator)(),
  FLASH_LOAN: () => new (require('./tradingDexSimulator').FlashLoanSimulator)(),

  // Category 4: Investment Operations
  PORTFOLIO_REBALANCE: () => new (require('./investmentOperationsSimulator').PortfolioRebalanceSimulator)(),
  DIVIDEND_REINVESTMENT: () => new (require('./investmentOperationsSimulator').DividendReinvestmentSimulator)(),
  MARGIN_LENDING: () => new (require('./investmentOperationsSimulator').MarginLendingSimulator)(),
  FIXED_INCOME: () => new (require('./investmentOperationsSimulator').FixedIncomeSimulator)(),

  // Category 5: Cross-Chain Bridges
  BRIDGE_TRANSFER: () => new (require('./crossChainBridgesSimulator').BridgeTransferSimulator)(),
  CROSS_CHAIN_ARBITRAGE: () => new (require('./crossChainBridgesSimulator').CrossChainArbitrageSimulator)(),

  // Category 6: Escrow & Settlements
  ESCROW_RELEASE: () => new (require('./escrowSettlementsSimulator').EscrowReleaseSimulator)(),
  DISPUTE_RESOLUTION: () => new (require('./escrowSettlementsSimulator').DisputeResolutionSimulator)(),
  SETTLEMENT_FINALITY: () => new (require('./escrowSettlementsSimulator').SettlementFinalitySimulator)(),
  ESCROW_RECOVERY: () => new (require('./escrowSettlementsSimulator').EscrowRecoverySimulator)(),

  // Category 7: DAO Treasury
  TREASURY_REBALANCE: () => new (require('./daoTreasurySimulator').TreasuryRebalanceSimulator)(),
  ASSET_ALLOCATION: () => new (require('./daoTreasurySimulator').AssetAllocationSimulator)(),
  GRANT_DISTRIBUTION: () => new (require('./daoTreasurySimulator').GrantDistributionSimulator)(),

  // Category 8: Vaults
  VAULT_DEPOSIT: () => new (require('./vaultsSimulator').VaultDepositSimulator)(),
  VAULT_WITHDRAWAL: () => new (require('./vaultsSimulator').VaultWithdrawalSimulator)(),
  VAULT_LIQUIDATION: () => new (require('./vaultsSimulator').VaultLiquidationSimulator)(),
  VAULT_STRATEGY: () => new (require('./vaultsSimulator').VaultStrategySimulator)(),

  // Category 9: Governance
  CREATE_PROPOSAL: () => new (require('./governanceSimulator').CreateProposalSimulator)(),
  VOTE_PROPOSAL: () => new (require('./governanceSimulator').VoteOnProposalSimulator)(),
  EXECUTE_PROPOSAL: () => new (require('./governanceSimulator').ExecuteProposalSimulator)(),
  PARAMETER_CHANGE: () => new (require('./governanceSimulator').ParameterChangeSimulator)(),
  PERMISSION_GRANT: () => new (require('./governanceSimulator').PermissionGrantSimulator)(),

  // Category 9: Staking
  SOLO_STAKING: () => new (require('./stakingSimulator').SoloStakingSimulator)(),
  POOL_STAKING: () => new (require('./stakingSimulator').PoolStakingSimulator)(),
  LIQUIDITY_POOL: () => new (require('./stakingSimulator').LiquidityPoolSimulator)(),
  YIELD_FARMING: () => new (require('./stakingSimulator').YieldFarmingSimulator)(),

  // Category 10: Recurring Payments
  SUBSCRIPTION: () => new (require('./recurringAndBillSimulator').SubscriptionSimulator)(),
  INSTALLMENT: () => new (require('./recurringAndBillSimulator').InstallmentSimulator)(),
  PAYMENT_AUTOMATION: () => new (require('./recurringAndBillSimulator').PaymentAutomationSimulator)(),

  // Category 11: Bounties
  BOUNTY_PROGRAM: () => new (require('./recurringAndBillSimulator').BountyProgramSimulator)(),
  REWARD_DISTRIBUTION: () => new (require('./recurringAndBillSimulator').RewardDistributionSimulator)(),
  BOUNTY_COMPLETION: () => new (require('./recurringAndBillSimulator').BountyCompletionSimulator)(),

  // Category 12: Bill Split
  BILL_SPLIT: () => new (require('./recurringAndBillSimulator').BillSplitSimulator)(),
  EXPENSE_REIMBURSEMENT: () => new (require('./recurringAndBillSimulator').ExpenseReimbursementSimulator)(),
  GROUP_SETTLEMENT: () => new (require('./recurringAndBillSimulator').GroupSettlementSimulator)(),

  // Agent Deployment
  AGENT_DEPLOYMENT: () => new (require('./agentDeploymentSimulator').AgentDeploymentSimulator)(),
  MULTI_AGENT_DEPLOYMENT: () => new (require('./agentDeploymentSimulator').MultiAgentDeploymentSimulator)(),

  // Category 13: NFT Operations (TIER 3)
  NFT_MINTING: () => new (require('./tierThreeSimulatorsNFT').NFTMintingSimulator)(),
  NFT_MARKETPLACE_LISTING: () => new (require('./tierThreeSimulatorsNFT').NFTMarketplaceListingSimulator)(),
  NFT_PURCHASE: () => new (require('./tierThreeSimulatorsNFT').NFTPurchaseSimulator)(),
  NFT_ROYALTY_TRACKING: () => new (require('./tierThreeSimulatorsNFT').NFTRoyaltyTrackingSimulator)(),

  // Category 14: Referral Programs (TIER 3)
  REFERRAL_GENERATION: () => new (require('./tierThreeSimulatorsReferral').ReferralGenerationSimulator)(),
  REFERRAL_REWARDS: () => new (require('./tierThreeSimulatorsReferral').ReferralRewardsSimulator)(),
  REFERRAL_TIER: () => new (require('./tierThreeSimulatorsReferral').ReferralTierAdvancementSimulator)(),
  REFERRAL_FRAUD_DETECTION: () => new (require('./tierThreeSimulatorsReferral').ReferralFraudDetectionSimulator)(),

  // Category 15: Micro-Transactions (TIER 3)
  MICRO_WITHDRAWAL: () => new (require('./tierThreeSimulatorsMicro').MicroWithdrawalSimulator)(),
  TIP_DONATION: () => new (require('./tierThreeSimulatorsMicro').TipDonationSimulator)(),
  MICRO_LOAN: () => new (require('./tierThreeSimulatorsMicro').MicroLoanSimulator)(),
  SAVINGS_CHALLENGE: () => new (require('./tierThreeSimulatorsMicro').SavingsChallengeSimulator)(),
};

/**
 * Get simulator by name
 */
export function getSimulator(name: string | keyof typeof SimulatorRegistry) {
  const creator = SimulatorRegistry[name as keyof typeof SimulatorRegistry];
  if (!creator) {
    throw new Error(`Simulator not found: ${name}`);
  }
  return creator();
}

/**
 * List all available simulators
 */
export function listAvailableSimulators() {
  return Object.keys(SimulatorRegistry);
}

/**
 * Simulator Categories (52 total across 12 categories)
 */
export const SimulatorCategories = {
  PAYMENT_FLOW: {
    name: 'Payment Flow',
    depth: 'BASIC',
    tier: 1,
    simulators: ['PAYMENT_DEPOSIT', 'PAYMENT_WITHDRAWAL', 'PAYMENT_P2P', 'RECURRING_PAYMENT', 'PAYMENT_SETTLEMENT'],
  },
  TRADING_DEX: {
    name: 'Trading & DEX',
    depth: 'INTERMEDIATE',
    tier: 1,
    simulators: ['SPOT_TRADE', 'MARGIN_TRADE', 'PERPETUALS_FUTURES', 'DEX_SWAP', 'FLASH_LOAN'],
  },
  INVESTMENT_OPERATIONS: {
    name: 'Investment Operations',
    depth: 'INTERMEDIATE',
    tier: 2,
    simulators: ['PORTFOLIO_REBALANCE', 'DIVIDEND_REINVESTMENT', 'MARGIN_LENDING', 'FIXED_INCOME'],
  },
  CROSS_CHAIN_BRIDGES: {
    name: 'Cross-Chain Bridges',
    depth: 'INTERMEDIATE',
    tier: 2,
    simulators: ['BRIDGE_TRANSFER', 'CROSS_CHAIN_ARBITRAGE'],
  },
  ESCROW_SETTLEMENTS: {
    name: 'Escrow & Settlements',
    depth: 'INTERMEDIATE',
    tier: 2,
    simulators: ['ESCROW_RELEASE', 'DISPUTE_RESOLUTION', 'SETTLEMENT_FINALITY', 'ESCROW_RECOVERY'],
  },
  DAO_TREASURY: {
    name: 'DAO Treasury',
    depth: 'ADVANCED',
    tier: 1,
    simulators: ['TREASURY_REBALANCE', 'ASSET_ALLOCATION', 'GRANT_DISTRIBUTION'],
  },
  VAULTS: {
    name: 'Vaults',
    depth: 'INTERMEDIATE',
    tier: 2,
    simulators: ['VAULT_DEPOSIT', 'VAULT_WITHDRAWAL', 'VAULT_LIQUIDATION', 'VAULT_STRATEGY'],
  },
  GOVERNANCE: {
    name: 'Governance',
    depth: 'ADVANCED',
    tier: 1,
    simulators: ['CREATE_PROPOSAL', 'VOTE_PROPOSAL', 'EXECUTE_PROPOSAL', 'PARAMETER_CHANGE', 'PERMISSION_GRANT'],
  },
  STAKING: {
    name: 'Staking',
    depth: 'INTERMEDIATE',
    tier: 2,
    simulators: ['SOLO_STAKING', 'POOL_STAKING', 'LIQUIDITY_POOL', 'YIELD_FARMING'],
  },
  RECURRING_PAYMENTS: {
    name: 'Recurring Payments',
    depth: 'BASIC',
    tier: 2,
    simulators: ['SUBSCRIPTION', 'INSTALLMENT', 'PAYMENT_AUTOMATION'],
  },
  BOUNTIES: {
    name: 'Bounties',
    depth: 'BASIC',
    tier: 2,
    simulators: ['BOUNTY_PROGRAM', 'REWARD_DISTRIBUTION', 'BOUNTY_COMPLETION'],
  },
  BILL_SPLIT: {
    name: 'Bill Split',
    depth: 'BASIC',
    tier: 2,
    simulators: ['BILL_SPLIT', 'EXPENSE_REIMBURSEMENT', 'GROUP_SETTLEMENT'],
  },
  AGENT_DEPLOYMENT: {
    name: 'Agent Deployment',
    depth: 'ADVANCED',
    tier: 1,
    simulators: ['AGENT_DEPLOYMENT', 'MULTI_AGENT_DEPLOYMENT'],
  },
  NFT_OPERATIONS: {
    name: 'NFT Operations',
    depth: 'BASIC',
    tier: 3,
    simulators: ['NFT_MINTING', 'NFT_MARKETPLACE_LISTING', 'NFT_PURCHASE', 'NFT_ROYALTY_TRACKING'],
  },
  REFERRAL_PROGRAMS: {
    name: 'Referral Programs',
    depth: 'BASIC',
    tier: 3,
    simulators: ['REFERRAL_GENERATION', 'REFERRAL_REWARDS', 'REFERRAL_TIER', 'REFERRAL_FRAUD_DETECTION'],
  },
  MICRO_TRANSACTIONS: {
    name: 'Micro-Transactions',
    depth: 'BASIC',
    tier: 3,
    simulators: ['MICRO_WITHDRAWAL', 'TIP_DONATION', 'MICRO_LOAN', 'SAVINGS_CHALLENGE'],
  },
};
