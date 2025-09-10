
# Vault API Endpoints Documentation

## Overview

The Vault API provides comprehensive endpoints for managing personal and DAO vaults, including deposits, withdrawals, yield strategy allocation, portfolio management, and analytics.

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL

```
/api/vaults
```

## Endpoints

### 1. Create Vault

**POST** `/api/vaults`

Creates a new personal or DAO vault.

**Request Body:**
```json
{
  "name": "My Investment Vault",
  "description": "Long-term investment vault for cUSD and CELO",
  "type": "personal", // or "dao"
  "daoId": "dao-123", // required for DAO vaults
  "isPublic": false,
  "allowedTokens": ["cUSD", "CELO", "cEUR"],
  "lockPeriodDays": 30, // optional
  "yieldStrategy": "conservative" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "vault-123",
    "name": "My Investment Vault",
    "type": "personal",
    "userId": "user-123",
    "tvl": "0",
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "message": "Vault created successfully"
}
```

### 2. Get User's Vaults

**GET** `/api/vaults?type=personal&includeDao=true`

Retrieves all vaults accessible by the authenticated user.

**Query Parameters:**
- `type` (optional): Filter by vault type (`personal` or `dao`)
- `includeDao` (optional): Include DAO vaults user has access to (default: `true`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "vault-123",
      "name": "My Investment Vault",
      "type": "personal",
      "tvl": "1250.75",
      "performance24h": "2.3%",
      "riskScore": "LOW"
    }
  ]
}
```

### 3. Get Vault Details

**GET** `/api/vaults/:vaultId`

Retrieves detailed information about a specific vault.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "vault-123",
    "name": "My Investment Vault",
    "description": "Long-term investment vault",
    "type": "personal",
    "tvl": "1250.75",
    "totalShares": "1000",
    "sharePrice": "1.25",
    "balances": {
      "cUSD": "750.50",
      "CELO": "500.25"
    },
    "allowedTokens": ["cUSD", "CELO"],
    "yieldStrategies": [
      {
        "id": "strategy-1",
        "name": "Conservative Yield",
        "allocation": "40%",
        "apy": "5.2%"
      }
    ],
    "performance": {
      "24h": "2.3%",
      "7d": "8.1%",
      "30d": "15.7%"
    }
  }
}
```

### 4. Deposit to Vault

**POST** `/api/vaults/:vaultId/deposit`

Deposits tokens into a vault.

**Request Body:**
```json
{
  "tokenAddress": "cUSD",
  "amount": "100.50",
  "fromAddress": "0x123...abc"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "tx-123",
    "vaultShares": "80.4",
    "newTvl": "1351.25",
    "sharePrice": "1.25"
  },
  "message": "Deposit completed successfully"
}
```

### 5. Withdraw from Vault

**POST** `/api/vaults/:vaultId/withdraw`

Withdraws tokens from a vault.

**Request Body:**
```json
{
  "tokenAddress": "cUSD",
  "amount": "50.00",
  "toAddress": "0x123...abc",
  "reason": "Emergency withdrawal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "tx-124",
    "sharesRedeemed": "40.0",
    "penalty": "0", // if early withdrawal
    "newTvl": "1301.25"
  },
  "message": "Withdrawal completed successfully"
}
```

### 6. Get Vault Portfolio

**GET** `/api/vaults/:vaultId/portfolio`

