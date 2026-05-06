# Market Interaction Priority 3 - Testing Guide

## Overview

This guide provides complete step-by-step instructions for testing all Priority 3 (Phase 5) endpoints locally and in production.

---

## 🚀 Quick Start Testing

### Prerequisite: Verify Services Running

```bash
# Check if API is running
curl http://localhost:5000/health

# Should respond:
{
  "status": "ok",
  "services": {
    "volatility": "ready",
    "analytics": "ready",
    "retry": "ready"
  }
}
```

---

## 📝 Volatility Metrics Service Tests

### Test 1: Calculate Basic Volatility

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/volatility/ETH-USDC" \
  -H "Content-Type: application/json"

# Expected Response:
{
  "meta": {
    "timestamp": 1710432000000,
    "cached": false
  },
  "data": {
    "symbol": "ETH-USDC",
    "period": "24h",
    "volatility": 2.35,
    "historicalVolatility": 2.35,
    "volatilityTrend": "increasing",
    "riskLevel": "high",
    "volatilityIndex": 78,
    "priceRange": {
      "min": 3180,
      "max": 3250
    },
    "averagePrice": 3210
  },
  "status": "success"
}

# Verification:
✓ Status = "success"
✓ volatility > 0
✓ riskLevel in ["low", "medium", "high", "extreme"]
✓ volatilityIndex between 0-100
```

### Test 2: Get Volatility Trends

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/volatility/BTC-USDC/trends"

# Expected Response:
{
  "data": {
    "symbol": "BTC-USDC",
    "currentVolatility": 1.8,
    "averageVolatility": 1.5,
    "lastWeekTrend": "stable",
    "volatilityComparison": {
      "vs24hAverage": 20.0,
      "vs7dAverage": 15.0,
      "vs30dAverage": 10.0
    },
    "extremeEvents": [
      {
        "timestamp": 1710400000,
        "priceChange": 3.5,
        "volatility": 8.2,
        "duration": 300000
      }
    ]
  }
}

# Verification:
✓ extremeEvents array exists
✓ lastWeekTrend has value
✓ volatilityComparison values positive
```

### Test 3: Risk Analysis

```bash
curl -X POST "http://localhost:5000/api/v1/analytics/risk-analysis" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETH-USDC",
    "orderSize": 50000,
    "exchange": "binance"
  }'

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "riskLevel": "high",
    "riskScore": 68,
    "factors": {
      "volatilityFactor": 30,
      "liquidityFactor": 20,
      "spreadFactor": 12,
      "correlationFactor": 6
    },
    "maxRecommendedOrderSize": 45000,
    "optimalExecutionTime": "During standard market hours",
    "recommendations": [
      "Consider reducing order size to 45000 or waiting for better conditions",
      "Split into 2-3 smaller batches to reduce market impact"
    ]
  }
}

# Verification:
✓ riskScore between 0-100
✓ factors sum to 68 (or close)
✓ maxRecommendedOrderSize < orderSize
✓ recommendations array has content
```

### Test 4: Slippage Estimate

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/slippage-estimate/ETH-USDC?orderSize=10"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "orderSize": 10,
    "estimatedSlippage": 0.15,
    "confidenceScore": 92,
    "volatilityAdjustment": 0.08,
    "baseSlippage": 0.07
  }
}

# Verification:
✓ estimatedSlippage > baseSlippage
✓ confidenceScore between 0-100
✓ volatilityAdjustment > 0
```

---

## 📊 Market Analytics Service Tests

### Test 5: Spread Analysis

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/spreads/ETH-USDC?exchange=binance"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "exchange": "binance",
    "timestamp": 1710432000000,
    "currentSpread": 0.08,
    "spreadTrend": "tightening",
    "averageSpread": 0.12,
    "spreadVolatility": 0.03,
    "tightestSpread": 0.05,
    "widestSpread": 0.25,
    "spreadHistory": [
      { "timestamp": 1710431000000, "spread": 0.08 },
      { "timestamp": 1710430000000, "spread": 0.09 }
    ]
  }
}

# Verification:
✓ currentSpread > 0
✓ spreadTrend in ["widening", "stable", "tightening"]
✓ spreadHistory array populated
✓ tightestSpread <= currentSpread <= widestSpread
```

