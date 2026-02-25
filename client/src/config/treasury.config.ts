/**
 * Treasury Configuration Matrix
 * Complete mapping of DAO types to treasury capabilities,
 * chains, tokens, multisig rules, and voting weight logic
 */

import {
  DAOTreasuryConfig,
  TreasuryAsset,
  DAOType,
  ChainType,
  VotingWeightMapping
} from '@/types/treasury';

// ========== SUPPORTED ASSETS BY CHAIN ==========

// Celo Chain Assets
const CELO_ASSETS: TreasuryAsset[] = [
  {
    chain: 'CELO',
    symbol: 'CELO',
    tokenType: 'native',
    balance: '0',
    decimals: 18,
    votingWeightMapping: 'tokenHolding',
    isActive: true,
    minDepositAmount: '0.01'
  },
  {
    chain: 'CELO',
    symbol: 'cUSD',
    tokenAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    tokenType: 'stablecoin',
    balance: '0',
    decimals: 18,
    votingWeightMapping: 'tokenHolding',
    isActive: true,
    minDepositAmount: '1'
  }
];

// Ethereum Assets
const ETH_ASSETS: TreasuryAsset[] = [
  {
    chain: 'ETH',
    symbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenType: 'stablecoin',
    balance: '0',
    decimals: 6,
    votingWeightMapping: 'tokenHolding',
    isActive: true,
    minDepositAmount: '1'
  },
  {
    chain: 'ETH',
    symbol: 'DAI',
    tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    tokenType: 'stablecoin',
    balance: '0',
    decimals: 18,
    votingWeightMapping: 'tokenHolding',
    isActive: true,
    minDepositAmount: '1'
  }
];

// Binance Smart Chain Assets
const BSC_ASSETS: TreasuryAsset[] = [
  {
    chain: 'BSC',
    symbol: 'USDC',
    tokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    tokenType: 'stablecoin',
    balance: '0',
    decimals: 18,
    votingWeightMapping: 'tokenHolding',
    isActive: true,
    minDepositAmount: '1'
  }
];

// ========== DAO TREASURY MATRIX ==========

/**
 * Free / Test DAO Configuration
 * - Lightweight, for experimentation & testing
 * - Single chain (CELO), basic stablecoins
 * - Optional governance, no multisig required
 */
const FREE_DAO_CONFIG: DAOTreasuryConfig = {
  daoType: 'free',
  defaultChains: ['CELO'],
  supportedAssets: CELO_ASSETS,
  multisigRequired: false,
  minSigners: 1,
  maxSigners: 2,
  votingWeightSource: ['deposit', 'equal'],
  specialNotes: 'Lightweight; good for trials, events, donations. No deposits required, ephemeral DAOs.',
  features: {
    membersCanDeposit: true,
    customTokenAllowed: false,
    emergencyWithdrawAllowed: false,
    multiChainSupport: false
  }
};

/**
 * Short-Term DAO Configuration
 * - Event-driven, temporary campaigns (30–90 days)
 * - Fund duration is fixed and limited lifetime
 * - Good for short fundraisers or contests
 */
const SHORTTERM_DAO_CONFIG: DAOTreasuryConfig = {
  daoType: 'shortTerm',
  defaultChains: ['CELO'],
  supportedAssets: CELO_ASSETS,
  multisigRequired: false,
  minSigners: 2,
  maxSigners: 3,
  votingWeightSource: ['deposit'],
  specialNotes: 'Focused treasury for 30–90 day campaigns with fixed expiration',
  features: {
    membersCanDeposit: true,
    customTokenAllowed: false,
    emergencyWithdrawAllowed: false,
    multiChainSupport: false
  }
};

/**
 * Collective / Core DAO Configuration
 * - Full community governance, long-term
 * - All treasury types: cUSD, CELO, dual, custom stablecoins
 * - Multisig required, peer invites tracked, full feature set
 */
const COLLECTIVE_DAO_CONFIG: DAOTreasuryConfig = {
  daoType: 'collective',
  defaultChains: ['CELO', 'ETH'],
  supportedAssets: [...CELO_ASSETS, ...ETH_ASSETS],
  multisigRequired: true,
  minSigners: 2,
  maxSigners: 5,
  votingWeightSource: ['tokenHolding', 'deposit'],
  specialNotes: 'Full-featured DAO, can handle custom stablecoins and partner tokens. Multisig optional based on DAO settings.',
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,
    emergencyWithdrawAllowed: false,
    multiChainSupport: true
  }
};

/**
 * Governance DAO Configuration
 * - Community leadership, major decisions
 * - Full democracy / multi-role governance
 * - Multi-chain if needed
 */
