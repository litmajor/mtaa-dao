# Okedi Manifest

Purpose: Provide a concise product + technical manifest for OKEDI — the "community / DAO / governance" persona layer of MtaaDAO. This manifest maps the core surfaces, the system owners (API routes / services / contracts), state sources, and recommended build priorities.

Audience: PMs, engineers (frontend & backend), designers, and integrators.

---

## Summary

OKEDI is the beginner persona that surfaces Chama-oriented workflows: creating and joining DAOs, recording and confirming local payments (M-Pesa / Cash), treasury visibility and management, governance (proposals & voting), reputation/trust, referrals, and member communication.

This manifest lists the UI surfaces expected in OKEDI, the system endpoints that own the state, current coverage status (based on repo scan), and a recommended build plan.

---

## Canonical Surfaces (Quick Reference)

- GlobalStateBar: persistent treasury NAV, proposals, members, exposure, regime, exchanges, risk, pending
- DomainNav: Treasury | Governance | Markets | Members | Intelligence | Automation | Operations
- BalanceHeader: personal balance, trust score, governance score, member stats
- QuickActions: Record Payment, Receive, Send, Transfer, Payment Links, Batch Transfer, Bill Split, Recurring, Escrow, Vote, Refer, Settings, Analytics, Chat
- DAOCards / DAOs list: list of user DAOs with basic actions (join/leave/manage)
- DAODashboard FocusPanel: per-DAO workspace (members, treasury, proposals, escrow pipeline)
- ActiveProposals & ProposalCard: proposals list, vote modal, results card
- Payments (Record / Confirm / List / Receipts): record local payments, upload receipts, confirm contributions
- Treasury Workspace: whitelist, limits, approvals, multisig flows
- KYC Banner/Checklist
- AnalyticsPanel: quick stats (volume, avg tx, growth)
- RecentActivity / Transaction feed
- DAO Chat
- Referral Program panel
- Onboarding checklist & first-run flow

---

## System ↔ Surface Mapping (selected)

- DAOs list
  - State Source: `daos`, `dao_memberships`, `dao_contributions` DB tables
  - System Owner: `GET /api/daos` (server/routes/daos.ts) and `GET /api/dashboard/okedi` (dashboardService.getOkediDashboard)
  - Current Surface: `OkediDashboard` (`client/src/components/dashboard/OkediDashboard.tsx`) — WIRED

- DAO dashboard stats
  - State Source: `proposals`, `dao_memberships`, treasury (TreasuryService on-chain)
  - System Owner: `GET /api/daos/:daoId/dashboard-stats` (server/routes/daos.ts)
  - Current Surface: DAO focus panel in `OkediDashboard` — WIRED (needs UX polish)

- Record Payment (OKEDI flow)
  - State Source: `dao_contributions`, `wallet_transactions`, `payment_receipts`
  - System Owner: `POST /api/daos/:id/payments/record`, `POST /api/daos/:id/payments/:paymentId/confirm`, `POST /api/daos/:id/payments/:paymentId/receipt` (server/routes/daos.ts)
  - Current Surface: `RecordPaymentModal` (client/modals) triggered from QuickActions — WIRED (end-to-end)

- Governance (Proposals & Voting)
  - State Source: `proposals`, `votes`, `voting_power` (on-chain / db)
  - System Owner: `GET /api/proposals`, `GET /api/proposals/:id`, `POST /api/proposals`, `POST /api/proposals/:id/emoji-vote` (server/routes/proposals.ts)
  - Current Surface: Proposal lists, `ProposalCard`, `VoteProposalModal` in `OkediDashboard` — WIRED

- Reputation & Trust
  - State Source: `contribution_graph`, `reputation_badges`, `achievements`
  - System Owner: `server/routes/reputation.ts` and `ReputationService` — WIRED
  - Current Surface: BalanceHeader trustScore, reputation panels — STUB (visuals present; deeper integrations possible)

