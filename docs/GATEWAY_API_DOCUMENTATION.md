# Gateway Agent API Documentation

Complete API reference for the Gateway Agent system.

## Table of Contents

1. [REST API](#rest-api)
2. [WebSocket API](#websocket-api)
3. [Message Bus API](#message-bus-api)
4. [Error Handling](#error-handling)
5. [Authentication](#authentication)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

## REST API

### Base URL
```
http://localhost:3000/api/v1/gateway
```

### Response Format

All REST responses follow a standardized format:

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "error": null,
  "timestamp": "2025-11-15T10:00:00Z",
  "requestId": "req-abc123xyz",
  "metadata": {
    "responseTime": 145,
    "cached": false,
    "dataSource": "chainlink",
    "confidence": 0.99
  }
}
```

### Endpoints

#### 1. GET /prices

Fetch cryptocurrency prices from multiple sources.

**Query Parameters:**
- `symbols` (required): Comma-separated list of symbols (e.g., "ETH,BTC,USDC")
- `chains` (optional): Filter by chains (e.g., "ethereum,polygon")
- `source` (optional): Prefer specific adapter ("chainlink", "uniswap", etc.)

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/gateway/prices?symbols=ETH,BTC&chains=ethereum"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "ETH": {
      "symbol": "ETH",
      "price": 2500.50,
      "currency": "USD",
      "timestamp": "2025-11-15T10:00:00Z",
      "source": "chainlink",
      "confidence": 0.99
    },
    "BTC": {
      "symbol": "BTC",
      "price": 52000.00,
      "currency": "USD",
      "timestamp": "2025-11-15T10:00:00Z",
      "source": "chainlink",
      "confidence": 0.99
    }
  },
  "timestamp": "2025-11-15T10:00:00Z",
  "requestId": "req-abc123",
  "metadata": {
    "responseTime": 145,
    "cached": false,
    "adapters_queried": ["chainlink"],
    "security": {
      "riskScore": 15,
      "ethicalScore": 95,
      "riskLevel": "low"
    }
  }
}
```

**Error Response (403 - Access Denied):**
```json
{
  "success": false,
  "error": "Access denied due to security/ethical concerns",
  "details": {
    "riskLevel": "high",
    "riskScore": 85,
    "ethicalScore": 35,
    "concerns": [
      "Data source not transparent",
      "Single source bias detected"
    ],
    "recommendations": [
      "Request data from verified oracle",
      "Cross-reference with multiple sources"
    ]
  },
  "timestamp": "2025-11-15T10:00:00Z"
}
```

**Error Response (429 - Rate Limited):**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "timestamp": "2025-11-15T10:00:00Z"
}
```

---

#### 2. GET /liquidity

Fetch DEX liquidity and pool information.

**Query Parameters:**
- `protocols` (optional): Filter by protocols ("uniswap", "aave", etc.)
- `pools` (optional): Specific pool addresses
- `chain` (optional): Single chain filter ("ethereum", "polygon", etc.)

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/gateway/liquidity?protocols=uniswap,aave&chain=ethereum"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "pool": "USDC-ETH",
      "protocol": "uniswap",
      "chain": "ethereum",
      "liquidity": 45000000,
      "currency": "USD",
      "fee": 0.05,
      "token0": { "symbol": "USDC", "address": "0x..." },
      "token1": { "symbol": "ETH", "address": "0x..." },
      "timestamp": "2025-11-15T10:00:00Z",
      "source": "uniswap-subgraph",
      "confidence": 0.95
    }
  ],
  "metadata": {
    "responseTime": 234,
    "poolsFound": 1,
    "security": {
      "riskScore": 25,
      "ethicalScore": 90,
      "riskLevel": "low"
    }
  }
}
```

---

#### 3. GET /apy

Fetch protocol APY and yield information.

**Query Parameters:**
- `protocols` (required): Comma-separated protocols
- `assets` (optional): Filter by assets
- `chain` (optional): Single chain filter

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/gateway/apy?protocols=aave,compound&chain=ethereum"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "aave": {
      "protocol": "aave",
      "chain": "ethereum",
      "assets": [
        {
          "symbol": "USDC",
          "supplyAPY": 4.5,
          "borrowAPY": 5.2,
          "utilization": 0.75,
          "timestamp": "2025-11-15T10:00:00Z"
        }
      ],
      "source": "moola",
      "confidence": 0.90
    },
    "compound": {
      "protocol": "compound",
      "chain": "ethereum",
      "assets": [
        {
          "symbol": "USDC",
          "supplyAPY": 3.2,
          "borrowAPY": 4.8,
          "utilization": 0.60,
          "timestamp": "2025-11-15T10:00:00Z"
        }
      ],
      "source": "moola",
      "confidence": 0.90
    }
  },
  "metadata": {
    "responseTime": 567,
    "security": {
      "riskScore": 30,
      "ethicalScore": 85,
      "riskLevel": "low",
      "requiresReview": true
    }
  }
}
```

---

#### 4. GET /risk

Fetch protocol risk assessments.

**Query Parameters:**
- `protocols` (required): Comma-separated protocols

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/gateway/risk?protocols=aave,compound,unknown-protocol"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "aave": {
      "protocol": "aave",
      "riskScore": 25,
      "riskLevel": "low",
      "threats": [],
      "audited": true,
      "lastAudit": "2025-06-15",
      "tvl": 10000000000,
      "tvlRanking": 5,
      "timestamp": "2025-11-15T10:00:00Z"
    },
    "compound": {
      "protocol": "compound",
      "riskScore": 30,
      "riskLevel": "low",
      "threats": ["High utilization on some assets"],
      "audited": true,
      "lastAudit": "2025-08-01",
      "tvl": 4000000000
    },
    "unknown-protocol": {
      "protocol": "unknown-protocol",
      "riskScore": 85,
      "riskLevel": "high",
      "threats": ["Unaudited", "New protocol", "Low TVL"],
      "audited": false,
      "tvl": 50000
    }
  },
  "metadata": {
    "security": {
      "riskScore": 45,
      "ethicalScore": 80,
      "riskLevel": "medium"
    }
  }
}
```

