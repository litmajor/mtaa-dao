# Treasury Routes API Quick Reference

## High-Level Architecture

```
/api/dao/:daoId/treasury/
├── GET   /balance          ← View balances (all members, read-only)
├── GET   /history          ← View transaction history (all members, read-only)
├── POST  /deposit          ← Add funds (admin/elder, 10/5min)
├── POST  /withdraw         ← Initiate withdrawal (admin/elder, 2/10min) ⚠️
└── POST  /approve          ← Approve withdrawal (admin/elder, 5/min) ⚠️
```

---

## Quick Usage Examples

### Check Treasury Balance
```bash
curl -X GET http://localhost:3000/api/dao/dao-123/treasury/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "balances": {
    "total": 50000,
    "available": 45000,
    "pending": 5000
  },
  "currency": "cUSD"
}
```

---

### View Transaction History
```bash
curl -X GET "http://localhost:3000/api/dao/dao-123/treasury/history?type=treasury_withdrawal&status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Withdraw from Treasury (Admin/Elder only)
```bash
curl -X POST http://localhost:3000/api/dao/dao-123/treasury/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "cUSD",
    "recipient": "treasury-manager@dao.io",
    "reason": "Emergency operational expenses",
    "requiresMultiSig": true
  }'
```

**Response:**
```json
{
  "success": true,
  "withdrawalId": "txn-abc123",
  "amount": 5000,
  "status": "pending",
  "requiresMultiSig": true,
  "nextSteps": "Awaiting approval from other DAO admins/elders"
}
```

---

### Approve Treasury Withdrawal (Admin/Elder only)
```bash
curl -X POST http://localhost:3000/api/dao/dao-123/treasury/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "withdrawalId": "txn-abc123",
    "approved": true,
    "approverComment": "Verified operational necessity"
  }'
```

---

### Deposit to Treasury (Admin/Elder only)
```bash
curl -X POST http://localhost:3000/api/dao/dao-123/treasury/deposit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "currency": "cUSD",
    "source": "aave_returns",
    "description": "Monthly yield distribution"
  }'
```

---

## Rate Limits Summary

| Endpoint | Method | Limit | Time Window | Required Role |
|----------|--------|-------|-------------|---------------|
| `/balance` | GET | 30 | 1 min | Any member |
| `/history` | GET | 30 | 1 min | Any member |
| `/deposit` | POST | 10 | 5 min | Admin/Elder |
| `/withdraw` | POST | 2 | 10 min | Admin/Elder |
| `/approve` | POST | 5 | 1 min | Admin/Elder |

**Note:** Rate limits are per user, not per DAO.

---

## Security Stack per Endpoint

### Read Endpoints (balance, history)
```
1. authenticate        ← JWT validation
2. requireDaoMembership ← DAO member check
3. rateLimitPerUser    ← 30/min
```

### Write Endpoints (deposit, withdraw, approve)
```
1. authenticate         ← JWT validation
2. requireDaoMembership ← DAO member check
3. requireDaoAdminOnly  ← Admin/Elder check (STRICT)
4. rateLimitPerUser     ← 2-10/min depending on op
5. auditConsolidated    ← Critical/high severity log
```

---

## Withdrawal Flow

### Single-Approval Withdrawal (requiresMultiSig=false)
```
Admin initiates POST /withdraw
  ↓
Validation + balance check
  ↓
Create transaction (status='completed')
  ↓
Funds released immediately
  ↓
Audit logged at critical severity
```

### Multi-Signature Withdrawal (requiresMultiSig=true)
```
Admin A initiates POST /withdraw
  ↓
Create transaction (status='pending')
  ↓
Metadata.approvals = []
  ↓
Admin B calls POST /approve (approved=true)
  ↓
Metadata.approvals += [Admin B's vote]
  ↓
[TODO: If approvals >= required_threshold]
  ↓
  ├─ Update status='completed' (funds released)
  └─ Notify requestor
```

---

## Error Responses

### Insufficient Balance
```json
{
  "error": "Insufficient treasury balance",
  "available": 45000,
  "requested": 50000
}
```

### Not Authorized
```json
{
  "error": "Only DAO admins/elders can perform treasury operations",
  "yourRole": "moderator"
}
```

### Rate Limited
```json
{
  "error": "Rate limit exceeded",
  "limit": "2 per 10min",
  "nextRetry": "2024-01-15T10:52:30Z"
}
```

---

## Integration Instructions

### 1. Add to DAO Router

In `server/routes/dao/index.ts`:

```typescript
import treasuryRouter from './treasury';

router.use('/:daoId/treasury', treasuryRouter);
```

### 2. Verify Dependencies

Treasury routes require:
- ✅ `walletTransactions` table with metadata JSON field
- ✅ `daoMemberships` table with role field
- ✅ `daoAccounts` table
- ✅ `auditConsolidated` service
- ✅ `rateLimitPerUser` middleware
- ✅ `authenticate` middleware (JWT)

### 3. Test Rate Limiting

```bash
# These 30 balance calls in 1 min = OK
for i in {1..30}; do
  curl -X GET http://localhost:3000/api/dao/dao-123/treasury/balance \
    -H "Authorization: Bearer TOKEN"
done

# 31st call = Rate limited
curl -X GET http://localhost:3000/api/dao/dao-123/treasury/balance \
  -H "Authorization: Bearer TOKEN"
# Response: 429 Too Many Requests
```

---

## TODOs & Future Work

- [ ] Implement multi-sig approval logic (N of M votes)
- [ ] Add 2FA requirement for amounts > $5000
- [ ] Create notification system for pending approvals
- [ ] Add withdrawal rejection workflow
- [ ] Create admin dashboard UI
- [ ] Add budget forecasting
- [ ] Multi-currency analytics

