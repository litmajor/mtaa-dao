/**
 * Vault Service - Shared Types and Interfaces
 * 
 * Common types and schemas used across all vault modules
 */

import { z } from 'zod';
import type { SupportedToken } from '../../../shared/tokenRegistry';
import type { Vault, VaultTransaction } from '../../../shared/schema';

// Request interfaces
export interface VaultDepositRequest {
  vaultId: string;
  userId: string;
  tokenSymbol: SupportedToken;
  amount: string;
  transactionHash?: string;
}

export interface VaultWithdrawRequest {
  vaultId: string;
  userId: string;
  tokenSymbol: SupportedToken;
  amount: string;
  transactionHash?: string;
}

export interface CreateVaultRequest {
  name: string;
  description?: string;
  userId?: string;
  daoId?: string;
  vaultType: 'regular' | 'savings' | 'locked_savings' | 'yield' | 'dao_treasury';
  primaryCurrency: SupportedToken;
  chainId: number; // blockchain network ID (42220 = Celo, 1 = Ethereum, 8453 = Base, etc.)
  yieldStrategy?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  minDeposit?: string;
  maxDeposit?: string;
}

export interface StrategyAllocationRequest {
  vaultId: string;
  userId: string;
  strategyId: string;
  tokenSymbol: SupportedToken;
  allocationPercentage: number;
}

export type VaultOperation = 'view' | 'deposit' | 'withdraw' | 'allocate' | 'rebalance';

// Internal interfaces
export interface PendingTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'allocation';
  vaultId: string;
  userId: string;
  amount: string;
  tokenSymbol: SupportedToken;
  retryCount?: number;
}

export interface PriceCache {
  price: number;
  timestamp: number;
  confidence?: number;
}

// Zod Validation Schemas
export const createVaultSchema = z.object({
  name: z.string().min(1, "Vault name is required"),
  description: z.string().optional(),
  userId: z.string().optional(),
  daoId: z.string().optional(),
  vaultType: z.enum(['regular', 'savings', 'locked_savings', 'yield', 'dao_treasury']),
  primaryCurrency: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  chainId: z.number().int().positive("Chain ID must be a positive integer"),
  yieldStrategy: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  minDeposit: z.string().optional(),
  maxDeposit: z.string().optional(),
});

export const depositSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  transactionHash: z.string().optional(),
});

export const withdrawSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  transactionHash: z.string().optional(),
});

export const strategyAllocationSchema = z.object({
  vaultId: z.string().min(1, "Vault ID is required"),
  userId: z.string().min(1, "User ID is required"),
  strategyId: z.string().min(1, "Strategy ID is required"),
  tokenSymbol: z.enum(['CELO', 'cUSD', 'cEUR', 'USDT', 'USDC', 'MTAA'] as const),
  allocationPercentage: z.number().min(0).max(100),
});
