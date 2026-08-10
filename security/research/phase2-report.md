# Mtaa DAO Security Research — Phase 2

*Local, synthetic, deterministic. No mainnet, no fork, no production contract,
no real funds. Everything below is reproducible with `forge test`.*

## Scope

Phase 1 asked "is there a bug in this contract". Phase 2 asks a narrower and
harder question:

> Can combinations of individually valid operations cause the vault's economic
> accounting to diverge from actual economic reality?

Every sequence in this phase is composed exclusively of calls that the contract
itself permits, from the actor it permits them from. Nothing is forced with
`vm.store`, no guard is bypassed, no invariant is asserted that the contract
does not itself imply.

In scope:

| | |
|---|---|
| Canonical source | `contracts/MaonoVault.sol` :: `MaonoVault_Phase1B` |
| Deployment shape | EIP-1167 clone + `initialize()`, exactly as `MaonoVaultFactory_Phase1B` does it |
| Build artifact | `contracts/MaonoVault.json` (now generated from the source) |
| Legacy artifact | `test/security/artifact/legacy/MaonoVault.legacy.json` (bytecode only, no source) |
| Integrators | `server/blockchain.ts`, `server/vaultAutomation.ts`, `scripts/deploy.mjs`, `contracts/deploy_maono_vault.ts` |

Out of scope: live chains, third-party protocols, the MTAA token's own
implementation (mocked), and any behaviour of the factory beyond the parameters
it hands to `initialize()`.

## Current Source of Truth

Phase 1 reported (`I-1`) that the repository contained "two divergent MaonoVault
contracts". Phase 2 resolved that: it was never two contracts, it was **one
contract and one stale build artifact**.

```text
contracts/MaonoVault.sol   -> MaonoVault_Phase1B: clone+initialize, MTAA upkeep,
                              hibernation, no NAV, no manager, no fees in asset
contracts/MaonoVault.json  -> (before) an older, source-less build: constructor
                              deployment, manager role, NAV, performance and
                              management fees, withdrawal queue, emergencyWithdraw
```

The chain that had to be reconciled:

```text
Solidity source -> compiled bytecode -> ABI -> deploy script -> backend -> frontend
```

What was done:

1. The stale artifact was **archived**, not deleted, to
   `test/security/artifact/legacy/MaonoVault.legacy.json`. It is real evidence:
   its bytecode is what a previous deployment ran.
2. `contracts/MaonoVault.json` is now **generated from the current source** by
   `scripts/build-maono-artifact.mjs` (`node scripts/build-maono-artifact.mjs`,
   `--check` in CI).
3. `test/security/phase2/ArtifactParity.t.sol` makes the drift **executable**:
   it deploys the artifact's runtime code and the compiled source and compares
   them metadata-stripped, checks the ABI surface, and asserts that every
   function the backend calls is absent from the canonical vault.
4. The Phase 1 black-box suites now explicitly load the *legacy* artifact and
   are documented as historical/integration evidence rather than as a second
   current vault.

The integration layer has **not** been changed and remains broken against the
canonical vault (finding `P2-7`): the deploy scripts still call
`factory.deploy(asset, treasury, manager)` (a constructor the implementation
does not have — it is `initialize()`-based), and `server/blockchain.ts` still
calls `previewNAV()`, `updateNAV()` and `distributePerformanceFee()`, none of
which exist. That is an integration decision for the maintainers, not a change
this security phase should make unilaterally.

## Baseline Test Results

Toolchain: forge 1.7.1, solc 0.8.24, EVM cancun, OpenZeppelin 5.4.0.
Fuzz runs 512 per test; invariant runs 128 x depth 32 (4096 calls per invariant).

```bash
bash test/security/setup.sh
export PATH="$PATH:$HOME/.foundry/bin"
forge test -vv
```

| | Phase 1 baseline | Phase 2 |
|---|---|---|
| Suites | 12 | 19 |
| Tests | 95 | 159 |
| Failing | 0 | 0 |

New Phase 2 suites (`test/security/phase2/`):

