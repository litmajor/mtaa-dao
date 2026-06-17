// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../interfaces/IFlashLoanStrategy.sol';
import '../interfaces/IFlashLoanReceiver.sol';
import '../interfaces/IAavePool.sol';
import '../interfaces/IPoolAddressesProvider.sol';

// [PATCH 4] Replace custom IERC20 with OZ's + SafeERC20 + forceApprove support
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// [PATCH 5] SafeCast for safe int256 conversions
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title FlashLoanExecutor V2 (Patched)
 * @dev Secure flash loan orchestrator with comprehensive protections
 *
 * Patch changelog:
 * [P1] CRITICAL  — Removed nonReentrant from executeOperation; added flash-loan-context
 *                  guard instead. The old guard caused a deadlock: executeFlashLoan set
 *                  _status=ENTERED before calling AAVE_POOL.flashLoan(), which then called
 *                  executeOperation(), which immediately reverted on the same guard.
 * [P2] CRITICAL  — Removed _recordFailure() call that preceded an unrecoverable revert.
 *                  All state writes (including _recordFailure) are rolled back on revert,
 *                  so the call was silently discarded and wasted gas.
 * [P3] HIGH      — Removed dead `expectedBalance` variable
 *                  (`balanceBefore - amount + amount` == `balanceBefore`, never read).
 * [P4] HIGH      — Replaced all raw ERC20 transfer/approve calls with SafeERC20 methods
 *                  (safeTransfer, forceApprove). Required for USDT and other non-standard
 *                  tokens that return void or revert on non-zero allowance.
 * [P5] HIGH      — Replaced bare int256 cast with SafeCast.toInt256() to prevent silent
 *                  overflow on large token amounts.
 * [P6] MEDIUM    — _recordFailure now increments stats.totalFeesPaid. Recoverable failures
 *                  still pay the Aave premium; the stat was previously understated.
 * [P7] MEDIUM    — Added whenNotPaused guard to executeOperation for defense-in-depth.
 * [P8] LOW       — Fixed actualProfit calculation. Old formula included pre-existing contract
 *                  balance, inflating profit. Correct formula: (balanceAfter - balanceBefore)
 *                  - premium, which isolates net gain from this operation only.
 *
 * @notice This contract executes flash loan arbitrage strategies on Aave V3
 */