- Treasury Management (Whitelist & Limits)
  - State Source: `treasury_whitelist`, `treasury_limits`, on-chain multisig
  - System Owner: `server/routes/treasuryManagement.ts` and `TreasuryService` — WIRED (APIs exist)
  - Current Surface: TreasuryWorkspace & GlobalStateBar — PARTIALLY WIRED (UI surfaces exist; advanced multisig flows need UX)

- Referral Program
  - State Source: `wallet_transactions` (type: referral_reward) and referral tables
  - System Owner: `server/routes/referrals.ts`, `server/routes/referral-rewards.ts` — WIRED
  - Current Surface: Referral panel in Okedi — STUB (mock data previously) — needs wiring to live stats

- DAO Chat
  - State Source: chat messages table / websocket streams
  - System Owner: `server/routes/dao-chat.ts`, websocket service — WIRED
  - Current Surface: `DaoChat` preview in dashboard — STUB (preview stub present; full chat UX needs routing)

---

## Gaps & Collisions (high level)

GAP: Market data & watchlist (OKEDI should hide heavy trading UIs)
  - System: `/v1/market/*` and `/v1/yuki/*` — Should surface in: YUKI — Priority: P2

GAP: Vault positions & AllocationBreakdown (Amara features surfaced in Okedi)
  - System: `MaonoVault` & `Vaults` contracts + `server/services/vault*` — Should surface in: AMARA — Priority: P1

COLLISION: QuickActions list contains advanced actions (Escrow, Batch Transfer) visible to Okedi
  - Currently in: Okedi — Should be in: Okedi (but gated by `advancedModeGuard` or UX levels)
  - Reason: Action visibility needs role/KYC gating per persona

GAP: DAO-level advanced treasury approval flows (multisig execution) UI
  - System: `treasuryManagement` & `multisig` routes — Should surface in: Okedi (Treasury workspace) — Priority: P0

GAP: Charity/recipient whitelist admin UX for non-admin members
  - System: `treasury-management` routes — Should surface in: Okedi (Treasury) — Priority: P1

---

## State Shape Audit (Okedi)

Canonical `OkediDashboardData` (server/services/dashboardService.ts) keys used by frontend:
- totalBalance: number
- trustScore: number
- governanceScore: number
- votesCount: number
- proposalsCreated: number
- memberSince: string
- daoCount: number
- currentUser: { id, name, walletAddress, votingPower }
- kycStatus, kycProgress, transferLimits
- cryptoCurrency, fiatCurrency
- recentTransactions: [{ id, type, amount, currency, from, to, timestamp, status }]
- balances: BalanceSource[]
- myDAOs: [{ id, name, description, role, memberCount, treasuryBalance }]
- activeProposals: [{ id, title, description, votesRequired, currentVotes, status, daysLeft, daoName }]
- activeEscrows: Array
- governanceStats: {...}
- referralStats: {...}
- daoChat: { daoId, daoName, messages[] }

Frontend expectations (OkediDashboard.tsx):
- `getOkediDashboard()` returns a JSON object matching above. The frontend currently accesses: `myDAOs`, `recentTransactions`, `referralStats`, `currentUser`, `balances`, `activeProposals`, `activeEscrows`, `kycStatus`, `kycProgress`, `transferLimits`, and `governanceScore`.

Dead/unused data observed on server: `tipOfTheDay` is generated but intentionally not returned in API contract. Frontend computes or displays tips from server-side comments or local resources.

---

## 10 Highest-Impact Build Items (recommended order)

P0 — Build Now (unblocks core persona workflow)
1. Treasury multisig approval UX + transaction execution (Okedi)
   - System: `treasury-management` + `multisig` routes, `TreasuryService` on-chain execution
   - Component: Treasury approvals panel, multisig signer flows, confirm/execute actions
   - Notes: Critical for funds safety. Backend endpoints exist; UX and final multisig signing flow required.

2. Payments confirmation & receipts flow polish (Okedi)
   - System: `POST /api/daos/:id/payments/record` & confirm & receipt upload
   - Component: RecordPaymentModal, Payments list with confirm action and receipt viewer
   - Notes: High user impact for chama adoption.

