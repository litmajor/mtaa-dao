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
export const SimulatorRegistry: Record<string, () => Promise<any>> = {
  // Category 1: Payment Flow
  PAYMENT_DEPOSIT: async () => {
    const { PaymentDepositSimulator } = await import('./paymentFlowSimulator.js');
    return new PaymentDepositSimulator();
  },
  PAYMENT_WITHDRAWAL: async () => {
    const { PaymentWithdrawalSimulator } = await import('./paymentFlowSimulator.js');
    return new PaymentWithdrawalSimulator();
  },
  PAYMENT_P2P: async () => {
    const { PaymentP2PTransferSimulator } = await import('./paymentFlowSimulator.js');
    return new PaymentP2PTransferSimulator();
  },
  RECURRING_PAYMENT: async () => {
    const { RecurringPaymentSetupSimulator } = await import('./paymentFlowSimulator.js');
    return new RecurringPaymentSetupSimulator();
  },
  PAYMENT_SETTLEMENT: async () => {
    const { PaymentSettlementSimulator } = await import('./paymentFlowSimulator.js');
    return new PaymentSettlementSimulator();
  },

  // Category 2: Trading & DEX
  SPOT_TRADE: async () => {
    const { SpotTradeSimulator } = await import('./tradingDexSimulator.js');
    return new SpotTradeSimulator();
  },
  MARGIN_TRADE: async () => {
    const { MarginTradeSimulator } = await import('./tradingDexSimulator.js');
    return new MarginTradeSimulator();
  },
  PERPETUALS_FUTURES: async () => {
    const { PerpetualsFuturesSimulator } = await import('./tradingDexSimulator.js');
    return new PerpetualsFuturesSimulator();
  },
  DEX_SWAP: async () => {
    const { DexSwapSimulator } = await import('./tradingDexSimulator.js');
    return new DexSwapSimulator();
  },
  FLASH_LOAN: async () => {
    const { FlashLoanSimulator } = await import('./tradingDexSimulator.js');
    return new FlashLoanSimulator();
  },

  // Category 4: Investment Operations
  PORTFOLIO_REBALANCE: async () => {
    const { PortfolioRebalanceSimulator } = await import('./investmentOperationsSimulator.js');
    return new PortfolioRebalanceSimulator();
  },
  DIVIDEND_REINVESTMENT: async () => {
    const { DividendReinvestmentSimulator } = await import('./investmentOperationsSimulator.js');
    return new DividendReinvestmentSimulator();
  },
  MARGIN_LENDING: async () => {
    const { MarginLendingSimulator } = await import('./investmentOperationsSimulator.js');
    return new MarginLendingSimulator();
  },
  FIXED_INCOME: async () => {
    const { FixedIncomeSimulator } = await import('./investmentOperationsSimulator.js');
    return new FixedIncomeSimulator();
  },

  // Category 5: Cross-Chain Bridges
  BRIDGE_TRANSFER: async () => {
    const { BridgeTransferSimulator } = await import('./crossChainBridgesSimulator.js');
    return new BridgeTransferSimulator();
  },
  CROSS_CHAIN_ARBITRAGE: async () => {
    const { CrossChainArbitrageSimulator } = await import('./crossChainBridgesSimulator.js');
    return new CrossChainArbitrageSimulator();
  },

  // Category 6: Escrow & Settlements
  ESCROW_RELEASE: async () => {
    const { EscrowReleaseSimulator } = await import('./escrowSettlementsSimulator.js');
    return new EscrowReleaseSimulator();
  },
  DISPUTE_RESOLUTION: async () => {
    const { DisputeResolutionSimulator } = await import('./escrowSettlementsSimulator.js');
    return new DisputeResolutionSimulator();
  },
  SETTLEMENT_FINALITY: async () => {
    const { SettlementFinalitySimulator } = await import('./escrowSettlementsSimulator.js');
    return new SettlementFinalitySimulator();
  },
  ESCROW_RECOVERY: async () => {
    const { EscrowRecoverySimulator } = await import('./escrowSettlementsSimulator.js');
    return new EscrowRecoverySimulator();
  },

  // Category 7: DAO Treasury
  TREASURY_REBALANCE: async () => {
    const { TreasuryRebalanceSimulator } = await import('./daoTreasurySimulator.js');
    return new TreasuryRebalanceSimulator();
  },
  ASSET_ALLOCATION: async () => {
    const { AssetAllocationSimulator } = await import('./daoTreasurySimulator.js');
    return new AssetAllocationSimulator();
  },
  GRANT_DISTRIBUTION: async () => {
    const { GrantDistributionSimulator } = await import('./daoTreasurySimulator.js');
    return new GrantDistributionSimulator();
  },

  // Category 8: Vaults
  VAULT_DEPOSIT: async () => {
    const { VaultDepositSimulator } = await import('./vaultsSimulator.js');
    return new VaultDepositSimulator();
  },
  VAULT_WITHDRAWAL: async () => {
    const { VaultWithdrawalSimulator } = await import('./vaultsSimulator.js');
    return new VaultWithdrawalSimulator();
  },
  VAULT_LIQUIDATION: async () => {
    const { VaultLiquidationSimulator } = await import('./vaultsSimulator.js');
    return new VaultLiquidationSimulator();
  },
  VAULT_STRATEGY: async () => {
    const { VaultStrategySimulator } = await import('./vaultsSimulator.js');
    return new VaultStrategySimulator();
  },

  // Category 9: Governance
  CREATE_PROPOSAL: async () => {
    const { CreateProposalSimulator } = await import('./governanceSimulator.js');
    return new CreateProposalSimulator();
  },
  VOTE_PROPOSAL: async () => {
    const { VoteOnProposalSimulator } = await import('./governanceSimulator.js');
    return new VoteOnProposalSimulator();
  },
  EXECUTE_PROPOSAL: async () => {
    const { ExecuteProposalSimulator } = await import('./governanceSimulator.js');
    return new ExecuteProposalSimulator();
  },
  PARAMETER_CHANGE: async () => {
    const { ParameterChangeSimulator } = await import('./governanceSimulator.js');
    return new ParameterChangeSimulator();
  },
  PERMISSION_GRANT: async () => {
    const { PermissionGrantSimulator } = await import('./governanceSimulator.js');
    return new PermissionGrantSimulator();
  },

  // Category 9: Staking
  SOLO_STAKING: async () => {
    const { SoloStakingSimulator } = await import('./stakingSimulator.js');
    return new SoloStakingSimulator();
  },
  POOL_STAKING: async () => {
    const { PoolStakingSimulator } = await import('./stakingSimulator.js');
    return new PoolStakingSimulator();
  },
  LIQUIDITY_POOL: async () => {
    const { LiquidityPoolSimulator } = await import('./stakingSimulator.js');
    return new LiquidityPoolSimulator();
  },
  YIELD_FARMING: async () => {
    const { YieldFarmingSimulator } = await import('./stakingSimulator.js');
    return new YieldFarmingSimulator();
  },

  // Category 10: Recurring Payments
  SUBSCRIPTION: async () => {
    const { SubscriptionSimulator } = await import('./recurringAndBillSimulator.js');
    return new SubscriptionSimulator();
  },
  INSTALLMENT: async () => {
    const { InstallmentSimulator } = await import('./recurringAndBillSimulator.js');
    return new InstallmentSimulator();
  },
  PAYMENT_AUTOMATION: async () => {
    const { PaymentAutomationSimulator } = await import('./recurringAndBillSimulator.js');
    return new PaymentAutomationSimulator();
  },

  // Category 11: Bounties
  BOUNTY_PROGRAM: async () => {
    const { BountyProgramSimulator } = await import('./recurringAndBillSimulator.js');
    return new BountyProgramSimulator();
  },
  REWARD_DISTRIBUTION: async () => {
    const { RewardDistributionSimulator } = await import('./recurringAndBillSimulator.js');
    return new RewardDistributionSimulator();
  },
  BOUNTY_COMPLETION: async () => {
    const { BountyCompletionSimulator } = await import('./recurringAndBillSimulator.js');
    return new BountyCompletionSimulator();
  },

  // Category 12: Bill Split
  BILL_SPLIT: async () => {
    const { BillSplitSimulator } = await import('./recurringAndBillSimulator.js');
    return new BillSplitSimulator();
  },
  EXPENSE_REIMBURSEMENT: async () => {
    const { ExpenseReimbursementSimulator } = await import('./recurringAndBillSimulator.js');
    return new ExpenseReimbursementSimulator();
  },
  GROUP_SETTLEMENT: async () => {
    const { GroupSettlementSimulator } = await import('./recurringAndBillSimulator.js');
    return new GroupSettlementSimulator();
  },

  // Agent Deployment
  AGENT_DEPLOYMENT: async () => {
    const { AgentDeploymentSimulator } = await import('./agentDeploymentSimulator.js');
    return new AgentDeploymentSimulator();
  },
  MULTI_AGENT_DEPLOYMENT: async () => {
    const { MultiAgentDeploymentSimulator } = await import('./agentDeploymentSimulator.js');
    return new MultiAgentDeploymentSimulator();
  },

  // Category 13: NFT Operations (TIER 3)
  NFT_MINTING: async () => {
    const { NFTMintingSimulator } = await import('./tierThreeSimulatorsNFT.js');
    return new NFTMintingSimulator();
  },
  NFT_MARKETPLACE_LISTING: async () => {
    const { NFTMarketplaceListingSimulator } = await import('./tierThreeSimulatorsNFT.js');
    return new NFTMarketplaceListingSimulator();
  },
  NFT_PURCHASE: async () => {
    const { NFTPurchaseSimulator } = await import('./tierThreeSimulatorsNFT.js');
    return new NFTPurchaseSimulator();
  },
  NFT_ROYALTY_TRACKING: async () => {
    const { NFTRoyaltyTrackingSimulator } = await import('./tierThreeSimulatorsNFT.js');
    return new NFTRoyaltyTrackingSimulator();
  },

  // Category 14: Referral Programs (TIER 3)
  REFERRAL_GENERATION: async () => {
    const { ReferralGenerationSimulator } = await import('./tierThreeSimulatorsReferral.js');
    return new ReferralGenerationSimulator();
  },
  REFERRAL_REWARDS: async () => {
    const { ReferralRewardsSimulator } = await import('./tierThreeSimulatorsReferral.js');
    return new ReferralRewardsSimulator();
  },
  REFERRAL_TIER: async () => {
    const { ReferralTierAdvancementSimulator } = await import('./tierThreeSimulatorsReferral.js');
    return new ReferralTierAdvancementSimulator();
  },
  REFERRAL_FRAUD_DETECTION: async () => {
    const { ReferralFraudDetectionSimulator } = await import('./tierThreeSimulatorsReferral.js');
    return new ReferralFraudDetectionSimulator();
  },

  // Category 15: Micro-Transactions (TIER 3)
  MICRO_WITHDRAWAL: async () => {
    const { MicroWithdrawalSimulator } = await import('./tierThreeSimulatorsMicro.js');
    return new MicroWithdrawalSimulator();
  },
  TIP_DONATION: async () => {
    const { TipDonationSimulator } = await import('./tierThreeSimulatorsMicro.js');
    return new TipDonationSimulator();
  },
  MICRO_LOAN: async () => {
    const { MicroLoanSimulator } = await import('./tierThreeSimulatorsMicro.js');
    return new MicroLoanSimulator();
  },
  SAVINGS_CHALLENGE: async () => {
    const { SavingsChallengeSimulator } = await import('./tierThreeSimulatorsMicro.js');
    return new SavingsChallengeSimulator();
  },
};

/**
 * Get simulator by name
 */
export async function getSimulator(name: string | keyof typeof SimulatorRegistry) {
  const creator = SimulatorRegistry[name as keyof typeof SimulatorRegistry];
  if (!creator) {
    throw new Error(`Simulator not found: ${name}`);
  }
  return await creator();
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
