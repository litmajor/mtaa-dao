/**
 * Bot Database Schema
 * Drizzle ORM schema for trading bot management
 */

import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  varchar,
  json,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';

import { users } from '../../../shared/schema';

/**
 * Bot Table
 * Stores information about deployed trading bots/strategies
 */
export const bots = pgTable(
  'bots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    strategyId: varchar('strategy_id', { length: 64 }).notNull(),
    botName: varchar('bot_name', { length: 255 }).notNull(),

    // Strategy configuration
    configuration: json('configuration').notNull(), // Stores inputs, riskControl, etc.
    exchanges: json('exchanges').notNull(), // Array of exchange names

    // Status tracking
    status: varchar('status', { length: 20 }).notNull().default('running'), // 'running', 'paused', 'stopped', 'error'
    errorMessage: text('error_message'),

    // Capital & Metrics
    initialCapital: numeric('initial_capital', { precision: 20, scale: 8 }).notNull(),
    deployedAt: timestamp('deployed_at').defaultNow().notNull(),
    stoppedAt: timestamp('stopped_at'),
    pausedAt: timestamp('paused_at'),

    // Metadata
    notes: text('notes'),
    tags: json('tags'), // Array of tags
    metadata: json('metadata'), // Custom metadata

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index('bots_user_id_idx').on(table.userId),
      statusIdx: index('bots_status_idx').on(table.status),
      strategyIdIdx: index('bots_strategy_id_idx').on(table.strategyId),
      deployedAtIdx: index('bots_deployed_at_idx').on(table.deployedAt),
      userIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: 'bots_user_id_fk',
      }),
    };
  }
);

/**
 * Bot Trade Table
 * Records every trade executed by a bot
 */
export const botTrades = pgTable(
  'bot_trades',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),

    // Trade Details
    pair: varchar('pair', { length: 20 }).notNull(), // BTC/USDT, ETH/USDT, etc.
    side: varchar('side', { length: 10 }).notNull(), // 'BUY', 'SELL', 'CLOSE'
    orderType: varchar('order_type', { length: 20 }).notNull(), // 'market', 'limit', 'grid', 'dca'

    // Quantities
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    filledQuantity: numeric('filled_quantity', { precision: 20, scale: 8 }).notNull(),

    // Prices
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    filledPrice: numeric('filled_price', { precision: 20, scale: 8 }).notNull(),

    // Costs
    fee: numeric('fee', { precision: 20, scale: 8 }).notNull(),
    feePercent: numeric('fee_percent', { precision: 10, scale: 6 }),
    totalValue: numeric('total_value', { precision: 20, scale: 8 }).notNull(), // filledQuantity * filledPrice

    // Results
    pnl: numeric('pnl', { precision: 20, scale: 8 }), // Profit/Loss
    pnlPercent: numeric('pnl_percent', { precision: 10, scale: 6 }), // PnL percentage
    executionTime: integer('execution_time'), // milliseconds

    // Status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'partial', 'filled', 'cancelled'
    exchange: varchar('exchange', { length: 50 }).notNull(),

    // Trigger information
    triggerReason: varchar('trigger_reason', { length: 255 }), // 'RSI < 30', 'MACD crossover', etc.
    indicatorValues: json('indicator_values'), // RSI, MACD, MA, etc. at time of trade

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    filledAt: timestamp('filled_at'),
    closedAt: timestamp('closed_at'),

    // Metadata
    metadata: json('metadata'), // Strategy-specific data
  },
  (table) => {
    return {
      botIdIdx: index('bot_trades_bot_id_idx').on(table.botId),
      userIdIdx: index('bot_trades_user_id_idx').on(table.userId),
      pairIdx: index('bot_trades_pair_idx').on(table.pair),
      statusIdx: index('bot_trades_status_idx').on(table.status),
      createdAtIdx: index('bot_trades_created_at_idx').on(table.createdAt),
      exchangeIdx: index('bot_trades_exchange_idx').on(table.exchange),
      botIdFk: foreignKey({
        columns: [table.botId],
        foreignColumns: [bots.id],
        name: 'bot_trades_bot_id_fk',
      }),
      userIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: 'bot_trades_user_id_fk',
      }),
    };
  }
);

/**
 * Bot Performance Table
 * Stores performance metrics and statistics for bots
 * Updated after each trade or on-demand
 */
