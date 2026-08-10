# Attack surface

Each row is an attack class from the research brief, the entry point it targets,
and the experimental outcome. "Blocked" means an executed test tried it and the
invariant held.

## `MaonoVault_Phase1B` (contracts/MaonoVault.sol)

| # | Attack class | Entry point | Outcome | Test |
|---|---|---|---|---|
| 1 | ERC-4626 inflation | `deposit` as first depositor + donation | Blocked (unprofitable). `_decimalsOffset()=3` makes the attacker's cost exceed the victim's loss in every fuzz case | `erc4626/InflationAttack.t.sol` |
| 2 | First-depositor | 1 wei deposit then donation | Blocked; residual zero-share griefing costs ~2000x the victim's deposit (L-1) | `InflationAttack.test_FirstDepositorInflation_6dec_*` |
| 3 | Direct donation | `asset.transfer(vault)` | Works as designed: value accrues to existing holders, donor gets nothing | `InflationAttack.test_DirectDonation_*` |
| 4 | Share-price manipulation | donation, forced transfer, oracle | Blocked. Price depends only on the real balance; the oracle never feeds pricing | `tokens/MaliciousToken.test_ForcedUnderlyingTransfer_OnlyRepricesShares` |
| 5 | Rounding | dust round trips, 1-share mints, boundaries | Blocked; rounding always favours the vault | `erc4626/Rounding.t.sol` |
| 6 | Precision / decimals | 6- and 18-decimal assets, offset of 3 | Consistent | `Rounding.test_SixDecimalAssetConversionsAreConsistent` |
| 7 | Fee-accounting manipulation | `collectMonthlyUpkeep` + `getDiscountedFeePct` | **Broken (M-1)**: instantaneous MTAA balance snapshot, flash-loanable, 50% revenue loss | `fees/UpkeepFees.test_FeeDiscountIsFlashLoanable` |
| 8 | Accounting inconsistency | all sequences | `totalAssets == balanceOf(vault)` always | `erc4626/Invariants.t.sol` |
| 9 | Forced underlying transfer | direct transfer | Only repriced shares upward; no stuck state | `MaliciousToken.test_ForcedUnderlyingTransfer_*` |
| 10 | Reentrancy / callbacks | ERC-777-style token callback re-entering `withdraw` during `deposit` | Blocked by `nonReentrant` on all four entry points | `MaliciousToken.test_ReentrantToken_CannotReenterDeposit` |
| 11 | Malicious ERC-20 | fee-on-transfer, rebasing, false-return, no-return | **Broken (M-2)** for fee-on-transfer/rebasing assets; false-return rejected by SafeERC20; no-return works | `tokens/MaliciousToken.t.sol` |
| 12 | Access control bypass | every `onlyOwner` setter, ownership handover, third-party redeem | Blocked; `Ownable2Step` handover cannot be hijacked | `access/AccessControl.t.sol` |
| 13 | Initialization / upgradeability | re-`initialize` a clone, initialize the implementation, seize an uninitialized clone | Clone re-init blocked, implementation initializers disabled; an **uninitialized** clone is seizable (L-2, factory keeps it atomic) | `access/AccessControl.t.sol` |
| 14 | Emergency-function abuse | `pause`, hibernation | **Broken (M-3)**: owner can freeze exits indefinitely at zero cost; hibernation also freezes and is reachable by mere delinquency | `emergency/PauseAndHibernation.t.sol` |
| 15 | Cross-function state transitions | deposit/donate/upkeep/withdraw interleavings, stateful invariant handler | Blocked | `erc4626/Sequences.t.sol`, `erc4626/Invariants.t.sol` |

## `MaonoVault` artifact (contracts/MaonoVault.json — what the backend calls)

| # | Attack class | Entry point | Outcome | Test |
|---|---|---|---|---|
| 16 | Privileged drain | `emergencyWithdraw(amount)` | **Broken (H-1)**: `onlyOwner` (== manager EOA) sends 100% of assets to the owner while all shares stay outstanding; depositor claims go to 0 | `artifact/DeployedArtifactVault.test_EmergencyWithdrawDrainsToTreasuryWhileSharesRemain` |
| 17 | NAV manipulation | `updateNAV` | Cannot reprice shares, but `previewNAV()` reports the manager's number verbatim (M-5) | `artifact/DeployedArtifactVault.test_ManagerNavDoesNotRepriceShares`, `test_PreviewNavReportsManagerControlledNumber` |
| 18 | Withdrawal-queue abuse | `withdraw` > threshold, `fulfillWithdrawal` | Double-spend blocked (shares checked and burned at fulfilment). But requests are unvalidated at creation, pay nothing while returning a non-zero value, and a full-position request is permanently unfulfillable by 1 wei (M-4) | `artifact/WithdrawalQueue.t.sol`, `test_FullPositionRequestIsUnfulfillableByOneWei` |
| 19 | Fee manipulation | `collectManagementFees`, `setPerformanceFee` | Blocked: time-accrued, bounded, owner-gated | `artifact/DeployedArtifactVault.test_ManagementFeeCannotBeCollectedRepeatedly`, `test_FeeParametersAreBounded` |
| 20 | Inflation / rounding | first deposit, donation | Blocked; `minDeposit = 10e18` acts as a floor, no offset needed | `artifact/DeployedArtifactVault.test_FirstDepositorInflationOnArtifact` |
| 21 | Access control | all setters + `updateNAV` + `emergencyWithdraw` from an unprivileged account | Blocked | `artifact/DeployedArtifactVault.test_AdminSurfaceIsGated` |
| 22 | Integration mismatch | `distributePerformanceFee` called by `server/vaultAutomation.ts` | **Broken (M-6)**: the function does not exist in the deployed ABI/bytecode | `artifact/BackendIntegration.test_DistributePerformanceFeeDoesNotExist` |

## Surface deliberately not attacked
- Live deployments, public RPCs, real funds — everything here runs on a local
  EVM with locally deployed mocks.
- `MaonoVaultFactory_Phase1B` governance (asset allowlisting) beyond its effect
  on the vault trust boundary.
