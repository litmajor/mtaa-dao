# 🚀 Unified API Backend - Complete Endpoint Reference

**Status**: ✅ **LIVE**  
**Port**: 5000  
**Service**: MTAA DAO API Backend  

---

## 📍 Server Information

### Base URL
```
http://localhost:5000
```

### Health/Status Endpoints (No Authentication Required)

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/health` | GET | Quick health check | `{ status, uptime, apis }` |
| `/status` | GET | Detailed server status | `{ status, memory, endpoints }` |

---

## 📊 API Groups

### Group 1: DexScreener API (`/api/dex`)
Token pair discovery, DEX monitoring, trending detection

### Group 2: Freqtrade API (`/api/freqtrade`)
Strategy backtesting, hyperparameter optimization, deployment

---

## 🔍 Complete Endpoint Listing

## ✅ DexScreener API

**Base Path**: `/api/dex`

### 1. Health Check
```
GET /api/dex/health
Rate Limit: Unlimited
Response: { status, service, timestamp, cache }
```

### 2. Search Pairs by Symbol or Address
```
GET /api/dex/search-pairs?q=ETH&chains=ethereum&limit=50
Rate Limit: 60 requests/minute
Parameters:
  - q (required): Symbol or address (e.g., "PUMP", "0x1234...")
  - chains (optional): Comma-separated chain names
  - limit (optional): Max results (default: 50)
Response: { pairs, total, cached, timestamp }
```

### 3. Get Pair Details
```
GET /api/dex/pairs/{chain}/{pairAddress}
Rate Limit: 300 requests/minute
Path Parameters:
  - chain: Blockchain name (e.g., "ethereum", "solana")
  - pairAddress: Pair contract address
Response: { pair, liquidity, volume24h, priceChange, timestamp }
```

### 4. Get All Pairs for a Token
```
GET /api/dex/token-pairs/{chain}/{tokenAddress}?factor=txns
Rate Limit: 60 requests/minute
Path Parameters:
  - chain: Blockchain name
  - tokenAddress: Token contract address
Query Parameters:
  - factor (optional): "txns", "liquidity", "volume", "fdv"
Response: { pairs, total, sorted_by, timestamp }
```

### 5. Get Trending Pairs
```
GET /api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&limit=10
Rate Limit: 30 requests/minute
Parameters:
  - chain (optional): Chain name
  - min_liquidity (optional): Minimum liquidity in USD
  - min_volume (optional): Minimum 24h volume in USD
  - max_age (optional): Max pair age in hours
  - limit (optional): Max results (default: 50)
Response: { pairs, total, cached, timestamp }
```

### 6. Trigger Symbol Universe Discovery
```
POST /api/dex/symbol-universe/sync
Rate Limit: 1 request/minute
Body: (empty)
Response: { status, message, chains, expectedDuration }
```

### 7. Cache Management
```
DELETE /api/dex/cache/clear
GET /api/dex/cache/stats
Rate Limit: 10 requests/minute each
Response: { status, cache_size, ttl_minutes }
```

---

## 🎯 Freqtrade API

**Base Path**: `/api/freqtrade`

### 1. List All Strategies
```
GET /api/freqtrade/strategies
Rate Limit: 100 requests/minute
Response: { strategies[], total, timestamp }
Fields per strategy:
  - id: Strategy identifier
  - name: Human-readable name
  - pair: Trading pair (e.g., "SOL/USDC")
  - timeframe: Candle interval (e.g., "5m", "1h")
  - winRate: Win rate percentage
  - totalTrades: Number of historical trades
  - profit: Total profit percentage
  - createdAt: Creation timestamp
