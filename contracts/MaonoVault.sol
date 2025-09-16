// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/**
 * @title MaonoVault (Flagship ERC4626 Vault for MtaaDAO)
 * @notice Professionally managed, community-backed crypto vault
 * @dev Enhanced with security improvements and better fee handling
 * @author MtaaDAO Team
 */
contract MaonoVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Vault Parameters ---
    uint256 public minDeposit = 10 * 1e18; // 10 cUSD (assuming 18 decimals)
    uint256 public vaultCap = 10_000 * 1e18; // 10,000 cUSD
    uint256 public performanceFee = 1500; // 15% (basis points)
    uint256 public managementFee = 200; // 2% annual (basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Fee limits for security
    uint256 public constant MAX_PERFORMANCE_FEE = 2000; // 20%
    uint256 public constant MAX_MANAGEMENT_FEE = 500; // 5% annual

    address public manager;
    address public daoTreasury;

    // NAV tracking
    uint256 public lastNAV;
    uint256 public lastNAVUpdate;
    uint256 public lastManagementFeeCollection;

    // Fee tracking
    uint256 public totalPerformanceFeesCollected;
    uint256 public totalManagementFeesCollected;

    // Platform fee tracking
    mapping(string => uint256) public daoFees;
    mapping(string => bool) public validDAOs;

    // Withdrawal queue for large redemptions
    struct WithdrawalRequest {
        address user;
        uint256 shares;
        uint256 requestTime;
        bool fulfilled;
    }

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public withdrawalRequestCounter;
    uint256 public withdrawalDelay = 1 days; // 24 hour delay for large withdrawals
    uint256 public largeWithdrawalThreshold = 1000 * 1e18; // 1000 cUSD

    // Events
    event NAVUpdated(uint256 newNAV, uint256 timestamp, address updatedBy);
    event PerformanceFeeChanged(uint256 oldFee, uint256 newFee);
    event ManagementFeeChanged(uint256 oldFee, uint256 newFee);
    event VaultCapChanged(uint256 oldCap, uint256 newCap);
    event ManagerChanged(address oldManager, address newManager);
    event PerformanceFeeCollected(uint256 amount, uint256 timestamp);
    event ManagementFeeCollected(uint256 amount, uint256 timestamp);
    event WithdrawalRequested(uint256 requestId, address user, uint256 shares);
    event WithdrawalFulfilled(uint256 requestId, address user, uint256 shares, uint256 assets);
    event PlatformFeeRecorded(string indexed daoId, uint256 feeAmount, uint256 timestamp);
    event DAOValidated(string indexed daoId, bool isValid);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    // Custom errors
    error BelowMinDeposit(uint256 provided, uint256 minimum);
    error VaultCapExceeded(uint256 requested, uint256 available);
    error NotManager();
    error ZeroAddress();
    error InvalidFee(uint256 provided, uint256 maximum);
    error InsufficientBalance(uint256 requested, uint256 available);
    error NoProfit();
    error InvalidNAV();
    error CapBelowTVL(uint256 newCap, uint256 currentTVL);
    error WithdrawalNotReady(uint256 requestTime, uint256 currentTime);
    error WithdrawalAlreadyFulfilled();
    error InvalidDAO(string daoId);
    error InvalidFeeAmount();

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    modifier validDAO(string memory daoId) {
        if (!validDAOs[daoId]) revert InvalidDAO(daoId);
        _;
    }

    constructor(
        address _asset,
        address _daoTreasury,
        address _manager,
        string[] memory _initialDAOs
    ) 
        ERC20("Maono Vault LP Token", "MVLT") 
        ERC4626(IERC20(_asset)) 
        Ownable(_manager) 
        validAddress(_asset)
        validAddress(_daoTreasury)
        validAddress(_manager)
    {
        daoTreasury = _daoTreasury;
        manager = _manager;
        lastManagementFeeCollection = block.timestamp;
        
        // Initialize valid DAOs
        for (uint256 i = 0; i < _initialDAOs.length; i++) {
            validDAOs[_initialDAOs[i]] = true;
            emit DAOValidated(_initialDAOs[i], true);
        }
    }

    // --- Enhanced Deposit/Withdraw ---
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        if (assets < minDeposit) revert BelowMinDeposit(assets, minDeposit);
        uint256 currentAssets = totalAssets();
        if (currentAssets + assets > vaultCap) {
            revert VaultCapExceeded(assets, vaultCap - currentAssets);
        }

        // Collect management fees before deposit to ensure accurate share calculation
        _collectManagementFees();

        return super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) 
        public 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 shares) 
    {
        // For large withdrawals, use the delayed withdrawal mechanism
        if (assets >= largeWithdrawalThreshold) {
            shares = previewWithdraw(assets);
            _requestWithdrawal(owner, shares);
            return shares;
        }

        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) 
        public 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 assets) 
    {
        assets = previewRedeem(shares);

        // For large redemptions, use the delayed withdrawal mechanism
        if (assets >= largeWithdrawalThreshold) {
            _requestWithdrawal(owner, shares);
            return assets;
        }

        return super.redeem(shares, receiver, owner);
    }

    // --- Withdrawal Queue Management ---
    function _requestWithdrawal(address user, uint256 shares) internal {
        withdrawalRequestCounter++;
        withdrawalRequests[withdrawalRequestCounter] = WithdrawalRequest({
            user: user,
            shares: shares,
            requestTime: block.timestamp,
            fulfilled: false
        });

        emit WithdrawalRequested(withdrawalRequestCounter, user, shares);
    }

    function fulfillWithdrawal(uint256 requestId) external nonReentrant whenNotPaused {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        if (request.user != msg.sender) revert NotManager();
        if (request.fulfilled) revert WithdrawalAlreadyFulfilled();
        if (block.timestamp < request.requestTime + withdrawalDelay) {
            revert WithdrawalNotReady(request.requestTime, block.timestamp);
        }

        request.fulfilled = true;
        uint256 assets = previewRedeem(request.shares);

        // Check if vault has sufficient assets
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < assets) {
            revert InsufficientBalance(assets, vaultBalance);
        }

        _burn(request.user, request.shares);
        IERC20(asset()).safeTransfer(request.user, assets);

        emit WithdrawalFulfilled(requestId, request.user, request.shares, assets);
    }

    // --- NAV Management ---
    function updateNAV(uint256 newNAV) external onlyManager {
        if (newNAV == 0) revert InvalidNAV();

        // Calculate and collect performance fees if NAV increased
        if (lastNAV > 0 && newNAV > lastNAV) {
            _collectPerformanceFees(newNAV - lastNAV);
        }

        lastNAV = newNAV;
        lastNAVUpdate = block.timestamp;
        emit NAVUpdated(newNAV, block.timestamp, msg.sender);
    }

    function previewNAV() external view returns (uint256 nav, uint256 lastUpdate) {
        return (lastNAV, lastNAVUpdate);
    }

    // --- Fee Management ---
    function _collectPerformanceFees(uint256 profit) internal {
        if (profit == 0) return;
        
        uint256 fee = (profit * performanceFee) / FEE_DENOMINATOR;
        if (fee > 0) {
            uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
            if (vaultBalance >= fee) {
                IERC20(asset()).safeTransfer(daoTreasury, fee);
                totalPerformanceFeesCollected += fee;
                emit PerformanceFeeCollected(fee, block.timestamp);
            }
        }
    }

    function _collectManagementFees() internal {
        uint256 timeElapsed = block.timestamp - lastManagementFeeCollection;
        if (timeElapsed == 0) return;

        uint256 totalAssets_ = totalAssets();
        if (totalAssets_ == 0) return;

        uint256 annualFee = (totalAssets_ * managementFee) / FEE_DENOMINATOR;
        uint256 fee = (annualFee * timeElapsed) / SECONDS_PER_YEAR;

        if (fee > 0) {
            uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
            if (vaultBalance >= fee) {
                IERC20(asset()).safeTransfer(daoTreasury, fee);
                totalManagementFeesCollected += fee;
                emit ManagementFeeCollected(fee, block.timestamp);
            }
        }
        
        lastManagementFeeCollection = block.timestamp;
    }

    function collectManagementFees() external onlyManager {
        _collectManagementFees();
    }

    // --- Platform Fee Management ---
    function recordPlatformFee(string memory daoId, uint256 feeAmount) 
        external 
        onlyManager 
        validDAO(daoId)
    {
        if (feeAmount == 0) revert InvalidFeeAmount();
        
        daoFees[daoId] += feeAmount;
        emit PlatformFeeRecorded(daoId, feeAmount, block.timestamp);
    }

    function addValidDAO(string memory daoId) external onlyOwner {
        require(bytes(daoId).length > 0, "DAO ID cannot be empty");
        validDAOs[daoId] = true;
        emit DAOValidated(daoId, true);
    }

    function removeValidDAO(string memory daoId) external onlyOwner {
        validDAOs[daoId] = false;
        emit DAOValidated(daoId, false);
    }

    // --- Admin Functions ---
    function setPerformanceFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_PERFORMANCE_FEE) revert InvalidFee(newFee, MAX_PERFORMANCE_FEE);
        uint256 oldFee = performanceFee;
        performanceFee = newFee;
        emit PerformanceFeeChanged(oldFee, newFee);
    }

    function setManagementFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_MANAGEMENT_FEE) revert InvalidFee(newFee, MAX_MANAGEMENT_FEE);
        uint256 oldFee = managementFee;
        managementFee = newFee;
        emit ManagementFeeChanged(oldFee, newFee);
    }

    function setVaultCap(uint256 newCap) external onlyOwner {
        uint256 currentTVL = totalAssets();
        if (newCap < currentTVL) revert CapBelowTVL(newCap, currentTVL);
        uint256 oldCap = vaultCap;
        vaultCap = newCap;
        emit VaultCapChanged(oldCap, newCap);
    }

    function setManager(address newManager) external onlyOwner validAddress(newManager) {
        address oldManager = manager;
        manager = newManager;
        emit ManagerChanged(oldManager, newManager);
    }

    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        minDeposit = newMinDeposit;
    }

    function setWithdrawalDelay(uint256 newDelay) external onlyOwner {
        withdrawalDelay = newDelay;
    }

    function setLargeWithdrawalThreshold(uint256 newThreshold) external onlyOwner {
        largeWithdrawalThreshold = newThreshold;
    }

    function setDAOTreasury(address newTreasury) external onlyOwner validAddress(newTreasury) {
        daoTreasury = newTreasury;
    }

    // --- Emergency Functions ---
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (amount > vaultBalance) revert InsufficientBalance(amount, vaultBalance);
        
        IERC20(asset()).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(owner(), amount);
    }

    // --- View Functions ---
    function totalAssets() public view override returns (uint256) {
        // In a real implementation, this would aggregate assets from various strategies
        return IERC20(asset()).balanceOf(address(this));
    }

    function getWithdrawalRequest(uint256 requestId) external view returns (WithdrawalRequest memory) {
        return withdrawalRequests[requestId];
    }

    function getFeeInfo() external view returns (
        uint256 perfFee,
        uint256 mgmtFee,
        uint256 totalPerfFeesCollected,
        uint256 totalMgmtFeesCollected
    ) {
        return (performanceFee, managementFee, totalPerformanceFeesCollected, totalManagementFeesCollected);
    }

    function getDAOFee(string memory daoId) external view returns (uint256) {
        return daoFees[daoId];
    }

    function isValidDAO(string memory daoId) external view returns (bool) {
        return validDAOs[daoId];
    }

    function getVaultInfo() external view returns (
        uint256 tvl,
        uint256 sharePrice,
        uint256 cap,
        uint256 minDep,
        bool isPaused
    ) {
        uint256 totalShares = totalSupply();
        uint256 assets = totalAssets();
        
        return (
            assets,
            totalShares == 0 ? 1e18 : (assets * 1e18) / totalShares,
            vaultCap,
            minDeposit,
            paused()
        );
    }
}