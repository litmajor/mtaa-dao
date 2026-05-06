# API Documentation - Yuki Trading Platform

**Version:** 1.0.0  
**Date:** February 3, 2026  
**Base URL:** `https://api.yuki.trading`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Strategies API](#strategies-api)
3. [Backtesting API](#backtesting-api)
4. [Historical Data API](#historical-data-api)
5. [Signals API](#signals-api)
6. [Trades API](#trades-api)
7. [Portfolio API](#portfolio-api)
8. [Error Handling](#error-handling)

---

## Authentication

### API Key Management

All requests require an `X-API-Key` header:

```bash
curl -H "X-API-Key: your_api_key_here" https://api.yuki.trading/api/yuki/strategies
```

### Generate API Key

```
POST /api/auth/api-keys
```

**Request:**
```json
{
  "name": "My App",
  "scopes": ["strategies:read", "strategies:write", "signals:read"]
}
```

**Response:**
```json
{
  "api_key": "yk_abc123def456...",
  "created_at": "2026-02-03T12:00:00Z",
  "scopes": ["strategies:read", "strategies:write", "signals:read"],
  "rate_limit_per_minute": 60
}
```

### Rate Limiting

- **Free tier:** 60 requests/minute
- **Pro tier:** 300 requests/minute  
- **Enterprise:** Custom

Rate limit info in response headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1707000000
```

---

## Strategies API

### Upload Strategy (Python)

```
POST /api/yuki/strategies/upload
```

**Supported Languages:**
- `python` - Freqtrade format (recommended)
- `typescript` - TypeScript with IStrategy interface
- `javascript` - ES6+ modules

**Request:**
```bash
curl -X POST https://api.yuki.trading/api/yuki/strategies/upload \
  -H "X-API-Key: your_api_key" \
  -F "file=@my_strategy.py" \
  -F "language=python"
```

**Response:**
```json
{
  "status": "success",
  "strategy_id": "strat_abc123",
  "validation": {
    "is_valid": true,
    "syntax_errors": [],
    "warnings": []
  },
  "metadata": {
    "name": "My Volume Breakout Strategy",
    "author": "Your Name",
    "version": "1.0.0",
    "tags": ["volume", "momentum"]
  }
}
```

### Upload Strategy (TypeScript)

```
POST /api/yuki/strategies/upload
```

**Request:**
```bash
curl -X POST https://api.yuki.trading/api/yuki/strategies/upload \
  -H "X-API-Key: your_api_key" \
  -F "file=@my_strategy.ts" \
  -F "language=typescript"
```

**Response:**
```json
{
  "status": "success",
  "strategy_id": "strat_abc123",
  "compiled": {
    "language_compiled_to": "javascript",
    "compiler_version": "4.9.5"
  },
  "validation": {
    "is_valid": true,
    "syntax_errors": [],
    "compiled_errors": []
  },
  "extracted_parameters": [
    {
      "name": "rsiPeriod",
      "type": "float",
      "default_value": 14,
      "min_value": 7,
      "max_value": 21,
      "step": 1
    }
  ]
}
```

### List Strategies

```
GET /api/yuki/strategies?skip=0&limit=20&status=live
```

**Query Parameters:**
- `skip` - Pagination offset (default: 0)
- `limit` - Max results (default: 20, max: 100)
- `status` - Filter: `draft`, `validated`, `live`, `paused`
- `language` - Filter: `python`, `typescript`, `javascript`

**Response:**
```json
{
  "total": 5,
  "strategies": [
    {
      "id": "strat_abc123",
      "name": "My Volume Breakout",
      "language": "python",
      "status": "live",
      "created_at": "2026-02-01T10:00:00Z",
      "is_live": true,
      "live_deployed_at": "2026-02-02T08:00:00Z",
      "live_total_profit_usd": 1250.50,
      "live_total_trades": 42
    }
  ]
}
```

### Get Strategy Details

```
GET /api/yuki/strategies/{strategy_id}
```

**Response:**
```json
{
  "id": "strat_abc123",
  "name": "My Volume Breakout",
  "description": "Volume spike detection with RSI confirmation",
  "language": "python",
  "status": "live",
  "is_live": true,
  "code": "# Full strategy code here...",
  "metadata": {
    "author": "Your Name",
    "version": "1.0.0",
    "tags": ["volume", "momentum"]
  },
  "parameters": [
    {
      "name": "volume_multiplier",
      "type": "float",
      "default_value": 2.0,
      "min_value": 1.0,
      "max_value": 5.0
    }
  ],
  "last_backtest": {
    "total_profit_pct": 45.2,
    "total_trades": 87,
    "win_rate": 59.8,
    "sharpe_ratio": 1.45,
    "max_drawdown_pct": 12.3,
    "executed_at": "2026-02-03T10:00:00Z"
  },
  "best_parameters": {
    "volume_multiplier": 2.3,
    "rsi_period": 15
  },
  "created_at": "2026-02-01T10:00:00Z"
}
```

### Update Strategy

```
PUT /api/yuki/strategies/{strategy_id}
```

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "parameters": [
    {
      "name": "volume_multiplier",
      "value": 2.5
    }
  ]
}
```

### Delete Strategy

```
DELETE /api/yuki/strategies/{strategy_id}
```

---

## Backtesting API

### Start Backtest

```
POST /api/yuki/strategies/{strategy_id}/backtest
```

**Request:**
```json
{
  "timerange": "20230101-20240101",
  "stake_amount": 100,
  "dry_run": true,
  "margin_mode": "spot"
}
```

**Response:**
```json
{
  "backtest_id": "bt_xyz789",
  "status": "queued",
  "estimated_completion": 30
}
```

### Get Backtest Results

```
GET /api/yuki/strategies/{strategy_id}/backtest/{backtest_id}
```

**Response:**
```json
{
  "backtest_id": "bt_xyz789",
  "status": "completed",
  "results": {
    "total_profit_pct": 45.2,
    "total_profit_usd": 4520,
    "total_trades": 87,
    "winning_trades": 52,
    "losing_trades": 35,
    "win_rate": 59.8,
    "avg_profit_per_trade": 0.68,
    "sharpe_ratio": 1.45,
    "sortino_ratio": 1.89,
    "max_drawdown_pct": 12.3,
    "recovery_factor": 3.67,
    "profit_factor": 1.95,
    "expectancy": 0.52,
    "calmar_ratio": 3.68,
    "start_balance_usd": 10000,
    "end_balance_usd": 14520,
    "buy_and_hold_return_pct": 23.5,
    "execution_time_seconds": 12.5,
    "total_candles_processed": 252000,
    "trades": [
      {
        "entry_time": "2023-01-15T10:30:00Z",
        "exit_time": "2023-01-15T14:45:00Z",
        "entry_price": 42000,
        "exit_price": 42500,
        "profit_pct": 1.19,
        "profit_usd": 119,
        "reason": "Exit signal"
      }
    ]
  },
  "executed_at": "2026-02-03T12:30:00Z"
}
```

### Hyperparameter Optimization

```
POST /api/yuki/strategies/{strategy_id}/hyperopt
```

**Request:**
```json
{
  "n_epochs": 100,
  "timerange": "20230101-20240101",
  "stake_amount": 100,
  "loss_function": "sharpe"
}
```

**Response:**
```json
{
  "hyperopt_id": "ho_abc123",
  "status": "running",
  "progress": {
    "completed_epochs": 25,
    "total_epochs": 100,
    "estimated_remaining_seconds": 450
  }
}
```

### Get Hyperopt Results

```
GET /api/yuki/strategies/{strategy_id}/hyperopt/{hyperopt_id}
```

**Response:**
```json
{
  "hyperopt_id": "ho_abc123",
  "status": "completed",
  "best_parameters": {
    "rsi_period": 15,
    "volume_multiplier": 2.3,
    "macd_fast": 11,
    "macd_slow": 27
  },
  "best_score": 1.67,
  "epochs_completed": 100,
  "execution_time_seconds": 1250,
  "top_10_results": [
    {
      "rank": 1,
      "parameters": { "rsi_period": 15, "volume_multiplier": 2.3 },
      "score": 1.67,
      "sharpe_ratio": 1.89,
      "win_rate": 62.3
    }
  ]
}
```

---

## Historical Data API

### Get OHLCV Data

```
GET /api/yuki/market/ohlcv/{chain}/{pair}/{timeframe}?from=timestamp&to=timestamp&limit=1000
```

**Path Parameters:**
- `chain` - `solana`, `ethereum`, `base`, `bsc`, `polygon`, `arbitrum`
- `pair` - `SOL/USDC`, `PUMP/USDC`, `ETH/USDC`
- `timeframe` - `1m`, `5m`, `15m`, `1h`, `4h`, `1d`

**Query Parameters:**
- `from` - Unix timestamp (start)
- `to` - Unix timestamp (end)
- `limit` - Max 1000 per request

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
    }
  ]
}
```

### Get Latest Candles

```
GET /api/yuki/market/ohlcv/{chain}/{pair}/{timeframe}/latest?limit=500
```

**Response:**
```json
{
  "status": "success",
  "chain": "solana",
  "pair": "SOL/USDC",
  "timeframe": "1m",
  "latest_candles": [...]
}
```

---

## Signals API

### Create Signal (From Strategy)

```
POST /api/yuki/signals
```

**Header:**
```
X-API-Key: your_api_key
```

**Request:**
```json
{
  "signal_id": "sig_uuid_here",
  "strategy": "MyVolumeBreakoutStrategy",
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
    "position_size_pct": 5,
    "leverage": 1
  },
  "confidence": {
    "score": 0.87,
    "indicators": ["volume_spike_2x", "rsi_oversold"]
  },
  "metadata": {
    "pair_age_hours": 2.5,
    "liquidity_usd": 125000,
    "volume_24h": 500000,
    "reason": "Volume spike + RSI oversold"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "signal_id": "sig_uuid_here",
  "broadcasted_at": "2026-02-03T12:00:00Z",
  "telegram_sent": true,
  "webhook_sent": true
}
```

### Get Signals for Strategy

```
GET /api/yuki/strategies/{strategy_id}/signals?skip=0&limit=100&status=broadcasted
```

**Query Parameters:**
- `status` - `broadcasted`, `executed`, `expired`, `cancelled`
- `skip`, `limit` - Pagination

**Response:**
```json
{
  "total": 42,
  "signals": [
    {
      "signal_id": "sig_uuid",
      "action": "long",
      "confidence": 0.87,
      "entry_price": 0.0042,
      "take_profit_targets": [0.0048, 0.0055],
      "stop_loss": 0.0039,
      "status": "broadcasted",
      "created_at": "2026-02-03T12:00:00Z"
    }
  ]
}
```

### Get Signal Details

```
GET /api/yuki/signals/{signal_id}
```

---

## Trades API

### List Trades

```
GET /api/yuki/trades?skip=0&limit=100&status=open
```

**Query Parameters:**
- `status` - `pending`, `open`, `closed`, `failed`
- `skip`, `limit` - Pagination

**Response:**
```json
{
  "total": 15,
  "open_trades": 3,
  "closed_trades": 12,
  "trades": [
    {
      "id": "trade_abc123",
      "pair": "SOL/USDC",
      "strategy_id": "strat_xyz",
      "entry_price": 105.50,
      "entry_time": "2026-02-03T10:00:00Z",
      "status": "open",
      "profit_loss_usd": 250.75,
      "profit_loss_pct": 2.38
    }
  ]
}
```

### Close Trade

```
POST /api/yuki/trades/{trade_id}/close
```

**Request:**
```json
{
  "exit_price": 107.25,
  "exit_reason": "tp1"
}
```

---

## Portfolio API

### Get Portfolio

```
GET /api/yuki/portfolio
```

**Response:**
```json
{
  "total_balance_usd": 15000,
  "cash_balance_usd": 5000,
  "positions_value_usd": 10000,
  "unrealized_profit_loss_usd": 1500,
  "realized_profit_loss_usd": 500,
  "total_profit_loss_usd": 2000,
  "holdings": [
    {
      "symbol": "SOL",
      "amount": 50,
      "cost_basis_usd": 5000,
      "current_price_usd": 110,
      "current_value_usd": 5500,
      "profit_loss_usd": 500,
      "profit_loss_pct": 10
    }
  ]
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "INVALID_STRATEGY",
  "message": "Strategy syntax error on line 42: undefined variable 'dataframe'",
  "status_code": 400,
  "request_id": "req_abc123"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INVALID_STRATEGY` | 400 | Strategy syntax/validation error |
| `STRATEGY_NOT_FOUND` | 404 | Strategy ID doesn't exist |
| `COMPILATION_FAILED` | 400 | TypeScript/JavaScript compilation error |
| `BACKTEST_TIMEOUT` | 504 | Backtest took too long (>5min) |
| `INSUFFICIENT_DATA` | 400 | Not enough historical data for timerange |
| `INVALID_PARAMETERS` | 400 | Missing or invalid request parameters |

---

## Code Examples

### Python - Upload and Backtest

```python
import requests
import json

API_KEY = "your_api_key"
BASE_URL = "https://api.yuki.trading"

headers = {"X-API-Key": API_KEY}

# 1. Upload strategy
with open("my_strategy.py", "r") as f:
    files = {"file": f}
    data = {"language": "python"}
    response = requests.post(
        f"{BASE_URL}/api/yuki/strategies/upload",
        headers=headers,
        files=files,
        data=data
    )
    strategy_id = response.json()["strategy_id"]
    print(f"Strategy uploaded: {strategy_id}")

# 2. Start backtest
backtest_payload = {
    "timerange": "20230101-20240101",
    "stake_amount": 100
}
response = requests.post(
    f"{BASE_URL}/api/yuki/strategies/{strategy_id}/backtest",
    headers=headers,
    json=backtest_payload
)
backtest_id = response.json()["backtest_id"]
print(f"Backtest started: {backtest_id}")

# 3. Get results (poll)
import time
while True:
    response = requests.get(
        f"{BASE_URL}/api/yuki/strategies/{strategy_id}/backtest/{backtest_id}",
        headers=headers
    )
    result = response.json()
    
    if result["status"] == "completed":
        print(f"Win Rate: {result['results']['win_rate']:.1f}%")
        print(f"Total Profit: {result['results']['total_profit_pct']:.1f}%")
        break
    
    time.sleep(5)
```

### JavaScript - Get Signals

```javascript
const API_KEY = "your_api_key";
const BASE_URL = "https://api.yuki.trading";

async function getSignals(strategyId) {
  const response = await fetch(
    `${BASE_URL}/api/yuki/strategies/${strategyId}/signals`,
    {
      headers: {
        "X-API-Key": API_KEY
      }
    }
  );
  
  const data = await response.json();
  return data.signals;
}
```

---

**Last Updated:** February 3, 2026

