# MtaaDAO Pricing & Monetization Spec — v3 (Hardened)

**Status:** Architecture settled. Numeric parameters mostly TBD — pending real usage data (no live transaction/conversion data exists yet as of this writing). Verified implementation facts are recorded below as FOUND, not treated as tuning decisions.
**Supersedes:** "Final Pricing Structure v2.0" and "Unified Pricing & Monetization Strategy v1.0" (both legacy — delete once this is implemented). Also supersedes `DAO_TYPE_CONFIG.requiredTier` as a creation gate.

---

## 1. Core Principle

No subscription tier gates DAO or user existence, creation, or basic transacting. Subscription is decoupled entirely and is an **opt-in add-on for advanced tooling only**. Revenue is primarily activity-based (transaction fees), not access-based (recurring seat/tier fees) — this is a deliberate departure from the legacy docs' SaaS-tier-first model, chosen because recurring subscriptions are believed to face resistance in the target market (this belief is untested — treat as a hypothesis to validate with real conversion data, not a confirmed fact).

---

## 2. Individual Users

- Vault creation: free, no subscription required.
- Revenue: transaction fees only.
- Vault count cap: **soft cap** for normal vault types (savings, escrow, etc.) — enforced at the backend/indexing layer (platform manages/displays up to N; does not block on-chain creation beyond that, consistent with the non-custodial architecture).
  - Cap mechanism candidates (open): KYC-tier-linked limit + inactivity-based reclamation of dormant vaults. KYC must NOT block *basic* vault access (non-custodial, on-chain creation is a deliberate design choice) — KYC only caps how many vaults the platform actively manages/indexes per user.
  - Numeric limits per vault type: **TBD** — depends on cost/risk profile per type, needs further thought over time.

### Hard-capped vault types (factory-enforced, on-chain)
| Vault type | Cap mechanism | Cap size | Notes |
|---|---|---|---|
| MaonoVault (DHF) | Factory contract enforced | 5 per user | Single-asset/bucketed, higher compliance weight; verified in `MaonoVaultFactory.sol` as `MAX_VAULTS_PER_USER = 5` |
| MultiAssetVault | No cap found | TBD | Multichain, share-based, investment-pool-driven; often DAO-scoped (investment DAO type). No factory-enforced MultiAssetVault cap was found. |

**DAO-scope gap:** the MaonoVault factory count is keyed only by `msg.sender`; it does not accept or track a DAO ID. The server's DAO vault creation paths likewise do not enforce an aggregate per-DAO vault count. Therefore a DAO-level exposure/operational cap does not currently exist, and per-user caps cannot be treated as a DAO-wide limit.

**Interim DAO-cap decision:** use a backend/application-layer soft cap for DAO-owned or DAO-managed MaonoVault instances. The platform should count and flag/block new managed DAO vaults after a conservative placeholder threshold, while preserving the factory's hard 5-per-caller cap. This does not prevent arbitrary non-custodial on-chain creation and must be presented as a platform-management limit, not an on-chain custody guarantee.

**Scaling model:** a high-investor DAO should generally route many investors into a small number of shared DAO-owned MaonoVaults. Creating one DAO MaonoVault per investor would turn the aggregate cap into a membership multiplier and is an architectural smell, even if each caller remains within the individual cap. A future hard cap requires a DAO-aware factory redesign with DAO identity/membership authorization, per-DAO accounting, migration/redeployment planning, and new tests; defer it until real DAO-size and vault-count data exists.

**Residual boundary:** the DAO soft cap does not constrain a member's separate personal MaonoVault allowance. A member may still hold personal MaonoVaults while depositing into DAO-owned shared vaults; those are distinct use cases and call paths.

---

## 3. DAOs

