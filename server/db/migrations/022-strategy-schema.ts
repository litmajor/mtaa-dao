import { pool } from '../../db';

export async function migrateStrategyTables() {
  try {
    console.log('🔄 Running strategy schema migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id VARCHAR(256) PRIMARY KEY,
        creator_id VARCHAR(256) NOT NULL,
        name VARCHAR(256) NOT NULL,
        description TEXT,
        target_allocations JSONB NOT NULL,
        rebalance_frequency VARCHAR(50) NOT NULL,
        rebalance_threshold_percent NUMERIC DEFAULT 1,
        risk_level VARCHAR(50) NOT NULL,
        tags JSONB,
        freqtrade_strategy_id VARCHAR(256),
        freqtrade_code TEXT,
        freqtrade_name VARCHAR(256),
        backtest_results JSONB,
        last_backtested_at TIMESTAMP,
        total_value_locked NUMERIC DEFAULT 0,
        total_followers INTEGER DEFAULT 0,
        assets_under_management NUMERIC DEFAULT 0,
        ytd_return_percent NUMERIC DEFAULT 0,
        mtd_return_percent NUMERIC DEFAULT 0,
        wtd_return_percent NUMERIC DEFAULT 0,
        sharpe_ratio NUMERIC DEFAULT 0,
        max_drawdown_percent NUMERIC DEFAULT 0,
        volatility_percent NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_public BOOLEAN DEFAULT true,
        last_rebalanced_at TIMESTAMP,
        next_rebalance_at TIMESTAMP,
        total_rebalances INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS strategy_creator_idx ON strategies(creator_id);
      CREATE INDEX IF NOT EXISTS strategy_active_idx ON strategies(is_active);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategy_followers (
        id VARCHAR(256) PRIMARY KEY,
        strategy_id VARCHAR(256) NOT NULL,
        follower_id VARCHAR(256) NOT NULL,
        invested_amount_usd NUMERIC NOT NULL,
        current_value_usd NUMERIC NOT NULL,
        return_usd NUMERIC NOT NULL,
        return_percent NUMERIC NOT NULL,
        auto_rebalance BOOLEAN DEFAULT true,
        max_slippage_percent NUMERIC DEFAULT 0.5,
        enable_notifications BOOLEAN DEFAULT true,
        last_rebalanced_at TIMESTAMP,
        total_rebalances INTEGER DEFAULT 0,
        followed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      );

      CREATE INDEX IF NOT EXISTS strategy_followers_strategy_id_idx ON strategy_followers(strategy_id);
      CREATE INDEX IF NOT EXISTS strategy_followers_follower_id_idx ON strategy_followers(follower_id);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategy_allocations (
        id VARCHAR(256) PRIMARY KEY,
        strategy_id VARCHAR(256) NOT NULL,
        asset VARCHAR(256) NOT NULL,
        target_weight_percent NUMERIC NOT NULL,
        current_weight_percent NUMERIC NOT NULL,
        drift_percent NUMERIC NOT NULL,
        last_rebalanced_at TIMESTAMP,
        times_sold_during_rebalance INTEGER DEFAULT 0,
        times_bought_during_rebalance INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      );

      CREATE INDEX IF NOT EXISTS strategy_allocations_strategy_id_idx ON strategy_allocations(strategy_id);
      CREATE INDEX IF NOT EXISTS strategy_allocations_asset_idx ON strategy_allocations(asset);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategy_rebalances (
        id VARCHAR(256) PRIMARY KEY,
        strategy_id VARCHAR(256) NOT NULL,
        triggered_at TIMESTAMP DEFAULT NOW() NOT NULL,
        executed_at TIMESTAMP,
        completed_at TIMESTAMP,
        transactions JSONB NOT NULL,
        transaction_count INTEGER NOT NULL,
        successful_transactions INTEGER DEFAULT 0,
        failed_transactions INTEGER DEFAULT 0,
        total_gas_used NUMERIC,
        total_gas_cost_usd NUMERIC,
        total_slippage NUMERIC,
        status VARCHAR(50) NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      );

      CREATE INDEX IF NOT EXISTS strategy_rebalances_strategy_id_idx ON strategy_rebalances(strategy_id);
      CREATE INDEX IF NOT EXISTS strategy_rebalances_status_idx ON strategy_rebalances(status);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS backtest_jobs (
        id VARCHAR(128) PRIMARY KEY,
        strategy_id VARCHAR(128) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        metrics JSONB,
        best_parameters JSONB,
        error TEXT,
        requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      );

      CREATE INDEX IF NOT EXISTS backtest_jobs_strategy_id_idx ON backtest_jobs(strategy_id);
      CREATE INDEX IF NOT EXISTS backtest_jobs_status_idx ON backtest_jobs(status);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategy_performance (
        id VARCHAR(256) PRIMARY KEY,
        strategy_id VARCHAR(256) NOT NULL,
        date TIMESTAMP NOT NULL,
        aum NUMERIC NOT NULL,
        followers INTEGER NOT NULL,
        return_percent NUMERIC NOT NULL,
        sharpe_ratio NUMERIC,
        max_drawdown_percent NUMERIC,
        volatility_percent NUMERIC,
        trade_volume NUMERIC,
        rebalance_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id)
      );

      CREATE INDEX IF NOT EXISTS strategy_performance_strategy_id_idx ON strategy_performance(strategy_id);
      CREATE INDEX IF NOT EXISTS strategy_performance_date_idx ON strategy_performance(date);
    `);

    console.log('✅ Strategy schema migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error running strategy schema migrations:', error);
    throw error;
  }
}

export async function rollbackStrategyTables() {
  try {
    console.log('🔄 Rolling back strategy schema migrations...');
    await pool.query('DROP TABLE IF EXISTS strategy_performance CASCADE;');
    await pool.query('DROP TABLE IF EXISTS backtest_jobs CASCADE;');
    await pool.query('DROP TABLE IF EXISTS strategy_rebalances CASCADE;');
    await pool.query('DROP TABLE IF EXISTS strategy_allocations CASCADE;');
    await pool.query('DROP TABLE IF EXISTS strategy_followers CASCADE;');
    await pool.query('DROP TABLE IF EXISTS strategies CASCADE;');
    console.log('✅ Strategy schema rollback completed');
    return true;
  } catch (error) {
    console.error('❌ Error rolling back strategy schema migrations:', error);
    throw error;
  }
}
