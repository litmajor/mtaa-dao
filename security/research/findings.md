# Findings

Local, experimental audit of both MaonoVault implementations. 95 tests, 0
failing. Every claim below is reproduced by a named test; every negative result
is also a test, so regressions surface as failures.

```bash
export PATH="$PATH:$HOME/.foundry/bin"
bash test/security/setup.sh    # one-time: foundry + forge-std + OZ
forge test -vv
```

| ID | Severity | Component | Title | Unprivileged? |
|---|---|---|---|---|
| H-1 | High | artifact vault | `emergencyWithdraw` sends 100% of depositor assets to the owner EOA while shares stay outstanding | No (owner/manager) |
| M-1 | Medium | Phase 1B | MTAA fee discount is an instantaneous balance snapshot: flash-loanable, halves protocol revenue | Owner-only caller, no capital at risk |
| M-2 | Medium | Phase 1B | Shares are minted from the requested amount, not the amount received: fee-on-transfer / rebasing assets over-issue claims | Conditional on the listed asset |
| M-3 | Medium | Phase 1B | `pause()` and hibernation freeze depositor exits indefinitely at zero cost to the owner | No (owner) |
| M-4 | Medium | artifact vault | Large `withdraw()` pays nothing yet returns a non-zero value; queued requests are unvalidated and can be permanently unfulfillable | Yes (self-inflicted / integration) |
| M-5 | Medium | artifact vault | `previewNAV()` reports a manager-supplied number with no asset backing | No (manager) |
| M-6 | Medium | integration | `server/vaultAutomation.ts` calls `distributePerformanceFee`, which does not exist on the deployed contract | n/a |
| L-1 | Low | Phase 1B | Donation griefing can round a victim's deposit to zero shares at ~2000x the victim's capital | Yes |
| L-2 | Low | Phase 1B | An uninitialized clone can be seized by the first `initialize()` caller | Yes, if a clone is ever created non-atomically |
| I-1 | Info | repo | Two divergent MaonoVault contracts; the deployed one has no source in the repository | n/a |

---

## H-1 — `emergencyWithdraw` drains the vault to a single EOA

**Component**: `contracts/MaonoVault.json` (the contract `server/blockchain.ts`
binds to `MAONO_CONTRACT_ADDRESS`).

**Reproduction**
```bash
forge test --match-test test_EmergencyWithdrawDrainsToTreasuryWhileSharesRemain -vv
```

**Root cause**: `emergencyWithdraw(uint256)` is `onlyOwner` and transfers the
assets to `owner()`. The constructor sets `owner == manager`, so the operational
manager key — the same key `server/blockchain.ts` uses to sign `updateNAV`
transactions — is also the drain key. No timelock, no share burn, no cap, no
treasury destination.

**Violated invariant**: `totalAssets()` backs the outstanding shares.

**Economics** (from the test): depositor deposits 10,000 units; owner calls
`emergencyWithdraw(10_000e18)`.

| | value |
|---|---|
| owner starting capital | 0 |
| owner ending capital | 10,000 (100% of TVL) |
| shares outstanding after | 10,000e18 (unchanged) |
| depositor `previewRedeem` after | 0 |
| protocol/user loss | 100% of TVL |

**Reachability**: privileged. It is a single-key, single-transaction total loss;
the same key is used for routine automation, which maximises exposure.

**Mitigation**: send emergency funds to `daoTreasury`, not `owner()`; put the
call behind a timelock + multisig; separate the NAV-automation key from the
owner key; emit and cap per-period withdrawals; consider pausing the vault
instead of moving assets.

**Regression test**: `test_EmergencyWithdrawDrainsToTreasuryWhileSharesRemain`
asserts the exact post-state, so any change of destination or share handling
fails the test.

---

## M-1 — Flash-loanable MTAA upkeep discount

**Component**: `contracts/MaonoVault.sol`, `getDiscountedFeePct()` +
`collectMonthlyUpkeep()`.

**Reproduction**
```bash
forge test --match-test test_FeeDiscountIsFlashLoanable -vv
forge test --match-test test_NominalUpkeepPriceIsUnreachable -vv
```

