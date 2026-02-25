// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IFlashLoanStrategy.sol';
import '../interfaces/IFlashLoanReceiver.sol';
import '../interfaces/IAavePool.sol';
import '../interfaces/IPoolAddressesProvider.sol';
import '../interfaces/IERC20.sol';

/**
 * @title FlashLoanExecutor V2
 * @dev Secure flash loan orchestrator with comprehensive protections
 * 
 * Security Features:
 * - Validated profit calculations based on actual balances
 * - Reentrancy protection with checks-effects-interactions pattern
 * - Emergency pause mechanism
 * - Maximum loss protection
 * - Strategy whitelist with execution limits
 * - Pull payment pattern for profit withdrawal
 * - Comprehensive event logging
 * 
 * @notice This contract executes flash loan arbitrage strategies on Aave V3
 */
contract FlashLoanExecutor is IFlashLoanReceiver {
    // ============ Constants ============
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant MIN_PROFIT_BPS = 50; // 0.5% minimum profit
    uint256 private constant MAX_LOSS_BPS = 10; // 0.1% maximum acceptable loss
    uint256 private constant EXPECTED_PREMIUM_BPS = 5; // 0.05% Aave fee
    
    // ============ State Variables ============
    address public owner;
    address public pendingOwner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IAavePool public immutable POOL;
    
    // Pause state
    bool public paused;
    
    // Reentrancy guard
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    
    // Strategy management
    mapping(address => StrategyConfig) public strategies;
    
    // Execution tracking
    mapping(bytes32 => ExecutionRecord) public executions;
    uint256 public executionNonce;
    
    // Statistics
    Statistics public stats;
    
    // Profit balances (pull pattern)
    mapping(address => uint256) public profitBalances;
    
    // ============ Structs ============
    
    struct StrategyConfig {
        bool authorized;
        uint256 maxAmount; // Maximum flash loan amount for this strategy
        uint256 executionCount;
        uint256 totalProfit;
        uint256 lastExecuted;
    }
    
    struct ExecutionRecord {
        address asset;
        uint256 amount;
        uint256 premium;
        address strategy;
        uint256 actualProfit;
        uint256 timestamp;
        bool success;
    }
    
    struct Statistics {
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 failedExecutions;
        uint256 totalProfit;
        uint256 totalFeesPaid;
    }
    
    // ============ Events ============
    
    event FlashLoanInitiated(
        bytes32 indexed executionId,
        address indexed asset,
        uint256 amount,
        address indexed strategy
    );
    
    event FlashLoanExecuted(
        bytes32 indexed executionId,
        address indexed asset,
        uint256 amount,
        uint256 actualProfit,
        uint256 premium,
        address indexed strategy
    );
    
    event FlashLoanFailed(
        bytes32 indexed executionId,
        address indexed asset,
        uint256 amount,
        address indexed strategy,
        string reason
    );
    
    event ProfitWithdrawn(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    event StrategyConfigured(
        address indexed strategy,
        bool authorized,
        uint256 maxAmount
    );
    
    event StrategyRevoked(address indexed strategy);
    
    event OwnershipTransferInitiated(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event PauseToggled(bool paused);
    
    event EmergencyWithdraw(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    // ============ Errors ============
    
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error StrategyNotAuthorized();
    error AmountExceedsLimit();
    error ContractPaused();
    error ReentrancyGuard();
    error InsufficientProfit();
    error ExcessiveLoss();
    error PremiumMismatch();
    error BalanceMismatch();
    error TransferFailed();
    error InvalidCaller();
    error InvalidInitiator();
    error NoPendingOwner();
    error InsufficientBalance();
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the FlashLoanExecutor
     * @param _addressesProvider Aave PoolAddressesProvider address
     */
    constructor(address _addressesProvider) {
        if (_addressesProvider == address(0)) revert InvalidAddress();
        
        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressesProvider);
        POOL = IAavePool(IPoolAddressesProvider(_addressesProvider).getPool());
        _status = NOT_ENTERED;
        paused = false;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============ Main Functions ============
    
    /**
     * @notice Execute a flash loan arbitrage strategy
     * @param asset Token address to borrow
     * @param amount Amount to borrow (in token's smallest unit)
     * @param strategy Authorized strategy contract address
     * @param params Strategy-specific encoded parameters
     * @return executionId Unique identifier for this execution
     */
    function executeFlashLoan(
        address asset,
        uint256 amount,
        address strategy,
        bytes calldata params
    ) external onlyOwner whenNotPaused nonReentrant returns (bytes32) {
        // Validations
        if (asset == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        
        StrategyConfig storage config = strategies[strategy];
        if (!config.authorized) revert StrategyNotAuthorized();
        if (amount > config.maxAmount) revert AmountExceedsLimit();
        
        // Generate unique execution ID
        bytes32 executionId = keccak256(
            abi.encode(asset, amount, strategy, executionNonce++, block.timestamp)
        );
        
        emit FlashLoanInitiated(executionId, asset, amount, strategy);
        
        // Prepare flash loan parameters
        address[] memory assets = new address[](1);
        assets[0] = asset;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // No debt mode (repay in same transaction)
        
        bytes memory callbackParams = abi.encode(
            executionId,
            asset,
            amount,
            strategy,
            params
        );
        
        // Execute flash loan
        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            callbackParams,
            0 // referral code
        );
        
        return executionId;
    }
    
    /**
     * @notice Aave callback function - executes during flash loan
     * @dev Called by Aave Pool contract during flash loan execution
     * @param assets Array of borrowed asset addresses
     * @param amounts Array of borrowed amounts
     * @param premiums Array of Aave fees
     * @param initiator Address that initiated the flash loan
     * @param params Encoded execution parameters
     * @return success Must return true for successful execution
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override nonReentrant returns (bool) {
        // Security checks
        if (msg.sender != address(POOL)) revert InvalidCaller();
        if (initiator != address(this)) revert InvalidInitiator();
        if (assets.length != 1 || amounts.length != 1 || premiums.length != 1) {
            revert InvalidAmount();
        }
        
        // Extract parameters
        address asset = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];
        uint256 amountOwed = amount + premium;
        
        (
            bytes32 executionId,
            address paramAsset,
            uint256 paramAmount,
            address strategy,
            bytes memory strategyParams
        ) = abi.decode(params, (bytes32, address, uint256, address, bytes));
        
        // Validate parameters
        if (paramAsset != asset || paramAmount != amount) revert BalanceMismatch();
        
        // Validate premium is within expected range (allow small variation)
        uint256 expectedPremium = (amount * EXPECTED_PREMIUM_BPS) / BPS_DENOMINATOR;
        if (premium > expectedPremium * 110 / 100) revert PremiumMismatch(); // Allow 10% variance
        
        // Record starting balance
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        if (balanceBefore < amount) revert InsufficientBalance();
        
        // Transfer borrowed amount to strategy
        if (!IERC20(asset).transfer(strategy, amount)) revert TransferFailed();
        
        // Execute strategy with error handling
        bool success;
        uint256 reportedProfit;
        string memory failureReason;
        
        try IFlashLoanStrategy(strategy).execute(
            asset,
            amount,
            strategyParams
        ) returns (bool _success, uint256 _profit) {
            success = _success;
            reportedProfit = _profit;
        } catch Error(string memory reason) {
            failureReason = reason;
            success = false;
        } catch (bytes memory) {
            failureReason = "Strategy execution reverted";
            success = false;
        }
        
        // Calculate actual profit/loss based on balances
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        
        // Expected balance after strategy returns funds
        uint256 expectedBalance = balanceBefore - amount + amount; // Should have at least original balance
        
        int256 actualProfitLoss = int256(balanceAfter) - int256(balanceBefore);
        
        if (!success) {
            // Strategy failed - check if we can still repay
            if (balanceAfter < amountOwed) {
                _recordFailure(executionId, asset, amount, premium, strategy, failureReason);
                revert(string(abi.encodePacked("Strategy failed and insufficient balance: ", failureReason)));
            }
            
            // We can repay but took a loss
            _recordFailure(executionId, asset, amount, premium, strategy, failureReason);
            
            // Allow small losses (gas costs, slippage) but revert on large losses
            uint256 maxLoss = (amount * MAX_LOSS_BPS) / BPS_DENOMINATOR;
            if (actualProfitLoss < -int256(maxLoss)) revert ExcessiveLoss();
            
        } else {
            // Strategy reported success - validate profit
            uint256 actualProfit = balanceAfter > amountOwed ? balanceAfter - amountOwed : 0;
            
            // Check minimum profit requirement
            uint256 minProfit = (amount * MIN_PROFIT_BPS) / BPS_DENOMINATOR;
            if (actualProfit < minProfit) revert InsufficientProfit();
            
            // Validate reported profit isn't inflated
            if (reportedProfit > actualProfit) {
                revert("Reported profit exceeds actual profit");
            }
            
            // Record successful execution
            _recordSuccess(executionId, asset, amount, premium, strategy, actualProfit);
            
            // Update strategy stats
            strategies[strategy].executionCount++;
            strategies[strategy].totalProfit += actualProfit;
            strategies[strategy].lastExecuted = block.timestamp;
            
            // Credit profit to owner's balance (pull pattern)
            profitBalances[asset] += actualProfit;
        }
        
        // Approve Aave to reclaim the loan + premium
        // Safe approval: reset to 0 first to handle tokens with approval race condition
        IERC20(asset).approve(address(POOL), 0);
        if (!IERC20(asset).approve(address(POOL), amountOwed)) revert TransferFailed();
        
        return true;
    }
    
    // ============ Profit Management ============
    
    /**
     * @notice Withdraw accumulated profits (pull pattern)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdrawProfit(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (token == address(0)) revert InvalidAddress();
        
        uint256 available = profitBalances[token];
        if (available == 0) revert InsufficientBalance();
        
        uint256 withdrawAmount = amount == 0 ? available : amount;
        if (withdrawAmount > available) revert InsufficientBalance();
        
        // Effects before interaction
        profitBalances[token] -= withdrawAmount;
        
        // Interaction
        if (!IERC20(token).transfer(owner, withdrawAmount)) revert TransferFailed();
        
        emit ProfitWithdrawn(token, owner, withdrawAmount);
    }
    
    /**
     * @notice Get available profit balance for a token
     * @param token Token address
     * @return Available profit amount
     */
    function getAvailableProfit(address token) external view returns (uint256) {
        return profitBalances[token];
    }
    
    // ============ Strategy Management ============
    
    /**
     * @notice Configure a strategy's authorization and limits
     * @param strategy Strategy contract address
     * @param authorized Whether strategy is authorized
     * @param maxAmount Maximum flash loan amount for this strategy
     */
    function configureStrategy(
        address strategy,
        bool authorized,
        uint256 maxAmount
    ) external onlyOwner {
        if (strategy == address(0)) revert InvalidAddress();
        
        strategies[strategy].authorized = authorized;
        strategies[strategy].maxAmount = maxAmount;
        
        emit StrategyConfigured(strategy, authorized, maxAmount);
    }
    
    /**
     * @notice Revoke strategy authorization
     * @param strategy Strategy address to revoke
     */
    function revokeStrategy(address strategy) external onlyOwner {
        strategies[strategy].authorized = false;
        emit StrategyRevoked(strategy);
    }
    
    /**
     * @notice Check if strategy is authorized
     * @param strategy Strategy address
     * @return Whether strategy is authorized
     */
    function isStrategyAuthorized(address strategy) external view returns (bool) {
        return strategies[strategy].authorized;
    }
    
    /**
     * @notice Get strategy configuration
     * @param strategy Strategy address
     * @return config Strategy configuration
     */
    function getStrategyConfig(address strategy) external view returns (StrategyConfig memory) {
        return strategies[strategy];
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Toggle pause state
     */
    function togglePause() external onlyOwner {
        paused = !paused;
        emit PauseToggled(paused);
    }
    
    /**
     * @notice Emergency withdraw - only when paused
     * @param token Token to withdraw
     * @param amount Amount to withdraw (0 = all)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner whenPaused nonReentrant {
        if (token == address(0)) revert InvalidAddress();
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();
        
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();
        
        if (!IERC20(token).transfer(owner, withdrawAmount)) revert TransferFailed();
        
        emit EmergencyWithdraw(token, owner, withdrawAmount);
    }
    
    /**
     * @notice Initiate ownership transfer (2-step process)
     * @param newOwner Address of new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }
    
    /**
     * @notice Accept ownership transfer
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        
        emit OwnershipTransferred(previousOwner, owner);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get execution record
     * @param executionId Execution identifier
     * @return Execution record
     */
    function getExecution(bytes32 executionId) external view returns (ExecutionRecord memory) {
        return executions[executionId];
    }
    
    /**
     * @notice Get overall statistics
     * @return Statistics struct
     */
    function getStatistics() external view returns (Statistics memory) {
        return stats;
    }
    
    /**
     * @notice Get pool address (required by IFlashLoanReceiver)
     * @return Aave pool address
     */
    function POOL() external view override returns (address) {
        return address(POOL);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Record successful execution
     */
    function _recordSuccess(
        bytes32 executionId,
        address asset,
        uint256 amount,
        uint256 premium,
        address strategy,
        uint256 profit
    ) private {
        executions[executionId] = ExecutionRecord({
            asset: asset,
            amount: amount,
            premium: premium,
            strategy: strategy,
            actualProfit: profit,
            timestamp: block.timestamp,
            success: true
        });
        
        stats.totalExecutions++;
        stats.successfulExecutions++;
        stats.totalProfit += profit;
        stats.totalFeesPaid += premium;
        
        emit FlashLoanExecuted(executionId, asset, amount, profit, premium, strategy);
    }
    
    /**
     * @notice Record failed execution
     */
    function _recordFailure(
        bytes32 executionId,
        address asset,
        uint256 amount,
        uint256 premium,
        address strategy,
        string memory reason
    ) private {
        executions[executionId] = ExecutionRecord({
            asset: asset,
            amount: amount,
            premium: premium,
            strategy: strategy,
            actualProfit: 0,
            timestamp: block.timestamp,
            success: false
        });
        
        stats.totalExecutions++;
        stats.failedExecutions++;
        
        emit FlashLoanFailed(executionId, asset, amount, strategy, reason);
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier whenPaused() {
        if (!paused) revert("Contract not paused");
        _;
    }
    
    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuard();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}