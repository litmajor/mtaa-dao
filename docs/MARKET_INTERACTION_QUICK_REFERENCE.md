# Market Interaction APIs - Quick Reference Guide

## Phase 3 & 4 Endpoints (13 Total)

### 🎯 Market Data Endpoints (Phase 3)

#### 1. Order Book with Depth Analytics
```bash
GET /api/v1/market/orderbook/{symbol}?limit=50&depth=20

# Example
curl http://localhost:5000/api/v1/market/orderbook/ETH-USDC

# Response
{
  "meta": {
    "timestamp": 1710432000000,
    "cached": true,
    "cacheExpiry": 1710432300000
  },
  "data": {
    "symbol": "ETH-USDC",
    "bids": [
      [3200.50, 5.5, "binance"],
      [3200.25, 3.2, "coinbase"],
      ...
    ],
    "asks": [
      [3201.00, 8.3, "binance"],
      [3201.50, 2.1, "coinbase"],
      ...
    ],
    "spread": {
      "percentage": 0.16,
      "absolute": 0.50,
      "midPrice": 3200.75
    },
    "imbalance": 1.23  // bid volume / ask volume
  }
}
```

#### 2. Optimal Routes with Alternatives
```bash
GET /api/v1/market/optimal-routes/{symbol}

# Example
curl http://localhost:5000/api/v1/market/optimal-routes/ETH-USDC

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "ETH-USDC",
    "bestRoute": {
      "venue": "binance",
      "expectedPrice": 3200.50,
      "estimatedSlippage": 0.12,
      "fee": 0.05,
      "totalCost": 0.17
    },
    "alternatives": [
      {
        "venue": "coinbase",
        "expectedPrice": 3200.25,
        "estimatedSlippage": 0.18,
        "fee": 0.10,
        "totalCost": 0.28,
        "costDifference": 0.11  // vs best route
      }
    ]
  }
}
```

#### 3. Liquidity Depth at Price Levels
```bash
GET /api/v1/market/liquidity-depth/{symbol}?priceRange=0.5

# Example
curl http://localhost:5000/api/v1/market/liquidity-depth/ETH-USDC?priceRange=1

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "ETH-USDC",
    "currentPrice": 3200.75,
    "depthLevels": [
      {
        "level": 1,
        "price": 3200.75,
        "bidVolume": 45.2,
        "askVolume": 38.5,
        "spreadPercentage": 0.16
      },
      {
        "level": 2,
        "price": 3201.50,
        "bidVolume": 120.5,
        "askVolume": 95.3,
        "spreadPercentage": 0.47
      }
    ]
  }
}
```

#### 4. Cross-Exchange Spread Analysis
```bash
GET /api/v1/market/spread-analysis/{symbol}

# Example
curl http://localhost:5000/api/v1/market/spread-analysis/BTC-USDC

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "BTC-USDC",
    "exchanges": {
      "binance": {
        "bid": 42950.50,
        "ask": 42951.00,
        "spread": 0.012,
        "spreadPercentage": 0.001,
        "volume": 1250.5
      },
      "coinbase": {
        "bid": 42955.00,
        "ask": 42956.50,
        "spread": 1.50,
        "spreadPercentage": 0.0035,
        "volume": 850.2
      }
    },
    "arbitrageOpportunities": [
      {
        "buy": "binance",
        "sell": "coinbase",
        "profitPercentage": 0.011,
        "limitedBy": "volume"
      }
    ]
  }
}
```

---

### 📊 Enhanced YUKI Endpoints (Phase 3)

#### 1. Market Prices with Standardized Format
```bash
GET /api/yuki/market/prices?symbols=ETH,BTC

# Response (now with ApiResponse standardization)
{
  "meta": {
    "timestamp": 1710432000000,
    "cached": true,
    "rateLimit": { "limit": 100, "remaining": 95 }
  },
  "data": {
    "ETH": { "price": 3200.50, "change24h": 2.5 },
    "BTC": { "price": 42950.50, "change24h": -1.2 }
  }
}
```

#### 2. Liquidity with Spread Data
```bash
GET /api/yuki/market/liquidity/ETH

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "ETH",
    "liquidity": 5000000.50,
    "spread": 0.16,  // NEW: actual bid-ask spread
    "depth": {
      "10000": 150.5,   // Volume available within $10k of mid
      "50000": 450.2,
      "100000": 1250.8
    }
  }
}
```

