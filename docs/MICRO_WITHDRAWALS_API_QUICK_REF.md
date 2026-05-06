# Micro-Withdrawals API Quick Reference

## Base URL
```
/api/micro-withdrawals
```

## Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/request` | ✅ | Submit withdrawal request |
| GET | `/pending` | ✅ | Get user's pending requests |
| POST | `/cancel` | ✅ | Cancel pending request |
| GET | `/batch/:batchId` | ✅ | Get batch details |
| GET | `/stats` | ❌ | Get system statistics |
| POST | `/process-batch` | ✅ Admin | Manual batch trigger |
| POST | `/check-batch` | ❌ | Check if batch should process |

---

## Detailed Endpoints

### 1. POST /request
**Submit a micro-withdrawal request**

```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/request \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "7.50",
    "currency": "USDC",
    "toAddress": "0x1234567890123456789012345678901234567890"
  }'
```

**Success Response (200)**
```json
{
  "success": true,
  "withdrawal": {
    "id": "req_abc123",
    "userId": "user_xyz789",
    "amount": "7.50",
    "currency": "USDC",
    "toAddress": "0x1234567890123456789012345678901234567890",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z",
    "message": "Withdrawal request created. Will be batched within 24 hours."
  }
}
```

**Error Responses**
```json
// 400 - Invalid amount
{
  "success": false,
  "error": "INVALID_AMOUNT",
  "message": "Amount must be between $0.50 and $10.00"
}

// 400 - Invalid address
{
  "success": false,
  "error": "INVALID_ADDRESS",
  "message": "Invalid Ethereum address format"
}

// 400 - Invalid currency
{
  "success": false,
  "error": "INVALID_CURRENCY",
  "message": "Currency must be one of: USDC, USDT, cUSD, ETH"
}

// 401 - Not authenticated
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}

// 500 - Server error
{
  "success": false,
  "error": "DATABASE_ERROR",
  "message": "Failed to create withdrawal request"
}
```

**Constraints**
- `amount`: 0.50 ≤ amount ≤ 10.00
- `currency`: "USDC" | "USDT" | "cUSD" | "ETH"
- `toAddress`: Valid Ethereum address (0x followed by 40 hex chars)

---

### 2. GET /pending
**Get user's pending and batched withdrawal requests**

```bash
curl http://localhost:3000/api/micro-withdrawals/pending \
  -H "Authorization: Bearer TOKEN"
```

**Success Response (200)**
```json
{
  "success": true,
  "withdrawals": [
    {
      "id": "req_abc123",
      "userId": "user_xyz789",
      "amount": "7.50",
      "currency": "USDC",
      "toAddress": "0x1234567890123456789012345678901234567890",
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00Z",
      "estimatedGasFee": "2.50"
    },
    {
      "id": "req_def456",
      "userId": "user_xyz789",
      "amount": "5.00",
      "currency": "USDT",
      "toAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "status": "batched",
      "batchId": "batch_789",
      "createdAt": "2024-01-15T11:00:00Z",
      "estimatedGasFee": "2.00"
    },
    {
      "id": "req_ghi789",
      "userId": "user_xyz789",
      "amount": "10.00",
      "currency": "ETH",
      "toAddress": "0x1111111111111111111111111111111111111111",
      "status": "processed",
      "batchId": "batch_456",
      "transactionHash": "0x7f8c4d3b2a1e9f6c5d4e3f2a1b0c9d8e...",
      "actualGasFee": "3.50",
      "processedAt": "2024-01-14T14:30:00Z"
    }
  ]
}
```

**Status Values**
- `pending` - Awaiting batch processing
- `batched` - Included in batch (processing soon)
- `processed` - Successfully withdrawn
- `failed` - Transaction failed
- `cancelled` - User cancelled

---

### 3. POST /cancel
**Cancel a pending withdrawal request**

```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/cancel \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_abc123"}'
```

**Success Response (200)**
```json
{
  "success": true,
  "message": "Withdrawal request cancelled successfully",
  "cancelled": {
    "id": "req_abc123",
    "status": "cancelled",
    "cancelledAt": "2024-01-15T12:00:00Z"
  }
}
```

**Error Responses**
```json
// 404 - Not found
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Withdrawal request not found"
}

// 400 - Cannot cancel
{
  "success": false,
  "error": "INVALID_STATUS",
  "message": "Cannot cancel request with status 'batched'. Only pending requests can be cancelled."
}

// 403 - Forbidden
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "You don't have permission to cancel this request"
}
```

---

### 4. GET /batch/:batchId
**Get details about a processed batch**

```bash
curl http://localhost:3000/api/micro-withdrawals/batch/batch_456
```

**Success Response (200)**
```json
{
  "success": true,
  "batch": {
    "id": "batch_456",
    "requestCount": 50,
    "totalAmount": "425.00",
    "currency": "USDC",
    "status": "processed",
    "transactionHash": "0x7f8c4d3b2a1e9f6c5d4e3f2a1b0c9d8eabcdef01",
    "estimatedGasFee": "45.00",
    "actualGasFee": "39.00",
    "gasPerUser": "0.78",
    "triggeredBy": "count",
    "processedAt": "2024-01-15T14:30:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "requests": [
      {
        "id": "req_abc123",
        "userId": "user_xyz789",
        "amount": "7.50",
        "currency": "USDC",
        "toAddress": "0x1234567890123456789012345678901234567890",
        "userShare": "0.61"
      },
      // ... 49 more requests
    ]
  }
}
```

