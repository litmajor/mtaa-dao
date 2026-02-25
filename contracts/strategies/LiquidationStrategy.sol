// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IFlashLoanStrategy.sol';
import '../interfaces/IERC20.sol';

/**
 * @title IAavePoolV3
 * @dev Interface for Aave V3 Pool liquidation
 */
interface IAavePoolV3 {
    /**
     * @notice Liquidate a position with a health factor below 1
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param debtAsset The address of the underlying borrowed asset
     * @param user The address of the borrower
     * @param debtToCover The debt amount to cover
     * @param receiveAToken True if liquidator wants to receive aTokens, false for underlying
     */
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;

    /**
     * @notice Returns the user account data across all reserves
     * @param user The address of the user
     * @return totalCollateralBase Total collateral in base currency
     * @return totalDebtBase Total debt in base currency
     * @return availableBorrowsBase Available borrows in base currency
     * @return currentLiquidationThreshold Liquidation threshold
     * @return ltv Loan to value
     * @return healthFactor Current health factor
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );

    /**
     * @notice Returns the configuration of the reserve
     * @param asset The address of the underlying asset
     */
    function getReserveData(address asset)
        external
        view
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress,
            uint128 accruedToTreasury,
            uint128 unbacked,
            uint128 isolationModeTotalDebt
        );
}

/**
 * @title IUniswapV3Router
 * @dev For swapping collateral back to debt asset
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
 * @title LiquidationStrategy V2
 * @dev Secure liquidation execution with complete workflow
 * 
 * Complete Liquidation Flow:
 * 1. Receive flash loan (e.g., 10,000 USDC)
 * 2. Validate position is liquidatable (health factor < 1)
 * 3. Execute liquidation call on Aave
 * 4. Receive collateral with bonus (e.g., 2 ETH worth $11,500)
 * 5. Swap collateral to debt asset (2 ETH → ~11,480 USDC)
 * 6. Return all funds to executor
 * 7. Executor validates profit and repays loan
 * 
 * Security Features:
 * - Health factor validation before liquidation
 * - Balance tracking at each step
 * - Safe approval patterns
 * - Actual collateral swap to debt asset
 * - Slippage protection on swaps
 * - Reentrancy protection via executor
 * - Emergency recovery
 */
