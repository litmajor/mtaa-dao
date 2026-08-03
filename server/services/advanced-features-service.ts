/**
 * Advanced DeFi Features Service - Phase 4
 * Handles MEV protection, LP management, staking, options trading, portfolio analytics, and risk management
 */

import { db } from "../db";
import {
  mevStrategies,
  mevTransactions,
  liquidityProviderPositions,
  liquidityPools,
  lpFeeClaims,
  stakingPositions,
  stakingProtocols,
  stakingRewards,
  optionStrategies,
  optionLegPositions,
  optionClosures,
  portfolioSnapshots,
  portfolioMetrics,
  riskModels,
  riskAlerts,
  liquidationRisks,
  assetCorrelations,
} from "@shared/advancedFeaturesTables";
import type { InferInsertModel } from "drizzle-orm";
import { eq, and, desc, gte, lte, avg, sum, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

function toDecimalInput(value: number | string | null | undefined): string {
  if (value == null) return "0";
  return typeof value === "string" ? value : value.toFixed(2);
}

// ==================== MEV PROTECTION ====================

/**
 * Create MEV protection strategy
 */
export async function createMEVStrategy(
  walletConnectionId: string,
  strategyName: string,
  strategyType: "flashbot" | "private_rpc" | "threshold_encryption" | "commit_reveal",
  protectionLevel: string = "standard",
  minThreshold?: string
): Promise<typeof mevStrategies.$inferSelect> {
  const strategy = await db
    .insert(mevStrategies)
    .values({
      id: uuidv4(),
      walletConnectionId,
      strategyName,
      strategyType,
      protectionLevel,
      minThreshold,
      isActive: true,
    })
    .returning();

  return strategy[0];
}

/**
 * Record MEV-protected transaction
 */
export async function recordMEVTransaction(
  strategyId: string,
  transactionId: string,
  originalGasPrice: string,
  protectedGasPrice: string,
  estimatedMevLoss: string,
  actualMevSavings: string,
  executionPath: string
): Promise<typeof mevTransactions.$inferSelect> {
  const mevTx = await db
    .insert(mevTransactions)
    .values({
      id: uuidv4(),
      strategyId,
      transactionId,
      originalGasPrice,
      protectedGasPrice,
      estimatedMevLoss,
      actualMevSavings,
      executionPath,
      orderFlow: "protected",
    })
    .returning();

  // Update strategy stats
  await db
    .update(mevStrategies)
    .set({
      transactionsProtected: sql`${mevStrategies.transactionsProtected} + 1`,
      savingsUsd: sql`${mevStrategies.savingsUsd} + CAST(${actualMevSavings} AS DECIMAL)`,
    })
    .where(eq(mevStrategies.id, strategyId));

  return mevTx[0];
}

/**
 * Get MEV savings summary
 */
export async function getMEVSavingsSummary(walletConnectionId: string) {
  const strategies = await db
    .select()
    .from(mevStrategies)
    .where(eq(mevStrategies.walletConnectionId, walletConnectionId));

  let totalSavings = 0;
  let totalTransactionsProtected = 0;

  for (const strat of strategies) {
    totalSavings += parseFloat(strat.savingsUsd?.toString() || "0");
    totalTransactionsProtected += strat.transactionsProtected || 0;
  }

  return {
    strategies,
    totalSavingsUsd: totalSavings,
    totalTransactionsProtected,
    averageSavingsPerTx: totalTransactionsProtected > 0 ? totalSavings / totalTransactionsProtected : 0,
  };
}

// ==================== LIQUIDITY PROVIDER ====================

/**
 * Create LP position
 */
export async function createLPPosition(
  walletConnectionId: string,
  poolId: string,
  token0Amount: string,
  token1Amount: string,
  token0AmountUsd: string,
  token1AmountUsd: string,
  priceRangeLow?: string,
  priceRangeHigh?: string
): Promise<typeof liquidityProviderPositions.$inferSelect> {
  const pool = await db
    .select({ id: liquidityPools.id })
    .from(liquidityPools)
    .where(eq(liquidityPools.id, poolId))
    .limit(1);

  if (pool.length === 0) {
    throw new Error("Liquidity pool not found");
  }

  const position = await db
    .insert(liquidityProviderPositions)
    .values([
      {
        walletConnectionId,
        poolId,
        token0Amount,
        token1Amount,
        token0AmountUsd: toDecimalInput(token0AmountUsd),
        token1AmountUsd: toDecimalInput(token1AmountUsd),
        priceRangeLow,
        priceRangeHigh,
        status: "active",
      },
    ])
    .returning();

  return position[0];
}

/**
 * Claim LP fees
 */
export async function claimLPFees(
  positionId: string,
  feesAmount: string,
  feesAmountUsd: string,
  token0Fees?: string,
  token1Fees?: string
): Promise<string> {
  const claim = await db
    .insert(lpFeeClaims)
    .values([
      {
        positionId,
        feesAmount,
        feesAmountUsd: toDecimalInput(feesAmountUsd),
        token0Fees: token0Fees ?? null,
        token1Fees: token1Fees ?? null,
      },
    ])
    .returning();

  // Update position
  await db
    .update(liquidityProviderPositions)
    .set({
      feesAccumulated: feesAmount,
      feesAccumulatedUsd: toDecimalInput(feesAmountUsd),
      updatedAt: new Date(),
    })
    .where(eq(liquidityProviderPositions.id, positionId));

  return claim[0].id;
}

/**
 * Calculate impermanent loss
 */
export async function calculateImpermanentLoss(
  positionId: string,
  currentPrice0: string,
  currentPrice1: string,
  initialPrice0: string,
  initialPrice1: string
): Promise<string> {
  const price0Ratio = parseFloat(currentPrice0) / parseFloat(initialPrice0);
  const price1Ratio = parseFloat(currentPrice1) / parseFloat(initialPrice1);

  // IL = 2 * sqrt(price_ratio_1 * price_ratio_2) / (price_ratio_1 + price_ratio_2) - 1
  const priceProduct = Math.sqrt(price0Ratio * price1Ratio);
  const priceSum = price0Ratio + price1Ratio;
  const ilPercent = (2 * priceProduct / priceSum - 1) * 100;

  // Update position with IL
  await db
    .update(liquidityProviderPositions)
    .set({
      impermanentLossActual: ilPercent.toString(),
      updatedAt: new Date(),
    })
    .where(eq(liquidityProviderPositions.id, positionId));

  return ilPercent.toString();
}

/**
 * Get LP portfolio summary
 */
export async function getLPPortfolioSummary(walletConnectionId: string) {
  const positions = await db
    .select()
    .from(liquidityProviderPositions)
    .where(and(eq(liquidityProviderPositions.walletConnectionId, walletConnectionId), eq(liquidityProviderPositions.status, "active")));

  let totalLiquidity = 0;
  let totalFeesAccumulated = 0;
  let totalImpermanentLoss = 0;

  for (const pos of positions) {
    totalLiquidity += parseFloat(pos.token0AmountUsd?.toString() || "0") + parseFloat(pos.token1AmountUsd?.toString() || "0");
    totalFeesAccumulated += parseFloat(pos.feesAccumulatedUsd?.toString() || "0");
    totalImpermanentLoss += parseFloat(pos.impermanentLossActual?.toString() || "0");
  }

  return {
    positions: positions.length,
    totalLiquidityUsd: totalLiquidity,
    totalFeesAccumulatedUsd: totalFeesAccumulated,
    totalImpermanentLoss,
    apy: totalFeesAccumulated > 0 ? ((totalFeesAccumulated / totalLiquidity) * 365 * 100).toFixed(2) : "0",
  };
}

// ==================== STAKING ====================

/**
 * Create staking position
 */
export async function createStakingPosition(
  walletConnectionId: string,
  protocolId: string,
  stakedAmount: string,
  stakedAmountUsd: string
): Promise<typeof stakingPositions.$inferSelect> {
  const position = await db
    .insert(stakingPositions)
    .values({
      walletConnectionId,
      protocolId,
      stakedAmount,
      stakedAmountUsd: toDecimalInput(stakedAmountUsd),
      stakingStartAt: new Date(),
      status: "staking",
    })
    .returning();

  return position[0];
}

/**
 * Claim staking rewards
 */
export async function claimStakingRewards(
  positionId: string,
  rewardAmount: string,
  rewardAmountUsd: string,
  rewardRate: number
): Promise<string> {
  const rewardInsert: InferInsertModel<typeof stakingRewards> = {
    positionId,
    rewardAmount,
    rewardAmountUsd: toDecimalInput(rewardAmountUsd),
    rewardRate: toDecimalInput(rewardRate),
    claimedAt: new Date(),
  };

  const reward = await db
    .insert(stakingRewards)
    .values([rewardInsert])
    .returning();

  return reward[0].id;
}

/**
 * Calculate unstake penalty
 */
export async function calculateUnstakePenalty(positionId: string, currentPrice: string): Promise<string> {
  const position = await db.select().from(stakingPositions).where(eq(stakingPositions.id, positionId));

  if (!position.length) throw new Error("Position not found");

  const protocol = await db
    .select()
    .from(stakingProtocols)
    .where(eq(stakingProtocols.id, position[0].protocolId));

  if (!protocol.length) throw new Error("Protocol not found");

  const unstakeFeePercent = parseFloat(protocol[0].unstakeFee?.toString() || "0");
  const penalty = (parseFloat(position[0].stakedAmountUsd?.toString() || "0") * unstakeFeePercent) / 100;

  return penalty.toFixed(2);
}

/**
 * Get staking summary
 */
export async function getStakingSummary(walletConnectionId: string) {
  const positions = await db
    .select()
    .from(stakingPositions)
    .where(eq(stakingPositions.walletConnectionId, walletConnectionId));

  const rewards = await db
    .selectDistinct()
    .from(stakingRewards)
    .innerJoin(stakingPositions, eq(stakingRewards.positionId, stakingPositions.id))
    .where(eq(stakingPositions.walletConnectionId, walletConnectionId));

  let totalStaked = 0;
  let totalRewardsClaimed = 0;

  for (const pos of positions) {
    totalStaked += parseFloat(pos.stakedAmountUsd?.toString() || "0");
  }

  for (const reward of rewards) {
    totalRewardsClaimed += parseFloat(reward.staking_rewards.rewardAmountUsd?.toString() || "0");
  }

  return {
    positions: positions.length,
    totalStakedUsd: totalStaked,
    totalRewardsClaimedUsd: totalRewardsClaimed,
  };
}

// ==================== OPTIONS TRADING ====================

/**
 * Create options strategy
 */
export async function createOptionsStrategy(
  walletConnectionId: string,
  strategyName: string,
  strategyType: string,
  underlyingAsset: string
): Promise<typeof optionStrategies.$inferSelect> {
  const strategy = await db
    .insert(optionStrategies)
    .values({
      id: uuidv4(),
      walletConnectionId,
      strategyName,
      strategyType,
      underlyingAsset,
    })
    .returning();

  return strategy[0];
}

/**
 * Add option leg to strategy
 */
export async function addOptionLeg(
  strategyId: string,
  optionType: "call" | "put",
  positionType: "long" | "short",
  strikePrice: string,
  expirationDate: Date,
  quantity: number,
  premium: string,
  premiumUsd: string
): Promise<string> {
  const legInsert: InferInsertModel<typeof optionLegPositions> = {
    strategyId,
    optionType,
    positionType,
    strikePrice: toDecimalInput(Number(strikePrice)),
    expirationDate,
    quantity,
    premium,
    premiumUsd: toDecimalInput(premiumUsd),
    status: "open",
  };

  const leg = await db
    .insert(optionLegPositions)
    .values([legInsert])
    .returning();

  return leg[0].id;
}

/**
 * Close option position
 */
export async function closeOptionPosition(
  positionId: string,
  closurePrice: string,
  realizedPnl: string,
  pnlPercent: number
): Promise<string> {
  const closureInsert: InferInsertModel<typeof optionClosures> = {
    positionId,
    closurePrice: toDecimalInput(Number(closurePrice)),
    realizedPnl: toDecimalInput(Number(realizedPnl)),
    pnlPercent: toDecimalInput(pnlPercent),
  };

  const closure = await db
    .insert(optionClosures)
    .values([closureInsert])
    .returning();

  // Update position status
  await db
    .update(optionLegPositions)
    .set({ status: "closed" })
    .where(eq(optionLegPositions.id, positionId));

  return closure[0].id;
}

/**
 * Get options portfolio summary
 */
export async function getOptionsPortfolioSummary(walletConnectionId: string) {
  const strategies = await db
    .select()
    .from(optionStrategies)
    .where(eq(optionStrategies.walletConnectionId, walletConnectionId));

  const openLegs = await db
    .select()
    .from(optionLegPositions)
    .innerJoin(optionStrategies, eq(optionLegPositions.strategyId, optionStrategies.id))
    .where(and(eq(optionStrategies.walletConnectionId, walletConnectionId), eq(optionLegPositions.status, "open")));

  let totalPremiumPaid = 0;
  let totalMaxProfit = 0;
  let totalMaxLoss = 0;

  for (const leg of openLegs) {
    totalPremiumPaid += parseFloat(leg.option_leg_positions.premiumUsd?.toString() || "0");
    totalMaxProfit += parseFloat(leg.option_leg_positions.maxProfit?.toString() || "0");
    totalMaxLoss += parseFloat(leg.option_leg_positions.maxLoss?.toString() || "0");
  }

  return {
    strategies: strategies.length,
    openPositions: openLegs.length,
    totalPremiumPaidUsd: totalPremiumPaid,
    totalMaxProfitUsd: totalMaxProfit,
    totalMaxLossUsd: totalMaxLoss,
  };
}

// ==================== PORTFOLIO ANALYTICS ====================

/**
 * Create portfolio snapshot
 */
export async function createPortfolioSnapshot(
  walletConnectionId: string,
  totalAssetsUsd: string,
  totalDebtUsd: string,
  breakdown: {
    cash: string;
    staking: string;
    lp: string;
    yieldFarming: string;
    options: string;
  }
): Promise<typeof portfolioSnapshots.$inferSelect> {
  const netWorth = parseFloat(totalAssetsUsd) - parseFloat(totalDebtUsd);

  const snapshotInsert: InferInsertModel<typeof portfolioSnapshots> = {
    walletConnectionId,
    totalAssetsUsd: toDecimalInput(totalAssetsUsd),
    totalDebtUsd: toDecimalInput(totalDebtUsd),
    netWorthUsd: toDecimalInput(netWorth),
    cashUsd: toDecimalInput(breakdown.cash),
    stakingUsd: toDecimalInput(breakdown.staking),
    lpUsd: toDecimalInput(breakdown.lp),
    yieldFarmingUsd: toDecimalInput(breakdown.yieldFarming),
    optionsUsd: toDecimalInput(breakdown.options),
    diversificationScore: toDecimalInput(calculateDiversificationScore(breakdown)),
  };

  const snapshot = await db
    .insert(portfolioSnapshots)
    .values([snapshotInsert])
    .returning();

  return snapshot[0];
}

/**
 * Calculate portfolio metrics
 */
export async function calculatePortfolioMetrics(
  walletConnectionId: string,
  priceHistory: Array<{ date: Date; value: number }>
): Promise<typeof portfolioMetrics.$inferSelect> {
  if (priceHistory.length < 2) throw new Error("Insufficient price history");

  // Calculate returns
  const returns = priceHistory.map((p, i) => 
    i === 0 ? 0 : ((p.value - priceHistory[i - 1].value) / priceHistory[i - 1].value) * 100
  );

  const avgReturn = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Calculate drawdown
  let maxValue = priceHistory[0].value;
  let maxDrawdown = 0;
  for (const price of priceHistory) {
    if (price.value > maxValue) maxValue = price.value;
    const drawdown = ((maxValue - price.value) / maxValue) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate Sharpe ratio (assuming 2% risk-free rate)
  const sharpeRatio = (avgReturn - 2) / volatility;

  const metricsInsert: InferInsertModel<typeof portfolioMetrics> = {
    walletConnectionId,
    totalReturn30d: toDecimalInput(avgReturn),
    volatility30d: toDecimalInput(volatility),
    sharpeRatio: toDecimalInput(sharpeRatio),
    maxDrawdown: toDecimalInput(maxDrawdown),
    winRate: toDecimalInput((returns.filter((r) => r > 0).length / returns.length) * 100),
  };

  const metrics = await db
    .insert(portfolioMetrics)
    .values([metricsInsert])
    .returning();

  return metrics[0];
}

/**
 * Get portfolio performance over time
 */
export async function getPortfolioPerformance(
  walletConnectionId: string,
  daysBack: number = 30
): Promise<{
  snapshots: typeof portfolioSnapshots.$inferSelect[];
  metrics: typeof portfolioMetrics.$inferSelect[];
}> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const snapshots = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.walletConnectionId, walletConnectionId),
        gte(portfolioSnapshots.createdAt, since)
      )
    )
    .orderBy(portfolioSnapshots.createdAt);

  const metrics = await db
    .select()
    .from(portfolioMetrics)
    .where(
      and(
        eq(portfolioMetrics.walletConnectionId, walletConnectionId),
        gte(portfolioMetrics.createdAt, since)
      )
    )
    .orderBy(desc(portfolioMetrics.createdAt))
    .limit(1);

  return { snapshots, metrics };
}

