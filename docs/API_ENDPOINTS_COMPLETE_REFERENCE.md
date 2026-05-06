# API Endpoints Quick Reference - ALL 14 Endpoints

**Base URL**: `http://localhost:5000`  
**Start Command**: `npm run dev`  
**Status**: ✅ Production Ready

---

## DexScreener API (8 Endpoints)

### Health Check
```bash
GET /api/dex/health
```

### Search Tokens
```bash
GET /api/dex/search-pairs?q=ETH&limit=20
# Returns: List of token pairs matching search
```

### Get Pair Details
```bash
GET /api/dex/pairs/{chain}/{address}
# Example: /api/dex/pairs/ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# Returns: Detailed pair info (price, liquidity, volume, holders)
```

### Get Token Pairs (All Pairs for a Token)
```bash
GET /api/dex/token-pairs/{chain}/{address}
# Example: /api/dex/token-pairs/ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# Returns: All trading pairs for this token across DEXes
```

### Get Trending Pairs
```bash
GET /api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&limit=10
# Returns: Top trending pairs by volume/buys
```

### Trigger Symbol Universe Sync
```bash
POST /api/dex/symbol-universe/sync
# Returns: Discovery job status
```

### Get Cache Statistics
```bash
GET /api/dex/cache/stats
# Returns: {hits, misses, size, ttl}
```

### Clear Cache
```bash
DELETE /api/dex/cache/clear
# Returns: {cleared: true, timestamp}
```

---

## Freqtrade API (6 Endpoints)

### List All Strategies
```bash
GET /api/freqtrade/strategies
# Returns: [{id, name, status, performance}, ...]
```

### Upload New Strategy
```bash
POST /api/freqtrade/strategies/upload
Content-Type: application/json

{
  "name": "SuperStrat",
  "code": "# Python strategy code...",
  "description": "A super strategy"
}
# Returns: {id, uploaded_at, status: "pending_validation"}
```

### Run Backtest
```bash
POST /api/freqtrade/strategies/{strategyId}/backtest
Content-Type: application/json

{
  "data_path": "data/",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "pairs": ["BTC/USDT", "ETH/USDT"]
}
# Returns: {backtest_id, status, profit, sharpe_ratio, ...}
```

### Hyperparameter Optimization
```bash
POST /api/freqtrade/strategies/{strategyId}/hyperopt
Content-Type: application/json

{
  "data_path": "data/",
  "epochs": 100,
  "spaces": ["buy", "sell", "roi", "stoploss"]
}
# Returns: {hyperopt_id, status, best_params, best_profit}
```

### Get Strategy Performance
```bash
GET /api/freqtrade/strategies/{strategyId}/performance
# Returns: {
#   current_profit: 15.5,
#   total_trades: 245,
#   win_rate: 63.3,
#   sharpe_ratio: 1.42,
#   max_drawdown: 8.5
# }
```

### Deploy Strategy
```bash
POST /api/freqtrade/strategies/{strategyId}/deploy
Content-Type: application/json

{
  "mode": "dry_run",  # or "live"
  "stake_currency": "USDT",
  "stake_amount": 100
}
# Returns: {status: "deployed", deployment_id, live_at}
```

---

## System Endpoints (For Monitoring)

### Liveness Check
```bash
GET /health
# Returns: {status: "ok"}
```

### Status with Details
```bash
GET /status
# Returns: {
#   uptime: 123456,
#   timestamp: "2024-01-01T00:00:00Z",
#   environment: "development"
# }
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/dex/health | Unlimited | - |
| /api/dex/search-pairs | 60 | 1 min |
| /api/dex/pairs/{chain}/{address} | 300 | 1 min |
| /api/dex/trending-pairs | 30 | 1 min |
| /api/dex/symbol-universe/sync | 1 | 1 min |
| /api/dex/cache/* | 100 | 1 min |
| /api/freqtrade/strategies (GET) | 100 | 1 min |
| /api/freqtrade/strategies (POST) | 10 | 1 min |
| /api/freqtrade/{id}/backtest | 5 | 1 min |
| /api/freqtrade/{id}/hyperopt | 2 | 1 min |
| /api/freqtrade/{id}/deploy | 3 | 1 min |
| /api/freqtrade/{id}/performance | 100 | 1 min |

### Bypass Rate Limits
```bash
curl -H "Authorization: Bearer <admin_jwt_token>" \
  http://localhost:5000/api/dex/search-pairs?q=ETH
```

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Response (400, 429, 500)
```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Rate Limit Response (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Testing with cURL Examples

### DexScreener Examples
```bash
# Search for ETH
curl http://localhost:5000/api/dex/search-pairs?q=ETH

# Get USDC details
curl http://localhost:5000/api/dex/pairs/ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Get trending pairs on Ethereum
curl http://localhost:5000/api/dex/trending-pairs?chain=ethereum

# Check cache stats
curl http://localhost:5000/api/dex/cache/stats
```

### Freqtrade Examples
```bash
# List strategies
curl http://localhost:5000/api/freqtrade/strategies

# Upload strategy
curl -X POST http://localhost:5000/api/freqtrade/strategies/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyStrategy",
    "code": "...",
    "description": "Test strategy"
  }'

# Run backtest
curl -X POST http://localhost:5000/api/freqtrade/strategies/strategy_1/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }'

# Deploy strategy
curl -X POST http://localhost:5000/api/freqtrade/strategies/strategy_1/deploy \
  -H "Content-Type: application/json" \
  -d '{"mode": "dry_run"}'
```

---

## WebSocket Endpoints (Coming Soon)

```
ws://localhost:5000/ws/pairs/{chain}/{address}
  Receives: Price updates, volume data, holder changes

ws://localhost:5000/ws/strategies/{id}
  Receives: Strategy signals, backtest progress, performance updates
```

---

## Integration Points

### DexScreener in NURU Agent
```typescript
// Use DexScreener to find trending opportunities
const response = await fetch('http://localhost:5000/api/dex/trending-pairs?chain=ethereum');
const trendingPairs = await response.json();
```

### Freqtrade in Strategy Execution
```typescript
// Run backtest before deploying
const backtestResponse = await fetch(
  'http://localhost:5000/api/freqtrade/strategies/my-strat/backtest',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: '2024-01-01', end_date: '2024-12-31' })
  }
);
```

---

## Documentation Links

- **Quick Start**: [API_BACKEND_QUICK_START.md](./API_BACKEND_QUICK_START.md)
- **Full Reference**: [API_BACKEND_ENDPOINTS.md](./API_BACKEND_ENDPOINTS.md)
- **Complete Guide**: [API_BACKEND_COMPLETE.md](./API_BACKEND_COMPLETE.md)
- **Integration Status**: [API_INTEGRATION_COMPLETE.md](./API_INTEGRATION_COMPLETE.md)

---

## Startup

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

All 14 endpoints will be available immediately at `http://localhost:5000/api/*`