---

#### 5. GET /price/:symbol

Fetch single price by symbol with chain preference.

**Path Parameters:**
- `symbol` (required): Symbol to fetch (e.g., "ETH")

**Query Parameters:**
- `chain` (optional): Prefer specific chain

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/gateway/price/ETH?chain=ethereum"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "symbol": "ETH",
    "price": 2500.50,
    "currency": "USD",
    "chain": "ethereum",
    "timestamp": "2025-11-15T10:00:00Z",
    "source": "chainlink",
    "confidence": 0.99
  }
}
```

---

#### 6. GET /health

Service health check.

**Example Request:**
```bash
curl http://localhost:3000/api/v1/gateway/health
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "uptime": 3600,
    "version": "1.0.0",
    "timestamp": "2025-11-15T10:00:00Z",
    "adapters": [
      { "name": "chainlink", "status": "operational" },
      { "name": "uniswap", "status": "operational" },
      { "name": "coingecko", "status": "operational" },
      { "name": "moola", "status": "operational" },
      { "name": "beefyfi", "status": "operational" },
      { "name": "blockchain", "status": "operational" }
    ]
  }
}
```

---

#### 7. GET /stats

Service statistics and metrics.

**Example Request:**
```bash
curl http://localhost:3000/api/v1/gateway/stats
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "service": {
      "uptime": 3600,
      "version": "1.0.0",
      "requestsPerMinute": 150
    },
    "gateway": {
      "totalRequests": 45000,
      "successRate": 0.98,
      "averageResponseTime": 245,
      "adapters": [
        {
          "name": "chainlink",
          "status": "operational",
          "requestsProcessed": 12000,
          "errorRate": 0.01,
          "averageResponseTime": 150,
          "circuitBreaker": "closed"
        }
      ]
    },
    "cache": {
      "hitRate": 0.75,
      "totalHits": 33750,
      "totalMisses": 11250,
      "memoryUsage": "45 MB",
      "cachedItems": 1250
    },
    "security": {
      "totalAssessments": 45000,
      "deniedRequests": 450,
      "denialRate": 0.01,
      "riskScoreAverage": 25,
      "ethicsScoreAverage": 85
    }
  }
}
```

---

#### 8. POST /invalidate-cache

Clear cache by pattern, type, or source.

**Request Body:**
```json
{
  "pattern": "price:*",
  "type": "prices",
  "source": "chainlink"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/gateway/invalidate-cache \
  -H "Content-Type: application/json" \
  -d '{"pattern": "price:*"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "itemsInvalidated": 1250,
    "pattern": "price:*",
    "timestamp": "2025-11-15T10:00:00Z"
  }
}
```

---

## WebSocket API

### Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'jwt-token-here',
    userId: 'user-123'
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('gateway:connected', (data) => {
  console.log('Gateway ready:', data);
});
```

