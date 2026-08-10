# Invariants tested

159 tests across 19 suites (Phase 1 baseline: 95 across 12; Phase 2 added the
seven suites under `test/security/phase2/`). Fuzz tests run 512 cases each; each
stateful invariant suite runs 128 runs x 32 depth (4096 calls per invariant).

Run everything:

```bash
export PATH="$PATH:$HOME/.foundry/bin"
forge test -vv
```

## Global invariants (`test/security/erc4626/Invariants.t.sol`)

Stateful handler randomly interleaves `deposit`, `mint`, `withdraw`, `redeem`,
donations and share transfers across three actors.

| Invariant | Statement | Result |
|---|---|---|
| `invariant_Solvency` | `totalAssets() >= convertToAssets(totalSupply())` | holds |
| `invariant_TotalAssetsMatchesBalance` | `totalAssets() == asset.balanceOf(vault)` | holds |
| `invariant_SupplyMatchesHolders` | `totalSupply() == sum(balanceOf(actors))` | holds |
| `invariant_NoSupplyWithoutAssets` | `totalSupply() > 0 => totalAssets() > 0` | holds |
| `invariant_PreviewRoundingDirection` | `previewMint(s) >= convertToAssets(s)` and `previewWithdraw(a) >= convertToShares(a)` | holds |
| `invariant_NoFreeRoundTrip` | `previewRedeem(previewDeposit(x)) <= x` | holds |
| `invariant_SharePriceMonotonicPerShare` | price per share never decreases through user actions | holds |

## Conversion / preview relationships

| Relationship | Where | Result |
|---|---|---|
| `convertToAssets(convertToShares(x)) <= x` | `Invariants.testFuzz_ConvertRoundTripIsLossy` | holds |
| `previewDeposit(a) == deposit(a)` | `Invariants.testFuzz_PreviewMatchesExecution`, artifact `testFuzz_PreviewsMatchExecution` | holds on both vaults |
| `previewWithdraw(a) == withdraw(a)` | `Invariants.testFuzz_PreviewWithdrawMatchesExecution` | holds |
| `previewRedeem(s) == redeem(s)` | artifact `testFuzz_PreviewsMatchExecution` | holds |
| `previewDeposit`/`previewRedeem` round down; `previewMint`/`previewWithdraw` round up | `Rounding.testFuzz_PreviewRoundingDirection` | holds |
| `maxDeposit`/`maxMint`/`maxWithdraw`/`maxRedeem` are enforced | `Invariants.testFuzz_MaxFunctionsAreHonoured` | holds |
| share decimals == asset decimals + `_decimalsOffset()` | `Accounting.test_ShareDecimalsIncludeOffset` | holds |
| virtual-share formula `s = a*(S+10^3)/(A+1)` | `Accounting.test_VirtualSharesFormula` | holds |

## Economic invariants

| Invariant | Where | Result |
|---|---|---|
| No profitable round trip (`end <= start`) | `Rounding.testFuzz_RoundTripNeverProfits`, artifact `testFuzz_NoValueCreatedByDepositRedeem` | holds |
| 200 repeated dust round trips farm no value | `Rounding.test_RepeatedDustRoundTrips_DoNotFarmValue` | holds |
| Minting 1 share always costs >= 1 asset | `Rounding.test_MintOneShareAlwaysCostsAtLeastOneAsset` | holds |
| Donations accrue to existing holders, never to the donor | `InflationAttack.test_DirectDonation_*`, artifact `test_DonationDoesNotMintShares` | holds |
| First-depositor inflation is unprofitable for the attacker | `InflationAttack.*`, artifact `test_FirstDepositorInflationOnArtifact` | holds (see L-1 for the griefing residue) |
| Attacker cost >= victim loss under donation manipulation | `InflationAttack.testFuzz_VictimNeverLosesPrincipalToDonation` (<=2 wei dust) | holds |
| Upkeep MTAA is conserved: `paid == burned + toTreasury`, vault keeps none | `UpkeepFees.test_UpkeepConservesMtaa_*`, `test_UpkeepSplit_InvestingVault` | holds |
| Upkeep never touches the ERC-4626 asset | `UpkeepFees.test_UpkeepDoesNotTouchVaultAssets` | holds |
| Management fees accrue over time, not per call | artifact `test_ManagementFeeCannotBeCollectedRepeatedly` | holds |
| Manager NAV cannot reprice shares | artifact `test_ManagerNavDoesNotRepriceShares` | holds |
| A queued withdrawal cannot be double-spent after redeeming or selling the shares | `WithdrawalQueue.test_QueuedWithdrawalDoubleSpend`, `test_QueuedWithdrawalAfterTransferringShares`, `test_QueueCannotBeStackedBeyondPosition` | holds |

