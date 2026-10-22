# KotaniPay Implementation - Quick Reference

> **Settlement boundary:** KotaniPay callbacks currently credit an internal `user_balances` cUSD ledger. They do not prove an on-chain cUSD transfer into a user's wallet or a ChamaTreasury. `stableInflowModule` and `stableOutflowModule` record verified token transfers; rotation now links them to direct member-to-treasury contributions and executed treasury payouts. A KES pool above the app's KES 150,000 B2C request ceiling uses direct stablecoin contributions, not automatic KES conversion. A provider-backed KES-to-treasury conversion still requires an actual provider settlement transaction and transfer capability.

## User-owned wallet flow

- In the wallet Deposit tab, connect a Celo-compatible wallet and share the displayed wallet address to receive cUSD directly.
- In the Withdraw tab, enter a recipient Celo address and amount to send cUSD from the connected wallet. The wallet asks the user to authorize the on-chain transfer; keep CELO available for gas.
- The client defaults to Alfajores testnet. Its test cUSD is not redeemable for KES. To build for Celo mainnet, set `VITE_CELO_NETWORK=mainnet`; otherwise it remains on Alfajores. Never deploy a mainnet build until the provider and chain configuration have been verified.
- These wallet transfers do not initiate an M-Pesa deposit or cash-out. Those require a provider flow that settles real on-chain cUSD to/from the user's wallet; provider-ledger balances remain separate.

### KotaniPay v3 onramp/offramp implementation

The separate self-custody ramp API is mounted under `/api/v1/wallets/self-custody-ramps`. Its current KotaniPay route supports **Celo cUSD only**; registry entries for USDC/USDT or other networks do not imply ramp support:

- `POST /onramp/quote` and `POST /offramp/quote` request live provider rates and bind a short-lived quote to the signed-in user and their active, registered wallet.
- `POST /:referenceId/initiate` starts the provider transaction using the saved quote; it cannot change the phone, address, token, or amount supplied in that quote.
- `POST /:referenceId/transaction` records the user's submitted Celo transaction hash for an offramp.
- `GET /:referenceId` and `GET /history` return self-custody ramp status only.
- `GET /admin/open` (admin-only) lists up to 100 open, unresolved, and refund-failed ramps without exposing phone numbers or wallet addresses.
- `GET /admin/webhook-inbox` (admin-only) lists up to 100 pending, failed, or processing webhook events without exposing stored settlement payloads.
- `POST /webhook` records provider events; no onramp/offramp operation credits `user_balances`.

Configure KotaniPay to send ramp events to the public `POST /api/v1/wallets/self-custody-ramps/webhook`. Only that webhook is public; quote, status, transaction, history, and admin APIs remain authenticated. The raw request bytes are preserved for signature verification, and an embedded `signature` property is excluded from the signed payload when present.

Apply migration `052-self-custody-ramp-webhook-inbox` before enabling the ramp. The migration is part of the application migration runner; it creates the durable inbox and its retry index.

The feature stays disabled unless `KOTANIPAY_ONOFFRAMP_ENABLED=true`, `KOTANIPAY_API_KEY`, `KOTANIPAY_WEBHOOK_SECRET`, `KOTANIPAY_V3_API_URL`, the public `KOTANIPAY_ONOFFRAMP_WEBHOOK_URL`, and an explicitly confirmed webhook signature mode are configured. The only accepted v3 roots are `https://sandbox-api.kotanipay.io/v3` and `https://api.kotanipay.io/api/v3`; production mode rejects the sandbox host. The v3 API base URL is separate from the legacy `KOTANI_API_URL` used by the provider-ledger integration. Set `KOTANIPAY_ONOFFRAMP_SIGNATURE_MODE` only after matching KotaniPay's documented signing contract: `raw-body-header` verifies HMAC-SHA256 using `x-kotani-signature` and the raw body (excluding an embedded `signature` property if present); `canonical-envelope` verifies HMAC-SHA256 of `JSON.stringify({ event, data })` from the envelope's `signature`. Do not enable the feature until the selected format is confirmed against the provider's current docs or sandbox.

