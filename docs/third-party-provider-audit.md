# MTAA DAO third-party provider audit

Date: 2026-10-21
Scope reviewed: repo-wide search across `server/`, `client/`, `shared/`, `config/`, `.env`, `.env.example`, and key docs. This report is based on code and configuration evidence, not a production secret scan.

## Executive summary

The project has a broad integration surface, but the actual runtime status is uneven:

- Clearly wired in code and ready for runtime use: PostgreSQL, Redis, Stripe, Google OAuth, Telegram bot, SendGrid/SMTP email, OpenAI (optional), Snapshot GraphQL, CCXT exchange adapters, generic RPC providers, Chainlink/Coingecko price sources, and the app’s own observability stack.
- Configured in env but not fully finished or not connected end-to-end: Flutterwave, Paystack, Paychant, Kotani Pay, M-Pesa, Airtel Money, Onramper, Twilio/WhatsApp/Africa’s Talking, Slack/Discord webhooks, Prometheus/Grafana config, and KYC/AML providers.
- Not found as active production integrations: Datadog direct agent, KM3/KMS provider, direct hosted signer service abstraction, and a real Snapshot credential path (no real credentials in env).

Most provider secrets in the repo are currently blank or `REPLACE_WITH_SECRET`, so the repo is in a local/dev configuration state rather than a live production-integrated state.

## Status legend

- Connected end-to-end: code calls the provider, env variables are present, and there is a live integration path.
- Partial / env-only: code path or env keys exist, but secret values are missing or the integration is not fully tested.
- Planned / docs-only: referenced in docs or TODOs, but no runtime call path found.
- Not found: no direct integration code found.

## Provider inventory and status

