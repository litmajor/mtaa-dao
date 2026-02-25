/**
 * Advanced DeFi Features Tables - Drizzle ORM
 * MEV protection, LP management, staking, options trading, portfolio analytics, risk management
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, decimal, integer, index, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===== MEV PROTECTION =====

/**
 * MEV protection strategies
 */
export const mevStrategies = pgTable("mev_strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  strategyName: varchar("strategy_name", { length: 255 }).notNull(),
  strategyType: varchar("strategy_type", { length: 100 }).notNull(), // 'flashbot', 'private_rpc', 'threshold_encryption', 'commit_reveal'
  protectionLevel: varchar("protection_level", { length: 100 }).default("standard"), // 'standard', 'advanced', 'premium'
  minThreshold: varchar("min_threshold", { length: 255 }),
  
  // Stats
  transactionsProtected: integer("transactions_protected").default(0),
  savingsUsd: numeric("savings_usd", { precision: 20, scale: 2 }).default("0"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletIdx: index("mev_strategies_wallet_idx").on(table.walletConnectionId),
  typeIdx: index("mev_strategies_type_idx").on(table.strategyType),
}));

/**
 * MEV-protected transactions
 */
export const mevTransactions = pgTable("mev_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  strategyId: uuid("strategy_id").notNull(),
  transactionId: varchar("transaction_id", { length: 255 }),
  
  // Gas comparison
  originalGasPrice: varchar("original_gas_price", { length: 255 }).notNull(),
  protectedGasPrice: varchar("protected_gas_price", { length: 255 }).notNull(),
  
  // MEV metrics
  estimatedMevLoss: varchar("estimated_mev_loss", { length: 255 }),
  actualMevSavings: varchar("actual_mev_savings", { length: 255 }),
  
  // Execution details
  executionPath: varchar("execution_path", { length: 255 }),
  orderFlow: varchar("order_flow", { length: 100 }).default("protected"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  strategyIdx: index("mev_transactions_strategy_idx").on(table.strategyId),
}));

// ===== LIQUIDITY PROVIDER =====

/**
 * Liquidity pools
 */
export const liquidityPools = pgTable("liquidity_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(),
  poolAddress: varchar("pool_address", { length: 255 }).notNull().unique(),
  token0: varchar("token_0", { length: 100 }).notNull(),
  token1: varchar("token_1", { length: 100 }).notNull(),
  
  // Pool info
  protocol: varchar("protocol", { length: 100 }), // 'uniswap', 'sushiswap', etc
  feeTier: varchar("fee_tier", { length: 50 }), // '0.01%', '0.05%', etc
  currentLiquidity: numeric("current_liquidity", { precision: 30, scale: 8 }),
  
  // Volume & fees
  volume24h: numeric("volume_24h", { precision: 30, scale: 8 }),
  feesGenerated24h: numeric("fees_generated_24h", { precision: 30, scale: 8 }),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainPoolIdx: index("liquidity_pools_chain_pool").on(table.chainId, table.poolAddress),
  protocolIdx: index("liquidity_pools_protocol_idx").on(table.protocol),
}));

/**
 * LP positions
 */
export const liquidityProviderPositions = pgTable("liquidity_provider_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  poolId: uuid("pool_id").notNull(),
  
  // Position details
  token0Amount: varchar("token_0_amount", { length: 255 }).notNull(),
  token1Amount: varchar("token_1_amount", { length: 255 }).notNull(),
  token0AmountUsd: numeric("token_0_amount_usd", { precision: 20, scale: 2 }),
  token1AmountUsd: numeric("token_1_amount_usd", { precision: 20, scale: 2 }),
  
  // Price range (for concentrated liquidity)
  priceRangeLow: varchar("price_range_low", { length: 255 }),
  priceRangeHigh: varchar("price_range_high", { length: 255 }),
  
  // Fees and IL
  feesAccumulated: varchar("fees_accumulated", { length: 255 }),
  feesAccumulatedUsd: numeric("fees_accumulated_usd", { precision: 20, scale: 2 }),
  impermanentLossActual: varchar("impermanent_loss_actual", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("active"), // 'active', 'closed', 'pending'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletPoolIdx: index("lp_positions_wallet_pool").on(table.walletConnectionId, table.poolId),
  statusIdx: index("lp_positions_status_idx").on(table.status),
}));

/**
 * LP fee claims
 */
