# 📊 PostgreSQL vs MongoDB for Yuki Platform

**Decision:** Use existing **PostgreSQL** (not MongoDB)  
**Reason:** ACID guarantees + better for financial data  
**Date:** February 3, 2026

---

## Why PostgreSQL is Better for Trading Platform

### Comparison Table

| Aspect | MongoDB | PostgreSQL | Winner |
|--------|---------|-----------|--------|
| **ACID Guarantees** | Limited (no multi-doc ACID) | Full ACID compliance | ✅ Postgres |
| **Financial Data Safety** | Risky for trade records | Safe & reliable | ✅ Postgres |
| **Complex Queries** | Weak for analytics | Excellent | ✅ Postgres |
| **Relationships** | Loose, document-based | Strong with foreign keys | ✅ Postgres |
| **JSON Flexibility** | Native | JSONB (90% as good) | 🤝 Tie |
| **Already Deployed?** | No | **YES** | ✅ Postgres |
| **Operational Overhead** | Moderate | Low (you know it) | ✅ Postgres |
| **Query Performance** | Variable | Predictable | ✅ Postgres |

### Why This Matters for Trading

**Scenario: Trade Execution**

```
MongoDB approach:
  1. User submits trade
  2. Create trade record
  3. Update balance (separate query)
  4. If #2 succeeds but #3 fails → DATA INCONSISTENCY
     (trade exists but balance not updated)

PostgreSQL approach:
  BEGIN TRANSACTION
    1. Create trade record
    2. Update balance
    3. Log to audit trail
  COMMIT (all-or-nothing)
     (guaranteed consistency)
```

**Scenario: User Complains "My balance is wrong!"**

```
MongoDB: Hard to debug, possible orphaned records
PostgreSQL: Query audit trail, see exact transaction sequence, rollback if needed
```

**Scenario: Portfolio Analytics (Win Rate, Sharpe Ratio, etc.)**

```
MongoDB: Complex aggregation pipeline, slow on 100k trades
PostgreSQL: Single JOIN + GROUP BY, indexed, instant
```

### JSON Flexibility (PostgreSQL Has It!)

PostgreSQL has `JSONB` which gives you 90% of MongoDB's flexibility:

```sql
-- Store flexible strategy config
CREATE TABLE strategies (
  id SERIAL PRIMARY KEY,
  user_id INT,
  name VARCHAR(255),
  config JSONB,  -- Can store any JSON structure
  created_at TIMESTAMP
);

-- Insert flexible data
INSERT INTO strategies (user_id, name, config) VALUES
  (1, 'Volume Sniper', '{"rsi_threshold": 30, "volume_multiplier": 2.0}'),
  (1, 'ML Agent', '{"model_type": "transformers", "model_path": "/models/v2", "features": ["volume", "price_change"]}');

-- Query JSON
SELECT * FROM strategies 
WHERE config->>'model_type' = 'transformers';

-- Update JSON
UPDATE strategies 
SET config = jsonb_set(config, '{volume_multiplier}', '2.5')
WHERE id = 1;
```

---

## Complete PostgreSQL Schema for Yuki

### Core Tables

