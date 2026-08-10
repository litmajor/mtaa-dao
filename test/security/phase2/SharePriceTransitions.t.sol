// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Phase2Base.sol";

/// @title  Share/asset price transitions (Phase 2, Step 9)
/// @notice Tracks `assets/shares` across every operation class and checks that
///         the four preview functions never disagree in a direction that can be
///         monetised. Rounding differences are expected; the question is
///         whether ordering or repetition turns them into profit.
contract SharePriceTransitionsTest is Phase2Base {
    uint256 internal constant ONE_SHARE = 1e21; // 18-decimal asset + offset 3

    function setUp() public override {
        super.setUp();
        _fund(bob, 1_000_000e18);
        _fund(carol, 1_000_000e18);
        _fund(attacker, 1_000_000e18);
        _fund(victim, 1_000_000e18);
        _fundOwnerWithMtaa(1_000_000e18);
        _resetLedger();
    }

    function _price() internal view returns (uint256) {
        return vault.convertToAssets(ONE_SHARE);
    }

    // ------------------------------------------------------------------
    // Which operations may move the price, and in which direction
    // ------------------------------------------------------------------
    function test_PriceMovesOnlyOnDonations() public {
        _depositTracked(bob, 10_000e18);
        uint256 p0 = _price();

        _depositTracked(carol, 5_000e18);
        assertEq(_price(), p0, "deposit is price-neutral");

        _withdrawTracked(carol, 1_000e18);
        assertEq(_price(), p0, "withdraw is price-neutral");

        vm.prank(bob);
        vault.transfer(carol, 1e21);
        assertEq(_price(), p0, "share transfer is price-neutral");

        _upkeep();
        assertEq(_price(), p0, "MTAA upkeep is price-neutral");

        vm.prank(vaultOwner);
        vault.pause();
        assertEq(_price(), p0, "pause is price-neutral");
        vm.prank(vaultOwner);
        vault.unpause();

        _donateTracked(attacker, 1_000e18);
        assertGt(_price(), p0, "donations are the only upward move");

        _assertConservation("price transitions");
    }

    /// @notice Under user operations alone the price per share never decreases:
    ///         rounding is always resolved in the vault's favour.
    function testFuzz_PriceNeverDecreasesUnderUserOperations(uint96 a, uint96 b, uint96 c) public {
        _depositTracked(bob, bound(uint256(a), 1e12, 100_000e18));
        uint256 p0 = _price();

        _depositTracked(carol, bound(uint256(b), 1e12, 100_000e18));
        assertGe(_price(), p0);

        uint256 out = bound(uint256(c), 1, vault.maxWithdraw(carol));
        _withdrawTracked(carol, out);
        assertGe(_price(), p0, "withdrawal lowered the price");

        _redeemAllTracked(bob);
        assertGe(_price(), p0, "redeem lowered the price");
        _assertConservation("price monotonicity");
    }

    // ------------------------------------------------------------------
    // Preview coherence
    // ------------------------------------------------------------------
    /// @notice The four previews must agree with execution and with each other
    ///         in the conservative direction, at an arbitrary (donated) price.
    function testFuzz_PreviewsAreCoherentAtAnyPrice(uint96 seed, uint96 donation, uint96 amount) public {
        _depositTracked(bob, bound(uint256(seed), 1e15, 100_000e18));
        _donateTracked(attacker, bound(uint256(donation), 0, 100_000e18));

        uint256 amt = bound(uint256(amount), 1e6, 50_000e18);

        uint256 shares = vault.previewDeposit(amt);
        // deposit() rounds shares down, so re-quoting those shares through mint()
        // must never ask for *more* assets than the original amount.
        assertLe(vault.previewMint(shares), amt, "previewMint overcharges the round trip");
        if (shares > 0) {
            assertLe(vault.previewRedeem(shares), amt, "round trip must not pay out more");
        }

        uint256 sharesForWithdraw = vault.previewWithdraw(amt);
        assertGe(vault.convertToShares(amt), 0);
        assertGe(sharesForWithdraw, vault.convertToShares(amt), "previewWithdraw must not undercharge shares");

        // ...and execution matches the quote exactly.
        vm.prank(carol);
        uint256 executed = vault.deposit(amt, carol);
        ledger.deposited += amt;
        assertEq(executed, shares, "previewDeposit != deposit");
        _assertConservation("preview coherence");
    }

    /// @notice Round trips at every price point: deposit-then-redeem and
    ///         mint-then-withdraw both return at most what went in.
    function testFuzz_RoundTripsAreNeverProfitable(uint96 donation, uint96 amount) public {
        _depositTracked(bob, 10_000e18);
        _donateTracked(attacker, bound(uint256(donation), 0, 500_000e18));

        uint256 amt = bound(uint256(amount), 1e9, 100_000e18);
        uint256 start = asset.balanceOf(carol);

        _depositTracked(carol, amt);
        _redeemAllTracked(carol);
        assertLe(asset.balanceOf(carol), start, "deposit/redeem round trip profited");

        uint256 shares = vault.previewDeposit(amt);
        if (shares > 0) {
            vm.prank(carol);
            uint256 paid = vault.mint(shares, carol);
            ledger.deposited += paid;
            uint256 got = _redeemAllTracked(carol);
            assertLe(got, paid, "mint/redeem round trip profited");
        }
        _assertConservation("round trips");
    }

    // ------------------------------------------------------------------
    // Ordering: can a price move be sandwiched around someone else's call?
    // ------------------------------------------------------------------
    /// @notice Donating immediately before a victim's deposit raises the share
    ///         price, so the victim mints fewer shares — but those shares are
    ///         worth proportionally more, so the victim's claim is unchanged and
    ///         the donor merely recovers its own donation (minus dust). The
    ///         classic inflation sandwich needs the victim to round down to zero
    ///         shares, which is covered separately in EconomicComposition.
    function test_SandwichingADepositWithADonationIsUnprofitable() public {
        uint256 attackerStart = asset.balanceOf(attacker);
        _depositTracked(attacker, 1_000e18);

        _donateTracked(attacker, 50_000e18); // front-run
        _depositTracked(victim, 100_000e18);
        _redeemAllTracked(attacker); // back-run

        _logPnl("sandwich attacker", attackerStart, asset.balanceOf(attacker));
        assertLt(asset.balanceOf(attacker), attackerStart, "sandwich profited");
        _assertConservation("sandwich");
    }

    /// @notice Repeating the price move does not amortise it: 20 sequential
    ///         donate/redeem cycles compound the donor's loss.
    function test_RepeatedDonationCyclesCompoundTheAttackersLoss() public {
        _fund(victim, 10_000_000e18);
        _depositTracked(victim, 1_000_000e18);

        uint256 start = asset.balanceOf(attacker);
        for (uint256 i = 0; i < 20; ++i) {
            _depositTracked(attacker, 1_000e18);
            _donateTracked(attacker, 1_000e18);
            _redeemAllTracked(attacker);
        }
        _logPnl("repeat donor", start, asset.balanceOf(attacker));
        assertLt(asset.balanceOf(attacker), start);
        _assertConservation("repeat donations");
    }

    /// @notice The price is unaffected by which side of a status transition an
    ///         operation lands on, so there is no transition to be timed.
    function test_StatusTransitionsCannotBeTimedForPrice() public {
        _depositTracked(bob, 10_000e18);
        _donateTracked(carol, 1_000e18);
        uint256 priceBefore = _price();

        uint256 ownerMtaa = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        mtaa.transfer(address(0xDEAD), ownerMtaa);
        _hibernate();
        assertEq(_status(), 1, "HIBERNATING");
        assertEq(_price(), priceBefore, "hibernation repriced shares");

        _fundOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.reactivateFromHibernation();
        assertEq(_price(), priceBefore, "reactivation repriced shares");
        _assertConservation("transition pricing");
    }
}
