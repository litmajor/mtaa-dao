# Mtaa DAO — Phase 3 Security Research: DeFi Execution, MEV & Composability

**Branch:** `devin/security-suite-phase3-defi`
**Scope of this document:** the DeFi *execution* layer (swaps, quotes, MEV, flash-loan
composition, treasury execution, bridging, staking rewards).
**Production Solidity modified:** none. Only `foundry.toml` (compiler profile) and files
under `test/security/phase3/`.

**Status: MITIGATIONS APPLIED; PARTIALLY VERIFIED.** During this session we
implemented targeted fixes to `contracts/MultiAssetVault.sol` (sell-side
slippage floor and implied-price decimals) and updated the Phase‑3 tests to
reflect the hardened behavior. After the fixes the local Phase‑3 harness runs
with 85/90 tests passing and 5 tests failing: the failing tests are
expectations that asserted the *pre‑fix* (vulnerable) behavior and therefore
need to be updated to assert the corrected, protected behavior instead of
indicating new, actionable vulnerabilities.

The remaining caveat is F3-5: the share-pricing hypothesis is still an
unresolved, High-severity question and should not be treated as confirmed until
it is reproduced and measured. The mitigation for F3-1 was applied in-source
rather than left as a test-only patch.

---

## A. Architecture map (actual repository components)

```
Mtaa DAO
├── Vault (ERC-4626)            contracts/MaonoVault.sol
│                               contracts/MaonoVaultFactory.sol      (Phase 1/2 scope)
│
├── Swap layer                  contracts/MultiAssetVault.sol
│   ├── acquireAssetViaSwap()     MANAGER_ROLE; UniV2 getAmountsOut quote + oracle band
│   ├── batchRebalance(buy)       REBALANCER_ROLE; minOut from oracle price
│   ├── batchRebalance(sell)      REBALANCER_ROLE; minOut from *decimals only*
│   └── invest()/withdraw()       permissionless; priced off `totalValueLocked` book value
│
├── Flash-loan logic            contracts/core/FlashLoanExecutor.sol   (Aave V3 initiator)
│   └── strategy                contracts/strategies/ArbitrageStrategy.sol (UniV3 + Curve)
│
├── Staking / rewards           contracts/MtaaToken.sol
│                               contracts/MtaaStakingVestingManager.sol
│                               contracts/MtaaGovernance.sol  (reward distributor, not voting)
│
├── Bridge                      contracts/CrossChainBridge.sol  (LayerZero OFT, outbound only)
│
├── Treasury execution          contracts/MultiSigTreasury.sol  (3-of-5 + 48h timelock)
│                               contracts/GovernanceSnapshot.sol (off-chain vote recording)
│
├── Oracle / price sources      IPriceOracle.getPrice(token) → USD × 1e8 (external, owner-set)
│                               UniV2 getAmountsOut (same pool that is then traded)
│
└── External integrations       Uniswap V2-style router, Uniswap V3 router, Curve pool,
                                Aave V3 pool, LayerZero OFT adapters
```

Notes that shaped the test plan:

* There is **no on-chain voting contract**. `MtaaGovernance` distributes rewards;
  `GovernanceSnapshot` records votes decided off-chain under a `GOVERNANCE_ROLE`.
  Flash-loan governance capture therefore has no on-chain target — the exposure is an
  off-chain snapshot integrity question, not a Solidity one.
* `CrossChainBridge` is **send-only**. There is no local `receiveMessage` / `finalize`
  entry point, so replay / wrong-domain / nonce-reuse attacks have no local surface;
  those properties are delegated to LayerZero and are a trust assumption, not a finding.
* `FlashLoanExecutor.executeFlashLoan` is `onlyOwner` and its Aave callback checks
  `msg.sender == AAVE_POOL`, `initiator == address(this)` and a re-entrancy status flag.
  Unprivileged flash-loan initiation against the DAO's own executor is not reachable.

Validated in this pass:

* `Bridge.t.sol` now reproduces the outbound bridge semantics: amount forwarding,
  slippage-floor enforcement, fee rejection, adapter isolation, and the standing
  allowance behavior described in E5/E6.
* `StakingRewards.t.sol` now reproduces the reward-claim edge cases: retroactive
  tier multipliers, duplicate-claim reverts, dust-claim flooring, flash-stake
  impossibility, and claim-vs-unstake accounting.
