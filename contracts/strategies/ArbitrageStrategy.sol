// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IFlashLoanStrategy.sol';
import '../interfaces/IERC20.sol';

/**
 * @title IUniswapV3Router
 * @dev Minimal Uniswap V3 Router interface for swaps
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/**
 * @title ICurvePool
 * @dev Minimal Curve Pool interface
 */
interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
}

/**
 * @title ArbitrageStrategy V2
 * @dev Secure triangular arbitrage execution across multiple DEXes
 * 
 * Security improvements:
 * - Reentrancy protection
 * - Access control (executor-only)
 * - Safe approval pattern
 * - Balance validation at each step
 * - Emergency recovery
 * - Comprehensive error handling
 * - Gas optimization
 * 
 * Example flow: USDC → USDT → DAI → USDC
 * 1. Receive flash loan funds from executor
 * 2. Execute swap sequence with slippage protection
 * 3. Return all funds to executor
 * 4. Executor validates actual profit
 */
contract ArbitrageStrategy is IFlashLoanStrategy {
    // ============ Constants ============
    address private constant UNISWAP_V3_ROUTER =
        0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant CURVE_3POOL = 
        0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7;
    
    // Token addresses (Ethereum mainnet)
    address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    // Uniswap fee tiers
    uint24 private constant UNISWAP_FEE_LOW = 500; // 0.05%
    uint24 private constant UNISWAP_FEE_MEDIUM = 3000; // 0.3%
    uint24 private constant UNISWAP_FEE_HIGH = 10000; // 1%

    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant MAX_SLIPPAGE_BPS = 500; // 5% maximum
    uint256 private constant DEADLINE_EXTENSION = 300; // 5 minutes

    // ============ State Variables ============
    address public immutable executor;
    address public owner;
    
    // Reentrancy guard
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    
    // Execution tracking
    uint256 public totalExecutions;
    uint256 public successfulExecutions;
    uint256 public totalProfit;
    
    // Emergency pause
    bool public paused;

    // ============ Structs ============
    struct SwapPath {
        address[] tokens;
        string[] dexes;
        uint24[] uniswapFees; // Fee tier for each Uniswap swap
        uint256[] minOutputs;
        uint256 maxSlippageBps;
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
        string dex
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    // ============ Errors ============
    error Unauthorized();
    error InvalidExecutor();
    error InvalidAmount();
    error InvalidPath();
    error InvalidSlippage();
    error PathNotCircular();
    error AssetMismatch();
    error InsufficientOutput();
    error SwapFailed();
    error TransferFailed();
    error UnknownDEX();
    error UnknownToken();
    error ContractPaused();
    error ReentrancyGuard();
    error BalanceValidationFailed();

    // ============ Constructor ============
    
    /**
     * @notice Initialize strategy with executor address
     * @param _executor Address of FlashLoanExecutor contract
     */
    constructor(address _executor) {
        if (_executor == address(0)) revert InvalidExecutor();
        executor = _executor;
        owner = msg.sender;
        _status = NOT_ENTERED;
        paused = false;
    }

    // ============ Main Execution Function ============

    /**
     * @notice Execute triangular arbitrage cycle
     * @dev Called by FlashLoanExecutor during flash loan callback
     * @param asset The borrowed asset (must match path start/end)
     * @param amount The borrowed amount
     * @param params Encoded SwapPath struct
     * @return success Whether execution was successful
     * @return profit Reported profit (executor validates actual profit)
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external override nonReentrant onlyExecutor whenNotPaused returns (bool success, uint256 profit) {
        if (amount == 0) revert InvalidAmount();
        
        // Decode swap path
        SwapPath memory path = abi.decode(params, (SwapPath));
        
        // Validate path structure
        _validatePath(path, asset);
        
        // Verify we received the funds
        uint256 startBalance = IERC20(asset).balanceOf(address(this));
        if (startBalance < amount) revert BalanceValidationFailed();
        
        // Execute swap sequence
        uint256 currentAmount = amount;
        
        for (uint256 i = 0; i < path.tokens.length - 1; i++) {
            address tokenIn = path.tokens[i];
            address tokenOut = path.tokens[i + 1];
            uint256 minOut = path.minOutputs[i];
            
            // Validate balance before swap
            uint256 balanceBefore = IERC20(tokenIn).balanceOf(address(this));
            if (balanceBefore < currentAmount) revert BalanceValidationFailed();
            
            // Execute swap based on DEX
            uint256 amountOut = _executeSwap(
                tokenIn,
                tokenOut,
                currentAmount,
                minOut,
                path.dexes[i],
                i < path.uniswapFees.length ? path.uniswapFees[i] : UNISWAP_FEE_MEDIUM
            );
            
            // Validate output
            if (amountOut < minOut) revert InsufficientOutput();
            
            // Validate balance after swap
            uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
            if (balanceAfter < amountOut) revert BalanceValidationFailed();
            
            emit SwapExecuted(tokenIn, tokenOut, currentAmount, amountOut, path.dexes[i]);
            
            currentAmount = amountOut;
        }
        
        // Calculate profit (final amount - initial amount)
        profit = currentAmount > amount ? currentAmount - amount : 0;
        
        // Transfer ALL tokens back to executor (not just profit)
        // Executor will validate actual profit and handle repayment
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        if (finalBalance < currentAmount) revert BalanceValidationFailed();
        
        if (!IERC20(asset).transfer(executor, finalBalance)) revert TransferFailed();
        
        // Update statistics
        totalExecutions++;
        successfulExecutions++;
        totalProfit += profit;
        
        emit ArbitrageExecuted(asset, amount, currentAmount, profit, path.tokens.length - 1);
        
        return (true, profit);
    }

    // ============ Internal Swap Functions ============

    /**
     * @notice Route swap to appropriate DEX
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @param minOut Minimum output
     * @param dexName DEX identifier
     * @param uniswapFee Fee tier for Uniswap (ignored for other DEXes)
     * @return amountOut Actual output amount
     */
    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        string memory dexName,
        uint24 uniswapFee
    ) private returns (uint256 amountOut) {
        bytes32 dexHash = keccak256(bytes(dexName));
        
        if (dexHash == keccak256(bytes("uniswap")) || dexHash == keccak256(bytes("uniswapv3"))) {
            return _swapUniswapV3(tokenIn, tokenOut, amountIn, minOut, uniswapFee);
        } else if (dexHash == keccak256(bytes("curve"))) {
            return _swapCurve(tokenIn, tokenOut, amountIn, minOut);
        } else {
            revert UnknownDEX();
        }
    }

    /**
     * @notice Execute swap on Uniswap V3
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param minOut Minimum output amount
     * @param fee Fee tier to use
     * @return amountOut Output amount received
     */
    function _swapUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        uint24 fee
    ) private returns (uint256 amountOut) {
        // Safe approval pattern: reset to 0 first
        IERC20(tokenIn).approve(UNISWAP_V3_ROUTER, 0);
        if (!IERC20(tokenIn).approve(UNISWAP_V3_ROUTER, amountIn)) {
            revert TransferFailed();
        }

        IUniswapV3Router.ExactInputSingleParams memory params =
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + DEADLINE_EXTENSION,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0 // No price limit
            });

        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params) returns (uint256 _amountOut) {
            amountOut = _amountOut;
            if (amountOut < minOut) revert InsufficientOutput();
        } catch {
            revert SwapFailed();
        }

        return amountOut;
    }

    /**
     * @notice Execute swap on Curve stablecoin pool
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @param minOut Minimum output
     * @return amountOut Output amount received
     */
    function _swapCurve(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) private returns (uint256 amountOut) {
        int128 iIn = _getCurveIndex(tokenIn);
        int128 iOut = _getCurveIndex(tokenOut);

        // Safe approval pattern
        IERC20(tokenIn).approve(CURVE_3POOL, 0);
        if (!IERC20(tokenIn).approve(CURVE_3POOL, amountIn)) {
            revert TransferFailed();
        }

        try ICurvePool(CURVE_3POOL).exchange(iIn, iOut, amountIn, minOut) returns (uint256 _amountOut) {
            amountOut = _amountOut;
            if (amountOut < minOut) revert InsufficientOutput();
        } catch {
            revert SwapFailed();
        }

        return amountOut;
    }

    /**
     * @notice Get Curve 3Pool token index
     * @param token Token address
     * @return index Pool index (0=DAI, 1=USDC, 2=USDT)
     */
    function _getCurveIndex(address token) private pure returns (int128) {
        if (token == DAI) return 0;
        if (token == USDC) return 1;
        if (token == USDT) return 2;
        revert UnknownToken();
    }

    /**
     * @notice Validate swap path structure
     * @param path Swap path to validate
     * @param asset Expected start/end asset
     */
    function _validatePath(SwapPath memory path, address asset) private pure {
        // Must have at least 3 tokens (2 swaps minimum)
        if (path.tokens.length < 3) revert InvalidPath();
        
        // Arrays must have correct lengths
        if (path.tokens.length != path.dexes.length + 1) revert InvalidPath();
        if (path.tokens.length != path.minOutputs.length + 1) revert InvalidPath();
        
        // Path must be circular
        if (path.tokens[0] != path.tokens[path.tokens.length - 1]) revert PathNotCircular();
        
        // Start asset must match
        if (path.tokens[0] != asset) revert AssetMismatch();
        
        // Validate slippage
        if (path.maxSlippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage();
        
        // Validate no zero addresses
        for (uint256 i = 0; i < path.tokens.length; i++) {
            if (path.tokens[i] == address(0)) revert InvalidPath();
        }
    }

    // ============ View Functions ============

    /**
     * @notice Simulate arbitrage profitability (off-chain helper)
     * @param path Token path
     * @param amount Starting amount
     * @param expectedOutputs Expected output at each step
     * @return finalAmount Final amount after all swaps
     * @return profit Net profit
     */
    function simulateArbitrage(
        address[] calldata path,
        uint256 amount,
        uint256[] calldata expectedOutputs
    ) external pure returns (uint256 finalAmount, uint256 profit) {
        if (path.length != expectedOutputs.length + 1) revert InvalidPath();

        finalAmount = amount;
        for (uint256 i = 0; i < expectedOutputs.length; i++) {
            finalAmount = expectedOutputs[i];
        }

        profit = finalAmount > amount ? finalAmount - amount : 0;
        return (finalAmount, profit);
    }

    /**
     * @notice Get expected output from Curve pool (view function)
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return Expected output amount
     */
    function getExpectedCurveOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        int128 iIn = _getCurveIndex(tokenIn);
        int128 iOut = _getCurveIndex(tokenOut);
        return ICurvePool(CURVE_3POOL).get_dy(iIn, iOut, amountIn);
    }

    /**
     * @notice Get strategy statistics
     */
    function getStatistics() external view returns (
        uint256 _totalExecutions,
        uint256 _successfulExecutions,
        uint256 _totalProfit
    ) {
        return (totalExecutions, successfulExecutions, totalProfit);
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
     * @param token Token address
     * @param amount Amount to withdraw (0 = all)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner whenPaused {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        
        if (withdrawAmount > balance) revert InvalidAmount();
        if (!IERC20(token).transfer(owner, withdrawAmount)) revert TransferFailed();
        
        emit EmergencyWithdraw(token, owner, withdrawAmount);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        owner = newOwner;
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
        if (!paused) revert("Not paused");
        _;
    }

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuard();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    // ============ Receive Function ============
    
    /**
     * @notice Reject direct ETH transfers
     */
    receive() external payable {
        revert("No ETH accepted");
    }
}