| Suite | Tests | Purpose |
|---|---|---|
| `ArtifactParity.t.sol` | 5 | artifact == source; backend surface does not exist |
| `StateMachine.t.sol` | 9 | the reachable state space and every transition |
| `EconomicComposition.t.sol` | 13 | scenarios A–I: sequences of legal operations |
| `UpkeepEnforceability.t.sol` | 10 | who controls the fee that is charged to them |
| `TemporalAssumptions.t.sol` | 9 | clock boundaries, same block, extreme warps |
| `SharePriceTransitions.t.sol` | 7 | which operations move the price, and can it be timed |
| `VaultInvariants.t.sol` | 11 | stateful economic invariants over random valid sequences |

## State Machine

The source has three status values but only two are reachable, and the effective
state is two-dimensional:

```text
status : ACTIVE (0) | HIBERNATING (1) | CLOSED (2, unreachable)
paused : false | true
```

`CLOSED` is never written by any function in the current source
(`StateMachine.test_State_ClosedIsUnreachable`).

| State | deposit / mint / withdraw / redeem | share transfer | previews | upkeep |
|---|---|---|---|---|
| ACTIVE, unpaused | allowed | allowed | live | allowed when due |
| ACTIVE, paused | `EnforcedPause()` | **allowed** | live | allowed when due |
| HIBERNATING, unpaused | `VaultIsHibernating()` | **allowed** | live | **allowed and charged** |
| HIBERNATING, paused | both guards apply | allowed | live | allowed |

Transitions:

```text
ACTIVE --pause()--------------------> ACTIVE(paused)      onlyOwner
ACTIVE(paused) --unpause()----------> ACTIVE              onlyOwner
ACTIVE --collectMonthlyUpkeep()-----> HIBERNATING         onlyOwner, when owner MTAA < cost
ACTIVE --collectMonthlyUpkeep()-----> ACTIVE              onlyOwner, when solvent (clock resets)
HIBERNATING --reactivateFromHibernation()--> ACTIVE       onlyOwner, costs 1.5x one month
HIBERNATING --collectMonthlyUpkeep()--> HIBERNATING       onlyOwner, charges but does NOT release (P2-4)
```

Two properties matter for depositors, and both hold:

* Pausing and hibernating are **independent locks**; clearing one does not clear
  the other (`test_State_PausedAndHibernating_RequiresTwoIndependentUnlocks`).
* Neither transition moves, reprices, or destroys a single unit of the asset
  (`test_Transition_ActiveHibernatingActive_DoesNotTouchVaultAssets`,
  `SharePriceTransitions.test_StatusTransitionsCannotBeTimedForPrice`).

Both locks are exclusively owner-controlled with **no timeout, no guardian and
no self-service exit**.

## Economic Invariants

The canonical vault has no NAV, no strategy, no receivables and no
asset-denominated fee, so `totalAssets()` is exactly the ERC-20 balance. The
Phase 2 harness (`Phase2Base.sol`) maintains an independent ledger and reconciles
it after every step:

```text
totalAssets()
  == asset.balanceOf(vault)
  == initialAssets + deposits + donations + yield - withdrawals - assetFees
```

with the solvency condition

```text
economically redeemable claims <= economically backing assets
```

Stateful invariants (`VaultInvariants.t.sol`, 4096 calls each, 4 unprivileged
actors plus the owner performing deposit / mint / withdraw / redeem / transfer /
donation / upkeep / reactivation / pause in arbitrary order):

| | Invariant | Result |
|---|---|---|
| I1 | `totalAssets() == asset.balanceOf(vault)` | holds |
| I2 | sum of every holder's `previewRedeem` <= `totalAssets()` | holds |
| I3 | `totalAssets() == totalIn - totalOut` (external ledger) | holds |
| I4 | `totalOut <= totalIn` — users as a group never extract more than they put in | holds |
| I5 | `sum(balanceOf(actors)) == totalSupply()`, vault never self-holds | holds |
| I6 | treasury and owner never receive the underlying asset | holds |
| I7 | assets that back no share are never paid out to anyone | holds |
| I8 | `status <= HIBERNATING` (CLOSED unreachable) | holds |