## Sequences exercised (`test/security/erc4626/Sequences.t.sol`)

deposit -> withdraw; deposit -> donate -> deposit; deposit -> donate -> withdraw;
deposit -> upkeep (fee accrual) -> withdraw; repeated deposit -> withdraw;
small deposit -> large donation -> second deposit; large deposit -> small
withdrawal; interleaved multi-user flows. Solvency and no-free-value hold in
every sequence.

Boundary values covered in `Rounding.test_BoundaryValues`: 0, 1 wei, 1 share,
`type(uint128).max`, and 6-decimal assets (`test_SixDecimalAssetConversionsAreConsistent`).

## Phase 2 economic invariants (`test/security/phase2/VaultInvariants.t.sol`)

Stateful handler over four unprivileged actors plus the owner: deposit, mint,
withdraw, redeem, share transfer, donation, upkeep at random intervals with
random MTAA solvency, reactivation, and pause toggling, in arbitrary order.
An independent off-chain ledger of every asset in and out is reconciled against
the vault after every call.

| | Invariant | Result |
|---|---|---|
| I1 | `totalAssets() == asset.balanceOf(vault)` | holds |
| I2 | `sum(previewRedeem(balanceOf(actor))) <= totalAssets()` | holds |
| I3 | `totalAssets() == totalIn - totalOut` (external ledger) | holds |
| I4 | `totalOut <= totalIn` — users never extract more than they contributed | holds |
| I5 | `sum(balanceOf(actors)) == totalSupply()`; the vault never self-holds | holds |
| I6 | treasury and owner never receive the underlying asset | holds |
| I7 | assets that back no share are never paid out to anyone | holds |
| I8 | `status <= HIBERNATING` (CLOSED is unreachable) | holds |

I7 replaces the naive "an empty vault holds only dust": donations to a
share-less or near-empty vault, and deposits that round down to zero shares,
leave assets that back no share (P2-5, P2-3). They are unattributable, not lost
to an accounting error, and nobody ever receives them.

## Phase 2 harness invariant (`test/security/phase2/Phase2Base.sol`)

Asserted after every step of every hand-built sequence:

```text
totalAssets()
  == asset.balanceOf(vault)
  == initialAssets + deposits + donations + yield - withdrawals - assetFees
convertToAssets(totalSupply()) <= totalAssets()
```

## Phase 2 state and price invariants

| Invariant | Where | Result |
|---|---|---|
| Only donations move the price; deposit, withdraw, transfer, upkeep, pause and hibernation are price-neutral | `SharePriceTransitions.test_PriceMovesOnlyOnDonations` | holds |
| Price per share never decreases under user operations | `testFuzz_PriceNeverDecreasesUnderUserOperations` | holds |
| `previewMint(previewDeposit(a)) <= a` and `previewRedeem(previewDeposit(a)) <= a` at any donated price | `testFuzz_PreviewsAreCoherentAtAnyPrice` | holds |
| deposit/redeem and mint/redeem round trips never profit at any price | `testFuzz_RoundTripsAreNeverProfitable` | holds |
| Share accounting is entirely time-independent | `TemporalAssumptions.test_SharePriceIsTimeIndependent` | holds |
| Pause and hibernation are independent locks; share transfers survive both | `StateMachine.*` | holds |
| MTAA upkeep is conserved: `paid == burned + toTreasury`, and never touches the asset | `EconomicComposition.test_ScenarioB_*` | holds |
| The build artifact's runtime code equals the compiled source (metadata-stripped) | `ArtifactParity.*` | holds after the phase 2 correction |

## Invariants that do NOT hold

| Broken invariant | Finding | Applies to |
|---|---|---|
| the protocol collects the fee it advertises | P2-1 (unenforceable, self-priced upkeep) | canonical source |
| delinquency costs more than compliance | P2-2 (hibernation is the cheap path) | canonical source |
| a successful `deposit()` gives the depositor a claim | P2-3 (zero-share deposits, supersedes L-1) | canonical source |
| paying the fee restores service | P2-4 (upkeep charged while hibernating) | canonical source |
| `fee charged == advertised fee` | M-1 (flash-loanable MTAA discount) | canonical source |
| depositors can always exit a solvent vault | M-3 + P2-2 (pause / hibernation freeze) | canonical source |
| the integration layer's API matches the canonical ABI | P2-7 (supersedes M-6, I-1) | deploy scripts + backend |
| `shares minted == f(assets actually received)` | M-2 | only if a fee-on-transfer/rebasing asset is listed |
| `totalAssets` backs the outstanding shares | H-1 (`emergencyWithdraw`) | legacy artifact only |
| a successful `withdraw()` transfers assets | M-4 (large-withdrawal queue) | legacy artifact only |
| reported NAV is backed by assets | M-5 (`previewNAV`) | legacy artifact only |