| Provider / platform | Role in MTAA | Evidence in repo | Env vars / config | Status | Notes |a
|---|---|---|---|---|---|
| PostgreSQL | Primary app database | `server/db.ts`, `drizzle.config.ts`, `.env` | `DATABASE_URL`, `DB_URL`, `PG_CONNECTION_STRING`, `TEST_DATABASE_URL` | Connected end-to-end | Core runtime dependency; local/dev config present. |
| Redis | Cache, queues, session/cache layer | `server/services/redis*`, `server/queues/*`, `.env` | `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_URL`, `REDIS_PASSWORD` | Connected end-to-end | App expects Redis; secrets blank in env examples. |
| Stripe | SaaS subscriptions / billing | `server/services/subscriptionService.ts`, `server/routes/stripe-status.ts`, `server/middleware/webhookValidators.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Partial / env-only | Code is present and calls Stripe, but live secret values are not configured. |
| Flutterwave | Payment provider | `server/config/paymentProviders.ts` | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`, `FLUTTERWAVE_WEBHOOK_SECRET`, `FLUTTERWAVE_PUBLIC_KEY` | Partial / env-only | Provider config exists but not validated in app flow. |
| Paystack | Payment provider | `server/config/paymentProviders.ts` | `PAYSTACK_SECRET_KEY`, `PAYSTACK_API_KEY`, `PAYSTACK_WEBHOOK_URL` | Partial / env-only | Provider config exists, not actively connected. |
| Paychant | Payment provider | `server/config/paymentProviders.ts` | `PAYCHANT_API_KEY`, `PAYCHANT_WEBHOOK_URL` | Partial / env-only | Provider config exists but no concrete runtime flow found. |
| Kotani Pay | Crypto / mobile money ramp option | `server/config/paymentProviders.ts`; `KOTANI_API_URL` in `.env` | `KOTANI_API_URL`, `KOTANI_API_KEY`, `KOTANI_SECRET_KEY`, `KOTANIPAY_*` | Partial / env-only | Local endpoint placeholder present; actual secret values not set. |
| M-Pesa STK Push | Mobile-money collection | `server/services/paymentGatewayService.ts`, `/api/webhooks/mpesa`, `/api/payments/mpesa/callback` | `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_AUTO_APPROVAL_MAX_KES`, `MPESA_AUTO_APPROVAL_MAX_PAYMENTS_24H`, `MPESA_AUTO_SETTLEMENT_ENABLED` | Policy-gated collection code present; not live-verified | Clean returning payers may be marked `auto_approved` (defaults: <= KES 20,000 and fewer than 5 previous payments in 24 hours); first payments and exceptions enter the admin queue. Auto-approval does not itself credit KES or deliver tokens. Legacy execution remains separately opt-in. |
| M-Pesa C2B PayBill | Member-directed PayBill collections | `/api/v1/wallets/rails/c2b` routes and `server/services/mpesaC2bService.ts` | `MPESA_C2B_ENABLED`, `MPESA_C2B_SHORTCODE`, `MPESA_C2B_CALLBACK_TOKEN`, `MPESA_C2B_VALIDATION_URL`, `MPESA_C2B_CONFIRMATION_URL`, `MPESA_AUTO_APPROVAL_MAX_KES`, `MPESA_AUTO_APPROVAL_MAX_PAYMENTS_24H`, `MPESA_AUTO_SETTLEMENT_ENABLED` | Policy-gated collection code present; not live-verified | Requires verified phone, admin URL registration, and a pre-created reference. Amount, payer phone, receipt uniqueness, first-payment, velocity, and risk checks determine auto-approval versus review. Request does not select an asset or vault. |
| M-Pesa B2C | Treasury / rotation payouts | `server/services/mpesaB2cPayoutService.ts`, rotation callback handlers | `MPESA_B2C_ENABLED`, `MPESA_B2C_SHORTCODE`, `MPESA_B2C_INITIATOR_NAME`, `MPESA_B2C_SECURITY_CREDENTIAL`, result/timeout URLs, callback token | Code path present; not live-verified | Existing payout service handles ambiguous initiation and result callbacks; no real payout was sent for this review. |
| Airtel Money | Mobile money | `server/config/paymentProviders.ts` | `AIRTEL_*` family (env keys present or implied by config) | Partial / env-only | Config present, but no explicit runtime flow found in the reviewed server files. |
| Onramper | Ramp / fiat-to-crypto provider | `server/config/paymentProviders.ts` | `ONRAMPER_API_KEY`, `ONRAMPER_BASE_URL` | Partial / env-only | Included in provider config, not yet completed. |
| Google OAuth | Identity / SSO | `server/api/auth_oauth_google.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT` | Partial / env-only | OAuth initiation is implemented; callback and live production credentials are not fully established in current env. |
| Telegram | Notifications and bot automation | `server/notificationService.ts`, `server/telegram.ts`, `server/api/auth_telegram_*` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_SECRET_TOKEN` | Connected end-to-end (code path exists) | Bot initializes and polls when token is present; currently token is blank or `REPLACE_WITH_SECRET`. |
| SendGrid | Email sending | `server/services/emailService.ts` | `SENDGRID_API_KEY` | Partial / env-only | Preferential provider when configured; otherwise SMTP fallback. |
| SMTP / email relay | Email fallback | `server/services/emailService.ts`, `.env` | `EMAIL_PROVIDER`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Partial / env-only | Fallback path exists, but SMTP credentials are not filled in. |
| Twilio | SMS 2FA / messaging | `shared/securityEnhancedSchema.ts` and env list | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Partial / env-only | Provider appears planned, not wired in a real runtime path found in reviewed code. |
| Africa’s Talking | SMS / OTP | `shared/securityEnhancedSchema.ts`, env list | `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME` | Partial / env-only | Schema and env names exist, but no concrete call path found. |
| WhatsApp Business | Messaging | `.env` and test setup | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | Partial / env-only | No clear runtime provider integration found; likely planned. |
| OpenAI | Optional LLM assistant | `server/agents/morio/api/llm_provider.ts` | `OPENAI_API_KEY` | Partial / env-only | Code path exists to call `https://api.openai.com/v1/chat/completions`, but no secret is currently configured. |
| Snapshot.org | Governance snapshot data | `server/services/snapshotGovernanceService.ts` | no credentials required by code; GraphQL endpoint is hardcoded | Connected end-to-end (API path exists) | Uses `https://hub.snapshot.org/graphql`; code path exists and is network-ready if Snapshot is reachable. |
| Alchemy / QuickNode / RPC | Web3 RPC and fallback endpoints | `.env` and blockchain config | `ALCHEMY_CELO_URL`, `QUICKNODE_CELO_URL`, `QUICKNODE_CELO_WS`, `ALCHEMY_CELO_WS`, `RPC_URL*`, `CELO_RPC_*`, `ETH_RPC_URL`, etc. | Partial / env-only | Local RPC endpoints are configured for dev; no secret-backed provider credentials appear to be live-filled. |
| Chainlink | Oracle / price feed | `.env`, `server/services/priceOracle.ts` and governance config | `CHAINLINK_API_KEY`, `CHAINLINK_RPC_URL`, `CHAINLINK_FEED_MAP`, `CHAINLINK_MTAA_USD_FEED` | Partial / env-only | Config exists; key blank/placeholder. |
| CoinGecko | Price feed | `server/services/priceOracle.ts` | `COINGECKO_API_KEY` | Partial / env-only | Code references Coingecko as a source, but key is blank/placeholder. |
| CoinMarketCap | Price and market metadata | `.env` | `COINMARKETCAP_API_KEY` | Partial / env-only | Env exists but no clear live runtime path found. |
| The Graph | Subgraph queries | `.env` | `THEGRAPH_API_KEY` | Partial / env-only | Key exists but not clearly wired; project has several graph-related services in docs/inventory. |
| Uniswap / 1inch | DEX pricing and routing | `.env` | `UNISWAP_API_KEY`, `ONE_INCH_API_KEY` | Partial / env-only | Config exists but does not look live-connected in the reviewed code. |
| Etherscan / Polygonscan / CELOSCAN | Contract verification and chain metadata | `.env` | `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, `CELOSCAN_API_KEY` | Partial / env-only | Providers are named in env; no direct runtime use was required for this audit. |
| JUMIO | KYC | `.env` | `JUMIO_API_TOKEN`, `JUMIO_API_SECRET`, `JUMIO_BASE_URL` | Partial / env-only | Env keys exist but not proven active. |
| Onfido | KYC | `.env` | `ONFIDO_API_TOKEN`, `ONFIDO_BASE_URL` | Partial / env-only | Env keys exist but not proven active. |
| Chainalysis | AML / sanctions checks | `.env` | `CHAINALYSIS_API_KEY`, `CHAINALYSIS_BASE_URL` | Partial / env-only | Env keys exist but not proven active. |
| Prometheus | Metrics / monitoring | `client/src/infra/prometheus.yml`, `package.json` with `prom-client` | `METRICS_AUTH_TOKEN`, `METRICS_COOKIE_TOKEN`, `METRICS_IP_ALLOWLIST` | Connected end-to-end (build/config exists) | Prometheus config exists; actual runtime endpoint may need to be exposed. |
| Grafana | Dashboard layer | `client/src/infra/prometheus.yml`, `.env` | `GRAFANA_PASSWORD` | Partial / config present | Docker/service config present; runtime credentials not fully validated. |
| Datadog | Monitoring / alerting | docs/TODOs and comments only | none found in active runtime code | Planned / docs-only | Explicitly referenced in TODO comments but not implemented. |
| Slack / Discord webhooks | Alerting | `server/workers/agent-worker.ts`, `README.md`, docs | `SLACK_SECURITY_WEBHOOK`, `SLACK_WEBHOOK_*`, `ADMIN_ALERT_WEBHOOK` | Partial / env-only | Webhook URLs are expected but not populated. |
| CCXT exchanges | CEX price and trading data | `server/services/ccxtService.ts` | exchange-specific API keys, `CCXT_TIMEOUT`, `CCXT_LOADMARKETS_TIMEOUT` | Connected end-to-end (library path exists) | Binance, Coinbase, Kraken, Bybit, KuCoin, OKX, Gate.io are supported. |
| Dex Screener / market data | Price and liquidity feeds | `server/services/priceOracle.ts` | inferred from code, no direct env keys found in reviewed env | Connected end-to-end (code path exists) | Active in price oracle fallback chain; not listed as env-based in current `.env`. |
| Web3 signers / local private keys | Transaction signing | `.env` private-key section | `PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `NAV_ORACLE_SIGNER_KEY`, `STRATEGY_EXECUTOR_PRIVATE_KEY`, etc. | Partial / env-only | Local/private key pattern is used, but no hosted KMS/KM3 provider is in use. |
| KM3 / KMS-hosted signer | Hosted wallets / key management | no direct code found | none found | Not found | No KM3/KMS provider abstraction was found in the repository. |