**Root cause**
```solidity
uint256 mtaaBalance = IERC20(mtaaToken).balanceOf(user);
uint256 discountPct = min(50, (Math.sqrt(mtaaBalance / 1e18) * 25) / 10);
```
The discount is a spot balance read inside the fee-charging transaction. There
is no time-weighting, snapshot, lock, or minimum holding period, and the curve
saturates at only 400 MTAA. An owner contract can borrow 400 MTAA, call
`collectMonthlyUpkeep()`, and repay in the same transaction.

**Violated invariant**: the fee charged equals the advertised fee, and discounts
are earned by sustained MTAA holding.

**Economics** (SAVINGS vault, nominal 15 MTAA/month):

| | value |
|---|---|
| attacker starting capital | 15 MTAA (fee money only) |
| borrowed for one call | 400 MTAA, repaid same tx |
| capital at risk | 0 |
| fee paid | 7.5 MTAA |
| protocol revenue lost | 7.5 MTAA/month/vault (50%) |
| burn lost (SAVINGS) | 7.5 MTAA/month/vault |

A related, non-attack consequence: the nominal price can never be charged at
all. To pay a 15 MTAA fee the owner must hold >= 15 MTAA, which already yields a
7% discount — the vault charges 13.95 MTAA even for an honest owner
(`test_NominalUpkeepPriceIsUnreachable`).

**Reachability**: the caller must be the vault owner, so it is not an outsider
attack — but the owner is exactly the party who pays the fee, and needs no
capital of their own. Every vault owner is economically incentivised to do it.

**Mitigation**: use a time-weighted balance or a staking/lock contract
(`stakedBalanceOf` with a minimum duration), snapshot MTAA balances at the start
of the upkeep period, or charge the fee from an escrowed balance. At minimum,
exclude balances acquired in the current block.

---

## M-2 — Shares minted from the requested amount, not the amount received

**Component**: `contracts/MaonoVault.sol` (inherited `ERC4626._deposit`).

**Reproduction**
```bash
forge test --match-test test_FeeOnTransferToken_BreaksShareAccounting -vv
forge test --match-test test_RebasingToken_NegativeRebaseSocialisesLoss -vv
```

**Root cause**: OpenZeppelin's `_deposit` mints `shares` computed from the
*requested* `assets` and never measures the balance delta. For a fee-on-transfer
asset, the vault receives less than it credits.

**Violated invariant**: `sum(claims) <= totalAssets()` at mint time.

**Economics** (1% fee-on-transfer asset, first depositor 1,000 units):

| | value |
|---|---|
| assets requested | 1,000 |
| assets actually received | 990 |
| shares minted | priced as if 1,000 |
| first depositor exit value | 985.03 |
| second depositor claim | 994.97 |

Loss is socialised across depositors; no attacker profits, so this is a
correctness/solvency bug rather than an extraction path — unless the listed
asset's fee is controlled by a third party who can turn it on after listing.

**Reachability**: depends on the asset the factory/owner lists. Not reachable by
an outsider on a standard asset such as cUSD.

**Mitigation**: measure `balanceBefore/balanceAfter` in `_deposit` and mint from
the delta; and/or make the factory's asset allowlist explicitly reject
fee-on-transfer and rebasing tokens (documented and tested).

---

## M-3 — Owner can freeze depositor exits indefinitely, for free

**Component**: `contracts/MaonoVault.sol`, `pause()` + `onlyActive`.

**Reproduction**
```bash
forge test --match-path 'test/security/emergency/*' -vv
```

**Root cause**: all four ERC-4626 entry points carry `whenNotPaused onlyActive`.
`pause()`/`unpause()` are `onlyOwner` with no time limit and no guardian, and
the HIBERNATING status — which also blocks withdrawals — is entered simply by
the owner calling `collectMonthlyUpkeep()` without holding enough MTAA. Only the
owner can leave hibernation (1.5x fee).

**Violated invariant**: depositors can always exit a solvent vault.

**Economics**: 100,000 units of depositor capital frozen; cost to the owner
0 MTAA (`test_HibernationFreezeCostsTheOwnerNothing`). Shares remain
transferable while paused, so the only exit is a secondary-market sale at a
discount.

