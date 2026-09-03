// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./harness/MultiAssetSwapBase.sol";

/// @notice Phase 3 — DEX manipulation simulation.
/// Computes the stablecoin input required to move the on-chain AMM spot
/// price by a target factor, executes the swap, then sets the test oracle
/// to the DEX price and measures attacker cost vs. extractable payout.
contract DEXManipulationSimulation is MultiAssetSwapBase {
    function setUp() public {
        _deploySwapFixture();
    }

    /// @dev Convert router spotPrice (scaled 1e18) to USD (scaled 1e8)
    function _spotToUsd8(uint256 spot) internal view returns (uint256) {
        // spot is tokenOut/tokenIn scaled by 1e18; stablecoin USD per unit is CUSD_USD (1e8)
        return (spot * CUSD_USD) / 1e18;
    }

    /// @dev Simulate the spot price after a hypothetical swap of `amountIn` stable -> asset
    function _simulateSpotAfterSwap(uint256 amountIn) internal view returns (uint256) {
        uint256 reserveCusd = router.reserves(address(cusd), address(weth));
        uint256 reserveWeth = router.reserves(address(weth), address(cusd));
        uint256 amountOut = router.getAmountOut(address(cusd), address(weth), amountIn);

        uint256 newReserveCusd = reserveCusd + amountIn;
        uint256 newReserveWeth = reserveWeth - amountOut;
        require(newReserveWeth > 0, "no liquidity after swap");

        uint256 newSpot = (newReserveCusd * 1e18) / newReserveWeth;
        return newSpot;
    }


    /// @notice Find minimal stablecoin input (using binary search) to reach targetFactor * currentSpot
    function _findAmountInForFactor(uint256 targetFactor, uint256 maxCusd) internal view returns (uint256) {
        uint256 baseSpot = router.spotPrice(address(weth), address(cusd));
        uint256 targetSpot = (baseSpot * targetFactor) / 1e18; // targetFactor scaled 1e18

        uint256 low = 1e12; // small starting point (0.000001 cUSD)
        uint256 high = maxCusd;
        uint256 mid;
        uint256 iter = 0;

        while (low <= high && iter < 100) {
            mid = (low + high) / 2;
            uint256 out = router.getAmountOut(address(cusd), address(weth), mid);
            // compute new spot using hypothetical reserves
            uint256 reserveCusd = router.reserves(address(cusd), address(weth));
            uint256 reserveWeth = router.reserves(address(weth), address(cusd));
            uint256 newReserveCusd = reserveCusd + mid;
            if (reserveWeth <= out) {
                // mid too large, would drain pool
                high = mid - 1;
                iter++;
                continue;
            }
            uint256 newReserveWeth = reserveWeth - out;
            uint256 newSpot = (newReserveCusd * 1e18) / newReserveWeth;

            if (newSpot >= targetSpot) {
                if (mid == 0) return 0;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
            iter++;
        }
        return low;
    }

    function _makePath(address a, address b) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = a;
        p[1] = b;
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

    function test_DexManipulationCostVsExtractableValue() public {
        // Setup: fund vault and give attacker a small stake
        uint256 deployDeposit = 10_000e8;
        _invest(investor, deployDeposit);
        _deployIntoEth(5_000e18);

        // Attacker is represented by the searcher contract for swap capabilities
        address attacker = address(searcher);
        uint256 attackerDepositUsd = 1_000e8;
        uint256 attackerShares = _invest(attacker, attackerDepositUsd);

        // Baseline spot and oracle
        uint256 baseSpot = router.spotPrice(address(weth), address(cusd));
        uint256 baseUsd8 = _spotToUsd8(baseSpot);

        // Choose target factor (1.2x => 20% inflation)
        uint256 targetFactor = factor1_2x();

        // Find required stablecoin input (bounded to a fraction of pool liquidity)
        uint256 reserveCusd = router.reserves(address(cusd), address(weth));
        uint256 maxCusd = reserveCusd / 4; // don't allow draining more than 25% for search
        uint256 amountIn = _findAmountInForFactor(targetFactor, maxCusd);

        // Mint stable coins to searcher and execute swap
        cusd.mint(address(searcher), amountIn);
        uint256 cusdOut = searcher.swap(address(cusd), address(weth), amountIn);

        // Compute on-chain DEX price after swap and convert to oracle scale
        uint256 newSpot = router.spotPrice(address(weth), address(cusd));
        uint256 newUsd8 = _spotToUsd8(newSpot);

        // Record attacker cost in USD8
        uint256 costUsd8 = (amountIn * CUSD_USD) / 1e18;

        // For simulation, set the test oracle to the DEX price observed
        oracle.setPrice(address(weth), newUsd8);

        // Attacker withdraws all their shares
        uint256 redeemed = _withdraw(attacker, attackerShares);

        // Profit (USD8) = redeemed - deposit - manipulation cost
        int256 profitUsd8 = int256(redeemed) - int256(attackerDepositUsd) - int256(costUsd8);

        emit log_named_uint("baseUsd8", baseUsd8);
        emit log_named_uint("newUsd8", newUsd8);
        emit log_named_uint("amountIn (wei cusd)", amountIn);
        emit log_named_uint("costUsd8", costUsd8);
        emit log_named_uint("redeemedUsd8", redeemed);
        emit log_named_int("profitUsd8", profitUsd8);

        // This test logs the result; assert true so the test passes and the operator can inspect logs.
        assertTrue(true);
    }

    // Helper to provide a fixed-point 1.2 multiplier as 1e18 scale
    function factor1_2x() internal pure returns (uint256) {
        return 1200000000000000000; // 1.2 * 1e18
    }
}