**Fields**
- `gasPerUser`: Gas fee shared equally among all users in batch
- `userShare`: User's proportional share of gas fee
- `triggeredBy`: What triggered this batch ("count", "amount", "time", "manual", "api")

---

### 5. GET /stats
**Get system-wide micro-withdrawal statistics** (PUBLIC endpoint)

```bash
curl http://localhost:3000/api/micro-withdrawals/stats
```

**Success Response (200)**
```json
{
  "success": true,
  "stats": {
    "pendingCount": 42,
    "batchedCount": 8,
    "totalPendingAmount": "287.50",
    "oldestRequestAge": 18,
    "oldestRequestTime": "2024-01-14T16:30:00Z",
    "estimatedProcessTime": "~6 hours",
    "nextAutoProcessAt": "2024-01-16T10:30:00Z",
    "totalProcessedBatches": 1523,
    "totalWithdrawn": "98234.50",
    "averageGasSavings": "82%",
    "systemHealth": "healthy"
  }
}
```

**Interpretation**
- `pendingCount`: Number of pending requests (awaiting batch)
- `batchedCount`: Number already in active batch
- `totalPendingAmount`: Total $ amount pending
- `oldestRequestAge`: Hours since oldest request
- `estimatedProcessTime`: When batch will likely process
- `nextAutoProcessAt`: When 24-hour timer expires

---

### 6. POST /process-batch
**Manually trigger batch processing** (ADMIN ONLY)

```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/process-batch \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Manual batch processing for testing"}'
```

**Success Response (200)**
```json
{
  "success": true,
  "batch": {
    "id": "batch_789",
    "requestCount": 50,
    "totalAmount": "425.00",
    "status": "processing",
    "transactionHash": "0xpending...",
    "estimatedGasFee": "39.00",
    "message": "Batch processing initiated. 50 requests queued for blockchain submission."
  }
}
```

**Error Responses**
```json
// 403 - Not admin
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Admin access required"
}

// 400 - No requests to process
{
  "success": false,
  "error": "NO_REQUESTS",
  "message": "No pending requests to process"
}

// 500 - Processing error
{
  "success": false,
  "error": "PROCESSING_ERROR",
  "message": "Failed to process batch: blockchain timeout"
}
```

---

### 7. POST /check-batch
**Check if batch should auto-process** (SYSTEM endpoint)

```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/check-batch \
  -H "Content-Type: application/json"
```

**Success Response (200)**
```json
{
  "success": true,
  "shouldProcess": true,
  "reason": "amount_threshold",
  "details": {
    "pendingCount": 42,
    "totalAmount": "325.50",
    "oldestRequestHours": 18,
    "thresholdsMet": {
      "countThreshold": false,
      "amountThreshold": true,
      "timeThreshold": false
    },
    "nextCheckIn": "Immediately"
  }
}
```

**Possible Reasons**
- `"count_threshold"` - 50+ pending requests
- `"amount_threshold"` - $100+ total pending
- `"time_threshold"` - 24+ hours elapsed
- `"none"` - No threshold met, check again later

**Response when no action needed**
```json
{
  "success": true,
  "shouldProcess": false,
  "reason": "none",
  "details": {
    "pendingCount": 15,
    "totalAmount": "95.50",
    "oldestRequestHours": 6,
    "nextCheckIn": "~18 hours"
  }
}
```

---

## Common Patterns

### Get user's withdrawal history
```bash
curl http://localhost:3000/api/micro-withdrawals/pending \
  -H "Authorization: Bearer TOKEN"
```
Returns all pending/batched/processed/failed/cancelled requests for the user.

### Check system status
```bash
curl http://localhost:3000/api/micro-withdrawals/stats
```
Returns current pending requests, amounts, processing time estimates.

### Lookup processed batch
```bash
curl http://localhost:3000/api/micro-withdrawals/batch/batch_456
```
Get transaction hash and which requests were in the batch.

### Trigger batch processing (admin only)
```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/process-batch \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
Force immediate batch processing (useful for testing or emergency processing).

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_AMOUNT` | 400 | Amount outside $0.50-$10.00 range |
| `INVALID_ADDRESS` | 400 | Not a valid Ethereum address |
| `INVALID_CURRENCY` | 400 | Currency not in whitelist |
| `INVALID_STATUS` | 400 | Cannot perform action on this status |
| `NOT_FOUND` | 404 | Request or batch not found |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions (admin required) |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `BLOCKCHAIN_ERROR` | 500 | Blockchain transaction failed |
| `PROCESSING_ERROR` | 500 | Batch processing failed |
| `NO_REQUESTS` | 400 | No pending requests to process |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Authentication required |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Server error |

---

## Testing with cURL

### Create withdrawal request
```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/request \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "currency": "USDC",
    "toAddress": "0xE3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }'
```

### List pending requests
```bash
curl http://localhost:3000/api/micro-withdrawals/pending \
  -H "Authorization: Bearer eyJhbGc..."
```

### Cancel request
```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/cancel \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_abc123"}'
```

### Check system stats
```bash
curl http://localhost:3000/api/micro-withdrawals/stats
```

### Manual batch trigger (admin)
```bash
curl -X POST http://localhost:3000/api/micro-withdrawals/process-batch \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Testing"}'
```

---

## Response Format

All responses follow this format:

**Success**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}
```

**Error**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

---

## Configuration

**Limits**
- Min amount: $0.50
- Max amount: $10.00
- Batch count threshold: 50 requests
- Batch amount threshold: $100
- Auto-batch interval: 24 hours

**Supported Currencies**
- USDC
- USDT
- cUSD
- ETH

---

**Last Updated**: 2024-01-15
**Version**: 1.0