#### 3. Swap Preview with Alternatives
```bash
POST /api/yuki/execute/swap/preview
Content-Type: application/json

{
  "tokenFrom": "USDC",
  "tokenTo": "ETH",
  "amount": 10000
}

# Response (now returns alternatives)
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "bestRoute": {
      "venue": "binance",
      "expectedOutput": 3.125,
      "price": 3200.50,
      "slippage": 0.12,
      "fee": 10.00,
      "minOutput": 3.120
    },
    "alternatives": [
      {
        "venue": "coinbase",
        "expectedOutput": 3.122,
        "price": 3200.25,
        "slippage": 0.18,
        "fee": 15.00,
        "minOutput": 3.114,
        "savings": -5.00  // vs best route
      }
    ]
  }
}
```

---

### ⚡ Execution Quality Endpoints (Phase 4)

#### 1. Venue Quality Metrics
```bash
GET /api/v1/execution/quality/{exchange}

# Example
curl http://localhost:5000/api/v1/execution/quality/binance

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "exchange": "binance",
    "successRate": 98.5,        // %
    "avgSlippage": 0.12,        // %
    "avgExecutionTime": 245,    // ms
    "feeEfficiency": 1.05,      // actual vs expected
    "sampleSize": 156,          // executions tracked
    "timeWindow": "24h",
    "recommendation": "Excellent for large orders"
  }
}
```

#### 2. Symbol Slippage Analysis
```bash
GET /api/v1/execution/slippage/{symbol}?hours=24&exchange=binance

# Example
curl http://localhost:5000/api/v1/execution/slippage/ETH-USDC?hours=24

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "ETH-USDC",
    "exchange": "binance",
    "timeWindow": "24h",
    "expectedSlippage": 0.15,   // average estimate
    "actualSlippage": 0.18,     // actual result
    "difference": 0.03,         // variance
    "trend": "improving",       // improving | stable | degrading
    "outliers": [
      {
        "timestamp": 1710400000,
        "slippage": 2.5,
        "reason": "High volatility",
        "executionCount": 1
      }
    ],
    "executionCount": 42
  }
}
```

#### 3. Ranked Venues by Quality
```bash
GET /api/v1/execution/venues?sortBy=slippage&limit=10

# Example
curl "http://localhost:5000/api/v1/execution/venues?sortBy=slippage"

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": [
    {
      "rank": 1,
      "exchange": "binance",
      "score": 98.5,            // composite 0-100
      "successRate": 99.1,
      "avgSlippage": 0.08,
      "avgExecutionTime": 180,
      "feeEfficiency": 0.98,
      "recommendation": "Best all-around"
    },
    {
      "rank": 2,
      "exchange": "coinbase",
      "score": 96.2,
      "successRate": 98.8,
      "avgSlippage": 0.11,
      "avgExecutionTime": 250,
      "feeEfficiency": 1.02,
      "recommendation": "Good for large orders"
    }
  ],
  "pagination": { "total": 8, "limit": 10, "offset": 0 }
}
```

#### 4. Historical Execution Records
```bash
GET /api/v1/execution/history/{symbol}?limit=50&hours=24

# Example
curl "http://localhost:5000/api/v1/execution/history/ETH-USDC?limit=20"

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "symbol": "ETH-USDC",
    "executionCount": 42,
    "executions": [
      {
        "timestamp": 1710432000000,
        "id": "exec_abc123",
        "exchange": "binance",
        "side": "buy",
        "amount": 5.5,
        "expectedPrice": 3200.50,
        "actualPrice": 3202.10,
        "slippage": 0.05,         // %
        "gasCost": 12.50,
        "txHash": "0xabc...",
        "status": "success"
      }
    ]
  },
  "pagination": { "total": 156, "limit": 50, "offset": 0 }
}
```

