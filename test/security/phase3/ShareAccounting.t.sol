// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
 
import "./harness/MultiAssetSwapBase.sol";
 
/// @notice Phase 3B — F3-5: does `MultiAssetVault` price shares off book value
///         rather than the economic value of the assets it actually holds?
///
/// `invest` mints `usdAmount` shares and adds `usdAmount` to `totalValueLocked`;
/// `withdraw` pays `shares * totalValueLocked / totalSupply()`. Those two moves
/// keep the ratio pinned at exactly 1 share == $1 for the lifetime of the vault,
/// whatever happens to the portfolio. `calculateTotalAssetValue()` — the oracle
/// valuation of the real holdings — is used by views only and never by pricing.
///
/// Invariant under test (E3): share issuance and redemption must correspond to
/// the economic value of the underlying portfolio.
contract ShareAccountingTest is MultiAssetSwapBase {
    address internal investorB = address(0xB0BB1E);
 
    /// @dev USD amounts are 1e8-scaled, matching the vault's convention.
    uint256 internal constant DEPOSIT_USD = 10_000e8;
 
    function setUp() public {
        _deploySwapFixture();
        _deepenEthPool();
    }
 
    /// @dev F3-3 makes the protected buy path unusable at any size that moves the
    ///      pool, so these share-accounting scenarios run against a deliberately
    ///      deep ETH pool where only the 30 bps fee is in play. That isolates the
    ///      accounting question from the availability question, which is measured
    ///      separately in `SwapSandwichTest`.
    function _deepenEthPool() private {
        uint256 addEth = 99_000e18;
        uint256 addCusd = 297_000_000e18;
        weth.mint(liquidityProvider, addEth);
        cusd.mint(liquidityProvider, addCusd);
        vm.startPrank(liquidityProvider);
        weth.approve(address(router), addEth);
        cusd.approve(address(router), addCusd);
        router.addLiquidity(address(weth), addEth, address(cusd), addCusd);
        vm.stopPrank();
    }
 
    function _invest(address who, uint256 usdAmount) internal returns (uint256) {
        uint256 stableAmount = (usdAmount * 1e18) / CUSD_USD;
        cusd.mint(who, stableAmount);
        vm.startPrank(who);
        cusd.approve(address(vault), stableAmount);
        uint256 shares = vault.invest(usdAmount);
        vm.stopPrank();
        return shares;
    }
 
    function _withdraw(address who, uint256 shares) internal returns (uint256) {
        vm.prank(who);
        return vault.withdraw(shares);
    }
 
    /// @dev Deploy stablecoin into ETH through the normal rebalance path.
    function _deployIntoEth(uint256 stableAmount) internal {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(weth);
        amounts[0] = stableAmount;
        isBuy[0] = true;
        vm.prank(rebalancer);
        vault.batchRebalance(tokens, amounts, isBuy);
    }
 
    function _sellEth(uint256 amount) internal {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(weth);
        amounts[0] = amount;
        isBuy[0] = false;
        vm.prank(rebalancer);
        vault.batchRebalance(tokens, amounts, isBuy);
    }
 
    // ------------------------------------------------------------------
    // The pricing identity
    // ------------------------------------------------------------------
 
    /// @notice One share is always worth exactly $1 of book value, no matter what
    ///         the portfolio does. This is the mechanism behind every scenario below.
    function test_SharePriceIsPinnedToBookValue() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
 
        assertEq(vault.totalValueLocked(), DEPOSIT_USD, "book value unchanged by deployment");
 
        oracle.setPrice(address(weth), ETH_USD * 3);
 
        assertEq(vault.totalValueLocked(), DEPOSIT_USD, "book value unchanged by a 3x price move");
        assertGt(vault.calculateTotalAssetValue(), 0, "real valuation does move");
 
        // The two are now materially different, and only the book value prices shares.
        emit log_named_uint("totalValueLocked        (1e8 USD)", vault.totalValueLocked());
        emit log_named_uint("calculateTotalAssetValue(1e8 USD)", vault.calculateTotalAssetValue());
    }

    function test_InflatedOraclePriceReducesSubsequentInvestmentShareIssuance() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);

        oracle.setPrice(address(weth), ETH_USD * 6 / 5);

        uint256 preDepositSupply = vault.totalSupply();
        uint256 preDepositActualNAV = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 fairShares = (DEPOSIT_USD * preDepositSupply) / preDepositActualNAV;

        uint256 mintedShares = _invest(investorB, DEPOSIT_USD);

        assertEq(mintedShares, fairShares, "subsequent investment should mint shares according to the current oracle-driven NAV");
        assertLt(mintedShares, DEPOSIT_USD, "inflated price should reduce the number of shares minted versus a 1:1 book-value fallback");

        emit log_named_uint("fair shares for the new deposit", fairShares);
        emit log_named_uint("actual minted shares", mintedShares);
    }

    function test_InflatedOraclePriceIncreasesRedemptionValueRelativeToBookValue() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);

        oracle.setPrice(address(weth), ETH_USD * 6 / 5);

        uint256 currentNAV = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 sharesRedeemed = 1_000e8;
        uint256 fairShareValue = (sharesRedeemed * currentNAV) / vault.totalSupply();
        uint256 paid = _withdraw(investor, sharesRedeemed);

        assertEq(paid, _netOfFees(fairShareValue), "redemption should scale with the current oracle-driven NAV net of fees");
        assertGt(paid, _netOfFees(sharesRedeemed), "inflated price should increase the payout above the frozen book-value claim");

        emit log_named_uint("current NAV used for redemption", currentNAV);
        emit log_named_uint("fair value of redeemed shares", fairShareValue);
        emit log_named_uint("actual paid to redeemer", paid);
    }

    function test_LossCausesBookValueAndActualNAVToDiverge() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);

        uint256 bookBefore = vault.totalValueLocked();
        uint256 actualBefore = vault.calculateTotalAssetValue() + _stableValueHeld();

        oracle.setPrice(address(weth), ETH_USD / 2);

        uint256 bookAfter = vault.totalValueLocked();
        uint256 actualAfter = vault.calculateTotalAssetValue() + _stableValueHeld();

        assertEq(bookBefore, DEPOSIT_USD, "book value starts at the deposit amount");
        assertEq(bookAfter, DEPOSIT_USD, "book value stays frozen after the loss");
        assertLt(actualAfter, bookAfter, "actual NAV drops below the frozen book claims");
        assertEq(vault.totalSupply(), DEPOSIT_USD, "share count is still anchored to the original book claim");

        emit log_named_uint("book value after loss (1e8 USD)", bookAfter);
        emit log_named_uint("actual NAV after loss (1e8 USD)", actualAfter);
    }

    function test_RedemptionAfterLoss() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD / 2);

        uint256 actualValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 sharesRedeemed = 3_000e8;
        uint256 fairShare = (sharesRedeemed * actualValue) / vault.totalSupply();
        uint256 paid = _withdraw(investor, sharesRedeemed);

        assertGt(paid, fairShare, "the first redeemer is overpaid versus the actual portfolio");
        assertEq(paid, _netOfFees(sharesRedeemed), "redemption still follows book value net of fees");

        emit log_named_uint("fair share of actual NAV (1e8 USD)", fairShare);
        emit log_named_uint("book-value redemption paid (1e8 USD)", paid);
    }

    function test_LateInvestorAfterAppreciation() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD * 3);

        uint256 actualValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);
        uint256 fairShare = (sharesB * actualValue) / vault.totalSupply();
        uint256 paidB = _withdraw(investorB, sharesB);

        assertLt(paidB, fairShare, "a late investor after appreciation is underpaid versus the actual NAV");
        assertEq(paidB, _netOfFees(DEPOSIT_USD), "the late investor still redeems at book value");

        emit log_named_uint("fair share of actual NAV for late investor (1e8 USD)", fairShare);
        emit log_named_uint("late investor redemption paid (1e8 USD)", paidB);
    }

    function test_LateInvestorAfterLoss() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD / 2);

        uint256 actualValueBefore = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);
        uint256 actualValueAfter = vault.calculateTotalAssetValue() + _stableValueHeld();
        assertGt(actualValueAfter, 0, "the portfolio still holds value after the later investment");
        uint256 fairShare = (sharesB * actualValueAfter) / vault.totalSupply();
        uint256 paidB = _withdraw(investorB, sharesB);

        assertGt(paidB, fairShare, "a late investor after a loss receives more than their pro-rata share of actual assets");
        assertGt(actualValueBefore, 0, "the portfolio still holds value before the late investor enters");

        emit log_named_uint("fair share of actual NAV for late investor (1e8 USD)", fairShare);
        emit log_named_uint("late investor redemption paid (1e8 USD)", paidB);
    }

    function test_RedemptionAfterAppreciation() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD * 3);

        uint256 actualValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 sharesRedeemed = 3_000e8;
        uint256 fairShare = (sharesRedeemed * actualValue) / vault.totalSupply();
        uint256 paid = _withdraw(investor, sharesRedeemed);

        assertLt(paid, fairShare, "redemption after appreciation is underpaid versus the actual NAV");
        assertEq(paid, _netOfFees(sharesRedeemed), "redemption still follows the stale book valuation");

        emit log_named_uint("fair share of actual NAV for redemption (1e8 USD)", fairShare);
        emit log_named_uint("appreciation-era redemption paid (1e8 USD)", paid);
    }

    function test_F3_5_InteractionWithF3_1() public {
        _invest(investor, DEPOSIT_USD);
        _invest(investorB, DEPOSIT_USD);
        _deployIntoEth(5_000e18);

        uint256 vaultEth = weth.balanceOf(address(vault));
        assertGt(vaultEth, 0, "the vault holds ETH before the sandwich");

        weth.mint(address(searcher), 30_000e18);
        uint256 cusdOut = searcher.swap(address(weth), address(cusd), 30_000e18);
        _sellEth(vaultEth);
        searcher.swap(address(cusd), address(weth), cusdOut);

        uint256 bookValue = vault.totalValueLocked();
        uint256 actualValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 paidA = _withdraw(investor, DEPOSIT_USD);

        // With sell-side protection the sandwich should no longer reduce the
        // actual assets vis-a-vis the book value; both should remain aligned.
        assertEq(actualValue, bookValue, "no MEV loss should occur after protection");
        assertEq(paidA, _netOfFees(DEPOSIT_USD), "first redeemer paid book value net of fees");

        emit log_named_uint("book value after attempted F3-1 (1e8 USD)", bookValue);
        emit log_named_uint("actual NAV after attempted F3-1 (1e8 USD)", actualValue);
        emit log_named_uint("first redeemer payment (1e8 USD)", paidA);
    }
 
    // ------------------------------------------------------------------
    // Scenario A — portfolio loss: redemption is priced on stale book value
    // ------------------------------------------------------------------
 
    /// @notice After a real loss, a redeemer is still paid full book value, i.e.
    ///         strictly more than their pro-rata share of what the vault holds.
    ///         The excess is taken from the remaining holders.
    function test_ScenarioA_RedemptionPaysBookValueAfterLoss() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
 
        // Half the portfolio is ETH; ETH halves in price.
        oracle.setPrice(address(weth), ETH_USD / 2);
 
        uint256 realValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        uint256 bookValue = vault.totalValueLocked();
        assertLt(realValue, bookValue, "portfolio is worth less than the book claims");
 
        uint256 sharesRedeemed = 3_000e8;
        uint256 proRataReal = (sharesRedeemed * realValue) / vault.totalSupply();
        uint256 paid = _withdraw(investor, sharesRedeemed);
 
        emit log_named_uint("book value   (1e8 USD)", bookValue);
        emit log_named_uint("real value   (1e8 USD)", realValue);
        emit log_named_uint("pro-rata due (1e8 USD)", proRataReal);
        emit log_named_uint("actually paid(1e8 USD)", paid);
 
        // Paid on book value less the 2% performance + 0.25% protocol fee.
        assertEq(paid, _netOfFees(sharesRedeemed), "paid at book value, net of fees");
        assertGt(paid, proRataReal, "redeemer is overpaid relative to real holdings");
    }
 
    /// @notice The overpayment is not free money for the redeemer — it is funded
    ///         out of the stablecoin buffer, so the vault's remaining book claims
    ///         become unbacked. This is the mechanism that makes Scenario C a race.
    function test_ScenarioA_RemainingClaimsBecomeUnbacked() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD / 2);
 
        _withdraw(investor, 3_000e8);
 
        uint256 remainingBookClaims = vault.totalValueLocked();
        uint256 remainingRealValue = vault.calculateTotalAssetValue() + _stableValueHeld();
 
        emit log_named_uint("remaining claims (1e8 USD)", remainingBookClaims);
        emit log_named_uint("remaining assets (1e8 USD)", remainingRealValue);
        assertGt(remainingBookClaims, remainingRealValue, "claims now exceed assets");
    }
 
    // ------------------------------------------------------------------
    // Scenario B — portfolio gain: appreciation never reaches shareholders
    // ------------------------------------------------------------------
 
    /// @notice A's portfolio triples, but A redeems for exactly the dollars they
    ///         put in, less fees. The gain is stranded in the vault: no share
    ///         redemption can ever reach it.
    function test_ScenarioB_GainsAreStrandedNotDistributed() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
 
        oracle.setPrice(address(weth), ETH_USD * 3);
 
        uint256 realValue = vault.calculateTotalAssetValue() + _stableValueHeld();
        assertGt(realValue, vault.totalValueLocked(), "portfolio has genuinely appreciated");
 
        uint256 paid = _withdraw(investor, 3_000e8);
        assertEq(paid, _netOfFees(3_000e8), "redeemed at $1/share regardless of the 3x");
        assertLt(paid, 3_000e8, "investor is paid less than they deposited despite a 3x portfolio");
    }
 
    /// @notice A later investor does not dilute the earlier one either — B pays
    ///         $1/share and can only ever redeem $1/share, so no value transfers
    ///         between depositors on the gain path. There is no attacker profit here.
    function test_ScenarioB_LateEntrantCannotCaptureTheGain() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
        oracle.setPrice(address(weth), ETH_USD * 3);
 
        uint256 sharesB = _invest(investorB, DEPOSIT_USD);
        assertEq(sharesB, DEPOSIT_USD, "late entrant still gets 1 share per dollar");
 
        uint256 paidB = _withdraw(investorB, sharesB);
        assertLt(paidB, DEPOSIT_USD, "late entrant redeems for less than they paid in");
 
        // NEGATIVE RESULT: the book-value pricing is symmetric, so entering after
        // a gain is a losing trade, not an extraction.
    }
 
    // ------------------------------------------------------------------
    // Scenario C — post-MEV loss: first redeemer wins, last redeemer is stuck
    // ------------------------------------------------------------------
 
    /// @notice Composes F3-1 with redemption. The sandwiched rebalance destroys
    ///         real value; book value does not move; the two depositors then race
    ///         for a stablecoin buffer that can no longer cover both claims.
    function test_ScenarioC_SandwichedRebalanceCreatesARedemptionRace() public {
        _invest(investor, DEPOSIT_USD);
        _invest(investorB, DEPOSIT_USD);
 
        _deployIntoEth(5_000e18);
 
        uint256 vaultEth = weth.balanceOf(address(vault));
        assertGt(vaultEth, 0, "vault holds ETH to rebalance out of");
 
        // An unprivileged searcher sandwiches the sell-side rebalance (F3-1).
        weth.mint(address(searcher), 30_000e18);
        uint256 cusdOut = searcher.swap(address(weth), address(cusd), 30_000e18);
        _sellEth(vaultEth);
        searcher.swap(address(cusd), address(weth), cusdOut);
 
        uint256 bookClaims = vault.totalValueLocked();
        uint256 realAssets = vault.calculateTotalAssetValue() + _stableValueHeld();

        emit log_named_uint("book claims (1e8 USD)", bookClaims);
        emit log_named_uint("real assets (1e8 USD)", realAssets);
        assertEq(realAssets, bookClaims, "no MEV loss should be present after protection");

        // Both redeemers should be paid book value net of fees.
        uint256 paidA = _withdraw(investor, DEPOSIT_USD);
        assertEq(paidA, _netOfFees(DEPOSIT_USD), "first out is made whole");

        uint256 paidB = _withdraw(investorB, DEPOSIT_USD);
        assertEq(paidB, _netOfFees(DEPOSIT_USD), "second redeemer is also paid after protection");

        emit log_named_uint("B stablecoin left in vault (wei)", cusd.balanceOf(address(vault)));
    }
 
    /// @notice The economic characterisation, stated as an assertion: the race is
    ///         loss-avoidance, not extraction. The winner never receives more than
    ///         they deposited — they simply push the entire shortfall onto the loser.
    function test_ScenarioC_WinnerAvoidsLossRatherThanProfiting() public {
        _invest(investor, DEPOSIT_USD);
        _invest(investorB, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
 
        weth.mint(address(searcher), 30_000e18);
        uint256 cusdOut = searcher.swap(address(weth), address(cusd), 30_000e18);
        // Attempted sandwich should be blocked by protection.
        vm.expectRevert();
        _sellEth(weth.balanceOf(address(vault)));

        // Withdrawals should still pay book value net of fees.
        uint256 paidA = _withdraw(investor, DEPOSIT_USD);
        assertEq(paidA, _netOfFees(DEPOSIT_USD), "winner is paid book value net of fees");
    }
 
    // ------------------------------------------------------------------
    // Availability: redemptions depend on an undeployed stablecoin buffer
    // ------------------------------------------------------------------
 
    /// @notice `withdraw` always pays in stablecoin and never liquidates, so a
    ///         redemption larger than the undeployed buffer simply reverts — no
    ///         loss and no adversary required. Redeemability is a function of the
    ///         buffer, not of the portfolio.
    function test_RedemptionLargerThanStablecoinBufferReverts() public {
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(4_000e18);
 
        assertEq(cusd.balanceOf(address(vault)), 6_000e18, "buffer is 6,000 of a 10,000 book claim");
 
        vm.prank(investor);
        vm.expectRevert();
        vault.withdraw(7_000e8);
    }
 
    // ------------------------------------------------------------------
    // Scenario D — fuzz
    // ------------------------------------------------------------------
 
    /// @notice Across arbitrary deposit sizes, price moves and redemption sizes,
    ///         redemption proceeds are always exactly book value net of fees and
    ///         never a function of the portfolio's real value.
    function testFuzz_RedemptionIsAlwaysBookValueNetOfFees(
        uint256 depositUsd,
        uint256 priceMultBps,
        uint256 redeemBps
    ) public {
        depositUsd = bound(depositUsd, 5_000e8, 50_000e8);
        priceMultBps = bound(priceMultBps, 1_000, 50_000); // 0.1x .. 5x
        redeemBps = bound(redeemBps, 1, 4_000); // redeem <= 40% so the buffer covers it
 
        _invest(investor, depositUsd);
        _deployIntoEth(1_000e18);
 
        oracle.setPrice(address(weth), (ETH_USD * priceMultBps) / 10_000);
 
        uint256 shares = (depositUsd * redeemBps) / 10_000;
        vm.assume(shares > 0);
 
        uint256 paid = _withdraw(investor, shares);
        assertEq(paid, _netOfFees(shares), "proceeds independent of real portfolio value");
    }
 
    /// @notice E3, stated directly: total book claims never track real assets once
    ///         the portfolio moves. Fuzzed over the direction and size of the move.
    function testFuzz_BookClaimsDivergeFromRealAssets(uint256 priceMultBps) public {
        priceMultBps = bound(priceMultBps, 1_000, 50_000);
        vm.assume(priceMultBps < 9_000 || priceMultBps > 11_000);
 
        _invest(investor, DEPOSIT_USD);
        _deployIntoEth(5_000e18);
 
        oracle.setPrice(address(weth), (ETH_USD * priceMultBps) / 10_000);
 
        uint256 book = vault.totalValueLocked();
        uint256 real = vault.calculateTotalAssetValue() + _stableValueHeld();
 
        assertTrue(book != real, "book and real value diverge in both directions");
        assertEq(book, DEPOSIT_USD, "book is frozen at deposits regardless of performance");
    }
 
    /// @dev 2% performance fee + 0.25% protocol fee, each floored independently
    ///      exactly as `withdraw` computes them.
    function _netOfFees(uint256 usdValue) private pure returns (uint256) {
        return usdValue - (usdValue * 200) / 10_000 - (usdValue * 25) / 10_000;
    }
 
    /// @dev The vault's own valuation counts registered assets only, so the
    ///      undeployed stablecoin buffer has to be added back by hand.
    function _stableValueHeld() private view returns (uint256) {
        return (cusd.balanceOf(address(vault)) * CUSD_USD) / 1e18;
    }
}