**No sequence of valid operations was found that makes the vault's accounting
diverge from economic reality for the underlying asset.** Everything found in
this phase is either a protocol-revenue problem, a liveness problem, or value
that becomes unattributable — never value created out of nothing.

## Attack Sequences Tested

Every scenario is a sequence of individually valid calls; "result" is the
economic outcome, not whether a call reverted.

| # | Sequence | Result | Test |
|---|---|---|---|
| A | deposit -> donation -> deposit -> withdraw -> withdraw | donor loses, later depositor gains; unprofitable in all 512 fuzz cases | `test_ScenarioA_*`, `testFuzz_ScenarioA_DonationIsNeverProfitable` |
| B | deposit -> donation -> upkeep -> withdrawal | upkeep is MTAA-only and cannot re-allocate a donation; `paid == burned + treasury` | `test_ScenarioB_UpkeepDoesNotTouchDonations` |
| C | deposit -> 12 upkeep cycles -> deposit -> redeem -> redeem | share price unchanged by a year of fees; no dilution | `test_ScenarioC_NoAssetFeeAccrualBetweenDeposits` |
| D | acquire MTAA -> pay upkeep at a discount -> dispose, x12 | 50% of the nominal annual fee, zero capital at risk | `test_ScenarioD_AcquireDiscountRepayLoopOverTwelveMonths` |
| E | deposit -> hibernation -> decade of waiting -> reactivation | depositors frozen indefinitely, principal intact | `test_ScenarioE_HibernationTrapIsOwnerReleasedOnly` |
| F | deposit -> pause -> transfer -> unpause -> exits | transfers survive a pause; no value lost across the window | `test_ScenarioF_PauseMatrix` |
| G | every owner-only entry point, including selectors that do not exist | no owner path moves the underlying asset | `test_ScenarioG_NoOwnerPathMovesTheUnderlyingAsset` |
| H | deposit -> share transfer -> donation -> redeem (full and 1/3 partial) | value follows the shares, splits pro rata, no leakage | `test_ScenarioH_*` |
| I | 6 depositors from 1 wei to 1e18, exits in reverse order | nobody extracts more than they deposited; <= 6 wei stranded | `test_ScenarioI_MixedMagnitudeDepositsAndArbitraryExitOrder` |
| I' | 250 dust deposit/redeem cycles at a donated price | no value farmed | `test_ScenarioI_RepeatedDustCyclesNeverCreateValue` |
| — | donation front-run + back-run around a victim deposit | donor recovers its own donation minus dust; never profits | `SharePriceTransitions.test_SandwichingADepositWithADonationIsUnprofitable` |
| — | 20 sequential donate/redeem cycles | losses compound for the donor | `test_RepeatedDonationCyclesCompoundTheAttackersLoss` |

Malicious-token scenarios were deliberately **not** extended: the asset is fixed
at `initialize()` by the factory and cannot be changed afterwards, so an
arbitrary-token attack is not reachable in this architecture. Phase 1's
fee-on-transfer / rebasing results remain as integration constraints on which
asset may be listed.

## Fuzz / Invariant Testing

* Property fuzzing, 512 runs each: donation profitability (A), preview coherence
  at arbitrary donated prices, price monotonicity under user operations, and
  deposit/redeem plus mint/redeem round trips at every price point.
* Stateful invariant fuzzing: 128 runs x depth 32 = 4096 calls per invariant,
  over the nine-action handler described above, with owner actions interleaved
  (upkeep at random intervals with random MTAA solvency, reactivation, pause
  toggling). Zero reverts are swallowed silently by the invariants themselves —
  the handler tolerates reverts so the search explores the reachable space,
  while the eight invariants judge every reachable state.

Two invariants had to be *corrected* during this phase rather than the code:
the naive "an empty vault holds only dust" property is false, because donations
to a share-less or near-empty vault and deposits that round to zero shares leave
assets that back no share. The corrected invariant (I7) states what is actually
true and economically meaningful: those assets are never paid out to anyone.