// ==================== RISK MANAGEMENT ====================

/**
 * Calculate Value at Risk
 */
export async function calculateValueAtRisk(
  walletConnectionId: string,
  portfolioValue: number,
  volatility: number,
  confidence: number = 95
): Promise<typeof riskModels.$inferSelect> {
  // VaR = Portfolio Value × Z-score × Volatility
  const zScores: Record<number, number> = { 95: 1.645, 99: 2.326 };
  const zScore = zScores[confidence] || 1.645;

  const var1Day = portfolioValue * zScore * (volatility / 100);
  const var7Day = var1Day * Math.sqrt(7);
  const var30Day = var1Day * Math.sqrt(30);

  // Conditional VaR (Expected Shortfall) ≈ 1.25 × VaR
  const expectedShortfall = var1Day * 1.25;

  const model = await db
    .insert(riskModels)
    .values([
      {
        walletConnectionId,
        modelName: `VaR_${confidence}_${new Date().toISOString()}`,
        modelType: "value_at_risk",
        confidenceLevel: confidence,
        timeHorizon: 1,
        var1Day: toDecimalInput(var1Day),
        var7Day: toDecimalInput(var7Day),
        var30Day: toDecimalInput(var30Day),
        expectedShortfall: toDecimalInput(expectedShortfall),
      },
    ])
    .returning();

  return model[0];
}