**Reachability**: privileged (owner), but hibernation can also be reached
accidentally through mere delinquency, which turns an operational lapse into a
depositor lockup.

**Mitigation**: allow `redeem`/`withdraw` while paused (pause deposits only), or
add a maximum pause duration / automatic unpause, and let anyone reactivate a
hibernating vault by paying the fee. Keep hibernation as a deposit and
fee-accrual freeze rather than an exit freeze.

---

## M-4 — Large withdrawals report success while transferring nothing

**Component**: `contracts/MaonoVault.json`.

**Reproduction**
```bash
forge test --match-path 'test/security/artifact/WithdrawalQueue.t.sol' -vv
forge test --match-test test_FullPositionRequestIsUnfulfillableByOneWei -vv
```

**Root cause**: `withdraw()` above `largeWithdrawalThreshold` (1,000 units by
default) records a request and returns a non-zero value without transferring
assets or burning shares. Requests are not validated against the caller's
position at creation. At fulfilment the contract requires
`previewWithdraw(amount)` shares, which rounds up.

Three concrete consequences, all tested:
1. `server/blockchain.ts:108` treats the successful transaction as a completed
   withdrawal: a user is told they withdrew while nothing moved.
2. A request for more than the caller owns is accepted and can never be
   fulfilled (`test_OversizedRequestIsAcceptedButUnfulfillable`).
3. Requesting exactly one's own deposit is 1 wei of shares short and reverts
   forever with `InsufficientBalance`
   (`test_FullPositionRequestIsUnfulfillableByOneWei`).

**Violated invariant**: a successful `withdraw()` transfers assets (EIP-4626
requires it, or a revert).

**Economics**: no value is extracted — the double-spend attempts
(`test_QueuedWithdrawalDoubleSpend`,
`test_QueuedWithdrawalAfterTransferringShares`,
`test_QueueCannotBeStackedBeyondPosition`) all end with the attacker at exactly
their starting capital. The impact is stuck requests and false accounting in the
backend; funds remain redeemable via sub-threshold `redeem()`.

**Mitigation**: revert (or return 0 and emit a distinct event) instead of
returning a non-zero value; validate and escrow shares at request creation;
compute the fulfilment share requirement from the shares escrowed rather than
re-running `previewWithdraw`; make the backend treat a `WithdrawalRequested`
event as pending, not complete.

---

## M-5 — `previewNAV()` reports an unbacked, manager-controlled number

**Component**: `contracts/MaonoVault.json`, consumed by
`server/vaultAutomation.ts`.

**Reproduction**
```bash
forge test --match-test test_PreviewNavReportsManagerControlledNumber -vv
```

**Root cause**: `previewNAV()` returns `lastNAV`, which is whatever the manager
last passed to `updateNAV`. With 10,000 units really held, a manager can report
1,000,000 and the API/UI will show it.

**Violated invariant**: reported NAV is backed by assets.

**Economics**: no direct on-chain extraction — share redemption is unaffected
(`test_ManagerNavDoesNotRepriceShares`). The value at risk is off-chain: users
deposit into a vault whose reported performance is fabricated.

**Mitigation**: report `totalAssets()` for the on-chain component, restrict
`updateNAV` to off-chain-only assets with a documented attestation, bound the
per-update delta, and display both real balance and reported NAV separately.

---

## M-6 — The backend calls a function the contract does not have

**Reproduction**
```bash
forge test --match-test test_DistributePerformanceFeeDoesNotExist -vv
```

`server/vaultAutomation.ts:312,429` calls
`MaonoVaultService.distributePerformanceFee(profit)`. That selector is absent
from both the artifact ABI and its bytecode, so every performance-fee
distribution reverts. Performance fees (15% configured) are never collected.

**Mitigation**: either add the function to the deployed contract or remove the
call path; add an ABI-conformance check in CI that asserts every function the
server calls exists in `MaonoVault.json`.

---

## L-1 — Donation griefing can round a deposit to zero shares

**Reproduction**
```bash
forge test --match-test test_FirstDepositorInflation_6dec_CostToRoundVictimToZero -vv
```