## Valid Findings

Severities and actor classes follow the Phase 1 scheme. Note that **none of the
new findings lets an unprivileged actor take depositor funds**.

### P2-1 — Monthly upkeep is unenforceable and self-priced (HIGH, OWNER-ONLY, protocol revenue)

`collectMonthlyUpkeep()` is `onlyOwner`, there is no accrued liability, and the
three inputs to the invoice — `UPKEEP_COSTS_MONTHLY`, `BURN_PERCENTAGES` and
`daoTreasury` — all have `onlyOwner` setters on the same contract, callable by
the payer in the same transaction as the payment.

Composed consequences, each proven:

* Never call it: the vault stays ACTIVE for ten years and the protocol collects
  zero (`test_UpkeepIsNeverCollectedIfTheOwnerStaysSilent`).
* `setUpkeepCostAt(type, 0)`: the invoice is zero, the vault stays ACTIVE, no
  MTAA is burned, and hibernation becomes unreachable
  (`test_OwnerCanPriceItsOwnUpkeepAtZero`, `test_ZeroPricedUpkeepMakesHibernationUnreachable`).
* `setDaoTreasury(owner)`: 70% of an INVESTING vault's upkeep returns to the
  payer; the net cost is the burn only (`test_OwnerCanRedirectTheTreasuryShareToItself`).
* `setBurnPercentageAt(type, 0)` + `setDaoTreasury(owner)`: the entire fee
  round-trips; the vault books `paid > 0` while the real cost is zero and no
  MTAA is burned (`test_BurnPercentagePlusTreasuryRedirectMakeUpkeepFree`).
* Skipped months are free — no backpay, and the clock advances from *payment*
  time, so paying every 45 days yields 9 chargeable periods per year, not 12
  (`test_SkippedMonthsAreFree`, `test_LatePaymentsDriftTheBillingPeriod`).

Economics (SAVINGS vault, 15 MTAA/month nominal):

| Owner behaviour | Annual protocol revenue | Cost to the owner | Depositor impact |
|---|---|---|---|
| Compliant | 133.65 MTAA (already discounted) | same | none |
| Discount loop (D) | 90 MTAA | 90 MTAA, zero capital at risk | none |
| Silent | 0 | 0 | none |
| Self-priced to zero | 0 | 0 | none |

This is a **monetization** failure, not a depositor loss. The Phase 1A fix that
added `onlyOwner` to `collectMonthlyUpkeep` closed an griefing hole and opened
this one.

### P2-2 — Hibernation is cheaper than compliance and freezes depositors for free (MEDIUM, OWNER-ONLY)

Reactivation costs 1.5x *one* month regardless of the length of the freeze, and
is priced from the same owner-settable table at reactivation time. A year of
hibernation costs 22.5 MTAA against 180 MTAA nominal for a year of compliance,
while every depositor is frozen for the entire period at zero cost to the owner
(`test_HibernationIsCheaperThanCompliance`,
`test_ReactivationFeeIsRepricedByTheOwnerBeforePaying`,
`EconomicComposition.test_ScenarioE_*`). Principal is never at risk — this is
pure liveness plus revenue. It composes with, and strengthens, Phase 1's `M-3`.

### P2-3 — Deposits below the share price mint zero shares and are absorbed (LOW, USER-SELF-HARM)

The canonical vault has no minimum deposit; the legacy artifact had one. Once
the share price exceeds the deposited amount, `deposit()` succeeds, keeps the
assets, and mints nothing; the assets accrue to incumbent holders
(`test_ZeroShareDepositIsSilentlyAbsorbed`). `previewDeposit()` returns 0 for
the same input, so an integrator *can* refuse it — the contract will not
(`test_ZeroShareDepositIsPredictableOffChain`), while `maxDeposit()` still
advertises the vault as fully open.

Attack economics: seeding the price high enough to absorb 500 wei cost the
attacker 900,000e18. Not profitable — the fuzzed statement
`victimLoss > dust => attackerLoss > victimLoss` holds over 512 cases. The
realistic exposure is an honest user in a vault whose price rose legitimately.
This subsumes Phase 1's `L-1`.

