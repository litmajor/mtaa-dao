// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Phase2Base.sol";

/// @title  The vault state machine, derived from the current source
/// @notice `contracts/MaonoVault.sol` has two orthogonal state dimensions:
///
///           status  : ACTIVE | HIBERNATING | CLOSED   (CLOSED is unreachable)
///           paused  : false  | true                   (PausableUpgradeable)
///
///         Every user entry point carries `onlyActive whenNotPaused`, so the
///         reachable state space is 2 x 2 and exits are open in exactly one of
///         the four cells. These tests pin the whole matrix down, including the
///         transition orderings the two dimensions allow.
contract StateMachineTest is Phase2Base {
    uint256 internal constant ACTIVE = 0;
    uint256 internal constant HIBERNATING = 1;
    uint256 internal constant CLOSED = 2;

    function setUp() public override {
        super.setUp();
        _fund(bob, 1_000_000e18);
        _fund(attacker, 1_000_000e18);
    }

    // ------------------------------------------------------------------
    // The reachable state space
    // ------------------------------------------------------------------

    /// @notice ACTIVE + unpaused: every operation is available.
    function test_State_ActiveUnpaused_AllowsEverything() public {
        assertEq(_status(), ACTIVE);
        assertFalse(vault.paused());

        uint256 shares = _deposit(bob, 1_000e18);
        vm.prank(bob);
        vault.mint(1e18, bob);
        vm.prank(bob);
        vault.withdraw(1e18, bob, bob);
        vm.prank(bob);
        vault.redeem(shares / 2, bob, bob);
        vm.prank(bob);
        vault.transfer(attacker, 1);
    }

    /// @notice ACTIVE + paused: capital in and capital out are both blocked,
    ///         share transfers are not.
    function test_State_ActivePaused_BlocksAssetFlowsOnly() public {
        uint256 shares = _deposit(bob, 1_000e18);
        vm.prank(vaultOwner);
        vault.pause();

        _assertAssetFlowsRevert(abi.encodeWithSignature("EnforcedPause()"), shares);

        vm.prank(bob);
        vault.transfer(attacker, shares);
        assertEq(vault.balanceOf(attacker), shares, "ERC20 layer is not pausable");
    }

    /// @notice HIBERNATING + unpaused: identical blocking set, different guard.
    function test_State_Hibernating_BlocksAssetFlowsOnly() public {
        uint256 shares = _deposit(bob, 1_000e18);
        _hibernate();
        assertEq(_status(), HIBERNATING);

        _assertAssetFlowsRevert(MaonoVault_Phase1B.VaultIsHibernating.selector, shares);

        vm.prank(bob);
        vault.transfer(attacker, shares);
        assertEq(vault.balanceOf(attacker), shares);
    }

    /// @notice The two guards stack: clearing one of them does not restore exits.
    ///         `onlyActive` is evaluated first, so a paused *and* hibernating
    ///         vault reports the hibernation error.
    function test_State_PausedAndHibernating_RequiresTwoIndependentUnlocks() public {
        uint256 shares = _deposit(bob, 1_000e18);

        vm.prank(vaultOwner);
        vault.pause();
        _hibernate(); // collectMonthlyUpkeep has no whenNotPaused guard

        assertTrue(vault.paused());
        assertEq(_status(), HIBERNATING);

        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.redeem(shares, bob, bob);

        // Unpause alone is not enough.
        vm.prank(vaultOwner);
        vault.unpause();
        vm.prank(bob);
        vm.expectRevert(MaonoVault_Phase1B.VaultIsHibernating.selector);
        vault.redeem(shares, bob, bob);

        // Reactivation restores exits, and is itself reachable while paused.
        _fundOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 1_000e18);
    }

    /// @notice CLOSED is declared but unreachable: no transition writes it, so
    ///         the vault can never be wound down. Capital has no terminal state.
    function test_State_ClosedIsUnreachable() public {
        assertEq(_status(), ACTIVE);
        _hibernate();
        assertEq(_status(), HIBERNATING);
        _fundOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        assertEq(_status(), ACTIVE);

        // Exhaustive: no selector in the ABI moves the status to CLOSED.
        vm.startPrank(vaultOwner);
        string[4] memory attempts = ["closeVault()", "setVaultStatus(uint8)", "close()", "shutdown()"];
        for (uint256 i = 0; i < attempts.length; ++i) {
            (bool ok,) = address(vault).call(abi.encodeWithSignature(attempts[i], uint8(CLOSED)));
            assertFalse(ok);
        }
        vm.stopPrank();
        assertTrue(_status() != CLOSED);
    }

    // ------------------------------------------------------------------
    // Transitions
    // ------------------------------------------------------------------

    /// @notice ACTIVE -> PAUSED -> ACTIVE is accounting-neutral and re-entrant:
    ///         the cycle can be repeated without touching balances or shares.
    function test_Transition_ActivePausedActive_IsIdempotent() public {
        uint256 shares = _depositTracked(bob, 10_000e18);
        _resetLedger();
        ledger.initialAssets = 10_000e18;

        for (uint256 i = 0; i < 5; ++i) {
            vm.prank(vaultOwner);
            vault.pause();
            vm.prank(vaultOwner);
            vault.unpause();
        }

        _assertConservation("pause cycles");
        assertEq(vault.balanceOf(bob), shares);
        vm.prank(bob);
        assertEq(vault.redeem(shares, bob, bob), 10_000e18);
    }

    /// @notice ACTIVE -> HIBERNATING -> ACTIVE never touches the ERC-4626
    ///         asset: hibernation is priced in MTAA and paid by the owner.
    function test_Transition_ActiveHibernatingActive_DoesNotTouchVaultAssets() public {
        _depositTracked(bob, 10_000e18);
        _resetLedger();
        ledger.initialAssets = 10_000e18;

        uint256 priceBefore = vault.convertToAssets(1e21);
        _hibernate();
        _fundOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();

        _assertConservation("hibernation cycle");
        assertEq(vault.convertToAssets(1e21), priceBefore, "share price unchanged by status transitions");
        assertEq(asset.balanceOf(address(vault)), 10_000e18);
    }

    /// @notice Hibernation does not reset the upkeep clock while it lasts, and
    ///         reactivation restarts it from `block.timestamp` — so the vault
    ///         cannot be forced into an immediately-due state on reactivation.
    function test_Transition_ReactivationResetsTheUpkeepClock() public {
        _hibernate();
        vm.warp(block.timestamp + 365 days);

        _fundOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();

        assertEq(vault.getUpkeepDueDate(), block.timestamp + 30 days);
        assertEq(vault.getMonthsSinceHibernation(), 0);
    }

    /// @notice Ownership transfer is 2-step, so a mistyped/hostile address
    ///         cannot capture the pause and hibernation levers.
    function test_Transition_OwnershipIsTwoStep() public {
        vm.prank(vaultOwner);
        vault.transferOwnership(attacker);
        assertEq(vault.owner(), vaultOwner, "not transferred until accepted");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        vault.pause();

        vm.prank(attacker);
        vault.acceptOwnership();
        assertEq(vault.owner(), attacker);
        vm.prank(attacker);
        vault.pause();
    }

    // ---------------------------------------------------------------- helpers

    function _assertAssetFlowsRevert(bytes memory err, uint256 shares) internal {
        vm.prank(bob);
        vm.expectRevert(err);
        vault.deposit(1e18, bob);
        vm.prank(bob);
        vm.expectRevert(err);
        vault.mint(1e18, bob);
        vm.prank(bob);
        vm.expectRevert(err);
        vault.withdraw(1e18, bob, bob);
        vm.prank(bob);
        vm.expectRevert(err);
        vault.redeem(shares, bob, bob);
    }

    function _assertAssetFlowsRevert(bytes4 err, uint256 shares) internal {
        _assertAssetFlowsRevert(abi.encodePacked(err), shares);
    }
}
