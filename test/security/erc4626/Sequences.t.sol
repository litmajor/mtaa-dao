// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Cross-function state-transition sequences
/// @notice Isolated calls are not enough: value is usually extracted from an
///         *ordering* of state transitions. Each sequence below is executed
///         and its economic result quantified.
contract SequenceTest is MaonoVaultBaseTest {
    function _assertSolvent() internal view {
        // Every share outstanding must be redeemable from real assets.
        assertLe(vault.convertToAssets(vault.totalSupply()), vault.totalAssets(), "vault must stay solvent");
    }

    // 1. deposit -> withdraw
    function test_Seq_DepositWithdraw() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);
        vm.prank(bob);
        vault.withdraw(1_000e18, bob, bob);
        assertEq(asset.balanceOf(bob), 1_000e18);
        assertEq(vault.balanceOf(bob), 0);
        _assertSolvent();
    }

    // 2. deposit -> donate -> deposit
    function test_Seq_DepositDonateDeposit() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);

        _fund(attacker, 1_000e18);
        _donate(attacker, 1_000e18);

        _fund(victim, 1_000e18);
        uint256 victimShares = _deposit(victim, 1_000e18);

        // Second depositor buys in at the inflated price: it must receive
        // exactly half the shares of the first depositor (price doubled).
        assertApproxEqRel(victimShares, vault.balanceOf(bob) / 2, 1e12);
        assertApproxEqAbs(vault.previewRedeem(victimShares), 1_000e18, 2);
        _assertSolvent();
    }

    // 3. deposit -> donate -> withdraw
    function test_Seq_DepositDonateWithdraw() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);
        _fund(attacker, 1_000e18);
        _donate(attacker, 1_000e18);

        uint256 out = _redeemAll(bob);
        console2.log("  first depositor captured the whole donation:", out);
        assertApproxEqAbs(out, 2_000e18, 2);
        _assertSolvent();
    }

    // 4. deposit -> fee accrual (MTAA upkeep) -> withdraw
    function test_Seq_DepositUpkeepWithdraw() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);

        // Upkeep is denominated in MTAA and paid by the vault owner, not by
        // the vault's asset balance: it must not touch depositor accounting.
        mtaa.mint(vaultOwner, 1_000e18);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        uint256 out = _redeemAll(bob);
        assertEq(out, 1_000e18, "upkeep must not dilute depositors");
        _assertSolvent();
    }

    // 5. deposit -> withdraw -> repeat
    function test_Seq_RepeatedDepositWithdraw() public {
        _fund(bob, 1_000e18);
        uint256 start = asset.balanceOf(bob);
        for (uint256 i = 0; i < 50; ++i) {
            _deposit(bob, 100e18);
            _redeemAll(bob);
        }
        assertLe(asset.balanceOf(bob), start);
        assertGe(asset.balanceOf(bob) + 50, start, "repetition must not bleed material value");
        _assertSolvent();
    }

    // 6. small deposit -> large donation -> second deposit
    function test_Seq_SmallDepositLargeDonationSecondDeposit() public {
        _fund(attacker, 1_000_000e18 + 1);
        uint256 start = asset.balanceOf(attacker);
        _deposit(attacker, 1);
        _donate(attacker, 1_000_000e18);

        _fund(victim, 1_000e18);
        uint256 victimShares = _deposit(victim, 1_000e18);
        uint256 out = _redeemAll(attacker);

        _logEconomics("small deposit + large donation + victim deposit", start, 1_000_000e18 + 1, 1000, out, out);
        console2.log("  victim shares    :", victimShares);
        console2.log("  victim redeemable:", vault.previewRedeem(victimShares));
        assertLe(out, start, "no extractable value");
        _assertSolvent();
    }

    // 7. large deposit -> small withdrawal
    function test_Seq_LargeDepositSmallWithdrawal() public {
        _fund(bob, 1_000_000e18);
        uint256 shares = _deposit(bob, 1_000_000e18);
        vm.prank(bob);
        uint256 burned = vault.withdraw(1, bob, bob);
        assertGt(burned, 0, "dust withdrawal must burn shares");
        assertEq(vault.balanceOf(bob), shares - burned);
        _assertSolvent();
    }

    // 8. Interleaved multi-user sequence with donations in between.
    function test_Seq_InterleavedUsersStaySolvent() public {
        _fund(bob, 5_000e18);
        _fund(victim, 5_000e18);
        _fund(attacker, 5_000e18);

        _deposit(bob, 1_000e18);
        _deposit(victim, 500e18);
        _donate(attacker, 250e18);
        _deposit(bob, 1_000e18);
        vm.prank(victim);
        vault.withdraw(100e18, victim, victim);
        _deposit(attacker, 10e18);
        _donate(attacker, 1e18);
        _redeemAll(bob);
        _redeemAll(victim);
        _redeemAll(attacker);

        assertLe(asset.balanceOf(attacker), 5_000e18, "attacker cannot profit from interleaving");
        _assertSolvent();
    }
}