const GOVERNANCE_DAO_CONFIG: DAOTreasuryConfig = {
  daoType: 'governance',
  defaultChains: ['CELO', 'ETH'],
  supportedAssets: [...CELO_ASSETS, ...ETH_ASSETS],
  multisigRequired: true,
  minSigners: 3,
  maxSigners: 7,
  votingWeightSource: ['equal', 'tokenHolding'],
  specialNotes: 'Governance-focused with multi-chain support for large communities.',
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,
    emergencyWithdrawAllowed: false,
    multiChainSupport: true
  }
};

/**
 * Meta DAO Configuration
 * - Multi-DAO coordination and regional networks
 * - Maximum flexibility and chain support
 */
const META_DAO_CONFIG: DAOTreasuryConfig = {
  daoType: 'meta',
  defaultChains: ['CELO', 'ETH', 'BSC', 'POLYGON', 'ARBITRUM'],
  supportedAssets: [...CELO_ASSETS, ...ETH_ASSETS, ...BSC_ASSETS],
  multisigRequired: true,
  minSigners: 3,
  maxSigners: 15,
  votingWeightSource: ['tokenHolding', 'equal'],
  specialNotes: 'Advanced treasury for long-term investments, asset diversification, or fundraising. Full multi-chain support.',
  features: {
    membersCanDeposit: true,
    customTokenAllowed: true,
    emergencyWithdrawAllowed: false,
    multiChainSupport: true
  }
};

// ========== COMPLETE MATRIX LOOKUP ==========

export const TREASURY_MATRIX: Record<DAOType, DAOTreasuryConfig> = {
  free: FREE_DAO_CONFIG,
  shortTerm: SHORTTERM_DAO_CONFIG,
  collective: COLLECTIVE_DAO_CONFIG,
  governance: GOVERNANCE_DAO_CONFIG,
  meta: META_DAO_CONFIG
};

// ========== CONVENIENT GETTERS ==========

/**
 * Get complete treasury config for a DAO type
 */
export const getTreasuryConfigForDAOType = (daoType: DAOType): DAOTreasuryConfig => {
  return TREASURY_MATRIX[daoType];
};

/**
 * Get supported chains for a DAO type
 */
export const getSupportedChainsForDAOType = (daoType: DAOType): ChainType[] => {
  return TREASURY_MATRIX[daoType].defaultChains;
};

/**
 * Get supported assets for a DAO type
 */
export const getSupportedAssetsForDAOType = (daoType: DAOType): TreasuryAsset[] => {
  return TREASURY_MATRIX[daoType].supportedAssets;
};

/**
 * Get supported asset symbols for a DAO type
 */
export const getSupportedSymbolsForDAOType = (daoType: DAOType): string[] => {
  return TREASURY_MATRIX[daoType].supportedAssets.map(asset => asset.symbol);
};

/**
 * Check if multisig is required for a DAO type
 */
export const isMultisigRequiredForDAOType = (daoType: DAOType): boolean => {
  return TREASURY_MATRIX[daoType].multisigRequired;
};

/**
 * Get multisig settings for a DAO type
 */
export const getMultisigSettingsForDAOType = (daoType: DAOType) => {
  const config = TREASURY_MATRIX[daoType];
  return {
    required: config.multisigRequired,
    minSigners: config.minSigners,
    maxSigners: config.maxSigners
  };
};

/**
 * Check if custom tokens are allowed for a DAO type
 */
export const areCustomTokensAllowedForDAOType = (daoType: DAOType): boolean => {
  return TREASURY_MATRIX[daoType].features.customTokenAllowed;
};

/**
 * Get voting weight sources available for a DAO type
 */
export const getVotingWeightSourcesForDAOType = (daoType: DAOType): VotingWeightMapping[] => {
  return TREASURY_MATRIX[daoType].votingWeightSource;
};

/**
 * Get an asset configuration by symbol and chain
 */
export const getAssetConfig = (symbol: string, chain: ChainType): TreasuryAsset | undefined => {
  for (const config of Object.values(TREASURY_MATRIX)) {
    const asset = config.supportedAssets.find(a => a.symbol === symbol && a.chain === chain);
    if (asset) return asset;
  }
  return undefined;
};

/**
 * Check if an asset is supported for a specific DAO type
 */
export const isAssetSupportedForDAOType = (daoType: DAOType, symbol: string, chain: ChainType): boolean => {
  const config = TREASURY_MATRIX[daoType];
  return config.supportedAssets.some(a => a.symbol === symbol && a.chain === chain);
};

/**
 * Get the voting weight impact of an asset for a DAO type
 */
export const getVotingWeightMapping = (daoType: DAOType, symbol: string, chain: ChainType): VotingWeightMapping | null => {
  const asset = TREASURY_MATRIX[daoType].supportedAssets.find(a => a.symbol === symbol && a.chain === chain);
  return asset ? asset.votingWeightMapping : null;
};
