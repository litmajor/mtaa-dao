// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Baseline accounting model discovery
/// @notice These tests do not attack anything; they pin down the *actual*
///         accounting model of `MaonoVault_Phase1B` (as opposed to the model
///         described in the repo documentation) so the attack tests can make
///         precise economic claims.
contract AccountingModelTest is MaonoVaultBaseTest {
    function test_TotalAssetsIsRawUnderlyingBalance() public {
        _fund(victim, 1_000e18);
        _deposit(victim, 1_000e18);
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));

        // No `totalAssets()` override exists: an unsolicited transfer is fully
        // credited to the pool, i.e. the vault is donation-sensitive by design.
        _fund(attacker, 500e18);
        _donate(attacker, 500e18);
        assertEq(vault.totalAssets(), 1_500e18);
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)));
    }

    function test_ShareDecimalsIncludeOffset() public view {
        // ERC4626Upgradeable: decimals() == asset decimals + _decimalsOffset()
        assertEq(vault.decimals(), asset.decimals() + DECIMALS_OFFSET);
    }

    function test_NoDepositOrWithdrawFeeIsCharged() public {
        _fund(victim, 1_000e18);
        uint256 shares = _deposit(victim, 1_000e18);
        assertEq(vault.previewRedeem(shares), 1_000e18, "round-trip must be fee-free");
        uint256 out = _redeemAll(victim);
        assertEq(out, 1_000e18, "no deposit/withdraw fee in this implementation");
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.totalAssets(), 0);
    }

    function test_VirtualSharesFormula() public {
        // Empty vault: convertToShares(x) == x * 10^offset
        assertEq(vault.convertToShares(1e18), 1e18 * (10 ** DECIMALS_OFFSET));
        assertEq(vault.convertToAssets(1e18 * (10 ** DECIMALS_OFFSET)), 1e18);

        _fund(victim, 1_000e18);
        _deposit(victim, 1_000e18);
        // shares = assets * (supply + 10^offset) / (totalAssets + 1)
        uint256 assets = 7e18;
        uint256 expected =
            (assets * (vault.totalSupply() + 10 ** DECIMALS_OFFSET)) / (vault.totalAssets() + 1);
        assertEq(vault.convertToShares(assets), expected);
    }

    function test_MaxDepositIsUncapped() public view {
        // No vault cap / min-deposit logic exists in the source implementation.
        assertEq(vault.maxDeposit(attacker), type(uint256).max);
        assertEq(vault.maxMint(attacker), type(uint256).max);
    }

    function test_AssetIsImmutableAfterInitialize() public {
        assertEq(vault.asset(), address(asset));
        vm.expectRevert();
        vault.initialize(
            address(asset), "x", "x", attacker, 0, treasury, address(mtaa), address(oracle)
        );
    }
}