/**
 * Create risk alert
 */
export async function createRiskAlert(
  walletConnectionId: string,
  alertType: string,
  severity: "info" | "warning" | "critical",
  riskMetric: string,
  currentValue: string,
  threshold: string,
  recommendation?: string
): Promise<typeof riskAlerts.$inferSelect> {
  const alert = await db
    .insert(riskAlerts)
    .values([
      {
        walletConnectionId,
        alertType,
        severity,
        riskMetric,
        currentValue,
        threshold,
        recommendation,
      },
    ])
    .returning();

  return alert[0];
}

/**
 * Get active risk alerts
 */
export async function getActiveRiskAlerts(walletConnectionId: string): Promise<typeof riskAlerts.$inferSelect[]> {
  return await db
    .select()
    .from(riskAlerts)
    .where(and(eq(riskAlerts.walletConnectionId, walletConnectionId), eq(riskAlerts.dismissed, false)))
    .orderBy(desc(riskAlerts.createdAt));
}

/**
 * Calculate liquidation risk
 */
export async function calculateLiquidationRisk(
  walletConnectionId: string,
  protocolName: string,
  totalBorrowedUsd: number,
  totalCollateralUsd: number,
  liquidationThreshold: number = 80
): Promise<typeof liquidationRisks.$inferSelect> {
  const collateralizationRatio = (totalCollateralUsd / totalBorrowedUsd) * 100;
  const healthFactor = totalCollateralUsd / (totalBorrowedUsd * (liquidationThreshold / 100));

  // Calculate time to liquidation assuming 5% daily volatility
  const dailyRiskFactor = 0.05;
  const daysToLiquidation = Math.log(healthFactor) / Math.log(1 - dailyRiskFactor);

  const risk = await db
    .insert(liquidationRisks)
    .values({
      walletConnectionId,
      protocolName,
      totalBorrowedUsd: toDecimalInput(totalBorrowedUsd),
      totalCollateralUsd: toDecimalInput(totalCollateralUsd),
      collateralizationRatio: toDecimalInput(collateralizationRatio),
      liquidationThreshold: toDecimalInput(liquidationThreshold),
      healthFactor: toDecimalInput(healthFactor),
      estimatedTimeToLiquidation: Math.max(0, Math.floor(daysToLiquidation * 24 * 60)),
    })
    .returning();

  return risk[0];
}

