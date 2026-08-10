# Invariants tested

95 tests across 12 suites. Fuzz tests run 512 cases each; the stateful
invariant suite runs 128 runs x 32 depth (4096 calls per invariant).

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

## Invariants that do NOT hold

| Broken invariant | Finding |
|---|---|
| `shares minted == f(assets actually received)` | M-2 (fee-on-transfer / rebasing assets) |
| `fee charged == advertised fee` | M-1 (flash-loanable MTAA discount) |
| depositors can always exit a solvent vault | M-3 (pause / hibernation freeze) |
| `totalAssets` backs the outstanding shares | H-1 (artifact `emergencyWithdraw`) |
| a successful `withdraw()` transfers assets | M-4 (artifact large-withdrawal queue) |
| reported NAV is backed by assets | M-5 (artifact `previewNAV`) |
