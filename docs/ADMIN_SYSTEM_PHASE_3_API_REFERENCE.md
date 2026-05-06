# Phase 3 API Quick Reference Guide

## Base Endpoint
```
http://localhost:3000/api/multichain
```

---

## 1. ✅ Get Service Account Status

**Endpoint:** `GET /api/multichain/status`

**Auth:** Required (Bearer token)

**Response:**
```json
{
  "status": "ready",
  "totalLiquidity": "15.5",
  "chainBalances": {
    "ethereum": 2.5,
    "polygon": 5.0,
    "bsc": 3.5,
    "arbitrum": 2.0,
    "optimism": 1.5,
    "tron": 0.8,
    "avalanche": 0.2
  },
  "liquidityScore": 7,
  "riskScore": 3,
  "recommendations": [
    "Balance between Polygon and BSC",
    "Increase Avalanche liquidity"
  ],
  "lastUpdate": "2026-02-14T12:30:00Z"
}
```

---

## 2. 🎯 Get Routing Options

**Endpoint:** `POST /api/multichain/routing-options`

**Auth:** Required

**Request:**
```json
{
  "targetChain": "polygon",
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000",
  "priority": "balanced"
}
```

**Response:**
```json
{
  "options": [
    {
      "id": 1,
      "method": "direct",
      "sourceChain": "ethereum",
      "targetChain": "polygon",
      "estimatedTimeSeconds": 45,
      "totalCostUSD": 15.50,
      "gasCost": 8.20,
      "bridgeFee": 7.30,
      "riskLevel": "low",
      "confidence": 0.95
    },
    {
      "id": 2,
      "method": "bridge",
      "sourceChain": "bsc",
      "targetChain": "polygon",
      "bridgeProtocol": "stargate",
      "estimatedTimeSeconds": 120,
      "totalCostUSD": 12.75,
      "gasCost": 5.50,
      "bridgeFee": 7.25,
      "riskLevel": "low",
      "confidence": 0.92
    },
    {
      "id": 3,
      "method": "swap_bridge",
      "sourceChain": "arbitrum",
      "targetChain": "polygon",
      "bridgeProtocol": "axelar",
      "estimatedTimeSeconds": 180,
      "totalCostUSD": 9.80,
      "gasCost": 2.50,
      "swapSlippage": 1.2,
      "bridgeFee": 6.10,
      "riskLevel": "medium",
      "confidence": 0.88
    }
  ],
  "recommendation": "Option #1 (direct) - Best balance of cost and speed"
}
```

---

## 3. 🚀 Execute Withdrawal

**Endpoint:** `POST /api/multichain/execute`

**Auth:** Required

**Request:**
```json
{
  "targetChain": "polygon",
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000",
  "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f825e",
  "routingOptionId": 1,
  "password": "user_password_hash"
}
```

**Response (Success):**
```json
{
  "success": true,
  "withdrawalId": "wd_1708009200000_a7b9c2d",
  "transactionHash": "0x1234567890abcdef...",
  "status": "bridging",
  "estimatedCompletionTime": 120,
  "estimatedCost": "15.50",
  "bridgeProtocol": "stargate",
  "sourceChain": "ethereum",
  "targetChain": "polygon",
  "amount": "1000",
  "pollingInterval": 15000
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Insufficient balance on source chain",
  "details": {
    "required": "1000.5",
    "available": "500.0",
    "sourceChain": "ethereum"
  }
}
```

---

## 4. 📊 Check Withdrawal Status

**Endpoint:** `GET /api/multichain/withdrawal/:withdrawalId`

**Auth:** Required

**Example:**
```
GET /api/multichain/withdrawal/wd_1708009200000_a7b9c2d
```

