// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Base.t.sol";

/// @notice Flash-loan provider stand-in: lends MTAA within a single call.
contract MtaaFlashLender {
    MockMTAA public mtaa;

    constructor(MockMTAA _mtaa) {
        mtaa = _mtaa;
    }

    function flashCollectUpkeep(MaonoVault_Phase1B vault, uint256 amount) external {
        mtaa.mint(msg.sender, amount); // "borrow"
        vault.collectMonthlyUpkeep();
        mtaa.burn(msg.sender, amount); // "repay"
    }
}

/// @notice Owner contract that borrows MTAA only for the duration of the
///         upkeep call, to test whether the fee discount is snapshot-based.
contract FlashDiscountOwner {
    MockMTAA public mtaa;
    MaonoVault_Phase1B public vault;

    constructor(MockMTAA _mtaa, MaonoVault_Phase1B _vault) {
        mtaa = _mtaa;
        vault = _vault;
    }

    function approveVault() external {
        mtaa.approve(address(vault), type(uint256).max);
    }

    function acceptOwnership() external {
        vault.acceptOwnership();
    }

    function payUpkeepWithFlashLoan(uint256 borrow) external {
        mtaa.mint(address(this), borrow); // borrow
        vault.collectMonthlyUpkeep();
        mtaa.burn(address(this), borrow); // repay
    }
}

