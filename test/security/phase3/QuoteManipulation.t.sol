// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./harness/MultiAssetSwapBase.sol";

/// @notice Phase 3 — is the quote that builds `minAmountOut` independent of the
///         pool being traded?
///
/// `acquireAssetViaSwap` calls `getAmountsOut` on the very router it is about to
/// trade against, so that "protection" moves with the manipulation. What actually
/// bounds the damage is the second check: the implied price must sit within
/// `maxSlippageBps` of the oracle. This suite measures how much an adversary can
/// still take inside that band, confirms that pushing past it reverts, and
/// documents the decimal assumption baked into the comparison.
contract QuoteManipulationTest is MultiAssetSwapBase {
    /// @dev Kept small deliberately: the 50 bps band barely clears the pool's own
    ///      30 bps fee, so anything larger cannot execute at all (see
    ///      `SwapSandwichTest.test_BuySideRebalanceRevertsOnHonestPriceImpact`).
    uint256 internal constant TRADE = 1_000e18;

    function setUp() public {
        _deploySwapFixture();
    }

    function _acquireEth(uint256 stableAmount, uint256 minOut) internal returns (uint256) {
        vm.prank(manager);
        return vault.acquireAssetViaSwap(address(cusd), "ETH", stableAmount, minOut);
    }

    // ------------------------------------------------------------------
    // The quote is self-referential
    // ------------------------------------------------------------------

    /// @notice `allowedMin` is a function of pool state, so a searcher who moves
    ///         the pool also moves the floor that is supposed to protect the DAO.
    function test_MinOutFloorTracksTheManipulatedPool() public {
        uint256 cleanQuote = router.getAmountOut(address(cusd), address(weth), TRADE);

        cusd.mint(address(searcher), 100_000e18);
        searcher.swap(address(cusd), address(weth), 100_000e18);

        uint256 poisonedQuote = router.getAmountOut(address(cusd), address(weth), TRADE);
        assertLt(poisonedQuote, cleanQuote, "the quote itself degrades with the pool");

        uint256 cleanFloor = (cleanQuote * (10_000 - vault.maxSlippageBps())) / 10_000;
        uint256 poisonedFloor = (poisonedQuote * (10_000 - vault.maxSlippageBps())) / 10_000;
        assertLt(poisonedFloor, cleanFloor, "so does the floor derived from it");
    }

    /// @notice Inside the oracle band the swap still executes and the DAO is
    ///         measurably worse off — but the loss is bounded by the band, not
    ///         by the self-referential quote.
    function test_ExtractionInsideTheOracleBandIsBounded() public {
        cusd.mint(address(vault), TRADE);

        uint256 fairOut = router.getAmountOut(address(cusd), address(weth), TRADE);

        uint256 frontRun = 1_000e18;
        cusd.mint(address(searcher), frontRun);
        uint256 ethBought = searcher.swap(address(cusd), address(weth), frontRun);

        uint256 poisonedQuote = router.getAmountOut(address(cusd), address(weth), TRADE);
        uint256 received = _acquireEth(TRADE, (poisonedQuote * 9_950) / 10_000);

        uint256 cusdBack = searcher.swap(address(weth), address(cusd), ethBought);

        uint256 shortfall = fairOut - received;
        emit log_named_decimal_uint("fair output   (ETH )", fairOut, 18);
        emit log_named_decimal_uint("actual output (ETH )", received, 18);
        emit log_named_decimal_uint("shortfall     (ETH )", shortfall, 18);

        assertLt(received, fairOut, "victim is measurably worse off");
        assertLt((shortfall * 10_000) / fairOut, 100, "loss bounded under 1% by the oracle band");

        // And the round trip pays the pool fee twice, so this manipulation is
        // not self-financing at the size the band permits.
        assertLt(cusdBack, frontRun, "searcher loses more to fees than it extracts");
    }

    /// @notice Negative result: manipulation past the band reverts. The oracle
    ///         cross-check, not the DEX quote, is the control that actually holds.
    function test_ManipulationBeyondOracleBandReverts() public {
        cusd.mint(address(vault), TRADE);

        cusd.mint(address(searcher), 500_000e18);
        searcher.swap(address(cusd), address(weth), 500_000e18);

        uint256 poisonedQuote = router.getAmountOut(address(cusd), address(weth), TRADE);

        vm.expectRevert("Price deviates from oracle");
        _acquireEth(TRADE, poisonedQuote);
    }

    /// @notice Negative result: the manager cannot opt out of the floor by
    ///         passing a permissive `minAmountOut`.
    function test_ManagerCannotSupplyZeroMinimum() public {
        cusd.mint(address(vault), TRADE);

        vm.expectRevert("minAmountOut too low");
        _acquireEth(TRADE, 0);
    }

    /// @notice Negative result: a stale oracle reporting zero halts the path
    ///         instead of degrading to an unprotected swap.
    function test_ZeroOraclePriceHaltsAcquisition() public {
        cusd.mint(address(vault), TRADE);
        oracle.setPrice(address(weth), 0);

        vm.expectRevert("Oracle malfunction");
        _acquireEth(TRADE, 1);
    }

    /// @notice Whenever the swap succeeds, the implied execution price was inside
    ///         the band; whenever it was outside, the swap reverted. Fuzzed over
    ///         the whole manipulation range, in both directions.
    function testFuzz_SwapSucceedsOnlyInsideTheOracleBand(uint256 frontRun, bool pushUp) public {
        frontRun = bound(frontRun, 1e18, 400_000e18);

        cusd.mint(address(vault), TRADE);
        if (pushUp) {
            cusd.mint(address(searcher), frontRun);
            searcher.swap(address(cusd), address(weth), frontRun);
        } else {
            uint256 ethIn = bound(frontRun, 1e18, 200e18);
            weth.mint(address(searcher), ethIn);
            searcher.swap(address(weth), address(cusd), ethIn);
        }

        uint256 quote = router.getAmountOut(address(cusd), address(weth), TRADE);
        uint256 impliedPrice = (TRADE * 1e8) / quote;
        uint256 diffBps = impliedPrice > ETH_USD
            ? ((impliedPrice - ETH_USD) * 10_000) / ETH_USD
            : ((ETH_USD - impliedPrice) * 10_000) / ETH_USD;

        if (diffBps <= vault.maxSlippageBps()) {
            assertGt(_acquireEth(TRADE, (quote * 9_950) / 10_000), 0, "in-band trade executes");
        } else {
            vm.expectRevert("Price deviates from oracle");
            _acquireEth(TRADE, quote);
        }
    }

    // ------------------------------------------------------------------
    // F3-4 — the oracle cross-check assumes asset decimals == stablecoin decimals
    // ------------------------------------------------------------------

    /// @notice `impliedPricePerUnit = stablecoinAmount * 1e8 / estimatedOut` mixes
    ///         an 18-decimal input with an 8-decimal output, so for WBTC the
    ///         implied price comes out 1e10 times too large and the comparison can
    ///         never pass. The acquisition path is therefore dead for every asset
    ///         whose decimals differ from the stablecoin's — with a perfectly
    ///         healthy pool priced exactly at the oracle.
    function test_AcquisitionIsDeadForNonEighteenDecimalAssets() public {
        cusd.mint(address(vault), TRADE);

        uint256 quote = router.getAmountOut(address(cusd), address(wbtc), TRADE);
        uint256 impliedPrice = (TRADE * 1e8) / quote;

        assertGt(impliedPrice, BTC_USD * 1e9, "implied price is off by ~1e10 for an 8-decimal asset");

        vm.prank(manager);
        vm.expectRevert("Price deviates from oracle");
        vault.acquireAssetViaSwap(address(cusd), "BTC", TRADE, quote);
    }

    /// @notice The contrast that makes the sell-side finding sharper: the
    ///         *unprotected* rebalance path happily trades the same 8-decimal
    ///         asset that the *protected* path refuses to touch.
    function test_UnprotectedPathStillTradesTheAssetTheProtectedPathRejects() public {
        _fundVaultWithBtc(1e8);
        _sellBtcViaRebalance(1e8);
        assertGt(cusd.balanceOf(address(vault)), 0, "sell path executes without the oracle check");
    }
}
