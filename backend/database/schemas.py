# backend/database/schemas.py
"""
Complete MongoDB Schema Definitions for Yuki Trading Platform
Generated: February 3, 2026
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr, validator

# ============================================================================
# ENUMS
# ============================================================================

class StrategyLanguage(str, Enum):
    PYTHON = "python"
    TYPESCRIPT = "typescript"
    JAVASCRIPT = "javascript"

class StrategyStatus(str, Enum):
    DRAFT = "draft"
    UPLOADED = "uploaded"
    VALIDATED = "validated"
    BACKTESTING = "backtesting"
    BACKTEST_COMPLETE = "backtest_complete"
    LIVE = "live"
    PAUSED = "paused"
    ERROR = "error"

class SignalAction(str, Enum):
    LONG = "long"
    SHORT = "short"
    CLOSE = "close"
    TP1 = "tp1"
    TP2 = "tp2"
    TP3 = "tp3"

class TradeStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    CLOSED = "closed"
    FAILED = "failed"

# ============================================================================
# USER & AUTHENTICATION
# ============================================================================

class UserDocument(BaseModel):
    """MongoDB: users collection"""
    _id: Optional[str] = Field(None, alias="id")
    email: EmailStr
    username: str = Field(..., unique=True, index=True)
    password_hash: str
    wallet_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    active: bool = True
    subscription_tier: str = "free"  # free, pro, enterprise
    
    class Config:
        collection = "users"
        indexes = [
            [("username", 1)],
            [("email", 1)],
            [("wallet_address", 1)],
        ]


class APIKeyDocument(BaseModel):
    """MongoDB: api_keys collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., index=True)
    key: str = Field(..., unique=True, index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.now)
    last_used: Optional[datetime] = None
    active: bool = True
    rate_limit_per_minute: int = 60
    rate_limit_remaining: int = 60
    scopes: List[str] = ["strategies:read", "strategies:write", "signals:read"]
    
    class Config:
        collection = "api_keys"
        indexes = [
            [("user_id", 1)],
            [("key", 1)],
        ]


# ============================================================================
# STRATEGIES
# ============================================================================

class StrategyMetadata(BaseModel):
    """Strategy metadata"""
    language: StrategyLanguage
    version: str = "1.0.0"
    author: str
    description: str
    tags: List[str] = []
    icon_url: Optional[str] = None
    readme: Optional[str] = None


class StrategyParameters(BaseModel):
    """Optimizable parameters for strategy"""
    name: str
    type: str = "float"  # float, int, choice
    min_value: float
    max_value: float
    default_value: float
    step: float = 0.01


class BacktestResults(BaseModel):
    """Backtest execution results"""
    total_profit_pct: float
    total_profit_usd: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    avg_profit_per_trade: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float
    recovery_factor: float
    profit_factor: float
    expectancy: float
    calmar_ratio: float
    start_balance_usd: float
    end_balance_usd: float
    buy_and_hold_return_pct: float
    start_date: datetime
    end_date: datetime
    total_candles_processed: int
    execution_time_seconds: float
    trades: List[Dict[str, Any]] = []