```

### 2. Upload Strategy
```
POST /api/freqtrade/strategies/upload
Rate Limit: 10 requests/minute
Content-Type: application/json
Body:
{
  "strategyCode": "def populate_indicators(...)...",
  "description": "My RSI strategy",
  "pair": "SOL/USDC",
  "timeframe": "5m"
}
Response: {
  status: "success",
  strategyId: "strategy_1708366800",
  message: "Strategy uploaded and validated",
  metadata: { pair, timeframe, description, uploadedAt, validationPassed }
}
```

### 3. Run Backtest
```
POST /api/freqtrade/strategies/{strategyId}/backtest
Rate Limit: 5 requests/minute
Body:
{
  "timerange": "20230101-20240101",
  "stakeAmount": 100,
  "pair": "SOL/USDC",
  "timeframe": "5m"
}
Response: {
  status: "success",
  strategyId: "...",
  timerange: "...",
  results: {
    totalTrades: 87,
    profitableTrades: 52,
    losingTrades: 35,
    winRatePct: 59.8,
    totalProfitUsdc: 452.50,
    totalProfitPct: 45.25,
    avgProfitPct: 0.68,
    sharpeRatio: 1.45,
    sortinoRatio: 2.1,
    maxDrawdownPct: 12.3
  }
}
```

### 4. Hyperparameter Optimization
```
POST /api/freqtrade/strategies/{strategyId}/hyperopt
Rate Limit: 2 requests/minute
Body:
{
  "objective": "sharpe",  // or "sortino", "profit"
  "epochs": 100,
  "timerange": "20230101-20240101"
}
Response: {
  status: "success",
  strategyId: "...",
  objective: "sharpe",
  epochs: 100,
  bestParams: {
    "buy_rsi": 32,
    "sell_rsi": 54,
    "buy_trigger": "bb_lower",
    "sell_trigger": "macd_cross"
  },
  bestScore: 2.45,
  improved: "+18.5%"
}
```

### 5. Get Strategy Performance
```
GET /api/freqtrade/strategies/{strategyId}/performance
Rate Limit: 100 requests/minute
Response: {
  strategyId: "...",
  performance: {
    totalTrades: 287,
    winRate: 62.5,
    profitFactor: 2.3,
    sharpeRatio: 1.85,
    maxDrawdown: 8.2,
    avgTradeDuration: "2h 15m",
    bestTrade: { profit: 12.5, date: "2024-02-15" },
    worstTrade: { loss: -8.7, date: "2024-01-20" }
  }
}
```

### 6. Deploy Strategy
```
POST /api/freqtrade/strategies/{strategyId}/deploy
Rate Limit: 3 requests/minute
Body:
{
  "dryRun": true,        // Start in simulation mode
  "maxExposure": 50      // Max portfolio allocation %
}
Response: {
  status: "deployed",
  strategyId: "...",
  deployment: {
    mode: "dry_run",
    maxExposure: "50%",
    startTime: "2026-02-20T10:30:00Z",
    expectedDuration: "24h"
  },
  message: "Strategy deployed in dry-run mode..."
}
```

---

## 🔄 Request/Response Patterns

### Success Response (HTTP 200)
```json
{
  "status": "success",
  "data": { /* endpoint-specific */ },
  "timestamp": "2026-02-20T10:30:00Z",
  "cached": false
}
```

### Error Response (HTTP 400/500)
```json
{
  "error": "Invalid parameter",
  "message": "More details about the error",
  "timestamp": "2026-02-20T10:30:00Z"
}
```

### Status Codes
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (auth failed)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Server error

---

## 📊 Rate Limiting

All endpoints have per-minute rate limits:

| Endpoint Category | Limit | Purpose |
|------------------|-------|---------|
| DexScreener Health | Unlimited | Critical path |
| DexScreener Search | 60/min | Discovery operations |
| DexScreener Pair Details | 300/min | High-volume reads |
| DexScreener Trending | 30/min | Moderate-cost query |
| Symbol Universe Sync | 1/min | Resource-intensive |
| Freqtrade Backtest | 5/min | Compute-heavy |
| Freqtrade Hyperopt | 2/min | Very compute-heavy |
| Freqtrade Deploy | 3/min | State-changing |

**Admin Bypass**: Requests with `isAdmin: true` skip rate limits

---

## 🔐 Security

### Allowed CORS Origins
- `http://localhost:3000` (main app)
- `http://localhost:5173` (Vite dev)
- `http://localhost:3001` (admin panel)

### Authentication
- Strategy operations: Optional JWT token
- Admin operations: Required JWT token
- Public operations: No auth required

### Headers Required
- `Content-Type: application/json` (for POST)
- `Authorization: Bearer <token>` (for protected endpoints)

---

## 📈 Caching

### DexScreener Cache
- **TTL**: 5 minutes
- **Storage**: In-memory
- **Shared**: All users
- **Invalidation**: Manual via `DELETE /api/dex/cache/clear`

### Freqtrade Cache
- **TTL**: 1 hour (for performance metrics)
- **Storage**: In-memory
- **Shared**: All users