## Integration status by area

### 1. Payments and fintech

The app clearly intends to support a multi-provider payment stack:

- Stripe: implemented in app logic; live env not populated.
- Flutterwave / Paystack / Paychant / Kotani / M-Pesa / Airtel / Onramper: provider config exists; many local env keys are present. The codebase is structured for multi-provider routing, but the end-to-end connection appears incomplete because secrets are missing or unverified.

Recommended next step:
- choose primary provider(s) for production
- populate only the exact secrets used in the chosen environment
- add provider health checks and webhook verification tests
- store all production credentials in a real secret manager, not .env files

### 2. Web3 and oracles

This area is stronger than the payments stack:

- RPCs are configured for multiple chains (Celo, ETH, Polygon, BSC, Optimism, Arbitrum, Base, Solana, Tron, etc.)
- The app has Chainlink / CoinGecko / CCXT / Dex Screener price paths
- Snapshot governance integration exists at `server/services/snapshotGovernanceService.ts`
- Local key-based signers are present for governance and treasury actions

Status: more advanced than the payment stack, but production activation is still blocked by blank or placeholder secrets and lack of live endpoint tests.

### 3. Identity and messaging

- OAuth: Google flow exists and is implemented.
- Telegram bot: runtime implementation exists.
- SMS: Twilio / Africa’s Talking names exist, but no concrete live call path was seen.
- Email: SendGrid + SMTP fallback is implemented.

This is a partial integration matrix; good scaffolding, but many flesh-out items remain open.