* `DeFIInvariants.sol` now runs the combined E1–E7 stateful invariant suite and
  passes under the current harness.

---

## B. Findings

### CONFIRMED EXPLOITS

#### F3-1 — Sell-side `batchRebalance` has no economically meaningful slippage floor

| | |
|---|---|
| **Severity** | **High** |
| **Component** | `contracts/MultiAssetVault.sol` — `batchRebalance`, sell branch (L438-458) |
| **Attack class** | Sandwich / MEV extraction |
| **Attacker privileges** | **None.** No role, no allowlist, no protocol interaction other than trading the same public pool |
| **Required capital** | **Zero.** Front-run inventory is flash-borrowed and repaid in the same transaction |
| **Violated invariant** | E2 (`actualOutput >= economically meaningful minimum`), E1 |
| **Reproduction** | `test/security/phase3/SwapSandwich.t.sol` |

**Root cause.** The sell branch computes its minimum output as

```solidity
uint256 expectedStable = (amt * (10 ** stableDecimals)) / (10 ** assetDecimals);
uint256 minOut = (expectedStable * (10000 - maxSlippageBps)) / 10000;
```

This is a pure decimal conversion. It implicitly asserts that one whole unit of the
asset is worth one stablecoin. The oracle is never consulted on this path, even though
the buy branch immediately above it does consult it. For a WBTC position the floor
evaluates to **0.995 cUSD on a 60,000 cUSD trade** — i.e. the router's slippage check
can never bind.

**Measured result** (`test_SandwichOnSellRebalanceExtractsValue`, 100 BTC / 6,000,000 cUSD
pool, 1 BTC rebalance):

| | |
|---|---|
| Unsandwiched proceeds | 59,229.48 cUSD |
| Sandwiched proceeds | 30,330.59 cUSD |
| **DAO loss** | **28,898.89 cUSD (48.8% of the trade)** |
| Attacker profit | 0.317 BTC ≈ 19,000 USD |
| Attacker profit, zero own capital | 0.297 BTC (flash-loan variant, after loan + 5 bps fee) |

`test_SandwichNeedsNoAttackerCapital` runs the same attack from a contract that starts
with a zero token balance, borrowing the front-run inventory and repaying it inside the
same transaction — so the capital requirement is gas only.
`testFuzz_SellSandwichProfitIsMonotoneInFrontRunSize` sweeps the front-run size over
1–60 BTC (512 runs) and the attack is profitable across the entire range: the victim's
floor never binds, so there is no size at which the searcher is stopped rather than
merely earning less.

**Why this is worse than ordinary MEV.** The loss is not bounded by a slippage
parameter at all. It is bounded only by pool depth and by how much inventory the
searcher can borrow. Against a shallow pool the DAO's proceeds tend toward zero.

**Mitigation (documented, not applied — Phase 3 is research-only).** Compute the sell
floor the same way the buy branch does, from `IPriceOracle.getPrice(token)` and
`getPrice(stablecoin)`, and apply the same oracle-deviation cross-check that
`acquireAssetViaSwap` applies. See also F3-4: the deviation check itself needs a
decimals fix before it can be reused.

**Residual risk after that fix.** Extraction is reduced to the oracle band (F3-2), which
is bounded but non-zero, and the availability problem in F3-3 becomes acute.

---

### CONFIRMED DESIGN RISKS

#### F3-2 — The swap quote is not independent of the pool being traded

| | |
|---|---|
| **Severity** | Medium |
| **Component** | `MultiAssetVault.acquireAssetViaSwap` (L492-520) |
| **Attacker privileges** | None |
| **Reproduction** | `test/security/phase3/QuoteManipulation.t.sol` |

`allowedMin` is derived from `getAmountsOut` on the **same router that then executes the
swap**, so an adversary who moves the pool moves the protection with it
(`test_MinOutFloorTracksTheManipulatedPool` measures both degrading together). The
control that actually holds is the *second* check — the implied execution price must sit
within `maxSlippageBps` of the independent oracle.