Retrieves current portfolio composition and performance.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalValue": "1301.25",
    "tokens": [
      {
        "address": "cUSD",
        "symbol": "cUSD",
        "balance": "700.50",
        "percentage": "53.8%",
        "value": "700.50"
      },
      {
        "address": "CELO",
        "symbol": "CELO",
        "balance": "923.08",
        "percentage": "46.2%",
        "value": "600.75"
      }
    ],
    "strategies": [
      {
        "id": "strategy-1",
        "name": "Conservative Yield",
        "allocation": "520.50",
        "percentage": "40%",
        "apy": "5.2%"
      }
    ]
  }
}
```

### 7. Allocate to Strategy

**POST** `/api/vaults/:vaultId/allocate`

Allocates vault funds to a yield strategy.

**Request Body:**
```json
{
  "tokenAddress": "cUSD",
  "strategyId": "strategy-1",
  "amount": "200.00"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allocationId": "alloc-123",
    "expectedApy": "5.2%",
    "newAllocation": "720.50"
  },
  "message": "Strategy allocation completed successfully"
}
```

### 8. Get Vault Performance

**GET** `/api/vaults/:vaultId/performance?timeframe=30`

Retrieves vault performance metrics over a specified timeframe.

**Query Parameters:**
- `timeframe`: Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "timeframe": 30,
    "totalReturn": "15.7%",
    "annualizedReturn": "192.4%",
    "sharpeRatio": 1.8,
    "volatility": "8.3%",
    "maxDrawdown": "2.1%",
    "performanceHistory": [
      {
        "date": "2024-01-01",
        "value": "1000.00",
        "return": "0%"
      },
      {
        "date": "2024-01-02",
        "value": "1005.20",
        "return": "0.52%"
      }
    ]
  }
}
```

### 9. Assess Vault Risk

**GET** `/api/vaults/:vaultId/risk`

Performs comprehensive risk assessment of the vault.

**Response:**
```json
{
  "success": true,
  "data": {
    "overallScore": "LOW",
    "factors": {
      "concentrationRisk": "MEDIUM",
      "liquidityRisk": "LOW",
      "counterpartyRisk": "LOW",
      "smartContractRisk": "LOW"
    },
    "recommendations": [
      "Consider diversifying token allocation",
      "Monitor yield strategy performance"
    ],
    "riskMetrics": {
      "var95": "5.2%",
      "beta": 0.8,
      "correlation": {
        "BTC": 0.3,
        "ETH": 0.6
      }
    }
  }
}
```

### 10. Get Vault Transactions

**GET** `/api/vaults/:vaultId/transactions?limit=50&type=deposit`

Retrieves transaction history for the vault.

**Query Parameters:**
- `limit`: Number of transactions to return (default: 50)
- `offset`: Pagination offset (default: 0)
- `type`: Filter by transaction type (`deposit`, `withdrawal`, `allocation`)
- `tokenAddress`: Filter by token
- `dateFrom`: Start date (ISO format)
- `dateTo`: End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "tx-123",
        "type": "deposit",
        "tokenAddress": "cUSD",
        "tokenSymbol": "cUSD",
        "amount": "100.50",
        "sharesIssued": "80.4",
        "timestamp": "2024-01-15T10:00:00Z",
        "userId": "user-123",
        "status": "completed"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### 11. Get Supported Tokens

**GET** `/api/tokens`

Retrieves list of supported tokens for vault operations.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "address": "cUSD",
      "symbol": "cUSD",
      "name": "Celo Dollar",
      "decimals": 18,
      "price": "1.00",
      "supported": true
    },
    {
      "address": "CELO",
      "symbol": "CELO",
      "name": "Celo",
      "decimals": 18,
      "price": "0.65",
      "supported": true
    }
  ]
}
```

### 12. Get Token Price

**GET** `/api/tokens/:tokenAddress/price`

Retrieves current price for a specific token.

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenAddress": "CELO",
    "price": "0.65"
  }
}
```

### 13. Rebalance Vault

**POST** `/api/vaults/:vaultId/rebalance`

Triggers automatic rebalancing of vault assets according to strategy targets.

**Response:**
```json
{
  "success": true,
  "data": {
    "rebalanceId": "rebal-123",
    "oldAllocations": {
      "cUSD": "60%",
      "CELO": "40%"
    },
    "newAllocations": {
      "cUSD": "50%",
      "CELO": "50%"
    },
    "transactionCount": 3,
    "estimatedGas": "0.0025"
  },
  "message": "Vault rebalanced successfully"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE", // optional
  "details": {} // optional validation errors
}
```

## Common HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (vault not found)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

## Rate Limiting

Vault endpoints are rate-limited:
- General endpoints: 100 requests per minute
- Transaction endpoints: 20 requests per minute
- Analytics endpoints: 50 requests per minute

## Security Notes

1. All vault operations require proper authentication
2. DAO vault operations require appropriate membership roles
3. Withdrawal operations from DAO vaults require `admin` or `elder` roles
4. All financial operations use precise decimal arithmetic
5. Database transactions ensure atomicity of multi-step operations