### P2-4 — Upkeep paid while hibernating is wasted (LOW, OWNER-SELF-HARM)

`collectMonthlyUpkeep()` has no `onlyActive` guard, so it still charges while
the vault is HIBERNATING and does **not** lift hibernation. The owner pays 7.5
MTAA, depositors stay frozen, and reactivation still costs the full 22.5 MTAA on
top (`TemporalAssumptions.test_UpkeepPaidWhileHibernatingDoesNotReactivate`).

### P2-5 — Donations to an empty or near-empty vault are permanently stranded (INFORMATIONAL)

The ERC-4626 virtual-share offset that defeats the inflation attack also means a
donation is split between real shares and the 1000 virtual shares. Donate to a
share-less vault and the assets belong to nobody; donate to a one-wei-share vault
and the donor recovers under 1% (`VaultInvariants.test_DonationToAnEmptyVaultIsStranded`,
`test_DonationToANearEmptyVaultIsMostlyStranded`). Nobody profits; the value
simply leaves circulation. This is the price of the inflation defence, and it is
the reason invariant I7 is phrased as it is.

### P2-6 — `MAX_SPAWN_COST_MTAA` is unreachable (INFORMATIONAL, dead code)

`getSpawnCostInMTAA()` clamps into `[MIN, MAX]`, but the oracle reports whole USD
cents, so the cheapest representable price already quotes 500 MTAA — a quarter
of the ceiling. Only the floor clamp can ever bind. The view is
owner-repointable (`setPriceOracle`), so an integrator reading spawn pricing
from a *vault* rather than the factory reads an owner-influenced (though
floor-clamped) number (`test_SpawnPricingViewIsOwnerControlled`). Share
accounting is untouched by the oracle in every case.

### P2-7 — Deployment scripts and backend target a contract that no longer exists (MEDIUM, INTEGRATION)

Now that the artifact is regenerated from source, this is unambiguous and
executable:

* `scripts/deploy.mjs` and `contracts/deploy_maono_vault.ts` call
  `factory.deploy(asset, daoTreasury, manager)`. `MaonoVault_Phase1B` has no
  constructor arguments and requires `initialize(...)` on a clone; the
  implementation also calls `_disableInitializers()`.
* `server/blockchain.ts` calls `previewNAV()`, `updateNAV()` and
  `distributePerformanceFee()`; `server/vaultAutomation.ts` schedules the last
  two. None exist in the canonical ABI
  (`ArtifactParity.test_BackendCallsDoNotExistOnTheCanonicalVault`).

Phase 1 raised this as `M-6`/`I-1` against an ambiguous source of truth. With
the artifact corrected it is a straightforward integration break: the automation
would revert on every call, and the deploy path cannot produce a working vault.

## Invalidated Previous Findings

The artifact correction changes the standing of several Phase 1 findings. None
of them were wrong at the time — they were reported against the artifact that
was then presented as canonical. They are now re-scoped:

| Phase 1 | New status | Reason |
|---|---|---|
| `H-1` emergencyWithdraw drains the vault | **Not applicable to the canonical vault** — legacy artifact only | `emergencyWithdraw` does not exist in `MaonoVault_Phase1B`; exhaustively re-tested by `test_ScenarioG_NoOwnerPathMovesTheUnderlyingAsset`. Remains valid as historical evidence for any live deployment of the legacy bytecode. |
| `M-4` withdrawal-queue accounting | **Legacy artifact only** | no queue in the canonical source |
| `M-5` `previewNAV()` reports an unbacked number | **Legacy artifact only** | no NAV in the canonical source |
| `M-6` backend calls a non-existent function | **Superseded by `P2-7`** | broadened: the deploy path is broken too |
| `I-1` two divergent vaults | **Resolved** | one vault, one stale artifact; now generated and parity-tested |
| `L-1` donation griefing rounds a deposit to zero shares | **Superseded by `P2-3`** | same root cause, now measured and bounded, with the missing `minDeposit` identified |
| `M-1` flash-loanable MTAA discount | **Still valid**, quantified by `P2-1`/Scenario D | 50% of nominal, zero capital at risk |
| `M-2` shares minted from the requested amount | **Still valid as an integration constraint** | only bites for fee-on-transfer/rebasing assets; the asset is fixed at `initialize()` |
| `M-3` pause/hibernation freeze exits | **Still valid**, strengthened by `P2-2` | now with the cost asymmetry measured |
| `L-2` uninitialized clone seizure | **Still unreachable** | factory initializes atomically |