contract LiquidationStrategy is IFlashLoanStrategy {
    // ============ Constants ============
    address private constant AAVE_POOL_V3 = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    uint256 private constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1.0
    uint256 private constant MIN_HEALTH_FACTOR = 0.95e18; // Only liquidate if < 0.95
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant MIN_PROFIT_BPS = 50; // 0.5%
    uint256 private constant MAX_SLIPPAGE_BPS = 200; // 2%
    uint256 private constant DEADLINE_EXTENSION = 300; // 5 minutes

    // ============ State Variables ============
    address public immutable executor;
    address public owner;
    
    // Reentrancy guard
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    
    // Statistics
    uint256 public totalLiquidations;
    uint256 public successfulLiquidations;
    uint256 public totalProfit;
    
    // Emergency pause
    bool public paused;

    // ============ Structs ============
    struct LiquidationParams {
        address collateralAsset;
        address debtAsset;
        address userToLiquidate;
        uint256 debtToCover;
        uint24 uniswapFee; // Fee tier for swap (500, 3000, 10000)
        uint256 minCollateralOut; // Minimum collateral to receive
        uint256 minSwapOut; // Minimum debt asset from collateral swap
    }

    // ============ Events ============
    event LiquidationExecuted(
        address indexed user,
        address indexed collateralAsset,
        address indexed debtAsset,
        uint256 debtCovered,
        uint256 collateralReceived,
        uint256 debtFromSwap,
        uint256 profit
    );

    event HealthFactorChecked(
        address indexed user,
        uint256 healthFactor,
        bool liquidatable
    );

    event CollateralSwapped(
        address indexed collateralAsset,
        address indexed debtAsset,
        uint256 collateralAmount,
        uint256 debtReceived
    );

    event LiquidationFailed(
        address indexed user,
        address indexed debtAsset,
        string reason
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
    error InvalidAddress();
    error AssetMismatch();
    error InsufficientLoanAmount();
    error PositionNotLiquidatable();
    error NoCollateralReceived();
    error InsufficientCollateral();
    error SwapFailed();
    error InsufficientProfit();
    error InsufficientBalance();
    error TransferFailed();
    error ContractPaused();
    error ReentrancyGuard();
    error HealthFactorTooHigh();

    // ============ Constructor ============
    
    constructor(address _executor) {
        if (_executor == address(0)) revert InvalidExecutor();
        executor = _executor;
        owner = msg.sender;
        _status = NOT_ENTERED;
        paused = false;
    }

    // ============ Main Execution Function ============

    /**
     * @notice Execute a liquidation with collateral swap
     * @param asset The borrowed asset (flash loan) - must equal debtAsset
     * @param amount The borrowed amount
     * @param params Encoded LiquidationParams struct
     * @return success Whether execution succeeded
     * @return profit Reported profit (executor validates actual)
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external override nonReentrant onlyExecutor whenNotPaused returns (bool success, uint256 profit) {
        if (amount == 0) revert InvalidAmount();

        // Decode parameters
        LiquidationParams memory liqParams = abi.decode(params, (LiquidationParams));
        
        // Validate parameters
        _validateParams(liqParams, asset, amount);
        
        // Verify we received the flash loan
        uint256 startBalance = IERC20(asset).balanceOf(address(this));
        if (startBalance < amount) revert InsufficientBalance();
        
        // Check if position is actually liquidatable
        if (!_isLiquidatable(liqParams.userToLiquidate)) {
            revert PositionNotLiquidatable();
        }
        
        // Execute liquidation workflow
        (uint256 collateralReceived, uint256 debtFromSwap) = _executeLiquidation(liqParams);
        
        // Calculate actual profit
        uint256 totalReceived = startBalance - amount + debtFromSwap; // Original balance - loan + swap proceeds
        profit = totalReceived > startBalance ? totalReceived - startBalance : 0;
        
        // Validate minimum profit
        uint256 minProfit = (amount * MIN_PROFIT_BPS) / BPS_DENOMINATOR;
        if (profit < minProfit) revert InsufficientProfit();
        
        // Transfer all funds back to executor
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        if (!IERC20(asset).transfer(executor, finalBalance)) revert TransferFailed();
        
        // Update statistics
        totalLiquidations++;
        successfulLiquidations++;
        totalProfit += profit;
        
        emit LiquidationExecuted(
            liqParams.userToLiquidate,
            liqParams.collateralAsset,
            liqParams.debtAsset,
            liqParams.debtToCover,
            collateralReceived,
            debtFromSwap,
            profit
        );
        
        return (true, profit);
    }

    // ============ Internal Functions ============

    /**
     * @notice Execute the complete liquidation workflow
     */
    function _executeLiquidation(LiquidationParams memory params)
        private
        returns (uint256 collateralReceived, uint256 debtFromSwap)
    {
        // Step 1: Record collateral balance before liquidation
        uint256 collateralBefore = IERC20(params.collateralAsset).balanceOf(address(this));
        
        // Step 2: Approve Aave to take debt payment
        IERC20(params.debtAsset).approve(AAVE_POOL_V3, 0);
        if (!IERC20(params.debtAsset).approve(AAVE_POOL_V3, params.debtToCover)) {
            revert TransferFailed();
        }
        
        // Step 3: Execute liquidation call
        try IAavePoolV3(AAVE_POOL_V3).liquidationCall(
            params.collateralAsset,
            params.debtAsset,
            params.userToLiquidate,
            params.debtToCover,
            false // Receive underlying collateral, not aToken
        ) {
            // Liquidation successful
        } catch Error(string memory reason) {
            emit LiquidationFailed(params.userToLiquidate, params.debtAsset, reason);
            revert SwapFailed();
        } catch {
            emit LiquidationFailed(params.userToLiquidate, params.debtAsset, "Unknown error");
            revert SwapFailed();
        }
        
        // Step 4: Calculate collateral received
        uint256 collateralAfter = IERC20(params.collateralAsset).balanceOf(address(this));
        collateralReceived = collateralAfter - collateralBefore;
        
        if (collateralReceived == 0) revert NoCollateralReceived();
        if (collateralReceived < params.minCollateralOut) revert InsufficientCollateral();
        
        // Step 5: Swap collateral back to debt asset
        debtFromSwap = _swapCollateralToDebt(
            params.collateralAsset,
            params.debtAsset,
            collateralReceived,
            params.minSwapOut,
            params.uniswapFee
        );
        
        emit CollateralSwapped(
            params.collateralAsset,
            params.debtAsset,
            collateralReceived,
            debtFromSwap
        );
        
        return (collateralReceived, debtFromSwap);
    }

    /**
     * @notice Swap collateral to debt asset via Uniswap V3
     */
    function _swapCollateralToDebt(
        address collateralAsset,
        address debtAsset,
        uint256 collateralAmount,
        uint256 minOut,
        uint24 fee
    ) private returns (uint256 debtReceived) {
        // Safe approval
        IERC20(collateralAsset).approve(UNISWAP_V3_ROUTER, 0);
        if (!IERC20(collateralAsset).approve(UNISWAP_V3_ROUTER, collateralAmount)) {
            revert TransferFailed();
        }

        IUniswapV3Router.ExactInputSingleParams memory swapParams =
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: collateralAsset,
                tokenOut: debtAsset,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + DEADLINE_EXTENSION,
                amountIn: collateralAmount,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            });

        try IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(swapParams) returns (uint256 amountOut) {
            debtReceived = amountOut;
            if (debtReceived < minOut) revert InsufficientBalance();
        } catch {
            revert SwapFailed();
        }

        return debtReceived;
    }

    /**
     * @notice Check if a position is liquidatable
     */
    function _isLiquidatable(address user) private view returns (bool) {
        try IAavePoolV3(AAVE_POOL_V3).getUserAccountData(user) returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256 healthFactor
        ) {
            // Position is liquidatable if health factor < 1.0
            // We use 0.95 threshold to avoid front-running
            bool liquidatable = healthFactor < MIN_HEALTH_FACTOR;
            
            emit HealthFactorChecked(user, healthFactor, liquidatable);
            
            return liquidatable;
        } catch {
            // If we can't read health factor, assume not liquidatable
            return false;
        }
    }

    /**
     * @notice Validate liquidation parameters
     */
    function _validateParams(
        LiquidationParams memory params,
        address asset,
        uint256 amount
    ) private pure {
        if (params.collateralAsset == address(0)) revert InvalidAddress();
        if (params.debtAsset == address(0)) revert InvalidAddress();
        if (params.userToLiquidate == address(0)) revert InvalidAddress();
        if (params.debtToCover == 0) revert InvalidAmount();
        if (params.debtToCover > amount) revert InsufficientLoanAmount();
        if (params.debtAsset != asset) revert AssetMismatch();
        if (params.collateralAsset == params.debtAsset) revert InvalidAddress();
    }

    // ============ View Functions ============

    /**
     * @notice Check if a position is liquidatable (external view)
     * @param user Address to check
     * @return liquidatable Whether position can be liquidated
     * @return healthFactor Current health factor
     */
    function isPositionLiquidatable(address user)
        external
        view
        returns (bool liquidatable, uint256 healthFactor)
    {
        try IAavePoolV3(AAVE_POOL_V3).getUserAccountData(user) returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256 _healthFactor
        ) {
            healthFactor = _healthFactor;
            liquidatable = _healthFactor < MIN_HEALTH_FACTOR;
        } catch {
            healthFactor = type(uint256).max;
            liquidatable = false;
        }
        
        return (liquidatable, healthFactor);
    }

    /**
     * @notice Calculate expected liquidation profit
     * @param debtAmount Amount of debt to cover
     * @param liquidationBonus Liquidation bonus in basis points (e.g., 500 = 5%)
     * @param swapSlippage Expected slippage in basis points
     * @return expectedProfit Net profit after fees and slippage
     */
    function calculateExpectedProfit(
        uint256 debtAmount,
        uint256 liquidationBonus,
        uint256 swapSlippage
    ) external pure returns (uint256 expectedProfit) {
        // Collateral value = debt * (1 + bonus)
        uint256 collateralValue = (debtAmount * (BPS_DENOMINATOR + liquidationBonus)) / BPS_DENOMINATOR;
        
        // Value after swap slippage
        uint256 valueAfterSwap = (collateralValue * (BPS_DENOMINATOR - swapSlippage)) / BPS_DENOMINATOR;
        
        // Profit = value after swap - debt covered
        expectedProfit = valueAfterSwap > debtAmount ? valueAfterSwap - debtAmount : 0;
        
        return expectedProfit;
    }

    /**
     * @notice Get strategy statistics
     */
    function getStatistics() external view returns (
        uint256 _totalLiquidations,
        uint256 _successfulLiquidations,
        uint256 _totalProfit
    ) {
        return (totalLiquidations, successfulLiquidations, totalProfit);
    }

    /**
     * @notice Get user's account data from Aave
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        return IAavePoolV3(AAVE_POOL_V3).getUserAccountData(user);
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

    /**
     * @notice Reject direct ETH transfers
     */
    receive() external payable {
        revert("No ETH accepted");
    }
}