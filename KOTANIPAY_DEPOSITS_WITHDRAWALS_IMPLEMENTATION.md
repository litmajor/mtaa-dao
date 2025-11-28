# KotaniPay Deposits & Withdrawals Implementation Guide

## Overview

Comprehensive guide for implementing M-Pesa ↔ cUSD conversions through KotaniPay integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MtaaDAO Platform                         │
└─────────────────────────────────────────────────────────────┘
         ▲                                          ▲
         │                                          │
    DEPOSITS                                   WITHDRAWALS
    (M-Pesa → cUSD)                           (cUSD → M-Pesa)
         │                                          │
         ▼                                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   KotaniPay Service                           │
│  - Balance Management                                         │
│  - Fee Tracking                                               │
│  - Transaction Reconciliation                                │
│  - Webhook Handling                                           │
└──────────────────────────────────────────────────────────────┘
         ▲                                          ▲
         │                                          │
    STK Push                                   B2C Transfer
  (User confirms)                            (Auto send)
         │                                          │
         ▼                                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   KotaniPay API                               │
│                 (Sandbox/Production)                          │
└──────────────────────────────────────────────────────────────┘
         ▲                                          ▲
         │                                          │
    M-Pesa Network                            M-Pesa Network
```

## Key Features

### 1. Deposits (M-Pesa → cUSD)

**Flow:**
1. User initiates deposit via `/api/deposits/initiate`
2. KotaniPay sends STK push to M-Pesa phone number
3. User enters PIN to confirm payment
4. M-Pesa webhook notifies backend
5. Funds converted and credited to cUSD wallet

**Fee Structure:**
- Base fee: 1.5% of deposit amount
- Example: 5,000 KES deposit → 75 KES fee → 4,925 KES → ~32.83 cUSD received

### 2. Withdrawals (cUSD → M-Pesa)

**Flow:**
1. User initiates withdrawal via `/api/withdrawals/initiate`
2. cUSD amount immediately deducted from balance (locked)
3. KotaniPay B2C transfer to M-Pesa account
4. M-Pesa webhook confirms delivery
5. User receives M-Pesa notification

**Fee Structure:**
- Withdrawal fee: 2% of cUSD amount
- Example: 100 cUSD withdrawal → 2 cUSD fee → 98 cUSD → ~14,700 KES sent

## API Endpoints

### Deposits

```bash
# Initiate Deposit
POST /api/deposits/initiate
{
  "userId": "user-uuid",
  "phone": "+254712345678",
  "amountKES": 5000,
  "reference": "REF123456",
  "daoId": "dao-uuid" // optional
}

Response:
{
  "success": true,
  "data": {
    "transactionId": "DEP-1700000000000-abc123def",
    "status": "pending",
    "amountKES": 5000,
    "estimatedCUSD": 32.83,
    "exchangeRate": 150,
    "fee": 75,
    "message": "Deposit initiated. Please enter M-Pesa PIN to confirm."
  }
}

# Check Deposit Status
GET /api/deposits/status/:transactionId

Response:
{
  "success": true,
  "data": {
    "transactionId": "DEP-1700000000000-abc123def",
    "status": "completed",
    "type": "deposit",
    "amountKES": 5000,
    "amountCUSD": 32.83,
    "exchangeRate": 150,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:35:00Z",
    "receipt": "QGN7MZ61SU"
  }
}
```

### Withdrawals

```bash
# Initiate Withdrawal
POST /api/withdrawals/initiate
{
  "userId": "user-uuid",
  "phone": "+254712345678",
  "amountCUSD": 100,
  "daoId": "dao-uuid" // optional
}

Response:
{
  "success": true,
  "data": {
    "transactionId": "WD-1700000000000-xyz789uvw",
    "status": "pending",
    "amountCUSD": 100,
    "estimatedKES": 14700,
    "exchangeRate": 150,
    "fee": 2,
    "message": "Withdrawal initiated. You will receive M-Pesa notification shortly."
  }
}

# Check Withdrawal Status
GET /api/withdrawals/status/:transactionId
```

### Transaction History

```bash
# Get User's Transaction History
GET /api/transactions/history?userId=user-uuid&type=deposit&limit=50&offset=0

Response:
{
  "success": true,
  "data": [
    {
      "transactionId": "DEP-1700000000000-abc123def",
      "type": "deposit",
      "status": "completed",
      "amountKES": 5000,
      "amountCUSD": 32.83,
      "exchangeRate": 150,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:35:00Z"
    }
  ]
}