3. Proposal voting results + real-time updates (Okedi)
   - System: `proposals` + `votes` routes + websocket events
   - Component: ProposalResultsCard (live vote progress), real-time updates via `socket.io`
   - Notes: Voting is core.

4. DAO Onboarding checklist completion UX (Okedi)
   - System: `OnboardingService` used by `POST /api/daos/:id/onboarding`
   - Component: Onboarding checklist modal, task progress, invite + first contribution flows
   - Notes: Reduce first-run churn.

5. Referral stats wiring (Okedi)
   - System: `referrals` + `referral-rewards` routes
   - Component: Referral panel showing real earnings, link copy, reward claim
   - Notes: Drives growth.

P1 — Build Next (closes major gaps)
6. DAO Chat full UX + websocket integration (Okedi)
   - System: `dao-chat.ts` + websocket service
   - Component: Full Chat page, thread view, mention support

7. Reputation badge display & airdrop eligibility (Okedi)
   - System: `reputation` routes
   - Component: Reputation card in BalanceHeader, badges list, airdrop claim flow

8. Treasury recipients whitelist admin UX
   - System: `treasury-management` whitelist endpoints
   - Component: Whitelist request panel, admin approval modal

P2 — Polish (stubs needing real data)
9. AnalyticsPanel — hook real time data & historical charting
   - System: `analytics` routes
   - Component: Expand charts, history, export

10. QuickActions gating & personalization
   - System: `users/persona-data` & feature flags
   - Component: Feature gating per KYC/role, reorder quick actions

---

## Remove / Defer
- TipOfTheDay: remove or move into Morio intelligence cards (not as a persistent UI element)
- Watchlist & Charts: defer to YUKI persona — do not clutter Okedi

---

## Next steps
- Validate with design: wireframe Treasury multisig flows and Record Payment UX
- Sprint: 2-week plan: P0 items 1-4 in first sprint
- I can expand this into a CSV feature table and a full cartographer output if you'd like.

---

Generated from repo scan on 2026-06-22. If you want the full feature table CSV or the Build Manifest in a different layout, tell me which format.

## Detailed Feature Table (Markdown)

