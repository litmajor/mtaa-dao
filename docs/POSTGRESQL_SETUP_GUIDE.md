# 🗄️ PostgreSQL Setup & Migration Guide

**Date:** February 3, 2026  
**Status:** Ready for Implementation  
**Database:** PostgreSQL (Replacing MongoDB)

---

## Quick Start (5 minutes)

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE yuki_db;
CREATE USER yuki_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE yuki_db TO yuki_user;

# Exit
\q
```

### 2. Run Migration

```bash
# From backend directory
psql -d yuki_db -U yuki_user -f database/migrations/001_initial_schema.sql

# Verify
psql -d yuki_db -U yuki_user -c "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';"
```

### 3. Set Environment

```bash
# Copy example to .env
cp backend/.env.example backend/.env

# Edit with your credentials
DATABASE_URL=postgresql://yuki_user:secure_password@localhost:5432/yuki_db
```

### 4. Initialize Python Models

```bash
cd backend

# Install dependencies
pip install sqlalchemy psycopg2-binary python-dotenv

# Test connection
python -c "
from models import init_db
init_db()
print('✅ Database initialized!')
"
```

---

## Schema Explanation

### Why This Schema (vs MongoDB)

| Need | MongoDB | PostgreSQL |
|------|---------|-----------|
| Store trades safely | Risky (no ACID) | ✅ Safe (ACID guarantees) |
| Prevent orphaned data | Loose relationships | ✅ Foreign keys |
| Complex analytics | Slow aggregations | ✅ Fast JOINs |
| Flexible config | Native JSON | ✅ JSONB (90% as good) |
| Already deployed | Need to set up | ✅ You have it |

### Core Tables (11 Total)

```
users → Core user accounts
├─ accounts → Trading accounts per user
│  ├─ strategy_runs → Execution instances
│  │  └─ trades → Actual buy/sell orders
│  └─ portfolio_summary → Cached metrics
├─ strategies → Strategy code + backtest results
│  └─ signals → Generated trading signals
├─ watchlists → User saved pairs
└─ api_keys → Rate limiting + auth

Supporting:
├─ ohlcv → Historical candlestick data
├─ audit_trail → Compliance logging
└─ (signals can link back to user & strategy)
```

### Why These Tables

| Table | Purpose | Key Insight |
|-------|---------|------------|
| `users` | Authentication + rate limits | Gating all access |
| `accounts` | Multiple trading accounts per user | Some users trade on different exchanges |
| `strategies` | Strategy definitions + backtest results | Store code + results together |
| `strategy_runs` | Each execution is tracked separately | Know exactly when it ran and what profits |
| `trades` | Every single trade recorded | Compliance requirement (audit trail) |
| `signals` | Entry/exit signals broadcast | Can be user-generated or strategy-generated |
| `ohlcv` | Historical price data | For backtesting accuracy |
| `watchlist` | User saved pairs | Quick access on dashboard |
| `api_keys` | API authentication | Can revoke keys without user reset |
| `audit_trail` | Who did what, when | Regulatory compliance |
| `portfolio_summary` | Cached aggregate metrics | Dashboard performance (compute once) |

---

## Real SQL Queries You'll Use

### Get User's Trading Performance

```sql
-- Dashboard: Show user their total profit + win rate
SELECT 
    u.username,
    COUNT(DISTINCT a.id) as total_accounts,
    SUM(ps.total_profit) as total_profit_usd,
    AVG(ps.win_rate) as avg_win_rate,
    COUNT(DISTINCT t.id) as total_trades_lifetime,
    COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) as open_trades
FROM users u
LEFT JOIN accounts a ON u.id = a.user_id
LEFT JOIN portfolio_summary ps ON a.id = ps.account_id
LEFT JOIN strategy_runs sr ON a.id = sr.account_id
LEFT JOIN trades t ON sr.id = t.strategy_run_id
WHERE u.id = 123
GROUP BY u.id, u.username;
```

### Get Strategy Backtest Results

```sql
-- Show strategy details with backtest metrics
SELECT 
    s.id,
    s.name,
    s.language,
    s.status,
    s.backtest_profit_pct,
    s.backtest_win_rate,
    s.backtest_sharpe_ratio,
    s.backtest_total_trades,
    s.backtest_from_date,
    s.backtest_to_date,
    COUNT(sr.id) as live_runs,
    SUM(CASE WHEN t.status = 'closed' THEN t.profit_loss ELSE 0 END) as live_profit