#### 5. Market Insights & Recommendations
```bash
GET /api/v1/execution/insights?hours=24

# Example
curl http://localhost:5000/api/v1/execution/insights

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "timeWindow": "24h",
    "totalExecutions": 285,
    "successRate": 98.9,
    "bestVenue": "binance",
    "worstVenue": "gate.io",
    "trends": {
      "slippageDirection": "improving",
      "volumeChange": "+12.5%",
      "volatilityTrend": "increasing"
    },
    "anomalies": [
      {
        "type": "unusual_slippage",
        "severity": "high",
        "description": "Slippage 3.2% vs avg 0.12%",
        "exchange": "kraken",
        "symbol": "ETH-USDC"
      }
    ],
    "recommendations": [
      "Route large ETH orders through Binance",
      "Split orders >$50K (reduces slippage ~30%)",
      "Best execution time: 13:00-15:00 UTC",
      "Switch 20% volume to Kraken for fee savings"
    ]
  }
}
```

#### 6. Record New Execution (Admin)
```bash
POST /api/v1/execution/track
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "symbol": "ETH-USDC",
  "exchange": "binance",
  "side": "buy",
  "amount": 5.5,
  "expectedPrice": 3200.50,
  "actualPrice": 3202.10,
  "timestamp": 1710432000000,
  "txHash": "0xabc123...",
  "gasCost": 12.50,
  "status": "success"
}

# Response
{
  "meta": { "timestamp": 1710432000000 },
  "data": {
    "recordId": "exec_abc123xyz",
    "slippage": 0.05,
    "quality": {
      "successRate": 98.5,
      "recommendation": "Excellent execution"
    }
  }
}
```

---

## Common Use Cases

### 1. Find Best Execution Venue for Large Order
```bash
# Get top-ranked venues by success rate and slippage
curl "http://localhost:5000/api/v1/execution/venues?sortBy=slippage&limit=3"

# Check venue quality details
curl http://localhost:5000/api/v1/execution/quality/binance

# Result: Use top-ranked venue for execution
```

### 2. Analyze Slippage Trends
```bash
# Get 7-day slippage history
curl "http://localhost:5000/api/v1/execution/slippage/BTC-USDC?hours=168"

# Check for anomalies (outliers)
# Response includes: trend (improving/stable/degrading), outliers array

# Result: Understand if slippage is getting better or worse
```

### 3. Track Execution Performance
```bash
# Record execution after trade
curl -X POST http://localhost:5000/api/v1/execution/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "symbol": "ETH-USDC",
    "exchange": "binance",
    "side": "buy",
    "amount": 5,
    "expectedPrice": 3200,
    "actualPrice": 3202,
    "timestamp": 1710432000000,
    "status": "success"
  }'

# Slippage automatically calculated: ((3202-3200)/3200)*100 = 0.063%
```

### 4. Get Execution Insights
```bash
# Get market-wide recommendations
curl http://localhost:5000/api/v1/execution/insights

# Response includes:
# - Best/worst performing venues
# - Slippage trends
# - Anomaly alerts
# - Timing recommendations
# - Fee optimization suggestions

# Result: Optimize trading strategy based on data
```

### 5. Find Arbitrage Opportunities
```bash
# Get cross-exchange spreads
curl http://localhost:5000/api/v1/market/spread-analysis/BTC-USDC

# Response shows:
# - Bid/ask per exchange
# - Arbitrage opportunities array
# - Profit percentages
# - Limited by volume (liquidity constraints)

# Result: Execute profitable arbitrage trades
```

---

## Query Parameters

### Common Query Params

| Parameter | Values | Default | Example |
|-----------|--------|---------|---------|
| symbol | string | required | ETH-USDC |
| exchange | string | all | binance |
| hours | 1, 24, 168 | 24 | ?hours=168 |
| limit | 1-100 | 50 | ?limit=20 |
| offset | integer | 0 | ?offset=10 |
| sortBy | see endpoint | varies | ?sortBy=slippage |
| depth | integer | 20 | ?depth=50 |
| priceRange | decimal | varies | ?priceRange=1.0 |

---

## Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data returned successfully |
| 201 | Created | Execution tracked successfully |
| 400 | Bad Request | Missing required parameters |
| 401 | Unauthorized | Missing/invalid token (POST only) |
| 404 | Not Found | Symbol/exchange not found |
| 500 | Server Error | Database/Cache error |
| 503 | Service Unavailable | Cache service down |

---

## Error Response Format

