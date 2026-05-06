# Wallet Endpoints V1 Migration - Webhook Configuration

## Overview
Wallet deposit/withdrawal endpoints have been migrated from legacy `/api/*` routes to structured `/v1/wallets/*` sub-routers.

## New Webhook Paths

### Production Webhook URLs
These paths need to be registered in all payment provider dashboards:

**Deposits Webhook:**
```
POST https://your-api.com/api/v1/wallets/deposits/webhook
```
- **Rate Limited:** 100 requests/minute per IP
- **Auth:** None (public endpoint)

**Withdrawals Webhook:**
```
POST https://your-api.com/api/v1/wallets/withdrawals/webhook
```
- **Rate Limited:** 100 requests/minute per IP
- **Auth:** None (public endpoint)

### Expected Webhook Payload Format

#### Deposit Webhook (from provider)
```json
{
  "depositId": "uuid-string",
  "transactionHash": "0x...",
  "status": "completed|failed",
  "externalReference": "provider-reference-id",
  "feeAmount": "0.50"
}
```

#### Withdrawal Webhook (from provider)
```json
{
  "withdrawalId": "uuid-string",
  "transactionHash": "0x...",
  "status": "completed|failed",
  "externalReference": "provider-reference-id",
  "feeAmount": "2.50"
}
```

## Provider Configuration

### Stripe
- **Webhook Type:** `charge.succeeded`, `charge.failed`
- **Endpoint:** `/api/v1/wallets/deposits/webhook`
- **Events:** Payment completion notifications
- **Signature Verification:** Use Stripe's webhook signing secret

### Kotanipay
- **Webhook Type:** Payment callbacks
- **Endpoint:** `/api/v1/wallets/deposits/webhook` (deposits) or `/api/v1/wallets/withdrawals/webhook` (withdrawals)
- **Events:** Transaction status updates
- **Authentication:** API key header

### M-Pesa
- **Webhook Type:** Transaction confirmation
- **Endpoint:** `/api/v1/wallets/deposits/webhook` (for Kenya deposits)
- **Events:** STK completion callbacks
- **Validation:** Confirm transaction reference

### Bank Transfer
- **Webhook Type:** Settlement notifications
- **Endpoint:** `/api/v1/wallets/withdrawals/webhook`
- **Events:** Bank deposit confirmations
- **Verification:** Clearing house reference number

## Rate Limiting

### Webhook Rate Limits
Both `/deposits/webhook` and `/withdrawals/webhook` endpoints are rate limited to protect against abuse:

- **Limit:** 100 requests per minute per IP
- **Key:** IP Address (not user, since webhook auth is not required)
- **Response:** 429 Too Many Requests if exceeded
- **Retry-After:** HTTP header indicates when to retry

**Important:** If your payment provider makes >100 webhook calls/minute from a single IP, contact us to adjust limits. This is rate-limited per IP, so multiple provider IPs won't cause issues.

### Authenticated Endpoints Rate Limits
User-authenticated endpoints have separate rate limits:

**Deposits:**
- Initiate deposit: 50 requests/hour per user
- Status checks: 100 requests/hour per user
- History: 100 requests/hour per user

**Withdrawals:**
- Initiate withdrawal: 50 requests/hour per user
- Verify 2FA: 20 attempts per OTP (prevents brute-force)
- Status checks: 100 requests/hour per user
- History: 100 requests/hour per user

## Implementation Checklist

### Phase 1: Testing (Non-Production)
- [ ] Register webhook URLs in dev payment provider accounts
- [ ] Test deposit flow: initiate → webhook → completion
- [ ] Test withdrawal flow: initiate → 2FA verify → webhook → completion
- [ ] Verify all 3 inflows endpoints deliver correct data

### Phase 2: Staging
- [ ] Update webhook URLs in staging provider dashboards
- [ ] Run full integration tests with payment providers
- [ ] Verify webhook signing/validation works
- [ ] Test error scenarios (failed payments, timeouts)

