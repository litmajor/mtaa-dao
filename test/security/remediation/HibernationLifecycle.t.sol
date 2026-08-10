// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  P2-2 — hibernation is no longer a cheap indefinite freeze
/// @notice Before the remediation, hibernating cost the owner nothing, lasted as long
///         as the owner liked, froze every depositor for the whole of it, and was
///         cleared by a flat 1.5x *one* month fee. Two changes make it coherent:
///
///           * `getReactivationCost()` charges 1.5x per hibernated month, capped at
///             `MAX_CATCHUP_MONTHS`, so the freeze accrues a real liability;
///           * `EXIT_GRACE_PERIOD` bounds the freeze from the depositor's side, so
///             withdrawals resume with or without the owner.
///
///         This suite walks the duration matrix (immediate / short / long / extreme),
///         depositor escape, reactivation, repeated cycles and the pause interaction.
contract HibernationLifecycleTest is MaonoVaultBaseTest {
    uint256 internal constant SAVINGS = 0;

    function setUp() public override {
        super.setUp();
        _fund(bob, 1_000_000e18);
    }

    function _fundOwnerWithMtaa(uint256 amount) internal {
        mtaa.mint(vaultOwner, amount);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
    }

    /// @dev Drives the vault into HIBERNATING through the ordinary delinquency path.
    function _hibernate() internal {
        uint256 held = mtaa.balanceOf(vaultOwner);
        if (held > 0) {
            vm.prank(vaultOwner);
            mtaa.transfer(address(0xDEAD), held);
        }
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(uint256(vault.getVaultStatus()), 1, "expected HIBERNATING");
    }

    // ------------------------------------------------------------------
    // Duration matrix: the bill scales with the freeze
    // ------------------------------------------------------------------
    function test_ReactivationCostScalesWithHibernationDuration() public {
        uint256 monthly = vault.getMonthlyUpkeepCost();
        _hibernate();

        // Immediate: the month in progress is charged, never zero.
        assertEq(vault.hibernationMonthsCharged(), 1, "immediate reactivation still owes a month");
        assertEq(vault.getReactivationCost(), (monthly * 150) / 100);

        // Short: one extra month elapsed.
        vm.warp(block.timestamp + 31 days);
        assertEq(vault.hibernationMonthsCharged(), 2);
        assertEq(vault.getReactivationCost(), (monthly * 150) / 100 * 2);

        // Long: a full year of freeze costs a full year of catch-up.
        vm.warp(block.timestamp + 334 days);
        assertEq(vault.hibernationMonthsCharged(), 12);
        assertEq(vault.getReactivationCost(), (monthly * 150) / 100 * 12);
        assertGt(vault.getReactivationCost(), monthly * 12, "freezing costs more than complying");

        // Extreme: the catch-up is capped so a decade-old vault stays revivable
        // rather than becoming permanently unaffordable (which would strand the
        // depositors the cap is there to protect).
        vm.warp(block.timestamp + 3650 days);
        assertEq(vault.hibernationMonthsCharged(), vault.MAX_CATCHUP_MONTHS());
        assertEq(vault.getReactivationCost(), (monthly * 150) / 100 * vault.MAX_CATCHUP_MONTHS());
    }

    /// @notice The quoted cost is exactly what reactivation charges, at every duration.
    function test_QuotedReactivationCostIsWhatIsCharged() public {
        uint256[4] memory waits = [uint256(0), 31 days, 200 days, 3650 days];
        for (uint256 i = 0; i < waits.length; ++i) {
            _deployVault(18, uint8(SAVINGS));
            _hibernate();
            vm.warp(block.timestamp + waits[i]);

            _fundOwnerWithMtaa(100_000e18);
            uint256 quoted = vault.getReactivationCost();
            uint256 before = mtaa.balanceOf(vaultOwner);
            vm.prank(vaultOwner);
            vault.reactivateFromHibernation();

            assertEq(before - mtaa.balanceOf(vaultOwner), quoted, "quote != charge");
            assertGt(quoted, 0, "reactivation is never free");
            assertEq(uint256(vault.getVaultStatus()), 0, "ACTIVE after paying");
        }
    }

    /// @notice An owner who cannot pay the accrued catch-up simply cannot reactivate;
    ///         the vault does not fall back to a cheaper price.
    function test_UnderfundedOwnerCannotReactivateCheaply() public {
        _hibernate();
        vm.warp(block.timestamp + 365 days);

        uint256 due = vault.getReactivationCost();
        _fundOwnerWithMtaa(due - 1);
        vm.prank(vaultOwner);
        vm.expectRevert();
        vault.reactivateFromHibernation();
        assertEq(uint256(vault.getVaultStatus()), 1, "still HIBERNATING");

        _fundOwnerWithMtaa(1);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        assertEq(uint256(vault.getVaultStatus()), 0);
    }

    // ------------------------------------------------------------------
    // Depositor escape
    // ------------------------------------------------------------------
    function test_DepositorsEscapeAfterTheGracePeriodWithoutTheOwner() public {
        uint256 shares = _deposit(bob, 100_000e18);
        _hibernate();

        assertFalse(vault.exitsOpen());
        assertEq(vault.maxRedeem(bob), 0);
        assertEq(vault.maxWithdraw(bob), 0);
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.redeem(shares, bob, bob);

        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD());

        assertTrue(vault.exitsOpen());
        assertEq(vault.maxRedeem(bob), shares);
        vm.prank(bob);
        uint256 out = vault.redeem(shares, bob, bob);
        assertEq(out, 100_000e18, "principal recovered in full");
        assertEq(uint256(vault.getVaultStatus()), 1, "only the exit reopened; the vault is still frozen");
        assertEq(vault.totalAssets(), asset.balanceOf(address(vault)), "accounting intact");
    }

    /// @notice Deposits stay closed for the entire hibernation: the escape hatch is
    ///         one-way, so nobody can be lured into a frozen vault.
    function test_DepositsStayClosedEvenAfterExitsReopen() public {
        _hibernate();
        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD() + 365 days);

        assertEq(vault.maxDeposit(bob), 0);
        assertEq(vault.maxMint(bob), 0);
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.deposit(1e18, bob);
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.mint(1e18, bob);
    }

    // ------------------------------------------------------------------
    // Repeated cycles
    // ------------------------------------------------------------------
    /// @notice Re-hibernating restarts the exit clock, so an owner could in principle
    ///         keep re-freezing — but each cycle requires paying the catch-up to leave
    ///         hibernation first, so the freeze is never free and never unbounded in
    ///         cost. Six cycles are measured against six months of honest upkeep.
    function test_RepeatedHibernationCyclesCostMoreThanComplying() public {
        uint256 monthly = vault.getMonthlyUpkeepCost();
        _deposit(bob, 10_000e18);

        _fundOwnerWithMtaa(1_000_000e18);
        uint256 start = mtaa.balanceOf(vaultOwner);

        for (uint256 i = 0; i < 6; ++i) {
            // Skip a payment: the vault hibernates only if the owner is insolvent,
            // so the owner deliberately empties itself, freezes, then re-funds.
            uint256 held = mtaa.balanceOf(vaultOwner);
            vm.prank(vaultOwner);
            mtaa.transfer(address(0xDEAD), held);
            vm.warp(block.timestamp + 31 days);
            vm.prank(vaultOwner);
            vault.collectMonthlyUpkeep();
            assertEq(uint256(vault.getVaultStatus()), 1);

            mtaa.mint(vaultOwner, held); // the parked balance comes back
            vm.prank(vaultOwner);
            vault.reactivateFromHibernation();
            assertEq(uint256(vault.getVaultStatus()), 0);
        }

        uint256 spent = start - mtaa.balanceOf(vaultOwner);
        assertEq(spent, (monthly * 150) / 100 * 6, "each cycle pays a 1.5x month");
        assertGt(spent, monthly * 6, "cycling is dearer than paying on time");

        // Depositor value survived every cycle.
        assertEq(_redeemAll(bob), 10_000e18);
    }

    // ------------------------------------------------------------------
    // Pause interaction
    // ------------------------------------------------------------------
    function test_PauseOnTopOfHibernationDoesNotExtendTheFreeze() public {
        uint256 shares = _deposit(bob, 10_000e18);
        _hibernate();

        // Owner pauses immediately after hibernating; both clocks run together.
        vm.prank(vaultOwner);
        vault.pause();
        assertFalse(vault.exitsOpen());

        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD());
        assertTrue(vault.exitsOpen(), "the two freezes do not stack");

        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 10_000e18);
    }

    /// @notice Reactivating clears the hibernation freeze outright, without waiting
    ///         for the grace period.
    function test_ReactivationReopensExitsImmediately() public {
        uint256 shares = _deposit(bob, 10_000e18);
        _hibernate();
        assertFalse(vault.exitsOpen());

        _fundOwnerWithMtaa(100_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();

        assertTrue(vault.exitsOpen());
        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 10_000e18);
    }
}
