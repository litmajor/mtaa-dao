/**
 * STRATEGY SCHEMA - Database Tables
 * Powers the Strategy Dashboard with persistence
 */

import { pgTable, text, varchar, timestamp, numeric, integer, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ════════════════════════════════════════════════════════════════════════════════
// STRATEGIES TABLE
// ════════════════════════════════════════════════════════════════════════════════
export const strategiesTable = pgTable(
  'strategies',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    creatorId: varchar('creator_id', { length: 256 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    description: text('description'),
    
    // Configuration
    targetAllocations: jsonb('target_allocations').notNull(), // {"ETH": 0.4, "USDC": 0.3, ...}
    rebalanceFrequency: varchar('rebalance_frequency', { length: 50 }).notNull(), // 'daily', 'weekly', 'monthly', 'manual'
    rebalanceThresholdPercent: numeric('rebalance_threshold_percent').default('1'), // Drift tolerance
    riskLevel: varchar('risk_level', { length: 50 }).notNull(), // 'low', 'medium', 'high'
    tags: jsonb('tags'), // ["DeFi", "yield", "stable"]
    
    // Freqtrade Integration
    freqtradeStrategyId: varchar('freqtrade_strategy_id', { length: 256 }),
    backtestResults: jsonb('backtest_results'), // {sharpeRatio, maxDrawdown, winRate, totalTrades, ...}
    lastBacktestedAt: timestamp('last_backtested_at'),
    
    // Performance Metrics (real-time)
    totalValueLocked: numeric('total_value_locked').default('0'),
    totalFollowers: integer('total_followers').default(0),
    assetsUnderManagement: numeric('assets_under_management').default('0'),
    
    // Returns
    ytdReturnPercent: numeric('ytd_return_percent').default('0'),
    mtdReturnPercent: numeric('mtd_return_percent').default('0'),
    wtdReturnPercent: numeric('wtd_return_percent').default('0'),
    
    // Risk Metrics
    sharpeRatio: numeric('sharpe_ratio').default('0'),
    maxDrawdownPercent: numeric('max_drawdown_percent').default('0'),
    volatilityPercent: numeric('volatility_percent').default('0'),
    
    // Status
    isActive: boolean('is_active').default(true),
    isPublic: boolean('is_public').default(true),
    
    // Rebalancing
    lastRebalancedAt: timestamp('last_rebalanced_at'),
    nextRebalanceAt: timestamp('next_rebalance_at'),
    totalRebalances: integer('total_rebalances').default(0),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    creatorIdIdx: uniqueIndex('strategy_creator_idx').on(table.creatorId),
    activeIdx: uniqueIndex('strategy_active_idx').on(table.isActive),
  })
);

// ════════════════════════════════════════════════════════════════════════════════
// STRATEGY FOLLOWERS TABLE
// ════════════════════════════════════════════════════════════════════════════════
export const strategyFollowersTable = pgTable(
  'strategy_followers',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    strategyId: varchar('strategy_id', { length: 256 }).notNull(),
    followerId: varchar('follower_id', { length: 256 }).notNull(),
    
    // Investment
    investedAmountUsd: numeric('invested_amount_usd').notNull(),
    currentValueUsd: numeric('current_value_usd').notNull(),
    returnUsd: numeric('return_usd').notNull(),
    returnPercent: numeric('return_percent').notNull(),
    
    // Settings
    autoRebalance: boolean('auto_rebalance').default(true),
    maxSlippagePercent: numeric('max_slippage_percent').default('0.5'),
    enableNotifications: boolean('enable_notifications').default(true),
    
    // Tracking
    lastRebalancedAt: timestamp('last_rebalanced_at'),
    totalRebalances: integer('total_rebalances').default(0),
    
    // Timestamps
    followedAt: timestamp('followed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// STRATEGY ALLOCATIONS TABLE
// ════════════════════════════════════════════════════════════════════════════════
export const strategyAllocationsTable = pgTable(
  'strategy_allocations',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    strategyId: varchar('strategy_id', { length: 256 }).notNull(),
    
    asset: varchar('asset', { length: 256 }).notNull(), // "ETH", "USDC", "BTC"
    targetWeightPercent: numeric('target_weight_percent').notNull(),
    currentWeightPercent: numeric('current_weight_percent').notNull(),
    driftPercent: numeric('drift_percent').notNull(),
    
    // Historical rebalancing
    lastRebalancedAt: timestamp('last_rebalanced_at'),
    timesSoldDuringRebalance: integer('times_sold_during_rebalance').default(0),
    timesBoughtDuringRebalance: integer('times_bought_during_rebalance').default(0),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// STRATEGY REBALANCES TABLE
// ════════════════════════════════════════════════════════════════════════════════
export const strategyRebalancesTable = pgTable(
  'strategy_rebalances',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    strategyId: varchar('strategy_id', { length: 256 }).notNull(),
    
    // Execution
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    executedAt: timestamp('executed_at'),
    completedAt: timestamp('completed_at'),
    
    // Transactions
    transactions: jsonb('transactions').notNull(), // [{asset, action, amount, price, slippage}]
    transactionCount: integer('transaction_count').notNull(),
    successfulTransactions: integer('successful_transactions').default(0),
    failedTransactions: integer('failed_transactions').default(0),
    
    // Costs
    totalGasUsed: numeric('total_gas_used'),
    totalGasCostUsd: numeric('total_gas_cost_usd'),
    totalSlippage: numeric('total_slippage'),
    
    // Status
    status: varchar('status', { length: 50 }).notNull(), // 'pending', 'executing', 'completed', 'failed'
    error: text('error'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// STRATEGY PERFORMANCE TABLE
// ════════════════════════════════════════════════════════════════════════════════
export const strategyPerformanceTable = pgTable(
  'strategy_performance',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    strategyId: varchar('strategy_id', { length: 256 }).notNull(),
    
    // Time period
    date: timestamp('date').notNull(),
    
    // Metrics
    aum: numeric('aum').notNull(), // Assets under management
    followers: integer('followers').notNull(),
    returnPercent: numeric('return_percent').notNull(),
    sharpeRatio: numeric('sharpe_ratio'),
    maxDrawdownPercent: numeric('max_drawdown_percent'),
    volatilityPercent: numeric('volatility_percent'),
    
    // Daily volume
    tradeVolume: numeric('trade_volume'),
    rebalanceCount: integer('rebalance_count').default(0),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// USER WALLETS TABLE - Multi-chain support
// ════════════════════════════════════════════════════════════════════════════════
export const userWalletsTable = pgTable(
  'user_wallets',
  {
    id: varchar('id', { length: 256 }).primaryKey(),
    userId: varchar('user_id', { length: 256 }).notNull(),
    
    // Wallet Info
    address: varchar('address', { length: 256 }).notNull(),
    chain: varchar('chain', { length: 50 }).notNull(), // 'ethereum', 'polygon', 'arbitrum', 'optimism', 'celo'
    chainId: integer('chain_id').notNull(),
    
    // Type
    walletType: varchar('wallet_type', { length: 50 }).notNull(), // 'metamask', 'walletconnect', 'ledger', 'trezor'
    
    // Context
    context: varchar('context', { length: 50 }).default('user'), // 'user' or 'dao'
    daoId: varchar('dao_id', { length: 256 }), // If DAO context
    
    // Labels
    label: varchar('label', { length: 256 }), // "Main wallet", "Yield strategy"
    
    // Status
    isActive: boolean('is_active').default(true),
    isPrimary: boolean('is_primary').default(false),
    
    // Balance Cache
    cachedBalanceUsd: numeric('cached_balance_usd').default('0'),
    lastSyncedAt: timestamp('last_synced_at'),
    
    // Timestamps
    connectedAt: timestamp('connected_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// RELATIONS
// ════════════════════════════════════════════════════════════════════════════════

export const strategiesRelations = relations(strategiesTable, ({ many }) => ({
  followers: many(strategyFollowersTable),
  allocations: many(strategyAllocationsTable),
  rebalances: many(strategyRebalancesTable),
  performance: many(strategyPerformanceTable),
}));

export const strategyFollowersRelations = relations(strategyFollowersTable, ({ one }) => ({
  strategy: one(strategiesTable, {
    fields: [strategyFollowersTable.strategyId],
    references: [strategiesTable.id],
  }),
}));

export const strategyAllocationsRelations = relations(strategyAllocationsTable, ({ one }) => ({
  strategy: one(strategiesTable, {
    fields: [strategyAllocationsTable.strategyId],
    references: [strategiesTable.id],
  }),
}));

export const strategyRebalancesRelations = relations(strategyRebalancesTable, ({ one }) => ({
  strategy: one(strategiesTable, {
    fields: [strategyRebalancesTable.strategyId],
    references: [strategiesTable.id],
  }),
}));

export const strategyPerformanceRelations = relations(strategyPerformanceTable, ({ one }) => ({
  strategy: one(strategiesTable, {
    fields: [strategyPerformanceTable.strategyId],
    references: [strategiesTable.id],
  }),
}));
