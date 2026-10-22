# High-traffic UI / E2E + Responsive Test Report

Branch: `devin/1792692630-high-traffic-ui-e2e` · Date: 2026-10-22

## Environment
- Node 22, Vite dev client (:5173) + Express backend (:5000), local PostgreSQL 14 (`mtaa_e2e`, full migration runner).
- Redis intentionally **not running** (degraded-mode testing).
- Seeded member account (no DAO memberships, $0 balance) — so most pages were tested in their empty state.
- Viewports: 1280, 1024, 768, 430, 390, 375 (Chrome device emulation).

## Route mapping
| Priority | Requested | Route(s) tested |
|---|---|---|
| 1 | Login / auth | `/login` (+ `/register`, `/forgot-password` error feedback only) |
| 2 | Dashboard / Home | `/dashboard` (PersonalizedDashboard) |
| 3 | Portfolio / Positions | `/wallet`, `/wallet/dashboard` |
| 4 | Market / Trading | `/trading`, `/exchange-markets` |
| 5 | DAO / Treasury / Governance | `/daos`, `/create-dao`, `/proposals`, `/dao/treasury-overview` |

## Results per page
Breakpoints: D = 1280, T = 768/1024, M = 375/390/430. "Final" = re-checked after the last relevant fix.

| Page | E2E | Responsive | Notes |
|---|---|---|---|
| `/login` | PASS | PASS (D/T/M, final) | Required-field + invalid-credential feedback; valid login lands on `/dashboard`. Session refresh after 15 min was failing (fixed #12; forced-refresh re-check pending). |
| `/dashboard` | PASS | PASS (D/T/M, final) | Resolves to persona dashboard with explicit $0 totals. Sticky persona header covered GlobalNav on mobile scroll → now only sticky on lg+ (re-check pending). |
| `/wallet` | PASS | PASS (D/T/M) | Empty Add Funds → "Enter an amount greater than 0."; positive amount → explicit "not available yet". |
| `/wallet/dashboard` (Portfolio) | PASS | PARTIAL (M 430 only) | Fake $8,520 holdings/random charts replaced with real wallet balance + empty states. |
| `/trading` | PARTIAL | PARTIAL | Renders, Kraken search filters. Live provider down locally → reference prices now flagged with a banner. Treasury mode no longer shows a fabricated $48.5M treasury. |
| `/exchange-markets` | PASS (error state) | PARTIAL (430, 1024) | Upstream `top-assets` times out; after ~50 s (3×15 s retries) shows "Failed to load market data" + Retry. Happy path untested (no provider). |
| `/daos` | PASS | FAIL→fixed (re-check pending) | No-membership empty state + Start a Group CTA work. 390px `scrollWidth` 927 traced to Shell flex item lacking `min-w-0` (fixed). |
| `/create-dao` | PASS | PARTIAL (M) | Intro → select Savings Group → Continue → step 2 validation. Deployment not submitted. |
| `/proposals` | PASS | PASS (D/T/M, final) | Empty state "No decisions yet"; Suggest an Idea now routes to `/daos` (proposals are per-group). |
| `/dao/treasury-overview` | PASS (empty) | PARTIAL | No DAO → "Select a DAO…" + Browse your DAOs. Real treasury untested (no membership). |

## Critical blockers fixed in this PR
| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Every page unstyled | Tailwind v4 ignores `@tailwind` directives | `client/src/index.css`: `@import "tailwindcss"` + `@config` |
| 2 | `max-w-md` etc. ~12px wide | design-system `spacing.md` shadows `max-w-*` in v4 | pin `--max-width-*` in `@theme` |
| 3 | `/dashboard` crash "require is not defined" | CommonJS `require()` in browser code | ES imports (YukiDashboard, PersonalizedDashboard, modal-design) |
| 4 | `/dashboard` infinite spinner | `useAuth`/`useUser` treated unwrapped `{ user }` as `User` | normalize both shapes |
| 5 | `/api/api/...` requests | `VITE_API_URL` ending in `/api` + endpoints adding `/api` | strip trailing `/api` in `apiConfig.tsx` |
| 6 | `/wallet` crash "TooltipContent must be used within Tooltip" | orphan Radix tooltip pairs | wrap in `<Tooltip>` (ExchangeRateWidget, VaultCreationWizard) |
| 7 | `/wallet/dashboard` crash "lockedSavings.map is not a function" | savings API returns envelope | `toSavingsArray()` |
| 8 | Wallet Add Funds/Withdraw silent no-op | no validation, silent fallback | inline validation + explicit "not available yet" error |
| 9 | `/create-dao` crash, then blank | default export skipped provider; `renderPreview` missing `};` swallowed main return | export `CreateDAOFlow`; close `renderPreview` |
| 10 | `/proposals` dead-end "Route /api/proposals not found" | no such route | use `/api/dashboard/proposals`; Retry button |
| 11 | `/dao/treasury-overview` requests `/daos/undefined/...` | route has no `:daoId` | fall back to selected DAO; select-DAO empty state; Retry |
| 12 | Logged out ~15 min after login | `csrf_token` cookie expired with access token → refresh 403 | `csrf_token` maxAge = refresh-token lifetime (7d) |
| 13 | Mobile: nav overlap, 176px blank gap, horizontal scroll on `/wallet`, `/daos`; tablet GlobalNav overflow | fixed mobile top bar over sticky GlobalNav; `pt-44`; Shell flex item without `min-w-0`; GlobalNav labels at md | layout fixes in App/GlobalNav/mobile-nav/Shell/wallet/daos/PersonalizedDashboard |
| 14 | Portfolio Overview shows fake $8,520 to a $0 account | hard-coded mock data | labelled "Sample data"; "Conversion rates unavailable" when no rates |

## Remaining issues (not fixed), by severity
**High**
1. Live market data unverified — `/exchange-markets` upstream timeouts (~50 s before error); `/trading` live provider unavailable locally. Consider a shorter first-attempt timeout.
2. Forced token-refresh (CSRF fix #12) not yet re-verified in browser after the fix.

**Medium**
3. Console/integration errors on every authenticated page: notifications SSE failure, Socket.IO "Invalid namespace", `/api/features` 403 for members (route is `super_admin`-only but `FeaturesProvider` calls it for everyone), missing wallet 2FA-config route.
4. Pre-existing TS errors: `useBalance({ token })` / `.formatted` in `VaultCreationWizard.tsx` and `ExchangeRateWidget.tsx` (wagmi API drift).
5. Proposal creation has no global entry point; Suggest an Idea routes to `/daos` until a per-group create route is linked.

**Low**
6. `/wallet/dashboard` tab strip cramped at 430px (Deposit/Withdraw).
7. Emoji glyphs render as boxes in the headless test browser (font, not app).
8. Backend dev setup: `TELEGRAM_SECRET_TOKEN` is required to boot; `db:push` misses SQL-only migration `042-exchange-fee-schedule-history` (needs `RUN_MIGRATIONS=true`).

**Not covered**: real DAO membership/treasury data, on-chain transactions, registration/OTP delivery (no SMTP/SMS/Redis), full offline recovery, logout.
