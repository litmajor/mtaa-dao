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
    // Deposits that round to zero shares must not silently burn assets.
    // ------------------------------------------------------------------
    function test_ZeroShareDepositBurnsAssets() public {
        _fund(attacker, 1);
        _deposit(attacker, 1); // 1000 shares (virtual offset)

        _fund(bob, 1_000_000e18);
        _donate(bob, 1_000_000e18);

        _fund(victim, 1e6);
        uint256 shares = _deposit(victim, 1e6);
        console2.log("  victim shares for 1e6 assets:", shares);
        if (shares == 0) {
            // The vault accepts the assets and mints nothing: a real (if
            // uneconomic to induce) loss for the depositor. No `minShares`
            // parameter and no revert-on-zero-shares guard exists.
            assertEq(asset.balanceOf(victim), 0, "assets were taken");
            assertEq(vault.balanceOf(victim), 0, "no shares minted");
        }
    }

    // ------------------------------------------------------------------
    // Boundary values.
    // ------------------------------------------------------------------
    function test_BoundaryValues() public {
        _fund(attacker, type(uint128).max);

        vm.prank(attacker);
        vault.deposit(0, attacker); // zero deposit must be a no-op, not a revert
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