**Response (In Progress):**
```json
{
  "withdrawalId": "wd_1708009200000_a7b9c2d",
  "status": "bridging",
  "confirmations": 5,
  "totalConfirmationsNeeded": 12,
  "sourceChain": "ethereum",
  "targetChain": "polygon",
  "amount": "1000",
  "sourceTransactionHash": "0x111...",
  "bridgeTransactionHash": "0x222...",
  "estimatedTimeRemaining": 90,
  "elapsedTime": 30,
  "progressPercent": 45
}
```

**Response (Completed):**
```json
{
  "withdrawalId": "wd_1708009200000_a7b9c2d",
  "status": "completed",
  "confirmations": 12,
  "sourceChain": "ethereum",
  "targetChain": "polygon",
  "amount": "1000",
  "sourceTransactionHash": "0x111...",
  "bridgeTransactionHash": "0x222...",
  "targetTransactionHash": "0x333...",
  "actualTime": 125,
  "actualCost": "15.45",
  "completedAt": "2026-02-14T12:32:05Z"
}
```

**Response (Failed):**
```json
{
  "withdrawalId": "wd_1708009200000_a7b9c2d",
  "status": "failed",
  "failureReason": "Bridge contract rejected transfer - insufficient liquidity",
  "sourceChain": "ethereum",
  "targetChain": "polygon",
  "amount": "1000",
  "failedAt": "2026-02-14T12:32:05Z"
}
```

---

## 5. 📜 Get Withdrawal History

**Endpoint:** `GET /api/multichain/history?limit=20&offset=0`

**Auth:** Required

