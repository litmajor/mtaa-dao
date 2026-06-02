# Backend/API Docs

## Overview
- Express server for MtaaDAO vault platform
- REST API for vault, user, DAO, and analytics
- Blockchain integration via ethers.js

## Key Endpoints
- `/api/maonovault/*` — On-chain vault actions (deposit, withdraw, nav, fee)
- `/api/user/*`, `/api/dao/*`, `/api/vaults/*` — User/DAO/vault management

## Blockchain Integration
- See `blockchain.md` for contract wiring

## Automation
- See `vault_automation.md` for NAV/fee automation and event indexing

## Running
- `npm install`
- `npm run dev` or `npm start`
- Configure `.env` for keys, RPC, contract addresses

## Database pool configuration (recommended env vars)
Set these in your deployment environment or `.env` to tune Postgres pool behaviour:

- `DATABASE_URL` (required)
- `DATABASE_POOL_MAX` (default: 20)
- `DATABASE_POOL_IDLE_TIMEOUT_MS` (default: 30000)
- `DATABASE_POOL_CONN_TIMEOUT_MS` (default: 15000)
- `DATABASE_SSL` (set to `true` to enable SSL)

## Metrics auth & IP allowlist (optional)
To protect metrics scraping, you can configure either an auth token or an IP allowlist (or both):

- `METRICS_AUTH_TOKEN` — shared secret used for `Authorization: Bearer <token>` or `x-metrics-token` header
- `METRICS_COOKIE_TOKEN` — alternative shared token that may be provided via a cookie named `metrics_token` (useful for browser access)
- `METRICS_IP_ALLOWLIST` — comma-separated list of IPs allowed to access `/metrics` without token (e.g. `10.0.0.5,192.168.1.10`)

If both auth token and allowlist are configured, requests matching the allowlist are allowed without a token.

Validation occurs at startup and the server will error if `DATABASE_URL` is missing.

---
See main project README for more.