/// @title  Fee-accounting manipulation (MTAA upkeep / burn / treasury split)
contract UpkeepFeeTest is MaonoVaultBaseTest {
    function _prepOwnerWithMtaa(uint256 amount) internal {
        mtaa.mint(vaultOwner, amount);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
    }

    // ------------------------------------------------------------------
    // Upkeep must conserve MTAA: paid == burned + to treasury, nothing
    // sticks to the vault.
    // ------------------------------------------------------------------
    function test_UpkeepConservesMtaa_SavingsVault() public {
        _prepOwnerWithMtaa(1_000e18);
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        console2.log("  upkeep paid   :", paid);
        console2.log("  burned        :", burned);
        console2.log("  to treasury   :", toTreasury);
        assertEq(paid, burned + toTreasury, "fee split must be exhaustive");
        assertEq(burned, paid, "SAVINGS burns 100%");
        // 1000 MTAA held -> sqrt(1000)*2.5 = 77.5% -> capped at 50%.
        assertEq(paid, 7.5e18, "nominal 15 MTAA charged at the 50% cap");
        assertEq(mtaa.balanceOf(address(vault)), 0, "no MTAA may be stranded in the vault");
        assertEq(mtaa.balanceOf(treasury), 0);
    }

    function test_UpkeepSplit_InvestingVault() public {
        _deployVault(18, 3); // INVESTING: 30% burn / 70% treasury
        _prepOwnerWithMtaa(1_000e18);
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(paid, 30e18, "nominal 60 MTAA, charged at the 50% discount cap");
        assertEq(burned, 9e18, "30% burn");
        assertEq(toTreasury, 21e18, "70% treasury");
        assertEq(paid, burned + toTreasury);
        assertEq(mtaa.balanceOf(treasury), 21e18);
        assertEq(mtaa.balanceOf(address(vault)), 0);
    }

    // ------------------------------------------------------------------
    // FINDING: the MTAA fee discount is a balance snapshot taken inside the
    // fee-charging call, so it can be obtained with borrowed MTAA.
    // ------------------------------------------------------------------
    function test_FeeDiscountIsFlashLoanable() public {
        // Hand ownership to a contract so it can borrow+pay+repay atomically.
        FlashDiscountOwner flashOwner = new FlashDiscountOwner(mtaa, vault);
        vm.prank(vaultOwner);
        vault.transferOwnership(address(flashOwner));
        flashOwner.acceptOwnership();
        flashOwner.approveVault();

        mtaa.mint(address(flashOwner), 15e18); // just enough for full-price upkeep
        vm.warp(block.timestamp + 31 days);

        uint256 fullPrice = vault.getMonthlyUpkeepCost();
        // sqrt(400) * 2.5 = 50% -> the maximum discount costs 400 MTAA of
        // *borrowed* balance, held for a single call.
        flashOwner.payUpkeepWithFlashLoan(400e18);

        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  full-price upkeep :", fullPrice);
        console2.log("  paid with flash-loaned MTAA balance:", paid);
        console2.log("  protocol revenue lost (per month)  :", fullPrice - paid);
        console2.log("  attacker capital at risk           : 0 (single-tx loan)");

        assertEq(paid, fullPrice / 2, "50% discount obtained with borrowed MTAA");
        assertEq(mtaa.balanceOf(address(flashOwner)), 15e18 - paid, "owner keeps the rest");
    }

    /// @notice Even without a flash loan, the discount curve saturates far too
    ///         early: 400 MTAA of *idle* balance halves every future fee.
    function test_DiscountCurveSaturatesAt400Mtaa() public {
        assertEq(vault.getDiscountedFeePct(address(this)), 0);
        // discount = floor(sqrt(balance/1e18)) * 2.5, capped at 50
        uint256[5] memory balances = [uint256(1e18), 100e18, 400e18, 10_000e18, 1_000_000e18];
        uint256[5] memory expected = [uint256(2), 25, 50, 50, 50];
        for (uint256 i = 0; i < balances.length; ++i) {
            address holder = address(uint160(0x1000 + i));
            MockMTAA(address(mtaa)).mint(holder, balances[i]);
            assertEq(vault.getDiscountedFeePct(holder), expected[i]);
        }
    }

    // ------------------------------------------------------------------
    // Upkeep cannot be collected early or twice in the same period.
    // ------------------------------------------------------------------
    function test_UpkeepCannotBeCollectedEarlyOrTwice() public {
        _prepOwnerWithMtaa(1_000e18);

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.UpkeepNotDue.selector);
        vault.collectMonthlyUpkeep();

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.UpkeepNotDue.selector);
        vault.collectMonthlyUpkeep();
    }

    /// @notice Missed months are never back-charged: the schedule resets to
    ///         `block.timestamp`, so an owner who skips upkeep pays for one
    ///         month regardless of how long the vault was delinquent.
    function test_MissedMonthsAreNotBackCharged() public {
        _prepOwnerWithMtaa(1_000e18);
        vm.warp(block.timestamp + 365 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  months elapsed: 12, months charged: 1, paid:", paid);
        assertEq(paid, 7.5e18, "12 months of delinquency cost one discounted month");
    }

    /// @notice The advertised upkeep price can never actually be charged: to
    ///         pay a 15 MTAA fee the owner must hold >= 15 MTAA, which already
    ///         earns a 7.5% discount. Nominal revenue is unreachable by
    ///         construction.
    function test_NominalUpkeepPriceIsUnreachable() public {
        _prepOwnerWithMtaa(15e18); // the exact nominal fee, nothing more
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  nominal fee:", vault.getMonthlyUpkeepCost());
        console2.log("  actual fee :", paid);
        assertLt(paid, 15e18, "nominal price is never charged");
        assertEq(paid, 15e18 * 93 / 100, "sqrt(15)=3 -> 7.5% discount, integer-truncated to 7%");
    }

    // ------------------------------------------------------------------
    // Upkeep must never touch depositor assets.
    // ------------------------------------------------------------------
    function test_UpkeepDoesNotTouchVaultAssets() public {
        _fund(bob, 1_000e18);
        _deposit(bob, 1_000e18);
        _prepOwnerWithMtaa(1_000e18); // MTAA, not the vault asset
        vm.warp(block.timestamp + 31 days);

        uint256 assetsBefore = vault.totalAssets();
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(vault.totalAssets(), assetsBefore, "asset accounting untouched by fees");
        assertEq(vault.previewRedeem(vault.balanceOf(bob)), 1_000e18);
    }

    // ------------------------------------------------------------------
    // Owner-set fee parameters are bounded.
    // ------------------------------------------------------------------
    function test_BurnPercentageIsBounded() public {
        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.InvalidAmount.selector);
        vault.setBurnPercentageAt(0, 10_001);

        vm.prank(vaultOwner);
        vault.setBurnPercentageAt(0, 10_000);
    }

    /// @notice Upkeep cost itself is unbounded upward, but it is paid by the
    ///         vault owner in MTAA and cannot reach depositor assets.
    function test_UpkeepCostIsUnboundedButOwnerPaid() public {
        vm.prank(vaultOwner);
        vault.setUpkeepCostAt(0, type(uint128).max);
        assertEq(vault.getMonthlyUpkeepCost(), type(uint128).max);

        _fund(bob, 100e18);
        _deposit(bob, 100e18);
        vm.warp(block.timestamp + 31 days);

        // Owner cannot pay it -> the vault hibernates instead of charging users.
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertEq(uint256(vault.getVaultStatus()), 1, "vault hibernates");
        assertEq(vault.totalAssets(), 100e18, "depositor assets untouched");
    }
}
