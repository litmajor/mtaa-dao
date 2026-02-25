/**
 * Phase 4: Advanced DeFi Features Migration
 * Adds support for MEV protection, LP management, staking, options trading, portfolio analytics, and risk management
 */

import { pgTable, text, varchar, numeric, timestamp, boolean, integer, jsonb, index, foreignKey } from "drizzle-orm/pg-core";

export async function up() {
  return `
    -- MEV Protection Strategy Table
    CREATE TABLE IF NOT EXISTS mev_strategies (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      strategy_name VARCHAR(255) NOT NULL,
      strategy_type VARCHAR(50) NOT NULL CHECK (strategy_type IN ('flashbot', 'mev_protect', 'mev_relay', 'private_rpc')),
      protection_level VARCHAR(50) NOT NULL CHECK (protection_level IN ('maximum', 'high', 'standard', 'light')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      total_transactions_protected INTEGER NOT NULL DEFAULT 0,
      total_mev_savings_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- MEV Protected Transactions Table
    CREATE TABLE IF NOT EXISTS mev_transactions (
      id VARCHAR(50) PRIMARY KEY,
      mev_strategy_id VARCHAR(50) NOT NULL,
      transaction_hash VARCHAR(255) NOT NULL UNIQUE,
      protection_method VARCHAR(50) NOT NULL,
      original_slippage_usd NUMERIC(20,8) NOT NULL,
      protected_slippage_usd NUMERIC(20,8) NOT NULL,
      actual_mev_savings NUMERIC(20,8) NOT NULL,
      slippage_improvement_percent NUMERIC(5,2) NOT NULL,
      gas_used INTEGER NOT NULL,
      flashbot_bundle_id VARCHAR(255),
      sandwich_detected BOOLEAN NOT NULL DEFAULT FALSE,
      sandwich_details JSONB,
      block_number INTEGER NOT NULL,
      protected_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (mev_strategy_id) REFERENCES mev_strategies(id) ON DELETE CASCADE
    );

    -- Liquidity Provider Positions Table
    CREATE TABLE IF NOT EXISTS liquidity_provider_positions (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      pool_id VARCHAR(255) NOT NULL,
      protocol VARCHAR(100) NOT NULL,
      token_0_address VARCHAR(255) NOT NULL,
      token_1_address VARCHAR(255) NOT NULL,
      token_0_amount NUMERIC(20,8) NOT NULL,
      token_1_amount NUMERIC(20,8) NOT NULL,
      token_0_current_price NUMERIC(20,8) NOT NULL,
      token_1_current_price NUMERIC(20,8) NOT NULL,
      lp_token_balance NUMERIC(20,8) NOT NULL,
      entry_token_0_price NUMERIC(20,8) NOT NULL,
      entry_token_1_price NUMERIC(20,8) NOT NULL,
      accumulated_fee_0 NUMERIC(20,8) NOT NULL DEFAULT 0,
      accumulated_fee_1 NUMERIC(20,8) NOT NULL DEFAULT 0,
      total_fees_collected_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      impermanent_loss_usd NUMERIC(20,8),
      impermanent_loss_percent NUMERIC(5,2),
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
      position_type VARCHAR(50) NOT NULL CHECK (position_type IN ('concentrated', 'full_range', 'custom')),
      fee_tier NUMERIC(5,2),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- LP Fee Claims Table
    CREATE TABLE IF NOT EXISTS lp_fee_claims (
      id VARCHAR(50) PRIMARY KEY,
      position_id VARCHAR(50) NOT NULL,
      fee_0_amount NUMERIC(20,8) NOT NULL,
      fee_0_usd_value NUMERIC(20,8) NOT NULL,
      fee_1_amount NUMERIC(20,8) NOT NULL,
      fee_1_usd_value NUMERIC(20,8) NOT NULL,
      total_fees_usd NUMERIC(20,8) NOT NULL,
      transaction_hash VARCHAR(255),
      claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (position_id) REFERENCES liquidity_provider_positions(id) ON DELETE CASCADE
    );

    -- Staking Positions Table
    CREATE TABLE IF NOT EXISTS staking_positions (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      protocol VARCHAR(100) NOT NULL,
      asset_staked VARCHAR(50) NOT NULL,
      staked_amount NUMERIC(20,8) NOT NULL,
      staked_amount_usd NUMERIC(20,8) NOT NULL,
      validator_info JSONB,
      current_apy NUMERIC(5,2) NOT NULL,
      estimated_daily_reward_usd NUMERIC(20,8) NOT NULL,
      total_rewards_claimed_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      slashing_risk NUMERIC(5,2),
      lock_period_days INTEGER,
      unstake_penalty_percent NUMERIC(5,2),
      status VARCHAR(50) NOT NULL DEFAULT 'staking' CHECK (status IN ('staking', 'pending_unstake', 'unstaked', 'slashed')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Staking Reward Claims Table
    CREATE TABLE IF NOT EXISTS staking_reward_claims (
      id VARCHAR(50) PRIMARY KEY,
      position_id VARCHAR(50) NOT NULL,
      reward_amount NUMERIC(20,8) NOT NULL,
      reward_amount_usd NUMERIC(20,8) NOT NULL,
      claimed_apy NUMERIC(5,2) NOT NULL,
      transaction_hash VARCHAR(255),
      claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (position_id) REFERENCES staking_positions(id) ON DELETE CASCADE
    );

    -- Options Strategies Table
    CREATE TABLE IF NOT EXISTS options_strategies (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      strategy_name VARCHAR(255) NOT NULL,
      strategy_type VARCHAR(100) NOT NULL CHECK (strategy_type IN ('covered_call', 'protective_put', 'collar', 'bull_call_spread', 'bear_call_spread', 'iron_condor', 'cash_secured_put', 'call_ratio_spread', 'put_ratio_spread', 'straddle', 'strangle')),
      underlying_asset VARCHAR(255) NOT NULL,
      max_profit_potential NUMERIC(20,8),
      max_loss_potential NUMERIC(20,8),
      breakeven_price NUMERIC(20,8),
      total_premium_paid NUMERIC(20,8) NOT NULL DEFAULT 0,
      total_premium_received NUMERIC(20,8) NOT NULL DEFAULT 0,
      net_premium NUMERIC(20,8),
      realized_pnl_usd NUMERIC(20,8) NOT NULL DEFAULT 0,
      unrealized_pnl_usd NUMERIC(20,8),
      status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_closed', 'closed', 'expired')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Options Legs Table
    CREATE TABLE IF NOT EXISTS options_legs (
      id VARCHAR(50) PRIMARY KEY,
      strategy_id VARCHAR(50) NOT NULL,
      option_type VARCHAR(10) NOT NULL CHECK (option_type IN ('call', 'put')),
      position VARCHAR(10) NOT NULL CHECK (position IN ('long', 'short')),
      strike_price NUMERIC(20,8) NOT NULL,
      expiry_date TIMESTAMP NOT NULL,
      quantity NUMERIC(20,8) NOT NULL,
      premium_per_contract NUMERIC(20,8) NOT NULL,
      total_premium NUMERIC(20,8) NOT NULL,
      delta NUMERIC(5,4),
      gamma NUMERIC(5,4),
      vega NUMERIC(5,4),
      theta NUMERIC(5,4),
      rho NUMERIC(5,4),
      implied_volatility NUMERIC(5,2),
      status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (strategy_id) REFERENCES options_strategies(id) ON DELETE CASCADE
    );

    -- Options Closures Table
    CREATE TABLE IF NOT EXISTS options_closures (
      id VARCHAR(50) PRIMARY KEY,
      leg_id VARCHAR(50) NOT NULL,
      closing_price NUMERIC(20,8) NOT NULL,
      closing_value NUMERIC(20,8) NOT NULL,
      realized_pnl_usd NUMERIC(20,8) NOT NULL,
      closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (leg_id) REFERENCES options_legs(id) ON DELETE CASCADE
    );

    -- Portfolio Snapshots Table
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      total_assets_usd NUMERIC(20,8) NOT NULL,
      total_liabilities_usd NUMERIC(20,8) NOT NULL,
      net_worth_usd NUMERIC(20,8) NOT NULL,
      allocation JSONB NOT NULL,
      cash_allocated NUMERIC(20,8) NOT NULL,
      staking_allocated NUMERIC(20,8) NOT NULL,
      lp_allocated NUMERIC(20,8) NOT NULL,
      yield_farming_allocated NUMERIC(20,8) NOT NULL,
      options_allocated NUMERIC(20,8) NOT NULL,
      diversification_score NUMERIC(5,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Performance Metrics Table
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      time_period VARCHAR(50) NOT NULL,
      period_start_date TIMESTAMP NOT NULL,
      period_end_date TIMESTAMP NOT NULL,
      starting_portfolio_value NUMERIC(20,8) NOT NULL,
      ending_portfolio_value NUMERIC(20,8) NOT NULL,
      total_return_percent NUMERIC(10,4) NOT NULL,
      total_return_usd NUMERIC(20,8) NOT NULL,
      sharpe_ratio NUMERIC(10,4),
      sortino_ratio NUMERIC(10,4),
      max_drawdown_percent NUMERIC(5,2) NOT NULL,
      volatility_30d NUMERIC(5,2),
      volatility_90d NUMERIC(5,2),
      win_rate_percent NUMERIC(5,2),
      average_win_usd NUMERIC(20,8),
      average_loss_usd NUMERIC(20,8),
      best_day_return NUMERIC(5,2),
      worst_day_return NUMERIC(5,2),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Risk Assessments Table
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      overall_risk_score NUMERIC(5,2) NOT NULL,
      concentration_risk NUMERIC(5,2) NOT NULL,
      protocol_risk NUMERIC(5,2) NOT NULL,
      liquidation_risk NUMERIC(5,2) NOT NULL,
      leverage_risk NUMERIC(5,2) NOT NULL,
      smart_contract_risk NUMERIC(5,2) NOT NULL,
      market_risk NUMERIC(5,2) NOT NULL,
      value_at_risk_1day NUMERIC(20,8),
      value_at_risk_7day NUMERIC(20,8),
      estimated_liquidation_price NUMERIC(20,8),
      time_to_liquidation_hours INTEGER,
      recommended_actions JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Risk Alerts Table
    CREATE TABLE IF NOT EXISTS risk_alerts (
      id VARCHAR(50) PRIMARY KEY,
      wallet_connection_id VARCHAR(50) NOT NULL,
      alert_type VARCHAR(100) NOT NULL,
      severity VARCHAR(50) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      title VARCHAR(255) NOT NULL,
      current_value VARCHAR(255),
      threshold_value VARCHAR(255),
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (wallet_connection_id) REFERENCES wallet_connections(id) ON DELETE CASCADE
    );

    -- Create indexes for performance optimization
    CREATE INDEX idx_mev_strategies_wallet ON mev_strategies(wallet_connection_id);
    CREATE INDEX idx_mev_strategies_active ON mev_strategies(is_active);
    CREATE INDEX idx_mev_transactions_strategy ON mev_transactions(mev_strategy_id);
    CREATE INDEX idx_mev_transactions_timestamp ON mev_transactions(protected_at);
    CREATE INDEX idx_mev_transactions_sandwich ON mev_transactions(sandwich_detected);
    
    CREATE INDEX idx_lp_positions_wallet ON liquidity_provider_positions(wallet_connection_id);
    CREATE INDEX idx_lp_positions_status ON liquidity_provider_positions(status);
    CREATE INDEX idx_lp_positions_protocol ON liquidity_provider_positions(protocol);
    CREATE INDEX idx_lp_fee_claims_position ON lp_fee_claims(position_id);
    CREATE INDEX idx_lp_fee_claims_timestamp ON lp_fee_claims(claimed_at);
    
    CREATE INDEX idx_staking_positions_wallet ON staking_positions(wallet_connection_id);
    CREATE INDEX idx_staking_positions_protocol ON staking_positions(protocol);
    CREATE INDEX idx_staking_positions_status ON staking_positions(status);
    CREATE INDEX idx_staking_reward_claims_position ON staking_reward_claims(position_id);
    CREATE INDEX idx_staking_reward_claims_timestamp ON staking_reward_claims(claimed_at);
    
    CREATE INDEX idx_options_strategies_wallet ON options_strategies(wallet_connection_id);
    CREATE INDEX idx_options_strategies_status ON options_strategies(status);
    CREATE INDEX idx_options_strategies_type ON options_strategies(strategy_type);
    CREATE INDEX idx_options_legs_strategy ON options_legs(strategy_id);
    CREATE INDEX idx_options_legs_expiry ON options_legs(expiry_date);
    CREATE INDEX idx_options_closures_leg ON options_closures(leg_id);
    
    CREATE INDEX idx_portfolio_snapshots_wallet ON portfolio_snapshots(wallet_connection_id);
    CREATE INDEX idx_portfolio_snapshots_timestamp ON portfolio_snapshots(created_at);
    
    CREATE INDEX idx_performance_metrics_wallet ON performance_metrics(wallet_connection_id);
    CREATE INDEX idx_performance_metrics_period ON performance_metrics(period_start_date, period_end_date);
    
    CREATE INDEX idx_risk_assessments_wallet ON risk_assessments(wallet_connection_id);
    CREATE INDEX idx_risk_assessments_timestamp ON risk_assessments(created_at);
    CREATE INDEX idx_risk_alerts_wallet ON risk_alerts(wallet_connection_id);
    CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);
    CREATE INDEX idx_risk_alerts_active ON risk_alerts(is_active);
  `;
}

export async function down() {
  return `
    -- Drop tables in reverse order of creation
    DROP TABLE IF EXISTS risk_alerts CASCADE;
    DROP TABLE IF EXISTS risk_assessments CASCADE;
    DROP TABLE IF EXISTS performance_metrics CASCADE;
    DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
    DROP TABLE IF EXISTS options_closures CASCADE;
    DROP TABLE IF EXISTS options_legs CASCADE;
    DROP TABLE IF EXISTS options_strategies CASCADE;
    DROP TABLE IF EXISTS staking_reward_claims CASCADE;
    DROP TABLE IF EXISTS staking_positions CASCADE;
    DROP TABLE IF EXISTS lp_fee_claims CASCADE;
    DROP TABLE IF EXISTS liquidity_provider_positions CASCADE;
    DROP TABLE IF EXISTS mev_transactions CASCADE;
    DROP TABLE IF EXISTS mev_strategies CASCADE;
  `;
}