### Test 6: Depth Analysis

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/depth/ETH-USDC"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "timestamp": 1710432000000,
    "bidDepth": {
      "level1": 1500000,
      "level2": 3500000,
      "level5": 15000000,
      "level10": 45000000,
      "total": 150000000
    },
    "askDepth": {
      "level1": 1400000,
      "level2": 3400000,
      "level5": 14500000,
      "level10": 44000000,
      "total": 148000000
    },
    "depthTrend": "improving",
    "depthImbalance": 1.05,
    "liquidityHealth": 78
  }
}

# Verification:
✓ All depth levels > 0
✓ level1 <= level2 <= level5 <= level10
✓ depthTrend in ["improving", "stable", "degrading"]
✓ liquidityHealth between 0-100
✓ depthImbalance > 0
```

### Test 7: Liquidity Analysis

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/liquidity/BTC-USDC"

# Expected Response:
{
  "data": {
    "symbol": "BTC-USDC",
    "exchange": "binance",
    "timestamp": 1710432000000,
    "trend": "improving",
    "liquidityScore": 85,
    "volumeTrend": "increasing",
    "volumeImbalance": {
      "buyVolume": 450000,
      "sellVolume": 380000,
      "ratio": 1.18
    },
    "dailyVolume": 8500000,
    "recommendations": [
      "Strong buy pressure - consider selling at resistance",
      "Liquidity improving - good for large orders"
    ]
  }
}

# Verification:
✓ liquidityScore between 0-100
✓ trend in ["improving", "stable", "degrading"]
✓ volumeImbalance.ratio > 0
✓ recommendations array populated
```

### Test 8: Microstructure Quality

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/microstructure/ETH-USDC"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "exchange": "kraken",
    "timestamp": 1710432000000,
    "orderFlowImbalance": 15,
    "priceImpactEstimate": 0.35,
    "effectiveSpread": 0.43,
    "resilienceIndicator": 72,
    "microstructureQuality": "good"
  }
}

# Verification:
✓ orderFlowImbalance between -100 to 100
✓ priceImpactEstimate > 0
✓ effectiveSpread > 0
✓ resilienceIndicator between 0-100
✓ microstructureQuality in ["excellent", "good", "fair", "poor"]
```

---

## 🔄 Smart Retry Logic Service Tests

### Test 9: Execute with Smart Retry

```bash
curl -X POST "http://localhost:5000/api/v1/execution/smart-retry" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETH-USDC",
    "side": "buy",
    "amount": 10,
    "expectedPrice": 3200,
    "exchange": "binance",
    "strategy": {
      "maxRetries": 5,
      "slippageTolerance": 2,
      "useAltVenue": true
    }
  }'

# Expected Response:
{
  "data": {
    "success": true,
    "totalFilled": 10,
    "finalPrice": 3202.50,
    "totalRetries": 2,
    "totalExecutionTime": 15000,
    "finalSlippage": 0.078,
    "recommendations": [
      "Order fully completed successfully",
      "Slippage of 0.08% - within acceptable range"
    ]
  }
}

# Verification:
✓ success = true or false
✓ totalFilled > 0 and <= amount
✓ finalPrice > 0
✓ totalRetries >= 0 and <= maxRetries
✓ totalExecutionTime > 0
✓ finalSlippage % value
```

### Test 10: Get Pending Orders

```bash
curl -X GET "http://localhost:5000/api/v1/execution/pending-orders"

# Expected Response:
{
  "data": [
    {
      "orderId": "order_1710432000_abc123",
      "symbol": "BTC-USDC",
      "exchange": "binance",
      "side": "buy",
      "originalAmount": 2.5,
      "filledAmount": 1.8,
      "remainingAmount": 0.7,
      "averagePrice": 68000,
      "timestamp": 1710432000000,
      "status": "partial",
      "retries": 3
    }
  ]
}

# Verification:
✓ Array of pending orders
✓ status = "partial"
✓ remainingAmount = originalAmount - filledAmount
✓ Each order has all required fields
```

### Test 11: Get Retry History

```bash
curl -X GET "http://localhost:5000/api/v1/execution/retry-history/order_1710432000_abc123"

# Expected Response:
{
  "data": {
    "orderId": "order_1710432000_abc123",
    "symbol": "BTC-USDC",
    "side": "buy",
    "originalAmount": 2.5,
    "filledAmount": 2.5,
    "timestamp": 1710432000000,
    "status": "completed",
    "retries": 3,
    "retryAttempts": [
      {
        "attempt": 1,
        "filled": 0.8,
        "price": 68010,
        "timestamp": 1710432000000,
        "delay": 0
      },
      {
        "attempt": 2,
        "filled": 1.0,
        "price": 68005,
        "timestamp": 1710432001500,
        "delay": 1500
      },
      {
        "attempt": 3,
        "filled": 0.7,
        "price": 68000,
        "timestamp": 1710432003500,
        "delay": 2000
      }
    ]
  }
}

