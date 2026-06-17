/**
 * Agent Wallet Service - Shared Types and Interfaces
 * 
 * Common types, interfaces, and enums used across all agent-wallet modules
 */

import type { TransactionReceipt, Contract } from 'web3';
import type {
  Transaction as SharedTransaction,
  SelectedAccount as SharedSelectedAccount,
  NetworkInfo as SharedNetworkInfo,
  WalletBalance as SharedWalletBalance,
  TokenInfo as SharedTokenInfo,
  TokenBalance as SharedTokenBalance,
  Portfolio as SharedPortfolio,
  PortfolioSnapshot as SharedPortfolioSnapshot
} from '../../shared/types/wallet';

// Transaction types
export interface TransactionResult extends SharedTransaction {
  blockNumber?: number;
  gasUsed?: number;
  effectiveGasPrice?: number;
  timestamp?: number;
  errorReason?: string;
}

export interface TransactionHistory {
  transactions: TransactionResult[];
  totalCount: number;
  lastUpdated: number;
}

// Re-export shared aliases for convenience
export type Transaction = SharedTransaction
export type SelectedAccount = SharedSelectedAccount

// Network types
export type NetworkInfo = SharedNetworkInfo

export interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  name: string;
  explorerUrl: string;
}

// Wallet types
export interface WalletCredentials {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

export type WalletBalance = SharedWalletBalance & {
  address?: string;
  balance?: string;
  balanceEth?: number;
  nonce?: number;
  isContract?: boolean;
  transactionCount?: number;
  codeLength?: number;
  timestamp?: number;
}

export interface AccountInfo {
  address: string;
  balance: string;
  balanceEth: number;
  transactionCount: number;
  isContract: boolean;
  codeLength: number;
  timestamp: number;
}

// Token types
export type TokenInfo = SharedTokenInfo & { address?: string }
export type TokenBalance = SharedTokenBalance & { accountAddress?: string }

// Wallet config/state used by persistence
export interface WalletConfig {
  address: string;
  chainId: number;
  network: string;
  privateKey?: string;
  createdAt?: number;
}

export interface WalletState {
  unlocked?: boolean;
  lastSeenBlock?: number;
  nonce?: number;
  balances?: WalletBalance;
  tokens?: Record<string, TokenInfo>;
  savedAt?: string;
}

// Gas price data
export interface GasPriceData {
  gasPrice: string;
  baseFeePerGas?: string;
  timestamp?: number;
}

// Portfolio types
export type Portfolio = SharedPortfolio
export type PortfolioSnapshot = SharedPortfolioSnapshot

// Transaction types
export interface Disbursement {
  toAddress: string;
  amount: number;
  tokenAddress?: string;
  meta?: any;
  priority?: 'low' | 'medium' | 'high';
  scheduledAt?: number;
}

export interface DisbursementEstimate {
  totalGasCost: number;
  totalGasCostUsd?: number;
  costPerDisbursement: number;
  estimatedTime: number;
}

export interface ContributionLog {
  daoId: string;
  userId: string;
  amount: number;
  tokenAddress?: string;
  txHash: string;
  timestamp: number;
  meta?: any;
}

// Gas configuration
export interface GasConfig {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimit?: number;
}

// Swap types
export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  route: string[];
  gasEstimate: number;
}

// Multisig types
export interface MultisigInfo {
  address: string;
  owners: string[];
  requiredSignatures: number;
  balance: number;
  transactions: TransactionResult[];
}

// DAO Treasury types
export interface TreasurySnapshot {
  nativeBalance: number;
  nativeBalanceUsd: number;
  tokenBalances: Record<string, TokenInfo>;
  totalValueUsd: number;
  timestamp: number;
}

export interface TreasuryReport {
  period: 'daily' | 'weekly' | 'monthly';
  snapshotStart: TreasurySnapshot;
  snapshotEnd: TreasurySnapshot;
  periodStart: number;
  periodEnd: number;
  valueChange: number;
  percentageChange: number;
  transactions: TransactionResult[];
}

// Risk assessment types
export interface RiskAssessment {
  walletAddress: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    concentrationRisk: number;
    volatilityRisk: number;
    counterpartyRisk: number;
    liquidityRisk: number;
  };
  recommendations: string[];
  timestamp: number;
}

export interface RiskMetrics {
  concentrationIndex: number; // 0-1
  volatilityIndex: number; // 0-1
  liquidityScore: number; // 0-100
  diversificationScore: number; // 0-100
}

// Permission types
export type PermissionCheckFn = (daoId: string, userId: string, action: string) => Promise<boolean>;
export type ContributionLoggerFn = (log: ContributionLog) => Promise<void>;
export type BillingLoggerFn = (log: any) => Promise<void>;
export type PriceOracleFn = (tokenAddress: string) => Promise<number>;

// Validation types
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface AddressValidation extends ValidationResult {
  address?: string;
}

export interface TransactionValidation extends ValidationResult {
  gasCost?: number;
  gasCostUsd?: number;
}

// Deploy types
export interface DeploymentResult {
  success: boolean;
  daoAddress?: string;
  error?: string;
  txHash?: string;
  blockNumber?: number;
}

export interface DeploymentConfig {
  abi: any[];
  bytecode: string;
  constructorArgs?: any[];
  networkConfig: NetworkConfig;
  privateKey: string;
}
