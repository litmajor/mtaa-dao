/**
 * Advanced Features Schema - Zod validation schemas
 * MEV protection, LP management, staking, options, analytics, and risk management
 */

import { z } from "zod";

// MEV Strategy Schema
export const mevStrategySchema = z.object({
  walletId: z.string().uuid(),
  strategyType: z.enum(["frontrun_protection", "sandwich_protection", "mev_share"]),
  protectionLevel: z.enum(["low", "medium", "high"]).default("medium"),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

// LP Position Schema
export const lpPositionSchema = z.object({
  walletId: z.string().uuid(),
  poolAddress: z.string().startsWith("0x"),
  tokenA: z.string(),
  tokenB: z.string(),
  amountA: z.string().transform(Number),
  amountB: z.string().transform(Number),
  slippageTolerance: z.string().transform(Number).default("0.5"),
  metadata: z.record(z.any()).optional(),
});

// Staking Position Schema
export const stakingPositionSchema = z.object({
  walletId: z.string().uuid(),
  stakingContract: z.string().startsWith("0x"),
  tokenAddress: z.string().startsWith("0x"),
  amount: z.string().transform(Number),
  lockupPeriod: z.number().positive().optional(),
  autoCompound: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

// Option Strategy Schema
export const optionStrategySchema = z.object({
  walletId: z.string().uuid(),
  strategyType: z.enum(["call", "put", "straddle", "strangle"]),
  underlyingAsset: z.string(),
  strikePrice: z.string().transform(Number),
  expirationDate: z.string().transform(Date),
  quantity: z.string().transform(Number),
  metadata: z.record(z.any()).optional(),
});

// Portfolio Snapshot Schema
export const portfolioSnapshotSchema = z.object({
  walletId: z.string().uuid(),
  totalValue: z.string().transform(Number),
  totalDeposited: z.string().transform(Number).optional(),
  totalReturns: z.string().transform(Number).optional(),
  metadata: z.record(z.any()).optional(),
});

// Risk Alert Schema
export const riskAlertSchema = z.object({
  walletId: z.string().uuid(),
  alertType: z.enum([
    "liquidation_risk",
    "slippage_warning",
    "impermanent_loss",
    "high_volatility",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  metadata: z.record(z.any()).optional(),
});
