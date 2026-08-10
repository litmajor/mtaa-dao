// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../harness/Mocks.sol";

/// @notice Deterministic constant-product AMM with the Uniswap V2 router surface
///         that `MultiAssetVault` actually calls. No external protocol, no fork:
///         reserves live in this contract and every actor (vault, MEV searcher,
///         liquidity provider) trades against the same curve, so front-run /
///         victim / back-run ordering is expressed as plain call ordering.
contract SyntheticAmmRouter {
    /// @dev 0.3% fee, matching Uniswap V2.
    uint256 private constant FEE_NUMERATOR = 997;
    uint256 private constant FEE_DENOMINATOR = 1000;

    mapping(address => mapping(address => uint256)) public reserves;

    error ExpiredDeadline();
    error InsufficientOutputAmount(uint256 amountOut, uint256 amountOutMin);
    error UnsupportedPath();
    error NoLiquidity();

    /// @notice Seed a pair. Tokens must already be held by this contract.
    function addLiquidity(address tokenA, uint256 reserveA, address tokenB, uint256 reserveB) external {
        IERC20(tokenA).transferFrom(msg.sender, address(this), reserveA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), reserveB);
        reserves[tokenA][tokenB] += reserveA;
        reserves[tokenB][tokenA] += reserveB;
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        uint256 reserveOut = reserves[tokenOut][tokenIn];
        if (reserveIn == 0 || reserveOut == 0) revert NoLiquidity();
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        return (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        if (path.length != 2) revert UnsupportedPath();
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = getAmountOut(path[0], path[1], amountIn);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (path.length != 2) revert UnsupportedPath();

        uint256 amountOut = getAmountOut(path[0], path[1], amountIn);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount(amountOut, amountOutMin);

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        reserves[path[0]][path[1]] += amountIn;
        reserves[path[1]][path[0]] -= amountOut;
        IERC20(path[1]).transfer(to, amountOut);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    /// @notice Spot price of `tokenIn` denominated in `tokenOut`, scaled by 1e18.
    function spotPrice(address tokenIn, address tokenOut) external view returns (uint256) {
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        if (reserveIn == 0) revert NoLiquidity();
        return (reserves[tokenOut][tokenIn] * 1e18) / reserveIn;
    }
}

/// @notice Per-token USD oracle (1e8 scale) matching the `IPriceOracle` interface
///         `MultiAssetVault` consumes. Prices are set explicitly by the test, i.e.
///         the oracle is an *independent* source that the AMM cannot move.
contract MultiAssetPriceOracle {
    mapping(address => uint256) public prices;

    function setPrice(address token, uint256 usd8) external {
        prices[token] = usd8;
    }

    function getPrice(address token) external view returns (uint256) {
        return prices[token];
    }
}

/// @notice An unprivileged searcher. It holds no protocol role and can only do
///         what any mempool observer can do: trade the same public pool before
///         and after a victim transaction.
contract MevSearcher {
    SyntheticAmmRouter public immutable router;

    constructor(SyntheticAmmRouter _router) {
        router = _router;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256) {
        IERC20(tokenIn).approve(address(router), amountIn);
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, 0, path, address(this), block.timestamp);
        return amounts[1];
    }
}

/// @notice Minimal ERC-3156-style flash lender used to prove (or disprove) that an
///         attack needs no genuine capital. The loan must be repaid in the same
///         call or the whole transaction reverts.
contract FlashLoanProvider {
    error RepaymentFailed();

    uint256 public constant FEE_BPS = 5; // 0.05%, Aave-like

    function flashLoan(address token, uint256 amount, address receiver, bytes calldata data) external {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        uint256 fee = (amount * FEE_BPS) / 10_000;

        IERC20(token).transfer(receiver, amount);
        IFlashBorrower(receiver).onFlashLoan(token, amount, fee, data);

        if (IERC20(token).balanceOf(address(this)) < balanceBefore + fee) revert RepaymentFailed();
    }
}

interface IFlashBorrower {
    function onFlashLoan(address token, uint256 amount, uint256 fee, bytes calldata data) external;
}