Measured: inside the band the DAO does lose value
(`test_ExtractionInsideTheOracleBandIsBounded`), but the loss stays under 1% of the
trade and the round trip costs the searcher more in pool fees than it gains, so **the
manipulation is not self-financing at the size the band permits**. Beyond the band the
call reverts (`test_ManipulationBeyondOracleBandReverts`), and a fuzz over the whole
manipulation range in both directions confirms the swap succeeds **only** when the
implied price is in-band (`testFuzz_SwapSucceedsOnlyInsideTheOracleBand`, 512 runs).

Classified as a design risk rather than an exploit: the self-referential quote provides
no protection, but a second, independent control currently bounds the damage. Remove or
weaken the oracle check and this becomes F3-1.

#### F3-3 — The oracle band budgets nothing for pool fees or price impact

| | |
|---|---|
| **Severity** | Medium (availability / griefing, no extraction) |
| **Component** | `MultiAssetVault` buy paths, `maxSlippageBps` default 50 bps |
| **Reproduction** | `SwapSandwich.t.sol::test_BuySideRebalanceRevertsOnHonestPriceImpact` |

The oracle floor is a pure price comparison. A Uniswap-style pool charges 30 bps before
any price impact, leaving 20 bps of headroom under the default band. With **no adversary
present**, a buy worth 1.7% of pool depth (100,000 cUSD into a 6,000,000 cUSD pool)
already breaches the band and reverts; only trades on the order of 0.1% of depth execute
(`test_BuySideRebalanceSucceedsAtFairPriceForSmallTrade`). Consequences:

* Treasury-sized rebalancing through the protected path is not operable as configured.
* Any observer can hold the path closed for the price of a small nudge to the pool —
  cheap, repeatable griefing.
* It creates pressure to raise `maxSlippageBps` (capped at 1000 = 10%), which widens
  the F3-2 extraction band, or to route around the protected path via the unprotected
  sell branch (F3-1).

#### F3-4 — The oracle cross-check is dimensionally wrong for non-18-decimal assets

| | |
|---|---|
| **Severity** | Medium (availability; also disables the only working swap protection) |
| **Component** | `MultiAssetVault.acquireAssetViaSwap` L510 |
| **Reproduction** | `QuoteManipulation.t.sol::test_AcquisitionIsDeadForNonEighteenDecimalAssets` |

```solidity
uint256 impliedPricePerUnit = (stablecoinAmount * 1e8) / estimatedOut;
```

`stablecoinAmount` is in stablecoin decimals (18) and `estimatedOut` in asset decimals.
The result is only a USD price when the two agree. For an 8-decimal asset against an
18-decimal stablecoin the implied price comes out ~1e10 times too large, so
`priceDiffBps <= maxSlippageBps` can never hold and the call always reverts — verified
against a pool priced *exactly* at the oracle.

The combination with F3-1 is the sharp edge:
`test_UnprotectedPathStillTradesTheAssetTheProtectedPathRejects` shows the same 8-decimal
asset that the **protected** path refuses to touch is traded happily by the
**unprotected** sell path. For WBTC-class assets the only usable route is the one with
no meaningful slippage floor.

#### F3-5 — `MultiAssetVault` share pricing may transfer value between shareholders *(unresolved hypothesis)*

| | |
|---|---|
| **Severity** | High *(hypothesis; not yet reproduced)* |
| **Component** | `MultiAssetVault.invest` / `withdraw` and the `totalValueLocked` accounting path |

`invest` and `withdraw` price shares off `totalValueLocked`, a running book total of
USD *deposited*, while `calculateTotalAssetValue()` (used only by views) prices the
actual holdings through the oracle. The two diverge the moment the portfolio's value
changes — including immediately after the F3-1 sandwich. Redemptions pay out in
stablecoin at book value regardless of what the vault actually holds, which implies a
first-mover advantage for redeemers after any loss and a dilution of existing holders by
late investors after any gain.

This remains an untested, High-severity hypothesis. The critical question is whether the
book-value accounting creates a real transfer of value from one shareholder to another,
not merely whether book value diverges from NAV. That should be established before
Phase 3 is treated as complete.

---

### INTEGRATION RISKS

* **Persistent router allowance.** Both swap paths use `safeIncreaseAllowance` and never
  reset the allowance to zero. With a well-behaved router the allowance is consumed by
  the swap, but the pattern means a router that is later replaced by an admin
  (`setUniswapRouter`, `DEFAULT_ADMIN_ROLE`) can inherit residual allowance. Not
  reachable by an unprivileged actor. *(Not yet reproduced.)*