class StrategyDocument(BaseModel):
    """MongoDB: strategies collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., index=True)
    name: str
    code: str  # Raw strategy code
    compiled_code: Optional[str] = None  # Compiled/processed code
    language: StrategyLanguage
    status: StrategyStatus = StrategyStatus.DRAFT
    metadata: StrategyMetadata
    parameters: List[StrategyParameters] = []
    
    # Configuration
    config: Dict[str, Any] = {
        "timeframe": "1m",
        "stake_currency": "USDC",
        "max_open_trades": 3,
        "dry_run": False,
        "margin_mode": "spot",
    }
    
    # Backtesting
    last_backtest: Optional[BacktestResults] = None
    backtest_history: List[BacktestResults] = []
    
    # Hyperopt
    best_parameters: Optional[Dict[str, float]] = None
    hyperopt_count: int = 0
    
    # Validation
    syntax_errors: List[str] = []
    is_valid: bool = False
    validation_timestamp: Optional[datetime] = None
    
    # Live trading
    is_live: bool = False
    live_deployed_at: Optional[datetime] = None
    live_total_profit_usd: float = 0.0
    live_total_trades: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    deleted_at: Optional[datetime] = None
    
    class Config:
        collection = "strategies"
        indexes = [
            [("user_id", 1), ("created_at", -1)],
            [("status", 1)],
            [("is_live", 1)],
            [("name", 1)],
        ]


# ============================================================================
# HISTORICAL DATA & CANDLES
# ============================================================================

class CandleDocument(BaseModel):
    """MongoDB: candles collection"""
    _id: Optional[str] = Field(None, alias="id")
    timestamp: int = Field(..., index=True)  # Unix timestamp
    chain: str = Field(..., index=True)  # solana, ethereum, base, etc.
    pair: str = Field(..., index=True)  # SOL/USDC, ETH/USDC, etc.
    dex: Optional[str] = None  # raydium, uniswap, sushiswap, etc.
    timeframe: str = Field(..., index=True)  # 1m, 5m, 15m, 1h, 4h, 1d
    
    # OHLCV
    open: float
    high: float
    low: float
    close: float
    volume: float
    volume_quote: float  # Volume in quote currency (USDC)
    
    # Additional metrics
    trades_count: int = 0
    taker_buy_volume: Optional[float] = None
    taker_buy_volume_quote: Optional[float] = None
    
    # Data source
    source: str = "ccxt"  # ccxt, dexscreener, custom_indexer
    synced_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "candles"
        indexes = [
            [("chain", 1), ("pair", 1), ("timeframe", 1), ("timestamp", 1)],
            [("timestamp", 1)],
            [("pair", 1)],
        ]


class TokenMetadata(BaseModel):
    """MongoDB: token_metadata collection"""
    _id: Optional[str] = Field(None, alias="id")
    chain: str = Field(..., index=True)
    token_address: str = Field(..., index=True)
    symbol: str
    name: str
    decimals: int
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    discord: Optional[str] = None
    total_supply: Optional[float] = None
    circulating_supply: Optional[float] = None
    
    # Market data (cached)
    current_price_usd: Optional[float] = None
    market_cap_usd: Optional[float] = None
    fdv_usd: Optional[float] = None
    volume_24h_usd: Optional[float] = None
    price_change_24h_pct: Optional[float] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "token_metadata"
        indexes = [
            [("chain", 1), ("token_address", 1)],
            [("symbol", 1)],
        ]


# ============================================================================
# SIGNALS
# ============================================================================

class SignalPricing(BaseModel):
    """Pricing details for a signal"""
    entry_price: float
    current_price: float
    take_profit_targets: List[float]  # [0.0048, 0.0055, 0.0065]
    stop_loss: float
    risk_reward_ratio: float


class SignalSizing(BaseModel):
    """Position sizing for a signal"""
    position_size_usd: float
    position_size_pct: float  # % of total balance
    leverage: float = 1.0
    max_loss_usd: float


class SignalConfidence(BaseModel):
    """Confidence metrics"""
    score: float  # 0.0 to 1.0
    indicators: List[str]  # ['volume_spike_2x', 'rsi_oversold', 'macd_bullish']


class SignalDocument(BaseModel):
    """MongoDB: signals collection"""
    _id: Optional[str] = Field(None, alias="id")
    signal_id: str = Field(..., unique=True, index=True)
    strategy_id: str = Field(..., index=True)
    user_id: str = Field(..., index=True)
    
    # Signal details
    action: SignalAction
    timestamp: datetime = Field(default_factory=datetime.now)
    
    # Market info
    chain: str
    dex: str
    pair: str
    pair_address: str
    token_address: str
    quote_token: str = "USDC"
    
    # Pricing & sizing
    pricing: SignalPricing
    sizing: SignalSizing
    confidence: SignalConfidence
    
    # Status
    status: str = "broadcasted"  # broadcasted, pending_execution, executed, expired, cancelled
    executed_at: Optional[datetime] = None
    execution_details: Optional[Dict[str, Any]] = None
    
    # Metadata
    pair_age_hours: float
    liquidity_usd: float
    volume_24h_usd: float
    trades_24h: int
    reason: str
    
    # Broadcasting
    broadcasted_to_telegram: bool = False
    broadcasted_to_webhook: bool = False
    telegram_message_id: Optional[int] = None
    
    # Created metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "signals"
        indexes = [
            [("strategy_id", 1), ("created_at", -1)],
            [("user_id", 1), ("created_at", -1)],
            [("status", 1)],
            [("signal_id", 1)],
        ]


# ============================================================================
# TRADES & EXECUTION
# ============================================================================

class TradeDocument(BaseModel):
    """MongoDB: trades collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., index=True)
    strategy_id: str = Field(..., index=True)
    signal_id: str = Field(..., index=True)
    
    # Trade details
    pair: str
    chain: str
    dex: str
    
    # Entry
    entry_price: float
    entry_time: datetime
    entry_amount: float  # Amount in quote currency (USDC)
    
    # Exit (optional, if closed)
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    exit_reason: Optional[str] = None  # tp1, tp2, sl, manual, timeout
    
    # Status
    status: TradeStatus = TradeStatus.PENDING
    
    # P&L
    profit_loss_usd: float = 0.0
    profit_loss_pct: float = 0.0
    
    # On-chain details
    entry_tx_hash: Optional[str] = None
    exit_tx_hash: Optional[str] = None
    entry_gas_fee: Optional[float] = None
    exit_gas_fee: Optional[float] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    closed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    
    class Config:
        collection = "trades"
        indexes = [
            [("user_id", 1), ("created_at", -1)],
            [("strategy_id", 1)],
            [("status", 1)],
        ]


# ============================================================================
# MARKETPLACE & COPY TRADING
# ============================================================================

class CopyTradePerformance(BaseModel):
    """Performance metrics for copy trading"""
    total_profit_usd: float
    total_profit_pct: float
    total_trades: int
    win_rate: float
    avg_profit_per_trade: float
    sharpe_ratio: float


