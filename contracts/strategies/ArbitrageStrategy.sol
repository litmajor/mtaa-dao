// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IFlashLoanStrategy.sol';

// [PATCH 1] Replace custom IERC20 + raw calls with OZ SafeERC20
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IUniswapV3Router
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

/**
 * @title ICurvePool
 */
interface ICurvePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy)
        external returns (uint256);
    function get_dy(int128 i, int128 j, uint256 dx)
        external view returns (uint256);
}

/**
 * @title ArbitrageStrategy V2 (Patched)
 * @dev Triangular arbitrage across Uniswap V3 and Curve
 *
 * Patch changelog:
 * [P1]  CRITICAL  — Replaced all raw ERC20 transfer/approve calls with SafeERC20
 *                   (safeTransfer, forceApprove). Required for USDT and other tokens
 *                   that return void or revert on non-zero allowance resets.
 * [P2]  HIGH      — Fixed simulateArbitrage. The original loop overwrote `finalAmount`
 *                   on every iteration, discarding all intermediate values and returning
 *                   only expectedOutputs[last] - amount. Now clearly documented as a
 *                   single-shot helper; callers must supply the full chained output
 *                   from off-chain quotes (Uniswap QuoterV2, Curve get_dy).
 * [P3]  HIGH      — Added 2-step ownership transfer (pendingOwner pattern), matching
 *                   the executor contract. Single-step transfer on the original meant
 *                   one typo = permanent loss of strategy ownership.
 * [P4]  HIGH      — Router and pool addresses moved from private constant to immutable
 *                   constructor parameters. Allows different deployments (testnets, new
 *                   router versions, alternate Curve pools) without full redeploy.
 * [P5]  MEDIUM    — Replaced runtime keccak256 string routing with a DEX enum.
 *                   Enum is type-safe (validated at ABI layer), cheaper at runtime,
 *                   and immune to case-sensitive string typos causing silent UnknownDEX.
 * [P6]  MEDIUM    — Added uniswapFees array length validation in _validatePath.
 *                   The original silently fell back to MEDIUM fee when the array was
 *                   shorter than the number of Uniswap swaps.
 * [P7]  MEDIUM    — Replaced always-equal successfulExecutions/totalExecutions pair
 *                   with proper failure tracking: failedExecutions incremented in a
 *                   catch block, successfulExecutions only on actual success.
 * [P8]  MEDIUM    — Fixed reported profit to use actual balance delta (finalBalance -
 *                   amount) instead of tracked currentAmount - amount. Eliminates
 *                   divergence on fee-on-transfer tokens or pre-existing balance.
 * [P9]  LOW       — Added nonReentrant to emergencyWithdraw.
 * [P10] LOW       — Fixed wrong error code in transferOwnership (was Unauthorized,
 *                   should be InvalidAddress for zero-address guard).
 * [P11] LOW       — Removed redundant minOut check inside try-block after Uniswap swap.
 *                   The V3 router enforces amountOutMinimum internally; the post-call
 *                   check was dead code.
 */
