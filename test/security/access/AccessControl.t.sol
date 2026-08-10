// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Access-control and initialization / upgradeability attacks
contract AccessControlTest is MaonoVaultBaseTest {
    function _expectUnauthorized(address who) internal {
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", who));
    }

    // ------------------------------------------------------------------
    // Every privileged setter must reject unprivileged callers.
    // ------------------------------------------------------------------
    function test_AllAdminSettersAreOwnerGated() public {
        vm.startPrank(attacker);

        _expectUnauthorized(attacker);
        vault.setPriceOracle(attacker);
        _expectUnauthorized(attacker);
        vault.setDaoTreasury(attacker);
        _expectUnauthorized(attacker);
        vault.setOracleCircuitEnabled(false);
        _expectUnauthorized(attacker);
        vault.setOracleBounds(1, 2);
        _expectUnauthorized(attacker);
        vault.setUpkeepCostAt(0, 0);
        _expectUnauthorized(attacker);
        vault.setBurnPercentageAt(0, 0);
        _expectUnauthorized(attacker);
        vault.pause();
        _expectUnauthorized(attacker);
        vault.unpause();
        _expectUnauthorized(attacker);
        vault.collectMonthlyUpkeep();
        _expectUnauthorized(attacker);
        vault.reactivateFromHibernation();
        _expectUnauthorized(attacker);
        vault.transferOwnership(attacker);

        vm.stopPrank();
        assertEq(vault.owner(), vaultOwner);
    }

    // ------------------------------------------------------------------
    // Ownership handover is two-step: a pending owner cannot act early and
    // a wrong address cannot accept.
    // ------------------------------------------------------------------
    function test_TwoStepOwnershipCannotBeHijacked() public {
        vm.prank(vaultOwner);
        vault.transferOwnership(bob);
        assertEq(vault.owner(), vaultOwner, "ownership must not move on proposal");

        vm.prank(attacker);
        vm.expectRevert();
        vault.acceptOwnership();

        vm.prank(bob);
        vault.acceptOwnership();
        assertEq(vault.owner(), bob);
    }

    // ------------------------------------------------------------------
    // Initialization: the clone can only be initialized once, and the bare
    // implementation is permanently locked.
    // ------------------------------------------------------------------
    function test_CloneCannotBeReinitialized() public {
        vm.prank(attacker);
        vm.expectRevert();
        vault.initialize(address(asset), "evil", "evil", attacker, 0, attacker, address(mtaa), address(oracle));
    }

    function test_ImplementationInitializersAreDisabled() public {
        vm.prank(attacker);
        vm.expectRevert();
        implementation.initialize(
            address(asset), "evil", "evil", attacker, 0, attacker, address(mtaa), address(oracle)
        );
        assertEq(implementation.owner(), address(0), "implementation must stay ownerless");
    }

    /// @notice A freshly created clone is unowned until initialize() runs. Any
    ///         address can front-run the factory's initialize() call if the two
    ///         are not atomic. The factory clones and initializes in one
    ///         transaction, so this is only reachable for clones created
    ///         outside the factory.
    function test_UninitializedCloneCanBeSeizedByAnyone() public {
        address freshClone = Clones.clone(address(implementation));

        vm.prank(attacker);
        MaonoVault_Phase1B(freshClone).initialize(
            address(asset), "seized", "SEIZE", attacker, 0, attacker, address(mtaa), address(oracle)
        );

        assertEq(MaonoVault_Phase1B(freshClone).owner(), attacker, "clone seized by first initializer");
        // Documented as a deployment-procedure requirement: clone + initialize
        // must remain atomic (MaonoVaultFactory_Phase1B.deployVault does this).
    }

    // ------------------------------------------------------------------
    // Owner cannot mint shares, move user shares, or drain assets directly.
    // ------------------------------------------------------------------
    function test_OwnerHasNoDirectPathToUserFunds() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);

        // There is no rescue/sweep/emergencyWithdraw entry point in the source
        // implementation: the ABI surface simply does not contain one.
        vm.startPrank(vaultOwner);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("emergencyWithdraw(uint256)", 1_000e18));
        assertFalse(ok, "no emergencyWithdraw in this implementation");
        (ok,) = address(vault).call(abi.encodeWithSignature("sweep(address,uint256)", address(asset), 1_000e18));
        assertFalse(ok, "no sweep function");
        (ok,) = address(vault).call(abi.encodeWithSignature("updateNAV(uint256)", 1e30));
        assertFalse(ok, "no manager-controlled NAV in this implementation");
        vm.stopPrank();

        assertEq(vault.totalAssets(), 1_000e18);
        assertEq(vault.previewRedeem(vault.balanceOf(bob)), 1_000e18);
    }

    // ------------------------------------------------------------------
    // Share allowances: a third party cannot redeem someone else's shares.
    // ------------------------------------------------------------------
    function test_CannotRedeemAnotherUsersSharesWithoutAllowance() public {
        _fund(bob, 1_000e18);
        uint256 shares = _deposit(bob, 1_000e18);

        vm.prank(attacker);
        vm.expectRevert();
        vault.redeem(shares, attacker, bob);

        vm.prank(attacker);
        vm.expectRevert();
        vault.withdraw(1_000e18, attacker, bob);
    }

    // ------------------------------------------------------------------
    // Storage layout: the custom ReentrancyGuardUpgradeable uses a plain
    // slot while OZ v5 uses ERC-7201 namespaces. Confirm no collision with
    // the vault's own first storage variable.
    // ------------------------------------------------------------------
    function test_ReentrancyGuardSlotDoesNotCollideWithVaultState() public {
        _fund(bob, 10e18);
        _deposit(bob, 10e18); // exercises nonReentrant, writing the guard slot

        // vaultType (first declared vault variable) must still read back as
        // SAVINGS(0) and the guard must be released.
        assertEq(uint256(vault.vaultType()), 0);
        _redeemAll(bob);
        assertEq(vault.totalSupply(), 0);
    }
}
