/**
 * Transaction Processing Schema - Zod validation schemas
 * Batching, smart contracts, DEX swaps, yield farming, and DeFi operations
 */

import { z } from "zod";

// Transaction Batch Schema
export const transactionBatchSchema = z.object({
  walletId: z.string().uuid(),
  batchName: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  metadata: z.record(z.any()).optional(),
});

// Batched Transaction Schema
export const batchedTransactionSchema = z.object({
  batchId: z.string().uuid(),
  toAddress: z.string().startsWith("0x").or(z.string().min(34).max(44)),
  amount: z.string().transform(Number),
  tokenSymbol: z.string().optional(),
  gasLimit: z.string().transform(Number).optional(),
  metadata: z.record(z.any()).optional(),
});

// DEX Swap Schema
export const dexSwapSchema = z.object({
  walletId: z.string().uuid(),
  fromToken: z.string(),
  toToken: z.string(),
  amountIn: z.string().transform(Number),
  minAmountOut: z.string().transform(Number),
  dex: z.enum(["uniswap", "sushiswap", "pancakeswap", "other"]),
  slippage: z.string().transform(Number).default("0.5"),
  metadata: z.record(z.any()).optional(),
});

// Yield Position Schema
export const yieldPositionSchema = z.object({
  walletId: z.string().uuid(),
  poolAddress: z.string().startsWith("0x"),
  tokenAddress: z.string().startsWith("0x"),
  amount: z.string().transform(Number),
  apy: z.string().transform(Number).optional(),
  metadata: z.record(z.any()).optional(),
});

// Rebalancing Rule Schema
export const rebalancingRuleSchema = z.object({
  walletId: z.string().uuid(),
  ruleName: z.string().min(1).max(255),
  targetAllocations: z.record(z.string(), z.string().transform(Number)),
  rebalancingThreshold: z.string().transform(Number).default("5"),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

// Bridge Transaction Schema
export const bridgeTransactionSchema = z.object({
  walletId: z.string().uuid(),
  sourceChainId: z.number(),
  destChainId: z.number(),
  tokenAddress: z.string().startsWith("0x"),
  amount: z.string().transform(Number),
  destAddress: z.string().startsWith("0x").optional(),
  metadata: z.record(z.any()).optional(),
});

// Transaction Simulation Schema
export const transactionSimulationSchema = z.object({
  toAddress: z.string().startsWith("0x").or(z.string().min(34).max(44)),
  amount: z.string().transform(Number),
  tokenSymbol: z.string().optional(),
  gasPrice: z.string().transform(Number).optional(),
  metadata: z.record(z.any()).optional(),
});

// Oracle Price Schema
export const oraclePriceSchema = z.object({
  tokenSymbol: z.string(),
  chainId: z.number().optional(),
  timestamp: z.string().transform(Date).optional(),
});