### 4. Monitoring and alerts

- Prometheus config exists in `client/src/infra/prometheus.yml`.
- Grafana-related config and env are noted.
- Slack webhooks and admin alert webhooks are expected by worker code, but they are blank in `.env`.
- Datadog is only mentioned in docs/TODO comments; there is no direct runtime integration file in the reviewed code.

### 5. Governance snapshot and governance analytics

- Snapshot.org integration is present via a GraphQL client.
- No explicit Snapshot API token is required in code, so this is closer to a real live external call path than many other integrations.

## Missing / unknown items

The repo does not show a direct integration for the following provider families:

- Datadog SDK or agent integration
- KM3 / KMS / hosted signer abstraction
- direct production Slack bot implementation beyond webhook URL config
- real runtime call path for Twilio / WhatsApp / Africa’s Talking
- real live credentials for JUMIO / Onfido / Chainalysis / Paystack / Flutterwave / Kotani / M-Pesa / Airtel / OpenAI / CoinGecko / Chainlink / Uniswap / 1inch / The Graph

## Current environment status

The `.env` files in the repo are in a local-dev / placeholders state. For a real deployment, the critical missing items are:

1. all production secret values for external providers
2. live webhook secrets and callback URLs
3. environment-specific network URLs (mainnet/testnet vs local dev)
4. provider health checks and failover tests
5. provider-level status dashboards and alert routing
6. centralized secret management (Vault / Azure Key Vault / AWS Secrets Manager / GCP Secret Manager / equivalent)

## Recommended next steps

### Priority 1: decide the production provider set

Pick one canonical provider per category and remove or isolate unused ones.

- Payments: choose Stripe + one mobile-money path, or Stripe + M-Pesa + Flutterwave, but not all at once without a clear routing strategy.
- Messaging: choose SMTP/SendGrid + one SMS provider + Telegram/Slack alert routing.
- Identity: keep Google OAuth and implement provider verification without extra optional providers unless needed.
- Price oracles: keep Chainlink + CoinGecko + CCXT, with failover and lowest-latency path clearly defined.

### Priority 2: fill the actual environment matrix

Create a live `.env.production` or secret-store mapping with only the keys required for the chosen provider set:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY` or `[EMAIL/SMTP]_*`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY` if AI features are enabled
- `ALCHEMY_*` or `QUICKNODE_*` or other RPC credentials
- `CHAINLINK_API_KEY`, `COINGECKO_API_KEY`
- `SLACK_WEBHOOK_*`, `ADMIN_ALERT_WEBHOOK`
- `TELEGRAM_BOT_TOKEN`
- provider-specific mobile-money / KYC / AML variables for the selected live stack

### Priority 3: add runtime health checks and status tracking

For each provider, add:

- connection test endpoint
- health check / readiness check
- callback verification signature validation
- failure retry / alert policy
- per-provider status flag in the admin UI
- daily validation of credentials and renewal dates

### Priority 4: remove dead or speculative integrations

If a provider is not used in the active environment, remove the config and code path rather than leaving dormant secrets and dead dependencies. This reduces ops risk and prevents accidental production calls.

### Priority 5: implement a “provider registry” in the app

A lightweight registry would make the project easier to audit:

- `provider_name`
- `category` (payment / messaging / web3 / oracle / identity / monitoring)
- `role`
- `env_keys`
- `status` (connected / partial / disabled / missing)
- `last_health_check`
- `next_rotation_deadline`
- `owner`

This would make the current state explicit and keep future changes auditable.

## Bottom line

The project has strong architectural intent and many provider hooks, but it is not yet in a verified production state. For M-Pesa, STK, C2B, and B2C code paths now exist; a live deployment, Safaricom URL registration, settlement, and end-to-end KES-to-token/vault conversion have not been confirmed. Clean returning STK/C2B payers may be marked `auto_approved`; first payments and policy exceptions are `pending_review` and visible at the admin-only `GET /api/v1/wallets/rails/mpesa/settlements/pending` endpoint. Admins can inspect backlog and rolling 24-hour auto-approval metrics at `GET /api/v1/wallets/rails/mpesa/settlements/metrics`. Auto-approval does not credit a KES wallet or transfer tokens. Existing automatic execution remains separately gated by `MPESA_AUTO_SETTLEMENT_ENABLED=true`; these legacy paths are not a general-purpose KES conversion or MaonoVault delivery implementation. DAO-contribution STK callbacks still mark contributions pending for treasurer approval. Keep the flag off until the chosen ramp and fulfillment path is implemented and verified; do not equate an M-Pesa confirmation with on-chain MTAA/cUSD delivery.

The next realistic milestone is to lock the actual production provider list, populate the required secrets in a secure secret manager, and add health/status verification for each provider before broader rollout.