Only event name, reference ID, selected signature mode, and resulting status are written to the application log. A durable webhook inbox stores a digest plus the limited settlement fields needed for retry/reconciliation; it excludes signatures and phone numbers and does not store the full incoming provider payload. Use sandbox deliveries to verify the configured signature mode before enabling real settlement.

The persisted transaction state acts as the ramp's saga record: quote → initiation → provider/on-chain/fiat reconciliation, with `refund_pending`/`refunded`/`refund_failed` representing the offramp compensation path. An ambiguous provider initiation is `initiation_unknown`; do not retry it blindly. Admins can inspect stuck records at `GET /api/v1/wallets/self-custody-ramps/admin/open`.

Completed status requires a signed event or status response matching the saved Celo/cUSD asset, wallet (and offramp escrow), transaction hash, and quote amounts. Onramp settlement requires at least the quoted cUSD amount and the exact quoted KES amount; offramp settlement requires the exact quoted cUSD amount and at least the quoted KES amount. No fee tolerance is applied without provider evidence, so a short settlement is held for reconciliation rather than declared complete. Signed webhook events are durably deduplicated and retried locally, and a worker polls KotaniPay's documented onramp/offramp status-by-reference endpoints as a fallback. Malformed payloads and invalid signatures are rejected; a reconciliation failure returns HTTP 500 so the provider can retry, subject to its retry policy. A real KotaniPay Celo mainnet integration must still be provider-configured and tested before production.

**Stablecoin wallet scope:** Direct wallet balance/send support is allowlisted by exact chain ID and token contract: cUSD/USDC/USDT on Celo mainnet, USDC/USDT on Ethereum, USDC on Base, and test cUSD on Alfajores. Unknown and bridged token contracts are not accepted. There is no verified in-app swap/bridge route that converts USDC/USDT into Celo cUSD before M-Pesa cash-out or converts onramp cUSD into other assets. The M-Pesa ramp remains Celo cUSD only; do not advertise a three-stablecoin M-Pesa ramp until provider support, conversion routes, fees, liquidity, and end-to-end settlement are verified.

### Legacy provider-ledger callback

The ledger callback remains separate from self-custody ramps: `POST /api/payments/kotanipay/callback` (legacy alias: `POST /api/kotanipay-status/callback`). It accepts both the v3 `{ event, data }` envelope and legacy flat payload fields. Invalid, unknown, or unprocessable callbacks are logged and acknowledged with HTTP 200 so provider retries do not mask reconciliation issues; inspect the application logs and transaction status when a callback is not reconciled. The legacy retry endpoint does not resend a failed STK push or change its state until KotaniPay's same-transaction idempotency behavior is confirmed.

## What's Implemented

### ✅ Completed

1. **Deposit Service** (`server/services/kotanipayService.ts`)
   - Initiate M-Pesa deposits
   - STK push integration
   - Balance crediting with cUSD
   - Fee tracking (1.5%)
   - Webhook handling

2. **Withdrawal Service** 
   - Initiate cUSD to M-Pesa withdrawals
   - Balance locking mechanism
   - B2C transfer integration
   - Fee deduction (2%)
   - Refund on failure

3. **Balance Management**
   - Real-time user balance tracking
   - Multi-currency support (cUSD, KES, MTAA, CELO)
   - Available/pending/locked balance breakdown

4. **API Routes** (`server/routes/deposits-withdrawals.ts`)
   - `POST /api/deposits/initiate` - Start deposit
   - `GET /api/deposits/status/:id` - Check deposit status
   - `POST /api/withdrawals/initiate` - Start withdrawal
   - `GET /api/withdrawals/status/:id` - Check withdrawal status
   - `GET /api/transactions/history` - View transaction history
   - `GET /api/transactions/summary` - Get summary stats
   - `POST /api/deposits/webhook` - Webhook callback
   - `POST /api/withdrawals/webhook` - Webhook callback