contract FlashLoanExecutor is IFlashLoanReceiver {
    using SafeERC20 for IERC20; // [PATCH 4]
    using SafeCast for uint256;  // [PATCH 5]

    // ============ Constants ============
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant MIN_PROFIT_BPS = 50;       // 0.5% minimum profit
    uint256 private constant MAX_LOSS_BPS = 10;         // 0.1% maximum acceptable loss
    uint256 private constant EXPECTED_PREMIUM_BPS = 5;  // 0.05% Aave fee

    // ============ State Variables ============
    address public owner;
    address public pendingOwner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IAavePool public immutable AAVE_POOL;

    bool public paused;

    // Reentrancy guard — also used as flash-loan-active sentinel (see [P1])
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    mapping(address => StrategyConfig)   public strategies;
    mapping(bytes32 => ExecutionRecord)  public executions;
    uint256 public executionNonce;

    Statistics public stats;

    mapping(address => uint256) public profitBalances;

    // ============ Structs ============

    struct StrategyConfig {
        bool     authorized;
        uint256  maxAmount;
        uint256  executionCount;
        uint256  totalProfit;
        uint256  lastExecuted;
    }

    struct ExecutionRecord {
        address  asset;
        uint256  amount;
        uint256  premium;
        address  strategy;
        uint256  actualProfit;
        uint256  timestamp;
        bool     success;
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
    event ProfitWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event StrategyConfigured(address indexed strategy, bool authorized, uint256 maxAmount);
    event StrategyRevoked(address indexed strategy);
    event OwnershipTransferInitiated(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseToggled(bool paused);
    event EmergencyWithdraw(address indexed token, address indexed recipient, uint256 amount);

    // ============ Errors ============

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error StrategyNotAuthorized();
    error AmountExceedsLimit();
    error ContractPaused();
    error ContractNotPaused();
    error ReentrancyGuard();
    error NotInFlashLoan();       // [PATCH 1] replaces the old guard role on executeOperation
    error InsufficientProfit();
    error ExcessiveLoss();
    error PremiumMismatch();
    error BalanceMismatch();
    error InvalidCaller();
    error InvalidInitiator();
    error NoPendingOwner();
    error InsufficientBalance();
    error ReportedProfitExceedsActual(uint256 reported, uint256 actual);

    // ============ Constructor ============

    constructor(address _addressesProvider) {
        if (_addressesProvider == address(0)) revert InvalidAddress();

        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressesProvider);
        AAVE_POOL = IAavePool(IPoolAddressesProvider(_addressesProvider).getPool());
        _status = NOT_ENTERED;
        paused = false;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Main Functions ============

    /**
     * @notice Execute a flash loan arbitrage strategy
     * @param asset    Token address to borrow
     * @param amount   Amount to borrow (token's smallest unit)
     * @param strategy Authorized strategy contract address
     * @param params   Strategy-specific encoded parameters
     * @return executionId Unique identifier for this execution
     */
    function executeFlashLoan(
        address asset,
        uint256 amount,
        address strategy,
        bytes calldata params
    ) external onlyOwner whenNotPaused nonReentrant returns (bytes32) {
        if (asset == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        StrategyConfig storage config = strategies[strategy];
        if (!config.authorized) revert StrategyNotAuthorized();
        if (amount > config.maxAmount) revert AmountExceedsLimit();

        bytes32 executionId = keccak256(
            abi.encode(asset, amount, strategy, executionNonce++, block.timestamp)
        );

        emit FlashLoanInitiated(executionId, asset, amount, strategy);

        address[]  memory assets  = new address[](1);
        uint256[]  memory amounts = new uint256[](1);
        uint256[]  memory modes   = new uint256[](1);
        assets[0]  = asset;
        amounts[0] = amount;
        modes[0]   = 0; // no-debt mode — repay in same tx

        bytes memory callbackParams = abi.encode(executionId, asset, amount, strategy, params);

        // _status == ENTERED here; executeOperation uses this as its active-flash-loan
        // sentinel (see [P1]) — do NOT add nonReentrant to executeOperation.
        AAVE_POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            callbackParams,
            0
        );

        return executionId;
    }

    /**
     * @notice Aave V3 callback — executes during the flash loan
     * @dev [P1] nonReentrant is intentionally absent here. Adding it caused a deadlock:
     *      executeFlashLoan sets _status=ENTERED before calling Aave, then Aave calls back
     *      into this function, which would revert on the same guard. Protection is provided
     *      by (a) the notInFlashLoan sentinel, (b) msg.sender == AAVE_POOL, and
     *      (c) initiator == address(this).
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override whenNotPaused /* [P7] */ returns (bool) {
        // [P1] Must be called within an active flash loan initiated by this contract
        if (_status != ENTERED)             revert NotInFlashLoan();
        if (msg.sender != address(AAVE_POOL)) revert InvalidCaller();
        if (initiator != address(this))     revert InvalidInitiator();
        if (assets.length != 1 || amounts.length != 1 || premiums.length != 1)
            revert InvalidAmount();

        address asset    = assets[0];
        uint256 amount   = amounts[0];
        uint256 premium  = premiums[0];
        uint256 amountOwed = amount + premium;

        (
            bytes32 executionId,
            address paramAsset,
            uint256 paramAmount,
            address strategy,
            bytes memory strategyParams
        ) = abi.decode(params, (bytes32, address, uint256, address, bytes));

        if (paramAsset != asset || paramAmount != amount) revert BalanceMismatch();

        uint256 expectedPremium = (amount * EXPECTED_PREMIUM_BPS) / BPS_DENOMINATOR;
        if (premium > expectedPremium * 110 / 100) revert PremiumMismatch();

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        if (balanceBefore < amount) revert InsufficientBalance();

        // [PATCH 4] safeTransfer instead of raw transfer
        IERC20(asset).safeTransfer(strategy, amount);

        // Execute strategy
        bool success;
        uint256 reportedProfit;
        string memory failureReason;

        try IFlashLoanStrategy(strategy).execute(asset, amount, strategyParams)
            returns (bool _success, uint256 _profit)
        {
            success        = _success;
            reportedProfit = _profit;
        } catch Error(string memory reason) {
            failureReason = reason;
            success       = false;
        } catch (bytes memory) {
            failureReason = "Strategy execution reverted";
            success       = false;
        }

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));

        // [PATCH 5] Safe int256 cast — prevents silent overflow on large amounts
        int256 actualProfitLoss = balanceAfter.toInt256() - balanceBefore.toInt256();

        if (!success) {
            // [PATCH 2] Removed _recordFailure() before the hard revert.
            // State writes are rolled back on revert so the old call was silently discarded.
            if (balanceAfter < amountOwed) {
                revert(string(abi.encodePacked(
                    "Strategy failed, insufficient balance to repay: ", failureReason
                )));
            }

            // Recoverable: strategy failed but we can still repay Aave
            uint256 maxLoss = (amount * MAX_LOSS_BPS) / BPS_DENOMINATOR;
            if (actualProfitLoss < -maxLoss.toInt256()) revert ExcessiveLoss();

            _recordFailure(executionId, asset, amount, premium, strategy, failureReason);

        } else {
            // [PATCH 8] Correct net-profit formula:
            //   Old: balanceAfter - amountOwed  (included pre-existing contract balance)
            //   New: (balanceAfter - balanceBefore) - premium
            //        balanceBefore already contains the loaned `amount`, so the delta is
            //        purely the strategy gain; subtract the Aave fee for true net profit.
            uint256 actualProfit = 0;
            if (balanceAfter > balanceBefore + premium) {
                actualProfit = (balanceAfter - balanceBefore) - premium;
            }

            uint256 minProfit = (amount * MIN_PROFIT_BPS) / BPS_DENOMINATOR;
            if (actualProfit < minProfit) revert InsufficientProfit();

            if (reportedProfit > actualProfit) {
                revert ReportedProfitExceedsActual(reportedProfit, actualProfit);
            }

            _recordSuccess(executionId, asset, amount, premium, strategy, actualProfit);

            strategies[strategy].executionCount++;
            strategies[strategy].totalProfit    += actualProfit;
            strategies[strategy].lastExecuted    = block.timestamp;

            profitBalances[asset] += actualProfit;
        }

        // [PATCH 4] forceApprove handles the reset-to-zero pattern internally,
        //           and works correctly with USDT-style non-standard tokens.
        IERC20(asset).forceApprove(address(AAVE_POOL), amountOwed);

        return true;
    }

    // ============ Profit Management ============

    function withdrawProfit(address token, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0)) revert InvalidAddress();

        uint256 available = profitBalances[token];
        if (available == 0) revert InsufficientBalance();

        uint256 withdrawAmount = amount == 0 ? available : amount;
        if (withdrawAmount > available) revert InsufficientBalance();

        profitBalances[token] -= withdrawAmount;

        // [PATCH 4]
        IERC20(token).safeTransfer(owner, withdrawAmount);

        emit ProfitWithdrawn(token, owner, withdrawAmount);
    }

    function getAvailableProfit(address token) external view returns (uint256) {
        return profitBalances[token];
    }

    // ============ Strategy Management ============

    function configureStrategy(
        address strategy,
        bool authorized,
        uint256 maxAmount
    ) external onlyOwner {
        if (strategy == address(0)) revert InvalidAddress();
        strategies[strategy].authorized = authorized;
        strategies[strategy].maxAmount  = maxAmount;
        emit StrategyConfigured(strategy, authorized, maxAmount);
    }

    function revokeStrategy(address strategy) external onlyOwner {
        strategies[strategy].authorized = false;
        emit StrategyRevoked(strategy);
    }

    function isStrategyAuthorized(address strategy) external view returns (bool) {
        return strategies[strategy].authorized;
    }

    function getStrategyConfig(address strategy) external view returns (StrategyConfig memory) {
        return strategies[strategy];
    }

    // ============ Admin Functions ============

    function togglePause() external onlyOwner {
        paused = !paused;
        emit PauseToggled(paused);
    }

    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner whenPaused nonReentrant {
        if (token == address(0)) revert InvalidAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert InsufficientBalance();

        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();

        // [PATCH 4]
        IERC20(token).safeTransfer(owner, withdrawAmount);

        emit EmergencyWithdraw(token, owner, withdrawAmount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        address previousOwner = owner;
        owner        = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    // ============ View Functions ============

    function getExecution(bytes32 executionId) external view returns (ExecutionRecord memory) {
        return executions[executionId];
    }

    function getStatistics() external view returns (Statistics memory) {
        return stats;
    }

    function POOL() external view override returns (address) {
        return address(AAVE_POOL);
    }

    // ============ Internal Functions ============

    function _recordSuccess(
        bytes32 executionId,
        address asset,
        uint256 amount,
        uint256 premium,
        address strategy,
        uint256 profit
    ) private {
        executions[executionId] = ExecutionRecord({
            asset:        asset,
            amount:       amount,
            premium:      premium,
            strategy:     strategy,
            actualProfit: profit,
            timestamp:    block.timestamp,
            success:      true
        });

        stats.totalExecutions++;
        stats.successfulExecutions++;
        stats.totalProfit   += profit;
        stats.totalFeesPaid += premium;

        emit FlashLoanExecuted(executionId, asset, amount, profit, premium, strategy);
    }

    function _recordFailure(
        bytes32 executionId,
        address asset,
        uint256 amount,
        uint256 premium,
        address strategy,
        string memory reason
    ) private {
        executions[executionId] = ExecutionRecord({
            asset:        asset,
            amount:       amount,
            premium:      premium,
            strategy:     strategy,
            actualProfit: 0,
            timestamp:    block.timestamp,
            success:      false
        });

        stats.totalExecutions++;
        stats.failedExecutions++;
        stats.totalFeesPaid += premium; // [PATCH 6] track fee even on recoverable failures

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
        if (!paused) revert ContractNotPaused();
        _;
    }

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuard();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}