### Events

#### Subscription Events

**gateway:subscribe_prices**

Subscribe to real-time price updates.

```typescript
socket.emit('gateway:subscribe_prices', {
  symbols: ['ETH', 'BTC'],
  chains: ['ethereum'],
  source: 'chainlink'  // optional
}, (response) => {
  if (response.success) {
    console.log('Subscribed:', response.subscriptionId);
  }
});

// Listen for updates
socket.on('gateway:prices_update', (data) => {
  console.log('Price update:', data);
  // {
  //   subscriptionId: 'sub-xxx',
  //   type: 'prices',
  //   data: { ETH: { price: 2500, ... }, ... },
  //   timestamp: '2025-11-15T10:00:00Z'
  // }
});
```

**gateway:subscribe_liquidity**

Subscribe to liquidity updates.

```typescript
socket.emit('gateway:subscribe_liquidity', {
  protocols: ['uniswap', 'aave'],
  pools: ['USDC-ETH'],  // optional
  chain: 'ethereum'
}, (response) => {
  if (response.success) {
    console.log('Subscribed:', response.subscriptionId);
  }
});

socket.on('gateway:liquidity_update', (data) => {
  console.log('Liquidity update:', data);
});
```

**gateway:subscribe_apy**

Subscribe to APY updates.

```typescript
socket.emit('gateway:subscribe_apy', {
  protocols: ['aave', 'compound'],
  assets: ['USDC', 'DAI'],
  chain: 'ethereum'
}, (response) => {
  if (response.success) {
    console.log('Subscribed:', response.subscriptionId);
  }
});

socket.on('gateway:apy_update', (data) => {
  console.log('APY update:', data);
});
```

**gateway:subscribe_risk**

Subscribe to risk assessment updates.

```typescript
socket.emit('gateway:subscribe_risk', {
  protocols: ['aave', 'compound', 'unknown']
}, (response) => {
  if (response.success) {
    console.log('Subscribed:', response.subscriptionId);
  }
});

socket.on('gateway:risk_update', (data) => {
  console.log('Risk update:', data);
});
```

#### Request Events

**gateway:request_data**

One-time data request (non-streaming).

```typescript
socket.emit('gateway:request_data', {
  type: 'prices',
  params: {
    symbols: ['ETH'],
    chains: ['ethereum']
  }
}, (response) => {
  if (response.success) {
    console.log('Price data:', response.data);
  } else {
    console.error('Error:', response.error);
  }
});
```

#### Utility Events

**gateway:unsubscribe**

Cancel a subscription.

```typescript
socket.emit('gateway:unsubscribe', {
  subscriptionId: 'sub-abc123'
}, (response) => {
  if (response.success) {
    console.log('Unsubscribed');
  }
});

socket.on('gateway:unsubscribed', (data) => {
  console.log('Unsubscribed from:', data.subscriptionId);
});
```

**gateway:get_subscriptions**

List active subscriptions.

```typescript
socket.emit('gateway:get_subscriptions', (response) => {
  console.log('Active subscriptions:', response.subscriptions);
  // [
  //   { id: 'sub-1', type: 'prices', ... },
  //   { id: 'sub-2', type: 'apy', ... }
  // ]
});
```

