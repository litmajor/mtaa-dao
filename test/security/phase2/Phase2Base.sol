// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @notice Phase 2 harness: everything Phase 1 had, plus an explicit economic
///         ledger so that every sequence of *individually valid* operations can
///         be reconciled against the vault's own accounting.
///
///         The ledger tracks the only four ways the vault's asset balance can
///         legitimately move (deposits in, donations in, withdrawals out, and
///         the fees the vault charges in the asset — which the canonical
///         Phase 1B vault never does), and is compared against `totalAssets()`.
abstract contract Phase2Base is MaonoVaultBaseTest {
    struct Ledger {
        uint256 initialAssets;
        uint256 deposited;
        uint256 donated;
        uint256 yield;
        uint256 withdrawn;
        uint256 assetFees;
    }

    Ledger internal ledger;

    address internal carol = address(0xCA401);

    function _resetLedger() internal {
        ledger = Ledger({
            initialAssets: vault.totalAssets(), deposited: 0, donated: 0, yield: 0, withdrawn: 0, assetFees: 0
        });
    }

    /// @notice expected assets = initial + deposits + donations + yield - withdrawals - fees
    function _expectedAssets() internal view returns (uint256) {
        return
            ledger.initialAssets + ledger.deposited + ledger.donated + ledger.yield - ledger.withdrawn
                - ledger.assetFees;
    }

    /// @notice The Phase 2 core invariant, derived from the implementation:
    ///         `totalAssets()` is `asset.balanceOf(vault)` (no NAV, no strategy,
    ///         no idle-capital accounting), so the vault's books must equal the
    ///         externally reconstructed ledger, and the sum of every economic
    ///         claim must be backed by those assets.
    function _assertConservation(string memory label) internal view {
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)), string.concat(label, ": totalAssets != balance"));
        assertEq(vault.totalAssets(), _expectedAssets(), string.concat(label, ": ledger divergence"));
        assertLe(
            vault.convertToAssets(vault.totalSupply()),
            vault.totalAssets(),
            string.concat(label, ": claims exceed backing")
        );
    }

    /// @notice Sum of what every holder could actually redeem right now.
    function _redeemableClaims(address[] memory holders) internal view returns (uint256 total) {
        for (uint256 i = 0; i < holders.length; ++i) {
            total += vault.previewRedeem(vault.balanceOf(holders[i]));
        }
    }

    function _assertClaimsAreBacked(address[] memory holders, string memory label) internal view {
        assertLe(_redeemableClaims(holders), vault.totalAssets(), string.concat(label, ": redeemable > assets"));
    }

    // ------------------------------------------------------------- operations

    function _depositTracked(address who, uint256 amount) internal returns (uint256 shares) {
        shares = _deposit(who, amount);
        ledger.deposited += amount;
    }

    function _donateTracked(address from, uint256 amount) internal {
        _donate(from, amount);
        ledger.donated += amount;
    }

    function _redeemAllTracked(address who) internal returns (uint256 assets) {
        assets = _redeemAll(who);
        ledger.withdrawn += assets;
    }

    function _withdrawTracked(address who, uint256 amount) internal returns (uint256 shares) {
        vm.prank(who);
        shares = vault.withdraw(amount, who, who);
        ledger.withdrawn += amount;
    }

    // ------------------------------------------------------------------ owner

    function _fundOwnerWithMtaa(uint256 amount) internal {
        mtaa.mint(vaultOwner, amount);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
    }

    /// @notice Runs one due upkeep cycle with the owner solvent in MTAA.
    function _upkeep() internal {
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
    }

    function _hibernate() internal {
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep(); // owner MTAA balance < cost -> HIBERNATING
    }

    function _status() internal view returns (uint256) {
        return uint256(vault.getVaultStatus());
    }

    // ------------------------------------------------------------------- logs

    function _logLedger(string memory label) internal view {
        console2.log("---- ledger:", label);
        console2.log("  initial assets   :", ledger.initialAssets);
        console2.log("  + deposits       :", ledger.deposited);
        console2.log("  + donations      :", ledger.donated);
        console2.log("  - withdrawals    :", ledger.withdrawn);
        console2.log("  = expected assets:", _expectedAssets());
        console2.log("  actual totalAssets:", vault.totalAssets());
        console2.log("  total supply     :", vault.totalSupply());
    }

    function _logPnl(string memory who, uint256 start, uint256 end) internal pure {
        console2.log("---- pnl:", who);
        console2.log("  start :", start);
        console2.log("  end   :", end);
        if (end >= start) {
            console2.log("  PROFIT:", end - start);
        } else {
            console2.log("  LOSS  :", start - end);
        }
    }
}
