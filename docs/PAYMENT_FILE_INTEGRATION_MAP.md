# Payment File Integration Map

## Purpose

This document maps payment-related files across the repository and describes how they are integrated into the backend, frontend, jobs, and documentation layers.

It is intended to help developers understand the payment domain at a glance and find the canonical implementation points for:
- payment gateway orchestration
- payment simulation and execution
- wallet payment flows
- payment requests and invoices
- reconciliation and recovery
- recurring and phone payments
- frontend payment UI and workflow components

---

## Route Mount Points and Entry Paths

### Main Server Mounts

- `server/index.ts`
  - `/api/payment-gateway` → `server/routes/payment-gateway.ts`
  - `/api/payment-requests` → `server/routes/payment-requests.ts`
  - `/api/v1/wallets` → `server/routes/v1/wallets/index.ts`

- `server/routes.ts`
  - `/api/simulation` → `server/routes/simulationPaymentRoutes.ts`
  - `/api/payments` → `server/routes/paymentExecutionRoutes.ts`

### Wallet API Mounts

- `server/routes/v1/wallets/index.ts`
  - `/api/v1/wallets/payment-links` → `server/routes/v1/wallets/payment-links.ts`
  - `/api/v1/wallets/invoices` → `server/routes/v1/wallets/invoices.ts`
  - `/api/v1/wallets/payments` → `server/routes/v1/wallets/payments.ts`
  - `/api/v1/wallets/rails` → rails/payment gateway adapter routes
  - `/api/v1/wallets/recurring-payments` and bill split routes via `server/routes/payment-features.ts`

---

## Backend Route Files

### Core payment gateway routes
- `server/routes/payment-gateway.ts`
  - deposit and withdrawal entrypoints
  - provider verification and webhook handlers
  - provider-specific callback endpoints for Flutterwave / Paystack / M-Pesa / Kotani / others

- `server/routes/payment-requests.ts`
  - payment request lifecycle
  - create, list, detail, mark-paid, cancel, stats

- `server/routes/paymentExecutionRoutes.ts`
  - payment execution via `PaymentExecutionService`
  - deposit, withdrawal, transfer, recurring execution, settlement, reversal, pending action lookup

- `server/routes/simulationPaymentRoutes.ts`
  - simulation endpoints for deposit, withdrawal, P2P, recurring payment setup, settlement
  - intent is to preview and validate user operations before execution

- `server/routes/payment-reconciliation.ts`
  - admin reconciliation reports and bulk reconciliation actions
  - provider success / failure / retry and anomaly detection

- `server/routes/payment-gateway.ts` and `server/services/paymentGatewayService.ts`
  - gateway orchestration logic for providers and idempotency
  - request validation, retries, provider selection, and error telemetry

- `server/routes/payment-features.ts`
  - wallet supporting features such as recurring payment and bill split routes
  - used by wallet-level feature endpoints

- `server/routes/phone-payments.ts`
  - phone-payment specific operations and provider integrations

- `server/payments.ts`
  - likely global payment helper routes and provider orchestration utilities
  - includes generic provider integration helpers and shared route-level logic

- `server/config/paymentProviders.ts`
  - provider configuration mapping and environment-driven setup

---

## Backend Service Files

### Gateway and provider orchestration
- `server/services/paymentGatewayService.ts`
  - core payment gateway orchestration service
  - supports providers: flutterwave, paystack, mpesa, mtn, airtel, stripe, kotanipay
  - implements request validation, retries, idempotency, and monitoring

- `server/services/paymentFlowSimulator.ts`
  - payment simulation service used by `/api/simulation/*`
  - returns before/after state, reversibility windows, warnings, and risk metadata

- `server/services/paymentExecutionService.ts`
  - payment execution service with handler classes
  - contains `DepositExecutionHandler`, `WithdrawalExecutionHandler`, `P2PTransferExecutionHandler`, `RecurringPaymentExecutionHandler`, and `PaymentSettlementExecutionHandler`

- `server/services/paymentRecoveryWorkflowService.ts`
  - workflow orchestration for automatic recovery and circuit-breaker-based payment retry handling