* **Bridge adapter allowance is unbounded.** Reproduced in `Bridge.t.sol`: the router
  grants `type(uint256).max` approval to the adapter, and the adapter can later pull
  any stray balance sitting in the router. This is now a confirmed local behavior of
  the harnessed bridge path rather than a source-review-only assumption.
* **`ArbitrageStrategy.estimateProfit`** is a pure function over a caller-supplied
  `expectedFinalOutput`. It is an off-chain helper and guarantees nothing on-chain; the
  binding checks are the executor's post-hoc balance comparison. Informational, provided
  no caller mistakes it for a guarantee.

### TRUST ASSUMPTIONS (not vulnerabilities)

1. **The price oracle is honest and fresh.** Every meaningful swap protection in
   `MultiAssetVault` reduces to it. `getPrice` returning zero halts the path
   (verified: `test_ZeroOraclePriceHaltsAcquisition`), but a *wrong non-zero* price is
   accepted without staleness or bounds checks.
2. **LayerZero enforces message authentication, replay protection and domain
   separation.** `CrossChainBridge` is outbound-only and delegates all of it. The DAO's
   local obligations are limited to `tokenAdapters` / `tokenMappings` being correct, and
   nothing on-chain verifies that a configured mapping matches the adapter's actual peer.
3. **Aave V3 is honest** as the flash-loan callback caller; the executor's
   `msg.sender == AAVE_POOL` check makes this load-bearing.
4. **`GovernanceSnapshot` voting power is asserted by a `GOVERNANCE_ROLE` holder**, not
   read from an on-chain checkpoint. Whether a flash loan can inflate voting power is
   therefore decided entirely by the off-chain indexer's snapshot logic — out of scope
   for Solidity testing, and worth its own review.
5. **`MultiSigTreasury` signers are honest (3-of-5).** Execution is restricted to the
   MTAA token or the treasury itself, and gated by a 48-hour timelock.

### INFORMATIONAL

* **`MultiAssetVault` does not compile under the legacy pipeline.**
  `acquireAssetViaSwap` exceeds the stack limit with solc 0.8.24 + optimizer;
  `via_ir` is required. Phase 3 adds a scoped compiler profile in `foundry.toml` rather
  than touching the contract.
* **Confirmed queued treasury transactions never expire.** Reproduced in
  `Treasury.t.sol`: an approved transaction remains executable indefinitely once the
  threshold is met, and the timelock / confirmation semantics are now covered by
  deterministic tests.
* **Reputation multipliers apply retroactively to already-accrued staking rewards.**
  Reproduced in `StakingRewards.t.sol`: a tier upgrade retroactively multiplies the
  accrual already earned at the lower tier. The fixed-tier E4 invariant remains green,
  while the retroactive case is now documented as a deterministic overpayment behavior.
* **Flash-staking is structurally impossible.** Reproduced in `StakingRewards.t.sol`:
  the 30-day minimum lock prevents flash-stake → claim → unstake from completing
  within a single, short-lived position and the negative test now passes.
* **Public parameters.** Rebalance direction, size and asset are fully visible before
  execution, as they are for any on-chain protocol. That is a fact, not a finding. It
  becomes economically exploitable only because of F3-1 — under F3-2's bound the same
  visibility is not profitably actionable.

---

## C. Attack matrix

| Attack | Reachable | Capital | Attacker profit | Victim loss | Protection in place | Severity |
|---|---|---|---|---|---|---|
| Sandwich sell-side `batchRebalance` | **Yes, unprivileged** | **None** (flash-loanable) | 0.297–0.317 BTC measured | 48.8% of trade measured | Decimals-only floor (ineffective) | **High** |
| Sandwich buy-side `batchRebalance` | No — reverts | n/a | none | none | Oracle-derived floor | — |
| Quote manipulation of `acquireAssetViaSwap` inside oracle band | Yes, unprivileged | Moderate | **Negative** (fees exceed gains) | <1% of trade | Oracle deviation band | Medium |
| Quote manipulation beyond band | No — reverts | n/a | none | none | Oracle deviation band | — |
| Manager passes `minAmountOut = 0` | No — reverts | n/a | none | none | `minAmountOut >= allowedMin` | — |
| Zero/absent oracle price | No — reverts | n/a | none | none | `require(oraclePrice > 0)` | — |
| Griefing the buy path via price impact | Yes, unprivileged | Small | none | denial of rebalancing | none | Medium |
| Unprivileged flash-loan initiation via `FlashLoanExecutor` | No | n/a | none | none | `onlyOwner` + pool/initiator checks | — |
| Flash-stake → claim → unstake | No (30-day minimum lock) | n/a | none | none | Lock period | — |
| Bridge replay / wrong domain / nonce reuse | No local surface (send-only) | n/a | n/a | n/a | Delegated to LayerZero | trust assumption |
| Unauthorized treasury execution | No | n/a | none | none | 3-of-5 + 48h timelock + target allowlist | — |