```sql
-- 1. USERS
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE,
  api_key_active BOOLEAN DEFAULT true,
  api_rate_limit INT DEFAULT 1000,
  api_rate_limit_remaining INT DEFAULT 1000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_api_key ON users(api_key);

-- 2. ACCOUNTS (Trading Accounts)
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  exchange VARCHAR(100),  -- 'solana', 'ethereum', etc.
  public_key VARCHAR(255),
  is_live BOOLEAN DEFAULT false,
  initial_balance DECIMAL(20,8) NOT NULL,
  current_balance DECIMAL(20,8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- 3. STRATEGIES
CREATE TABLE strategies (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  language VARCHAR(50),  -- 'python', 'typescript', 'javascript'
  code TEXT NOT NULL,    -- Full strategy source code
  config JSONB,          -- Strategy parameters (flexible)
  status VARCHAR(50),    -- 'draft', 'uploaded', 'backtested', 'live'
  
  -- Backtest Results
  backtest_profit_pct DECIMAL(10,2),
  backtest_win_rate DECIMAL(5,2),
  backtest_sharpe_ratio DECIMAL(10,4),
  backtest_max_drawdown DECIMAL(5,2),
  backtest_total_trades INT,
  backtest_from_date DATE,
  backtest_to_date DATE,
  backtest_last_run TIMESTAMP,
  
  -- Hyperopt Results
  best_params JSONB,
  best_score DECIMAL(10,4),
  
  -- Live Stats (updated in real-time)
  live_active_trades INT DEFAULT 0,
  live_total_profit DECIMAL(20,8) DEFAULT 0,
  live_win_rate DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_status ON strategies(status);

-- 4. STRATEGY_RUNS (Execution instances)
CREATE TABLE strategy_runs (
  id SERIAL PRIMARY KEY,
  strategy_id INT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mode VARCHAR(50),  -- 'backtest', 'paper', 'live'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(50),  -- 'running', 'completed', 'error'
  profit DECIMAL(20,8),
  trades_count INT,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX idx_strategy_runs_strategy_id ON strategy_runs(strategy_id);
CREATE INDEX idx_strategy_runs_account_id ON strategy_runs(account_id);
CREATE INDEX idx_strategy_runs_status ON strategy_runs(status);

-- 5. TRADES
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  strategy_run_id INT NOT NULL REFERENCES strategy_runs(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Trade Details
  pair VARCHAR(50),  -- 'SOL/USDC'
  chain VARCHAR(50),  -- 'solana', 'ethereum'
  dex VARCHAR(100),  -- 'raydium', 'uniswap'
  
  -- Pricing
  entry_price DECIMAL(20,8),
  exit_price DECIMAL(20,8),
  entry_time TIMESTAMP,
  exit_time TIMESTAMP,
  
  -- Position
  size DECIMAL(20,8),
  side VARCHAR(20),  -- 'long', 'short'
  leverage DECIMAL(5,2) DEFAULT 1,
  
  -- P&L
  profit_loss DECIMAL(20,8),
  profit_loss_pct DECIMAL(10,4),
  fee DECIMAL(20,8),
  
  -- State
  status VARCHAR(50),  -- 'open', 'closed', 'error'
  exit_reason VARCHAR(255),  -- 'tp1', 'tp2', 'stop_loss', 'manual'
  
  -- Transaction Hashes (for verification)
  entry_tx_hash VARCHAR(255),
  exit_tx_hash VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_strategy_run_id ON trades(strategy_run_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_pair ON trades(pair);

-- 6. SIGNALS
CREATE TABLE signals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strategy_id INT REFERENCES strategies(id) ON DELETE SET NULL,
  signal_uuid VARCHAR(255) UNIQUE NOT NULL,
  
  -- Signal Details
  action VARCHAR(50),  -- 'long', 'short', 'close', 'tp1', 'tp2', 'tp3'
  pair VARCHAR(50),
  chain VARCHAR(50),
  dex VARCHAR(100),
  
  -- Pricing
  entry_price DECIMAL(20,8),
  current_price DECIMAL(20,8),
  take_profit_targets DECIMAL(20,8)[],  -- PostgreSQL array type
  stop_loss DECIMAL(20,8),
  
  -- Sizing
  position_size_usd DECIMAL(20,8),
  position_size_pct DECIMAL(5,2),
  leverage DECIMAL(5,2),
  
  -- Confidence
  confidence_score DECIMAL(5,4),
  indicators TEXT[],  -- Array of indicator names
  
  -- Metadata
  pair_age_hours DECIMAL(10,2),
  liquidity_usd DECIMAL(20,8),
  volume_24h DECIMAL(20,8),
  trades_24h INT,
  reason TEXT,
  
  -- Status
  status VARCHAR(50),  -- 'pending', 'broadcasted', 'executed', 'expired'
  broadcasted_at TIMESTAMP,
  executed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_user_id ON signals(user_id);
CREATE INDEX idx_signals_strategy_id ON signals(strategy_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_uuid ON signals(signal_uuid);

-- 7. OHLCV (Candlestick Data - for backtesting)
CREATE TABLE ohlcv (
  id SERIAL PRIMARY KEY,
  chain VARCHAR(50),
  pair VARCHAR(50),
  timeframe VARCHAR(10),  -- '1m', '5m', '1h', '1d'
  
  -- Candlestick Data
  open_price DECIMAL(20,8),
  high_price DECIMAL(20,8),
  low_price DECIMAL(20,8),
  close_price DECIMAL(20,8),
  volume DECIMAL(20,8),
  volume_quote DECIMAL(20,8),
  trades_count INT,
  
  timestamp TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ohlcv_chain_pair_timeframe ON ohlcv(chain, pair, timeframe);
CREATE INDEX idx_ohlcv_timestamp ON ohlcv(timestamp);
CREATE UNIQUE INDEX idx_ohlcv_unique ON ohlcv(chain, pair, timeframe, timestamp);

-- 8. WATCHLIST
CREATE TABLE watchlists (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE watchlist_items (
  id SERIAL PRIMARY KEY,
  watchlist_id INT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  pair VARCHAR(50),
  chain VARCHAR(50),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

-- 9. AUDIT TRAIL (for compliance)
CREATE TABLE audit_trail (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255),
  resource_type VARCHAR(100),  -- 'strategy', 'trade', 'signal'
  resource_id INT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_created_at ON audit_trail(created_at);

-- 10. API_KEYS (for rate limiting)
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  active BOOLEAN DEFAULT true,
  rate_limit INT DEFAULT 1000,
  rate_limit_remaining INT DEFAULT 1000,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- 11. PORTFOLIO (Materialized view for dashboard)
CREATE TABLE portfolio_summary (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  total_balance DECIMAL(20,8),
  total_profit DECIMAL(20,8),
  total_profit_pct DECIMAL(10,4),
  win_rate DECIMAL(5,2),
  sharpe_ratio DECIMAL(10,4),
  max_drawdown DECIMAL(5,2),
  active_trades INT,
  total_trades INT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portfolio_summary_account_id ON portfolio_summary(account_id);
```