- **Creation fee:** one-time, functions as anti-spam/setup cost, not a revenue driver. The current Phase 1 implementation uses a type-based KES schedule; member-count scaling is not currently applied. The type schedule is a separate creation/support-cost decision, not the removed subscription-tier gate.
- **Current Phase 1 KES schedule (FOUND & VERIFIED):** `harambee` 500, `shortTerm` 800, `savings` 1,000, `merryGoRound` 1,200, `community` 2,000, `investment` 3,000. The canonical runtime source is `server/services/daoSpawnService.ts`; the rationale is retained in the named companion `docs/mtaa-monetization-strategy.md`.
- **Ongoing fees:** transaction fees on treasury/pool activity, same fee mechanism as individual users (not a separate DAO-specific schedule).
- **Interim implementation decision:** keep the flat **2.0%** platform transaction fee until usage data supports a replacement. This is the live placeholder in `revenueService.ts` and `investmentPoolPricingService.ts`; the June companion document's type-specific activity schedule is not currently active in contracts or the server fee path.
- **Candidate design, not yet approved for launch:** the companion proposes deposit 0.15%, rotation payout 0.20%, loan origination 0.40%, withdrawal 0.20%, and yield claim 5% of yield. These values remain a candidate schedule for a future transaction-type pricing review, not an accidental override of the 2.0% interim.
- **Launch risk:** 2.0% is materially above the candidate 0.15%–0.40% activity rates and could charge a beginner chama several multiples of the considered design. The authenticated M-Pesa spawn flow is wired and no pricing feature flag or kill switch was found, so exposure is conditional on production access, but the launch gate must explicitly accept 2.0% or replace it before real chamas transact.
- **Fee ladder variable:** volume-based (chosen over treasury-size and member-count after review — see §5).
  - Direction: **higher volume → lower fee %** (classic pay-as-you-grow, rewards activity — matches the "volume/users first" growth goal).
  - Bracket thresholds and %: **TBD**, pending real transaction data.
- **MTAA-holding discount:** separate modifier layered on top of the volume ladder (not a gate — a DAO/user still gets the volume-based discount regardless of MTAA holdings; MTAA holding adds an *additional* discount).
  - Must be **time-locked/staked**, not a spot balance check, to prevent borrow-hold-sell gaming around fee calculation timing.
  - The MaonoVault upkeep discount has an implemented 30-day minimum stake age and a 0–50% square-root curve, but this is upkeep-specific and not the general transaction-fee discount described here. The general MTAA discount lock duration and percentage remain **TBD**.
- **DAO type gating:** `DAO_TYPE_CONFIG.requiredTier` is legacy and must be removed or repurposed. No DAO type should require a subscription tier to be *created*. If certain types (e.g., `investment`) naturally pair with advanced-tooling features, that pairing belongs in the subscription upsell flow (§4), not the creation path.
- **DAO scaling:** the client config declares `upgradePathTo`/`upgradePathFrom` relationships between DAO types, but no server route, service, database mutation, or contract workflow was found to execute a type conversion. DAO type is fixed at creation in the current runtime. Member count, treasury size, and future volume pricing are growth dimensions; type conversion is an unimplemented feature gap.
- **Upgrade-language UI audit:** the `upgradePathTo`/`upgradePathFrom` metadata is not rendered directly, but legacy UI components do show phrases such as “Upgrade to Short-Term DAO” and “Upgrade to Collective DAO.” The inspected flows target subscription/extension behavior, not DAO-type mutation; the wording should eventually be renamed or removed to avoid implying that type conversion exists.
- **Currency scope:** Phase 1 DAO creation is KES-first through M-Pesa. `getSpawnFeeQuote()` returns the fixed KES amount and an informational cUSD estimate using a cached USD/KES rate; payment initiation and recorded payment currency remain KES. Dynamic multi-currency fee collection is not implemented and is outside the Kenya-only launch scope.

---

## 4. Subscription (fully decoupled)

- Not tied to DAO size, DAO type, or user identity in general.
- Pure opt-in SaaS add-on for **advanced tooling only**: multisig complexity, pooled investment management, advanced treasury/reporting — the kind of feature surface the legacy `investment` DAO type implies.
- No subscription tier caps member count, treasury size, or transaction volume — those constraints from the legacy docs are dropped entirely.

---

## 5. Fee Ladder Variable — Decision Record

Considered: volume, treasury-size, member-count.

