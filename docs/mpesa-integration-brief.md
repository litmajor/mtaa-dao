M-Pesa Integration Brief
=======================

Summary
-------

State: B (manual + scaffolded)

- `/api/payments/mpesa/initiate` exists but returns mock responses.
- `useMpesaPayment` hook exists on client.
- Webhook/reconciliation handler scaffolded.
- Daraja keys are present in `.env` but OAuth is not wired.

MVP path: Manual entry + receipt upload. No behavior change for chamas.

State A (planned) — Daraja STK push behind feature flag once credentials confirmed:
- Checklist: OAuth token exchange → STK push call → webhook callback → auto-reconciliation to treasury.


What to build next (priority order)
----------------------------------

1) Record Payment UI (this week)

- Core weekly loop for chamas: record a payment and attach a receipt. This is the essential feature — ship this first. Manual recording mirrors current WhatsApp behavior and will not force behavior changes on users.

2) Daraja integration (parallel, behind `FEATURE_MPESA_STK` flag)

- Implement Daraja OAuth and STK push flow behind a feature flag. Do not block Okedi adoption on this; implement in parallel so flipping the flag enables automatic confirmation and improved stickiness.


Notes
-----

- State B rationale: manual recording with receipt attachment accurately digitizes existing chama workflows — simple, reliable, and privacy-preserving.
- When ready to flip to State A, ensure the checklist items are fully tested: token exchange, STK push reliability, webhook security, and reconciliation mapping to treasury accounts.