### Create Migration File

```sql
-- migrations/001_initial_schema.sql
-- Run: psql -d yuki_db -f migrations/001_initial_schema.sql

BEGIN;

-- All CREATE TABLE statements above...

-- Create stored procedures for common operations
CREATE OR REPLACE FUNCTION update_portfolio_summary(account_id INT)
RETURNS void AS $$
BEGIN
  INSERT INTO portfolio_summary (account_id, total_balance, total_profit, active_trades, last_updated)
  SELECT 
    a.id,
    a.current_balance,
    COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.profit_loss ELSE 0 END), 0) as total_profit,
    COUNT(CASE WHEN t.status = 'open' THEN 1 END) as active_trades,
    NOW()
  FROM accounts a
  LEFT JOIN strategy_runs sr ON a.id = sr.account_id
  LEFT JOIN trades t ON sr.id = t.strategy_run_id
  WHERE a.id = account_id
  GROUP BY a.id, a.current_balance
  ON CONFLICT (account_id) DO UPDATE SET
    total_balance = EXCLUDED.total_balance,
    total_profit = EXCLUDED.total_profit,
    active_trades = EXCLUDED.active_trades,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

---

## SQLAlchemy Models (Python ORM)

```python
# backend/models/database.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSONB, ARRAY, INET, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    api_key = Column(String(255), unique=True)
    api_key_active = Column(Boolean, default=True)
    api_rate_limit = Column(Integer, default=1000)
    api_rate_limit_remaining = Column(Integer, default=1000)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    accounts = relationship("Account", back_populates="user")
    strategies = relationship("Strategy", back_populates="user")
    trades = relationship("Trade", back_populates="user")
    signals = relationship("Signal", back_populates="user")
    api_keys = relationship("APIKey", back_populates="user")

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255))
    exchange = Column(String(100))
    public_key = Column(String(255))
    is_live = Column(Boolean, default=False)
    initial_balance = Column(Float, nullable=False)
    current_balance = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="accounts")
    strategy_runs = relationship("StrategyRun", back_populates="account")

class Strategy(Base):
    __tablename__ = "strategies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    language = Column(String(50))  # 'python', 'typescript'
    code = Column(Text, nullable=False)
    config = Column(JSONB)
    status = Column(String(50))  # 'draft', 'uploaded', 'backtested', 'live'
    
    backtest_profit_pct = Column(Float)
    backtest_win_rate = Column(Float)
    backtest_sharpe_ratio = Column(Float)
    backtest_max_drawdown = Column(Float)
    backtest_total_trades = Column(Integer)
    backtest_from_date = Column(DateTime)
    backtest_to_date = Column(DateTime)
    backtest_last_run = Column(DateTime)
    
    best_params = Column(JSONB)
    best_score = Column(Float)
    
    live_active_trades = Column(Integer, default=0)
    live_total_profit = Column(Float, default=0)
    live_win_rate = Column(Float, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="strategies")
    strategy_runs = relationship("StrategyRun", back_populates="strategy")

