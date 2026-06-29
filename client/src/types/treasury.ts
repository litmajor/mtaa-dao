/**
 * Treasury Types & Interfaces
 * Complete type definitions for the DAO Treasury system supporting
 * multi-chain, multi-token treasury management
 */

// DAO Type Union — matches DaoType in shared/types/dao.ts and the dao_type column in the daos table
export type DAOType = 'harambee' | 'shortTerm' | 'savings' | 'community' | 'investment' | 'merryGoRound';

// Supported blockchain networks
export type ChainType = 'CELO' | 'ETH' | 'BSC' | 'POLYGON' | 'ARBITRUM';

// Token types supported
export type TokenType = 'native' | 'stablecoin' | 'custom-erc20';

// Voting weight calculation methods
export type VotingWeightMapping = 'deposit' | 'tokenHolding' | 'donation' | 'equal';

// Treasury asset configuration
export interface TreasuryAsset {
  chain: ChainType;
  tokenAddress?: string; // null for native tokens (CELO)
  symbol: string; // CELO, cUSD, DAI, USDC, etc.
  tokenType: TokenType;
  balance: string; // stored as string for precision
  decimals: number; // token decimals (18 for most, 6 for USDC)
  votingWeightMapping: VotingWeightMapping; // how this asset impacts voting
  isActive: boolean; // for paused/removed assets
  minDepositAmount?: string; // minimum deposit for this token
  maxDepositAmount?: string; // maximum deposit (optional)
  allowEmergencyWithdrawal?: boolean; // for bail/donation DAOs
}

// Treasury configuration for a DAO
export interface DAOTreasury {
  daoId: string;
  daoType: DAOType;
  assets: TreasuryAsset[];
  multisigRequired: boolean;
  minSigners: number;
  maxSigners?: number;
  membersCanDeposit: boolean;
  customTokenAllowed: boolean; // allow DAO admins to add ERC-20
  emergencyWithdrawAllowed?: boolean; // only for certain DAOs
  totalValueUSD?: string; // cached total value in USD
  lastUpdated?: string; // ISO timestamp
}

// Complete DAO Treasury Configuration Matrix
export interface DAOTreasuryConfig {
  daoType: DAOType;
  defaultChains: ChainType[];
  supportedAssets: TreasuryAsset[];
  multisigRequired: boolean;
  minSigners: number;
  maxSigners: number;
  votingWeightSource: VotingWeightMapping[];
  specialNotes: string;
  features: {
    membersCanDeposit: boolean;
    customTokenAllowed: boolean;
    emergencyWithdrawAllowed: boolean;
    multiChainSupport: boolean;
  };
}

// Transaction types for treasury
export type TreasuryTransaction = 'deposit' | 'withdrawal' | 'transfer' | 'swap' | 'multisig-approval' | 'multisig-execution';

// Treasury operation log entry
export interface TreasuryOperationLog {
  id: string;
  daoId: string;
  type: TreasuryTransaction;
  asset: TreasuryAsset;
  amount: string;
  from?: string; // wallet address
  to?: string; // wallet address or contract
  chainId: number;
  blockNumber?: number;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string; // ISO timestamp
  signatures?: Array<{
    signer: string;
    signature: string;
    timestamp: string;
  }>;
  metadata?: Record<string, any>;
}

// Multisig configuration
export interface MultisigConfig {
  signers: string[]; // wallet addresses
  requiredSignatures: number;
  chainId: number; // which chain the multisig is deployed on
  contractAddress?: string; // deployed multisig contract address
}

// Treasury validation request
export interface TreasuryValidationRequest {
  daoType: DAOType;
  selectedAssets: TreasuryAsset[];
  multisigEnabled: boolean;
  multisigSigners?: string[];
  multisigRequiredSignatures?: number;
}

// Treasury validation response
export interface TreasuryValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

// Treasury deposit/withdrawal request
export interface TreasuryActionRequest {
  daoId: string;
  actionType: 'deposit' | 'withdrawal';
  asset: TreasuryAsset;
  amount: string;
  fromAddress: string; // depositor/withdrawer wallet
  toAddress?: string; // optional recipient for withdrawals
  requiresMultisig: boolean;
}

// Oracle price data for USD conversion
export interface OraclePriceData {
  chain: ChainType;
  tokenSymbol: string;
  priceUSD: number;
  lastUpdated: string; // ISO timestamp
  source: string; // Chainlink, Uniswap, etc.
}
