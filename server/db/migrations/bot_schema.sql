/**
 * Drizzle Migration Template for Bot Tables
 * 
 * Run with:
 * npm run db:generate (to generate migration)
 * npm run db:migrate (to apply migration)
 */

import { sql } from 'drizzle-orm';
import type { Migration } from 'drizzle-orm/migrator';

export const migration: Migration = {
  sql: sql`
    -- Create bots table
    CREATE TABLE IF NOT EXISTS bots (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      strategy_id VARCHAR(64) NOT NULL,
      bot_name VARCHAR(255) NOT NULL,
      configuration JSONB NOT NULL,
      exchanges JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      error_message TEXT,
      initial_capital NUMERIC(20, 8) NOT NULL,
      deployed_at TIMESTAMP DEFAULT NOW() NOT NULL,
      stopped_at TIMESTAMP,
      paused_at TIMESTAMP,
      notes TEXT,
      tags JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for bots table
    CREATE INDEX bots_user_id_idx ON bots(user_id);
    CREATE INDEX bots_status_idx ON bots(status);
    CREATE INDEX bots_strategy_id_idx ON bots(strategy_id);
    CREATE INDEX bots_deployed_at_idx ON bots(deployed_at);

    -- Create bot_trades table
    CREATE TABLE IF NOT EXISTS bot_trades (
      id VARCHAR(64) PRIMARY KEY,
      bot_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      pair VARCHAR(20) NOT NULL,
      side VARCHAR(10) NOT NULL,
      order_type VARCHAR(20) NOT NULL,
      quantity NUMERIC(20, 8) NOT NULL,
      filled_quantity NUMERIC(20, 8) NOT NULL,
      entry_price NUMERIC(20, 8) NOT NULL,
      filled_price NUMERIC(20, 8) NOT NULL,
      fee NUMERIC(20, 8) NOT NULL,
      fee_percent NUMERIC(10, 6),
      total_value NUMERIC(20, 8) NOT NULL,
      pnl NUMERIC(20, 8),
      pnl_percent NUMERIC(10, 6),
      execution_time INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      exchange VARCHAR(50) NOT NULL,
      trigger_reason VARCHAR(255),
      indicator_values JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      filled_at TIMESTAMP,
      closed_at TIMESTAMP,
      metadata JSONB,
      FOREIGN KEY (bot_id) REFERENCES bots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for bot_trades table
    CREATE INDEX bot_trades_bot_id_idx ON bot_trades(bot_id);
    CREATE INDEX bot_trades_user_id_idx ON bot_trades(user_id);
    CREATE INDEX bot_trades_pair_idx ON bot_trades(pair);
    CREATE INDEX bot_trades_status_idx ON bot_trades(status);
    CREATE INDEX bot_trades_created_at_idx ON bot_trades(created_at);
    CREATE INDEX bot_trades_exchange_idx ON bot_trades(exchange);

    -- Create bot_performance table
    CREATE TABLE IF NOT EXISTS bot_performance (
      id VARCHAR(64) PRIMARY KEY,
      bot_id VARCHAR(64) NOT NULL UNIQUE,
      user_id VARCHAR(64) NOT NULL,
      total_trades INTEGER NOT NULL DEFAULT 0,
      winning_trades INTEGER NOT NULL DEFAULT 0,
      losing_trades INTEGER NOT NULL DEFAULT 0,
      pending_trades INTEGER NOT NULL DEFAULT 0,
      win_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
      profit_factor NUMERIC(20, 8) NOT NULL DEFAULT 0,
      average_win NUMERIC(20, 8) NOT NULL DEFAULT 0,
      average_loss NUMERIC(20, 8) NOT NULL DEFAULT 0,
      largest_win NUMERIC(20, 8) NOT NULL DEFAULT 0,
      largest_loss NUMERIC(20, 8) NOT NULL DEFAULT 0,
      current_drawdown NUMERIC(20, 8) NOT NULL DEFAULT 0,
      max_drawdown NUMERIC(20, 8) NOT NULL DEFAULT 0,
      total_profit NUMERIC(20, 8) NOT NULL DEFAULT 0,
      total_profit_percent NUMERIC(10, 6) NOT NULL DEFAULT 0,
      return_on_capital NUMERIC(10, 6) NOT NULL DEFAULT 0,
      sharpe_ratio NUMERIC(10, 6) NOT NULL DEFAULT 0,
      sortino_ratio NUMERIC(10, 6),
      calmar_ratio NUMERIC(10, 6),
      max_consecutive_wins INTEGER NOT NULL DEFAULT 0,
      max_consecutive_losses INTEGER NOT NULL DEFAULT 0,
      current_consecutive_wins INTEGER NOT NULL DEFAULT 0,
      current_consecutive_losses INTEGER NOT NULL DEFAULT 0,
      average_trade_time INTEGER NOT NULL DEFAULT 0,
      total_trading_time INTEGER NOT NULL DEFAULT 0,
      total_fees_paid NUMERIC(20, 8) NOT NULL DEFAULT 0,
      average_fee_per_trade NUMERIC(20, 8) NOT NULL DEFAULT 0,
      best_pair VARCHAR(20),
      worst_pair VARCHAR(20),
      best_exchange VARCHAR(50),
      open_positions INTEGER NOT NULL DEFAULT 0,
      open_profit NUMERIC(20, 8) NOT NULL DEFAULT 0,
      open_profit_percent NUMERIC(10, 6) NOT NULL DEFAULT 0,
      last_trade_at TIMESTAMP,
      next_trade_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      FOREIGN KEY (bot_id) REFERENCES bots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for bot_performance table
    CREATE INDEX bot_performance_bot_id_idx ON bot_performance(bot_id);
    CREATE INDEX bot_performance_user_id_idx ON bot_performance(user_id);
    CREATE INDEX bot_performance_win_rate_idx ON bot_performance(win_rate);
    CREATE INDEX bot_performance_total_profit_idx ON bot_performance(total_profit);
    CREATE INDEX bot_performance_last_trade_at_idx ON bot_performance(last_trade_at);

    -- Create bot_action_log table
    CREATE TABLE IF NOT EXISTS bot_action_log (
      id VARCHAR(64) PRIMARY KEY,
      bot_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      action VARCHAR(50) NOT NULL,
      description TEXT,
      previous_state JSONB,
      new_state JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    );

    -- Create indexes for bot_action_log table
    CREATE INDEX bot_action_log_bot_id_idx ON bot_action_log(bot_id);
    CREATE INDEX bot_action_log_user_id_idx ON bot_action_log(user_id);
    CREATE INDEX bot_action_log_action_idx ON bot_action_log(action);
  `,
  breakpoints: true,
};
