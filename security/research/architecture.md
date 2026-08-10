# MaonoVault architecture (derived from code)

All statements below were derived by reading `contracts/*.sol`, decoding
`contracts/MaonoVault.json`, and executing both on a local EVM. Nothing here
comes from documentation.

## 0. There are two different MaonoVaults

| | `contracts/MaonoVault.sol` | `contracts/MaonoVault.json` |
|---|---|---|
| Contract | `MaonoVault_Phase1B` | `MaonoVault` (ABI + bytecode only, **no source in repo**) |
| Model | upkeep fees in MTAA, hibernation, EIP-1167 clone | NAV reporting, manager, management/performance fees, delayed large withdrawals |
| Init | `initialize(...)`, `Ownable2Step` | `constructor(asset, daoTreasury, manager)` — **owner is set to `manager`** |
| Decimals | asset decimals + 3 (`_decimalsOffset() = 3`) | asset decimals (no offset) |
| Used by | `contracts/MaonoVaultFactory.sol` | `server/blockchain.ts`, `server/vaultAutomation.ts`, `contracts/deploy_maono_vault.ts` |

The backend only ever loads the **artifact** (`server/blockchain.ts:2`), so both
are in scope and both were tested. They share no admin surface
(`test/security/artifact/BackendIntegration.t.sol`).

## 1. `MaonoVault_Phase1B` (contracts/MaonoVault.sol)

```
ERC4626Upgradeable + Ownable2StepUpgradeable + ReentrancyGuardUpgradeable + PausableUpgradeable
```

### Accounting
- `totalAssets()` is inherited: it is exactly `asset.balanceOf(vault)`. Verified
  in `erc4626/Accounting.t.sol`; any direct token transfer raises it.
- `totalSupply()` is the ERC-20 supply of shares. Share decimals = asset
  decimals + 3.
- Conversion uses OpenZeppelin virtual shares/assets with `_decimalsOffset() = 3`:
  `shares = assets * (supply + 10^3) / (totalAssets + 1)`.
- There are **no deposit, withdrawal or performance fees**. `previewDeposit`/
  `previewRedeem` round down; `previewMint`/`previewWithdraw` round up.

### Entry points
`deposit`, `mint`, `withdraw`, `redeem` are each overridden with
`onlyActive whenNotPaused nonReentrant` and delegate to `super`. `maxDeposit`
and `maxMint` are unbounded (`type(uint256).max`); there is no vault cap and no
minimum deposit.

### Fees (MTAA, not the vault asset)
- `collectMonthlyUpkeep()` — `onlyOwner`, callable once per 30 days. Cost is
  `UPKEEP_COSTS_MONTHLY[vaultType]` (15/20/40/60/80 MTAA) reduced by
  `getDiscountedFeePct(msg.sender)`. Split by `BURN_PERCENTAGES[vaultType]`
  between `IMTAAToken.burn` and `daoTreasury`. If the owner's MTAA balance is
  below the cost the vault silently hibernates instead of reverting.
- `getDiscountedFeePct(user) = min(50, floor(sqrt(balance/1e18)) * 2.5)` — an
  **instantaneous balance snapshot** of the caller.
- `reactivateFromHibernation()` — `onlyOwner`, costs 1.5x one month, no backpay.
- Neither path touches the ERC-4626 asset; depositor capital is never used for
  fees (`fees/UpkeepFees.t.sol`).

### Admin / emergency surface
`setPriceOracle`, `setDaoTreasury`, `setOracleCircuitEnabled`, `setOracleBounds`,
`setUpkeepCostAt`, `setBurnPercentageAt`, `pause`, `unpause`,
`collectMonthlyUpkeep`, `reactivateFromHibernation` — all `onlyOwner`
(`Ownable2Step`). There is **no** `emergencyWithdraw`, `sweep`, `updateNAV` or
any other function that can move the underlying asset outside ERC-4626 rules.
Only `pause()` and the HIBERNATING status can block depositor exits.

### External calls / trust boundary
- `IERC20(asset)` via `SafeERC20` (ERC-4626 base).
- `IERC20(mtaaToken)` + `IMTAAToken.burn` (a reverting burn bricks upkeep).
- `IPriceOracle.getPrice()` in `getSpawnCostInMTAA()`, `try/catch`-wrapped and
  bounded by `min/maxAllowedUsdCents`. It is a view helper only; it does not
  feed share pricing.

### Underlying-token assumptions
The vault assumes a standard, non-rebasing, non-fee-on-transfer ERC-20. It mints
shares from the *requested* amount, never from the delta actually received
(see finding M-2).

### Deployment
`MaonoVaultFactory_Phase1B` clones the implementation (EIP-1167) and calls
`initialize` in the same transaction. The implementation constructor calls
`_disableInitializers()`.

## 2. `MaonoVault` artifact (contracts/MaonoVault.json)

Derived black-box by deploying the committed bytecode
(`test/security/artifact/*`).

- `constructor(asset, daoTreasury, manager)`; `owner == manager`.
- Defaults: `minDeposit = 10e18`, `vaultCap = 10_000e18`,
  `performanceFee = 1500` bps, `managementFee = 200` bps,
  `withdrawalDelay = 86_400`, `largeWithdrawalThreshold = 1_000e18`.
- `totalAssets()` is the real token balance. `lastNAV` is manager-reported and
  **does not** affect share pricing; `previewNAV()` returns that reported number.
- `collectManagementFees()` accrues 2%/yr pro-rata to `daoTreasury` and cannot be
  farmed by repeated calls.
- `emergencyWithdraw(amount)` is `onlyOwner` and sends the assets **to the
  owner** (not the treasury), leaving all shares outstanding.
- `withdraw()`/`redeem()` above `largeWithdrawalThreshold` do **not** pay out and
  do **not** burn shares — they record a request in `withdrawalRequests`
  (1-indexed) which the requester can `fulfillWithdrawal(id)` after
  `withdrawalDelay`. Shares are burned at fulfilment.
- `distributePerformanceFee(uint256)` — called by `server/vaultAutomation.ts` —
  **does not exist** in the ABI or bytecode.