# Get Transaction Summary
GET /api/transactions/summary?userId=user-uuid

Response:
{
  "success": true,
  "data": {
    "totalDeposits": 500,
    "totalWithdrawals": 200,
    "completedDeposits": 12,
    "completedWithdrawals": 8,
    "pendingTransactions": 2,
    "failedTransactions": 1
  }
}
```

## Database Schema

### mpesa_transactions Table
```sql
CREATE TABLE mpesa_transactions (
  id UUID PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  transaction_type VARCHAR, -- 'stk_push', 'b2c'
  phone_number VARCHAR,
  amount DECIMAL(10,2),
  account_reference VARCHAR,
  transaction_desc VARCHAR,
  
  -- M-Pesa IDs
  merchant_request_id VARCHAR,
  checkout_request_id VARCHAR,
  conversation_id VARCHAR,
  mpesa_receipt_number VARCHAR UNIQUE,
  
  -- Status & Timing
  status VARCHAR, -- pending, processing, completed, failed
  result_code VARCHAR,
  result_desc VARCHAR,
  callback_received BOOLEAN,
  callback_at TIMESTAMP,
  
  -- Retry
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMP,
  failure_reason TEXT,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### user_balances Table
```sql
CREATE TABLE user_balances (
  id UUID PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  currency VARCHAR, -- cUSD, CELO, KES, MTAA
  available_balance DECIMAL(18,8),
  pending_balance DECIMAL(18,8),
  locked_balance DECIMAL(18,8),
  total_balance DECIMAL(18,8),
  last_transaction_id UUID,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, dao_id, currency)
);
```

### transaction_fees Table
```sql
CREATE TABLE transaction_fees (
  id UUID PRIMARY KEY,
  transaction_id UUID,
  transaction_type VARCHAR, -- 'mpesa_deposit', 'mpesa_withdrawal'
  fee_type VARCHAR, -- 'platform_fee'
  fee_category VARCHAR,
  base_amount DECIMAL(18,8),
  fee_amount DECIMAL(18,8),
  fee_percentage DECIMAL(5,4),
  currency VARCHAR,
  paid_by VARCHAR REFERENCES users(id),
  platform_revenue DECIMAL(18,8),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Service Implementation

### KotanipayService Class

**Location:** `server/services/kotanipayService.ts`

**Key Methods:**

1. **initiateDeposit(request)** - Start M-Pesa deposit process
2. **completeDeposit(transactionId, receipt, data)** - Finalize after M-Pesa confirmation
3. **failDeposit(transactionId, reason)** - Handle failed deposits
4. **initiateWithdrawal(request)** - Start cUSD to M-Pesa withdrawal
5. **completeWithdrawal(transactionId, mpesaResponse)** - Finalize M-Pesa transfer
6. **refundWithdrawal(transactionId)** - Return cUSD on failure
7. **updateUserBalance(userId, currency, amount, operation)** - Real-time balance updates
8. **recordFee(feeData)** - Track platform fees

### Balance Management

```typescript
// Add funds to user wallet
await KotanipayService.updateUserBalance(
  userId,
  'cUSD',
  32.83,
  'add',
  daoId
);

// Deduct funds for withdrawal
await KotanipayService.updateUserBalance(
  userId,
  'cUSD',
  100,
  'subtract',
  daoId
);
```

## Webhook Configuration

### KotaniPay Webhook Setup

```bash
# Webhook Endpoints
POST /api/deposits/webhook       # M-Pesa deposit confirmations
POST /api/withdrawals/webhook    # M-Pesa withdrawal confirmations

# Webhook Payload Example
{
  "transactionId": "DEP-1700000000000-abc123def",
  "status": "completed",
  "mpesaReceipt": "QGN7MZ61SU",
  "amount": 5000,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## Fee Structure Configuration

**Environment Variables:**
```env
# Exchange Rate (1 cUSD = 150 KES)
EXCHANGE_RATE=150

# Fee Percentages
DEPOSIT_FEE_PERCENTAGE=0.015  # 1.5%
WITHDRAWAL_FEE_PERCENTAGE=0.02 # 2%

# KotaniPay API
KOTANI_API_URL=https://api.kotaniapi.com
KOTANIPAY_API_KEY=your_api_key
KOTANIPAY_SECRET_KEY=your_secret_key
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Balance**
   ```
   Error: Insufficient balance. Available: 50 cUSD, Requested: 100 cUSD
   ```

2. **Invalid Phone Number**
   ```
   Error: Invalid M-Pesa phone number. Expected format: +254712345678
   ```

3. **Transaction Not Found**
   ```
   Error: Transaction not found: DEP-1700000000000-abc123def
   ```

4. **M-Pesa Transfer Failed**
   ```
   Status: failed
   Reason: User cancelled M-Pesa prompt
   Recovery: Funds refunded to wallet
   ```

## Testing Checklist

- [ ] **Deposit Flow**
  - [ ] User can initiate deposit with valid phone/amount
  - [ ] STK push sent correctly
  - [ ] Balance updated after M-Pesa confirmation
  - [ ] Fee calculated and recorded
  - [ ] Notification sent to user
  - [ ] Transaction history shows deposit

- [ ] **Withdrawal Flow**
  - [ ] User can initiate withdrawal with valid data
  - [ ] Balance immediately locked
  - [ ] B2C transfer initiated
  - [ ] User receives M-Pesa notification
  - [ ] Fee deducted and recorded
  - [ ] Failed withdrawals trigger refund

- [ ] **Balance Management**
  - [ ] Real-time balance updates
  - [ ] Prevents withdrawals exceeding balance
  - [ ] Correctly calculates available/pending/locked balances

- [ ] **Transaction History**
  - [ ] Users can view their deposit/withdrawal history
  - [ ] Filtering by type works
  - [ ] Summary statistics accurate

- [ ] **Error Handling**
  - [ ] Invalid inputs rejected with clear errors
  - [ ] Network failures gracefully handled
  - [ ] Duplicate transactions prevented

## Monitoring & Analytics

### Key Metrics to Track

1. **Transaction Volume**
   - Daily deposits/withdrawals count
   - Total daily deposit/withdrawal KES/cUSD

2. **Success Rates**
   - % of completed vs failed transactions
   - Average completion time

3. **Fee Revenue**
   - Platform fee collection
   - Revenue by transaction type

4. **User Engagement**
   - Active deposit/withdrawal users
   - Average transaction size
   - User retention

### SQL Queries for Analytics

```sql
-- Daily deposit summary
SELECT 
  DATE(created_at) as date,
  COUNT(*) as count,
  SUM(CAST(amount AS DECIMAL)) as total_kes,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM mpesa_transactions
WHERE transaction_type = 'stk_push'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- User deposit history
SELECT 
  user_id,
  COUNT(*) as total_deposits,
  SUM(CAST(amount AS DECIMAL)) as total_deposited,
  AVG(CAST(amount AS DECIMAL)) as avg_deposit,
  MAX(created_at) as last_deposit
FROM mpesa_transactions
WHERE transaction_type = 'stk_push' AND status = 'completed'
GROUP BY user_id;

-- Fee collection
SELECT 
  DATE(created_at) as date,
  SUM(CAST(fee_amount AS DECIMAL)) as total_fees,
  fee_category,
  COUNT(*) as count
FROM transaction_fees
GROUP BY DATE(created_at), fee_category
ORDER BY date DESC;
```

## Security Considerations

1. **Webhook Verification** - Verify KotaniPay webhook signatures
2. **Rate Limiting** - Prevent spam deposits/withdrawals
3. **Balance Validation** - Ensure funds available before processing
4. **Transaction Idempotency** - Handle duplicate requests gracefully
5. **Data Encryption** - Encrypt sensitive phone numbers in transit
6. **Audit Logging** - Log all financial transactions

## Production Deployment Checklist

- [ ] KotaniPay API credentials configured
- [ ] Database migrations applied
- [ ] Webhook endpoints secured with API keys
- [ ] Exchange rates configured
- [ ] Fee percentages reviewed
- [ ] Error notifications setup
- [ ] Monitoring dashboards created
- [ ] Runbooks documented
- [ ] Backup/recovery procedures tested
- [ ] User documentation written

## Next Steps

1. **Phase 1:** Deploy and test deposit flow
2. **Phase 2:** Deploy and test withdrawal flow
3. **Phase 3:** Implement advanced features
   - Recurring deposits/withdrawals
   - Multi-currency swaps
   - Escrow integration
4. **Phase 4:** Analytics and reporting
5. **Phase 5:** AI-powered recommendations