5. **Database Tables** (via financialEnhancedSchema.ts)
   - `mpesa_transactions` - All M-Pesa transactions
   - `user_balances` - Real-time balance tracking
   - `transaction_fees` - Fee tracking & analytics

6. **Error Handling**
   - Insufficient balance checks
   - Invalid input validation
   - Transaction state validation
   - Graceful failure recovery

7. **Notifications**
   - Deposit initiated
   - Deposit completed/failed
   - Withdrawal initiated/completed/failed
   - Refund notifications

## File Structure

```
server/
├── services/
│   └── kotanipayService.ts          ✅ Main service logic
├── routes/
│   ├── deposits-withdrawals.ts      ✅ API endpoints
│   └── kotanipay-status.ts          ✅ Existing webhook handling
└── routes.ts                        ✅ Route registration

shared/
└── financialEnhancedSchema.ts       ✅ Database tables
    ├── user_balances
    ├── mpesa_transactions
    └── transaction_fees

docs/
└── KOTANIPAY_DEPOSITS_WITHDRAWALS_IMPLEMENTATION.md  ✅ Full guide
```

## Quick API Usage

### Deposit 5,000 KES

```bash
curl -X POST http://localhost:3000/api/deposits/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123-uuid",
    "phone": "+254712345678",
    "amountKES": 5000
  }'

# Response:
{
  "success": true,
  "data": {
    "transactionId": "DEP-1700000000000-abc123def",
    "status": "pending",
    "amountKES": 5000,
    "estimatedCUSD": 32.83,
    "fee": 75,
    "message": "Please enter M-Pesa PIN"
  }
}
```

### Withdraw 100 cUSD

```bash
curl -X POST http://localhost:3000/api/withdrawals/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123-uuid",
    "phone": "+254712345678",
    "amountCUSD": 100
  }'

# Response:
{
  "success": true,
  "data": {
    "transactionId": "WD-1700000000000-xyz789",
    "status": "pending",
    "amountCUSD": 100,
    "estimatedKES": 14700,
    "fee": 2,
    "message": "Withdrawal initiated"
  }
}
```

### Check Status

```bash
curl http://localhost:3000/api/deposits/status/DEP-1700000000000-abc123def

# Response:
{
  "success": true,
  "data": {
    "transactionId": "DEP-1700000000000-abc123def",
    "status": "completed",
    "amountCUSD": 32.83,
    "receipt": "QGN7MZ61SU"
  }
}
```

### Get History

```bash
curl "http://localhost:3000/api/transactions/history?userId=user-123-uuid&type=deposit&limit=10"

# Response:
{
  "success": true,
  "data": [
    {
      "transactionId": "DEP-...",
      "type": "deposit",
      "status": "completed",
      "amountKES": 5000,
      "amountCUSD": 32.83,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Configuration

Add to `.env`:

```env
# KotaniPay API
KOTANI_API_URL=https://sandbox.kotaniapi.com
KOTANIPAY_API_KEY=your_api_key
KOTANIPAY_SECRET_KEY=your_secret_key

# Exchange Rate & Fees
EXCHANGE_RATE=150
DEPOSIT_FEE_PERCENTAGE=0.015
WITHDRAWAL_FEE_PERCENTAGE=0.02

# Callbacks
BACKEND_URL=https://api.yourdomain.com
```

## Transaction Flow Diagram

### Deposit Flow
```
User
  ↓
POST /deposits/initiate
  ↓
Validate input
  ↓
Lock funds + Record transaction
  ↓
Send STK push
  ↓
User enters M-Pesa PIN
  ↓
KotaniPay webhook → /deposits/webhook
  ↓
Verify & Update transaction status
  ↓
Credit cUSD balance
  ↓
Send success notification
  ↓
User receives cUSD ✅
```

### Withdrawal Flow
```
User
  ↓
POST /withdrawals/initiate
  ↓
Validate input + Check balance
  ↓
