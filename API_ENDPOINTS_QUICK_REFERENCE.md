# 🎯 API Backend - Endpoint Reference Card

**Server**: http://localhost:5000  
**Status**: ✅ Live  
**Last Updated**: February 20, 2026  

---

## 🏥 System Health

```
GET /health
├─ Rate Limit: Unlimited
├─ Auth: None
└─ Response: { status, service, uptime, apis }

GET /status
├─ Rate Limit: Unlimited
├─ Auth: None
└─ Response: { status, memory, endpoints }
```

---

## 🔍 DexScreener API (`/api/dex`)

### Search & Discovery

```
🔹 Search Pairs by Symbol
GET /api/dex/search-pairs?q=ETH&chains=ethereum&limit=50
├─ Rate: 60/min
├─ Auth: None
├─ Params: q, chains (opt), limit (opt)
└─ Returns: { pairs[], total, cached, timestamp }

🔹 Get Pair Details
GET /api/dex/pairs/{chain}/{pairAddress}
├─ Rate: 300/min
├─ Auth: None
├─ Example: /api/dex/pairs/ethereum/0x1234...
└─ Returns: { pair, liquidity, volume24h, priceChange }

🔹 Get Token Pairs
GET /api/dex/token-pairs/{chain}/{tokenAddress}?factor=txns
├─ Rate: 60/min
├─ Auth: None
├─ Factors: txns | liquidity | volume | fdv
└─ Returns: { pairs[], total, sorted_by }

🔹 Find Trending Pairs
GET /api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&limit=10
├─ Rate: 30/min
├─ Auth: None
├─ Params: chain, min_liquidity, min_volume, max_age, limit
└─ Returns: { pairs[], total, cached }
```

### Management

```
🔹 Discovery Trigger
POST /api/dex/symbol-universe/sync
├─ Rate: 1/min
├─ Auth: None
├─ Body: (empty)
└─ Returns: { status, message, chains, expectedDuration }

🔹 Cache Stats
GET /api/dex/cache/stats
├─ Rate: 10/min
├─ Auth: None
└─ Returns: { cache_size, ttl_minutes }

🔹 Clear Cache
DELETE /api/dex/cache/clear
├─ Rate: 10/min
├─ Auth: Admin
└─ Returns: { status, message }
```

---

## 📈 Freqtrade API (`/api/freqtrade`)

### Strategy Management

```
🔹 List All Strategies
GET /api/freqtrade/strategies
├─ Rate: 100/min
├─ Auth: None
└─ Returns: {
      strategies: [{
        id, name, pair, timeframe,
        winRate, totalTrades, profit, createdAt
      }],
      total
    }

🔹 Upload Strategy
POST /api/freqtrade/strategies/upload
├─ Rate: 10/min
├─ Auth: None
├─ Body: {
      strategyCode,
      description,
      pair: "SOL/USDC",
      timeframe: "5m"
    }
└─ Returns: { status, strategyId, metadata }
```

### Testing & Optimization

```
🔹 Run Backtest
POST /api/freqtrade/strategies/{id}/backtest
├─ Rate: 5/min
├─ Auth: None
├─ Body: {
      timerange: "20230101-20240101",
      stakeAmount: 100,
      pair: "SOL/USDC",
      timeframe: "5m"
    }
└─ Returns: {
      status,
      results: {
        totalTrades, profitableTrades, winRatePct,
        totalProfitPct, avgProfitPct,
        sharpeRatio, sortinoRatio, maxDrawdownPct
      }
    }

🔹 Hyperparameter Optimization
POST /api/freqtrade/strategies/{id}/hyperopt
├─ Rate: 2/min
├─ Auth: None
├─ Body: {
      objective: "sharpe" | "sortino" | "profit",
      epochs: 100,
      timerange: "20230101-20240101"
    }
└─ Returns: {
      status,
      bestParams: { ... },
      bestScore,
      improved: "+X.X%"
    }
```

### Monitoring & Deployment

```
🔹 Get Performance Metrics
GET /api/freqtrade/strategies/{id}/performance
├─ Rate: 100/min
├─ Auth: None
└─ Returns: {
      performance: {
        totalTrades, winRate, profitFactor,
        sharpeRatio, maxDrawdown,
        avgTradeDuration, bestTrade, worstTrade
      }
    }

🔹 Deploy Strategy
POST /api/freqtrade/strategies/{id}/deploy
├─ Rate: 3/min
├─ Auth: Optional JWT
├─ Body: {
      dryRun: true,      // Simulation first
      maxExposure: 50    // 0-100%
    }
└─ Returns: {
      status: "deployed",
      deployment: {
        mode, maxExposure, startTime, expectedDuration
      }
    }
```

---

