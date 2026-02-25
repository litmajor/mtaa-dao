# 🚀 PHASE 1C: Advanced Power Users & Custom Strategy Architecture

**Date:** February 3, 2026  
**Purpose:** Escape hatch for power users with custom models/agents + backtesting  
**Audience:** Developers, Strategy Traders, Bot Builders  
**Status:** Implementation Ready

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Custom Code Strategies](#custom-code-strategies)
3. [Freqtrade Integration](#freqtrade-integration)
4. [Backtesting Data API](#backtesting-data-api)
5. [DexScreener Integration](#dexscreener-integration)
6. [Signal Webhook Ecosystem](#signal-webhook-ecosystem)
7. [Implementation Examples](#implementation-examples)
8. [Security & Sandboxing](#security--sandboxing)

---

## Architecture Overview

### User Journey (Power User)

```
Power User Path:
  No-Code Builder (80% use cases)
           ↓
    Custom Strategy (Python)
           ↓
    Upload → Sandbox Validation
           ↓
    Backtest → Historical Data API
           ↓
    Hyperopt → Parameter Tuning
           ↓
    Deploy → Live Trading
           ↓
    Signal Webhook → External Bots
           ↓
    Telegram + Copy Trading
```

### Technology Stack (Recommended)

```
Strategy Framework:    Freqtrade (battle-tested, 39k+ stars)
Data Source:           DexScreener API + Your OHLCV API
Backtesting Engine:    Freqtrade's built-in backtest
Hyperopt:              Freqtrade's Edge + Optuna integration
Signal Distribution:   Telegram + REST Webhook
Execution Layer:       Direct API calls or external bots
Sandboxing:            Docker container (timeout + resource limits)
```

---

## Custom Code Strategies

### Option 1: Freqtrade-Compatible (STRONGLY RECOMMENDED) ⭐

**Why Freqtrade?**
- Industry standard for crypto strategy development (39k+ GitHub stars)
- Built-in backtesting, hyperparameter optimization, drawdown analysis
- Massive community with 1000s of battle-tested strategies
- Your backend can `exec()` or import their `.py` file directly
- First-class support for CEX + DEX pairs
- Telegram integration out-of-box

**User Creates Strategy File:**

```python
# custom_my_sniper_strategy.py
from freqtrade.strategy import IStrategy
from freqtrade.persistence import Trade
import talib
import pandas as pd

class MyMemeSniper(IStrategy):
    """
    Advanced meme coin sniper with volume detection + momentum
    """
    
    # Required: Define stake currency (will be provided by Yuki)
    stoploss = -0.05  # 5% hard stop
    timeframe = "1m"
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.05
    trailing_only_offset_is_reached = True
    
    # Optional: Enable leverage/shorting
    can_short = False
    leverage_enabled = False
    
    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Calculate indicators for entry/exit signals
        """
        # Volume analysis
        dataframe['volume_ma'] = dataframe['volume'].rolling(window=20).mean()
        dataframe['volume_ratio'] = dataframe['volume'] / dataframe['volume_ma']
        
        # Price momentum
        dataframe['rsi'] = talib.RSI(dataframe['close'], timeperiod=14)
        dataframe['macd'], dataframe['macd_signal'], dataframe['macd_hist'] = \
            talib.MACD(dataframe['close'], fastperiod=12, slowperiod=26, signalperiod=9)
        
        # Bollinger Bands
        dataframe['bb_upper'], dataframe['bb_middle'], dataframe['bb_lower'] = \
            talib.BBANDS(dataframe['close'], timeperiod=20, nbdevup=2, nbdevdn=2)
        
        return dataframe
    
    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Generate buy signals (entry_long = 1)
        """
        dataframe.loc[
            (
                # Volume spike (2x above 20-period MA)
                (dataframe['volume_ratio'] > 2.0) &
                # Price below lower Bollinger Band (oversold)
                (dataframe['close'] < dataframe['bb_lower']) &
                # RSI < 30 (oversold)
                (dataframe['rsi'] < 30) &
                # MACD positive (momentum building)
                (dataframe['macd'] > dataframe['macd_signal']) &
                # Prevent multiple entries
                (dataframe['close'] > dataframe['close'].shift(1))
            ),
            'enter_long'] = 1
        
        return dataframe
    
    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Generate sell signals (exit_long = 1)
        """
        dataframe.loc[
            (
                # RSI > 70 (overbought)
                (dataframe['rsi'] > 70) |
                # Price above upper Bollinger Band (take profit)
                (dataframe['close'] > dataframe['bb_upper']) |
                # MACD crosses below signal (momentum fading)
                ((dataframe['macd'] < dataframe['macd_signal']) & 
                 (dataframe['macd'].shift(1) > dataframe['macd_signal'].shift(1)))
            ),
            'exit_long'] = 1
        
        return dataframe
    
    def custom_stoploss(self, pair: str, trade: Trade, current_time, current_rate: float,
                       current_profit: float, **kwargs) -> float:
        """
        Advanced stop loss: tighter when momentum fades
        """
        # If profit, use trailing stop
        if current_profit > 0.02:
            return -0.02  # 2% trailing
        # If loss, keep at 5%
        return -0.05


# Optional: Configuration for this strategy
"""
strategy_config = {
    'timeframe': '1m',
    'stake_currency': 'USDC',
    'dry_run': False,
    'margin_mode': 'spot',
    'exchange': 'raydium',  # DEX name
    'max_open_trades': 3,
    'trade_timeout': 30,  # minutes
    'use_exit_signal': True,
    'exit_profit_only': False,
    'exit_profit_offset': 0.01,
}
"""
```

**Key Method Requirements:**

| Method | Purpose | Output |
|--------|---------|--------|
| `populate_indicators()` | Calculate all technical indicators | DataFrame with new columns |
| `populate_entry_trend()` | Generate entry signals | `df['enter_long'] = 1` for buy |
| `populate_exit_trend()` | Generate exit signals | `df['exit_long'] = 1` for sell |
| `custom_stoploss()` | Dynamic stop loss (optional) | Returns float (-0.05 = 5% stop) |
| `custom_sell()` | Custom exit rules (optional) | Returns tuple (sell_flag, reason) |

---

### Option 2: Generic Sandboxed Python (For Non-Freqtrade Users)

**If user wants custom agent/model (not Freqtrade format):**

```python
# custom_my_ai_agent.py
class MyAIStrategy:
    """
    Custom agent written by user (ML model, complex logic, etc.)
    """
    
    def __init__(self, config: dict):
        self.config = config
        # Load any ML model, external APIs, etc.
        
    def analyze(self, ohlcv_data: dict, metadata: dict) -> dict:
        """
        Analyze market data and return signals
        
        Args:
            ohlcv_data: {
                'open': [prices],
                'high': [prices],
                'low': [prices],
                'close': [prices],
                'volume': [volumes],
                'time': [timestamps]
            }
            metadata: {'pair': 'SOL/USDC', 'chain': 'solana', ...}
        
        Returns:
            {
                'signal': 'long' | 'short' | 'close' | 'hold',
                'confidence': 0.85,
                'entry': 0.15,
                'exit_targets': [0.18, 0.22],
                'stop_loss': 0.12,
                'reason': 'Volume breakout detected'
            }
        """
        # Your custom logic here
        last_close = ohlcv_data['close'][-1]
        volume_ma = sum(ohlcv_data['volume'][-20:]) / 20
        
        if ohlcv_data['volume'][-1] > volume_ma * 2:
            return {
                'signal': 'long',
                'confidence': 0.87,
                'entry': last_close,
                'exit_targets': [last_close * 1.05, last_close * 1.10],
                'stop_loss': last_close * 0.95,
                'reason': 'Volume spike detected by ML model'
            }
        
        return {'signal': 'hold', 'confidence': 0.5}
```

**Yuki Backend Execution (Sandboxed):**

```python
# backend/sandbox_runner.py
import docker
import json
import tempfile
from pathlib import Path

class StrategyExecutor:
    def __init__(self, timeout_seconds=30):
        self.client = docker.from_env()
        self.timeout = timeout_seconds
    
    def execute_backtest(self, strategy_file: str, config: dict, 
                        historical_data: dict) -> dict:
        """
        Run user strategy in Docker sandbox
        """
        
        # 1. Create temporary directory with strategy
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # Write strategy file
            (tmpdir / 'strategy.py').write_text(strategy_file)
            
            # Write backtest runner script
            runner_script = f"""
import json
import sys
sys.path.insert(0, '/sandbox')

from strategy import MyAIStrategy
import pandas as pd

# Load data
historical_data = {json.dumps(historical_data)}
config = {json.dumps(config)}

# Execute strategy
analyzer = MyAIStrategy(config)
signals = []
results = {{'total_profit': 0, 'win_rate': 0, 'max_drawdown': 0, 'signals': signals}}

# Backtest logic (iterate through candles)
for i in range(20, len(historical_data['close'])):
    current_data = {{
        'open': historical_data['open'][max(0, i-20):i],
        'high': historical_data['high'][max(0, i-20):i],
        'low': historical_data['low'][max(0, i-20):i],
        'close': historical_data['close'][max(0, i-20):i],
        'volume': historical_data['volume'][max(0, i-20):i],
        'time': historical_data['time'][max(0, i-20):i],
    }}
    
    signal = analyzer.analyze(current_data, config.get('metadata', {{}}))
    signals.append({{'candle': i, 'signal': signal}})

results['signals'] = signals
print(json.dumps(results))
"""
            (tmpdir / 'runner.py').write_text(runner_script)
            
            # 2. Run in Docker
            try:
                container = self.client.containers.run(
                    'python:3.11-slim',
                    ['python', '/app/runner.py'],
                    volumes={{str(tmpdir): {{'bind': '/app', 'mode': 'ro'}}}},
                    timeout=self.timeout,
                    remove=True,
                    capture_output=True,
                    text=True
                )
                
                # 3. Parse results
                results = json.loads(container.stdout)
                return {
                    'status': 'success',
                    'results': results,
                    'stderr': container.stderr
                }
                
            except docker.errors.ContainerError as e:
                return {
                    'status': 'error',
                    'error': str(e),
                    'stderr': e.stderr.decode()
                }
```

---

## Freqtrade Integration

### Setup Instructions

**1. Backend Dependencies:**

```bash
pip install freqtrade[extra]  # Includes backtesting, hyperopt, plotting
pip install pandas-ta         # Technical analysis
pip install ccxt              # Exchange integration
pip install dexscreener       # DexScreener API client
```

**2. Freqtrade Backtester Class:**

```python
# backend/freqtrade_integration.py
from freqtrade.configuration import Configuration
from freqtrade.resolvers import StrategyResolver
from freqtrade.backtesting import Backtest
from freqtrade.optimize.hyperopt import Hyperopt
import tempfile
from pathlib import Path
import json

class FreqtradeBacktester:
    def __init__(self, config_template: dict):
        self.base_config = config_template
    
    def backtest_strategy(self, strategy_file: str, 
                         timerange: str = "20230101-20240101",
                         stake_amount: float = 100) -> dict:
        """
        Backtest a Freqtrade strategy
        
        Args:
            strategy_file: Content of strategy .py file
            timerange: Format "YYYYMMDD-YYYYMMDD"
            stake_amount: Amount per trade (USDC)
        
        Returns:
            {
                'total_profit_pct': 45.2,
                'total_trades': 87,
                'wins': 52,
                'losses': 35,
                'win_rate': 59.8,
                'avg_profit': 0.68,
                'sharpe_ratio': 1.45,
                'max_drawdown_pct': 12.3,
                'buy_and_hold_returns': 23.5,
                'trades': [...]
            }
        """
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # 1. Write strategy file
            strategy_path = tmpdir / 'user_strategy.py'
            strategy_path.write_text(strategy_file)
            
            # 2. Build backtest config
            config = self.base_config.copy()
            config.update({
                'strategy': 'user_strategy',
                'user_data_dir': str(tmpdir),
                'timerange': timerange,
                'stake_amount': stake_amount,
                'dry_run': True,
                'trading_mode': 'spot',
                'margin_mode': 'cross',
            })
            
            # 3. Run backtest
            try:
                bt = Backtest(config)
                results = bt.backtest(processed_data={})
                
                return {
                    'status': 'success',
                    'results': {
                        'total_profit_pct': results['profit_abs'] / stake_amount * 100,
                        'total_trades': results['total_trades'],
                        'wins': results['wins'],
                        'losses': results['losses'],
                        'win_rate': results['win_rate'],
                        'avg_profit': results['avg_profit'],
                        'sharpe_ratio': results['sharpe_ratio'],
                        'max_drawdown_pct': results['max_drawdown_pct'],
                        'buy_and_hold_returns': results['buy_and_hold_returns'],
                        'trades': results['trades'],
                    }
                }
            except Exception as e:
                return {
                    'status': 'error',
                    'error': str(e)
                }
    
    def hyperopt_strategy(self, strategy_file: str, 
                         n_epochs: int = 100,
                         timerange: str = "20230101-20240101") -> dict:
        """
        Run hyperparameter optimization
        
        Returns best parameters + backtest results
        """
        
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            strategy_path = tmpdir / 'user_strategy.py'
            strategy_path.write_text(strategy_file)
            
            config = self.base_config.copy()
            config.update({
                'strategy': 'user_strategy',
                'hyperopt_epochs': n_epochs,
                'timerange': timerange,
                'hyperopt_loss': 'SharpeHyperOptLoss',
                'hyperopt_random_state': 42,
                'print_colorized': False,
            })
            
            try:
                hyperopt = Hyperopt(config)
                results = hyperopt.start()
                
                return {
                    'status': 'success',
                    'best_params': results['best_params'],
                    'best_score': results['best_score'],
                    'epochs': n_epochs
                }
            except Exception as e:
                return {
                    'status': 'error',
                    'error': str(e)
                }
```

**3. API Endpoint for Strategy Upload:**

```python
# backend/routes/strategies.py
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/yuki/strategies/custom", tags=["custom_strategies"])

@router.post("/upload")
async def upload_strategy(file: UploadFile = File(...)):
    """
    User uploads custom strategy (Freqtrade format)
    """
    content = await file.read()
    strategy_code = content.decode('utf-8')
    
    # Validate syntax
    try:
        compile(strategy_code, file.filename, 'exec')
    except SyntaxError as e:
        return JSONResponse(
            {"status": "error", "error": f"Syntax error: {e}"},
            status_code=400
        )
    
    # TODO: Store in DB
    # await db.strategies.insert_one({
    #     'user_id': current_user['id'],
    #     'name': file.filename,
    #     'code': strategy_code,
    #     'created_at': datetime.now(),
    #     'status': 'uploaded'
    # })
    
    return {"status": "success", "strategy_id": "strat_123"}

@router.post("/backtest/{strategy_id}")
async def backtest_strategy(strategy_id: str, 
                           timerange: str = "20230101-20240101",
                           stake_amount: float = 100):
    """
    Backtest uploaded strategy
    """
    # TODO: Retrieve strategy from DB
    strategy_code = "..."  # from DB
    
    backtester = FreqtradeBacktester(BASE_CONFIG)
    results = backtester.backtest_strategy(strategy_code, timerange, stake_amount)
    
    return results

@router.post("/hyperopt/{strategy_id}")
async def hyperopt_strategy(strategy_id: str, 
                           n_epochs: int = 100,
                           timerange: str = "20230101-20240101"):
    """
    Run hyperparameter optimization
    """
    strategy_code = "..."  # from DB
    
    backtester = FreqtradeBacktester(BASE_CONFIG)
    results = backtester.hyperopt_strategy(strategy_code, n_epochs, timerange)
    
    return results
```

---

## Backtesting Data API

### Historical OHLCV API

**Purpose:** Provide accurate historical data for strategy testing

**Endpoint:**

```
GET /api/yuki/market/ohlcv/{chain}/{pair}/{timeframe}
    ?from=timestamp&to=timestamp&limit=1000
```

**Parameters:**

```
chain:     solana | ethereum | base | bsc | polygon | arbitrum
pair:      PUMP/USDC, SOL/USDC, etc.
timeframe: 1m, 5m, 15m, 1h, 4h, 1d
from:      Unix timestamp (start date)
to:        Unix timestamp (end date)
limit:     Max 1000 candles per request
```

**Response:**

```json
{
  "status": "success",
  "chain": "solana",
  "pair": "PUMP/USDC",
  "timeframe": "1m",
  "total_candles": 1000,
  "data": [
    {
      "timestamp": 1670000000,
      "open": 0.0042,
      "high": 0.0048,
      "low": 0.0040,
      "close": 0.0047,
      "volume": 125000.50,
      "volume_quote": 500.25,
      "trades": 2543
    },
    ...
  ]
}
```

**Backend Implementation:**

```python
# backend/routes/market_data.py
from fastapi import APIRouter, Query
from datetime import datetime
from sqlalchemy import select

router = APIRouter(prefix="/api/yuki/market", tags=["market_data"])

@router.get("/ohlcv/{chain}/{pair}/{timeframe}")
async def get_ohlcv(
    chain: str,
    pair: str,
    timeframe: str,
    from_ts: int = Query(None, alias="from"),
    to_ts: int = Query(None, alias="to"),
    limit: int = Query(1000, le=1000)
):
    """
    Get historical OHLCV data for backtesting
    """
    
    from_dt = datetime.fromtimestamp(from_ts) if from_ts else datetime.now() - timedelta(days=7)
    to_dt = datetime.fromtimestamp(to_ts) if to_ts else datetime.now()
    
    # Query from database/cache
    candles = await db.candles.find({
        'chain': chain,
        'pair': pair,
        'timeframe': timeframe,
        'timestamp': {'$gte': from_dt, '$lte': to_dt}
    }).limit(limit).to_list(None)
    
    return {
        'status': 'success',
        'chain': chain,
        'pair': pair,
        'timeframe': timeframe,
        'total_candles': len(candles),
        'data': [
            {
                'timestamp': c['timestamp'].timestamp(),
                'open': c['open'],
                'high': c['high'],
                'low': c['low'],
                'close': c['close'],
                'volume': c['volume'],
                'volume_quote': c['volume_quote'],
                'trades': c['trades_count']
            }
            for c in candles
        ]
    }
```

**Data Collection Sources:**

```python
# backend/data_collection/sources.py

class DataCollector:
    def __init__(self):
        self.ccxt = ccxt.binance()  # CEX data
        self.dexscreener = DexscreenerClient()  # DEX data
    
    def collect_cex_ohlcv(self, exchange: str, pair: str, timeframe: str):
        """Collect from CEX via CCXT"""
        ex = getattr(ccxt, exchange)()
        ohlcv = ex.fetch_ohlcv(pair, timeframe)
        return ohlcv
    
    def collect_dex_ohlcv(self, chain: str, pair_address: str, timeframe: str):
        """Collect from DEX via DexScreener"""
        pair_data = self.dexscreener.get_pair(chain, pair_address)
        # Parse and resample to desired timeframe
        return self.resample_to_timeframe(pair_data, timeframe)
    
    def sync_all_pairs(self):
        """Run continuously to update OHLCV database"""
        while True:
            # Update CEX pairs
            for exchange in ['binance', 'coinbase', 'kraken']:
                for pair in TRACKED_PAIRS:
                    ohlcv = self.collect_cex_ohlcv(exchange, pair, '1m')
                    db.candles.insert_many(ohlcv)
            
            # Update DEX pairs
            for chain in ['solana', 'ethereum', 'base']:
                for token_addr in TRACKED_TOKENS:
                    ohlcv = self.collect_dex_ohlcv(chain, token_addr, '1m')
                    db.candles.insert_many(ohlcv)
            
            time.sleep(60)  # Update every minute
```

---

## DexScreener Integration

### Official DexScreener API

**Documentation:** https://docs.dexscreener.com/api/reference

**Rate Limits:**
- Search: 60 req/min
- Pair data: 300 req/min
- Token data: 60 req/min

**Key Endpoints:**

```
GET /latest/dex/pairs/{chainId}/{pairAddresses}
  → Pair data (price, liquidity, volume, volume_24h, txns_24h, FDV, MC)

GET /token-pairs/v1/{chainId}/{tokenAddress}
  → All pairs for a specific token

GET /latest/dex/search?q=query
  → Search pairs by token name/address

GET /token-profiles/latest/v1
  → Token metadata (name, symbol, description, socials)
```

### Recommended Python Client

**Best Option: `nixonjoshua98/dexscreener`**

```python
# pip install dexscreener
from dexscreener import DexscreenerClient

client = DexscreenerClient()

# Search for pairs
results = client.search_pairs("PUMP")
# Returns: [Pair, Pair, Pair]

# Get specific pair
pair = client.get_token_pair("solana", "EPjFWaJsJgmJXVmwLpyHYvhkZ7GcyH6qoLU4BRCwEZnQ")
print(pair.price_usd, pair.liquidity, pair.volume_24h)

# Get all pairs for a token
pairs = client.get_token_pairs("solana", "EPjFWaJsJgmJXVmwLpyHYvhkZ7GcyH6qoLU4BRCwEZnQ")
```

### Yuki Backend Integration

```python
# backend/dexscreener_integration.py
from dexscreener import DexscreenerClient, DexscreenerError
from typing import List, Dict
import asyncio

class DexScreenerIntegration:
    def __init__(self, cache_ttl_seconds: int = 300):
        self.client = DexscreenerClient()
        self.cache = {}
        self.cache_ttl = cache_ttl_seconds
    
    async def search_trending_pairs(self, chain: str = "solana", 
                                    min_liquidity: float = 10000,
                                    min_volume_24h: float = 50000) -> List[Dict]:
        """
        Find trending pairs matching criteria
        
        Returns:
            [
                {
                    'address': '...',
                    'name': 'PUMP Token',
                    'symbol': 'PUMP',
                    'chain': 'solana',
                    'dex': 'Raydium',
                    'price': 0.0042,
                    'liquidity': 125000,
                    'volume_24h': 500000,
                    'price_change_24h': 45.2,
                    'transactions_24h': 5234,
                    'fdv': 4200000,
                    'fdv_rank': 234
                },
                ...
            ]
        """
        
        try:
            # Use search to find potential pairs
            results = self.client.search_pairs("*")  # All pairs
            
            filtered = []
            for pair in results:
                if (pair.chain_id == chain and 
                    pair.liquidity_usd >= min_liquidity and
                    pair.volume_24h >= min_volume_24h):
                    
                    filtered.append({
                        'address': pair.pair_address,
                        'name': pair.base_token.name,
                        'symbol': pair.base_token.symbol,
                        'chain': pair.chain_id,
                        'dex': pair.dex.display_name,
                        'price': pair.price_usd,
                        'liquidity': pair.liquidity_usd,
                        'volume_24h': pair.volume_usd_24h,
                        'price_change_24h': pair.price_change_percent_24h,
                        'transactions_24h': pair.transactions_24h.buys + pair.transactions_24h.sells,
                        'fdv': pair.market_cap,
                        'fdv_rank': pair.fdv_rank if hasattr(pair, 'fdv_rank') else None
                    })
            
            return sorted(filtered, key=lambda x: x['volume_24h'], reverse=True)[:50]
            
        except DexscreenerError as e:
            return {"error": str(e)}
    
    async def get_pair_details(self, chain: str, pair_address: str) -> Dict:
        """
        Get detailed information for a specific pair
        """
        try:
            pair = self.client.get_token_pair(chain, pair_address)
            
            return {
                'status': 'success',
                'pair': {
                    'address': pair.pair_address,
                    'token': {
                        'address': pair.base_token.address,
                        'name': pair.base_token.name,
                        'symbol': pair.base_token.symbol,
                        'decimals': pair.base_token.decimals,
                    },
                    'quote_token': {
                        'address': pair.quote_token.address,
                        'symbol': pair.quote_token.symbol,
                    },
                    'dex': {
                        'name': pair.dex.display_name,
                        'chain': pair.chain_id
                    },
                    'price': pair.price_usd,
                    'liquidity': pair.liquidity_usd,
                    'volume_24h': pair.volume_usd_24h,
                    'price_change': {
                        '1h': pair.price_change_percent_1h,
                        '6h': pair.price_change_percent_6h,
                        '24h': pair.price_change_percent_24h,
                    },
                    'transactions_24h': {
                        'buys': pair.transactions_24h.buys,
                        'sells': pair.transactions_24h.sells,
                    },
                    'market_cap': pair.market_cap,
                    'fully_diluted_valuation': pair.fdv,
                    'holders': pair.token_holders if hasattr(pair, 'token_holders') else None,
                }
            }
        except DexscreenerError as e:
            return {'status': 'error', 'error': str(e)}
    
    async def get_token_pairs(self, chain: str, token_address: str) -> List[Dict]:
        """
        Get all trading pairs for a specific token
        """
        try:
            pairs = self.client.get_token_pairs(chain, token_address)
            
            return [{
                'address': p.pair_address,
                'dex': p.dex.display_name,
                'quote_symbol': p.quote_token.symbol,
                'price': p.price_usd,
                'liquidity': p.liquidity_usd,
                'volume_24h': p.volume_usd_24h,
                'transactions_24h': p.transactions_24h.buys + p.transactions_24h.sells,
            } for p in pairs]
        except DexscreenerError as e:
            return []
```

**API Endpoints:**

```python
# backend/routes/dexscreener.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/yuki/dexscreener", tags=["dexscreener"])

@router.get("/search/trending")
async def search_trending(chain: str = "solana", 
                         min_liquidity: float = 10000,
                         min_volume_24h: float = 50000):
    """Find trending pairs on DEX"""
    ds = DexScreenerIntegration()
    return await ds.search_trending_pairs(chain, min_liquidity, min_volume_24h)

@router.get("/pairs/{chain}/{pair_address}")
async def get_pair(chain: str, pair_address: str):
    """Get detailed pair information"""
    ds = DexScreenerIntegration()
    return await ds.get_pair_details(chain, pair_address)

@router.get("/tokens/{chain}/{token_address}/pairs")
async def get_token_pairs(chain: str, token_address: str):
    """Get all pairs for a token"""
    ds = DexScreenerIntegration()
    return await ds.get_token_pairs(chain, token_address)
```

---

## Signal Webhook Ecosystem

### Signal Format (Standard)

```json
{
  "signal_id": "arb_uuid_here",
  "timestamp": 1707000000,
  "strategy": "my_meme_sniper_v2",
  "action": "long|short|close|tp1|tp2|tp3",
  
  "market": {
    "chain": "solana",
    "dex": "raydium",
    "pair": "PUMP/USDC",
    "pair_address": "0x123...",
    "token_address": "0xabc...",
    "quote_token": "USDC"
  },
  
  "pricing": {
    "entry_price": 0.0042,
    "current_price": 0.0041,
    "take_profit_targets": [0.0048, 0.0055, 0.0065],
    "stop_loss": 0.0039,
    "risk_reward": 2.5
  },
  
  "sizing": {
    "position_size_usd": 100,
    "position_size_pct": 5,
    "leverage": 1,
    "max_loss_usd": 5
  },
  
  "confidence": {
    "score": 0.87,
    "indicators": [
      "volume_spike_2x",
      "rsi_oversold",
      "macd_bullish_cross"
    ]
  },
  
  "metadata": {
    "pair_age_hours": 2.5,
    "liquidity_usd": 125000,
    "volume_24h": 500000,
    "trades_24h": 5234,
    "reason": "Volume spike (2x MA) + RSI oversold + MACD bullish"
  }
}
```

### Telegram Signal Broadcasting

```python
# backend/signal_dispatcher/telegram.py
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError
import asyncio

class TelegramSignalBroadcaster:
    def __init__(self, bot_token: str, channel_id: str):
        self.bot = Bot(token=bot_token)
        self.channel_id = channel_id
    
    async def broadcast_signal(self, signal: dict):
        """
        Send formatted signal to Telegram channel
        """
        
        action = signal['action'].upper()
        emoji_action = {
            'LONG': '🟢 LONG',
            'SHORT': '🔴 SHORT',
            'CLOSE': '❌ CLOSE',
            'TP1': '✅ TP1',
            'TP2': '✅ TP2',
        }.get(action, action)
        
        message = f"""
{emoji_action} **{signal['market']['pair']}** on {signal['market']['dex']}

**Strategy:** {signal['strategy']}
**Confidence:** {signal['confidence']['score']:.0%}

**Pricing:**
Entry: ${signal['pricing']['entry_price']:.6f}
Target 1: ${signal['pricing']['take_profit_targets'][0]:.6f}
Target 2: ${signal['pricing']['take_profit_targets'][1]:.6f}
Stop Loss: ${signal['pricing']['stop_loss']:.6f}

**Position:**
Size: {signal['sizing']['position_size_usd']:.2f} USDC ({signal['sizing']['position_size_pct']:.1f}%)
Risk/Reward: {signal['pricing']['risk_reward']:.1f}x

**Indicators:**
{', '.join(signal['confidence']['indicators'])}

**Pair Data:**
Liquidity: ${signal['metadata']['liquidity_usd']:,.0f}
Volume 24h: ${signal['metadata']['volume_24h']:,.0f}
Age: {signal['metadata']['pair_age_hours']:.1f}h
"""
        
        # Create inline buttons
        buttons = [
            [
                InlineKeyboardButton("📊 View on DexScreener", 
                                   url=f"https://dexscreener.com/solana/{signal['market']['pair_address']}"),
                InlineKeyboardButton("⚡ Execute", 
                                   callback_data=f"exec_{signal['signal_id']}")
            ]
        ]
        
        reply_markup = InlineKeyboardMarkup(buttons)
        
        try:
            await self.bot.send_message(
                chat_id=self.channel_id,
                text=message,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        except TelegramError as e:
            print(f"Telegram error: {e}")
```

### REST Webhook Endpoint

```python
# backend/routes/signals.py
from fastapi import APIRouter, HTTPException, Header

router = APIRouter(prefix="/api/yuki/signals", tags=["signals"])

@router.post("")
async def receive_signal(signal: dict, x_api_key: str = Header(None)):
    """
    Receive signal from strategy → broadcast to Telegram + notify users
    """
    
    # Validate API key
    if not x_api_key or not verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Validate signal format
    required_fields = ['signal_id', 'action', 'market', 'pricing', 'confidence']
    if not all(field in signal for field in required_fields):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # 1. Store signal in database
    signal_doc = {
        **signal,
        'received_at': datetime.now(),
        'status': 'broadcasted'
    }
    await db.signals.insert_one(signal_doc)
    
    # 2. Broadcast to Telegram
    broadcaster = TelegramSignalBroadcaster(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID)
    await broadcaster.broadcast_signal(signal)
    
    # 3. Notify subscribed users via WebSocket
    for user_id in get_signal_subscribers(signal['strategy']):
        await notify_user(user_id, signal)
    
    # 4. Log for analytics
    await log_signal_event(signal)
    
    return {
        'status': 'success',
        'signal_id': signal['signal_id'],
        'broadcasted_at': datetime.now().isoformat()
    }

@router.get("/history")
async def get_signal_history(strategy_id: str = None, limit: int = 100):
    """Get signal history for analysis"""
    
    query = {}
    if strategy_id:
        query['strategy'] = strategy_id
    
    signals = await db.signals.find(query).sort('timestamp', -1).limit(limit).to_list(None)
    
    return {
        'total': len(signals),
        'signals': signals
    }
```

### Community Signal Bots

**Example: Simple Python Bot (< 50 lines)**

```python
# external_bot.py
# This runs on user's machine and executes signals from Yuki

import httpx
import asyncio
import json

class YukiSignalExecutor:
    def __init__(self, yuki_webhook_url: str, exchange_key: str, exchange_secret: str):
        self.webhook_url = yuki_webhook_url
        self.exchange = ccxt.raydium({'apiKey': exchange_key, 'secret': exchange_secret})
    
    async def listen_for_signals(self):
        """
        Poll for new signals and execute trades
        """
        while True:
            async with httpx.AsyncClient() as client:
                # Get latest signals
                response = await client.get(f"{self.webhook_url}/api/yuki/signals/latest")
                signals = response.json()
                
                for signal in signals:
                    if signal['status'] == 'pending_execution':
                        await self.execute_signal(signal)
            
            await asyncio.sleep(5)  # Check every 5 seconds
    
    async def execute_signal(self, signal: dict):
        """Execute a signal on DEX"""
        
        try:
            if signal['action'] == 'long':
                # Execute buy order
                order = await self.exchange.create_limit_buy_order(
                    symbol=signal['market']['pair'],
                    amount=signal['sizing']['position_size_usd'],
                    price=signal['pricing']['entry_price']
                )
                
                # Set stop loss and take profits
                # (implementation depends on DEX/exchange)
            
            elif signal['action'] == 'close':
                # Close position
                pass
            
            # Report back to Yuki
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.webhook_url}/api/yuki/signals/{signal['signal_id']}/executed",
                    json={'status': 'executed', 'order_id': order['id']}
                )
        
        except Exception as e:
            print(f"Execution error: {e}")

# Run it
if __name__ == '__main__':
    executor = YukiSignalExecutor(
        'https://yuki.api',
        exchange_key='...',
        exchange_secret='...'
    )
    asyncio.run(executor.listen_for_signals())
```

---

## Implementation Examples

### Full Custom Strategy Workflow

**Step 1: User Creates Strategy**

```python
# File: my_volume_breakout.py
from freqtrade.strategy import IStrategy
import talib
import pandas as pd

class VolumeBreakoutStrategy(IStrategy):
    stoploss = -0.05
    timeframe = "5m"
    
    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['volume_ma'] = dataframe['volume'].rolling(20).mean()
        dataframe['rsi'] = talib.RSI(dataframe['close'], 14)
        return dataframe
    
    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[(dataframe['volume'] > dataframe['volume_ma'] * 2) & (dataframe['rsi'] < 30), 'enter_long'] = 1
        return dataframe
    
    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[dataframe['rsi'] > 70, 'exit_long'] = 1
        return dataframe
```

**Step 2: Upload to Yuki**

```bash
curl -X POST http://localhost:8000/api/yuki/strategies/custom/upload \
  -H "Authorization: Bearer USER_TOKEN" \
  -F "file=@my_volume_breakout.py"

# Response:
# { "status": "success", "strategy_id": "strat_abc123" }
```

**Step 3: Backtest**

```bash
curl -X POST http://localhost:8000/api/yuki/strategies/custom/strat_abc123/backtest \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timerange": "20230101-20240101",
    "stake_amount": 100
  }'

# Response:
# {
#   "status": "success",
#   "results": {
#     "total_profit_pct": 45.2,
#     "total_trades": 87,
#     "win_rate": 59.8,
#     "sharpe_ratio": 1.45,
#     "max_drawdown_pct": 12.3
#   }
# }
```

**Step 4: Hyperoptimize (Find Best Parameters)**

```bash
curl -X POST http://localhost:8000/api/yuki/strategies/custom/strat_abc123/hyperopt \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{"n_epochs": 100, "timerange": "20230101-20240101"}'

# Returns best parameters for your strategy
```

**Step 5: Deploy Live**

```bash
curl -X POST http://localhost:8000/api/yuki/strategies/custom/strat_abc123/deploy \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{
    "mode": "live",
    "paper_trade": false,
    "initial_balance": 1000,
    "max_open_trades": 3
  }'
```

**Step 6: Signal Webhook (Your Strategy Sends Signals)**

```python
# Your strategy backend detects signal → sends to Yuki webhook

import httpx

signal_payload = {
    "signal_id": "sig_uuid_here",
    "strategy": "VolumeBreakoutStrategy",
    "action": "long",
    "market": {
        "chain": "solana",
        "dex": "raydium",
        "pair": "PUMP/USDC",
        "pair_address": "0x123..."
    },
    "pricing": {
        "entry_price": 0.0042,
        "take_profit_targets": [0.0048, 0.0055],
        "stop_loss": 0.0039
    },
    "sizing": {
        "position_size_usd": 100,
        "position_size_pct": 5
    },
    "confidence": {
        "score": 0.87,
        "indicators": ["volume_spike_2x", "rsi_oversold"]
    }
}

async with httpx.AsyncClient() as client:
    response = await client.post(
        "https://yuki.api/api/yuki/signals",
        json=signal_payload,
        headers={"X-API-Key": "your_api_key"}
    )
```

---

## Security & Sandboxing

### Secure Strategy Execution

**Threat Model:**

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| Malicious code (crypto stealer) | HIGH | Docker sandbox + no private key access |
| Infinite loop | MEDIUM | 30s timeout + CPU limits |
| Memory bomb | MEDIUM | 1GB RAM limit |
| External HTTP requests | MEDIUM | Whitelist DexScreener + data API only |
| File access | HIGH | Read-only volumes |

**Implementation:**

```python
# backend/sandbox/strategy_executor.py
import docker
import json
import tempfile
from pathlib import Path

class SecureStrategyExecutor:
    def __init__(self):
        self.client = docker.from_env()
        self.allowed_imports = {
            'pandas', 'numpy', 'talib', 'pandas_ta',  # Data analysis
            'json', 'datetime',  # Standard lib
            'httpx'  # HTTP (whitelisted endpoints only)
        }
    
    def validate_strategy_code(self, code: str) -> tuple[bool, str]:
        """
        Statically check strategy for unsafe operations
        """
        unsafe_patterns = [
            'import socket',  # Network
            'import subprocess',  # Execute commands
            'open(',  # File access
            'eval',  # Code execution
            '__import__',  # Dynamic imports
            'exec(',  # Code execution
        ]
        
        for pattern in unsafe_patterns:
            if pattern in code:
                return False, f"Unsafe operation detected: {pattern}"
        
        return True, "Valid"
    
    def execute_backtest(self, strategy_code: str, config: dict) -> dict:
        """
        Run backtest in isolated Docker container
        """
        
        # 1. Validate code
        is_valid, reason = self.validate_strategy_code(strategy_code)
        if not is_valid:
            return {'status': 'error', 'error': reason}
        
        # 2. Create sandbox
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            
            # Write strategy (read-only)
            (tmpdir / 'strategy.py').write_text(strategy_code)
            (tmpdir / 'config.json').write_text(json.dumps(config))
            
            # 3. Run in Docker
            try:
                container = self.client.containers.run(
                    image='python:3.11-slim',
                    command=['python', '-c', self._get_runner_script()],
                    volumes={
                        str(tmpdir): {'bind': '/app', 'mode': 'ro'}  # READ ONLY
                    },
                    mem_limit='1g',  # 1GB RAM limit
                    cpus=1,  # 1 CPU max
                    timeout=30,  # 30 second timeout
                    remove=True,
                    capture_output=True,
                    text=True
                )
                
                results = json.loads(container.stdout)
                return {'status': 'success', 'results': results}
                
            except docker.errors.ContainerError as e:
                return {
                    'status': 'error',
                    'error': 'Strategy execution failed',
                    'details': e.stderr.decode()[:500]  # Truncate error
                }
    
    def _get_runner_script(self) -> str:
        """Isolated backtest runner"""
        return """
import sys
sys.path.insert(0, '/app')
import json
from strategy import MyStrategy
from config import CONFIG

# Run backtest with timeouts
try:
    results = run_backtest(MyStrategy, CONFIG)
    print(json.dumps({'status': 'success', 'results': results}))
except Exception as e:
    print(json.dumps({'status': 'error', 'error': str(e)[:200]}))
"""
```

### API Authentication

```python
# backend/auth/api_keys.py
from fastapi import HTTPException, Depends, Header
from sqlalchemy import select

async def verify_api_key(x_api_key: str = Header(None)):
    """Validate API key for custom strategy endpoints"""
    
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    # Check database
    api_key = await db.api_keys.find_one({'key': x_api_key})
    
    if not api_key or not api_key['active']:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Rate limiting
    if api_key.get('rate_limit_remaining', 0) <= 0:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Update usage
    await db.api_keys.update_one(
        {'key': x_api_key},
        {'$inc': {'rate_limit_remaining': -1}, '$set': {'last_used': datetime.now()}}
    )
    
    return api_key
```

---

## Deployment Checklist

**Phase 1C Extension (Advanced Features)**

- [ ] Docker environment for sandboxing
- [ ] Freqtrade installation and testing
- [ ] Historical OHLCV data collection
- [ ] DexScreener API integration
- [ ] Strategy upload endpoint
- [ ] Backtest endpoint
- [ ] Hyperopt endpoint
- [ ] Signal webhook endpoint
- [ ] Telegram bot integration
- [ ] API key management
- [ ] Rate limiting
- [ ] Error handling & logging
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation

**Testing Checklist:**

- [ ] Freqtrade strategy upload
- [ ] Syntax validation
- [ ] Backtest execution (5 year timeframe)
- [ ] Hyperopt optimization (100 epochs)
- [ ] Webhook signal delivery
- [ ] Telegram formatting
- [ ] External bot webhook consumption
- [ ] Rate limiting enforcement
- [ ] Timeout handling (30s)
- [ ] Memory limits (1GB)

---

## Next Steps

1. **Week 1:** Implement core custom strategy upload + Freqtrade integration
2. **Week 2:** Build backtesting data API + historical data collection
3. **Week 3:** Add DexScreener search + pair discovery
4. **Week 4:** Signal webhook + Telegram broadcasting
5. **Week 5:** Community bot examples + documentation

---

**Generated:** February 3, 2026  
**Status:** Ready for Development  
**Priority:** High (Power User Feature)