## Negative Results

Preserved as regression tests. These are attacks that were *run* and *failed*:

| Attack | Outcome | Test |
|---|---|---|
| Donation before/after another deposit (fuzzed) | donor never profits; victim never loses more than a zero-share deposit | `testFuzz_ScenarioA_DonationIsNeverProfitable` |
| Donation sandwich around a victim deposit | donor recovers only its own donation | `test_SandwichingADepositWithADonationIsUnprofitable` |
| 20 repeated donate/redeem cycles | losses compound | `test_RepeatedDonationCyclesCompoundTheAttackersLoss` |
| 250 dust deposit/redeem cycles at a donated price | no value farmed | `test_ScenarioI_RepeatedDustCyclesNeverCreateValue` |
| 25 same-block deposit/redeem cycles | same-block is not special; no accumulator to farm | `test_SameBlockOperationsAreNotSpecial` |
| Mixed-magnitude deposits (1 wei .. 1e18), reverse-order exits | nobody over-extracts; <= 6 wei stranded | `test_ScenarioI_MixedMagnitudeDepositsAndArbitraryExitOrder` |
| Every owner-only selector, including non-existent ones | no path moves the underlying | `test_ScenarioG_NoOwnerPathMovesTheUnderlyingAsset` |
| Depositor buying its own way out of hibernation with MTAA | not authorized; owner-only | `test_ScenarioE_HibernationTrapIsOwnerReleasedOnly` |
| Timing a call around a pause transition to get a different price | rejected, not repriced | `test_CallsImmediatelyAroundAStatusTransitionAreRejectedNotRepriced` |
| Repricing shares through the oracle | oracle feeds a view only; bounded and `try/catch`-wrapped | `test_SpawnPricingViewIsOwnerControlled` |
| Double-charging upkeep in one block, or reaching CLOSED | impossible | `test_UpkeepCannotBeRepeatedInTheSameBlock`, `test_State_ClosedIsUnreachable` |
| Overflowing the upkeep clock or the hibernation counter | clean at `uint64.max` and a century of freeze | `test_ExtremeTimestampsDoNotOverflowTheClock`, `test_HibernationCounterHandlesLongFreezes` |

Ordinary ERC-4626 rounding dust is *not* reported as a vulnerability: it is
bounded (a few wei per exit), always in the vault's favour, and no repetition
was found that accumulates it into meaningful profit.

## Economic Analysis

**For depositors.** The vault charges nothing in the underlying asset — no
entry, exit, management or performance fee — so a depositor's claim can only
grow (donations/yield) or stay flat, minus a few wei of rounding. Solvency held
over 4096-call random sequences and every hand-built composition. The real
depositor risk in this design is not theft, it is **liveness**: pause and
hibernation are indefinite, owner-controlled, and cost the owner nothing.

**For the protocol.** The monetization is the weak side of the ledger. The payer
of the monthly fee is also its administrator, so the entire revenue stream is
voluntary in practice:

| Lever | Effect on annual revenue (SAVINGS vault, 180 MTAA nominal) | Cost to the owner |
|---|---|---|
| MTAA discount loop | -50% (to 90) | none, zero capital at risk |
| Late payments every 45 days | -25% (9 periods instead of 12) | none |
| Silence | -100% | none |
| `setUpkeepCostAt(_, 0)` | -100% | none |
| `setDaoTreasury(owner)` (INVESTING) | -70% | none |
| `setBurnPercentageAt(_, 0)` + redirect | -100%, and no MTAA burned | none |
| Hibernate for a year, reactivate once | -87.5% (22.5 vs 180) | depositors frozen, free |

