# Micro-Withdrawal Database Schema

## Tables

### microWithdrawals

Stores individual micro-withdrawal requests from users.

```sql
CREATE TABLE microWithdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL, -- USDC, USDT, cUSD, ETH
  toAddress VARCHAR(255) NOT NULL, -- Ethereum address (0x...)
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, batched, processed, failed, cancelled
  batchId UUID REFERENCES microWithdrawalBatches(id) ON DELETE SET NULL,
  estimatedGasFee DECIMAL(18, 8),
  actualGasFee DECIMAL(18, 8),
  transactionHash VARCHAR(255),
  cancelledAt TIMESTAMP,
  cancelledReason VARCHAR(500),
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP,
  
  CONSTRAINT amount_range CHECK (amount >= 0.50 AND amount <= 10.00),
  CONSTRAINT valid_address CHECK (toAddress ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_currency CHECK (currency IN ('USDC', 'USDT', 'cUSD', 'ETH'))
);

CREATE INDEX idx_microWithdrawals_userId ON microWithdrawals(userId);
CREATE INDEX idx_microWithdrawals_status ON microWithdrawals(status);
CREATE INDEX idx_microWithdrawals_batchId ON microWithdrawals(batchId);
CREATE INDEX idx_microWithdrawals_createdAt ON microWithdrawals(createdAt);
CREATE INDEX idx_microWithdrawals_userId_status ON microWithdrawals(userId, status);
```

### microWithdrawalBatches

Stores batch processing records - consolidates multiple withdrawal requests.

```sql
CREATE TABLE microWithdrawalBatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requestCount INT NOT NULL,
  totalAmount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, processed, failed
  estimatedGasFee DECIMAL(18, 8),
  actualGasFee DECIMAL(18, 8),
  transactionHash VARCHAR(255),
  failureReason VARCHAR(500),
  triggeredBy VARCHAR(50) NOT NULL, -- 'count', 'amount', 'time', 'manual', 'api'
  processedAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  CONSTRAINT valid_trigger CHECK (triggeredBy IN ('count', 'amount', 'time', 'manual', 'api'))
);

CREATE INDEX idx_microWithdrawalBatches_status ON microWithdrawalBatches(status);
CREATE INDEX idx_microWithdrawalBatches_createdAt ON microWithdrawalBatches(createdAt);
CREATE INDEX idx_microWithdrawalBatches_triggeredBy ON microWithdrawalBatches(triggeredBy);
```

## Configuration Constants

```typescript
// Micro-Withdrawal Thresholds
export const MICRO_WITHDRAWAL_CONFIG = {
  // Amount constraints
  MIN_REQUEST_AMOUNT: 0.50,           // Minimum $0.50 per request
  MAX_REQUEST_AMOUNT: 10.00,          // Maximum $10.00 per request
  
  // Batch processing triggers
  BATCH_REQUEST_THRESHOLD: 50,        // Process when 50+ requests pending
  BATCH_AMOUNT_THRESHOLD: 100.00,     // Process when $100+ total pending
  AUTO_BATCH_INTERVAL_HOURS: 24,      // Auto-process if oldest request > 24 hours
  
  // Status values
  STATUS: {
    PENDING: 'pending',               // Awaiting batch processing
    BATCHED: 'batched',               // Included in pending batch
    PROCESSED: 'processed',           // Successfully withdrawn
    FAILED: 'failed',                 // Transaction failed
    CANCELLED: 'cancelled'            // User cancelled
  },
  
  // Supported currencies
  SUPPORTED_CURRENCIES: ['USDC', 'USDT', 'cUSD', 'ETH']
};
```

## Data Flow

### Request Creation
1. User submits micro-withdrawal request (amount: $0.50-$10.00)
2. Request validated and stored as `pending` in `microWithdrawals`
3. `checkAndProcessBatch()` triggered immediately

### Batch Processing Decision
```
Check if ANY threshold met:
├─ Request count: 50+ requests?
├─ Amount total: $100+ total?
└─ Time elapsed: oldest request > 24 hours?

If YES → processBatch()
If NO  → wait for next check
```

### Batch Processing
1. Create `microWithdrawalBatches` record
2. Update all requests: `status = 'batched'`
3. Build multi-transfer blockchain transaction
4. Submit transaction to blockchain
5. On success: `status = 'processed'`, store `transactionHash`
6. On failure: `status = 'failed'`, store `failureReason`
7. Notify all affected users

### Cancellation
1. User requests cancellation (only if `status = 'pending'`)
2. Update request: `status = 'cancelled'`, `cancelledAt = now`
3. Remove from pending batch calculations

## Query Examples

### Get user's pending withdrawals
```sql
SELECT * FROM microWithdrawals
WHERE userId = $1 AND status IN ('pending', 'batched')
ORDER BY createdAt DESC;
```

### Get pending stats (for auto-batch trigger)
```sql
SELECT
  COUNT(*) as pending_count,
  SUM(amount) as total_amount,
  MIN(createdAt) as oldest_request,
  EXTRACT(HOUR FROM (NOW() - MIN(createdAt))) as hours_since_oldest
FROM microWithdrawals
WHERE status = 'pending';
```

### Get processed batches
```sql
SELECT
  b.*,
  COUNT(r.id) as request_count,
  ARRAY_AGG(r.id) as request_ids
FROM microWithdrawalBatches b
LEFT JOIN microWithdrawals r ON r.batchId = b.id
WHERE b.status = 'processed'
ORDER BY b.processedAt DESC
LIMIT 20;
```

### Get user's withdrawal history
```sql
SELECT
  r.*,
  b.transactionHash,
  b.actualGasFee
FROM microWithdrawals r
LEFT JOIN microWithdrawalBatches b ON r.batchId = b.id
WHERE r.userId = $1
ORDER BY r.createdAt DESC;
```

## Audit Trail

All operations are logged in `auditLogs` table with:
- `action`: 'micro_withdrawal_created', 'batch_processed', 'withdrawal_cancelled'
- `userId`: Who performed the action
- `details`: JSON with request/batch IDs and amounts
- `timestamp`: When action occurred

Example audit entries:
```
micro_withdrawal_created: User #123 requested $7 withdrawal
batch_processed: System processed batch #456 with 50 requests, $425 total
withdrawal_cancelled: User #123 cancelled request #789
```

## Notes

- All amounts stored in smallest currency unit (cents for USD, wei for ETH)
- Gas fees calculated and displayed to users for transparency
- Batch processing is atomic - all requests in batch succeed or fail together
- Users can cancel ONLY if `status = 'pending'` (before batching)
- Notification system alerts users when batch completes with transaction hash
- System is designed to save users ~90% on gas fees vs individual transactions
