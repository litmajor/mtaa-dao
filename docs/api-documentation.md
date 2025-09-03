
# MtaaDAO API Documentation

## Overview

The MtaaDAO API provides comprehensive endpoints for managing decentralized autonomous organization (DAO) operations, including wallet management, governance, reputation systems, and more.

**Base URL:** `https://your-repl-url.replit.app/api`

## Authentication

Most endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "johndoe"
}
```

#### POST /api/auth/refresh
Refresh an expired JWT token.

**Headers:**
```
Authorization: Bearer <refresh-token>
```

## Wallet Endpoints

### GET /api/wallet/balance
Get user's wallet balance for all supported tokens.

**Response:**
```json
{
  "balances": {
    "CELO": "125.50",
    "cUSD": "1,250.75",
    "cEUR": "500.25"
  },
  "totalValueUSD": "2,876.50"
}
```

### POST /api/wallet/transfer
Transfer tokens between wallets.

**Request Body:**
```json
{
  "to": "0x1234...5678",
  "amount": "100.50",
  "token": "cUSD",
  "memo": "Payment for services"
}
```

**Response:**
```json
{
  "transactionHash": "0xabcd...ef12",
  "status": "pending"
}
```

### GET /api/wallet/transactions
Get transaction history.

**Query Parameters:**
- `limit` (optional): Number of transactions to return (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `token` (optional): Filter by token type

**Response:**
```json
{
  "transactions": [
    {
      "id": "tx-123",
      "hash": "0xabcd...ef12",
      "from": "0x1234...5678",
      "to": "0x8765...4321",
      "amount": "100.50",
      "token": "cUSD",
      "timestamp": "2024-01-15T10:30:00Z",
      "status": "confirmed",
      "memo": "Payment for services"
    }
  ],
  "total": 145,
  "hasMore": true
}
```

## Governance Endpoints

### GET /api/governance/proposals
Get list of governance proposals.

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `active`, `passed`, `failed`)
- `limit` (optional): Number of proposals to return
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "proposals": [
    {
      "id": "prop-123",
      "title": "Increase Community Vault Interest Rate",
      "description": "Proposal to increase the interest rate from 5% to 7%",
      "proposer": "0x1234...5678",
      "status": "active",
      "votesFor": "1,250,000",
      "votesAgainst": "350,000",
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-22T10:00:00Z",
      "quorum": "2,000,000",
      "passed": null
    }
  ]
}
```

### POST /api/governance/proposals
Create a new governance proposal.

**Request Body:**
```json
{
  "title": "New Proposal Title",
  "description": "Detailed description of the proposal",
  "category": "treasury",
  "votingDuration": 7,
  "quorum": "1000000"
}
```

### POST /api/governance/proposals/:id/vote
Vote on a governance proposal.

**Request Body:**
```json
{
  "vote": "for",
  "amount": "1000.50"
}
```

## Reputation System

### GET /api/reputation/leaderboard
Get reputation leaderboard.

**Response:**
```json
{
  "leaderboard": [
    {
      "userId": "user-123",
      "username": "johndoe",
      "reputation": 2500,
      "rank": 1,
      "badges": ["contributor", "validator"]
    }
  ]
}
```

### GET /api/reputation/user/:userId
Get reputation details for a specific user.

**Response:**
```json
{
  "userId": "user-123",
  "reputation": 2500,
  "level": "Expert",
  "badges": ["contributor", "validator"],
  "history": [
    {
      "action": "proposal_passed",
      "points": 100,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Notification Endpoints

### GET /api/notifications
Get user notifications.

**Query Parameters:**
- `read` (optional): Filter by read status (`true`, `false`)
- `type` (optional): Filter by notification type
- `limit` (optional): Number of notifications to return

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif-123",
      "type": "proposal_update",
      "title": "Proposal Voting Started",
      "message": "Voting has started for your proposal",
      "read": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "data": {
        "proposalId": "prop-123"
      }
    }
  ],
  "unreadCount": 5
}
```

### PATCH /api/notifications/:id/read
Mark a notification as read.

**Response:**
```json
{
  "message": "Notification marked as read"
}
```

## Analytics Endpoints

### GET /api/analytics/dashboard
Get dashboard analytics data.

**Response:**
```json
{
  "overview": {
    "totalUsers": 1500,
    "totalTransactions": 25000,
    "totalVolumeUSD": "5,250,000",
    "activeProposals": 5
  },
  "chartData": {
    "transactionVolume": [
      { "date": "2024-01-01", "volume": 125000 },
      { "date": "2024-01-02", "volume": 132000 }
    ],
    "userGrowth": [
      { "date": "2024-01-01", "users": 1450 },
      { "date": "2024-01-02", "users": 1500 }
    ]
  }
}
```

## Health Check Endpoints

### GET /api/health
Basic health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400
}
```

### GET /api/health/detailed
Detailed health check with component status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "status": "pass", "responseTime": 25 },
    "redis": { "status": "pass", "responseTime": 5 },
    "memory": { "status": "pass", "details": { "heapUsed": "245.67MB" } }
  },
  "metrics": {
    "healthScore": 95,
    "responseTime": 45,
    "errorRate": 0.02
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:

- **General endpoints**: 100 requests per minute
- **Authentication endpoints**: 10 requests per minute
- **Transaction endpoints**: 20 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @mtaadao/api-client
```

```typescript
import { MtaaDAOClient } from '@mtaadao/api-client';

const client = new MtaaDAOClient({
  baseURL: 'https://your-repl-url.replit.app/api',
  apiKey: 'your-api-key'
});

const balance = await client.wallet.getBalance();
```

## Webhooks

Configure webhooks to receive real-time notifications about events:

### Supported Events

- `transaction.completed`
- `proposal.created`
- `proposal.voted`
- `reputation.updated`

### Webhook Payload Example

```json
{
  "event": "transaction.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "transactionId": "tx-123",
    "hash": "0xabcd...ef12",
    "amount": "100.50",
    "token": "cUSD"
  }
}
```

## Support

For API support and questions:

- **Documentation**: [https://docs.mtaadao.org](https://docs.mtaadao.org)
- **Email**: api-support@mtaadao.org
- **Discord**: [MtaaDAO Community](https://discord.gg/mtaadao)

## Changelog

### v1.2.0 (2024-01-15)
- Added reputation system endpoints
- Enhanced analytics data
- Improved error handling

### v1.1.0 (2024-01-01)
- Added notification endpoints
- Implemented webhooks
- Added rate limiting

### v1.0.0 (2023-12-15)
- Initial API release
- Core wallet and governance endpoints