### Phase 3: Production (Cutover)
- [ ] Update webhook URLs in ALL production provider dashboards
- [ ] Run parallel testing (old + new endpoints simultaneously)
- [ ] Monitor webhook processing for 24 hours
- [ ] Verify backup/disaster recovery works
- [ ] Document any provider-specific quirks

### Phase 4: Deprecation (Legacy Routes)
- [ ] Keep old `/api/deposits/*` and `/api/withdrawals/*` routes active (tombstoned)
- [ ] Old routes log deprecation warnings
- [ ] Set 90-day sunset date for legacy routes
- [ ] Notify clients of migration 30+ days before sunset

## Legacy Route Status: TOMBSTONED

**Not in production yet, so these are immediately deprecated:**

### Old Routes (DEPRECATED):
- `POST /api/deposits/offramp/initiate` → Use `POST /api/v1/wallets/deposits/initiate`
- `GET /api/deposits/:depositId` → Use `GET /api/v1/wallets/deposits/status/:txId`
- `GET /api/deposits/history` → Use `GET /api/v1/wallets/deposits/history`
- `POST /api/deposits/webhook` → Use `POST /api/v1/wallets/deposits/webhook`

### Withdrawal Routes (Did not exist in v0):
- `POST /api/v1/wallets/withdrawals/initiate` (NEW)
  - Requires 2FA verification
  - Returns otpId for next step
- `POST /api/v1/wallets/withdrawals/verify-2fa` (NEW)
  - Completes 2FA flow
  - Returns verification token
- Subsequent withdrawal operations use standard pattern

## Key Differences in V1

### Deposits V1 Changes:
1. **Endpoint Path:** `/api/deposits/*` → `/api/v1/wallets/deposits/*`
2. **Status Endpoint:** GET `/:depositId` → GET `/status/:txId`
3. **History Endpoint:** GET `/history` → GET `/deposits/history` (with pagination)
4. **Limits Endpoint:** NEW - GET `/deposits/limits`
5. **Stable Assets:** GET `/stable-assets` now redirects to `/inflows/stable-assets`

### Withdrawals V1 Changes:
1. **2FA Required:** All withdrawals require 2FA before initiation
2. **Two-Step Flow:** 
   - Step 1: `POST /initiate` → Get `otpId`
   - Step 2: `POST /verify-2fa` with OTP code
3. **Webhook Format:** Updated to match standard pattern
4. **Limits Endpoint:** GET `/limits` shows withdrawal-specific limits

### Shared Inflows Endpoint:
1. **Canonical Location:** `/api/v1/wallets/inflows/*`
2. **Used By:** Both deposits AND withdrawals
3. **Endpoints:**
   - `GET /stable-assets` - Asset discovery
   - `GET /rates` - Exchange rates
   - `GET /providers` - Provider info with fees

## Monitoring & Alerting

### Webhook Processing
Add monitoring for:
- Webhook delivery latency (should be <5s)
- Webhook signature verification failures
- Transaction processing time
- Failed payment callbacks
- Provider-specific timeout issues

### Recommended Alerts
```
- Alert if webhook error rate > 5%
- Alert if webhook processing latency > 10s
- Alert if 2FA verification fails > 10% of withdrawals
- Alert if deposit/withdrawal success rate < 95%
```

## Rollback Plan

If issues arise post-deployment:
1. Keep both old and new endpoints active simultaneously
2. Redirect traffic back to old endpoints at API gateway level
3. Investigate new endpoint issues
4. Once fixed, retry new endpoints
5. Gradual traffic migration (10% → 50% → 100%)

## Documentation Links

- API Docs: `/docs/v1/wallets/deposits`
- API Docs: `/docs/v1/wallets/withdrawals`
- API Docs: `/docs/v1/wallets/inflows`
- 2FA Flow: `/docs/security/2fa`
- Webhook Security: `/docs/webhooks/signatures`