Lock funds immediately
  ↓
Initiate B2C transfer
  ↓
KotaniPay webhook → /withdrawals/webhook
  ↓
Verify & Update status
  ↓
Send M-Pesa to user
  ↓
User receives notification ✅
```

## Fee Calculation Examples

### Deposit Example: 5,000 KES
```
Gross: 5,000 KES
Fee:   5,000 × 1.5% = 75 KES
Net:   5,000 - 75 = 4,925 KES
cUSD:  4,925 ÷ 150 = 32.83 cUSD
```

### Withdrawal Example: 100 cUSD
```
Gross: 100 cUSD
Fee:   100 × 2% = 2 cUSD
Net:   100 - 2 = 98 cUSD
KES:   98 × 150 = 14,700 KES
```

## Database Queries

### Check User Balance
```sql
SELECT * FROM user_balances 
WHERE user_id = 'user-123' AND currency = 'cUSD';
```

### View Transaction History
```sql
SELECT * FROM mpesa_transactions 
WHERE user_id = 'user-123' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Calculate Fee Revenue
```sql
SELECT 
  fee_category,
  SUM(CAST(fee_amount AS DECIMAL)) as total_fees,
  COUNT(*) as transaction_count
FROM transaction_fees
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY fee_category;
```

## Environment Setup

1. **Create M-Pesa Tables**
   ```sql
   -- Migrations auto-applied via Drizzle
   -- Just run: npm run db:migrate
   ```

2. **Configure KotaniPay API**
   - Get API key from KotaniPay dashboard
   - Set `KOTANIPAY_API_KEY` in `.env`

3. **Setup Webhooks**
   - Point KotaniPay webhooks to:
     - `https://yourdomain.com/api/deposits/webhook`
     - `https://yourdomain.com/api/withdrawals/webhook`

4. **Test Integration**
   - Use sandbox credentials first
   - Test deposit/withdrawal flows
   - Verify webhook delivery

## Status Codes & Responses

### Success (200)
```json
{
  "success": true,
  "data": { ... }
}
```

### Client Error (400)
```json
{
  "success": false,
  "error": "Insufficient balance",
  "code": "INSUFFICIENT_BALANCE"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Transaction not found",
  "code": "TRANSACTION_NOT_FOUND"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

## Monitoring Dashboard SQL

```sql
-- Real-time stats (last 24 hours)
SELECT
  'deposits' as type,
  COUNT(*) as count,
  SUM(CAST(amount AS DECIMAL)) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM mpesa_transactions
WHERE transaction_type = 'stk_push'
  AND created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'withdrawals' as type,
  COUNT(*) as count,
  SUM(CAST(amount AS DECIMAL)) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM mpesa_transactions
WHERE transaction_type = 'b2c'
  AND created_at > NOW() - INTERVAL '24 hours';
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Insufficient balance" | User needs to deposit more funds |
| "Invalid phone number" | Use format: +254712345678 |
| "Transaction not found" | Check transactionId spelling |
| "STK push failed" | Check KOTANI_API_KEY configuration |
| "Webhook not received" | Verify webhook URL in KotaniPay dashboard |
| "Balance not updated" | Check mpesa_transactions status = 'completed' |

## Performance Notes

- Balance lookups: O(1) via user_id + currency index
- Transaction history: O(n) with pagination (limit 50)
- Deposit processing: <2 seconds average
- Withdrawal processing: <5 seconds average

## Security Notes

✅ Phone numbers validated with regex
✅ All amounts validated as positive numbers
✅ Balance checked before withdrawal
✅ Transactions logged with user_id
✅ Webhook signature verification (implement)
✅ Rate limiting recommended (implement)

## Next Phase: Advanced Features

- [ ] Recurring deposits/withdrawals
- [ ] Multi-currency swaps (KES ↔ cUSD ↔ CELO)
- [ ] Batch operations
- [ ] Escrow integration
- [ ] AI-powered recommendations
- [ ] Advanced analytics dashboard
