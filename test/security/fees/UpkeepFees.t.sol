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

    /// @notice The strongest single-transaction attempt: borrow, stake, pay, unstake, repay.
    function stakePayUnstakeWithFlashLoan(uint256 borrow) external {
        mtaa.mint(address(this), borrow); // borrow
        vault.stakeMtaaForDiscount(borrow);
        vault.collectMonthlyUpkeep();
        vault.unstakeMtaa(borrow);
        mtaa.burn(address(this), borrow); // repay
    }

    function stake(uint256 amount) external {
        vault.stakeMtaaForDiscount(amount);
    }

    function unstake(uint256 amount) external {
        vault.unstakeMtaa(amount);
    }

    function payUpkeep() external {
        vault.collectMonthlyUpkeep();
    }
}

/// @title  Fee-accounting manipulation (MTAA upkeep / burn / treasury split)
contract UpkeepFeeTest is MaonoVaultBaseTest {
    function _prepOwnerWithMtaa(uint256 amount) internal {
        mtaa.mint(vaultOwner, amount);
        vm.prank(vaultOwner);
        mtaa.approve(address(vault), type(uint256).max);
    }

    /// @notice M-1: earn the discount the only way it can now be earned — stake MTAA
    ///         and hold it for the full qualifying period.
    function _stakeAndSeason(uint256 amount) internal {
        vm.prank(vaultOwner);
        vault.stakeMtaaForDiscount(amount);
        vm.warp(block.timestamp + vault.DISCOUNT_MIN_STAKE_DURATION());
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
        // M-1: merely *holding* 1000 MTAA no longer buys a discount.
        assertEq(paid, 15e18, "nominal 15 MTAA charged in full");
        assertEq(mtaa.balanceOf(address(vault)), 0, "no MTAA may be stranded in the vault");
        assertEq(mtaa.balanceOf(treasury), 0);
    }

    /// @notice M-1: the discount is still available — to sustained stakers.
    function test_SustainedStakeEarnsTheDiscount() public {
        _prepOwnerWithMtaa(1_000e18);
        _stakeAndSeason(400e18); // sqrt(400) * 2.5 = 50% (the cap)
        vm.warp(block.timestamp + 31 days);

        assertEq(vault.getUpkeepDiscountPct(), 50, "seasoned stake earns the capped discount");

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        assertEq(paid, 7.5e18, "half price for a sustained 400 MTAA stake");
        assertEq(mtaa.balanceOf(address(vault)), vault.mtaaStaked(), "only the stake stays in the vault");
    }

    function test_UpkeepSplit_InvestingVault() public {
        _deployVault(18, 3); // INVESTING: 30% burn / 70% treasury
        _prepOwnerWithMtaa(1_000e18);
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid, uint256 burned, uint256 toTreasury) = vault.getVaultMetrics();
        assertEq(paid, 60e18, "nominal 60 MTAA charged in full");
        assertEq(burned, 18e18, "30% burn");
        assertEq(toTreasury, 42e18, "70% treasury");
        assertEq(paid, burned + toTreasury);
        assertEq(mtaa.balanceOf(treasury), 42e18);
        assertEq(mtaa.balanceOf(address(vault)), 0);
    }

    // ------------------------------------------------------------------
    // M-1 regression (was: test_FeeDiscountIsFlashLoanable).
    // The discount used to be a balance snapshot taken inside the fee-charging
    // call, so it could be bought with MTAA borrowed for that single call.
    // ------------------------------------------------------------------
    function test_FeeDiscountIsNotFlashLoanable() public {
        // Hand ownership to a contract so it can borrow+pay+repay atomically.
        FlashDiscountOwner flashOwner = new FlashDiscountOwner(mtaa, vault);
        vm.prank(vaultOwner);
        vault.transferOwnership(address(flashOwner));
        flashOwner.acceptOwnership();
        flashOwner.approveVault();

        mtaa.mint(address(flashOwner), 15e18); // just enough for full-price upkeep
        vm.warp(block.timestamp + 31 days);

        uint256 fullPrice = vault.getMonthlyUpkeepCost();
        flashOwner.payUpkeepWithFlashLoan(400e18);

        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  full-price upkeep :", fullPrice);
        console2.log("  paid with flash-loaned MTAA balance:", paid);

        assertEq(paid, fullPrice, "borrowed balance buys no discount");
        assertEq(mtaa.balanceOf(address(flashOwner)), 0, "the whole nominal fee was paid");
    }

    /// @notice M-1: the strongest single-transaction attempt — borrow, stake, pay,
    ///         unstake, repay — also earns nothing, because the stake has not been held.
    function test_StakeInsideTheUpkeepTransactionEarnsNoDiscount() public {
        FlashDiscountOwner flashOwner = new FlashDiscountOwner(mtaa, vault);
        vm.prank(vaultOwner);
        vault.transferOwnership(address(flashOwner));
        flashOwner.acceptOwnership();
        flashOwner.approveVault();

        mtaa.mint(address(flashOwner), 15e18);
        vm.warp(block.timestamp + 31 days);

        flashOwner.stakePayUnstakeWithFlashLoan(400e18);

        (,, uint256 paid,,) = vault.getVaultMetrics();
        assertEq(paid, 15e18, "same-transaction stake buys no discount");
        assertEq(vault.mtaaStaked(), 0, "stake was unwound");
    }

    /// @notice M-1: acquiring and staking shortly before payment is equally worthless —
    ///         the stake must be seasoned for DISCOUNT_MIN_STAKE_DURATION.
    function test_ShortDurationStakeEarnsNoDiscount() public {
        _prepOwnerWithMtaa(1_000e18);
        vm.prank(vaultOwner);
        vault.stakeMtaaForDiscount(400e18);

        vm.warp(block.timestamp + vault.DISCOUNT_MIN_STAKE_DURATION() - 1);
        assertEq(vault.getUpkeepDiscountPct(), 0, "one second short still earns nothing");

        vm.warp(block.timestamp + 1);
        assertEq(vault.getUpkeepDiscountPct(), 50, "and everything one second later");
    }

    /// @notice M-1: topping the stake up restarts the clock, so a seasoned small stake
    ///         cannot be levered into a large discount immediately before paying.
    function test_ToppingUpTheStakeRestartsTheClock() public {
        _prepOwnerWithMtaa(1_000e18);
        _stakeAndSeason(1e18); // sqrt(1)*2.5 = 2%
        assertEq(vault.getUpkeepDiscountPct(), 2);

        vm.prank(vaultOwner);
        vault.stakeMtaaForDiscount(399e18); // would be 50% if it counted immediately
        assertEq(vault.getUpkeepDiscountPct(), 0, "top-up restarts the holding period");

        vm.warp(block.timestamp + vault.DISCOUNT_MIN_STAKE_DURATION());
        assertEq(vault.getUpkeepDiscountPct(), 50, "and pays out once genuinely held");
    }

    /// @notice M-1: unstaking immediately after paying gives back the MTAA but the
    ///         following month is charged at full price.
    function test_DisposingOfTheStakeRemovesTheDiscount() public {
        _prepOwnerWithMtaa(1_000e18);
        _stakeAndSeason(400e18);
        vm.warp(block.timestamp + 31 days);

        vm.startPrank(vaultOwner);
        vault.collectMonthlyUpkeep();
        vault.unstakeMtaa(400e18);
        vm.stopPrank();

        assertEq(vault.getUpkeepDiscountPct(), 0, "no stake, no discount");

        vm.warp(block.timestamp + 31 days);
        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        assertEq(paid, 7.5e18 + 15e18, "second month charged in full");
    }

    /// @notice The discount curve itself is unchanged, but it now reads the seasoned
    ///         stake rather than any address's spot balance.
    function test_DiscountCurveSaturatesAt400Mtaa() public {
        // A spot balance, however large, buys nothing.
        MockMTAA(address(mtaa)).mint(address(this), 1_000_000e18);
        assertEq(vault.getDiscountedFeePct(address(this)), 0);
        assertEq(vault.getUpkeepDiscountPct(), 0);

        // discount = floor(sqrt(totalStake/1e18)) * 2.5, capped at 50. The top-ups
        // below accumulate to 1, 100, 400, 10_000 and 1_000_000 MTAA staked.
        uint256[5] memory stakes = [uint256(1e18), 99e18, 300e18, 9_600e18, 990_000e18];
        uint256[5] memory expected = [uint256(2), 25, 50, 50, 50];
        _prepOwnerWithMtaa(1_000_000e18);
        for (uint256 i = 0; i < stakes.length; ++i) {
            _stakeAndSeason(stakes[i]);
            assertEq(vault.getUpkeepDiscountPct(), expected[i]);
            assertEq(vault.getDiscountedFeePct(vaultOwner), expected[i], "charged account sees the discount");
            assertEq(vault.getDiscountedFeePct(attacker), 0, "nobody else does");
        }
    }

    /// @notice Staked MTAA is fully custodied: the vault never holds less than it owes
    ///         its staker, and the stake is not touched by burns or treasury transfers.
    function test_StakeIsAlwaysRedeemable() public {
        _prepOwnerWithMtaa(1_000e18);
        _stakeAndSeason(400e18);
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();
        assertGe(mtaa.balanceOf(address(vault)), vault.mtaaStaked(), "stake stays backed");

        uint256 before = mtaa.balanceOf(vaultOwner);
        vm.prank(vaultOwner);
        vault.unstakeMtaa(400e18);
        assertEq(mtaa.balanceOf(vaultOwner) - before, 400e18, "stake returned in full");
        assertEq(mtaa.balanceOf(address(vault)), 0);
    }

    /// @notice Only the owner can move the stake, and never more than was staked.
    function test_StakeAccessControl() public {
        _prepOwnerWithMtaa(1_000e18);
        _stakeAndSeason(10e18);

        vm.prank(attacker);
        vm.expectRevert();
        vault.stakeMtaaForDiscount(1e18);

        vm.prank(attacker);
        vm.expectRevert();
        vault.unstakeMtaa(1e18);

        vm.prank(vaultOwner);
        vm.expectRevert(MaonoVault_Phase1B.InsufficientStake.selector);
        vault.unstakeMtaa(10e18 + 1);
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
        assertEq(paid, 15e18, "12 months of ACTIVE delinquency cost one full month");
    }

    /// @notice M-1 regression (was: test_NominalUpkeepPriceIsUnreachable). Holding just
    ///         enough MTAA to pay the fee used to earn a discount on that same fee, so
    ///         the advertised price could never be charged. It is now the default.
    function test_NominalUpkeepPriceIsCharged() public {
        _prepOwnerWithMtaa(15e18); // the exact nominal fee, nothing more
        vm.warp(block.timestamp + 31 days);

        vm.prank(vaultOwner);
        vault.collectMonthlyUpkeep();

        (,, uint256 paid,,) = vault.getVaultMetrics();
        console2.log("  nominal fee:", vault.getMonthlyUpkeepCost());
        console2.log("  actual fee :", paid);
        assertEq(paid, 15e18, "the advertised price is the price");
        assertEq(mtaa.balanceOf(vaultOwner), 0);
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
    // Platform-set fee parameters are bounded (P2-1: the payer cannot set them).
    // ------------------------------------------------------------------
    function test_BurnPercentageIsBounded() public {
        // this test contract initialized the clone, so it is the platform admin
        vm.expectRevert(MaonoVault_Phase1B.InvalidAmount.selector);
        vault.setBurnPercentageAt(0, 10_001);

        vault.setBurnPercentageAt(0, 10_000);
    }

    /// @notice Upkeep cost itself is unbounded upward, but it is paid by the
    ///         vault owner in MTAA and cannot reach depositor assets.
    function test_UpkeepCostIsUnboundedButOwnerPaid() public {
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