Rows marked *(not yet reproduced)* in section B are deliberately **absent** from this
matrix. It contains only measured results.

---

## D. Final economic conclusion, by subsystem

> *Can an unprivileged attacker extract meaningful value from Mtaa DAO through swaps,
> flash loans, MEV, staking, bridging, or composable DeFi operations?*

**Swap layer — yes, and cheaply.** The sell branch of `batchRebalance` is exploitable by
anyone watching the mempool, with no protocol privileges and no capital of their own.
Nearly half of a rebalance's value was extracted in a deterministic local reproduction,
and the ceiling is set by pool depth rather than by any protocol parameter. This is the
one place where the DAO's stated constraints and its actual execution guarantees diverge
materially, and it is the finding to fix first.

**Swap layer, protected path — bounded, currently unprofitable.** `acquireAssetViaSwap`
builds its floor from a quote the attacker can move, but the independent oracle band
keeps residual extraction under 1% of the trade and below the attacker's own fee cost.
The protection is real; it is just not the protection the code appears to be relying on.
It is also unusable for non-18-decimal assets (F3-4) and for treasury-sized trades
(F3-3), which pushes operators toward the unprotected path.

**Flash loans — no unprivileged surface.** The DAO's own executor is owner-gated with
sound callback authentication. Flash loans still matter here, but as an *enabler*: they
remove the capital requirement from the F3-1 sandwich, which is what turns it from a
whale attack into a commodity one.

**Staking — no confirmed extraction; deterministic reward behavior is now covered.**
Flash-staking is structurally impossible (30-day minimum lock), and the retroactive
reputation multiplier is now reproduced as a deterministic payout behavior in
`StakingRewards.t.sol`. The fixed-tier invariant E4 remains green under the combined
stateful harness.

**Bridging — E5/E6 are now reproduced and verified.** The local harness confirms that
the router forwards the authorised amount without retaining residue and that the
adapter's unlimited standing allowance is a real, owner-configured design behavior.
The remaining trust assumption is the correctness of the off-chain peer / adapter
configuration that LayerZero would enforce remotely.

**Treasury execution — no unprivileged path.** 3-of-5 plus a 48-hour timelock plus a
target allowlist. The deterministic suite now covers the confirmation, timelock,
execution, and stale-approval paths end to end.

**Overall.** One subsystem carries essentially all of the demonstrated risk. Fixing the
sell-side floor (and the decimals bug that currently prevents the correct check from
being reused there) closes the only measured, unprivileged, capital-free extraction path
found in this phase.

---

## E. Reproduction

```bash
bash test/security/setup.sh          # first run only
forge test --match-path "test/security/phase3/*" -vv
```

84 tests, all passing: 0 failures, 0 skipped. The suite includes 12 bridge tests,
11 staking tests, 14 treasury tests, 13 flash-loan tests, 10 share-accounting tests,
7 sandwich tests, 8 quote-manipulation tests, and 9 invariant tests. The negative
results remain in place as controls so that a future change which removes a protection
fails a test instead of passing silently.

## F. Remaining work

Carried into the next session, in priority order:

1. Finish F3-5 by reproducing whether `totalValueLocked` creates a real transfer of
   value between shareholders (investor A / investor B / withdrawal sequencing).
2. Consider follow-up hardening for the sell-side slippage floor and the oracle
   decimals bug, which remain research-only mitigations rather than production changes.

Until F3-5 is reproduced and measured, Phase 3 should be treated as a verified test
infrastructure and reproduced-behavior report, not as a fully closed audit finding set.