With `_decimalsOffset() = 3` the classic inflation attack is unprofitable, but
it is not impossible to grief. For a 6-decimal asset, zeroing a 10,000-unit
victim deposit required a donation of 20,000,000 units — 2,000x the victim's
capital — and the attacker lost 9,995,000 units doing it. The fuzz test
`testFuzz_VictimNeverLosesPrincipalToDonation` confirms attacker cost >= victim
loss (up to 2 wei of dust) across 512 cases.

**Mitigation**: revert on zero-share deposits, and seed each new vault with a
dead-shares deposit at creation.

---

## L-2 — Uninitialized clones are seizable

**Reproduction**
```bash
forge test --match-test test_UninitializedCloneCanBeSeizedByAnyone -vv
```

`initialize()` has no access control, so whoever calls it first on a fresh clone
becomes owner. `MaonoVaultFactory_Phase1B` clones and initializes atomically, so
this is currently unreachable; it becomes a real risk for any script or future
factory path that separates the two steps.

**Mitigation**: restrict `initialize` to the factory (`msg.sender == factory` or
a passed-in salt/deployer check), and never expose a raw clone address before
initialization.

---

## I-1 — Two divergent MaonoVaults, only one with source

`contracts/MaonoVault.sol` (`MaonoVault_Phase1B`) and `contracts/MaonoVault.json`
(`MaonoVault`) are different contracts with disjoint admin APIs
(`test_TheTwoVaultsShareNoAdminSurface`). The deployed one — the one the backend
and `contracts/deploy_maono_vault.ts` use — has **no Solidity source in the
repository**, so it cannot be reviewed, verified, or safely changed. All H/M
findings above except M-1..M-3 live in that unauditable contract.

**Mitigation**: commit the source of the deployed contract (or stop deploying
it), verify the bytecode against the source, and pick one vault model.

---

# Negative results (attacks that failed)

These were attempted and did not work; each is retained as a regression test.

| Attack | Why it failed |
|---|---|
| ERC-4626 inflation / first-depositor theft | `_decimalsOffset() = 3` adds virtual shares/assets; the attacker's donation cost exceeded the victim's loss in every fuzz case (1098x in the 18-decimal case). No attacker profit was ever observed. |
| Donation sandwich | The donation accrues pro-rata to whoever holds shares, including the victim; the attacker exited 1 wei below their capital. |
| Value extraction from rounding | `previewDeposit`/`previewRedeem` round down, `previewMint`/`previewWithdraw` round up; 200 repeated dust round trips returned strictly less than the starting capital. |
| Reentrancy via a callback token | `nonReentrant` on `deposit`/`mint`/`withdraw`/`redeem` and on both upkeep functions; the reentrant `withdraw` reverted with `ReentrancyGuard: reentrant call` while the outer deposit completed correctly. |
| Forced token transfers to strand accounting | `totalAssets()` is the raw balance, so donations simply reprice shares upward; no state becomes inconsistent. |
| Silent-failure ERC-20 (`transfer` returning `false`) | Rejected by `SafeERC20`. |
| Access-control bypass on every Phase 1B setter and artifact setter | All revert for unprivileged callers; `Ownable2Step` handover cannot be front-run. |
| Redeeming another user's shares | Reverts without allowance. |
| Clone re-initialization / initializing the implementation | `initializer` modifier + `_disableInitializers()`. |
| Repricing shares through the oracle | The oracle only feeds `getSpawnCostInMTAA()`; it never touches ERC-4626 math, and it is bounded and `try/catch`-wrapped. |
| Manager NAV repricing shares (artifact) | `totalAssets()` ignores `lastNAV`; redemption value is unchanged by `updateNAV`. |
| Double-spending a queued withdrawal (artifact) | Shares are checked and burned at fulfilment; redeeming or transferring the shares first makes fulfilment revert. Stacking five full-position requests still paid out exactly the position. |
| Farming management fees by repeated calls (artifact) | Fees accrue pro-rata over time; an immediate second call collects 0. |
| Setting fees above the cap (artifact) | `setPerformanceFee`/`setManagementFee` are bounded. |
| Inducing hibernation as an outsider | `collectMonthlyUpkeep()` is `onlyOwner`. |
| Reaching the CLOSED vault status | No code path sets it; it is dead state. |
