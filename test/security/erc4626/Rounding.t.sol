// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @title  Rounding, precision and decimal-mismatch attacks
/// @notice Attempts to accumulate rounding error into extractable value.
contract RoundingTest is MaonoVaultBaseTest {
    // ------------------------------------------------------------------
    // Rounding direction must always favour the vault, never the caller.
    // ------------------------------------------------------------------
    function testFuzz_PreviewRoundingDirection(uint96 seedDeposit, uint96 donation, uint96 amount) public {
        seedDeposit = uint96(bound(seedDeposit, 1e6, 1e24));
        donation = uint96(bound(donation, 0, 1e24));
        amount = uint96(bound(amount, 1, 1e24));

        _fund(bob, uint256(seedDeposit) + uint256(donation));
        _deposit(bob, seedDeposit);
        if (donation > 0) _donate(bob, donation);

        // previewDeposit rounds shares DOWN, previewMint rounds assets UP.
        assertLe(vault.previewDeposit(amount), vault.convertToShares(amount), "previewDeposit must round down");
        assertGe(vault.previewMint(amount), vault.convertToAssets(amount), "previewMint must round up");
        // previewWithdraw rounds shares UP, previewRedeem rounds assets DOWN.
        assertGe(vault.previewWithdraw(amount), vault.convertToShares(amount), "previewWithdraw must round up");
        assertLe(vault.previewRedeem(amount), vault.convertToAssets(amount), "previewRedeem must round down");
    }

    // ------------------------------------------------------------------
    // A single deposit/withdraw round trip must never return more than
    // it put in.
    // ------------------------------------------------------------------
    function testFuzz_RoundTripNeverProfits(uint96 seedDeposit, uint96 donation, uint96 amount) public {
        seedDeposit = uint96(bound(seedDeposit, 1e6, 1e24));
        donation = uint96(bound(donation, 0, 1e24));
        amount = uint96(bound(amount, 1, 1e21));

        _fund(bob, uint256(seedDeposit) + uint256(donation));
        _deposit(bob, seedDeposit);
        if (donation > 0) _donate(bob, donation);

        _fund(attacker, amount);
        uint256 before = asset.balanceOf(attacker);
        if (vault.previewDeposit(amount) == 0) {
            // P2-3: a deposit that would mint nothing is rejected outright.
            vm.prank(attacker);
            vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
            vault.deposit(amount, attacker);
            assertEq(asset.balanceOf(attacker), before, "rejected deposit keeps the assets with the depositor");
            return;
        }
        _deposit(attacker, amount);
        _redeemAll(attacker);
        assertLe(asset.balanceOf(attacker), before, "round trip must not create value");
    }

    // ------------------------------------------------------------------
    // Repeated tiny round trips: does dust accumulate in the attacker's
    // favour (rounding-error farming)?
    // ------------------------------------------------------------------
    function test_RepeatedDustRoundTrips_DoNotFarmValue() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);
        _fund(bob, 999e18);
        _donate(bob, 999e18); // non-integral share price

        _fund(attacker, 1_000e18);
        uint256 start = asset.balanceOf(attacker);

        for (uint256 i = 0; i < 200; ++i) {
            _deposit(attacker, 1e12);
            _redeemAll(attacker);
        }

        uint256 ending = asset.balanceOf(attacker);
        _logEconomics("200x dust round trips", start, 200 * 1e12, 0, 0, ending);
        assertLe(ending, start, "no rounding-error farming");
    }

    // ------------------------------------------------------------------
    // Mint 1 wei of shares repeatedly: the classic "pay 0 assets for
    // non-zero shares" bug.
    // ------------------------------------------------------------------
    function test_MintOneShareAlwaysCostsAtLeastOneAsset() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);
        _fund(bob, 5_000e18);
        _donate(bob, 5_000e18); // share price 6x

        _fund(attacker, 1_000e18);
        uint256 start = asset.balanceOf(attacker);
        for (uint256 i = 0; i < 100; ++i) {
            vm.prank(attacker);
            uint256 paid = vault.mint(1, attacker);
            assertGt(paid, 0, "one share must never be free");
        }
        uint256 spent = start - asset.balanceOf(attacker);
        uint256 recovered = _redeemAll(attacker);
        console2.log("  spent on 100 single shares:", spent);
        console2.log("  recovered                 :", recovered);
        assertLe(recovered, spent, "share minting must not be underpriced");
    }

    // ------------------------------------------------------------------
    // P2-3 regression: deposits that round to zero shares used to be accepted,
    // taking the assets and minting nothing. They must now revert.
    // ------------------------------------------------------------------
    function test_ZeroShareDepositBurnsAssets() public {
        _fund(attacker, 1);
        _deposit(attacker, 1); // 1000 shares (virtual offset)

        _fund(bob, 1_000_000e18);
        _donate(bob, 1_000_000e18);

        _fund(victim, 1e6);
        assertEq(vault.previewDeposit(1e6), 0, "scenario must round to zero shares");

        uint256 victimAssetsBefore = asset.balanceOf(victim);
        uint256 vaultAssetsBefore = vault.totalAssets();

        vm.prank(victim);
        vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
        vault.deposit(1e6, victim);

        assertEq(asset.balanceOf(victim), victimAssetsBefore, "no assets taken");
        assertEq(vault.balanceOf(victim), 0, "no shares minted");
        assertEq(vault.totalAssets(), vaultAssetsBefore, "vault gained nothing");
    }

    /// @notice P2-3: mint(0) is likewise rejected instead of being a free no-op.
    function test_ZeroShareMintReverts() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);

        _fund(attacker, 1e18);
        vm.prank(attacker);
        vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
        vault.mint(0, attacker);
    }

    /// @notice P2-3: the smallest deposit that does mint a share still works, so the
    ///         guard rejects only economically empty deposits.
    function test_SmallestNonZeroShareDepositSucceeds() public {
        _fund(attacker, 1);
        _deposit(attacker, 1);
        _fund(bob, 1_000_000e18);
        _donate(bob, 1_000_000e18);

        uint256 amount = 1e6;
        while (vault.previewDeposit(amount) == 0) {
            amount *= 2;
        }

        _fund(victim, amount);
        uint256 preview = vault.previewDeposit(amount);
        uint256 shares = _deposit(victim, amount);
        assertEq(shares, preview, "preview and execution agree at the boundary");
        assertGt(shares, 0, "one-share deposit is still allowed");
    }

    // ------------------------------------------------------------------
    // Boundary values.
    // ------------------------------------------------------------------
    function test_BoundaryValues() public {
        _fund(attacker, type(uint128).max);

        // P2-3: a zero deposit mints nothing, so it is rejected rather than accepted.
        vm.prank(attacker);
        vm.expectRevert(MaonoVault_Phase1B.ZeroShares.selector);
        vault.deposit(0, attacker);
        assertEq(vault.balanceOf(attacker), 0);

        // Extremely large deposit: no overflow, conversions stay consistent.
        uint256 huge = uint256(type(uint128).max);
        vm.prank(attacker);
        uint256 shares = vault.deposit(huge, attacker);
        assertGt(shares, 0);
        assertApproxEqAbs(vault.previewRedeem(shares), huge, 1);

        // Withdrawing more than owned must revert.
        vm.prank(attacker);
        vm.expectRevert();
        vault.withdraw(huge + 1, attacker, attacker);
    }

    // ------------------------------------------------------------------
    // Decimal mismatch: 6-decimal asset with a 3-decimal offset.
    // ------------------------------------------------------------------
    function test_SixDecimalAssetConversionsAreConsistent() public {
        _deployVault(6, 0);
        _fund(bob, 1_000e6);
        uint256 shares = _deposit(bob, 1_000e6);
        assertEq(vault.decimals(), 9);
        assertEq(shares, 1_000e6 * 1000);
        assertApproxEqAbs(vault.previewRedeem(shares), 1_000e6, 1);
    }
}
