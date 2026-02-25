-- PostgreSQL Migration: Initial Schema for Yuki Trading Platform
-- Created: February 3, 2026
-- Run: psql -d yuki_db -f migrations/001_initial_schema.sql

BEGIN TRANSACTION;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    api_key_active BOOLEAN DEFAULT true,
    api_rate_limit INTEGER DEFAULT 1000,
    api_rate_limit_remaining INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 2. ACCOUNTS (Trading Accounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    exchange VARCHAR(100),
    public_key VARCHAR(255),
    is_live BOOLEAN DEFAULT false,
    initial_balance DECIMAL(20,8) NOT NULL,
    current_balance DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_exchange ON accounts(exchange);

-- ============================================================================
-- 3. STRATEGIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50),
    code TEXT NOT NULL,
    config JSONB,
    status VARCHAR(50),
    
    -- Backtest Results
    backtest_profit_pct DECIMAL(10,2),
    backtest_win_rate DECIMAL(5,2),
    backtest_sharpe_ratio DECIMAL(10,4),
    backtest_max_drawdown DECIMAL(5,2),
    backtest_total_trades INTEGER,
    backtest_from_date DATE,
    backtest_to_date DATE,
    backtest_last_run TIMESTAMP,
    
    -- Hyperopt Results
    best_params JSONB,
    best_score DECIMAL(10,4),
    
    -- Live Stats
    live_active_trades INTEGER DEFAULT 0,
    live_total_profit DECIMAL(20,8) DEFAULT 0,
    live_win_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategies_language ON strategies(language);

