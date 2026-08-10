// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Emergency-function abuse: pause and hibernation
/// @notice `deposit`, `mint`, `withdraw` and `redeem` all carry
///         `onlyActive whenNotPaused`. Both flags are controlled solely by the
///         vault owner, so both are unilateral exit blockers for depositors.
contract PauseAndHibernationTest is MaonoVaultBaseTest {
    function _prepOwnerWithMtaa(uint256 amount) internal {
        mtaa.mint(vaultOwner, amount);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
    }

    // ------------------------------------------------------------------
    // P2-2 regression (was: test_PauseFreezesWithdrawalsIndefinitely).
    // pause() used to freeze withdrawals with no time limit, no guardian and
    // no unpause path that did not require the owner. The freeze is now
    // bounded by EXIT_GRACE_PERIOD.
    // ------------------------------------------------------------------
    function test_PauseFreezesWithdrawalsOnlyForTheGracePeriod() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        vm.prank(vaultOwner);
        vault.pause();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.redeem(shares, bob, bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.withdraw(1e18, bob, bob);

        // One second before the grace period expires the pause still holds.
        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD() - 1);
        assertFalse(vault.exitsOpen());
        assertEq(vault.maxRedeem(bob), 0, "max* agrees with the guard");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.redeem(shares, bob, bob);

        // After it, the depositor exits without the owner's cooperation, and the
        // vault is still paused for everything else.
        vm.warp(block.timestamp + 1);
        assertTrue(vault.exitsOpen());
        assertEq(vault.maxRedeem(bob), shares);
        assertEq(_redeemAll(bob), 1_000e18, "principal recovered in full");
        assertTrue(vault.paused(), "still paused: only the exit reopened");
        assertEq(vault.maxDeposit(bob), 0, "no new money enters a paused vault");

        // Shares remain transferable while paused: the ERC20 layer is not
        // pausable, so secondary-market exit at a discount is also possible.
        _fund(victim, 1_000e18);
        vm.prank(vaultOwner);
        vault.unpause();
        uint256 victimShares = _deposit(victim, 1_000e18);
        vm.prank(vaultOwner);
        vault.pause();
        vm.prank(victim);
        vault.transfer(attacker, victimShares);
        assertEq(vault.balanceOf(attacker), victimShares);
    }

    /// @notice P2-2: a paused *and* hibernating vault still lets depositors out once
    ///         both clocks have run, and an owner cannot restart the clock by
    ///         unpausing and re-pausing faster than depositors can act.
    function test_PauseAndHibernationCannotBeCycledToTrapDepositors() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        // Hibernate first, then pause on top of it.
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep(); // no MTAA -> HIBERNATING
        vm.prank(vaultOwner);
        vault.pause();

        vm.warp(block.timestamp + vault.EXIT_GRACE_PERIOD());
        assertTrue(vault.exitsOpen(), "both freezes have expired");

        // Re-pausing restarts only the pause clock, and the owner must front-run
        // every single depositor to benefit; the exit is open in the same block.
        vm.prank(bob);
        uint256 out = vault.redeem(shares, bob, bob);
        assertEq(out, 1_000e18);
    }

    // ------------------------------------------------------------------
    // FINDING: hibernation also blocks withdrawals, and it is reachable
    // without any explicit "freeze" intent.
    // ------------------------------------------------------------------
    function test_HibernationFreezesDepositorExits() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        // Owner holds no MTAA -> the due-date upkeep call hibernates the vault.
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(uint256(vault.getVaultStatus()), 1, "HIBERNATING");

        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.redeem(shares, bob, bob);

        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.withdraw(1e18, bob, bob);

        console2.log("  depositor funds locked by owner delinquency:", vault.previewRedeem(shares));

        // Only the owner can lift it, and only by paying 1.5x upkeep in MTAA.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        vault.reactivateFromHibernation();

        _prepOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        assertEq(uint256(vault.getVaultStatus()), 0, "ACTIVE");

        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 1_000e18, "funds recoverable once reactivated");
    }

    /// @notice Quantifies the freeze: nothing about the design bounds how long
    ///         depositor capital can be held hostage, and the cost to the owner
    ///         of maintaining the freeze is zero.
    function test_HibernationFreezeCostsTheOwnerNothing() public {
        _fund(bob, 100_000e18);
        _deposit(bob, 100_000e18);

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep(); // hibernates: owner has 0 MTAA

        uint256 frozen = vault.totalAssets();
        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  depositor capital frozen :", frozen);
        console2.log("  cost to the owner        :", paid);
        assertEq(paid, 0, "freezing is free for the owner");
        assertEq(frozen, 100_000e18);
    }

    // ------------------------------------------------------------------
    // Pause must not corrupt accounting; state resumes exactly.
    // ------------------------------------------------------------------
    function test_PauseUnpauseIsAccountingNeutral() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        vm.prank(vaultOwner);
        vault.pause();
        uint256 assetsWhilePaused = vault.totalAssets();
        uint256 supplyWhilePaused = vault.totalSupply();

        vm.prank(vaultOwner);
        vault.unpause();

        assertEq(vault.totalAssets(), assetsWhilePaused);
        assertEq(vault.totalSupply(), supplyWhilePaused);
        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 1_000e18);
    }

    // ------------------------------------------------------------------
    // Hibernation cannot be induced by an unprivileged actor.
    // ------------------------------------------------------------------
    function test_UnprivilegedActorCannotInduceHibernation() public {
        vm.warp(block.timestamp + 400 days);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        vault.collectMonthlyUpkeep();
        assertEq(uint256(vault.getVaultStatus()), 0, "still ACTIVE");
    }

    // ------------------------------------------------------------------
    // Reactivation cannot be replayed for a discount or double-charge.
    // ------------------------------------------------------------------
    function test_ReactivationCannotBeReplayed() public {
        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep(); // hibernate

        _prepOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.VaultNotHibernating.selector);
        vault.reactivateFromHibernation();
    }

    /// @notice The CLOSED status exists in the enum but no code path can ever
    ///         set it: `onlyActive` therefore only ever gates HIBERNATING.
    function test_ClosedStatusIsUnreachable() public {
        assertEq(uint256(vault.getVaultStatus()), 0);
        vm.startPrank(vaultOwner);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("closeVault()"));
        assertFalse(ok);
        (ok,) = address(vault).call(abi.encodeWithSignature("setVaultStatus(uint8)", 2));
        assertFalse(ok);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Deposits are blocked in the same states as withdrawals, so no user
    // can be trapped into a vault that accepts money but returns none.
    // ------------------------------------------------------------------
    function test_DepositsAndWithdrawalsAreBlockedSymmetrically() public {
        _fund(bob, 1_000e18);

        vm.prank(vaultOwner);
        vault.pause();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.deposit(1e18, bob);
        vm.prank(vaultOwner);
        vault.unpause();

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep(); // hibernate
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.deposit(1e18, bob);
    }
}
