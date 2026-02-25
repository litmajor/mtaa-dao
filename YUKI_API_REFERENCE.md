# Yuki API Reference - Trading & Strategy Engine

## Overview

Yuki exposes a comprehensive REST + WebSocket API for:
- Market intelligence queries
- Trading execution (swap, bridge, move)
- Strategy CRUD & deployment
- Real-time price/order feeds
- Portfolio monitoring

---

## 🔌 Base URL

```
https://api.mtaa.io/api/yuki/v1
```

All endpoints require authentication via Bearer token or session cookies.

---

## 📊 Market Intelligence Endpoints

### Get Price Feed

```http
GET /market/prices
  ?symbols=ETH,USDC,DAI
  &chains=ethereum,polygon,arbitrum
  &include=24h_change,volume,liquidity
```

**Response:**
```json
[
  {
    "symbol": "ETH",
    "chain": "ethereum",
    "price": 2847.50,
    "decimals": 18,
    "change24h": 5.2,
    "volume24h": 8.5e9,
    "liquidity": {
      "dex": "uniswap_v3",
      "tvl": 3.2e9,
      "slippage_0_1_bps": 0.12
    },
    "updatedAt": "2026-01-29T10:00:00Z"
  }
]
```

### Get Arbitrage Opportunities

```http
GET /market/opportunities
  ?minProfit=1
  &maxGas=200
  &includeFlashLoans=true
```

**Response:**
```json
{
  "opportunities": [
    {
      "id": "arb-eth-usdc-001",
      "type": "arbitrage",
      "pair": "ETH/USDC",
      "buyDex": "uniswap_v3",
      "sellDex": "curve",
      "expectedProfit": 2.3,
      "profitUsd": 234.50,
      "estimatedGas": 45,
      "route": [
        { "dex": "uniswap_v3", "action": "buy", "amount": "1.0 ETH", "price": "2850" },
        { "dex": "curve", "action": "sell", "amount": "1.0 ETH", "price": "2916" }
      ],
      "slippage": 0.5,
      "actionable": true,
      "expiresAt": "2026-01-29T10:05:00Z"
    }
  ],
  "count": 12,
  "updatedAt": "2026-01-29T10:00:30Z"
}
```

### Get Liquidity Analytics

```http
GET /market/liquidity/:symbol
  ?chain=ethereum
  &timeframe=1h
```

**Response:**
```json
{
  "symbol": "ETH",
  "chain": "ethereum",
  "liquidityByDex": {
    "uniswap_v3": 3.2e9,
    "curve": 1.5e9,
    "balancer": 800e6
  },
  "flowDirection": "inflow",
    "flowVolume24h": 450e6,
  "largestPool": {
    "dex": "uniswap_v3",
    "pool": "WETH/USDC-0.05%",
    "tvl": 2.1e9,
    "fee": 0.05
  }
}
```

---

## ⚡ Trading Execution Endpoints

### Preview Swap

```http
POST /execute/swap/preview
  Content-Type: application/json

{
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amountIn": "1.5",
  "slippageTolerance": 0.5,
  "includeGasEstimate": true
}
```

**Response:**
```json
{
  "amountOut": "4271.25",
  "minAmountOut": "4249.89",
  "priceImpact": 0.5,
  "route": [
    {
      "dex": "uniswap_v3",
      "pool": "WETH/USDC-0.05%",
      "inputAmount": "1.5",
      "outputAmount": "4271.25"
    }
  ],
  "gasEstimate": 125000,
  "gasPrice": "35 gwei",
  "gasCostUsd": 6.50,
  "totalCostUsd": 6.50,
  "valid": true
}
```

### Execute Swap

```http
POST /execute/swap
  Content-Type: application/json

{
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amountIn": "1.5",
  "minAmountOut": "4249.89",
  "slippageTolerance": 0.5,
  "deadline": 1706514000
}
```

**Response:**
```json
{
  "txHash": "0x7f9d1b2c...",
  "status": "pending",
  "amountOut": "4271.25",
  "gasPaid": 125000,
  "gasPrice": "35 gwei",
  "executedAt": "2026-01-29T10:00:45Z",
  "estimatedConfirmAt": "2026-01-29T10:01:45Z"
}
```

### Execute Bridge

```http
POST /execute/bridge
  Content-Type: application/json

{
  "token": "USDC",
  "fromChain": "ethereum",
  "toChain": "polygon",
  "amount": "1000",
  "recipient": "0x...",
  "provider": "stargate",  // or "layerzero"
  "slippageTolerance": 0.3
}
```

**Response:**
```json
{
  "bridgeTxHash": "0xabc123...",
  "amount": "1000",
  "token": "USDC",
  "fromChain": "ethereum",
  "toChain": "polygon",
  "estimatedArrival": "2026-01-29T10:15:00Z",
  "fee": 2.50,
  "feePercent": 0.25,
  "status": "initiated",
  "trackingUrl": "https://..."
}
```

### Move Funds (Internal Transfer)

```http
POST /execute/move
  Content-Type: application/json

{
  "fromWallet": "okedi",  // or subprofile ID
  "toWallet": "amara",    // or subprofile ID
  "token": "cUSD",
  "amount": "500"
}
```

**Response:**
```json
{
  "txHash": "0x...",
  "from": "okedi",
  "to": "amara",
  "token": "cUSD",
  "amount": "500",
  "status": "confirmed",
  "confirmedAt": "2026-01-29T10:01:00Z"
}
```

---

## 🤖 Strategy Management Endpoints

### Create Strategy