-- ============================================================================
-- 4. STRATEGY_RUNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategy_runs (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mode VARCHAR(50),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(50),
    profit DECIMAL(20,8),
    trades_count INTEGER,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_strategy_runs_strategy_id ON strategy_runs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_runs_account_id ON strategy_runs(account_id);
CREATE INDEX IF NOT EXISTS idx_strategy_runs_status ON strategy_runs(status);

-- ============================================================================
-- 5. TRADES
-- ============================================================================
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    strategy_run_id INTEGER NOT NULL REFERENCES strategy_runs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    pair VARCHAR(50),
    chain VARCHAR(50),
    dex VARCHAR(100),
    
    entry_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    entry_time TIMESTAMP,
    exit_time TIMESTAMP,
    
    size DECIMAL(20,8),
    side VARCHAR(20),
    leverage DECIMAL(5,2) DEFAULT 1,
    
    profit_loss DECIMAL(20,8),
    profit_loss_pct DECIMAL(10,4),
    fee DECIMAL(20,8),
    
    status VARCHAR(50),
    exit_reason VARCHAR(255),
    
    entry_tx_hash VARCHAR(255),
    exit_tx_hash VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_strategy_run_id ON trades(strategy_run_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);

-- ============================================================================
-- 6. SIGNALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
    signal_uuid VARCHAR(255) UNIQUE NOT NULL,
    
    action VARCHAR(50),
    pair VARCHAR(50),
    chain VARCHAR(50),
    dex VARCHAR(100),
    
    entry_price DECIMAL(20,8),
    current_price DECIMAL(20,8),
    take_profit_targets DECIMAL(20,8)[],
    stop_loss DECIMAL(20,8),
    
    position_size_usd DECIMAL(20,8),
    position_size_pct DECIMAL(5,2),
    leverage DECIMAL(5,2),
    
    confidence_score DECIMAL(5,4),
    indicators TEXT[],
    
    pair_age_hours DECIMAL(10,2),
    liquidity_usd DECIMAL(20,8),
    volume_24h DECIMAL(20,8),
    trades_24h INTEGER,
    reason TEXT,
    
    status VARCHAR(50),
    broadcasted_at TIMESTAMP,
    executed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_strategy_id ON signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_uuid ON signals(signal_uuid);
CREATE INDEX IF NOT EXISTS idx_signals_pair ON signals(pair);

-- ============================================================================
-- 7. OHLCV (Candlestick Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ohlcv (
    id SERIAL PRIMARY KEY,
    chain VARCHAR(50),
    pair VARCHAR(50),
    timeframe VARCHAR(10),
    
    open_price DECIMAL(20,8),
    high_price DECIMAL(20,8),
    low_price DECIMAL(20,8),
    close_price DECIMAL(20,8),
    volume DECIMAL(20,8),
    volume_quote DECIMAL(20,8),
    trades_count INTEGER,
    
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain, pair, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_chain_pair_timeframe ON ohlcv(chain, pair, timeframe);
CREATE INDEX IF NOT EXISTS idx_ohlcv_timestamp ON ohlcv(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_pair ON ohlcv(pair);

-- ============================================================================
-- 8. WATCHLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id SERIAL PRIMARY KEY,
    watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    pair VARCHAR(50),
    chain VARCHAR(50),
    dex VARCHAR(100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

-- ============================================================================
-- 9. AUDIT TRAIL
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255),
    resource_type VARCHAR(100),
    resource_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);

-- ============================================================================
-- 10. API KEYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    active BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 1000,
    rate_limit_remaining INTEGER DEFAULT 1000,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- ============================================================================
-- 11. PORTFOLIO SUMMARY
-- ============================================================================
CREATE TABLE IF NOT EXISTS portfolio_summary (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    total_balance DECIMAL(20,8),
    total_profit DECIMAL(20,8),
    total_profit_pct DECIMAL(10,4),
    win_rate DECIMAL(5,2),
    sharpe_ratio DECIMAL(10,4),
    max_drawdown DECIMAL(5,2),
    active_trades INTEGER,
    total_trades INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_summary_account_id ON portfolio_summary(account_id);

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Update portfolio summary for an account
CREATE OR REPLACE FUNCTION update_portfolio_summary(p_account_id INTEGER)
RETURNS void AS $$
DECLARE
    v_total_profit DECIMAL(20,8);
    v_active_trades INTEGER;
    v_closed_trades INTEGER;
    v_win_count INTEGER;
    v_win_rate DECIMAL(5,2);
BEGIN
    -- Calculate metrics
    SELECT 
        COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.profit_loss ELSE 0 END), 0),
        COUNT(CASE WHEN t.status = 'open' THEN 1 END),
        COUNT(CASE WHEN t.status = 'closed' THEN 1 END),
        COUNT(CASE WHEN t.status = 'closed' AND t.profit_loss > 0 THEN 1 END)
    INTO v_total_profit, v_active_trades, v_closed_trades, v_win_count
    FROM trades t
    INNER JOIN strategy_runs sr ON t.strategy_run_id = sr.id
    WHERE sr.account_id = p_account_id;
    
    -- Calculate win rate
    IF v_closed_trades > 0 THEN
        v_win_rate := (v_win_count::DECIMAL / v_closed_trades::DECIMAL) * 100;
    ELSE
        v_win_rate := 0;
    END IF;
    
    -- Insert or update
    INSERT INTO portfolio_summary (account_id, total_profit, active_trades, total_trades, win_rate, last_updated)
    VALUES (p_account_id, v_total_profit, v_active_trades, v_closed_trades, v_win_rate, CURRENT_TIMESTAMP)
    ON CONFLICT (account_id) DO UPDATE SET
        total_profit = v_total_profit,
        active_trades = v_active_trades,
        total_trades = v_closed_trades,
        win_rate = v_win_rate,
        last_updated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Log audit trail
CREATE OR REPLACE FUNCTION log_audit(p_user_id INTEGER, p_action VARCHAR, p_resource_type VARCHAR, p_resource_id INTEGER, p_old_value JSONB, p_new_value JSONB, p_ip_address INET, p_user_agent TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_trail (user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, created_at)
    VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_old_value, p_new_value, p_ip_address, p_user_agent, CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Verify installation
SELECT 'Database schema created successfully!' as status;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