export const lpFeeClaims = pgTable("lp_fee_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull(),
  
  // Claim details
  feesAmount: varchar("fees_amount", { length: 255 }).notNull(),
  feesAmountUsd: numeric("fees_amount_usd", { precision: 20, scale: 2 }),
  token0Fees: varchar("token_0_fees", { length: 255 }),
  token1Fees: varchar("token_1_fees", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  positionIdx: index("lp_fee_claims_position_idx").on(table.positionId),
}));

// ===== STAKING =====

/**
 * Staking protocols
 */
export const stakingProtocols = pgTable("staking_protocols", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(),
  
  // Protocol info
  protocolName: varchar("protocol_name", { length: 255 }).notNull(),
  stakingToken: varchar("staking_token", { length: 100 }).notNull(),
  rewardToken: varchar("reward_token", { length: 100 }),
  
  // Staking parameters
  minimumStake: varchar("minimum_stake", { length: 255 }),
  unstakeFee: varchar("unstake_fee", { length: 100 }), // Percentage
  lockupPeriod: integer("lockup_period"), // Days
  
  // APY
  currentApy: numeric("current_apy", { precision: 10, scale: 2 }),
  estimatedApy: numeric("estimated_apy", { precision: 10, scale: 2 }),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainIdx: index("staking_protocols_chain_idx").on(table.chainId),
  protocolIdx: index("staking_protocols_name_idx").on(table.protocolName),
}));

/**
 * Staking positions
 */
export const stakingPositions = pgTable("staking_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  protocolId: uuid("protocol_id").notNull(),
  
  // Staking details
  stakedAmount: varchar("staked_amount", { length: 255 }).notNull(),
  stakedAmountUsd: numeric("staked_amount_usd", { precision: 20, scale: 2 }),
  
  // Rewards
  accumulatedRewards: varchar("accumulated_rewards", { length: 255 }).default("0"),
  accumulatedRewardsUsd: numeric("accumulated_rewards_usd", { precision: 20, scale: 2 }).default("0"),
  
  // Timing
  stakingStartAt: timestamp("staking_start_at").defaultNow(),
  unstakedAt: timestamp("unstaked_at"),
  
  // Status
  status: varchar("status", { length: 50 }).default("staking"), // 'staking', 'unstaking', 'unstaked', 'paused'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletProtocolIdx: index("staking_positions_wallet_protocol").on(table.walletConnectionId, table.protocolId),
  statusIdx: index("staking_positions_status_idx").on(table.status),
}));

/**
 * Staking rewards
 */
export const stakingRewards = pgTable("staking_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull(),
  
  // Reward details
  rewardAmount: varchar("reward_amount", { length: 255 }).notNull(),
  rewardAmountUsd: numeric("reward_amount_usd", { precision: 20, scale: 2 }),
  rewardRate: numeric("reward_rate", { precision: 10, scale: 4 }),
  
  claimedAt: timestamp("claimed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  positionIdx: index("staking_rewards_position_idx").on(table.positionId),
}));

// ===== OPTIONS TRADING =====

/**
 * Options strategies
 */
export const optionStrategies = pgTable("option_strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  strategyName: varchar("strategy_name", { length: 255 }).notNull(),
  strategyType: varchar("strategy_type", { length: 100 }), // 'bull_call', 'bear_put', 'iron_condor', etc
  underlyingAsset: varchar("underlying_asset", { length: 100 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletIdx: index("option_strategies_wallet_idx").on(table.walletConnectionId),
}));

/**
 * Option leg positions
 */
export const optionLegPositions = pgTable("option_leg_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  strategyId: uuid("strategy_id").notNull(),
  
  // Option details
  optionType: varchar("option_type", { length: 20 }).notNull(), // 'call', 'put'
  positionType: varchar("position_type", { length: 20 }).notNull(), // 'long', 'short'
  strikePrice: numeric("strike_price", { precision: 20, scale: 8 }).notNull(),
  expirationDate: timestamp("expiration_date").notNull(),
  
  // Position
  quantity: integer("quantity").notNull(),
  premium: varchar("premium", { length: 255 }).notNull(),
  premiumUsd: numeric("premium_usd", { precision: 20, scale: 2 }),
  
  // P&L
  maxProfit: numeric("max_profit", { precision: 20, scale: 2 }),
  maxLoss: numeric("max_loss", { precision: 20, scale: 2 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("open"), // 'open', 'closed', 'expired'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  strategyIdx: index("option_leg_positions_strategy_idx").on(table.strategyId),
  expirationIdx: index("option_leg_positions_expiration_idx").on(table.expirationDate),
}));