```http
POST /strategies
  Content-Type: application/json

{
  "name": "ETH Mean Reversion",
  "description": "Sell when RSI > 70, buy when RSI < 30",
  "blocks": [
    {
      "id": "cond-rsi",
      "type": "condition",
      "config": {
        "metric": "rsi",
        "period": 14,
        "operator": ">",
        "value": 70
      }
    },
    {
      "id": "act-sell",
      "type": "action",
      "config": {
        "action": "sell",
        "token": "ETH",
        "amount": 0.5,
        "amountType": "percentage"
      }
    }
  ],
  "riskControls": {
    "maxLoss": 5,
    "maxDrawdown": 15,
    "dailyTradeLimit": 10
  }
}
```

**Response:**
```json
{
  "id": "strat-abc123",
  "name": "ETH Mean Reversion",
  "blocks": [...],
  "riskControls": {...},
  "createdAt": "2026-01-29T10:00:00Z",
  "deployable": true
}
```

### Get Strategy

```http
GET /strategies/:strategyId
```

**Response:**
```json
{
  "id": "strat-abc123",
  "name": "ETH Mean Reversion",
  "blocks": [...],
  "riskControls": {...},
  "stats": {
    "totalTrades": 45,
    "winRate": 68,
    "pnl": 2345.50,
    "pnlPercent": 12.3,
    "maxDrawdown": -8.5,
    "sharpeRatio": 1.8
  },
  "isActive": true,
  "createdAt": "2026-01-29T10:00:00Z",
  "deployedAt": "2026-01-29T10:30:00Z"
}
```

### List Strategies

```http
GET /strategies
  ?isActive=true
  &sortBy=pnl
  &order=desc
```

### Update Strategy

```http
PUT /strategies/:strategyId
  Content-Type: application/json

{
  "name": "ETH Mean Reversion v2",
  "blocks": [...],
  "riskControls": {...}
}
```

### Delete Strategy

```http
DELETE /strategies/:strategyId
```

### Deploy Strategy

```http
POST /strategies/:strategyId/deploy
  Content-Type: application/json

{
  "autoExecute": true,
  "dryRun": false
}
```

**Response:**
```json
{
  "id": "strat-abc123",
  "status": "deployed",
  "deployedAt": "2026-01-29T10:30:00Z",
  "nextExecutionTime": "2026-01-29T10:35:00Z"
}
```

### Backtest Strategy

```http
POST /strategies/:strategyId/backtest
  Content-Type: application/json

{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "initialCapital": 10000,
  "symbols": ["ETH", "USDC"]
}
```

**Response:**
```json
{
  "backtestId": "bt-xyz789",
  "strategyId": "strat-abc123",
  "results": {
    "initialCapital": 10000,
    "finalCapital": 12345.50,
    "pnl": 2345.50,
    "pnlPercent": 23.45,
    "trades": 45,
    "winRate": 68,
    "maxDrawdown": -8.5,
    "sharpeRatio": 1.8,
    "sortinoRatio": 2.1
  },
  "backtestAt": "2026-01-29T10:35:00Z"
}
```

### Get Strategy Signals

```http
GET /strategies/:strategyId/signals
```

**Response:**
```json
{
  "strategyId": "strat-abc123",
  "currentSignal": "sell",
  "confidence": 0.92,
  "triggeringConditions": [
    { "metric": "rsi", "value": 75, "threshold": 70, "met": true }
  ],
  "nextAction": {
    "action": "sell",
    "token": "ETH",
    "amount": 0.5,
    "estimatedExecutionTime": "2026-01-29T10:40:00Z"
  },
  "lastUpdate": "2026-01-29T10:00:00Z"
}
```

---

## 📡 WebSocket (Real-time)

### Subscribe to Channels

```
ws://api.mtaa.io/api/yuki/v1/ws
```

**Connection & subscription:**
```json
{
  "type": "subscribe",
  "channels": [
    "price:ETH-USDC",
    "price:ETH-DAI",
    "fills:user",
    "alerts:user",
    "portfolio:user",
    "strategy:strat-abc123"
  ]
}
```

### Price Updates

```json
{
  "type": "price",
  "pair": "ETH-USDC",
  "price": 2847.50,
  "timestamp": "2026-01-29T10:00:15Z",
  "change24h": 5.2,
  "volume24h": 8.5e9
}
```

### Fill Notifications

```json
{
  "type": "fill",
  "txHash": "0x...",
  "tokenIn": "ETH",
  "tokenOut": "USDC",
  "amountIn": "1.5",
  "amountOut": "4271.25",
  "gasUsed": 125000,
  "gasPaidUsd": 6.50,
  "timestamp": "2026-01-29T10:00:45Z"
}
```

### Alert Notifications

```json
{
  "type": "alert",
  "level": "warning",
  "message": "Strategy #3 triggered: Sell signal at RSI=72",
  "data": {
    "strategyId": "strat-abc123",
    "metric": "rsi",
    "value": 72,
    "threshold": 70
  },
  "timestamp": "2026-01-29T10:00:30Z"
}
```

---

## 🔐 Authentication

All requests require either:

### Bearer Token
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5...
```

### Session Cookie
```http
Cookie: sessionId=abc123...
```

---

## ⚙️ Rate Limits

- **Public endpoints**: 100 req/min per IP
- **Authenticated endpoints**: 500 req/min per user
- **WebSocket**: 1 connection per user

---

## 📝 Error Responses

```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient ETH balance for swap",
  "code": "ERR_001",
  "details": {
    "required": "1.5 ETH",
    "available": "0.8 ETH"
  }
}
```

---

**Last Updated:** January 29, 2026