FROM strategies s
LEFT JOIN strategy_runs sr ON s.id = sr.strategy_id AND sr.mode = 'live'
LEFT JOIN trades t ON sr.id = t.strategy_run_id
WHERE s.user_id = 123 AND s.id = 456
GROUP BY s.id;
```

### Get Open Trades

```sql
-- Dashboard: Show all open positions
SELECT 
    t.id,
    t.pair,
    t.chain,
    t.dex,
    t.entry_price,
    t.entry_time,
    t.size,
    t.leverage,
    (t.entry_price * t.size) as position_value_usd,
    s.name as strategy_name,
    a.name as account_name
FROM trades t
INNER JOIN strategy_runs sr ON t.strategy_run_id = sr.id
INNER JOIN strategies s ON sr.strategy_id = s.id
INNER JOIN accounts a ON sr.account_id = a.id
WHERE t.status = 'open' AND a.user_id = 123
ORDER BY t.entry_time DESC;
```

### Get Trade History (for analytics)

```sql
-- Export all closed trades for tax/profit reporting
SELECT 
    t.id,
    t.pair,
    t.side,
    t.entry_price,
    t.exit_price,
    t.entry_time,
    t.exit_time,
    t.size,
    t.profit_loss,
    t.profit_loss_pct,
    t.exit_reason,
    EXTRACT(YEAR FROM t.exit_time) as year,
    EXTRACT(MONTH FROM t.exit_time) as month
FROM trades t
INNER JOIN strategy_runs sr ON t.strategy_run_id = sr.id
INNER JOIN accounts a ON sr.account_id = a.id
WHERE a.user_id = 123 AND t.status = 'closed'
ORDER BY t.exit_time DESC;
```

### Get Signals Sent to User

```sql
-- See which signals were sent/executed
SELECT 
    sig.signal_uuid,
    sig.pair,
    sig.action,
    sig.entry_price,
    sig.confidence_score,
    sig.status,
    sig.created_at,
    sig.broadcasted_at,
    sig.executed_at,
    s.name as strategy_name,
    (sig.take_profit_targets[1]::numeric / sig.entry_price - 1) * 100 as tp1_profit_pct
FROM signals sig
LEFT JOIN strategies s ON sig.strategy_id = s.id
WHERE sig.user_id = 123 AND sig.created_at > NOW() - INTERVAL '7 days'
ORDER BY sig.created_at DESC;
```

---

## Python Repository Pattern (for API)

```python
# backend/repositories/trade_repository.py
from sqlalchemy.orm import Session
from models import Trade, StrategyRun, Account
from datetime import datetime

class TradeRepository:
    @staticmethod
    def get_open_trades(db: Session, user_id: int):
        """Get all open trades for a user"""
        return db.query(Trade).join(
            StrategyRun
        ).join(
            Account
        ).filter(
            Account.user_id == user_id,
            Trade.status == 'open'
        ).all()
    
    @staticmethod
    def get_trade_history(db: Session, user_id: int, days: int = 30):
        """Get closed trades from last N days"""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        return db.query(Trade).join(
            StrategyRun
        ).join(
            Account
        ).filter(
            Account.user_id == user_id,
            Trade.status == 'closed',
            Trade.exit_time >= cutoff
        ).order_by(Trade.exit_time.desc()).all()
    
    @staticmethod
    def create_trade(db: Session, trade_data: dict):
        """Create new trade record"""
        trade = Trade(**trade_data)
        db.add(trade)
        db.commit()
        db.refresh(trade)
        return trade
    
    @staticmethod
    def update_trade(db: Session, trade_id: int, updates: dict):
        """Update trade (e.g., when it closes)"""
        db.query(Trade).filter(Trade.id == trade_id).update(updates)
        db.commit()

# backend/repositories/strategy_repository.py
class StrategyRepository:
    @staticmethod
    def get_strategy_with_backtest(db: Session, user_id: int, strategy_id: int):
        """Get strategy + all backtest results"""
        return db.query(Strategy).filter(
            Strategy.id == strategy_id,
            Strategy.user_id == user_id
        ).first()
    
    @staticmethod
    def update_backtest_results(db: Session, strategy_id: int, results: dict):
        """Update strategy with backtest results"""
        db.query(Strategy).filter(
            Strategy.id == strategy_id
        ).update({
            Strategy.backtest_profit_pct: results['profit_pct'],
            Strategy.backtest_win_rate: results['win_rate'],
            Strategy.backtest_sharpe_ratio: results['sharpe_ratio'],
            Strategy.backtest_max_drawdown: results['max_drawdown'],
            Strategy.backtest_total_trades: results['total_trades'],
            Strategy.backtest_last_run: datetime.utcnow(),
            Strategy.status: 'backtested'
        })
        db.commit()