```json
{
  "meta": {
    "timestamp": 1710432000000,
    "errorCode": "INVALID_SYMBOL"
  },
  "data": null,
  "error": {
    "code": "INVALID_SYMBOL",
    "message": "Symbol ETH-XYZ not found in execution history"
  }
}
```

---

## Integration Examples

### Node.js/JavaScript
```javascript
// Fetch venue quality
const response = await fetch('/api/v1/execution/quality/binance');
const { data } = await response.json();
console.log(`Binance success rate: ${data.successRate}%`);

// Record execution
await fetch('/api/v1/execution/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'ETH-USDC',
    exchange: 'binance',
    side: 'buy',
    amount: 5.5,
    expectedPrice: 3200.50,
    actualPrice: 3202.10,
    timestamp: Date.now(),
    status: 'success'
  })
});
```

### Python
```python
import requests

# Get execution insights
response = requests.get('http://localhost:5000/api/v1/execution/insights')
data = response.json()['data']

for rec in data['recommendations']:
    print(f"Recommendation: {rec}")

# Track execution
execution = {
    'symbol': 'ETH-USDC',
    'exchange': 'binance',
    'side': 'buy',
    'amount': 5.5,
    'expectedPrice': 3200.50,
    'actualPrice': 3202.10,
    'timestamp': int(time.time() * 1000),
    'status': 'success'
}

requests.post(
    'http://localhost:5000/api/v1/execution/track',
    json=execution,
    headers={'Authorization': f'Bearer {token}'}
)
```

### cURL Examples
```bash
# Test all endpoints

# Market Data
curl http://localhost:5000/api/v1/market/orderbook/ETH-USDC
curl http://localhost:5000/api/v1/market/optimal-routes/BTC-USDC
curl http://localhost:5000/api/v1/market/liquidity-depth/ETH-USDC
curl http://localhost:5000/api/v1/market/spread-analysis/LTC-USDC

# Enhanced YUKI
curl "http://localhost:5000/api/yuki/market/prices?symbols=ETH,BTC"
curl http://localhost:5000/api/yuki/market/liquidity/ETH
curl -X POST http://localhost:5000/api/yuki/execute/swap/preview \
  -H "Content-Type: application/json" \
  -d '{"tokenFrom":"USDC","tokenTo":"ETH","amount":10000}'

# Execution Quality
curl http://localhost:5000/api/v1/execution/venues
curl http://localhost:5000/api/v1/execution/insights
curl http://localhost:5000/api/v1/execution/quality/binance
curl http://localhost:5000/api/v1/execution/slippage/ETH-USDC
curl http://localhost:5000/api/v1/execution/history/BTC-USDC
```

---

## Cache Behavior

### Response Caching

All endpoints automatically cache responses based on data type:

| Data Type | TTL | Fresh Check |
|-----------|-----|------------|
| Real-time prices | 30s | High value changes |
| Order books | 5m | Major depth changes |
| Execution records | 1h | Complete records only |
| Historical data | 7d | Immutable |
| Venue metrics | 24h | Daily aggregation |

### Using Cache Info

```json
{
  "meta": {
    "timestamp": 1710432000000,
    "cached": true,              // From cache?
    "cacheExpiry": 1710432060000 // When expires
  },
  "data": { ... }
}
```

If `cached: true`, data is from cache (faster). If `cacheExpiry` is set, you can refresh after that time.

---

## Troubleshooting

### Endpoint Returns 404
- Verify symbol exists (e.g., ETH-USDC vs ETHUSDC)
- Check trading pair is tracked in execution history
- For first time, record an execution first

### Slow Response Times
- Check if `cached: true` in response
- If fresh query, it hits CCXT APIs (slower ~100-300ms)
- Verify Redis is running: `redis-cli ping`

### No Execution Data
- Ensure executions are being recorded via POST /api/v1/execution/track
- Check time window in params (default 24h)
- Redis should have data for 7 days

### Wrong Slippage Values
- Verify expectedPrice and actualPrice are in same unit
- Formula: `((actual - expected) / expected) * 100`
- Check decimal precision

---

## Next Steps

1. **Test all endpoints** with sample data
2. **Integrate tracking** into your trade execution pipeline
3. **Monitor venue quality** to optimize routing
4. **Track slippage trends** to identify anomalies
5. **Use recommendations** to improve execution performance

---

*Quick Reference v1.0 | Last Updated: 2024*
