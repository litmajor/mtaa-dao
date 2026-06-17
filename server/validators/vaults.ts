import { z } from 'zod';

const positiveNumber = z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().positive());

export const createVaultBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  daoId: z.string().optional(),
  vaultType: z.string().min(1),
  primaryCurrency: z.string().min(1),
  yieldStrategy: z.string().optional(),
  riskLevel: z.enum(['low','medium','high']).optional(),
  minDeposit: positiveNumber.optional(),
  maxDeposit: positiveNumber.optional(),
});

export const vaultIdParamsSchema = z.object({
  vaultId: z.string().min(1),
});

export const depositWithdrawBodySchema = z.object({
  tokenSymbol: z.string().min(1),
  amount: positiveNumber,
  transactionHash: z.string().optional(),
});

export const allocateToStrategyBodySchema = z.object({
  strategyId: z.string().min(1),
  tokenSymbol: z.string().min(1),
  allocationPercentage: z.preprocess((v) => Number(v), z.number().min(0).max(100)),
});

export const getVaultTransactionsQuerySchema = z.object({
  page: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).optional()),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(100).optional()),
});

export type CreateVaultBody = typeof createVaultBodySchema;
