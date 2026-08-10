// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Phase2Base.sol";

/// @title  Temporal assumptions (Phase 2, Step 8)
/// @notice The only time-dependent logic in the canonical vault is the upkeep
///         clock (`lastUpkeepPayment + 30 days`) and the hibernation counter.
///         Share accounting is entirely time-independent. These tests probe the
///         boundaries: same block, exact due date, one second early, enormous
///         warps, and repeated calls at every one of those points.
contract TemporalAssumptionsTest is Phase2Base {
    function setUp() public override {
        super.setUp();
        _fund(bob, 1_000_000e18);
        _fundOwnerWithMtaa(1_000_000e18);
        _resetLedger();
    }

    // ------------------------------------------------------------------
    // Share accounting has no temporal dimension at all
    // ------------------------------------------------------------------
    function test_SharePriceIsTimeIndependent() public {
        _depositTracked(bob, 10_000e18);
        uint256 price = vault.convertToAssets(1e21);

        vm.warp(block.timestamp + 100 * 365 days);
        assertEq(vault.convertToAssets(1e21), price, "a century changed nothing");

        vm.roll(block.number + 1_000_000);
        assertEq(vault.convertToAssets(1e21), price);
        _assertConservation("time-independent price");
    }

    /// @notice Many operations inside a single block are indistinguishable from
    ///         the same operations spread over time: no per-block accumulator
    ///         exists that could be farmed.
    function test_SameBlockOperationsAreNotSpecial() public {
        _depositTracked(bob, 1_000e18);
        uint256 start = asset.balanceOf(attacker);
        _fund(attacker, 100_000e18);
        start = asset.balanceOf(attacker);

        for (uint256 i = 0; i < 25; ++i) {
            _depositTracked(attacker, 1_000e18);
            _redeemAllTracked(attacker);
        }
        assertLe(asset.balanceOf(attacker), start, "same-block cycling created value");
        _assertConservation("same-block cycling");
    }

    // ------------------------------------------------------------------
    // The upkeep clock
    // ------------------------------------------------------------------
    function test_UpkeepBoundaryIsExactlyThirtyDays() public {
        uint256 due = vault.getUpkeepDueDate();

        vm.warp(due - 1);
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.UpkeepNotDue.selector);
        vault.collectMonthlyUpkeep();

        vm.warp(due);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(vault.getUpkeepDueDate(), due + 30 days, "clock advances from payment time, not due time");
    }

    /// @notice Repeated calls in the same block after a payment are rejected,
    ///         so the fee cannot be double-charged or the clock double-advanced.
    function test_UpkeepCannotBeRepeatedInTheSameBlock() public {
        vm.warp(vault.getUpkeepDueDate());
        vm.startPrank(vaultOwner);
        vault.collectMonthlyUpkeep();
        vm.expectRevert(MaonoVault_Phase1B.UpkeepNotDue.selector);
        vault.collectMonthlyUpkeep();
        vm.stopPrank();
    }

    /// @notice The clock drifts forward with every late payment ("payment time,
    ///         not due time"), so a year of late payments yields fewer than
    ///         twelve chargeable periods even when the owner is co-operative.
    function test_LatePaymentsDriftTheBillingPeriod() public {
        uint256 startTime = block.timestamp;
        uint256 collections;
        while (block.timestamp < startTime + 365 days) {
            vm.warp(block.timestamp + 45 days); // owner pays every 45 days
            vm.prank(vaultOwner);
            vault.collectMonthlyUpkeep();
            ++collections;
        }
        assertLt(collections, 12, "fewer chargeable periods than months elapsed");
        console2.log("  collections in one year:", collections);
    }

    /// @notice P2-4 regression (was: test_UpkeepPaidWhileHibernatingDoesNotReactivate).
    ///         `collectMonthlyUpkeep()` had no `onlyActive` guard, so it charged while
    ///         the vault was HIBERNATING without lifting hibernation: the owner paid,
    ///         depositors stayed frozen and reactivation was still owed on top. The
    ///         call now reverts, leaving reactivation as the single paid way out.
    function test_UpkeepIsRejectedWhileHibernating() public {
        _depositTracked(bob, 10_000e18);

        // Hibernate with an empty MTAA balance.
        uint256 ownerMtaa = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        mtaa.transfer(address(0xDEAD), ownerMtaa);
        _hibernate();
        assertEq(_status(), 1, "HIBERNATING");

        // The owner tops up and tries to pay the ordinary monthly upkeep.
        _fundOwnerWithMtaa(1_000e18);
        uint256 before = mtaa.balanceOf(vaultOwner);
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.collectMonthlyUpkeep();

        // Repeating it, including twice in the same block, changes nothing.
        vm.startPrank(vaultOwner);
        for (uint256 i = 0; i < 3; ++i) {
            vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
            vault.collectMonthlyUpkeep();
        }
        vm.stopPrank();

        assertEq(mtaa.balanceOf(vaultOwner), before, "no MTAA taken while hibernating");
        assertEq(_status(), 1, "still HIBERNATING");
        (,, uint256 paidWhileFrozen,,) = vault.getVaultMetrics();
        assertEq(paidWhileFrozen, 0, "nothing booked as paid");

        // Reactivation is the only paid transition, and it does transition.
        uint256 expected = vault.getReactivationCost();
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        uint256 reactivationPaid = before - mtaa.balanceOf(vaultOwner);
        assertEq(reactivationPaid, expected);
        assertEq(_status(), 0, "ACTIVE again");

        // ...and ordinary upkeep works again once ACTIVE.
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(_status(), 0);

        console2.log("---- economics: upkeep while hibernating");
        console2.log("  monthly fee taken while frozen:", uint256(0));
        console2.log("  reactivation charged          :", reactivationPaid);
    }

    // ------------------------------------------------------------------
    // Extreme timestamps
    // ------------------------------------------------------------------
    function test_ExtremeTimestampsDoNotOverflowTheClock() public {
        vm.warp(type(uint64).max - 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(vault.getUpkeepDueDate(), block.timestamp + 30 days);

        _depositTracked(bob, 1_000e18);
        _assertConservation("extreme timestamp");
    }

    function test_HibernationCounterHandlesLongFreezes() public {
        uint256 ownerMtaa = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        mtaa.transfer(address(0xDEAD), ownerMtaa);
        _hibernate();

        vm.warp(block.timestamp + 100 * 365 days);
        assertEq(vault.getMonthsSinceHibernation(), uint256(100 * 365 days) / uint256(30 days));

        // The counter is informational only: nothing in the contract reacts to
        // it, so no threshold can be crossed by waiting.
        assertEq(_status(), 1, "no automatic transition on any horizon");
    }

    /// @notice A status transition immediately before and after a user call
    ///         cannot be used to reprice that call: the guards reject the call
    ///         outright rather than executing it at a different price.
    function test_CallsImmediatelyAroundAStatusTransitionAreRejectedNotRepriced() public {
        uint256 shares = _depositTracked(bob, 10_000e18);
        uint256 quoted = vault.previewRedeem(shares);

        vm.prank(vaultOwner);
        vault.pause();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.redeem(shares, bob, bob);

        vm.prank(vaultOwner);
        vault.unpause();
        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), quoted, "same price on both sides of the pause");
        ledger.withdrawn += quoted;
        _assertConservation("transition-adjacent call");
    }
}