**Query Parameters:**
- `limit` (optional): Number of records (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (pending|completed|failed)
- `chainFilter` (optional): Filter by target chain

**Response:**
```json
{
  "total": 42,
  "limit": 20,
  "offset": 0,
  "withdrawals": [
    {
      "withdrawalId": "wd_1708009200000_a7b9c2d",
      "sourceChain": "ethereum",
      "targetChain": "polygon",
      "amount": "1000",
      "token": "USDC",
      "status": "completed",
      "costUSD": "15.45",
      "timeSeconds": 125,
      "createdAt": "2026-02-14T12:30:00Z",
      "completedAt": "2026-02-14T12:32:05Z"
    },
    {
      "withdrawalId": "wd_1708008900000_x3y4z5p",
      "sourceChain": "bsc",
      "targetChain": "arbitrum",
      "amount": "5000",
      "token": "USDC",
      "status": "completed",
      "costUSD": "8.20",
      "timeSeconds": 240,
      "createdAt": "2026-02-14T12:25:00Z",
      "completedAt": "2026-02-14T12:29:00Z"
    }
  ]
}
```

---

## 6. ❌ Cancel Withdrawal

**Endpoint:** `POST /api/multichain/cancel/:withdrawalId`

**Auth:** Required

**Example:**
```
POST /api/multichain/cancel/wd_1708009200000_a7b9c2d
```

**Response (Success):**
```json
{
  "success": true,
  "withdrawalId": "wd_1708009200000_a7b9c2d",
  "message": "Withdrawal cancelled successfully",
  "status": "cancelled",
  "cancelledAt": "2026-02-14T12:31:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Cannot cancel withdrawal in confirmed status",
  "currentStatus": "confirmed"
}
```

---

## 7. 🌐 Get Supported Chains

**Endpoint:** `GET /api/multichain/supported-chains`

**Auth:** Not required

**Response:**
```json
{
  "chains": [
    {
      "name": "ethereum",
      "chainId": 1,
      "network": "Mainnet",
      "available": true,
      "liquidity": 2.5,
      "native": "ETH",
      "status": "healthy"
    },
    {
      "name": "polygon",
      "chainId": 137,
      "network": "Mainnet",
      "available": true,
      "liquidity": 5.0,
      "native": "MATIC",
      "status": "healthy"
    },
    {
      "name": "bsc",
      "chainId": 56,
      "network": "Mainnet",
      "available": true,
      "liquidity": 3.5,
      "native": "BNB",
      "status": "healthy"
    },
    {
      "name": "arbitrum",
      "chainId": 42161,
      "network": "Mainnet",
      "available": true,
      "liquidity": 2.0,
      "native": "ETH",
      "status": "healthy"
    },
    {
      "name": "optimism",
      "chainId": 10,
      "network": "Mainnet",
      "available": true,
      "liquidity": 1.5,
      "native": "ETH",
      "status": "healthy"
    },
    {
      "name": "tron",
      "chainId": null,
      "network": "Mainnet",
      "available": true,
      "liquidity": 0.8,
      "native": "TRX",
      "status": "healthy"
    },
    {
      "name": "avalanche",
      "chainId": 43114,
      "network": "Mainnet",
      "available": true,
      "liquidity": 0.2,
      "native": "AVAX",
      "status": "healthy"
    }
  ]
}
```

---

## 8. 🌉 Get Bridge Protocols

**Endpoint:** `GET /api/multichain/bridge-protocols?sourceChain=ethereum&targetChain=polygon`

**Auth:** Not required

**Query Parameters:**
- `sourceChain` (optional): Source chain
- `targetChain` (optional): Target chain

**Response:**
```json
{
  "protocols": [
    {
      "protocol": "stargate",
      "name": "Stargate Finance",
      "description": "Optimized for stablecoin transfers",
      "estimatedTime": "5-15",
      "fee": "0.1%",
      "minAmount": "100",
      "maxAmount": "1000000",
      "riskLevel": "low",
      "supportedChains": [
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche"
      ]
    },
    {
      "protocol": "layerzero",
      "name": "LayerZero",
      "description": "General-purpose cross-chain messaging",
      "estimatedTime": "10-20",
      "fee": "0.3%",
      "minAmount": "50",
      "maxAmount": "5000000",
      "riskLevel": "low",
      "supportedChains": [
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche"
      ]
    },
    {
      "protocol": "axelar",
      "name": "Axelar",
      "description": "Cross-chain coordination protocol",
      "estimatedTime": "20-40",
      "fee": "0.4%",
      "minAmount": "50",
      "maxAmount": "2000000",
      "riskLevel": "low",
      "supportedChains": [
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche"
      ]
    },
    {
      "protocol": "wormhole",
      "name": "Wormhole",
      "description": "Fast attestation-based bridging",
      "estimatedTime": "5-10",
      "fee": "0.25%",
      "minAmount": "1",
      "maxAmount": "10000000",
      "riskLevel": "medium",
      "supportedChains": [
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche"
      ]
    }
  ]
}
```

---

## Integration Examples

### JavaScript/Node.js

```javascript
// Get routing options
const response = await fetch('/api/multichain/routing-options', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    targetChain: 'polygon',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    amount: '1000',
    priority: 'balanced'
  })
});

const options = await response.json();
console.log(options);

// Execute withdrawal
const execResponse = await fetch('/api/multichain/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    targetChain: 'polygon',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    amount: '1000',
    recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f825e',
    routingOptionId: 1,
    password: 'user_password_hash'
  })
});

const result = await execResponse.json();
console.log(`Withdrawal initiated: ${result.withdrawalId}`);

// Poll status
const statusResponse = await fetch(
  `/api/multichain/withdrawal/${result.withdrawalId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const status = await statusResponse.json();
console.log(`Status: ${status.status}, Progress: ${status.progressPercent}%`);
```

---

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 200 | SUCCESS | Operation completed successfully |
| 400 | INVALID_REQUEST | Invalid parameters or missing fields |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Withdrawal ID not found |
| 422 | VALIDATION_ERROR | Request validation failed |
| 500 | SERVER_ERROR | Internal server error |
| 503 | SERVICE_UNAVAILABLE | Bridge service temporarily unavailable |

---

## Rate Limits

- API calls: 100 requests per minute per user
- Simultaneous withdrawals: 5 per user
- Withdrawal history: 1000 records max

---

**Documentation Version:** Phase 3.0
**Last Updated:** February 14, 2026
