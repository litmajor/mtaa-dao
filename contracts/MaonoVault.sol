// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title MaonoVault (Flagship ERC4626 Vault for MtaaDAO)
 * @notice Professionally managed, community-backed crypto vault
 * @dev Enhanced with security improvements and better fee handling
 * @author MtaaDAO Team
 */
contract MaonoVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // Virtual offsets to prevent inflation attacks
    uint256 private constant VIRTUAL_SHARES = 1e3; // δ = 3 for initial rate of 1000
    uint256 private constant VIRTUAL_ASSETS = 1;

    // --- Vault Parameters ---
    uint256 public minDeposit = 10 * 1e18; // 10 cUSD (assuming 18 decimals)
    uint256 public vaultCap = 10_000 * 1e18; // 10,000 cUSD
    uint256 public performanceFee = 1500; // 15% (basis points)
    uint256 public managementFee = 200; // 2% annual (basis points)
    uint256 public platformFeeRate = 100; // 1% of fees to platform (basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Fee limits for security
    uint256 public constant MAX_PERFORMANCE_FEE = 2000; // 20%
    uint256 public constant MAX_MANAGEMENT_FEE = 500; // 5% annual
    uint256 public constant MAX_PLATFORM_FEE_RATE = 1000; // 10%

    address public manager;
    address public daoTreasury;
    address public platformTreasury;

    // NAV tracking
    uint256 public lastNAV;
    uint256 public lastNAVUpdate;
    uint256 public lastManagementFeeCollection;
    uint256 public highWaterMark = 1e18; // Initial share price (with 18 decimals)

    // Fee tracking
    uint256 public totalPerformanceFeesCollected;
    uint256 public totalManagementFeesCollected;

    // Platform fee tracking (optional, per DAO)
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
    event PlatformFeeRateChanged(uint256 oldRate, uint256 newRate);
    event VaultCapChanged(uint256 oldCap, uint256 newCap);
    event MinDepositChanged(uint256 oldMin, uint256 newMin);
    event WithdrawalDelayChanged(uint256 oldDelay, uint256 newDelay);
    event LargeWithdrawalThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event ManagerChanged(address oldManager, address newManager);
    event DAOTreasuryChanged(address oldTreasury, address newTreasury);
    event PlatformTreasuryChanged(address oldTreasury, address newTreasury);
    event PerformanceFeeCollected(uint256 amount, uint256 timestamp);
    event ManagementFeeCollected(uint256 amount, uint256 timestamp);
    event WithdrawalRequested(uint256 requestId, address user, uint256 shares);
    event WithdrawalFulfilled(uint256 requestId, address user, uint256 shares, uint256 assets);
    event WithdrawalCancelled(uint256 requestId, address user);
    event PlatformFeeRecorded(string indexed daoId, uint256 feeAmount, uint256 timestamp);
    event DAOValidated(string indexed daoId, bool isValid);
    event EmergencyWithdraw(address indexed owner, uint256 amount);
    event AssetsWithdrawn(address indexed manager, uint256 amount);
    event AssetsDeposited(address indexed manager, uint256 amount);

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
    error NAVOutOfSync(uint256 reportedNAV, uint256 actualBalance);

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
        string memory _name,
        string memory _symbol,
        address _daoTreasury,
        address _platformTreasury,
        address _manager,
        string[] memory _initialDAOs
    ) 
        ERC4626(IERC20(_asset))
        ERC20(_name, _symbol)
        Ownable(msg.sender)
        validAddress(_asset)
        validAddress(_daoTreasury)
        validAddress(_platformTreasury)
        validAddress(_manager)
    {
        require(bytes(_name).length > 0 && bytes(_symbol).length > 0, "Invalid name/symbol");
        daoTreasury = _daoTreasury;
        platformTreasury = _platformTreasury;
        manager = _manager;
        lastNAVUpdate = block.timestamp;
        lastManagementFeeCollection = block.timestamp;
        
        // Initialize valid DAOs
        for (uint256 i = 0; i < _initialDAOs.length; ++i) {
            validDAOs[_initialDAOs[i]] = true;
            emit DAOValidated(_initialDAOs[i], true);
        }
    }

    // --- Conversion Overrides for Virtual Offsets ---
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view virtual returns (uint256) {
        return assets.mulDiv(
            totalSupply() + VIRTUAL_SHARES,
            totalAssets() + VIRTUAL_ASSETS,
            rounding
        );
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view virtual returns (uint256) {
        return shares.mulDiv(
            totalAssets() + VIRTUAL_ASSETS,
            totalSupply() + VIRTUAL_SHARES,
            rounding
        );
    }

    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    // --- Enhanced Deposit/Withdraw ---
    /**
     * @notice Deposit assets into the vault
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        if (assets < minDeposit) revert BelowMinDeposit(assets, minDeposit);
        uint256 currentAssets = totalAssets();
        if (currentAssets + assets > vaultCap) revert VaultCapExceeded(assets, vaultCap - currentAssets);

        _collectManagementFees();

        return super.deposit(assets, receiver);
    }

    /**
     * @notice Mint shares for assets
     * @param shares Amount of shares to mint
     * @param receiver Address to receive shares
     * @return assets Amount of assets deposited
     */
    function mint(uint256 shares, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 assets) 
    {
        assets = previewMint(shares);
        uint256 currentAssets = totalAssets();
        if (currentAssets + assets > vaultCap) revert VaultCapExceeded(assets, vaultCap - currentAssets);

        _collectManagementFees();

        return super.mint(shares, receiver);
    }

    /**
     * @notice Withdraw assets from the vault
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive assets
     * @param owner Owner of the shares
     * @return shares Amount of shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner) 
        public 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 shares) 
    {
        _collectManagementFees();

        if (assets >= largeWithdrawalThreshold) {
            shares = previewWithdraw(assets);
            _requestWithdrawal(owner, shares);
            return 0; // Shares burned later in fulfill
        }

        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @notice Redeem shares for assets
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive assets
     * @param owner Owner of the shares
     * @return assets Amount of assets returned
     */
    function redeem(uint256 shares, address receiver, address owner) 
        public 
        override 
        nonReentrant 
        whenNotPaused
        returns (uint256 assets) 
    {
        _collectManagementFees();

        assets = previewRedeem(shares);

        if (assets >= largeWithdrawalThreshold) {
            _requestWithdrawal(owner, shares);
            return 0; // Assets returned later in fulfill
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

    /**
     * @notice Fulfill a withdrawal request (manager only)
     * @param requestId ID of the request
     */
    function fulfillWithdrawal(uint256 requestId) external nonReentrant whenNotPaused onlyManager {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        if (request.fulfilled) revert WithdrawalAlreadyFulfilled();
        if (block.timestamp < request.requestTime + withdrawalDelay) {
            revert WithdrawalNotReady(request.requestTime, block.timestamp);
        }

        request.fulfilled = true;
        uint256 assets = previewRedeem(request.shares);

        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < assets) {
            revert InsufficientBalance(assets, vaultBalance);
        }

        _burn(request.user, request.shares);
        IERC20(asset()).safeTransfer(request.user, assets);

        emit WithdrawalFulfilled(requestId, request.user, request.shares, assets);
    }

    /**
     * @notice Cancel a pending withdrawal request (user only)
     * @param requestId ID of the request
     */
    function cancelWithdrawal(uint256 requestId) external {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(msg.sender == request.user, "Not request owner");
        require(!request.fulfilled, "Already fulfilled");

        delete withdrawalRequests[requestId];
        emit WithdrawalCancelled(requestId, msg.sender);
    }

    // --- NAV Management ---
    /**
     * @notice Update the vault's NAV (manager only)
     * @param newGrossNAV New gross NAV value
     */
    function updateNAV(uint256 newGrossNAV) external onlyManager {
        if (newGrossNAV == 0) revert InvalidNAV();

        // Optional: Sanity check against actual balance (e.g., within 10% deviation)
        uint256 actualBalance = IERC20(asset()).balanceOf(address(this));
        if (newGrossNAV > actualBalance * 11 / 10 || newGrossNAV < actualBalance * 9 / 10) {
            revert NAVOutOfSync(newGrossNAV, actualBalance);
        }

        _collectManagementFees();

        uint256 currentSupply = totalSupply();
        if (currentSupply == 0) {
            lastNAV = newGrossNAV;
            highWaterMark = 1e18;
            lastNAVUpdate = block.timestamp;
            emit NAVUpdated(newGrossNAV, block.timestamp, msg.sender);
            return;
        }

        uint256 currentPrice = newGrossNAV.mulDiv(1e18, currentSupply, Math.Rounding.Floor);

        if (currentPrice > highWaterMark) {
            uint256 profitPerShare = currentPrice - highWaterMark;
            uint256 totalProfit = profitPerShare.mulDiv(currentSupply, 1e18, Math.Rounding.Floor);
            uint256 perfFee = totalProfit.mulDiv(performanceFee, FEE_DENOMINATOR, Math.Rounding.Floor);

            if (perfFee > 0) {
                // More precise feeShares calculation
                uint256 feeShares = perfFee.mulDiv(currentSupply, newGrossNAV, Math.Rounding.Floor);

                uint256 platformShare = feeShares.mulDiv(platformFeeRate, FEE_DENOMINATOR, Math.Rounding.Floor);
                uint256 daoShare = feeShares - platformShare;

                if (platformShare > 0) _mint(platformTreasury, platformShare);
                if (daoShare > 0) _mint(daoTreasury, daoShare);

                totalPerformanceFeesCollected += perfFee;
                emit PerformanceFeeCollected(perfFee, block.timestamp);

                // Recalculate HWM precisely after mint
                highWaterMark = lastNAV.mulDiv(1e18, totalSupply(), Math.Rounding.Floor);
            }
        } else {
            highWaterMark = currentPrice; // Only update if higher; no reset on loss
        }

        lastNAV = newGrossNAV;
        lastNAVUpdate = block.timestamp;
        emit NAVUpdated(newGrossNAV, block.timestamp, msg.sender);
    }

    function previewNAV() external view returns (uint256 nav, uint256 lastUpdate) {
        return (lastNAV, lastNAVUpdate);
    }

    // --- Fee Management ---
    function _collectManagementFees() internal {
        uint256 timeElapsed;
        unchecked { timeElapsed = block.timestamp - lastManagementFeeCollection; }
        if (timeElapsed == 0) return;

        uint256 aum = totalAssets();
        if (aum == 0) return;

        uint256 annualFee = aum.mulDiv(managementFee, FEE_DENOMINATOR, Math.Rounding.Floor);
        uint256 fee = annualFee.mulDiv(timeElapsed, SECONDS_PER_YEAR, Math.Rounding.Floor);

        if (fee > 0) {
            uint256 currentSupply = totalSupply();
            if (currentSupply == 0) return;

            uint256 currentPrice = aum.mulDiv(1e18, currentSupply, Math.Rounding.Floor);
            uint256 feeShares = fee.mulDiv(1e18, currentPrice, Math.Rounding.Floor);

            uint256 platformShare = feeShares.mulDiv(platformFeeRate, FEE_DENOMINATOR, Math.Rounding.Floor);
            uint256 daoShare = feeShares - platformShare;

            if (platformShare > 0) _mint(platformTreasury, platformShare);
            if (daoShare > 0) _mint(daoTreasury, daoShare);

            totalManagementFeesCollected += fee;
            emit ManagementFeeCollected(fee, block.timestamp);
        }

        lastManagementFeeCollection = block.timestamp;
    }

    function collectManagementFees() external onlyManager {
        _collectManagementFees();
    }

    // --- Platform Fee Management ---
    /**
     * @notice Record and transfer platform fee for a DAO (manager only)
     * @param daoId DAO identifier
     * @param feeAmount Amount to transfer
     */
    function recordPlatformFee(string memory daoId, uint256 feeAmount) 
        external 
        onlyManager 
        validDAO(daoId)
    {
        if (feeAmount == 0) revert InvalidFeeAmount();

        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < feeAmount) revert InsufficientBalance(feeAmount, vaultBalance);
        
        daoFees[daoId] += feeAmount;
        IERC20(asset()).safeTransfer(platformTreasury, feeAmount);
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

    // --- Manager Operations ---
    /**
     * @notice Withdraw assets from vault (manager only, e.g., for investing)
     * @param amount Amount to withdraw
     */
    function withdrawAssets(uint256 amount) external onlyManager {
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (amount > vaultBalance) revert InsufficientBalance(amount, vaultBalance);
        IERC20(asset()).safeTransfer(manager, amount);
        emit AssetsWithdrawn(manager, amount);
        // Recommend updating NAV after this
    }

    /**
     * @notice Deposit assets into vault (manager only, e.g., after investing)
     * @param amount Amount to deposit
     */
    function depositAssets(uint256 amount) external onlyManager {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        emit AssetsDeposited(manager, amount);
        // Recommend updating NAV after this
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

    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        if (newRate > MAX_PLATFORM_FEE_RATE) revert InvalidFee(newRate, MAX_PLATFORM_FEE_RATE);
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;
        emit PlatformFeeRateChanged(oldRate, newRate);
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
        uint256 oldMin = minDeposit;
        minDeposit = newMinDeposit;
        emit MinDepositChanged(oldMin, newMinDeposit);
    }

    function setWithdrawalDelay(uint256 newDelay) external onlyOwner {
        uint256 oldDelay = withdrawalDelay;
        withdrawalDelay = newDelay;
        emit WithdrawalDelayChanged(oldDelay, newDelay);
    }

    function setLargeWithdrawalThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = largeWithdrawalThreshold;
        largeWithdrawalThreshold = newThreshold;
        emit LargeWithdrawalThresholdChanged(oldThreshold, newThreshold);
    }

    function setDAOTreasury(address newTreasury) external onlyOwner validAddress(newTreasury) {
        address oldTreasury = daoTreasury;
        daoTreasury = newTreasury;
        emit DAOTreasuryChanged(oldTreasury, newTreasury);
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner validAddress(newTreasury) {
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryChanged(oldTreasury, newTreasury);
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
        return lastNAV;
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
            totalShares == 0 ? 1e18 : assets.mulDiv(1e18, totalShares, Math.Rounding.Floor),
            vaultCap,
            minDeposit,
            paused()
        );
    }

    /**
     * @notice Preview accrued management fees
     * @return fee Estimated fee amount
     */
    function previewManagementFees() external view returns (uint256 fee) {
        uint256 timeElapsed;
        unchecked { timeElapsed = block.timestamp - lastManagementFeeCollection; }
        if (timeElapsed == 0) return 0;

        uint256 aum = totalAssets();
        if (aum == 0) return 0;

        uint256 annualFee = aum.mulDiv(managementFee, FEE_DENOMINATOR, Math.Rounding.Floor);
        return annualFee.mulDiv(timeElapsed, SECONDS_PER_YEAR, Math.Rounding.Floor);
    }
}