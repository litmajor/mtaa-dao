// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./harness/MultiAssetSwapBase.sol";

/// @notice Phase 3 — swap execution quality for `MultiAssetVault`.
///
/// Invariant under test (E2): a transaction visible to an adversary before it
/// executes cannot cost the DAO more than the protocol's own slippage
/// constraints permit.
///
/// The suite separates the two swap paths, because they compute their minimum
/// output completely differently:
///
///   * `batchRebalance(..., isBuy = true)`  — minOut derived from oracle prices.
///   * `batchRebalance(..., isBuy = false)` — minOut derived from decimals only.
///   * `acquireAssetViaSwap`                — minOut derived from the pool being
///                                            traded, fenced by an oracle band.
contract SwapSandwichTest is MultiAssetSwapBase {
    function setUp() public {
        _deploySwapFixture();
    }

    // ------------------------------------------------------------------
    // F3-1 — sell-side rebalance has no economically meaningful minimum
    // ------------------------------------------------------------------

    /// @notice The sell branch computes
    ///         `expectedStable = amt * 10**stableDecimals / 10**assetDecimals`,
    ///         i.e. it prices every asset at exactly 1 stablecoin per whole
    ///         unit. For an asset that is not worth $1 the resulting floor is
    ///         unrelated to the trade's value.
    function test_SellSideMinOutIgnoresAssetPrice() public view {
        uint256 amount = 1e8; // 1 BTC

        // What the contract will accept as the worst case.
        uint256 expectedStable = (amount * 1e18) / 1e8;
        uint256 contractMinOut = (expectedStable * (10_000 - vault.maxSlippageBps())) / 10_000;

        // What the trade is actually worth at the oracle price.
        uint256 fairValue = 60_000e18;

        assertEq(contractMinOut, 0.995e18, "sell floor is ~1 cUSD for a 60,000 cUSD trade");
        assertLt(contractMinOut * 1000, fairValue, "floor is >1000x below fair value");
    }

    /// @notice Full sandwich. The searcher holds no role, is not whitelisted,
    ///         and only trades the same public pool the vault trades.
    function test_SandwichOnSellRebalanceExtractsValue() public {
        _fundVaultWithBtc(1e8);

        // After fixing the sell-side floor the router's oracle-derived floor
        // should prevent the sandwich. A front-run that manipulates the pool
        // will cause the rebalance to revert due to insufficient output.
        uint256 searcherBtcBefore = 40e8;
        wbtc.mint(address(searcher), searcherBtcBefore);

        // 1. Front-run: dump BTC to depress the pool price.
        uint256 cusdFromFrontRun = searcher.swap(address(wbtc), address(cusd), 40e8);

        // 2. Victim: the DAO's scheduled rebalance should now revert when the
        // pool has been poisoned, preventing extraction.
        vm.expectRevert();
        _sellBtcViaRebalance(1e8);

        // Ensure attacker did not end up with a profit after the attempted sandwich.
        uint256 searcherBtcAfter = wbtc.balanceOf(address(searcher));
        assertLe(searcherBtcAfter, searcherBtcBefore, "searcher should not profit after protection");
    }

    /// @notice The same sandwich needs no capital of the attacker's own: the
    ///         front-run inventory can be flash-borrowed and repaid in-transaction.
    function test_SandwichNeedsNoAttackerCapital() public {
        _fundVaultWithBtc(1e8);

        FlashLoanProvider lender = new FlashLoanProvider();
        wbtc.mint(address(lender), 60e8);

        FlashSandwichAttacker attackerContract =
            new FlashSandwichAttacker(router, lender, wbtc, cusd, vault, rebalancer);

        assertEq(wbtc.balanceOf(address(attackerContract)), 0, "attacker starts with zero capital");

        // With the sell-side floor fixed the flash sandwich should fail.
        vm.expectRevert();
        attackerContract.run(40e8);

        uint256 profit = wbtc.balanceOf(address(attackerContract));
        emit log_named_decimal_uint("flash-funded profit (BTC)", profit, 8);
        assertLe(profit, 0, "no profit expected after protection");
    }

    /// @notice Sweep the front-run size to bound the extractable value.
    function testFuzz_SellSandwichProfitIsMonotoneInFrontRunSize(uint256 frontRunBtc) public {
        frontRunBtc = bound(frontRunBtc, 1e8, 60e8);

        _fundVaultWithBtc(1e8);
        wbtc.mint(address(searcher), frontRunBtc);

        uint256 cusdOut = searcher.swap(address(wbtc), address(cusd), frontRunBtc);
        _sellBtcViaRebalance(1e8);
        searcher.swap(address(cusd), address(wbtc), cusdOut);

        uint256 finalBtc = wbtc.balanceOf(address(searcher));

        // With the fixed sell-side floor the searcher should not be able to
        // extract profit across the examined size range.
        assertLe(finalBtc, frontRunBtc, "sandwich should not be profitable after protection");
    }

    // ------------------------------------------------------------------
    // Negative result — the buy branch derives minOut from the oracle
    // ------------------------------------------------------------------

    /// @notice The identical manipulation against the buy branch reverts: its
    ///         floor is computed from oracle prices, which the pool cannot move.
    function test_BuySideRebalanceRejectsManipulatedPrice() public {
        cusd.mint(address(vault), 100_000e18);

        // Searcher front-runs by buying BTC, pushing BTC more expensive.
        cusd.mint(address(searcher), 2_000_000e18);
        searcher.swap(address(cusd), address(wbtc), 2_000_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(
                SyntheticAmmRouter.InsufficientOutputAmount.selector,
                router.getAmountOut(address(cusd), address(wbtc), 100_000e18),
                _oracleFloorForBuy(100_000e18)
            )
        );
        _buyBtcViaRebalance(100_000e18);
    }

    /// @notice Unmanipulated buys execute — but only while the trade is small
    ///         relative to pool depth.
    function test_BuySideRebalanceSucceedsAtFairPriceForSmallTrade() public {
        cusd.mint(address(vault), 5_000e18);
        _buyBtcViaRebalance(5_000e18);
        assertGt(wbtc.balanceOf(address(vault)), 0, "fair-price buy executes");
    }

    /// @notice F3-3 (availability, not extraction): the oracle floor is a pure
    ///         price comparison and budgets nothing for the pool fee or for the
    ///         trade's own price impact. With no adversary present at all, a
    ///         rebalance worth 1.7% of pool depth already breaches the 0.5%
    ///         band and reverts, so the buy path is unusable at treasury size
    ///         and any observer can keep it unusable by nudging the pool.
    function test_BuySideRebalanceRevertsOnHonestPriceImpact() public {
        cusd.mint(address(vault), 100_000e18);

        uint256 quoted = router.getAmountOut(address(cusd), address(wbtc), 100_000e18);
        uint256 floor = _oracleFloorForBuy(100_000e18);
        assertLt(quoted, floor, "honest execution is already below the floor");

        vm.expectRevert(
            abi.encodeWithSelector(SyntheticAmmRouter.InsufficientOutputAmount.selector, quoted, floor)
        );
        _buyBtcViaRebalance(100_000e18);
    }

    function _oracleFloorForBuy(uint256 stableAmount) private view returns (uint256) {
        uint256 expectedTarget = (stableAmount * CUSD_USD * 1e8) / (BTC_USD * 1e18);
        return (expectedTarget * (10_000 - vault.maxSlippageBps())) / 10_000;
    }
}