# Verification:
✓ retryAttempts array populated
✓ Each attempt has: attempt, filled, price, delay
✓ Delays increase (exponential backoff)
✓ Total filled = sum of all attempt fills
```

### Test 12: Detect Slippage Deviation

```bash
curl -X POST "http://localhost:5000/api/v1/execution/detect-slippage-deviation" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "ETH-USDC",
    "expectedSlippage": 0.5,
    "actualSlippage": 2.1
  }'

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "expectedSlippage": 0.5,
    "actualSlippage": 2.1,
    "deviationPercentage": 320,
    "severity": "high",
    "timestamp": 1710432000000,
    "recommendation": "Slippage 2.1% significantly exceeds estimate - consider reducing order size"
  }
}

# Verification:
✓ severity in ["low", "medium", "high", "extreme"]
✓ deviationPercentage = (actualSlippage - expectedSlippage) / expectedSlippage * 100
✓ recommendation provided
✓ severity correlates with deviationPercentage
```

### Test 13: Adaptive Slippage Tolerance

```bash
curl -X GET "http://localhost:5000/api/v1/execution/adaptive-slippage-tolerance/ETH-USDC?baseline=1"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "baselineSlippage": 1,
    "adaptiveSlippage": 2.45,
    "historicalAverage": 1.8,
    "standardDeviation": 0.43,
    "dataPoints": 10,
    "recommendation": "Use 2.45% tolerance based on recent market conditions"
  }
}

# Verification:
✓ adaptiveSlippage >= baseline
✓ standardDeviation > 0
✓ dataPoints > 0
✓ adaptiveSlippage ≈ mean + 1.5σ
```

---

## 🏥 Combined & Health Tests

### Test 14: Market Health Score

```bash
curl -X GET "http://localhost:5000/api/v1/analytics/market-health/ETH-USDC?exchange=binance"

# Expected Response:
{
  "data": {
    "symbol": "ETH-USDC",
    "exchange": "binance",
    "overallHealthScore": 72,
    "assessment": "Good",
    "timestamp": 1710432000000,
    "components": {
      "volatilityScore": 35,
      "liquidityScore": 82,
      "spreadScore": 0.08,
      "microstructureQuality": "good"
    },
    "recommendations": [
      "✅ OPTIMAL CONDITIONS - Safe for large orders",
      "Liquidity improving - good time for execution",
      "Spreads tight - minimal execution cost"
    ]
  }
}

# Verification:
✓ overallHealthScore between 0-100
✓ assessment in ["Excellent", "Good", "Fair", "Poor"]
✓ components object populated
✓ recommendations array has 1+ items
```

---

## 🔗 Integration Tests

### Test 15: Pre-Order Workflow

```bash
# 1. Check market health
curl http://localhost:5000/api/v1/analytics/market-health/ETH-USDC

# 2. If health > 75, check risk
curl -X POST http://localhost:5000/api/v1/analytics/risk-analysis \
  -d '{"symbol":"ETH-USDC","orderSize":50000}'

# 3. Get adaptive tolerance
curl http://localhost:5000/api/v1/execution/adaptive-slippage-tolerance/ETH-USDC

# 4. Execute with smart retry
curl -X POST http://localhost:5000/api/v1/execution/smart-retry \
  -d '{"symbol":"ETH-USDC","side":"buy","amount":10}'

# 5. Check retry history
curl http://localhost:5000/api/v1/execution/retry-history/:orderId

# 6. Monitor slippage
curl -X POST http://localhost:5000/api/v1/execution/detect-slippage-deviation \
  -d '{"expectedSlippage":0.5,"actualSlippage":1.2}'
```

---

## 📈 Performance Tests

### Test 16: Cache Performance

```bash
# First call (fresh):
time curl http://localhost:5000/api/v1/analytics/volatility/ETH-USDC
# Expected: 50-150ms

# Second call (cached):
time curl http://localhost:5000/api/v1/analytics/volatility/ETH-USDC
# Expected: <5ms

# Verify cache in response:
curl http://localhost:5000/api/v1/analytics/volatility/ETH-USDC \
  | grep '"cached"'
