# MTAA DAO provider status board

**Review date:** 2026-10-20  
**Companion report:** [Third-party provider audit](./third-party-provider-audit.md)

This is a static code/configuration inventory, not a production connectivity test. A provider is not marked operational just because its package, environment key, or integration code exists. No secret values are recorded here. Confirm status in each deployment environment using secret-manager metadata and safe health checks.

## Status key

- `[x] Code path`: a runtime integration path was found.
- `[ ] Verify`: still needs implementation, environment setup, or end-to-end testing.
- **Not verified**: no production credential or successful live call has been confirmed.
- **Not found**: no runtime integration was found in the reviewed source.

## Provider matrix

| Category | Provider / system | Role | Code / config evidence | Environment configuration to check | Current assessment | Next action |
|---|---|---|---|---|---|---|
| Data | PostgreSQL | Primary application database | `server/db.ts`, Drizzle config | `DATABASE_URL` (or the deployment's supported equivalent) | `[x] Code path`; runtime health not verified | Confirm the deployed connection, TLS policy, backup/restore, and migration status. |
| Data | Redis | Cache and queue infrastructure | Redis service and queue modules | `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `[x] Code path`; runtime health not verified | Confirm queue/cache connectivity, auth, TLS, persistence, and failover in the target environment. |
| Payments | Stripe | Subscriptions and card payment flows | `server/services/subscriptionService.ts`; Stripe webhook validation and routes | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `[x] Code path`; not live-verified | Verify test-mode payment lifecycle and webhook signatures, then configure production keys and replay/idempotency handling. |
| Payments | Flutterwave | Card/mobile-money payments | `server/config/paymentProviders.ts` provider config | `FLUTTERWAVE_ENABLED`, `FLUTTERWAVE_API_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_BASE_URL`, `FLUTTERWAVE_WEBHOOK_URL`, `FLUTTERWAVE_SECRET_HASH`, `FLUTTERWAVE_WEBHOOK_SECRET` | `[ ] Verify`; provider config exists, end-to-end flow not established | Confirm the actual runtime adapter and webhook path; add sandbox test before enabling. |
| Payments | Paystack | Card/mobile-money payments | Provider config in `server/config/paymentProviders.ts` | `PAYSTACK_ENABLED`, `PAYSTACK_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_BASE_URL`, `PAYSTACK_WEBHOOK_URL` | `[ ] Verify`; provider config exists, end-to-end flow not established | Confirm runtime adapter, callback verification, and sandbox-to-live promotion process. |
| Payments / ramps | Paychant | Crypto on/off-ramp option | Provider config in `server/config/paymentProviders.ts` | `PAYCHANT_ENABLED`, `PAYCHANT_API_KEY`, `PAYCHANT_BASE_URL`, `PAYCHANT_WEBHOOK_URL` | `[ ] Verify`; config-only in reviewed path | Decide whether to use it; otherwise remove dormant config. |
| Payments / ramps | Kotani Pay | Mobile-money / crypto ramps | `server/config/paymentProviders.ts`; Kotani service files and routes | `KOTANI_ENABLED`, `KOTANI_API_URL`, `KOTANI_API_KEY`, `KOTANI_SECRET_KEY`, `KOTANI_WEBHOOK_URL`, `KOTANIPAY_API_KEY`, `KOTANIPAY_SECRET_KEY`, `KOTANIPAY_WEBHOOK_SECRET` | `[x] Code path` exists in Kotani service/routes; deployment not verified | Confirm one canonical credential/variable set, test quote → payment → webhook → reconciliation, and document sandbox/live endpoints. |
| Payments | M-Pesa STK / Safaricom | Authenticated push collection | `server/services/paymentGatewayService.ts`; M-Pesa callback reconciliation | `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` or `MPESA_BUSINESS_SHORTCODE`, `MPESA_CALLBACK_URL`; `MPESA_AUTO_APPROVAL_MAX_KES`, `MPESA_AUTO_APPROVAL_MAX_PAYMENTS_24H`, `MPESA_AUTO_SETTLEMENT_ENABLED` | `[x] Code path`; clean returning payments auto-approved under policy; live path not verified | Policy defaults to KES 20,000, at most 5 prior successful payments in 24h, and holds first payments, mismatch, duplicate receipt, velocity, or flagged risk. Admin queue is for exceptions only. |
| Payments | M-Pesa C2B PayBill | Member-directed PayBill collections | `/api/v1/wallets/rails/c2b/request`, `/register`, `/validation`, and `/confirmation` | `MPESA_C2B_ENABLED`, `MPESA_C2B_SHORTCODE`, `MPESA_C2B_CALLBACK_TOKEN`, `MPESA_C2B_VALIDATION_URL`, `MPESA_C2B_CONFIRMATION_URL`; auto-approval policy variables; shared Daraja credentials | `[x] Code path`; clean returning payments auto-approved under policy; callback registration and live path not verified | Policy defaults to KES 20,000 and 5 prior successful payments per rolling 24h; holds first payments and exceptions. Admin queue is for exceptions only. |
| Payments | M-Pesa B2C / Safaricom | Treasury and rotation payouts | `server/services/mpesaB2cPayoutService.ts`; rotation result/timeout callbacks | `MPESA_B2C_ENABLED`, `MPESA_B2C_SHORTCODE`, `MPESA_B2C_INITIATOR_NAME`, `MPESA_B2C_SECURITY_CREDENTIAL`, `MPESA_B2C_RESULT_URL`, `MPESA_B2C_TIMEOUT_URL`, `MPESA_B2C_CALLBACK_TOKEN`; shared Daraja credentials | `[x] Code path`; live path not verified | Test sandbox initiation, timeout ambiguity, signed-by-token result callback, failure/retry, and reconciliation. Never retry ambiguous payouts without reconciliation. |
| Payments | Airtel Money | Mobile-money payments | Provider configuration only was identified | `AIRTEL_ENABLED`, `AIRTEL_API_KEY`, `AIRTEL_SECRET_KEY`, `AIRTEL_BASE_URL`, `AIRTEL_WEBHOOK_URL` | `[ ] Verify`; runtime flow not established | Implement and test the adapter or remove it from enabled-provider claims. |
| Payments / ramps | Onramper | Ramp aggregation | Provider configuration only was identified | `ONRAMPER_ENABLED`, `ONRAMPER_API_KEY`, `ONRAMPER_BASE_URL`, `ONRAMPER_WEBHOOK_URL` | `[ ] Verify`; runtime flow not established | Decide whether this is in scope; implement quote/order/webhook flow or remove dormant config. |
| Identity | Google OAuth | User login / identity | `server/api/auth_oauth_google.ts` and callback handler | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT` | `[x] Code path` exists; deployment and callback flow not verified | Run a full redirect/callback/session test with production-approved callback URLs and secrets. |
| Identity | Telegram Login | Account linking / authentication | Telegram auth route files | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_SECRET_TOKEN` | `[x] Code path` exists; deployment not verified | Test signed login/linking flow and bot webhook/polling mode in the intended environment. |
| Messaging | Telegram bot | Notifications and bot commands | `server/notificationService.ts`, Telegram modules/routes | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | `[x] Code path` exists; external delivery not verified | Validate startup, message delivery, user linking, and shutdown behavior using a non-production bot first. |
| Messaging | SendGrid | Transactional email | `server/services/emailService.ts` | `SENDGRID_API_KEY`, `EMAIL_FROM` | `[x] Code path` exists; delivery not verified | Verify sender/domain, delivery/bounce handling, and test templates. |
| Messaging | SMTP | Email fallback | `server/services/emailService.ts` | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `[x] Code path` exists; delivery not verified | Choose SendGrid or SMTP as the primary provider; test TLS/auth and alert on delivery failures. |
| Messaging | Twilio | SMS / phone verification candidate | Dependency and env keys exist; no concrete runtime send path identified | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | `[ ] Verify`; not found as active runtime sender | Implement/confirm a sender and delivery receipts, or remove the unused provider configuration. |
| Messaging | Africa's Talking | SMS / OTP candidate | Provider name/env keys and schema reference exist | `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME` | `[ ] Verify`; no concrete runtime call identified | Implement/confirm a sender and delivery receipts, or remove unused configuration. |
| Messaging | WhatsApp Business | Messaging candidate | Env keys and test fixtures exist; no production call path identified | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | `[ ] Verify`; no concrete runtime call identified | Implement webhook verification and messaging flow, or remove unused configuration. |
| AI | OpenAI | Optional Morio LLM provider | `server/agents/morio/api/llm_provider.ts` | `OPENAI_API_KEY`; model/provider selection in config | `[x] Code path` exists; external call not verified | Confirm whether enabled; review data sent to the provider, set usage limits, and test with non-sensitive prompts. |
| Governance | Snapshot.org | DAO spaces, proposals, and governance metrics | `server/services/snapshotGovernanceService.ts`; GraphQL endpoint | No API key is required by the current client; DAO/space identifiers are inputs | `[x] Code path` exists; endpoint/data not verified | Test known spaces and compare proposal/vote results with Snapshot; document fallback behavior and cache age. |
| Web3 / RPC | Celo RPC | Primary chain interaction | Blockchain services/config | `CELO_RPC_URL`, `CELO_RPC_FALLBACK`, `CELO_WS_URL` or deployment equivalents; chain ID and contract addresses | `[x] Code path`; local/dev URLs do not prove production connectivity | Select production RPC provider(s), verify chain ID, archive/log support, rate limits, and fallback. |
| Web3 / RPC | Alchemy | RPC provider option | Environment/config references | `ALCHEMY_CELO_URL`, `ALCHEMY_CELO_WS` | `[ ] Verify`; provider URL values must be checked in deployment secret/config store | Confirm provider is actually selected by runtime config; execute read-only chain health checks. |
| Web3 / RPC | QuickNode | RPC provider option | Environment/config references | `QUICKNODE_CELO_URL`, `QUICKNODE_CELO_WS` | `[ ] Verify`; provider URL values must be checked in deployment secret/config store | Confirm provider is actually selected by runtime config; execute read-only chain health checks. |
| Web3 / RPC | Other EVM / Solana / TON / Tron networks | Multi-chain endpoints | Network-specific RPC config and client code | `ETH_*`, `POLYGON_*`, `BSC_*`, `ARBITRUM_*`, `OPTIMISM_*`, `BASE_*`, `AVALANCHE_*`, `SOLANA_*`, `TON_*`, `TRON_*` RPC/WS keys | `[ ] Verify` per chain; env key presence is not evidence of supported production behavior | Mark each chain supported only after chain-ID, read, event, signing, and confirmation tests pass. Remove unused endpoints. |
| Signers | Local/private-key signers | Contract deployment and transaction execution | Signer/private-key references across services | `PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`, `PLATFORM_PRIVATE_KEY`, `NAV_ORACLE_SIGNER_KEY`, `STRATEGY_EXECUTOR_PRIVATE_KEY`, and role-specific signer keys | `[x] Code path` exists; custody and production use not verified | Inventory each key's owner, permissions, chain, storage, rotation, and emergency revoke procedure. Do not put production keys in `.env` or source control. |
| Signers | Hosted KMS / KM3 | Managed transaction signing | No direct provider integration identified | No KM3/KMS-specific runtime configuration identified | **Not found** | Select and implement a custody/signing provider if managed signing is required; otherwise document the local signer security model. |
| Price / oracle | Chainlink | On-chain price feeds | Oracle/price-related services and env references | `CHAINLINK_RPC_URL`, `CHAINLINK_FEED_MAP`, `CHAINLINK_MTAA_USD_FEED`; `CHAINLINK_API_KEY` only if used by the selected service | `[x] Code/config references`; live feed path not verified | Validate feed addresses, chain IDs, decimals, staleness checks, and fallback policy per asset. |
| Price / oracle | CoinGecko | Market price fallback | `server/services/priceOracle.ts` | `COINGECKO_API_KEY` where configured; code also uses public endpoint | `[x] Code path` exists; live rate limits not verified | Test fallback, attribution, rate-limit handling, and stale-data behavior. |
| Price / oracle | CCXT exchanges | CEX prices / optional trading | `server/services/ccxtService.ts` | Exchange-specific `*_API_KEY`, `*_API_SECRET`, optional passphrases; `CCXT_TIMEOUT`, `CCXT_LOADMARKETS_TIMEOUT` | `[x] Code path` exists; public/private access not verified | Enable only selected exchanges; verify public market reads and separately test private credentials with restricted permissions. |
| Price / oracle | Dex Screener | DEX price/liquidity fallback | Price oracle client/service | No credential identified in current inventory | `[x] Code path` exists; external response not verified | Verify supported chains/tokens, quote freshness, and liquidity filtering. |
| Price / oracle | CoinMarketCap | Price / market metadata candidate | Environment key only identified | `COINMARKETCAP_API_KEY` | `[ ] Verify`; no active runtime call identified | Confirm use in source; otherwise remove the key/config from the planned provider set. |
| Web3 data | The Graph | Subgraph query candidate | Environment key only identified | `THEGRAPH_API_KEY` | `[ ] Verify`; no selected subgraph endpoint confirmed in this review | Record each subgraph URL and consumer; test indexing lag and fallback. |
| Web3 / DEX | Uniswap / 1inch | Swap routing/API candidate | Env keys and DEX-related dependencies | `UNISWAP_API_KEY`, `ONE_INCH_API_KEY`; on-chain router addresses are separate configuration | `[ ] Verify` for hosted APIs; on-chain DEX code may be separate | Decide whether API or on-chain routing is authoritative; test quote, slippage, chain, and execution separately. |
| Explorer APIs | Etherscan / Polygonscan / CeloScan | Explorer metadata / verification | Environment key references | `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, `CELOSCAN_API_KEY` | `[ ] Verify`; not required for core transaction path unless used by tooling | Identify consumers and add keys only to environments that use them. |
| KYC / AML | Jumio | Identity verification candidate | Environment keys only identified | `JUMIO_API_TOKEN`, `JUMIO_API_SECRET`, `JUMIO_BASE_URL` | `[ ] Verify`; no active runtime path confirmed | Confirm whether product/legal requirements require it; implement provider flow or remove. |
| KYC / AML | Onfido | Identity verification candidate | Environment keys only identified | `ONFIDO_API_TOKEN`, `ONFIDO_BASE_URL` | `[ ] Verify`; no active runtime path confirmed | Confirm whether product/legal requirements require it; implement provider flow or remove. |
| KYC / AML | Chainalysis | Risk / sanctions screening candidate | Environment keys only identified | `CHAINALYSIS_API_KEY`, `CHAINALYSIS_BASE_URL` | `[ ] Verify`; no active runtime path confirmed | Confirm requirements, data handling, and runtime adapter; implement or remove. |
| Observability | Prometheus | Metrics scraping | `client/src/infra/prometheus.yml`; `prom-client` dependency | `METRICS_AUTH_TOKEN`, `METRICS_COOKIE_TOKEN`, `METRICS_IP_ALLOWLIST` as applicable | `[x] Config exists`; scrape target and endpoint compatibility not verified | Validate `/metrics` route, target/port, auth, and scrape success in the actual deployment. |
| Observability | Grafana | Metrics dashboards | Prometheus/Grafana deployment config references | Deployment-specific admin credentials; no values belong in this board | `[ ] Verify` | Confirm provisioning, durable storage, auth, alert rules, and datasource connectivity. |
| Observability | Datadog | APM / metrics / alerts | Docs/TODO references only; no active SDK/agent path identified | No active Datadog env/config identified | **Not found** | Decide whether required; if so, implement instrumentation, service/env tags, dashboards, and alert routing. |
| Alerts | Slack | Worker and operational alerts | Worker config reads Slack webhook env values | `SLACK_WEBHOOK_PERFORMANCE`, `SLACK_WEBHOOK_DOMAIN_ALERTS`, `SLACK_WEBHOOK_CAPACITY`, `SLACK_WEBHOOK_HEALTH`, `SLACK_SECURITY_WEBHOOK` | `[x] Code/config path` exists for some worker alerts; delivery not verified | Test each active webhook and channel; document alert ownership and fallback. |
| Alerts | Discord webhook | Critical payout/referral alerts | README and worker/route references | `ADMIN_ALERT_WEBHOOK` | `[x] Code path` exists; delivery not verified | Confirm the intended destination is Discord, test delivery, and add delivery-failure visibility. |
| Trading | Freqtrade | External trading/backtest service | Freqtrade route/service references | `FREQTRADE_API_URL`, `FREQTRADE_API_TOKEN`, wrapper/strategies paths as required | `[ ] Verify` | Confirm whether a running Freqtrade instance is part of deployment; test auth and safe read-only operations first. |
| Hosting / backups | AWS / cloud object storage | Region/backups configuration candidate | `AWS_REGION` and backup env names appear in env inventory | `AWS_REGION`, `BACKUP_LOCATION`, `BACKUPS_ENABLED`, encryption configuration | `[ ] Verify`; no AWS client/provider flow confirmed in this review | Identify actual backup target and restore test; configure cloud access through workload identity/secret manager if applicable. |

## M-Pesa settlement and token-delivery gap

The M-Pesa callback path confirms the fiat payment, but it does **not** currently fulfill a KES-to-MTAA/cUSD deposit or a MaonoVault deposit:

- Successful STK and C2B deposits run automated checks. Returning users with matching amount/phone, a unique receipt, no risk flag, fewer than 5 prior completed M-Pesa payments in the last 24 hours, and amount at or below the default KES 20,000 limit are marked `settlementStatus: auto_approved`; first payments and exceptions remain `pending_review` with reason codes at `GET /api/v1/wallets/rails/mpesa/settlements/pending`.
- Admins can inspect pending count, oldest pending age, and the rolling 24-hour auto/manual split at `GET /api/v1/wallets/rails/mpesa/settlements/metrics`; this endpoint reports metrics only and does not issue per-transaction alerts.
- Auto-approval is a policy decision, not a KES wallet credit, token conversion, or vault transfer. The existing generic `PaymentRecoverySAGAOrchestrator` dispatch and `AgentPaymentGateway` callback remain separately available behind `MPESA_AUTO_SETTLEMENT_ENABLED=true` (unset/false by default); enabling those legacy execution paths is not equivalent to enabling a mature ramp. The C2B request stores a user, KES amount, and phone, but no selected asset or vault.
- That SAGA reserves funds from the user's existing internal wallet, defaults the destination wallet to the same wallet, and only optionally updates a generic `accounts` vault. It does not obtain a KES/MTAA or KES/cUSD quote, use treasury liquidity to buy tokens, or call the MaonoVault deposit flow.
- The SAGA's blockchain step requires `metadata.signedTx`; the M-Pesa callback metadata does not provide one. A SAGA can therefore fail after attempting ledger steps and compensation, while the M-Pesa payment record itself is already marked completed.
- DAO-contribution STK callbacks take a separate path: they mark the contribution as paid/pending for treasurer approval and do not dispatch the generic payment SAGA. That is not an automatic treasury or vault credit either.

**Operational gate:** keep production M-Pesa collection disabled for token/vault deposits until the settlement model, KES conversion rate and fees, treasury source of liquidity, destination asset/vault, signer, and failure/reconciliation behavior are defined and implemented. A Daraja callback confirmation is evidence of KES received by the merchant, not evidence of MTAA/cUSD delivered on-chain.

## Environment key gap list

The checked-in `env_keys.txt` is generated from direct `process.env.KEY` references. It does not capture every `env.KEY` access in configuration modules or deployment-only settings. Add the following keys to the maintained environment reference if those providers remain in scope:

- Flutterwave: `FLUTTERWAVE_ENABLED`, `FLUTTERWAVE_API_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_BASE_URL`, `FLUTTERWAVE_WEBHOOK_URL`
- Paystack: `PAYSTACK_ENABLED`, `PAYSTACK_API_KEY`, `PAYSTACK_BASE_URL`, `PAYSTACK_WEBHOOK_URL`
- Paychant: `PAYCHANT_ENABLED`, `PAYCHANT_API_KEY`, `PAYCHANT_BASE_URL`, `PAYCHANT_WEBHOOK_URL`
- Kotani: `KOTANI_ENABLED`, `KOTANI_SECRET_KEY`, `KOTANI_BASE_URL`, `KOTANI_WEBHOOK_URL`
- M-Pesa and Airtel: `MPESA_ENABLED`, `AIRTEL_ENABLED`, `AIRTEL_API_KEY`, `AIRTEL_SECRET_KEY`, `AIRTEL_BASE_URL`, `AIRTEL_WEBHOOK_URL`
- Onramper: `ONRAMPER_ENABLED`, `ONRAMPER_API_KEY`, `ONRAMPER_BASE_URL`, `ONRAMPER_WEBHOOK_URL`

Use the code's actual variable names as canonical; do not create duplicate aliases just to make this table look complete. This list is a documentation gap list, not confirmation that every provider is implemented.

## Next actions

### P0 — Credential and environment safety

- [ ] Ensure real `.env` files are ignored and never committed. The repo environment file may contain local credentials; do not copy any values from it into docs, issues, or chat.
- [ ] If any credential has been committed, shared, or exposed, revoke/rotate it. Confirm `.env` is not tracked using Git metadata without printing its contents.
- [ ] Move production secrets to the deployment platform's secret manager; use separate credentials for local, staging, and production.
- [ ] Establish the production chain, network, contract addresses, RPC provider, and signer/custody approach.

### P1 — Select providers and close critical end-to-end paths

- [ ] Choose one primary payment provider and explicitly decide whether M-Pesa/Kotani are active requirements.
- [ ] Test a complete payment lifecycle: initiate → provider response → authenticated/token-protected callback → idempotent state update → reconciliation/refund or failure path.
- [ ] Monitor exception backlog and auto/manual rates; review/tune `MPESA_AUTO_APPROVAL_MAX_KES` and `MPESA_AUTO_APPROVAL_MAX_PAYMENTS_24H` after observing safe operating history.
- [ ] When ramps mature, explicitly decide whether to enable `MPESA_AUTO_SETTLEMENT_ENABLED`; do not treat the legacy automatic paths as ramp conversion or token/vault fulfillment.
- [ ] Verify primary RPC and fallback RPC for the selected chain; validate contract addresses and event confirmation policies.
- [ ] Inventory every signer by purpose, chain, permissions, custody, rotation owner, and emergency revoke process.
- [ ] Test Snapshot proposal/vote reads against a known DAO space and document whether Snapshot or on-chain state is authoritative.
- [ ] Keep fiat settlement separate from MTAA/cUSD minting or vault crediting. Confirm the treasury funding, exchange rate, and on-chain execution path before treating a confirmed M-Pesa payment as a completed token/vault deposit.

### P2 — Communications and monitoring

- [ ] Select SendGrid or SMTP as the primary email transport; verify delivery and bounce visibility.
- [ ] Decide which SMS, WhatsApp, and Telegram features are product requirements; implement or remove the dormant entries.
- [ ] Test Slack/Discord alert delivery and confirm named owners for critical payment, signer, and infrastructure alerts.
- [ ] Verify Prometheus scrape target/port and Grafana datasource/dashboard provisioning; decide whether Datadog is required.

### P3 — Reduce integration drift

- [ ] For each `[ ] Verify` row, decide **keep**, **implement**, or **remove**.
- [ ] Keep this board aligned with `.env.example`, `env_keys.txt`, deployment manifests, and code whenever provider wiring changes.
- [ ] Add automated CI checks for required variable names (never values), webhook signature tests, and provider-adapter contract tests.

## Definition of done for a provider

Mark a provider operational only after all applicable items pass:

- [ ] Selected for the target environment and has an accountable owner.
- [ ] Required variables are documented, present in the secret manager, and validated without logging their values.
- [ ] Safe health/readiness check succeeds against the intended provider and environment.
- [ ] Main success, failure, timeout, retry, and webhook/callback paths have automated tests.
- [ ] Authentication/signature verification, idempotency, rate limits, and data-handling requirements are reviewed.
- [ ] Monitoring, alert destination, runbook, and credential rotation/revocation procedure exist.
- [ ] An end-to-end test has passed in the target environment; record test date and result in the deployment's operational record, not in this static source inventory.
