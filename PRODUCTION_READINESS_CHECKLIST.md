# Production Readiness Checklist

This checklist combines **baseline production standards** and a **prioritized gap list** so completion status is explicit and auditable.

## Baseline Production Standards

### Code Quality
- [ ] No mock data in production execution paths
- [ ] All TODO/FIXME items either implemented or tracked with owner + target date
- [ ] No placeholder implementations on critical paths (auth, treasury, payments, governance)
- [ ] No demo/test code mounted in production routes
- [ ] Hardcoded policy values moved to config/environment
- [ ] Structured error handling and stable failure modes
- [ ] Production log levels + log redaction policy enforced

### Security
- [ ] Secrets managed via environment/secret manager only
- [ ] Protected routes require authz + role checks
- [ ] Input validation on all externally reachable endpoints
- [ ] Rate limiting + abuse protections enabled
- [ ] CORS policy restricted to allowed origins
- [ ] ORM/query protections validated against injection vectors

### Environment & Ops
- [ ] Mandatory production env vars validated at startup
- [ ] Database migrations applied and verified
- [ ] Backup/restore runbook tested
- [ ] Health and readiness endpoints functional
- [ ] Monitoring + alerting + rollback plan in place

### Test Readiness
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Critical-path E2E smoke tests passing
- [ ] Load/perf baseline established
- [ ] Security review/audit completed

## P0 (Blockers)
- [x] Replace payment provider mock endpoints with real integrations and persistent webhook handling (`server/payments.ts`).
- [x] Implement rules engine persistence and audit trail (`server/api/rules_engine.ts`).
- [x] Replace synthetic multisig contract address generation with deployment/registration flow (`server/api/dao_deploy.ts`).
- [x] Add end-to-end payment state machine tests for success/failure/retry and webhook idempotency.

## P1 (High Priority)
- [x] Implement symbol universe background sync in `dex-screener` routes (currently placeholder response).
- [x] Complete invitation email metadata with authoritative DAO identity and telemetry.
- [ ] Add cache hot-key telemetry (`topKeys`) and alert thresholds.
- [ ] Add provider health checks and circuit-breaker alarms for payment and exchange adapters.

## P2 (Operational Excellence)
- [x] Add service-level SLO dashboards and error budgets.
- [x] Add deployment smoke tests for key routes and websocket availability.
- [x] Harden config validation with mandatory secrets in production mode.
- [x] Add migration/backfill scripts for all newly introduced DAO types and treasury modes.

## Recently Completed
- [x] Invitation emails now use DAO name lookup instead of hardcoded fallback label.
- [x] Rules engine CRUD + execution audit persistence wired to DB tables.
- [x] Payment routes now persist transaction lifecycle and webhook status transitions across providers.
- [x] Payment state-machine test coverage added for success/failure/retry and idempotent webhooks.
- [x] Dex symbol-universe sync now executes background discovery with progress state.
- [x] Deployment smoke test script added for health and websocket endpoints.
- [x] Production config validation now enforces mandatory secrets and rejects weak defaults.
- [x] DAO treasury backfill script added with safe dry-run default.
- [x] SLO/error-budget baseline dashboard spec added for operations.

## Suggested verification commands
```bash
# Type checks
npx tsc --noEmit

# Tests
npm test

# Build
npm run build

# Runtime smoke
npm run dev
```