# backend/repositories/portfolio_repository.py
class PortfolioRepository:
    @staticmethod
    def calculate_and_update_portfolio(db: Session, account_id: int):
        """Recalculate portfolio summary"""
        from sqlalchemy import func
        
        # Calculate metrics
        trades = db.query(Trade).join(
            StrategyRun
        ).filter(
            StrategyRun.account_id == account_id,
            Trade.status == 'closed'
        ).all()
        
        total_profit = sum(t.profit_loss for t in trades)
        closed_trades = len(trades)
        wins = len([t for t in trades if t.profit_loss > 0])
        win_rate = (wins / closed_trades * 100) if closed_trades > 0 else 0
        
        # Update or create summary
        summary = db.query(PortfolioSummary).filter(
            PortfolioSummary.account_id == account_id
        ).first()
        
        if summary:
            summary.total_profit = total_profit
            summary.win_rate = win_rate
            summary.total_trades = closed_trades
            summary.last_updated = datetime.utcnow()
        else:
            summary = PortfolioSummary(
                account_id=account_id,
                total_profit=total_profit,
                win_rate=win_rate,
                total_trades=closed_trades
            )
            db.add(summary)
        
        db.commit()
        return summary
```

---

## API Endpoint Examples

```python
# backend/routes/trades.py
from fastapi import APIRouter, Depends
from models import Trade, get_db
from repositories.trade_repository import TradeRepository

router = APIRouter(prefix="/api/yuki/trades", tags=["trades"])

@router.get("/open")
async def get_open_trades(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all open trades for user"""
    trades = TradeRepository.get_open_trades(db, user_id)
    return {
        'status': 'success',
        'trades': [{
            'id': t.id,
            'pair': t.pair,
            'entry_price': float(t.entry_price),
            'size': float(t.size),
            'entry_time': t.entry_time.isoformat()
        } for t in trades]
    }

@router.get("/history")
async def get_trade_history(
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get closed trades from last N days"""
    trades = TradeRepository.get_trade_history(db, user_id, days)
    return {
        'status': 'success',
        'total': len(trades),
        'profit': sum(float(t.profit_loss) for t in trades),
        'trades': [...]
    }
```

---

## Troubleshooting

### Can't Connect to PostgreSQL?

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start it
sudo systemctl start postgresql

# Test connection
psql -U postgres -c "SELECT version();"
```

### Migration Failed?

```bash
# See what tables exist
psql -d yuki_db -c "\dt"

# Drop all and retry (DEV ONLY!)
psql -d yuki_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -d yuki_db -f database/migrations/001_initial_schema.sql
```

### SQLAlchemy Connection Error?

```python
# Test in Python
from models import engine
with engine.connect() as conn:
    result = conn.execute("SELECT 1")
    print(result.fetchone())
```

---

## Performance Tuning

```sql
-- Create indexes for common queries
CREATE INDEX idx_trades_user_pair ON trades(user_id, pair);
CREATE INDEX idx_trades_status_created ON trades(status, created_at DESC);
CREATE INDEX idx_ohlcv_pair_time ON ohlcv(pair, timestamp DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM trades WHERE user_id = 123;

-- Vacuum to clean up
VACUUM ANALYZE;
```

---

## Backup & Restore

```bash
# Backup
pg_dump yuki_db > yuki_db_backup.sql

# Restore
psql yuki_db < yuki_db_backup.sql

# Backup with compression
pg_dump -Fc yuki_db > yuki_db_backup.dump

# Restore compressed
pg_restore -d yuki_db yuki_db_backup.dump
```

---

## Migration Complete ✅

You now have:
- ✅ Complete PostgreSQL schema (11 tables, properly normalized)
- ✅ SQLAlchemy ORM models (all ready to use)
- ✅ Migration scripts (run once, version controlled)
- ✅ Example queries & repositories (copy-paste ready)
- ✅ Environment configuration (.env setup)
- ✅ ACID guarantees (financial data safe)
- ✅ Better analytics (fast complex queries)

**Next Step:** Wire these models into API endpoints with real database queries instead of mock data.

