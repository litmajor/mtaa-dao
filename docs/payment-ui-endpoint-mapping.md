# Payment UI Dependency Graph and API Endpoint Mapping

## Purpose
This document captures the frontend wallet/payment component dependency graph and the backend API endpoints they call. It is intended for auditing payment UI flows, verifying route migrations, and planning end-to-end tests.

---

## Component Dependency Graph

### Main Wallet Entry Points
- `client/src/pages/wallet.tsx`
  - Lazy loads and composes:
    - `RecurringPayments`
    - `RecurringPaymentsManager`
    - `PaymentRequestModal`
    - `PhonePaymentModal`
    - `PaymentLinkModal`
  - Uses `useWalletActions()` for centralized wallet operations.

- `client/src/components/WalletDashboard.tsx`
  - Composes:
    - `DepositWithdrawFlow`
    - `PaymentRequestModal`
    - `SplitBillModal`

### Wallet Payment UI Components
- `client/src/components/wallet/FiatOnRamp.tsx`
  - Standalone fiat on-ramp component for local payment providers.

- `client/src/components/wallet/DepositWithdrawFlow.tsx`
  - Main deposit/withdraw flow UI.
  - Imports and opens `WithdrawalModal` for withdraw flows.

- `client/src/components/wallet/WithdrawalModal.tsx`
  - Confirmation dialog for initiating withdrawals.

- `client/src/components/wallet/PaymentRequestModal.tsx`
  - Creates payment requests and optionally sends email notifications.

- `client/src/components/wallet/PendingPaymentsWidget.tsx`
  - Displays pending payments and uses WebSocket events to refresh.

- `client/src/components/wallet/PhonePaymentModal.tsx`
  - Sends wallet payments to phone numbers via the social payments module.

- `client/src/components/wallet/RecurringPayments.tsx`
  - Manages recurring payment rules and schedules.

- `client/src/components/wallet/tabs/DepositTab.tsx`
  - Deposit workflow tab in the wallet dashboard.

- `client/src/components/wallet/tabs/WithdrawTab.tsx`
  - Withdrawal workflow tab in the wallet dashboard.

---

## Shared Action Helpers

### `client/src/hooks/useWalletActions.ts`
Provides centralized abstractions for wallet operations:
- `send()` → `POST /api/v1/wallets/transfers/send-native`
- `receive()` → opens a receive panel only
- `withdraw()` → `POST /api/v1/wallets/transfers/withdraw`
- `swap()` → `POST /api/v1/wallets/swaps`
- `stake()` → `POST /api/v1/wallets/stake`
- `splitBill()` → `POST /api/v1/wallets/payments/split`
- `createPaymentLink()` → `POST /api/v1/wallets/payment-links`
- `social.payByPhone()` → `POST /api/v1/wallets/payments/phone`

### `client/src/modules/SocialPaymentsModule.ts`
Wraps payment-specific social operations:
- `requestPayment()` → `POST /api/v1/wallets/payments/request`
- `payByPhone()` → `POST /api/v1/wallets/payments/phone`
- `splitBill()` → `POST /api/v1/wallets/payments/split`
- `generatePaymentLink()` → `POST /api/v1/wallets/payment-links`
- `redeemPaymentLink()` → `POST /api/v1/wallets/payment-links/:id/mark-paid`

---

## Component-to-API Endpoint Mapping

### `client/src/components/wallet/FiatOnRamp.tsx`
- `POST /api/payments/deposit`

### `client/src/components/wallet/WithdrawalModal.tsx`
- `POST /api/v1/wallets/withdrawals/initiate`

### `client/src/components/wallet/DepositWithdrawFlow.tsx`
- `GET /api/v1/wallets`

### `client/src/components/wallet/PaymentRequestModal.tsx`
- `POST /api/v1/wallets/payment-links`
- `POST /api/v1/wallets/payment-links/:id/send-email`

### `client/src/components/wallet/PendingPaymentsWidget.tsx`
- `GET /api/v1/wallets/payments/pending`

### `client/src/components/wallet/PhonePaymentModal.tsx`
- `POST /api/v1/wallets/payments/phone`

### `client/src/components/wallet/RecurringPayments.tsx`
- `GET /api/v1/wallets/payments/recurring?walletAddress=...`
- `POST /api/v1/wallets/payments/recurring`
- `PATCH /api/v1/wallets/payments/recurring/{id}/toggle`
- `DELETE /api/v1/wallets/payments/recurring/{id}`

### `client/src/components/wallet/tabs/DepositTab.tsx`
- `GET /api/v1/wallets/deposits/user/history`
- `POST /api/v1/wallets/deposits/initiate`

### `client/src/components/wallet/tabs/WithdrawTab.tsx`
- `GET /api/v1/wallets/withdrawals/user/history`
- `POST /api/v1/wallets/withdrawals/preview`
- `POST /api/v1/wallets/rails/gateway/withdraw`

### `client/src/components/WalletDashboard.tsx`
- `GET /api/v1/wallets/security/2fa/config`

---

## Notes on API surface and legacy route handling