class MarketplaceStrategy(BaseModel):
    """MongoDB: marketplace_strategies collection"""
    _id: Optional[str] = Field(None, alias="id")
    creator_id: str = Field(..., index=True)
    strategy_id: str
    
    # Listing info
    name: str
    description: str
    category: str  # arbitrage, sniper, scalper, swing, ai_model, etc.
    tags: List[str] = []
    
    # Pricing
    is_free: bool = True
    fee_pct: Optional[float] = None  # Creator fee (0-50%)
    price_usd: Optional[float] = None  # One-time purchase price
    
    # Performance
    performance: CopyTradePerformance
    
    # Engagement
    total_copies: int = 0
    total_profit_distributed: float = 0.0
    rating: float = 0.0  # 0-5 stars
    review_count: int = 0
    
    # Status
    is_public: bool = False
    is_featured: bool = False
    
    # Dates
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "marketplace_strategies"
        indexes = [
            [("creator_id", 1)],
            [("category", 1)],
            [("is_public", 1)],
        ]


class CopiedStrategyInstance(BaseModel):
    """MongoDB: copied_strategies collection"""
    _id: Optional[str] = Field(None, alias="id")
    copier_id: str = Field(..., index=True)
    creator_id: str
    marketplace_strategy_id: str
    
    # Configuration
    position_size_pct: float  # % of copier's balance
    is_active: bool = True
    
    # Performance
    total_profit_usd: float = 0.0
    total_profit_pct: float = 0.0
    total_trades: int = 0
    
    # Fees
    total_fees_paid: float = 0.0
    next_fee_payout_at: Optional[datetime] = None
    
    # Dates
    copied_at: datetime = Field(default_factory=datetime.now)
    stopped_at: Optional[datetime] = None
    
    class Config:
        collection = "copied_strategies"
        indexes = [
            [("copier_id", 1)],
            [("creator_id", 1)],
            [("is_active", 1)],
        ]


# ============================================================================
# PORTFOLIO & HOLDINGS
# ============================================================================

class PortfolioHolding(BaseModel):
    """Single holding in portfolio"""
    token_address: str
    symbol: str
    amount: float
    cost_basis_usd: float
    current_price_usd: float
    current_value_usd: float
    profit_loss_usd: float
    profit_loss_pct: float
    acquired_at: datetime


class PortfolioDocument(BaseModel):
    """MongoDB: portfolios collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., unique=True, index=True)
    
    # Balances
    total_balance_usd: float = 0.0
    cash_balance_usd: float = 0.0
    positions_value_usd: float = 0.0
    
    # P&L
    unrealized_profit_loss_usd: float = 0.0
    realized_profit_loss_usd: float = 0.0
    total_profit_loss_usd: float = 0.0
    
    # Holdings
    holdings: List[PortfolioHolding] = []
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "portfolios"
        indexes = [
            [("user_id", 1)],
        ]


# ============================================================================
# ALERTS & NOTIFICATIONS
# ============================================================================

class AlertDocument(BaseModel):
    """MongoDB: alerts collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., index=True)
    
    # Alert config
    type: str  # price_change, volume_spike, signal_generated, trade_executed
    condition: Dict[str, Any]  # {pair: SOL/USDC, threshold_pct: 5}
    
    # Delivery
    channels: List[str] = ["email", "telegram"]  # email, telegram, webhook
    
    # Status
    is_active: bool = True
    last_triggered: Optional[datetime] = None
    
    # Dates
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "alerts"
        indexes = [
            [("user_id", 1)],
            [("is_active", 1)],
        ]


# ============================================================================
# AUDIT & LOGGING
# ============================================================================

class AuditLogDocument(BaseModel):
    """MongoDB: audit_logs collection"""
    _id: Optional[str] = Field(None, alias="id")
    user_id: str = Field(..., index=True)
    
    # Action details
    action: str  # strategy_uploaded, backtest_executed, signal_sent, trade_executed
    resource_type: str  # strategy, signal, trade
    resource_id: str
    
    # Changes
    changes: Dict[str, Any] = {}
    
    # Metadata
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        collection = "audit_logs"
        indexes = [
            [("user_id", 1), ("created_at", -1)],
            [("action", 1)],
        ]


# ============================================================================
# DATABASE SETUP
# ============================================================================

COLLECTIONS = {
    "users": {
        "indexes": [
            [("username", 1)],
            [("email", 1)],
            [("wallet_address", 1)],
        ]
    },
    "api_keys": {
        "indexes": [
            [("user_id", 1)],
            [("key", 1)],
        ]
    },
    "strategies": {
        "indexes": [
            [("user_id", 1), ("created_at", -1)],
            [("status", 1)],
            [("is_live", 1)],
        ]
    },
    "candles": {
        "indexes": [
            [("chain", 1), ("pair", 1), ("timeframe", 1), ("timestamp", 1)],
            [("timestamp", 1)],
        ]
    },
    "signals": {
        "indexes": [
            [("strategy_id", 1), ("created_at", -1)],
            [("user_id", 1), ("created_at", -1)],
            [("status", 1)],
        ]
    },
    "trades": {
        "indexes": [
            [("user_id", 1), ("created_at", -1)],
            [("strategy_id", 1)],
            [("status", 1)],
        ]
    },
}