## 📊 Rate Limit Reference

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| DexScreener `/health` | ∞ | Critical |
| DexScreener `/search-pairs` | 60/min | Discovery |
| DexScreener `/pairs/:chain/:addr` | 300/min | Details |
| DexScreener `/trending-pairs` | 30/min | Discovery |
| DexScreener `/symbol-universe/sync` | 1/min | Heavy |
| Freqtrade `/strategies` | 100/min | Reads |
| Freqtrade `/upload` | 10/min | Writes |
| Freqtrade `/backtest` | 5/min | Compute |
| Freqtrade `/hyperopt` | 2/min | Heavy compute |
| Freqtrade `/deploy` | 3/min | Changes state |

---

## 🔐 Authentication

### Public Endpoints (No Auth)
- All `/api/dex/*` endpoints
- `GET /api/freqtrade/strategies`
- `GET /api/freqtrade/strategies/{id}/performance`

### Protected Endpoints (Admin Only)
- `DELETE /api/dex/cache/clear`
- `POST /api/freqtrade/strategies/{id}/deploy` (live mode)

### Optional Auth
- Strategy operations (improves rate limit)

---

## 📋 Response Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (check parameters) |
| `401` | Unauthorized (check token) |
| `403` | Forbidden (insufficient permission) |
| `404` | Not found (check path) |
| `429` | Rate limit exceeded (wait 1 min) |
| `500` | Server error (check logs) |

---

## 🧪 Quick Test Commands

### Test DexScreener
```bash
# Health check
curl http://localhost:5000/api/dex/health

# Search Ethereum pairs
curl "http://localhost:5000/api/dex/search-pairs?q=ETH&chains=ethereum&limit=5"

# Get trending pairs
curl "http://localhost:5000/api/dex/trending-pairs?chain=ethereum&limit=10"
```

### Test Freqtrade
```bash
# List strategies
curl http://localhost:5000/api/freqtrade/strategies

# Upload strategy
curl -X POST http://localhost:5000/api/freqtrade/strategies/upload \
  -H "Content-Type: application/json" \
  -d '{
    "strategyCode": "def populate_indicators(self, dataframe, metadata): ...",
    "description": "Test",
    "pair": "SOL/USDC",
    "timeframe": "5m"
  }'

# Run backtest
curl -X POST http://localhost:5000/api/freqtrade/strategies/strategy_001/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "timerange": "20230101-20240101",
    "stakeAmount": 100
  }'
```

---

## ⚙️ Key Parameters

### DexScreener

| Param | Values | Example |
|-------|--------|---------|
| `q` | Symbol or address | "ETH", "0x1234..." |
| `chains` | Chain names | "ethereum,solana" |
| `limit` | 1-100 | 50 |
| `factor` | txns, liquidity, volume, fdv | "txns" |

### Freqtrade

| Param | Values | Example |
|-------|--------|---------|
| `objective` | sharpe, sortino, profit | "sharpe" |
| `epochs` | 1-1000 | 100 |
| `timerange` | YYYYMMDD-YYYYMMDD | "20230101-20240101" |
| `dryRun` | true, false | true |
| `maxExposure` | 0-100 | 50 |

---

## 🎯 Common Workflows

### Flow 1: Trend Detection
```
GET /api/dex/trending-pairs
  → GET /api/dex/pairs/{chain}/{addr}
  → GET /api/dex/token-pairs/{chain}/{addr}
```

### Flow 2: Strategy Development
```
POST /api/freqtrade/strategies/upload
  → POST /api/freqtrade/strategies/{id}/backtest
  → POST /api/freqtrade/strategies/{id}/hyperopt
  → GET /api/freqtrade/strategies/{id}/performance
  → POST /api/freqtrade/strategies/{id}/deploy
```

### Flow 3: Portfolio Analysis
```
GET /api/dex/trending-pairs
  → Analyze with symbolUniverse
  → Show risk metrics to NURU
  → NURU returns recommendations
```

---

## 📍 Server Information

```
Service:    mtaa-api-backend
Port:       5000
Status:     ✅ Running
Uptime:     (check /status)
Memory:     (check /status)
Version:    1.0.0
Built:      TypeScript + Express
```

---

## 🚀 Getting Started

1. **Start everything** (Frontend + APIs on port 5000):
   ```bash
   npm run dev              # Development
   npm run start            # Production
   ```

2. **Check health**:
   ```bash
   curl http://localhost:5000/health
   ```

3. **Read full docs**:
   - [API_BACKEND_ENDPOINTS.md](./API_BACKEND_ENDPOINTS.md)
   - [API_BACKEND_QUICK_START.md](./API_BACKEND_QUICK_START.md)

---

## ✨ Notes

- All endpoints return JSON
- All responses include timestamp
- Cached responses include `"cached": true`
- Admin bypass available with JWT token containing `isAdmin: true`
- Test with `curl`, `Postman`, or browser (GET only)

📞 **All APIs are ready to use!** 🎉
