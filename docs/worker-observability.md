# Worker Observability & Smoke Test

This document explains how to run the payout worker in dry-run mode, configure alerts, and verify worker status from the admin API.

## Environment
- Ensure migrations have been applied (see `migrations/`).
- Required env vars for smoke/dry-run:
  - `DATABASE_URL`
  - `RPC_URL` (not necessary for dry-run but safe)
  - `PRIVATE_KEY` (not used in dry-run)
  - `SMOKE_TEST_ADDRESS` (optional)
  - `ADMIN_ALERT_WEBHOOK` (optional Discord webhook)

## Run dry-run smoke test
This inserts a single pending payout and runs the worker in `dry-run` mode which will log simulated transactions but not send them on-chain.

```bash
# from repo root
NODE_ENV=development npx ts-node scripts/smoke-payout-worker.ts
```

## Admin monitoring endpoint
A monitoring endpoint is available to admins at:

- `GET /api/admin/monitoring/workers`

It returns JSON with counts of `pending`, `processing`, `failed`, and `completed` payouts and the local worker status:

- `worker.isRunning`: boolean
- `worker.lastRunAt`: timestamp or null

## Alerts
Set `ADMIN_ALERT_WEBHOOK` to a Discord webhook URL to receive critical alerts when a payout fails after retrying.

## Notes
- Apply the SQL migration file `migrations/20260618_add_referral_claims_and_escrow_referrals.sql` before running the worker to ensure required columns exist.
- The worker logs structured events via `server/utils/logger.ts`.