**gateway:health_check**

Check WebSocket connection health.

```typescript
socket.emit('gateway:health_check', (response) => {
  console.log('Healthy:', response.healthy);
  console.log('Timestamp:', response.timestamp);
});
```

**gateway:get_status**

Get full service status.

```typescript
socket.emit('gateway:get_status', (response) => {
  if (response.success) {
    console.log('Service status:', response.data);
  }
});

socket.on('gateway:status', (data) => {
  console.log('Status update:', data);
});
```

---

## Message Bus API

### Publishing Messages

```typescript
import { getMessageBus } from './gateway/message-bus';

const messageBus = getMessageBus();

// Publish price request
await messageBus.publish('gateway:price_request', {
  type: 'gateway:price_request',
  payload: {
    data: { symbols: ['ETH', 'BTC'] },
    requestId: 'req-123'
  },
  timestamp: new Date()
});

// Publish custom request
await messageBus.publish('gateway:custom_request', {
  type: 'gateway:custom_request',
  payload: {
    data: { /* custom data */ },
    requestId: 'req-456'
  },
  timestamp: new Date()
});
```

### Subscribing to Messages

```typescript
// Subscribe to price updates
messageBus.subscribe('gateway:price_update', async (message) => {
  console.log('Price update received:', message.payload.data);
});

// Subscribe to all updates
messageBus.subscribe('gateway:*_update', async (message) => {
  console.log('Any update:', message.type);
});

// Unsubscribe
messageBus.unsubscribe('gateway:price_update');
```

---

## Error Handling

### Standard Error Responses

**400 - Bad Request**
```json
{
  "success": false,
  "error": "Invalid request parameters",
  "details": {
    "field": "symbols",
    "message": "symbols must be a non-empty array"
  }
}
```

**403 - Forbidden / Security Denial**
```json
{
  "success": false,
  "error": "Access denied due to security/ethical concerns",
  "details": {
    "riskLevel": "high",
    "riskScore": 75,
    "ethicalScore": 40,
    "concerns": ["Unaudited protocol", "High risk score"]
  }
}
```

**429 - Too Many Requests**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

**500 - Internal Server Error**
```json
{
  "success": false,
  "error": "Internal server error",
  "requestId": "req-123",
  "timestamp": "2025-11-15T10:00:00Z"
}
```

---

## Authentication

### JWT Token

Include token in Authorization header:

```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3000/api/v1/gateway/prices
```

Or WebSocket auth:

```typescript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'eyJhbGc...',
    userId: 'user-123'
  }
});
```

---

## Rate Limiting

### Limits

- **REST API**: 100 requests per minute per user
- **WebSocket**: Unlimited subscriptions per connection
- **Overall**: Adaptive based on system load

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1700049660
Retry-After: 60
```

---

## Examples

### Example 1: Get Current Prices

```bash
curl "http://localhost:3000/api/v1/gateway/prices?symbols=ETH,BTC,SOL&chains=ethereum"
```

### Example 2: Monitor Aave APY

```typescript
const socket = io('http://localhost:3001');

socket.emit('gateway:subscribe_apy', {
  protocols: ['aave'],
  assets: ['USDC', 'DAI', 'USDT']
});

socket.on('gateway:apy_update', (data) => {
  console.log('Aave APY update:', data.data);
});
```

### Example 3: Check Protocol Risk

```bash
curl "http://localhost:3000/api/v1/gateway/risk?protocols=aave,compound,uniswap"
```

### Example 4: Secure Price Request with Error Handling

```typescript
try {
  const response = await fetch('http://localhost:3000/api/v1/gateway/prices?symbols=ETH', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 403) {
    const { details } = await response.json();
    console.log('Access denied - Security concerns:', details.concerns);
    console.log('Recommendations:', details.recommendations);
  } else if (response.ok) {
    const data = await response.json();
    console.log('Price:', data.data.ETH.price);
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

---

**Last Updated**: 2025-11-15  
**Version**: 1.0.0  
**Status**: Complete ✅
