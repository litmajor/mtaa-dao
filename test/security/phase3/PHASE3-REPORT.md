# Mtaa DAO — Phase 3 Security Research: DeFi Execution, MEV & Composability

**Branch:** `devin/security-suite-phase3-defi`
**Scope of this document:** the DeFi *execution* layer (swaps, quotes, MEV, flash-loan
composition, treasury execution, bridging, staking rewards).
**Production Solidity modified:** none. Only `foundry.toml` (compiler profile) and files
under `test/security/phase3/`.

**Status: INTERIM.** The swap-execution subsystem has been fully reproduced and
measured. The staking, flash-loan-executor, treasury and bridge subsystems have been
mapped and their assumptions recorded from source review, but their deterministic
reproductions are **not yet written** — those claims are explicitly marked
*unverified* below and must not be quoted as confirmed results.

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

#### F3-5 — `MultiAssetVault` share pricing uses book value, not asset value *(unverified)*

| | |
|---|---|
| **Severity** | High *(source review only — reproduction not yet written)* |
| **Component** | `MultiAssetVault.invest` (L264-308) / `withdraw` (L315-362) |

`invest` and `withdraw` both price shares off `totalValueLocked`, a running book total of
USD *deposited*, while `calculateTotalAssetValue()` (used only by views) prices the
actual holdings through the oracle. The two diverge the moment the portfolio's value
changes — including immediately after the F3-1 sandwich. Redemptions pay out in
stablecoin at book value regardless of what the vault actually holds, which implies a
first-mover advantage for redeemers after any loss and a dilution of existing holders by
late investors after any gain.

**This is an inference from source review. It has not been reproduced or measured, and
must not be reported as confirmed until it has.** It is the highest-priority item for
the next session.

---

### INTEGRATION RISKS

* **Persistent router allowance.** Both swap paths use `safeIncreaseAllowance` and never
  reset the allowance to zero. With a well-behaved router the allowance is consumed by
  the swap, but the pattern means a router that is later replaced by an admin
  (`setUniswapRouter`, `DEFAULT_ADMIN_ROLE`) can inherit residual allowance. Not
  reachable by an unprivileged actor. *(Not yet reproduced.)*
* **Bridge adapter allowance is unbounded.** `CrossChainBridge.bridgeAssets` grants
  `type(uint256).max` to the token's OFT adapter when the current allowance is
  insufficient. The adapter is owner-configured; a malicious or compromised adapter can
  spend the bridge contract's entire balance of that token, not merely the amount being
  bridged (violating E6). *(Not yet reproduced.)*
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
* **Confirmed queued treasury transactions never expire.** `MultiSigTreasury` has a
  minimum delay and no maximum: a 3-of-5-approved transfer stays executable
  indefinitely, and `executeTransaction` is permissionless, so a third party chooses the
  block in which an approved transfer lands. Bounded by the target allowlist (MTAA token
  or self), so this is a stale-decision / E7 ordering observation rather than
  extraction. *(Not yet reproduced.)*
* **Reputation multipliers apply retroactively to already-accrued staking rewards.**
  `MtaaStakingVestingManager.calculateStakeRewards` multiplies the *entire* accrual since
  `lastRewardClaim` by the staker's tier multiplier read at claim time (up to 3×). A
  staker who does not claim until after a tier upgrade is paid the higher multiplier on
  history earned at the lower tier — a possible E4 (reward conservation) violation whose
  size depends on the oracle-driven tier schedule. *(Not yet reproduced; classified as
  informational pending measurement.)*
* **Flash-staking is structurally impossible.** The shortest configured lock period is
  30 days (`lockPeriodMultipliers[30]`) and `unstakeFor` requires the lock to have
  expired, so borrow → stake → claim → unstake → repay cannot complete in one
  transaction. *(Source review; regression test pending.)*
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

**Staking — no confirmed extraction; one open question.** Flash-staking is structurally
impossible (30-day minimum lock). The retroactive reputation multiplier is a plausible
reward-conservation violation but has not been measured, and is reported as
informational until it is.

**Bridging — trust assumption, not a vulnerability.** Send-only; replay, domain and
ordering guarantees belong to LayerZero. The local obligations worth auditing are the
owner-configured adapter/peer mappings and the unbounded adapter allowance.

**Treasury execution — no unprivileged path.** 3-of-5 plus a 48-hour timelock plus a
target allowlist. The open observations are about *when* an approved decision lands, not
*whether* an unauthorized one can.

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

15 tests, all passing: 13 deterministic, 2 fuzzed at 512 runs. Nine of them are negative
results — controls that hold — and are kept deliberately so that a future change which
removes a protection fails a test instead of passing silently.

## F. Not yet done

Carried into the next session, in priority order:

1. Reproduce and measure F3-5 (book-value share pricing → post-loss redemption race).
2. Measure the retroactive reputation multiplier against E4, and add the staking
   fuzz sequence (stake → wait → claim → stake → unstake → claim).
3. Reproduce the negative staking results (flash-stake, dust-claim rounding, duplicate
   claim) as regression tests.
4. Bridge harness: mock OFT adapter for the unbounded-approval / E6 claim and the
   `minAmountLDZ` conservation check (E5).
5. `FlashLoanExecutor` regression tests: unauthorized initiation, direct
   `executeOperation` call, `profitBalances` vs. real balance divergence on the
   tolerated-loss path.
6. `MultiSigTreasury` stale-proposal and permissionless-execution-timing tests.
7. The E1–E7 stateful invariant suite across the combined actor set.