class StrategyRun(Base):
    __tablename__ = "strategy_runs"
    
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    mode = Column(String(50))  # 'backtest', 'paper', 'live'
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    status = Column(String(50))
    profit = Column(Float)
    trades_count = Column(Integer)
    error_message = Column(Text)
    metadata = Column(JSONB)
    
    strategy = relationship("Strategy", back_populates="strategy_runs")
    account = relationship("Account", back_populates="strategy_runs")
    trades = relationship("Trade", back_populates="strategy_run")

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True)
    strategy_run_id = Column(Integer, ForeignKey("strategy_runs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    pair = Column(String(50))
    chain = Column(String(50))
    dex = Column(String(100))
    
    entry_price = Column(Float)
    exit_price = Column(Float)
    entry_time = Column(DateTime)
    exit_time = Column(DateTime)
    
    size = Column(Float)
    side = Column(String(20))
    leverage = Column(Float, default=1)
    
    profit_loss = Column(Float)
    profit_loss_pct = Column(Float)
    fee = Column(Float)
    
    status = Column(String(50))
    exit_reason = Column(String(255))
    
    entry_tx_hash = Column(String(255))
    exit_tx_hash = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    strategy_run = relationship("StrategyRun", back_populates="trades")
    user = relationship("User", back_populates="trades")

class Signal(Base):
    __tablename__ = "signals"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"))
    signal_uuid = Column(String(255), unique=True, nullable=False)
    
    action = Column(String(50))
    pair = Column(String(50))
    chain = Column(String(50))
    dex = Column(String(100))
    
    entry_price = Column(Float)
    current_price = Column(Float)
    take_profit_targets = Column(ARRAY(Float))
    stop_loss = Column(Float)
    
    position_size_usd = Column(Float)
    position_size_pct = Column(Float)
    leverage = Column(Float)
    
    confidence_score = Column(Float)
    indicators = Column(ARRAY(String))
    
    pair_age_hours = Column(Float)
    liquidity_usd = Column(Float)
    volume_24h = Column(Float)
    trades_24h = Column(Integer)
    reason = Column(Text)
    
    status = Column(String(50))
    broadcasted_at = Column(DateTime)
    executed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="signals")

class OHLCV(Base):
    __tablename__ = "ohlcv"
    
    id = Column(Integer, primary_key=True)
    chain = Column(String(50))
    pair = Column(String(50))
    timeframe = Column(String(10))
    
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(Float)
    volume_quote = Column(Float)
    trades_count = Column(Integer)
    
    timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    active = Column(Boolean, default=True)
    rate_limit = Column(Integer, default=1000)
    rate_limit_remaining = Column(Integer, default=1000)
    last_used = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="api_keys")

class AuditTrail(Base):
    __tablename__ = "audit_trail"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(255))
    resource_type = Column(String(100))
    resource_id = Column(Integer)
    old_value = Column(JSONB)
    new_value = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class PortfolioSummary(Base):
    __tablename__ = "portfolio_summary"
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    total_balance = Column(Float)
    total_profit = Column(Float)
    total_profit_pct = Column(Float)
    win_rate = Column(Float)
    sharpe_ratio = Column(Float)
    max_drawdown = Column(Float)
    active_trades = Column(Integer)
    total_trades = Column(Integer)
    last_updated = Column(DateTime, default=datetime.utcnow)
```

---

## Connection & Environment

```python
# backend/config.py
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

# PostgreSQL connection
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/yuki_db"
)

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # For serverless, use NullPool
    echo=False  # Set to True for SQL debugging
)

from models import Base

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)

# .env file
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/yuki_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=yuki_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

---

## Migration: MongoDB → PostgreSQL

### Why MongoDB was Suggested (But Wrong)

```
❌ "MongoDB is flexible for evolving schemas"
✅ PostgreSQL JSONB is 90% as good, with ACID guarantees

❌ "MongoDB is easier to prototype"
✅ You already have PostgreSQL running (no extra overhead)

❌ "MongoDB is better for high-volume writes"
✅ For trading platform, you need ACID > throughput
```

### What You Get with PostgreSQL

```
✅ ACID Guarantees → Trade data never corrupts
✅ Foreign Keys → Can't delete user without deleting trades
✅ Transactions → Either all updates succeed or all fail
✅ Indexing → Analytics queries 100x faster
✅ JSONB → Still flexible (config, indicators, metadata)
✅ Already Running → Zero extra infrastructure
✅ Team Knowledge → Your team knows SQL
```

---

## Summary

**PostgreSQL is the right choice because:**

1. ✅ **You already have it** - no extra infrastructure
2. ✅ **ACID guarantees** - critical for financial data
3. ✅ **Better for analytics** - complex queries fast
4. ✅ **JSONB support** - flexible like MongoDB when needed
5. ✅ **Team experience** - your team knows SQL
6. ✅ **Lower cost** - fewer databases to manage

**Use MongoDB only if:**
- You need massive horizontal scaling (you don't yet)
- You need schemaless flexibility for prototype (JSONB works)
- Your team has MongoDB expertise (they have SQL expertise)

---

**Recommendation:** Use PostgreSQL (your existing database)  
**Schema:** Complete, ready for implementation  
**Next Step:** Set up connection pool + run migrations