- `server/services/PaymentRecoverySAGAOrchestrator.ts`
  - event-driven saga orchestrator for payment recovery
  - implements retries, compensation, and state transitions

- `server/services/recurringPaymentService.ts`
  - recurring payment creation, execution, listing, pause/resume/cancel operations

- `server/services/AgentPaymentIndexer.ts`
  - payment indexing for agent-driven payment events and analytics

### Monitoring, alerting, and errors
- `server/services/paymentErrorMonitoringService.ts`
  - payment telemetry collection and aggregated error metrics

- `server/services/paymentErrorHandler.ts`
  - structured payment error construction and response normalization

- `server/services/paymentErrorAnalyticsService.ts`
  - payment error analytics and trend analysis

- `server/services/paymentErrorAlertService.ts`
  - alerting for payment provider failures and critical path issues

---

## Frontend Payment Files

### Pages
- `client/src/pages/payment.tsx`
  - primary payment page and modal launcher

- `client/src/pages/payment-requests.tsx`
  - payment request list and request flow

- `client/src/pages/PaymentReconciliation.tsx`
  - reconciliation dashboard or admin payment reporting

- `client/src/pages/PaymentSimulatorIntegration.tsx`
  - payment simulator integration interface

- `client/src/pages/PaymentDepositPage.example.tsx`
  - reference example page for deposit workflow

- `client/src/pages/recurring-payments.tsx`
  - recurring payment setup and management UI

### Components
- `client/src/components/PaymentModal.tsx`
  - generic payment modal wrapper used by `payment.tsx`

- `client/src/components/PaymentSimulationModal.tsx`
  - simulation preview modal for payment workflows

- `client/src/components/PaymentDepositForm.tsx`
  - deposit entry form

- `client/src/components/PaymentWithdrawalForm.tsx`
  - withdrawal entry form and verification

- `client/src/components/PaymentP2PTransferForm.tsx`
  - P2P transfer form

- `client/src/components/PaymentSettlementForm.tsx`
  - settlement flow form

- `client/src/components/RecurringPaymentForm.tsx`
  - recurring payment creation form

- `client/src/components/wallet/PaymentRequestModal.tsx`
  - payment request creation modal for wallet UI

- `client/src/components/wallet/PaymentLinkModal.tsx`
  - payment link creation modal

- `client/src/components/wallet/PendingPaymentsWidget.tsx`
  - pending payment alerts and status

- `client/src/components/wallet/RecurringPaymentsManager.tsx`
  - recurring payment manager UI

- `client/src/components/wallet/RecurringPayments.tsx`
  - recurring payment dashboard and details

- `client/src/components/wallet/PhonePaymentModal.tsx`
  - phone payment UI

### Hooks and modules
- `client/src/hooks/usePaymentSimulation.ts`
  - hook for payment simulation lifecycle, API calls, and state

- `client/src/modules/SocialPaymentsModule.ts`
  - social payments module integration

---

## Jobs and Background Processes

- `server/jobs/recurringPaymentExecutor.ts`
  - background execution of recurring payment schedules

- `server/jobs/payment-request-expiration.ts`
  - expiration handling for payment requests

- `server/queues/sagaQueue.ts`
  - queue worker for payment recovery saga reconciliation

- `server/jobs/sagaReconciliationJob.ts`
  - scheduled reconciliation job for stale sagas

---

## Database & Contracts

- `migrations/0009_add_payment_requests.sql`
  - payment request schema migration

- `migrations/0010_add_payment_transactions.sql`
  - payment transaction schema migration

- `server/db/migrations/015_add_payment_sagas.sql`
  - saga and reversal tracking schema

- `contracts/AgentPaymentGateway.sol`
  - smart contract bridge for agent-driven payment gateway features

---

## Documentation and References

The repository already includes several payment-focused docs. These are the canonical references:

- `docs/PAYMENT_SYSTEM_COMPLETE_VERIFICATION.md`
- `docs/PAYMENT_GATEWAY_DOCUMENTATION_INDEX.md`
- `docs/PAYMENT_GATEWAY_DEPOSIT_WITHDRAWAL_VERIFICATION.md`
- `docs/PAYMENT_INTEGRATION_COMPLETE.md`
- `docs/PAYMENT_REQUEST_COMPLETE.md`
- `docs/PAYMENT_SIMULATOR_RESOURCE_HUB.md`
- `docs/PAYMENT_SIMULATOR_MASTER_INDEX.md`
- `docs/RECURRING_PAYMENTS_COMPLETE.md`
- `docs/WALLET_PAYMENT_INTEGRATION_COMPLETE.md`
- `docs/WALLET_PAYMENT_FEATURES.md`
- `docs/SESSION_SUMMARY_PAYMENT_INTEGRATION.md`
- `docs/POWER_ANALYSIS_PAYMENTS_WITHDRAWALS.md`

---

## Integration Notes

### Primary backend domain
- `server/services/paymentGatewayService.ts` is the central orchestration service for external gateway providers.
- `server/routes/payment-gateway.ts` is the main public gateway interface for deposit/withdraw and provider callbacks.
- `server/routes/payment-requests.ts` is the customer-facing request flow.
- `server/routes/paymentExecutionRoutes.ts` and `server/routes/simulationPaymentRoutes.ts` form the execute/vet pathway used by the payment engine.

### Wallet and product flows
- `server/routes/v1/wallets/index.ts` consolidates wallet-specific payments under `/api/v1/wallets`.
- `server/routes/v1/wallets/payment-links.ts` and `server/routes/v1/wallets/invoices.ts` implement payment link and invoice lifecycle flows.
- `server/routes/payment-features.ts` and `server/routes/recurring-payments.ts` cover recurring payments, bill split, and wallet feature flows.

### Reconciliation and recovery
- `server/routes/payment-reconciliation.ts` contains admin reconciliation endpoints.
- `server/services/paymentRecoveryWorkflowService.ts` and `server/services/PaymentRecoverySAGAOrchestrator.ts` manage payment failure recovery, compensation, and saga reconciliation.

### Frontend wiring
- `client/src/pages/payment.tsx` is the landing flow for deposits and upgrades.
- `PaymentModal`, `PaymentDepositForm`, `PaymentWithdrawalForm`, and `PaymentSimulationModal` are the primary UI building blocks.
- `usePaymentSimulation.ts` is the shared hook for frontend simulator integration.

---

## Known hardening issues and blockers

- `server/routes/v1/wallets/payments.ts` contains placeholder TODO handlers for most payment operations. This route is not a production-ready payment engine and should not be relied on as the authoritative implementation until its handlers are completed.
- `server/routes/payment-gateway.ts` and `server/routes/v1/wallets/rails/gateway.ts` include TODOs for crediting user wallets after provider success. Payments may be recorded as successful without updating user balances.
- Webhook routes in `server/routes/payment-gateway.ts` do not appear to use raw body parsing before signature verification, which is required for many provider webhooks (Flutterwave, Paystack, Stripe) and may invalidate signature checks.
- Legacy compatibility redirects such as `/api/deposits`, `/api/withdrawals`, `/api/transactions`, `/api/stripe-status`, `/api/kotanipay-status`, and `/api/mpesa-status` should be audited for equivalent auth/RBAC enforcement to avoid unintended bypass paths.
- `/api/simulation` and `/api/payments` are mounted separately in `server/routes.ts`, so their auth and feature flag posture should be aligned with `/api/v1/wallets` payment flows.
- `server/routes/payment-requests.ts` uses `authenticate` instead of `isAuthenticated`, which may create inconsistent auth handling compared to the rest of the protected payment routes.
- The use of `process.env.APP_URL` for callback URLs in gateway orchestration is an environment assumption that must be validated in each deployment stage.

---

## Recommended next steps

1. Use this file as the source of truth for the payment domain.
2. If the payment naming surface changes, update this map and add new sections.
3. Link this document from `docs/PAYMENT_GATEWAY_DOCUMENTATION_INDEX.md`.
4. Add route diagrams if you need a visual integration map.

---

## Change log

- Created `docs/PAYMENT_FILE_INTEGRATION_MAP.md`
- Added mapping for server route mounts, wallet payment routes, service files, frontend pages, background jobs, migrations, and docs