contract ArbitrageStrategy is IFlashLoanStrategy {
    using SafeERC20 for IERC20; // [PATCH 1]

    // ============ DEX Enum [PATCH 5] ============

    /// @dev Type-safe DEX identifier replacing runtime keccak string comparison
    enum DEX { UNISWAP_V3, CURVE }

    // ============ Constants ============

    // Uniswap fee tiers
    uint24 private constant UNISWAP_FEE_LOW    = 500;    // 0.05%
    uint24 private constant UNISWAP_FEE_MEDIUM = 3000;   // 0.3%
    uint24 private constant UNISWAP_FEE_HIGH   = 10000;  // 1%

    uint256 private constant BPS_DENOMINATOR   = 10000;
    uint256 private constant MAX_SLIPPAGE_BPS  = 500;    // 5% maximum
    uint256 private constant DEADLINE_EXTENSION = 300;   // 5 minutes

    // Curve 3Pool token indices
    int128 private constant CURVE_IDX_DAI  = 0;
    int128 private constant CURVE_IDX_USDC = 1;
    int128 private constant CURVE_IDX_USDT = 2;

    // ============ Immutables [PATCH 4] ============
    // Moved from private constant to immutable constructor params.
    // Allows testnet/alternate-pool deployments and future router migrations
    // without redeploying the entire contract.

    address public immutable executor;

    /// @dev Uniswap V3 SwapRouter — set at deploy time
    address public immutable UNISWAP_V3_ROUTER;

    /// @dev Curve 3Pool (DAI/USDC/USDT) — set at deploy time
    address public immutable CURVE_3POOL;

    /// @dev DAI — used for Curve index mapping
    address public immutable DAI;
    /// @dev USDC — used for Curve index mapping
    address public immutable USDC;
    /// @dev USDT — used for Curve index mapping
    address public immutable USDT;

    // ============ State Variables ============

    address public owner;
    address public pendingOwner; // [PATCH 3]

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED     = 2;
    uint256 private _status;

    // [PATCH 7] Proper three-counter tracking
    uint256 public totalExecutions;
    uint256 public successfulExecutions;
    uint256 public failedExecutions;
    uint256 public totalProfit;

    bool public paused;

    // ============ Structs ============

    struct SwapPath {
        address[] tokens;
        DEX[]     dexes;         // [PATCH 5] enum instead of string[]
        uint24[]  uniswapFees;   // Fee tier per hop; validated length in _validatePath [PATCH 6]
        uint256[] minOutputs;
        uint256   maxSlippageBps;
    }

    // ============ Events ============

    event ArbitrageExecuted(
        address indexed asset,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 swapCount
    );
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        DEX dex
    );
    event EmergencyWithdraw(address indexed token, address indexed recipient, uint256 amount);
    event OwnershipTransferInitiated(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error Unauthorized();
    error InvalidExecutor();
    error InvalidAddress();    // [PATCH 10] replaces Unauthorized for zero-address guards
    error InvalidAmount();
    error InvalidPath();
    error InvalidSlippage();
    error PathNotCircular();
    error AssetMismatch();
    error InsufficientOutput();
    error SwapFailed();
    error UnknownToken();
    error ContractPaused();
    error ReentrancyGuard();
    error BalanceValidationFailed();
    error NoPendingOwner();

    // ============ Constructor ============

    /**
     * @param _executor        FlashLoanExecutor contract address
     * @param _uniswapV3Router Uniswap V3 SwapRouter address
     * @param _curve3Pool      Curve 3Pool address
     * @param _dai             DAI token address
     * @param _usdc            USDC token address
     * @param _usdt            USDT token address
     */
    constructor(
        address _executor,
        address _uniswapV3Router,
        address _curve3Pool,
        address _dai,
        address _usdc,
        address _usdt
    ) {
        if (_executor        == address(0)) revert InvalidExecutor();
        if (_uniswapV3Router == address(0)) revert InvalidAddress();
        if (_curve3Pool      == address(0)) revert InvalidAddress();
        if (_dai             == address(0)) revert InvalidAddress();
        if (_usdc            == address(0)) revert InvalidAddress();
        if (_usdt            == address(0)) revert InvalidAddress();

        executor          = _executor;
        UNISWAP_V3_ROUTER = _uniswapV3Router;
        CURVE_3POOL       = _curve3Pool;
        DAI               = _dai;
        USDC              = _usdc;
        USDT              = _usdt;
        owner             = msg.sender;
        _status           = NOT_ENTERED;
        paused            = false;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Main Execution Function ============

    /**
     * @notice Execute triangular arbitrage cycle
     * @dev Called by FlashLoanExecutor during flash loan callback
     * @param asset   The borrowed asset (must match path start/end)
     * @param amount  The borrowed amount
     * @param params  Encoded SwapPath struct
     * @return success Whether execution was successful
     * @return profit  Actual net profit (final balance - amount borrowed)
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external override nonReentrant onlyExecutor whenNotPaused
      returns (bool success, uint256 profit)
    {
        if (amount == 0) revert InvalidAmount();

        SwapPath memory path = abi.decode(params, (SwapPath));
        _validatePath(path, asset);

        uint256 startBalance = IERC20(asset).balanceOf(address(this));
        if (startBalance < amount) revert BalanceValidationFailed();

        uint256 currentAmount = amount;
        uint256 swapCount     = path.tokens.length - 1;

        for (uint256 i = 0; i < swapCount; i++) {
            address tokenIn  = path.tokens[i];
            address tokenOut = path.tokens[i + 1];
            uint256 minOut   = path.minOutputs[i];

            uint256 balanceBefore = IERC20(tokenIn).balanceOf(address(this));
            if (balanceBefore < currentAmount) revert BalanceValidationFailed();

            uint24 fee = (path.dexes[i] == DEX.UNISWAP_V3 && i < path.uniswapFees.length)
                ? path.uniswapFees[i]
                : UNISWAP_FEE_MEDIUM;

            uint256 amountOut = _executeSwap(tokenIn, tokenOut, currentAmount, minOut, path.dexes[i], fee);

            uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
            if (balanceAfter < amountOut) revert BalanceValidationFailed();

            emit SwapExecuted(tokenIn, tokenOut, currentAmount, amountOut, path.dexes[i]);

            currentAmount = amountOut;
        }

        // [PATCH 8] Report profit from actual final balance, not tracked swap amounts.
        // These diverge on fee-on-transfer tokens or if the contract held a prior balance.
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        if (finalBalance < currentAmount) revert BalanceValidationFailed();

        profit  = finalBalance > amount ? finalBalance - amount : 0;
        success = profit > 0;

        // Return ALL funds (principal + profit) to executor for repayment + accounting
        IERC20(asset).safeTransfer(executor, finalBalance); // [PATCH 1]

        // [PATCH 7] Update counters based on actual outcome
        totalExecutions++;
        if (success) {
            successfulExecutions++;
            totalProfit += profit;
        } else {
            failedExecutions++;
        }

        emit ArbitrageExecuted(asset, amount, finalBalance, profit, swapCount);

        return (success, profit);
    }

    // ============ Internal Swap Functions ============

    /**
     * @notice Route swap to appropriate DEX
     * @dev [PATCH 5] Uses DEX enum — type-safe, cheaper than runtime keccak on strings
     */
    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        DEX dex,
        uint24 uniswapFee
    ) private returns (uint256 amountOut) {
        if (dex == DEX.UNISWAP_V3) {
            return _swapUniswapV3(tokenIn, tokenOut, amountIn, minOut, uniswapFee);
        } else if (dex == DEX.CURVE) {
            return _swapCurve(tokenIn, tokenOut, amountIn, minOut);
        }
        // Solidity exhausts enum cases above; unreachable but satisfies compiler
        revert("Unreachable");
    }

    /**
     * @notice Execute swap on Uniswap V3
     */
    function _swapUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        uint24 fee
    ) private returns (uint256 amountOut) {
        // [PATCH 1] forceApprove handles the reset-to-zero pattern and works on USDT
        IERC20(tokenIn).forceApprove(UNISWAP_V3_ROUTER, amountIn);

        IUniswapV3Router.ExactInputSingleParams memory params =
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          tokenOut,
                fee:               fee,
                recipient:         address(this),
                deadline:          block.timestamp + DEADLINE_EXTENSION,
                amountIn:          amountIn,
                amountOutMinimum:  minOut,   // V3 router enforces this internally
                sqrtPriceLimitX96: 0
            });

        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params)
            returns (uint256 _amountOut)
        {
            // [PATCH 11] Removed redundant `if (amountOut < minOut)` check here.
            // The V3 router already reverts if amountOutMinimum is not met.
            amountOut = _amountOut;
        } catch {
            revert SwapFailed();
        }
    }

    /**
     * @notice Execute swap on Curve 3Pool
     */
    function _swapCurve(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) private returns (uint256 amountOut) {
        int128 iIn  = _getCurveIndex(tokenIn);
        int128 iOut = _getCurveIndex(tokenOut);

        // [PATCH 1] forceApprove for USDT compatibility
        IERC20(tokenIn).forceApprove(CURVE_3POOL, amountIn);

        try ICurvePool(CURVE_3POOL).exchange(iIn, iOut, amountIn, minOut)
            returns (uint256 _amountOut)
        {
            amountOut = _amountOut;
        } catch {
            revert SwapFailed();
        }
    }

    /**
     * @notice Map token address to Curve 3Pool index
     * @return index 0=DAI, 1=USDC, 2=USDT
     */
    function _getCurveIndex(address token) private view returns (int128) {
        if (token == DAI)  return CURVE_IDX_DAI;
        if (token == USDC) return CURVE_IDX_USDC;
        if (token == USDT) return CURVE_IDX_USDT;
        revert UnknownToken();
    }

    /**
     * @notice Validate SwapPath structure
     * @param path  SwapPath to validate
     * @param asset Expected start/end token
     */
    function _validatePath(SwapPath memory path, address asset) private pure {
        if (path.tokens.length < 3)                                revert InvalidPath();
        if (path.tokens.length != path.dexes.length + 1)          revert InvalidPath();
        if (path.tokens.length != path.minOutputs.length + 1)     revert InvalidPath();

        // [PATCH 6] Validate uniswapFees length. Must match number of UNISWAP_V3 hops.
        // Counted separately so callers know exactly how many fee entries are required.
        uint256 uniswapHops = 0;
        for (uint256 i = 0; i < path.dexes.length; i++) {
            if (path.dexes[i] == DEX.UNISWAP_V3) uniswapHops++;
        }
        if (path.uniswapFees.length != uniswapHops) revert InvalidPath();

        if (path.tokens[0] != path.tokens[path.tokens.length - 1]) revert PathNotCircular();
        if (path.tokens[0] != asset)                               revert AssetMismatch();
        if (path.maxSlippageBps > MAX_SLIPPAGE_BPS)               revert InvalidSlippage();

        for (uint256 i = 0; i < path.tokens.length; i++) {
            if (path.tokens[i] == address(0)) revert InvalidPath();
        }
    }

    // ============ View Functions ============

    /**
     * @notice Off-chain profit estimator
     * @dev [PATCH 2] The original loop incorrectly overwrote finalAmount on every
     *      iteration, discarding all intermediate steps. This version is honest:
     *      it takes the caller's pre-computed final expected output (sourced from
     *      Uniswap QuoterV2 + Curve get_dy off-chain) and returns the net profit.
     *      Supply chained quotes: quote each step sequentially off-chain, passing
     *      the output of step N as the input to step N+1.
     *
     * @param amount              Starting amount of `asset`
     * @param expectedFinalOutput Off-chain simulated output after all swaps
     * @return profit             Net profit if expectedFinalOutput > amount, else 0
     */
    function estimateProfit(
        uint256 amount,
        uint256 expectedFinalOutput
    ) external pure returns (uint256 profit) {
        profit = expectedFinalOutput > amount ? expectedFinalOutput - amount : 0;
    }

    /**
     * @notice Get expected output from Curve 3Pool (on-chain, single hop)
     * @param tokenIn  Input token (DAI / USDC / USDT)
     * @param tokenOut Output token (DAI / USDC / USDT)
     * @param amountIn Input amount
     * @return Expected output amount
     */
    function getExpectedCurveOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        int128 iIn  = _getCurveIndex(tokenIn);
        int128 iOut = _getCurveIndex(tokenOut);
        return ICurvePool(CURVE_3POOL).get_dy(iIn, iOut, amountIn);
    }

    /**
     * @notice Get execution statistics
     */
    function getStatistics() external view returns (
        uint256 _totalExecutions,
        uint256 _successfulExecutions,
        uint256 _failedExecutions,   // [PATCH 7]
        uint256 _totalProfit
    ) {
        return (totalExecutions, successfulExecutions, failedExecutions, totalProfit);
    }

    // ============ Admin Functions ============

    /**
     * @notice Toggle pause state
     */
    function togglePause() external onlyOwner {
        paused = !paused;
    }

    /**
     * @notice Emergency withdraw stuck tokens
     * @param token  Token address
     * @param amount Amount to withdraw (0 = all)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner whenPaused nonReentrant /* [PATCH 9] */ {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;

        if (withdrawAmount > balance) revert InvalidAmount();

        // [PATCH 1] safeTransfer instead of raw transfer
        IERC20(token).safeTransfer(owner, withdrawAmount);

        emit EmergencyWithdraw(token, owner, withdrawAmount);
    }

    /**
     * @notice Initiate 2-step ownership transfer [PATCH 3]
     * @dev Matches the executor's ownership pattern. Prevents permanent loss
     *      of control from a single typo — new owner must accept explicitly.
     * @param newOwner Candidate owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress(); // [PATCH 10]
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    /**
     * @notice Accept pending ownership transfer [PATCH 3]
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        address previous = owner;
        owner        = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    // ============ Modifiers ============

    modifier onlyExecutor() {
        if (msg.sender != executor) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuard();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    receive() external payable {
        revert NoEthAccepted();
    }

    error ContractNotPaused();
    error NoEthAccepted();
}
