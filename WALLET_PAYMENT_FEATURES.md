# Wallet Payment Features: Bill Splits & Recurring Payments

**Version**: 1.0  
**Status**: Ready for Integration  
**Last Updated**: January 21, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Bill Split Feature](#bill-split-feature)
3. [Recurring Payments Feature](#recurring-payments-feature)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Implementation Guide](#implementation-guide)
7. [Usage Examples](#usage-examples)

---

## Overview

Added two powerful payment management features to the MTAA wallet:

### 1. **Bill Split** - Split expenses among multiple users/DAOs
- Divide costs equally, by percentage, or custom amounts
- Track who paid what
- Settle payments individually or in bulk
- Support for both users and DAOs

### 2. **Recurring Payments** - Automate regular payments
- Set up salary, subscription, loan, or allowance payments
- Multiple recipients per payment (distribute to user + DAO + wallet)
- Daily, weekly, monthly, quarterly, or annual frequency
- Auto-execute or require confirmation
- Pause/resume anytime
- Execution history and retry logic

---

## Bill Split Feature

### Purpose

Users can create a bill split, add participants, and track who owes what. Perfect for:
- Splitting restaurant bills
- Shared accommodation costs
- Team expenses (with DAO treasury support)
- Group projects
- Conference trip costs

### How It Works

```
1. User creates bill split with total amount
2. Specify split method:
   - Equal: Divide equally among all participants
   - Custom: Set exact amount per person
   - Percentage: Allocate by percentage
   - Weighted: Advanced allocation
3. Add participants (users, DAOs, or wallet addresses)
4. Participants see what they owe
5. Record payments as they come in
6. Mark as settled when complete
```

### Bill Split Status Flow

```
ACTIVE → SETTLED
  ↓
CANCELLED
```

### Participant Payment Status

```
PENDING → PARTIALLY_PAID → PAID
```

### Data Model

```typescript
BillSplit {
  id: uuid
  creatorId: userId          // Who created the split
  daoId?: uuid               // Optional: DAO level split
  title: string              // "Dinner Party", "Team Retreat"
  description?: string
  totalAmount: decimal       // Total amount to split
  currency: string           // cUSD, ETH, USDC, etc
  splitMethod: enum          // equal | custom | percentage | weighted
  settlementMethod: enum     // direct | settle_later
  status: enum               // active | settled | cancelled
  createdAt: timestamp
  updatedAt: timestamp
}

BillSplitParticipant {
  id: uuid
  billSplitId: uuid          // Reference to bill split
  userId?: string            // User participant
  daoId?: uuid               // DAO participant
  walletAddress?: string     // Direct wallet payment
  sharePercentage?: decimal  // For percentage split
  customAmount?: decimal     // For custom split
  amountOwed: decimal        // Final amount they owe
  amountPaid: decimal        // How much they've paid
  paidAt?: timestamp         // When they paid
  status: enum               // pending | partially_paid | paid
  transactionHash?: string   // Blockchain tx hash
}

BillSplitPayment {
  id: uuid
  billSplitId: uuid
  paymentId: uuid            // Reference to participant
  paidBy: userId
  amount: decimal
  transactionHash: string
  status: enum               // pending | confirmed | failed
  confirmations: integer
  createdAt: timestamp
  confirmedAt?: timestamp
}
```

---

## Recurring Payments Feature

### Purpose

Users can set up automatic recurring payments to:
- Pay salaries to team members
- Make subscription payments
- Repay loans on schedule
- Send allowances
- Pay DAO treasury fees
- Distribute to multiple recipients

### How It Works

```
1. Create recurring payment with frequency
2. Specify recipient(s):
   - Single user
   - DAO treasury
   - External wallet
   - Multiple recipients (split %)
3. Choose frequency:
   - Daily, Weekly, Biweekly
   - Monthly (specific day)
   - Quarterly, Annual
   - Custom (cron expression)
4. Auto-execute on schedule OR require confirmation
5. Track execution history
6. Pause/resume anytime
7. Automatic retry on failure
```

### Payment Frequency Examples

```typescript
// Daily
frequency: 'daily'
interval: 1

// Every 2 weeks
frequency: 'biweekly'
interval: 1

// Every 5 days
frequency: 'custom'
interval: 5

// Monthly on 15th
frequency: 'monthly'
dayOfMonth: 15

// Every 3 months
frequency: 'quarterly'
interval: 1

// Quarterly on 1st
frequency: 'quarterly'
dayOfMonth: 1
```

### Payment Status Flow

```
PENDING → PROCESSING → COMPLETED
                    ↓
                   FAILED → RETRY
```

### Data Model

```typescript
RecurringPayment {
  id: uuid
  creatorId: userId             // Who set up the payment
  recipientId?: string          // Single recipient user
  recipientDaoId?: uuid         // Single recipient DAO
  recipientWalletAddress?: string // Direct wallet
  amount: decimal               // Amount per payment
  currency: string              // cUSD, USDC, MTAA, etc
  description?: string
  paymentType: string           // 'salary', 'subscription', 'loan_repayment'
  frequency: enum               // daily | weekly | biweekly | monthly | etc
  interval: integer             // Repeat every N frequency units
  startDate: timestamp          // When to start
  endDate?: timestamp           // When to stop (null = indefinite)
  maxOccurrences?: integer      // Max number of payments
  occurrenceCount: integer      // How many have executed
  dayOfMonth?: integer          // For monthly: day 1-31
  dayOfWeek?: string            // For weekly: MON, TUE, etc
  customCronExpression?: string // For advanced scheduling
  nextPaymentDate: timestamp    // Next scheduled payment
  isActive: boolean             // Currently active?
  autoExecute: boolean          // Auto-execute or require confirmation?
  requireConfirmation: boolean  // Recipient must confirm?
  createdAt: timestamp
  updatedAt: timestamp
}

RecurringPaymentExecution {
  id: uuid
  recurringPaymentId: uuid      // Reference to recurring payment
  executionDate: timestamp      // When this payment executed
  amount: decimal               // Amount paid
  status: enum                  // pending | processing | completed | failed | skipped
  transactionHash?: string      // Blockchain tx hash
  errorMessage?: string         // Why it failed (if failed)
  confirmations: integer        // Block confirmations
  attempts: integer             // Retry count
  maxAttempts: integer          // Max retries (default 3)
  nextRetryDate?: timestamp     // When to retry if failed
  createdAt: timestamp
  completedAt?: timestamp
}

RecurringPaymentRecipient {
  id: uuid
  recurringPaymentId: uuid      // Reference to recurring payment
  userId?: string               // Recipient user
  daoId?: uuid                  // Recipient DAO
  walletAddress?: string        // Recipient wallet
  receivePercentage: decimal    // % of payment (for splits)
  customAmount?: decimal        // Fixed amount for this recipient
  recipientOrder: integer       // Order of payment (1st, 2nd, etc)
}
```

---

## Database Schema

### New Tables

```sql
-- Bill Split Tables
CREATE TABLE bill_splits (
  id UUID PRIMARY KEY,
  creator_id VARCHAR NOT NULL REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  title TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(18,8) NOT NULL,
  currency VARCHAR DEFAULT 'cUSD',
  split_method VARCHAR, -- equal, custom, percentage, weighted
  settlement_method VARCHAR DEFAULT 'direct',
  status VARCHAR DEFAULT 'active', -- active, settled, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bill_split_participants (
  id UUID PRIMARY KEY,
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  wallet_address VARCHAR,
  share_percentage DECIMAL(5,2),
  custom_amount DECIMAL(18,8),
  amount_owed DECIMAL(18,8) NOT NULL,
  amount_paid DECIMAL(18,8) DEFAULT 0,
  paid_at TIMESTAMP,
  payment_method VARCHAR,
  status VARCHAR DEFAULT 'pending', -- pending, partially_paid, paid
  transaction_hash VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bill_split_payments (
  id UUID PRIMARY KEY,
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES bill_split_participants(id),
  paid_by VARCHAR REFERENCES users(id),
  amount DECIMAL(18,8) NOT NULL,
  transaction_hash VARCHAR,
  status VARCHAR DEFAULT 'pending', -- pending, confirmed, failed
  confirmations INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

-- Recurring Payment Tables
CREATE TABLE recurring_payments (
  id UUID PRIMARY KEY,
  creator_id VARCHAR NOT NULL REFERENCES users(id),
  recipient_id VARCHAR REFERENCES users(id),
  recipient_dao_id UUID REFERENCES daos(id),
  recipient_wallet_address VARCHAR,
  amount DECIMAL(18,8) NOT NULL,
  currency VARCHAR DEFAULT 'cUSD',
  description TEXT,
  payment_type VARCHAR NOT NULL,
  frequency VARCHAR NOT NULL, -- daily, weekly, biweekly, monthly, quarterly, annual, custom
  interval INTEGER DEFAULT 1,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  max_occurrences INTEGER,
  occurrence_count INTEGER DEFAULT 0,
  day_of_month INTEGER,
  day_of_week VARCHAR,
  custom_cron_expression VARCHAR,
  next_payment_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_execute BOOLEAN DEFAULT true,
  require_confirmation BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recurring_payment_executions (
  id UUID PRIMARY KEY,
  recurring_payment_id UUID NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
  execution_date TIMESTAMP NOT NULL,
  amount DECIMAL(18,8) NOT NULL,
  status VARCHAR DEFAULT 'pending', -- pending, processing, completed, failed, skipped
  transaction_hash VARCHAR,
  error_message TEXT,
  confirmations INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_retry_date TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE recurring_payment_recipients (
  id UUID PRIMARY KEY,
  recurring_payment_id UUID NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  wallet_address VARCHAR,
  receive_percentage DECIMAL(5,2) DEFAULT 100,
  custom_amount DECIMAL(18,8),
  recipient_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bill_splits_creator ON bill_splits(creator_id);
CREATE INDEX idx_bill_splits_dao ON bill_splits(dao_id);
CREATE INDEX idx_bill_split_participants_bill ON bill_split_participants(bill_split_id);
CREATE INDEX idx_recurring_payments_creator ON recurring_payments(creator_id);
CREATE INDEX idx_recurring_payments_recipient ON recurring_payments(recipient_id);
CREATE INDEX idx_recurring_payments_dao ON recurring_payments(recipient_dao_id);
CREATE INDEX idx_recurring_payments_next ON recurring_payments(next_payment_date);
CREATE INDEX idx_recurring_executions_payment ON recurring_payment_executions(recurring_payment_id);
```

---

## API Reference

### Bill Split Endpoints

#### Create Bill Split
```
POST /api/wallet/bill-split
Content-Type: application/json

{
  "title": "Team Dinner",
  "description": "Company team dinner expense",
  "totalAmount": "150.00",
  "currency": "cUSD",
  "splitMethod": "equal",
  "participants": [
    {
      "userId": "user1-id",
      "sharePercentage": null,
      "customAmount": null
    },
    {
      "userId": "user2-id"
    },
    {
      "daoId": "dao-treasury-id",
      "customAmount": "50.00"
    }
  ]
}

Response:
{
  "success": true,
  "message": "Bill split created",
  "billSplit": {
    "id": "split-uuid",
    "creatorId": "user-id",
    "title": "Team Dinner",
    "totalAmount": "150.00",
    "status": "active",
    "splitMethod": "equal",
    "createdAt": "2026-01-21T14:00:00Z"
  }
}
```

#### Get All Bill Splits
```
GET /api/wallet/bill-splits?status=active

Response:
{
  "success": true,
  "billSplits": [...],
  "count": 5
}
```

#### Get Bill Split Details
```
GET /api/wallet/bill-split/:id

Response:
{
  "success": true,
  "billSplit": {...},
  "participants": [...],
  "settlement": {
    "totalOwed": "150.00",
    "totalPaid": "50.00",
    "outstanding": "100.00",
    "settled": false
  }
}
```

#### Record Payment
```
POST /api/wallet/bill-split/:id/payment
Content-Type: application/json

{
  "participantId": "participant-uuid",
  "transactionHash": "0x...",
  "amount": "50.00"
}

Response:
{
  "success": true,
  "message": "Payment recorded successfully"
}
```

#### Settle Bill Split
```
POST /api/wallet/bill-split/:id/settle

Response:
{
  "success": true,
  "message": "Bill split settled"
}
```

---

### Recurring Payment Endpoints

#### Create Recurring Payment
```
POST /api/wallet/recurring-payment
Content-Type: application/json

{
  "recipientId": "user-id",
  "amount": "1000.00",
  "currency": "cUSD",
  "description": "Monthly salary",
  "paymentType": "salary",
  "frequency": "monthly",
  "dayOfMonth": 15,
  "startDate": "2026-02-15T00:00:00Z",
  "endDate": null,
  "maxOccurrences": null,
  "autoExecute": true,
  "requireConfirmation": false,
  "recipients": [
    {
      "userId": "user-id",
      "receivePercentage": 70
    },
    {
      "daoId": "dao-treasury-id",
      "receivePercentage": 30
    }
  ]
}

Response:
{
  "success": true,
  "message": "Recurring payment created",
  "recurringPayment": {
    "id": "recurring-uuid",
    "creatorId": "user-id",
    "amount": "1000.00",
    "frequency": "monthly",
    "nextPaymentDate": "2026-02-15T00:00:00Z",
    "isActive": true,
    "createdAt": "2026-01-21T14:00:00Z"
  }
}
```

#### Get All Recurring Payments
```
GET /api/wallet/recurring-payments?type=created&isActive=true

Response:
{
  "success": true,
  "payments": [...],
  "count": 3,
  "type": "created"
}
```

#### Get Recurring Payment Details
```
GET /api/wallet/recurring-payment/:id

Response:
{
  "success": true,
  "payment": {
    "id": "recurring-uuid",
    "amount": "1000.00",
    "frequency": "monthly",
    "nextPaymentDate": "2026-02-15T00:00:00Z",
    "isActive": true
  },
  "recipients": [
    {
      "userId": "user-id",
      "receivePercentage": 70
    }
  ],
  "recentExecutions": [
    {
      "id": "execution-uuid",
      "executionDate": "2026-01-21T14:00:00Z",
      "status": "completed",
      "amount": "1000.00"
    }
  ]
}
```

#### Execute Recurring Payment
```
POST /api/wallet/recurring-payment/:id/execute

Response:
{
  "success": true,
  "message": "Payment execution initiated",
  "executionId": "execution-uuid"
}
```

#### Cancel Recurring Payment
```
POST /api/wallet/recurring-payment/:id/cancel

Response:
{
  "success": true,
  "message": "Recurring payment cancelled"
}
```

#### Pause Recurring Payment
```
POST /api/wallet/recurring-payment/:id/pause

Response:
{
  "success": true,
  "message": "Recurring payment paused"
}
```

#### Resume Recurring Payment
```
POST /api/wallet/recurring-payment/:id/resume

Response:
{
  "success": true,
  "message": "Recurring payment resumed"
}
```

---

## Implementation Guide

### Step 1: Database Migration

Run the SQL schema migration to create the new tables:

```bash
npm run migrate
```

Or manually run the migration file (see Database Schema section above).

### Step 2: Import Services

```typescript
import {
  createBillSplit,
  getBillSplitDetails,
  recordBillSplitPayment,
  settleBillSplit,
} from '@server/services/billSplitService';

import {
  createMultiRecipientRecurringPayment,
  executeMultiRecipientPayment,
  getRecurringPaymentWithRecipients,
  cancelRecurringPaymentWithDAO,
} from '@server/services/recurringPaymentService';
```

### Step 3: Mount Routes

In `server/app.ts` or main router file:

```typescript
import paymentFeaturesRouter from '@server/routes/payment-features';

app.use('/api/wallet', paymentFeaturesRouter);
```

### Step 4: Test Endpoints

```bash
# Create bill split
curl -X POST http://localhost:3000/api/wallet/bill-split \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Create recurring payment
curl -X POST http://localhost:3000/api/wallet/recurring-payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## Usage Examples

### Bill Split Example

```typescript
// Create a split for 3 people equally
const billSplit = await createBillSplit({
  creatorId: 'alice-id',
  title: 'Dinner Party',
  totalAmount: '90',
  currency: 'cUSD',
  splitMethod: 'equal',
  participants: [
    { userId: 'alice-id' },
    { userId: 'bob-id' },
    { userId: 'charlie-id' }
  ]
});

// Each person owes $30

// Alice pays her share
await recordBillSplitPayment(
  'participant-uuid-alice',
  '0xabc123...', // tx hash
  '30'
);

// Bob pays his share
await recordBillSplitPayment(
  'participant-uuid-bob',
  '0xdef456...',
  '30'
);

// Charlie pays his share
await recordBillSplitPayment(
  'participant-uuid-charlie',
  '0xghi789...',
  '30'
);

// Mark as settled
await settleBillSplit(billSplit.id);
```

### Recurring Payment Example

```typescript
// Set up salary payment
const salary = await createMultiRecipientRecurringPayment(
  {
    creatorId: 'company-id',
    recipientId: 'employee-id',
    amount: '1000',
    currency: 'cUSD',
    paymentType: 'salary',
    frequency: 'monthly',
    dayOfMonth: 15,
    startDate: new Date('2026-02-15'),
    autoExecute: true,
  },
  [
    {
      userId: 'employee-id',
      receivePercentage: 80
    },
    {
      daoId: 'tax-dao-id',
      receivePercentage: 20
    }
  ]
);

// Or subscribe to auto-execution
import { getPendingMultiRecipientExecutions } from '@server/services/recurringPaymentService';

// Run every minute (in a background job)
setInterval(async () => {
  const executions = await getPendingMultiRecipientExecutions();
  console.log(`Executing ${executions.length} pending payments`);
}, 60000);
```

---

## Integration Checklist

- [ ] Database migration created and run
- [ ] Bill split service implemented
- [ ] Recurring payment service enhanced
- [ ] API routes mounted
- [ ] Authentication middleware configured
- [ ] Notification service integrated
- [ ] Background job for auto-execution configured
- [ ] Webhook support for external execution
- [ ] UI components created (bill split form, recurring payment manager)
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Load testing completed (1000+ concurrent bills)
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] User documentation written

---

## Security Considerations

1. **Authentication**: All endpoints require `isAuthenticated` middleware
2. **Authorization**: Users can only see/modify their own bills/payments
3. **Transaction Validation**: Verify transaction hash before marking as paid
4. **Amount Validation**: Enforce total ≤ participant amounts combined
5. **Rate Limiting**: Apply rate limits to prevent spam
6. **Encryption**: Sensitive data (wallet addresses) should be encrypted
7. **Audit Logging**: Log all payment attempts and modifications

---

## Performance Optimization

1. **Indexing**: Indexes on creator_id, next_payment_date for fast lookups
2. **Pagination**: Return max 50 items per request
3. **Caching**: Cache frequently accessed bill splits (5 min TTL)
4. **Batch Operations**: Group multiple payments in single transaction
5. **Background Jobs**: Execute recurring payments in background queue
6. **Database Partitioning**: Partition execution table by year

---

## Future Enhancements

1. **Mobile App**: iOS/Android bill split and recurring payment tracking
2. **Notifications**: SMS/Email reminders for upcoming payments
3. **Analytics**: Dashboard showing payment trends and stats
4. **Templates**: Save bill split and recurring payment templates
5. **Groups**: Create permanent groups for regular splits
6. **Expense Categorization**: Tag bills for expense tracking
7. **Integration with Accounting**: Export to QuickBooks, Xero
8. **Multi-Currency**: Support cross-currency payments
9. **Approval Workflows**: Multi-approver for DAO payments
10. **Escrow**: Hold payments in escrow until conditions met

---

**Created**: January 21, 2026  
**Status**: Ready for Development  
**Next Steps**: Database migration → Service implementation → Integration testing