- The consolidated payments API path is `/api/payments/*` for new deposit flow integration.
- Legacy compatibility remains via `server/routes/payment-gateway.ts`, which shims `/api/payment-gateway/*` into `/api/payments`.
- `client/src/components/wallet/FiatOnRamp.tsx` was migrated from `/api/payment-gateway/deposit` to `/api/payments/deposit`.
- Back-end gateway callback URLs should point to `/api/payments/webhooks/*` instead of `/api/payment-gateway/*`.

---

## Backend route reality check

### Actual implemented backend service roots
- `/api/payments/*` → consolidated payment gateway execution, simulation, and webhooks
- `/api/v1/wallets/deposits/*` → wallet deposit initiation, status, limits, history, webhook
- `/api/v1/wallets/withdrawals/*` → wallet withdrawal initiation, 2FA/PIN flow, status, limits, history, webhook
- `/api/v1/wallets/payments/*` → native / wallet payment operations, recurring payments, split payments, vouchers, history, receipts, estimate, retry
- `/api/v1/wallets/payment-links/*` → create/list/get payment links, mark paid/cancel, supported tokens
- `/api/payment-requests/*` → payment request lifecycle, list sent/received requests, cancel, mark paid, stats

### Frontend routes with no direct backend match
- No remaining known frontend route calls currently point to unsupported `/api/v1/wallets/payments/*` payment-link or payment-request aliases.

### Backend mismatch summary
- Payment link creation is implemented under `/api/v1/wallets/payment-links`.
- Payment request email send is now supported under `POST /api/v1/wallets/payment-links/:id/send-email`.

---

## Unification recommendations

1. Normalize service domains.
   - Keep `/api/payments/*` for gateway deposit/withdraw execution and webhook callbacks.
   - Keep `/api/v1/wallets/*` for wallet-centric operations, including deposits, withdrawals, wallet transfers, recurring payments, and payment-links.
   - Keep `/api/payment-requests/*` for request-specific interactions and consider adding a versioned alias under `/api/v1/wallets` if UI consistency is required.

2. Align frontend helpers with backend service roots.
   - Replace `/api/v1/wallets/payments/link/create` with `POST /api/v1/wallets/payment-links`.
   - Use `POST /api/v1/wallets/payment-links/:id/send-email` for optional payment link email delivery.

3. Document the service split clearly in the UI mapping.
   - `/api/v1/wallets/payment-links/*` = payment links / shareable invoices
   - `/api/payment-requests/*` = one-off request lifecycle and inbox
   - `/api/v1/wallets/payments/*` = wallet-native transactions, recurring, split, voucher

4. Consider a single wallet-level facade if teams want fewer roots.
   - Add alias routes under `/api/v1/wallets` for legacy `/api/payment-requests` and for `/api/v1/wallets/payment-links` if needed.
   - Avoid mixing `payments/link/create` and `payments/requests/send-email` with the existing route namespaces.

5. Audit all frontend route sources.
   - Search for `/api/payment-gateway/*`, `/api/v1/wallets/payments/link/create`, `/api/v1/wallets/payments/requests/send-email`, and `/api/payment-requests`.
   - Confirm each UI component maps to one implemented backend path.

---

## Recommended E2E Test Paths

1. `FiatOnRamp` deposit flow
   - UI: select provider, submit deposit
   - backend target: `POST /api/payments/deposit`
   - webhook processing: `POST /api/payments/webhooks/{provider}`

2. Wallet withdrawal flow
   - UI: open `WithdrawalModal`, confirm
   - backend target: `POST /api/v1/wallets/withdrawals/initiate`

3. Deposit tab onboarding path
   - provider selection + `POST /api/v1/wallets/deposits/initiate`

4. Recurring payments management
   - list: `GET /api/v1/wallets/payments/recurring`
   - create: `POST /api/v1/wallets/payments/recurring`
   - toggle: `PATCH /api/v1/wallets/payments/recurring/{id}/toggle`

5. Phone payment flow
   - UI: `PhonePaymentModal`
   - backend target: `POST /api/v1/wallets/payments/phone`

6. Payment request creation
   - UI: `PaymentRequestModal`
   - create link: `POST /api/v1/wallets/payment-links`
   - optional email: `POST /api/v1/wallets/payment-links/:id/send-email`

---

## Main route summary

```text
/api/payments/*             -> consolidated payment gateway routes for fiat deposit + webhooks
  POST /api/payments/deposit
  POST /api/payments/webhooks/{provider}

/api/v1/wallets/*          -> wallet-specific operations and social payments flows
  POST /api/v1/wallets/withdrawals/initiate
  POST /api/v1/wallets/deposits/initiate
  GET  /api/v1/wallets/payments/recurring
  POST /api/v1/wallets/payments/phone
  POST /api/v1/wallets/payment-links
  POST /api/v1/wallets/payment-links/:id/send-email
```

## Route diagram

```text
[FiatOnRamp] ---> POST /api/payments/deposit
                      |
                      v
              [Payment Gateway Service]
                      |
                      v
              POST /api/payments/webhooks/{provider}

[Wallet UI / Social Payments] ---> /api/v1/wallets/*
    - transfers
    - withdrawals
    - deposits
    - recurring payments
    - payment links
    - phone / split payments
```

---

## Recommended next step

Audit the backend routes for the corresponding `api/v1/wallets` and `/api/payments` handlers to confirm they are implemented with the same contract as the frontend expects.