export const botPerformance = pgTable(
  'bot_performance',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    botId: varchar('bot_id', { length: 64 }).notNull().unique(),
    userId: varchar('user_id', { length: 64 }).notNull(),

    // Trade Statistics
    totalTrades: integer('total_trades').notNull().default(0),
    winningTrades: integer('winning_trades').notNull().default(0),
    losingTrades: integer('losing_trades').notNull().default(0),
    pendingTrades: integer('pending_trades').notNull().default(0),

    // Win/Loss Metrics
    winRate: numeric('win_rate', { precision: 10, scale: 6 }).notNull().default('0'), // 0-100 percentage
    profitFactor: numeric('profit_factor', { precision: 20, scale: 8 }).notNull().default('0'), // wins/losses
    averageWin: numeric('average_win', { precision: 20, scale: 8 }).notNull().default('0'),
    averageLoss: numeric('average_loss', { precision: 20, scale: 8 }).notNull().default('0'),

    // Drawdown & Returns
    largestWin: numeric('largest_win', { precision: 20, scale: 8 }).notNull().default('0'),
    largestLoss: numeric('largest_loss', { precision: 20, scale: 8 }).notNull().default('0'),
    currentDrawdown: numeric('current_drawdown', { precision: 20, scale: 8 }).notNull().default('0'),
    maxDrawdown: numeric('max_drawdown', { precision: 20, scale: 8 }).notNull().default('0'),

    // Returns
    totalProfit: numeric('total_profit', { precision: 20, scale: 8 }).notNull().default('0'),
    totalProfitPercent: numeric('total_profit_percent', { precision: 10, scale: 6 }).notNull().default('0'),
    returnOnCapital: numeric('return_on_capital', { precision: 10, scale: 6 }).notNull().default('0'), // % of initial capital

    // Risk Metrics
    sharpeRatio: numeric('sharpe_ratio', { precision: 10, scale: 6 }).notNull().default('0'),
    sortinoRatio: numeric('sortino_ratio', { precision: 10, scale: 6 }),
    calmarRatio: numeric('calmar_ratio', { precision: 10, scale: 6 }),

    // Consecutive Trades
    maxConsecutiveWins: integer('max_consecutive_wins').notNull().default(0),
    maxConsecutiveLosses: integer('max_consecutive_losses').notNull().default(0),
    currentConsecutiveWins: integer('current_consecutive_wins').notNull().default(0),
    currentConsecutiveLosses: integer('current_consecutive_losses').notNull().default(0),

    // Time-based
    averageTradeTime: integer('average_trade_time').notNull().default(0), // milliseconds
    totalTradingTime: integer('total_trading_time').notNull().default(0), // milliseconds

    // Costs
    totalFeesPaid: numeric('total_fees_paid', { precision: 20, scale: 8 }).notNull().default('0'),
    averageFeePerTrade: numeric('average_fee_per_trade', { precision: 20, scale: 8 }).notNull().default('0'),

    // Best/Worst pairs
    bestPair: varchar('best_pair', { length: 20 }),
    worstPair: varchar('worst_pair', { length: 20 }),
    bestExchange: varchar('best_exchange', { length: 50 }),

    // Current Status
    openPositions: integer('open_positions').notNull().default(0),
    openProfit: numeric('open_profit', { precision: 20, scale: 8 }).notNull().default('0'),
    openProfitPercent: numeric('open_profit_percent', { precision: 10, scale: 6 }).notNull().default('0'),

    // Timestamps
    lastTradeAt: timestamp('last_trade_at'),
    nextTradeAt: timestamp('next_trade_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      botIdIdx: index('bot_performance_bot_id_idx').on(table.botId),
      userIdIdx: index('bot_performance_user_id_idx').on(table.userId),
      winRateIdx: index('bot_performance_win_rate_idx').on(table.winRate),
      totalProfitIdx: index('bot_performance_total_profit_idx').on(table.totalProfit),
      lastTradeAtIdx: index('bot_performance_last_trade_at_idx').on(table.lastTradeAt),
      botIdFk: foreignKey({
        columns: [table.botId],
        foreignColumns: [bots.id],
        name: 'bot_performance_bot_id_fk',
      }),
      userIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: 'bot_performance_user_id_fk',
      }),
    };
  }
);

/**
 * Bot Action Log Table
 * Tracks bot events (pause, resume, stop, config changes)
 */
export const botActionLog = pgTable(
  'bot_action_log',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),

    action: varchar('action', { length: 50 }).notNull(), // 'deployed', 'paused', 'resumed', 'stopped', 'config_updated', 'error'
    description: text('description'),
    previousState: json('previous_state'),
    newState: json('new_state'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      botIdIdx: index('bot_action_log_bot_id_idx').on(table.botId),
      userIdIdx: index('bot_action_log_user_id_idx').on(table.userId),
      actionIdx: index('bot_action_log_action_idx').on(table.action),
      botIdFk: foreignKey({
        columns: [table.botId],
        foreignColumns: [bots.id],
        name: 'bot_action_log_bot_id_fk',
      }),
    };
  }
);

/**
 * Type exports for use in application
 */
export type Bot = typeof bots.$inferSelect;
export type BotInsert = typeof bots.$inferInsert;

export type BotTrade = typeof botTrades.$inferSelect;
export type BotTradeInsert = typeof botTrades.$inferInsert;

export type BotPerformance = typeof botPerformance.$inferSelect;
export type BotPerformanceInsert = typeof botPerformance.$inferInsert;

export type BotActionLog = typeof botActionLog.$inferSelect;
export type BotActionLogInsert = typeof botActionLog.$inferInsert;