/**
 * Option position closures
 */
export const optionClosures = pgTable("option_closures", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull(),
  
  // Closure details
  closurePrice: numeric("closure_price", { precision: 20, scale: 8 }).notNull(),
  realizedPnl: numeric("realized_pnl", { precision: 20, scale: 2 }),
  pnlPercent: numeric("pnl_percent", { precision: 10, scale: 4 }),
  
  closedAt: timestamp("closed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  positionIdx: index("option_closures_position_idx").on(table.positionId),
}));

// ===== PORTFOLIO ANALYTICS =====

/**
 * Portfolio snapshots
 */
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Portfolio value
  totalAssetsUsd: numeric("total_assets_usd", { precision: 20, scale: 2 }).notNull(),
  totalDebtUsd: numeric("total_debt_usd", { precision: 20, scale: 2 }).default("0"),
  netWorthUsd: numeric("net_worth_usd", { precision: 20, scale: 2 }),
  
  // Breakdown by strategy
  cashUsd: numeric("cash_usd", { precision: 20, scale: 2 }).default("0"),
  stakingUsd: numeric("staking_usd", { precision: 20, scale: 2 }).default("0"),
  lpUsd: numeric("lp_usd", { precision: 20, scale: 2 }).default("0"),
  yieldFarmingUsd: numeric("yield_farming_usd", { precision: 20, scale: 2 }).default("0"),
  optionsUsd: numeric("options_usd", { precision: 20, scale: 2 }).default("0"),
  
  // Metrics
  diversificationScore: numeric("diversification_score", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletIdx: index("portfolio_snapshots_wallet_idx").on(table.walletConnectionId),
  dateIdx: index("portfolio_snapshots_date_idx").on(table.createdAt),
}));

/**
 * Portfolio metrics (performance analytics)
 */
export const portfolioMetrics = pgTable("portfolio_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Returns
  totalReturn30d: numeric("total_return_30d", { precision: 10, scale: 2 }),
  totalReturn90d: numeric("total_return_90d", { precision: 10, scale: 2 }),
  totalReturn1y: numeric("total_return_1y", { precision: 10, scale: 2 }),
  
  // Volatility & risk
  volatility30d: numeric("volatility_30d", { precision: 10, scale: 4 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 4 }),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 2 }),
  
  // Win rate
  winRate: numeric("win_rate", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletIdx: index("portfolio_metrics_wallet_idx").on(table.walletConnectionId),
}));

// ===== RISK MANAGEMENT =====

/**
 * Risk models (VaR, etc)
 */
export const riskModels = pgTable("risk_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Model info
  modelName: varchar("model_name", { length: 255 }).notNull(),
  modelType: varchar("model_type", { length: 100 }), // 'value_at_risk', 'expected_shortfall', etc
  confidenceLevel: integer("confidence_level").default(95), // 95%, 99%
  timeHorizon: integer("time_horizon").default(1), // Days
  
  // Risk metrics
  var1Day: numeric("var_1_day", { precision: 20, scale: 2 }),
  var7Day: numeric("var_7_day", { precision: 20, scale: 2 }),
  var30Day: numeric("var_30_day", { precision: 20, scale: 2 }),
  expectedShortfall: numeric("expected_shortfall", { precision: 20, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletIdx: index("risk_models_wallet_idx").on(table.walletConnectionId),
  typeIdx: index("risk_models_type_idx").on(table.modelType),
}));

/**
 * Risk alerts
 */
export const riskAlerts = pgTable("risk_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Alert details
  alertType: varchar("alert_type", { length: 100 }).notNull(), // 'liquidation_risk', 'slippage_warning', etc
  severity: varchar("severity", { length: 50 }).notNull(), // 'info', 'warning', 'critical'
  
  // Metric that triggered alert
  riskMetric: varchar("risk_metric", { length: 255 }).notNull(),
  currentValue: varchar("current_value", { length: 255 }),
  threshold: varchar("threshold", { length: 255 }),
  
  // Recommendation
  recommendation: text("recommendation"),
  
  // Status
  dismissed: boolean("dismissed").default(false),
  dismissedAt: timestamp("dismissed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletIdx: index("risk_alerts_wallet_idx").on(table.walletConnectionId),
  severityIdx: index("risk_alerts_severity_idx").on(table.severity),
  dismissedIdx: index("risk_alerts_dismissed_idx").on(table.dismissed),
}));

/**
 * Liquidation risks
 */
