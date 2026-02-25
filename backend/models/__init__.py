# backend/models/__init__.py
# PostgreSQL ORM Models using SQLAlchemy

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON, ARRAY, INET, Index, DECIMAL, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/yuki_db"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============================================================================
# USER MODEL
# ============================================================================
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
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.username}>"

# ============================================================================
# ACCOUNT MODEL
# ============================================================================
class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255))
    exchange = Column(String(100))
    public_key = Column(String(255))
    is_live = Column(Boolean, default=False)
    initial_balance = Column(DECIMAL(20, 8), nullable=False)
    current_balance = Column(DECIMAL(20, 8), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="accounts")
    strategy_runs = relationship("StrategyRun", back_populates="account", cascade="all, delete-orphan")
    portfolio_summary = relationship("PortfolioSummary", back_populates="account", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Account {self.name} ({self.exchange})>"

# ============================================================================
# STRATEGY MODEL
# ============================================================================
class Strategy(Base):
    __tablename__ = "strategies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    language = Column(String(50))  # 'python', 'typescript'
    code = Column(Text, nullable=False)
    config = Column(JSON)
    status = Column(String(50))  # 'draft', 'uploaded', 'backtested', 'live'
    
    # Backtest Results
    backtest_profit_pct = Column(DECIMAL(10, 2))
    backtest_win_rate = Column(DECIMAL(5, 2))
    backtest_sharpe_ratio = Column(DECIMAL(10, 4))
    backtest_max_drawdown = Column(DECIMAL(5, 2))
    backtest_total_trades = Column(Integer)
    backtest_from_date = Column(Date)
    backtest_to_date = Column(Date)
    backtest_last_run = Column(DateTime)
    
    # Hyperopt Results
    best_params = Column(JSON)
    best_score = Column(DECIMAL(10, 4))
    
    # Live Stats
    live_active_trades = Column(Integer, default=0)
    live_total_profit = Column(DECIMAL(20, 8), default=0)
    live_win_rate = Column(DECIMAL(5, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="strategies")
    strategy_runs = relationship("StrategyRun", back_populates="strategy", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="strategy")
    
    def __repr__(self):
        return f"<Strategy {self.name} ({self.language})>"

# ============================================================================
# STRATEGY RUN MODEL
# ============================================================================
class StrategyRun(Base):
    __tablename__ = "strategy_runs"
    
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    mode = Column(String(50))  # 'backtest', 'paper', 'live'
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    status = Column(String(50))  # 'running', 'completed', 'error'
    profit = Column(DECIMAL(20, 8))
    trades_count = Column(Integer)
    error_message = Column(Text)
    metadata = Column(JSON)
    
    strategy = relationship("Strategy", back_populates="strategy_runs")
    account = relationship("Account", back_populates="strategy_runs")
    trades = relationship("Trade", back_populates="strategy_run", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<StrategyRun {self.mode} ({self.status})>"

# ============================================================================
# TRADE MODEL
# ============================================================================
class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True)
    strategy_run_id = Column(Integer, ForeignKey("strategy_runs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    pair = Column(String(50))
    chain = Column(String(50))
    dex = Column(String(100))
    
    entry_price = Column(DECIMAL(20, 8))
    exit_price = Column(DECIMAL(20, 8))
    entry_time = Column(DateTime)
    exit_time = Column(DateTime)
    
    size = Column(DECIMAL(20, 8))
    side = Column(String(20))  # 'long', 'short'
    leverage = Column(DECIMAL(5, 2), default=1)
    
    profit_loss = Column(DECIMAL(20, 8))
    profit_loss_pct = Column(DECIMAL(10, 4))
    fee = Column(DECIMAL(20, 8))
    
    status = Column(String(50))  # 'open', 'closed', 'error'
    exit_reason = Column(String(255))  # 'tp1', 'tp2', 'stop_loss', 'manual'
    
    entry_tx_hash = Column(String(255))
    exit_tx_hash = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    strategy_run = relationship("StrategyRun", back_populates="trades")
    user = relationship("User", back_populates="trades")
    
    def __repr__(self):
        return f"<Trade {self.pair} {self.side} ({self.status})>"

# ============================================================================
# SIGNAL MODEL
# ============================================================================
class Signal(Base):
    __tablename__ = "signals"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"))
    signal_uuid = Column(String(255), unique=True, nullable=False)
    
    action = Column(String(50))  # 'long', 'short', 'close', 'tp1', 'tp2'
    pair = Column(String(50))
    chain = Column(String(50))
    dex = Column(String(100))
    
    entry_price = Column(DECIMAL(20, 8))
    current_price = Column(DECIMAL(20, 8))
    take_profit_targets = Column(ARRAY(DECIMAL(20, 8)))
    stop_loss = Column(DECIMAL(20, 8))
    
    position_size_usd = Column(DECIMAL(20, 8))
    position_size_pct = Column(DECIMAL(5, 2))
    leverage = Column(DECIMAL(5, 2))
    
    confidence_score = Column(DECIMAL(5, 4))
    indicators = Column(ARRAY(String))
    
    pair_age_hours = Column(DECIMAL(10, 2))
    liquidity_usd = Column(DECIMAL(20, 8))
    volume_24h = Column(DECIMAL(20, 8))
    trades_24h = Column(Integer)
    reason = Column(Text)
    
    status = Column(String(50))  # 'pending', 'broadcasted', 'executed', 'expired'
    broadcasted_at = Column(DateTime)
    executed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="signals")
    strategy = relationship("Strategy", back_populates="signals")
    
    def __repr__(self):
        return f"<Signal {self.pair} {self.action} ({self.status})>"

# ============================================================================
# OHLCV MODEL (Candlestick Data)
# ============================================================================
class OHLCV(Base):
    __tablename__ = "ohlcv"
    
    id = Column(Integer, primary_key=True)
    chain = Column(String(50))
    pair = Column(String(50))
    timeframe = Column(String(10))  # '1m', '5m', '1h', '1d'
    
    open_price = Column(DECIMAL(20, 8))
    high_price = Column(DECIMAL(20, 8))
    low_price = Column(DECIMAL(20, 8))
    close_price = Column(DECIMAL(20, 8))
    volume = Column(DECIMAL(20, 8))
    volume_quote = Column(DECIMAL(20, 8))
    trades_count = Column(Integer)
    
    timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<OHLCV {self.pair} {self.timeframe}>"

# ============================================================================
# WATCHLIST MODEL
# ============================================================================
class Watchlist(Base):
    __tablename__ = "watchlists"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255))
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Watchlist {self.name}>"

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    
    id = Column(Integer, primary_key=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False)
    pair = Column(String(50))
    chain = Column(String(50))
    dex = Column(String(100))
    added_at = Column(DateTime, default=datetime.utcnow)
    
    watchlist = relationship("Watchlist", back_populates="items")
    
    def __repr__(self):
        return f"<WatchlistItem {self.pair}>"

# ============================================================================
# API KEY MODEL
# ============================================================================
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
    
    def __repr__(self):
        return f"<APIKey {self.name}>"

# ============================================================================
# AUDIT TRAIL MODEL
# ============================================================================
class AuditTrail(Base):
    __tablename__ = "audit_trail"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(255))
    resource_type = Column(String(100))
    resource_id = Column(Integer)
    old_value = Column(JSON)
    new_value = Column(JSON)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<AuditTrail {self.action}>"

# ============================================================================
# PORTFOLIO SUMMARY MODEL
# ============================================================================
class PortfolioSummary(Base):
    __tablename__ = "portfolio_summary"
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, unique=True)
    total_balance = Column(DECIMAL(20, 8))
    total_profit = Column(DECIMAL(20, 8))
    total_profit_pct = Column(DECIMAL(10, 4))
    win_rate = Column(DECIMAL(5, 2))
    sharpe_ratio = Column(DECIMAL(10, 4))
    max_drawdown = Column(DECIMAL(5, 2))
    active_trades = Column(Integer)
    total_trades = Column(Integer)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    account = relationship("Account", back_populates="portfolio_summary")
    
    def __repr__(self):
        return f"<PortfolioSummary account_id={self.account_id}>"

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================
def init_db():
    """Create all tables in the database"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

def get_db():
    """Get database session for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Export all models
__all__ = [
    'Base',
    'engine',
    'SessionLocal',
    'get_db',
    'init_db',
    'User',
    'Account',
    'Strategy',
    'StrategyRun',
    'Trade',
    'Signal',
    'OHLCV',
    'Watchlist',
    'WatchlistItem',
    'APIKey',
    'AuditTrail',
    'PortfolioSummary',
]