# Should show: "cached": true (on second+ call)
```

### Test 17: Load Test (10 concurrent requests)

```bash
# Using Apache Bench
ab -n 100 -c 10 http://localhost:5000/api/v1/analytics/market-health/ETH-USDC

# Expected Results:
# Requests per second: >50
# Failed requests: 0
# Mean time per request: <100ms
```

### Test 18: Multi-Venue Comparison

```bash
curl -X POST "http://localhost:5000/api/v1/execution/best-route" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC-USDC",
    "side": "buy",
    "amount": 2.5
  }'

# Expected: Best route with alternatives
{
  "data": {
    "bestRoute": {
      "venue": "binance",
      "slippage": 0.08,
      "fee": 0.001,
      "totalCost": 0.081
    },
    "alternatives": [
      { "venue": "coinbase", "totalCost": 0.095 },
      { "venue": "kraken", "totalCost": 0.110 }
    ]
  }
}
```

---

## ✅ Verification Checklist

### All Services Running
- [ ] Volatility service returns data
- [ ] Analytics service returns data
- [ ] Retry service returns data

### Response Format
- [ ] All responses have `meta` object
- [ ] All responses have `data` object
- [ ] All responses have `status` field
- [ ] Timestamp present in meta

### Data Quality
- [ ] Volatility between 0-100
- [ ] Risk scores between 0-100
- [ ] Spreads positive
- [ ] Depth levels in correct order
- [ ] Timestamps are recent

### Error Handling
- [ ] Invalid symbol returns 404
- [ ] Invalid parameters return 400
- [ ] Missing parameters return 400
- [ ] Server errors return 500

### Performance
- [ ] Cached responses < 10ms
- [ ] Fresh queries < 500ms
- [ ] Market health < 1s
- [ ] Concurrent requests work

---

## 🐛 Troubleshooting Test Failures

### Issue: "Service not available"
```bash
# Check if service is running
curl http://localhost:5000/health

# Restart services
npm start
```

### Issue: "Cache not working"
```bash
# Check Redis
redis-cli ping
# Should respond: PONG

# If not running:
redis-server

# Or check fallback is active
# (look for "Cache unavailable, using in-memory" in logs)
```

### Issue: "Invalid exchange"
```bash
# Use supported exchanges:
# binance, coinbase, kraken, gate.io, okx, huobi

# Example:
curl "http://localhost:5000/api/v1/analytics/volatility/ETH-USDC?exchange=kraken"
```

### Issue: "Slow responses"
```bash
# Check if cache is working
curl http://localhost:5000/api/v1/analytics/volatility/ETH-USDC \
  | grep "cached"

# If not cached, Redis may be down
redis-cli info
```

---

## 📊 Test Results Template

```markdown
## Priority 3 Testing Results

**Date:** [Date]
**Tester:** [Name]
**Environment:** [Local/Staging/Production]

### Volatility Metrics
- [ ] Test 1: Basic volatility - PASS/FAIL
- [ ] Test 2: Volatility trends - PASS/FAIL
- [ ] Test 3: Risk analysis - PASS/FAIL
- [ ] Test 4: Slippage estimate - PASS/FAIL

### Market Analytics
- [ ] Test 5: Spread analysis - PASS/FAIL
- [ ] Test 6: Depth analysis - PASS/FAIL
- [ ] Test 7: Liquidity analysis - PASS/FAIL
- [ ] Test 8: Microstructure - PASS/FAIL

### Smart Retry
- [ ] Test 9: Smart retry - PASS/FAIL
- [ ] Test 10: Pending orders - PASS/FAIL
- [ ] Test 11: Retry history - PASS/FAIL
- [ ] Test 12: Slippage deviation - PASS/FAIL
- [ ] Test 13: Adaptive tolerance - PASS/FAIL

### Combined
- [ ] Test 14: Market health - PASS/FAIL

### Integration
- [ ] Test 15: Pre-order workflow - PASS/FAIL

### Performance
- [ ] Test 16: Cache performance - PASS/FAIL
- [ ] Test 17: Load test - PASS/FAIL
- [ ] Test 18: Multi-venue - PASS/FAIL

### Summary
**Total Tests:** 18
**Passed:** __/18
**Failed:** __/18
**Status:** READY/NEEDS WORK

### Notes
[Any issues or observations]
```

---

**Priority 3 Testing: Complete Guide Ready for QA**

*All 18 tests documented with expected responses and verification steps*