- **Volume** — selected. Only variable that scales with the actual growth goal (activity), rather than something orthogonal (holding) or opposed (dormancy) to it.
- **Treasury-size** — rejected as the *transaction*-fee variable (taxes holding, not activity — pulls against "volume first"). Retained elsewhere: already used for vault management/performance fees, which is the correct home for an AUM-based fee.
- **Member-count** — rejected as an *ongoing* ladder variable (recreates the legacy tier-by-size gating under a new name; mismatched to actual per-transaction cost). Retained as an input to the one-time DAO creation fee only.

---

## 6. Known Open Items (blocking full implementation)

1. Vault-count caps per normal vault type — numeric values not yet decided. The backend's flat cap of 10/user is interim; MaonoVault's separate on-chain cap of 5/user is FOUND & VERIFIED. A DAO-level aggregate cap is also missing and must be designed before DAO-scale operational-cost assumptions are finalized.
   - Interim code guard: flat cap of 10/user is currently live in `userSubscriptionService.ts` as of 2026-08-18, pending final mechanism design and real usage data.
2. MaonoVault/factory enforcement mechanism — **FOUND & VERIFIED**: `MaonoVaultFactory.sol` reverts on `MAX_VAULTS_PER_USER = 5`; no per-vault on-chain AUM ceiling was found.
3. MultiAssetVault hard cap number — **not found in code**; depends on eventual count of supported asset-strategy configs. DAO-level vault exposure limits are also absent.
4. Volume ladder bracket thresholds and fee percentages — needs real usage data. The June type-specific schedule is a candidate baseline to evaluate alongside the volume ladder; it is not implemented.
5. MTAA discount lock duration and discount percentage — the general transaction-fee modifier needs real usage data. Existing MaonoVault upkeep behavior is documented above and is not a substitute.
6. One-time DAO creation fee amount(s) — **FOUND & VERIFIED for Phase 1**: the six type-based KES values are live in `daoSpawnService.ts`; whether member-count scaling should be added remains open.
7. DAO type conversion/upgrade workflow — **not implemented**; client upgrade-path metadata exists, but no executable conversion path was found.
8. DAO-level vault cap — **interim decision made**: implement a backend soft cap for DAO-owned/DAO-managed MaonoVaults; defer a DAO-aware on-chain factory redesign until usage data supports the threshold and contract scope.
9. Dynamic multi-currency DAO pricing — **not implemented**; retain fixed KES pricing for Kenya-only Phase 1 and scope currency expansion separately.
10. Pre-launch fee approval — confirm whether real users may transact under the 2.0% interim before the lower candidate schedule is implemented; do not treat the absence of a recorded production date as evidence that exposure is impossible.
11. Remove or rename legacy DAO-type “upgrade” copy so users are not told that subscription upgrades convert a DAO from one type to another.

## 7. Legacy to Remove Once This Spec Is Implemented

- Legacy pricing docs (v2.0 "Final Pricing Structure," v1.0 "Unified Pricing & Monetization Strategy")
- `DAO_TYPE_CONFIG.requiredTier` field (remove, or repurpose as a non-blocking upsell flag)
- `revenueService.ts` old DAO-subscription-tier-keyed fee ladder (replace with the flat 2.0% placeholder fee until real volume data supports a real ladder)
- `subscriptionService.ts` duplicate `getPricing()` map (collapse into whatever single service owns the decoupled subscription/advanced-tooling model)
- `userSubscriptionService.ts` `USER_PLANS` tier-based vault limits (replace with the soft-cap mechanism in §2, once its numeric/KYC design is finalized)

`docs/mtaa-monetization-strategy.md` is retained as a named research and rollout companion for the Phase 1 spawn-fee rationale and as a record of candidate future economics. It is not a second authority for live transaction fees, MTAA rewards, lock terms, or Phase 3 token pricing. The live transaction-fee authority remains the flat 2.0% implementation until this spec records and ships a replacement.

## 8. Recommended Next Step

Instrument before tuning: get real transaction volume and per-DAO-type activity data flowing before setting any of the numeric TBDs in §6. The legacy docs' failure mode was setting concrete numbers (tier prices, conversion rates, revenue projections) from assumption rather than evidence — avoid repeating that here.