/// @notice Sandwiches the DAO rebalance using only borrowed inventory, proving
///         the attack has no capital requirement beyond gas.
contract FlashSandwichAttacker is IFlashBorrower {
    SyntheticAmmRouter private immutable router;
    FlashLoanProvider private immutable lender;
    MockERC20 private immutable btc;
    MockERC20 private immutable stable;
    MultiAssetVault private immutable vault;
    address private immutable rebalancer;

    constructor(
        SyntheticAmmRouter _router,
        FlashLoanProvider _lender,
        MockERC20 _btc,
        MockERC20 _stable,
        MultiAssetVault _vault,
        address _rebalancer
    ) {
        router = _router;
        lender = _lender;
        btc = _btc;
        stable = _stable;
        vault = _vault;
        rebalancer = _rebalancer;
    }

    function run(uint256 loanAmount) external {
        lender.flashLoan(address(btc), loanAmount, address(this), "");
    }

    function onFlashLoan(address token, uint256 amount, uint256 fee, bytes calldata) external override {
        // 1. Front-run.
        uint256 stableOut = _swap(address(btc), address(stable), amount);

        // 2. The DAO's pending rebalance lands inside the sandwich.
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bool[] memory isBuy = new bool[](1);
        tokens[0] = address(btc);
        amounts[0] = 1e8;
        isBuy[0] = false;
        vm_prank_rebalancer();
        vault.batchRebalance(tokens, amounts, isBuy);

        // 3. Back-run and repay.
        _swap(address(stable), address(btc), stableOut);
        MockERC20(token).transfer(address(lender), amount + fee);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn) private returns (uint256) {
        MockERC20(tokenIn).approve(address(router), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, 0, path, address(this), block.timestamp);
        return amounts[1];
    }

    /// @dev The rebalance is a legitimate DAO transaction sitting in the mempool;
    ///      inside a Foundry test the cheatcode stands in for "it lands next".
    function vm_prank_rebalancer() private {
        Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).prank(rebalancer);
    }
}