export const liquidationRisks = pgTable("liquidation_risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Protocol
  protocolName: varchar("protocol_name", { length: 255 }).notNull(),
  
  // Risk metrics
  totalBorrowedUsd: numeric("total_borrowed_usd", { precision: 20, scale: 2 }).notNull(),
  totalCollateralUsd: numeric("total_collateral_usd", { precision: 20, scale: 2 }).notNull(),
  
  // Ratios
  collateralizationRatio: numeric("collateralization_ratio", { precision: 10, scale: 2 }),
  healthFactor: numeric("health_factor", { precision: 10, scale: 4 }),
  liquidationThreshold: numeric("liquidation_threshold", { precision: 5, scale: 2 }),
  
  // Time estimate
  estimatedTimeToLiquidation: integer("estimated_time_to_liquidation"), // Minutes
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletProtocolIdx: index("liquidation_risks_wallet_protocol").on(table.walletConnectionId, table.protocolName),
}));

/**
 * Asset correlations (for portfolio optimization)
 */
export const assetCorrelations = pgTable("asset_correlations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Asset pair
  asset1: varchar("asset_1", { length: 100 }).notNull(),
  asset2: varchar("asset_2", { length: 100 }).notNull(),
  
  // Correlation metrics
  correlation30d: numeric("correlation_30d", { precision: 5, scale: 4 }),
  correlation90d: numeric("correlation_90d", { precision: 5, scale: 4 }),
  correlation1y: numeric("correlation_1y", { precision: 5, scale: 4 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  assetPairIdx: index("asset_correlations_pair").on(table.asset1, table.asset2),
}));

// ===== RELATIONS =====

export const mevStrategiesRelations = relations(mevStrategies, ({ many }) => ({
  transactions: many(mevTransactions),
}));

export const mevTransactionsRelations = relations(mevTransactions, ({ one }) => ({
  strategy: one(mevStrategies, {
    fields: [mevTransactions.strategyId],
    references: [mevStrategies.id],
  }),
}));

export const liquidityPoolsRelations = relations(liquidityPools, ({ many }) => ({
  positions: many(liquidityProviderPositions),
}));

export const liquidityProviderPositionsRelations = relations(liquidityProviderPositions, ({ one, many }) => ({
  pool: one(liquidityPools, {
    fields: [liquidityProviderPositions.poolId],
    references: [liquidityPools.id],
  }),
  feeClaims: many(lpFeeClaims),
}));

export const lpFeeClaimsRelations = relations(lpFeeClaims, ({ one }) => ({
  position: one(liquidityProviderPositions, {
    fields: [lpFeeClaims.positionId],
    references: [liquidityProviderPositions.id],
  }),
}));

export const stakingProtocolsRelations = relations(stakingProtocols, ({ many }) => ({
  positions: many(stakingPositions),
}));

export const stakingPositionsRelations = relations(stakingPositions, ({ one, many }) => ({
  protocol: one(stakingProtocols, {
    fields: [stakingPositions.protocolId],
    references: [stakingProtocols.id],
  }),
  rewards: many(stakingRewards),
}));

export const stakingRewardsRelations = relations(stakingRewards, ({ one }) => ({
  position: one(stakingPositions, {
    fields: [stakingRewards.positionId],
    references: [stakingPositions.id],
  }),
}));

export const optionStrategiesRelations = relations(optionStrategies, ({ many }) => ({
  legs: many(optionLegPositions),
}));

export const optionLegPositionsRelations = relations(optionLegPositions, ({ one, many }) => ({
  strategy: one(optionStrategies, {
    fields: [optionLegPositions.strategyId],
    references: [optionStrategies.id],
  }),
  closures: many(optionClosures),
}));

export const optionClosuresRelations = relations(optionClosures, ({ one }) => ({
  position: one(optionLegPositions, {
    fields: [optionClosures.positionId],
    references: [optionLegPositions.id],
  }),
}));

export const portfolioSnapshotsRelations = relations(portfolioSnapshots, ({ one }) => ({
  wallet: one(liquidityProviderPositions, {
    fields: [portfolioSnapshots.walletConnectionId],
    references: [liquidityProviderPositions.walletConnectionId],
  }),
}));

export const riskAlertsRelations = relations(riskAlerts, ({ one }) => ({
  liquidationRisk: one(liquidationRisks, {
    fields: [riskAlerts.walletConnectionId],
    references: [liquidationRisks.walletConnectionId],
  }),
}));