| Feature | Endpoint / Client API | State Source | System Owner (file) | Surface / Component | Current Status | Priority | Notes / Gaps |
|---|---|---|---|---|---|---|---|
| DAOs list | `GET /api/daos`, `GET /api/dashboard/okedi` | `daos`, `dao_memberships`, `dao_contributions` | server/routes/daos.ts, server/services/dashboardService.ts | `client/src/components/dashboard/OkediDashboard.tsx` (DAOCards) | Wired | P0 | Needs UX polish for large lists |
| DAO dashboard stats | `GET /api/daos/:daoId/dashboard-stats` | `proposals`, treasury balances, memberships | server/routes/daos.ts, TreasuryService | DAO Focus Panel | Wired (partial) | P0 | Treasury breakdown needs multisig execution |
| Record Payment | `POST /api/daos/:id/payments/record` | `dao_contributions`, `wallet_transactions`, `payment_receipts` | server/routes/daos.ts | `RecordPaymentModal`, Payments list | Wired | P0 | Receipt pendingRewards calc; KYC gating |
| Payment Confirm / Receipt | `POST /api/daos/:id/payments/:paymentId/confirm`, `POST .../receipt` | `wallet_transactions`, contribution confirmations` | server/routes/daos.ts, TreasuryService.updateStoredTreasuryBalance | Payments list, Receipt viewer | Wired | P0 | Manual treasury update race conditions to validate |
| Governance: Proposals & Voting | `GET/POST /api/proposals*`, `POST /api/proposals/:id/emoji-vote` | `proposals`, `votes`, on-chain voting power | server/routes/proposals.ts | `ProposalCard`, Vote modal, Real-time results | Wired | P0 | Websocket live-updates integration required (socket.io) |
| Reputation & Trust | `server/routes/reputation.ts` APIs | `reputation_badges`, `contribution_history` | server/routes/reputation.ts | BalanceHeader trustScore, Badges panel | Implemented (API) Visuals stub | P1 | Airdrop eligibility and claims UI |
| Treasury: core balance & history | `GET /api/v1/daos/:daoId/treasury/core`, `TreasuryService.getBalance()` | vault holdings, on-chain balances, treasury tables | server/routes/v1/daos/_daoId/treasury/core.ts, server/services/treasuryService.ts | Treasury Workspace, GlobalStateBar | Wired (server) | P0 | Cross-chain USD valuation & refresh |
| Treasury: whitelist & limits | `GET/PUT /treasury/management/limits`, whitelist endpoints | `treasury_whitelist`, `treasury_limits` | server/routes/v1/daos/.../treasury/management.ts, client/src/api/treasuryAPI.ts | Whitelist admin panel | APIs exist | P1 | Admin UX and role gating |
| Treasury: multisig approvals & execution | `/v1/.../treasury/multisig` endpoints, multisig flows | `pending_approvals`, `multisig_signatures`, on-chain multisig contract | server/routes/v1/daos/.../treasury/multisig.ts, TreasuryService | Pending Approvals panel, signer UX | Backend present (phase) | P0 | Execution UX + signature collection + edge-case retries |
| Treasury: intelligence & health | `POST /api/treasury/analyze`, `GET /api/treasury/health/:daoId` | vaultTokenHoldings, historical snapshots | server/api/treasury.ts, server/services/treasuryService.ts | Treasury Health card | Implemented (analysis server) | P1 | Price oracle mapping; UI story for alerts |
| Referrals: stats & leaderboard | `GET /api/referrals/stats`, `/leaderboard` | `users.referredBy`, `wallet_transactions`(referral_reward) | server/routes/referrals.ts | Referral panel (link, stats) | Wired | P1 | PendingRewards TODO; UI wiring |
| Referral Rewards: weekly distribution & claims | `server/routes/referral-rewards.ts` (`/current-week`, `/claim/:id`, `/distribute`) | `referral_rewards`, `referral_payouts` | server/routes/referral-rewards.ts | Rewards history, Claim flow | Implemented (cron + DB) | P1 | Sybil defense summary; admin controls |
| DAO Chat | `GET/POST /dao/:daoId/messages`, `/upload`, presence | `dao_messages`, websocket streams | server/routes/dao-chat.ts, chatService | DAO Chat page, attachments | Wired (backend) | P1 | File storage retention policy; moderation tools |
| Transactions: batching & execution | `/api/transactions/batches/*`, `/contracts/*`, `/swaps` | batches, registered-contracts, swaps, yield positions | server/routes/transactions.ts, services/transaction-service | Transaction hub (advanced) | Implemented (Phase 3) | P2 | Complexity: on-chain execution, simulators |
| Yield & staking positions | `/api/transactions/yield/*` | yield_positions, rewards | server/routes/transactions.ts, yuki services | Yield positions UI | Implemented (backend) | P2 | UX for novice Okedi persona should be simplified |
| Bridges & simulation | `/api/transactions/bridge`, `/api/transactions/simulate` | bridge_transactions, simulation_results | server/routes/transactions.ts | Bridge status, Simulation viewer | Implemented (backend) | P2 | Security checks for bridge recipients |
| Client: Treasury hook & APIs | `client/src/hooks/useTreasury.ts`, `client/src/api/treasuryAPI.ts` | local DAOTreasury config + server APIs | client/src/hooks/useTreasury.ts, client/src/api/treasuryAPI.ts | TreasuryPage, Treasury admin UIs | Implemented (client) | P1 | Wire server-side multisig + pending approvals endpoints |

> Notes:
- "WIRED" indicates server-side endpoints exist and are callable by the frontend.
- Priorities: P0 = unblock core Okedi workflows; P1 = important for completeness; P2 = polish or advanced features.

---

If you'd like this exported as CSV or filtered by Priority/P0 items only, say "CSV" or "P0 only" and I'll produce it next.