---

## 🚀 Usage Examples

### Example 1: Search for Trending Ethereum Pairs
```bash
curl -X GET "http://localhost:5000/api/dex/trending-pairs?chain=ethereum&min_liquidity=100000&limit=5"
```

### Example 2: Get Solana Token Pairs
```bash
curl -X GET "http://localhost:5000/api/dex/token-pairs/solana/EPjFWaJwqDP4adGA4asJ45z1pqKrrWCqkzqa3LWwoCe"
```

### Example 3: Upload a Strategy
```bash
curl -X POST "http://localhost:5000/api/freqtrade/strategies/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyCode": "...",
    "description": "RSI Mean Reversion",
    "pair": "SOL/USDC",
    "timeframe": "5m"
  }'
```

### Example 4: Run Backtest
```bash
curl -X POST "http://localhost:5000/api/freqtrade/strategies/strategy_001/backtest" \
  -H "Content-Type: application/json" \
  -d '{
    "timerange": "20230101-20240101",
    "stakeAmount": 100,
    "pair": "SOL/USDC"
  }'
```

### Example 5: Deploy Strategy
```bash
curl -X POST "http://localhost:5000/api/freqtrade/strategies/strategy_001/deploy" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true,
    "maxExposure": 50
  }'
```

---

## 🎯 Common Workflows

### Workflow 1: Discover and Analyze Trending Pairs
```
1. GET /api/dex/trending-pairs?chain=ethereum
   → Get list of trending pairs
2. GET /api/dex/pairs/ethereum/{pairAddress}
   → Get detailed info for a pair
3. GET /api/dex/token-pairs/ethereum/{tokenAddress}
   → Get all pairs for a token
```

### Workflow 2: Develop and Deploy a Strategy
```
1. POST /api/freqtrade/strategies/upload
   → Upload custom strategy code
2. POST /api/freqtrade/strategies/{id}/backtest
   → Test with historical data
3. POST /api/freqtrade/strategies/{id}/hyperopt
   → Optimize parameters
4. GET /api/freqtrade/strategies/{id}/performance
   → Check optimized results
5. POST /api/freqtrade/strategies/{id}/deploy
   → Deploy to dry-run then live
```

### Workflow 3: Monitor Strategy Performance
```
1. GET /api/freqtrade/strategies
   → List all strategies
2. GET /api/freqtrade/strategies/{id}/performance
   → Get current metrics
3. Repeat periodically via polling or WebSocket
```

---

## 📡 WebSocket (Future)

Real-time updates for:
- Pair price changes: `ws://localhost:5000/ws/pairs/{chain}/{address}`
- Strategy signals: `ws://localhost:5000/ws/strategies/{id}`

---

## 🔧 Environment Configuration

### Port
```bash
API_PORT=5000  # Default
```

### CORS Origins
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001
```

### Logging
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

---

## 📚 Additional Resources

- [DexScreener Integration](./DEXSCREENER_SYMBOL_UNIVERSE_INTEGRATION.md)
- [Backend Migration Guide](./BACKEND_TYPESCRIPT_MIGRATION.md)
- [Phase 8 Completion Summary](./PHASE_8_COMPLETION_SUMMARY.md)

---

## 🆘 Troubleshooting

### Issue: "Connection refused on port 5000"
**Solution**: Start the main app with `npm run dev`. This starts everything including DexScreener and Freqtrade APIs on port 5000

### Issue: "Rate limit exceeded"
**Solution**: Wait 1 minute and retry, or add JWT token with admin claims

### Issue: "CORS error when calling from frontend"
**Solution**: Both frontend and backend run on the same port (5000), so CORS is not needed. If you have CORS issues, check server/index.ts middleware configuration

### Issue: "Strategy validation failed"
**Solution**: Ensure strategy code contains all required Freqtrade methods:
- `populate_indicators(dataframe, metadata)`
- `populate_entry_trend(dataframe, metadata)`
- `populate_exit_trend(dataframe, metadata)`

---

## ✨ Success Indicators

All systems healthy when:
```bash
curl http://localhost:5000/health
# Returns: { status: "healthy", apis: { dexscreener: "running", freqtrade: "running" } }
```

```bash
curl http://localhost:5000/status
# Returns: { status: "operational", endpoints: { ... } }
```

🎉 **APIs are ready to use!**