/**
 * Get comprehensive risk summary
 */
export async function getRiskSummary(walletConnectionId: string) {
  const [alerts, risks, models] = await Promise.all([
    getActiveRiskAlerts(walletConnectionId),
    db.select().from(liquidationRisks).where(eq(liquidationRisks.walletConnectionId, walletConnectionId)),
    db.select().from(riskModels).where(eq(riskModels.walletConnectionId, walletConnectionId)).orderBy(desc(riskModels.createdAt)).limit(1),
  ]);

  return {
    activeAlerts: alerts,
    liquidationRisks: risks,
    latestVaR: models[0],
    criticalAlerts: alerts.filter((a: typeof riskAlerts.$inferSelect) => a.severity === "critical").length,
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate diversification score 0-100
 */
function calculateDiversificationScore(breakdown: Record<string, string>): number {
  const values = Object.values(breakdown).map((v) => parseFloat(v));
  const total = values.reduce((a: number, b: number) => a + b, 0);
  
  if (total === 0) return 0;

  const weights = values.map((v) => v / total);
  const herfindahl = weights.reduce((sum, w) => sum + w * w, 0);
  const score = Math.max(0, Math.min(100, (1 - herfindahl) * 100));

  return parseFloat(score.toFixed(2));
}

async function getAssetCorrelationSummary() {
  return await db
    .select()
    .from(assetCorrelations)
    .orderBy(desc(assetCorrelations.createdAt))
    .limit(5);
}

/**
 * Get comprehensive wallet advanced features status
 */
export async function getWalletAdvancedStatus(walletConnectionId: string) {
  const [mevSummary, lpSummary, stakingSummary, optionsSummary, performance, riskSummary, correlations] = await Promise.all([
    getMEVSavingsSummary(walletConnectionId),
    getLPPortfolioSummary(walletConnectionId),
    getStakingSummary(walletConnectionId),
    getOptionsPortfolioSummary(walletConnectionId),
    getPortfolioPerformance(walletConnectionId, 30),
    getRiskSummary(walletConnectionId),
    getAssetCorrelationSummary(),
  ]);

  return {
    mev: mevSummary,
    liquidityProviding: lpSummary,
    staking: stakingSummary,
    options: optionsSummary,
    portfolio: performance,
    risk: riskSummary,
    correlations,
  };
}