**For MTAA holders.** The burn is the only sink and it is switchable off by each
vault owner; the deflationary story is unenforced at the vault level.

## Recommended Fixes

Ordered by value, and all of them are small:

1. **Move the fee schedule out of the payer's reach.** `UPKEEP_COSTS_MONTHLY`,
   `BURN_PERCENTAGES` and `daoTreasury` should be owned by the factory/platform,
   read through it at charge time, not stored per-vault behind the vault owner's
   `onlyOwner`. This kills P2-1's self-pricing entirely.
2. **Make upkeep enforceable.** Either accrue the liability (charge N months on
   the next call) or let *anyone* trigger `collectMonthlyUpkeep()` for a
   delinquent vault — the function has no depositor-facing effect other than the
   hibernation transition, so a permissionless keeper is safe here.
3. **Time-weight the discount.** Snapshot the MTAA balance over a window (or
   require a lock) instead of reading `balanceOf` at payment time; this closes
   `M-1`/Scenario D at a stroke.
4. **Bound the freeze.** Give hibernation and pause an expiry, or a
   depositors-only escape hatch after N months, so liveness is not purely at the
   owner's discretion. Scale the reactivation fee with the number of hibernated
   months so the delinquent path is not the cheap path.
5. **Reject zero-share deposits.** `if (shares == 0) revert`, or restore a
   `minDeposit`. One line, removes P2-3.
6. **Guard `collectMonthlyUpkeep` with `onlyActive`** (or make it reactivate)
   so that a payment while hibernating cannot be wasted (P2-4).
7. **Fix the integration layer** (P2-7): regenerate the ABI in CI with
   `node scripts/build-maono-artifact.mjs --check`, replace the constructor
   deploy path with clone+`initialize`, and delete or rewrite the NAV/performance
   -fee automation in `server/vaultAutomation.ts` and `server/blockchain.ts`.
8. **Cosmetic:** either widen the oracle's precision or drop the unreachable
   `MAX_SPAWN_COST_MTAA` clamp, and remove the unreachable `CLOSED` enum value
   (or implement the closure path it implies).

## Remaining Unknowns

* **The real MTAA token.** It is mocked here. If it is upgradeable, pausable,
  fee-on-transfer or has a blocklist, the upkeep path inherits those properties.
* **The factory in production.** Phase 2 reproduced the factory's initialization
  shape but did not audit the factory's own access control, its treasury, or
  who owns the vault owner key.
* **Who the vault owner is in practice.** Every finding above classified
  OWNER-ONLY is bounded by that answer: an EOA, a multisig and a DAO timelock
  give three very different risk profiles for P2-1, P2-2 and M-3.
* **Whether any legacy-bytecode vault is live.** If the archived artifact
  corresponds to a deployed contract, Phase 1's `H-1` is a live HIGH, not
  history. This is a deployment-records question, not a code question.
* **The upgrade path.** The vault is `Initializable` but the clone has no proxy
  admin in scope here; how (or whether) an implementation is ever swapped was
  not analysed.

## Final Assessment

The Phase 1 conclusion stands and is now much better supported: **the canonical
`MaonoVault_Phase1B` could not be driven into an economically invalid state by
any combination of valid operations that this phase could construct.** Across
159 tests — 512-case fuzzing on every economic property and 4096-call stateful
sequences against eight invariants — assets always equalled the balance, claims
were always backed, and no actor, privileged or not, ever extracted more of the
underlying than they contributed.

What Phase 2 changed is *where the risk actually is*:

* The depositor-facing risk is **liveness, not solvency** — indefinite,
  free-to-the-owner freezes.
* The protocol-facing risk is **revenue**, and it is severe in the sense that
  every lever of the monetization is in the hands of the party being charged.
* The most likely thing to break in production is not the vault at all, but the
  **integration layer**, which still speaks to a contract that no longer exists.

The one thing that would change this assessment is a live deployment of the
archived legacy bytecode; that vault's owner can withdraw everything.
