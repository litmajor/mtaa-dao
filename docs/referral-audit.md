# Referral System Audit — Summary

Date: 2026-06-18

## Scope
- Audit of referral, reward and payout flows: routes, DB tables, background worker, and on-chain payout integration.
- Files reviewed and modified: `server/routes/referral-rewards.ts`, `server/workers/payout-worker.ts`, `shared/financialEnhancedSchema.ts`, worker metrics and admin endpoints.

## High-level summary
- The system now uses a ledger-backed payout model (`referral_payouts`) and a background worker that executes on-chain payouts.
- Major race conditions were present and have been fixed: double-selection leading to duplicate on-chain payouts, nonce collisions, and underfunded-contract mass reverts.
- The claim path has been refactored to enqueue payouts transactionally (DB authoritative) instead of performing synchronous on-chain calls in request handlers.

## Findings (Categorized)

High (must-fix before mainnet)
- SELECT → UPDATE race: worker originally selected pending rows using non-locking selects. Fixed by using `SELECT ... FOR UPDATE SKIP LOCKED` to ensure rows are processed once across workers.
- Nonce collisions: originally each row fetched provider nonce individually. Fixed by allocating a durable batch-level nonce (derived from DB max nonce and provider pending) and incrementing per-send.
- Underfunded contract risk: added a contract balance pre-flight check to abort a batch and alert operators.

Medium
- Lack of durable nonce store: implemented DB-derived durable starting nonce; recommended next step is an atomic `nonce_counters` table to avoid relying on historical rows.
- Idempotency at contract layer: worker sends `requestId` but contract-side idempotency must be supported and verified; recommend adding requestId checks in the on-chain contract if not present.

Low
- Metrics and observability: worker now emits processed/failure/duration metrics; recommend adding dashboards and alerts for spikes.
- Leaderboard privacy: leaderboard endpoint now requires authentication by default.

## Flow mapping (textual)
1. Admin distribution (`POST /api/referral-rewards/distribute`)
   - Calculates top referrers for period, inserts `referral_rewards` rows using `distributeWeekRewards()` helper.
2. Claim (`POST /api/referral-rewards/claim/:rewardId`)
   - Transactionally locks the reward (`SELECT ... FOR UPDATE`), validates vesting and requested amount, writes `reward_claims`, and inserts a `referral_payouts` ledger row (via Drizzle `insert(referralPayouts)`).
3. Worker (`server/workers/payout-worker.ts`)
   - Polls `referral_payouts` using `FOR UPDATE SKIP LOCKED`, performs contract-balance preflight, computes a durable batch nonce, and sends on-chain calls to contract `distributeReward(requestId, to, amount)`.
   - Persists `transaction_hash` and `nonce`, marks `completed` or `failed`, and uses retry/backoff with basic RBF replacements.

## Files changed (key)
- `server/routes/referral-rewards.ts` — claim handler made transactional with `SELECT ... FOR UPDATE`, extracted `distributeWeekRewards`, leaderboard authentication, avgWeeklyDistribution fix, use Drizzle for inserts.
- `server/workers/payout-worker.ts` — replaced select with `FOR UPDATE SKIP LOCKED`, batch durable nonce, contract-balance pre-flight, truncated amount parsing, RBF fallback, and Drizzle `referralPayouts` usage.
- `shared/financialEnhancedSchema.ts` — `referral_payouts` expanded with saga fields (requestId, transactionHash, nonce, lastError, retryCount).

## Remaining risks & recommended next steps
1. Apply DB migrations in staging and production: `migrations/20260618_add_referral_claims_and_escrow_referrals.sql` must be run before enabling the worker.
2. Durable nonce counter: add a small migration that creates an atomic `nonce_counters` table and switch worker to claim/advance that counter instead of deriving from historical rows. This avoids ambiguity when nonces are missing or non-numeric.
3. Contract-side idempotency: ensure the on-chain `distributeReward` method uses `requestId` to dedupe or revert duplicates; add a view/query that verifies whether a requestId was already processed (on-chain or via events).
4. Stronger RBF/fee strategy: implement adaptive fee reprice using recent gas-price histories and exponential backoff for replacements. Consider a safe ceiling to avoid runaway fees.
5. Tests: add unit and integration tests for:
   - Claim flow (race and partial claims),
   - Worker idempotency and retry behavior (including underfunded contract),
   - Adversarial tests: double-claim, two worker instances competing.
6. Observability: wire Prometheus/Grafana dashboards for `payouts_processed`, `payouts_failed`, `worker_duration_ms`, and alert for high `retryCount` or sudden `pending` queue growth.

## How to validate locally (quick)
1. Run migrations against a local Postgres instance.
2. Start a local RPC (Hardhat/Anvil) and fund the contract addresses used in env.
3. Run the smoke script in dry-run to verify DB enqueue and worker flow without sending txs:

```bash
node scripts/smoke-payout-worker.ts
```

4. Run worker in dry-run: `node -e "require('./server/workers/payout-worker').processPendingPayoutsOnce(true)"`

## Operational notes for production
- Ensure `NODE_ENV=production` only when you want the weekly cron to run.
- Set `ADMIN_ALERT_WEBHOOK` for critical failures.
- Apply migrations and verify schema before starting `startPayoutWorker()`.

## Conclusion
The core design (ledger + worker) is implemented and hardened for common race conditions; remaining work centers around durable nonce bookkeeping, contract-level idempotency, and stronger fee/replacement strategies before enabling real mainnet payouts.

---
If you'd like, I can:
- create the `nonce_counters` migration and implement atomic claims against it, or
- add integration tests (jest) that simulate two worker instances to prove `FOR UPDATE SKIP LOCKED` behavior.
