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
    uint256 public vaultCap = 100_000_000 * 1e18; // 10,000 cUSD
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
    uint256 public positionValueCheckpoint; // Value of all manager-deployed positions
    bool public autoNAVEnabled = true; // Auto-update NAV on deposits/withdrawals

    // Fee tracking
    uint256 public totalPerformanceFeesCollected;
    uint256 public totalManagementFeesCollected;

    // Platform fee tracking (optional, per DAO)
    mapping(string => uint256) public daoFees;
    mapping(string => bool) public validDAOs;

    // Manager position tracking for transparency
    struct ManagerPosition {
        bytes32 positionId;        // Unique identifier
        address protocol;          // Aave, Uniswap, etc.
        uint256 assetAmount;       // In native asset (e.g., cUSD)
        string assetType;          // cUSD, ETH, USDC, etc.
        uint256 deployTime;        // When deployed
        uint256 lastValueUpdate;   // Last time position was valued
        uint256 currentValue;      // Current position value
        bool isActive;             // Still deployed
        string description;        // Human-readable description
    }

    mapping(bytes32 => ManagerPosition) public positions;
    bytes32[] public activePositionIds;
    uint256 private positionCounter;

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
    uint256 public largeWithdrawalThreshold = 10000 * 1e18; // 10000 cUSD

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
    event PositionOpened(bytes32 indexed positionId, address protocol, uint256 amount);
    event PositionClosed(bytes32 indexed positionId, uint256 finalValue);
    event PositionValueUpdated(bytes32 indexed positionId, uint256 newValue);
    event PositionCheckpointUpdated(uint256 totalCheckpointValue);
    event AutoNAVToggled(bool enabled);

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
        
        // Auto-update NAV to include new deposit
        if (autoNAVEnabled) {
            _autoUpdateNAVOnDeposit(assets);
        }

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
    // Multi-sig state for vault withdrawals
    mapping(bytes32 => WithdrawalProposal) public withdrawalProposals;
    
    struct WithdrawalProposal {
        address proposer;
        uint256 amount;
        uint256 signatures;
        uint256 requiredSignatures;
        mapping(address => bool) hasSign;
        bool executed;
        uint256 createdAt;
    }
    
    address[] public authorizedSigners;
    uint256 public requiredSignaturesCount;
    
    event WithdrawalProposed(bytes32 indexed proposalId, address proposer, uint256 amount);
    event WithdrawalSigned(bytes32 indexed proposalId, address signer);
    event WithdrawalExecuted(bytes32 indexed proposalId, uint256 amount);
    
    /**
     * @notice Propose a withdrawal (requires multi-sig if enabled)
     * @param amount Amount to withdraw
     */
    function proposeWithdrawal(uint256 amount) external onlyManager returns (bytes32) {
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (amount > vaultBalance) revert InsufficientBalance(amount, vaultBalance);
        
        bytes32 proposalId = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp));
        
        WithdrawalProposal storage proposal = withdrawalProposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.amount = amount;
        proposal.signatures = 1; // Proposer auto-signs
        proposal.requiredSignatures = requiredSignaturesCount > 0 ? requiredSignaturesCount : 1;
        proposal.hasSign[msg.sender] = true;
        proposal.createdAt = block.timestamp;
        
        emit WithdrawalProposed(proposalId, msg.sender, amount);
        
        return proposalId;
    }
    
    /**
     * @notice Sign a withdrawal proposal
     * @param proposalId Proposal to sign
     */
    function signWithdrawal(bytes32 proposalId) external {
        WithdrawalProposal storage proposal = withdrawalProposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(!proposal.hasSign[msg.sender], "Already signed");
        require(_isAuthorizedSigner(msg.sender), "Not authorized signer");
        
        proposal.hasSign[msg.sender] = true;
        proposal.signatures++;
        
        emit WithdrawalSigned(proposalId, msg.sender);
        
        // Auto-execute if threshold met
        if (proposal.signatures >= proposal.requiredSignatures) {
            _executeWithdrawal(proposalId);
        }
    }
    
    function _executeWithdrawal(bytes32 proposalId) internal {
        WithdrawalProposal storage proposal = withdrawalProposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(proposal.signatures >= proposal.requiredSignatures, "Insufficient signatures");
        
        proposal.executed = true;
        
        IERC20(asset()).safeTransfer(manager, proposal.amount);
        
        emit WithdrawalExecuted(proposalId, proposal.amount);
        emit AssetsWithdrawn(manager, proposal.amount);
    }
    
    function _isAuthorizedSigner(address signer) internal view returns (bool) {
        if (authorizedSigners.length == 0) return signer == manager;
        
        for (uint i = 0; i < authorizedSigners.length; i++) {
            if (authorizedSigners[i] == signer) return true;
        }
        return false;
    }
    
    /**
     * @notice Set authorized signers for vault (owner only)
     */
    function setAuthorizedSigners(address[] memory signers, uint256 required) external onlyOwner {
        authorizedSigners = signers;
        requiredSignaturesCount = required;
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

    // === NAV AUTOMATION & POSITION TRACKING ===

    /**
     * @notice Report manager position value (called by manager)
     * Updates the NAV checkpoint based on all deployed positions
     * @param totalPositionValue Sum of all current position values in base asset
     */
    function updatePositionValue(uint256 totalPositionValue) 
        external 
        onlyManager 
        nonReentrant 
    {
        _collectManagementFees();
        
        // Calculate new NAV = vault cash + positions value
        uint256 vaultCash = IERC20(asset()).balanceOf(address(this));
        uint256 newNAV = vaultCash + totalPositionValue;
        
        // Prevent unrealistic values (sanity check)
        if (newNAV == 0) revert InvalidNAV();
        
        // Update checkpoint
        positionValueCheckpoint = totalPositionValue;
        lastNAV = newNAV;
        lastNAVUpdate = block.timestamp;
        
        emit PositionCheckpointUpdated(totalPositionValue);
        emit NAVUpdated(newNAV, block.timestamp, msg.sender);
    }

    /**
     * @notice Auto-update NAV when deposit occurs (internal)
     * Adds new deposit amount to tracked positions
     */
    function _autoUpdateNAVOnDeposit(uint256 depositAmount) internal {
        uint256 vaultCash = IERC20(asset()).balanceOf(address(this));
        uint256 newNAV = vaultCash + positionValueCheckpoint;
        
        lastNAV = newNAV;
        lastNAVUpdate = block.timestamp;
        
        emit NAVUpdated(newNAV, block.timestamp, msg.sender);
    }

    /**
     * @notice Auto-update NAV when withdrawal occurs (internal)
     * Subtracts withdrawn amount from vault cash
     */
    function _autoUpdateNAVOnWithdrawal(uint256 withdrawalAmount) internal {
        uint256 vaultCash = IERC20(asset()).balanceOf(address(this));
        uint256 newNAV = vaultCash + positionValueCheckpoint;
        
        lastNAV = newNAV;
        lastNAVUpdate = block.timestamp;
        
        emit NAVUpdated(newNAV, block.timestamp, msg.sender);
    }

    /**
     * @notice Toggle automatic NAV updates
     * @param enabled Whether to enable auto-updates
     */
    function setAutoNAVEnabled(bool enabled) external onlyOwner {
        autoNAVEnabled = enabled;
        emit AutoNAVToggled(enabled);
    }

    /**
     * @notice Create a manager position record (for transparency)
     * @param protocol Protocol address (Aave, Uniswap, etc.)
     * @param assetAmount Amount of asset deployed
     * @param assetType Type of asset (cUSD, ETH, etc.)
     * @param description Human-readable description
     * @return positionId Unique position identifier
     */
    function openPosition(
        address protocol,
        uint256 assetAmount,
        string memory assetType,
        string memory description
    ) 
        external 
        onlyManager 
        returns (bytes32 positionId) 
    {
        require(protocol != address(0), "Invalid protocol");
        require(assetAmount > 0, "Invalid amount");
        require(bytes(assetType).length > 0, "Invalid asset type");
        
        positionId = keccak256(abi.encodePacked(protocol, assetAmount, block.timestamp, positionCounter++));
        
        positions[positionId] = ManagerPosition({
            positionId: positionId,
            protocol: protocol,
            assetAmount: assetAmount,
            assetType: assetType,
            deployTime: block.timestamp,
            lastValueUpdate: block.timestamp,
            currentValue: assetAmount, // Initially equal to deployed amount
            isActive: true,
            description: description
        });
        
        activePositionIds.push(positionId);
        
        emit PositionOpened(positionId, protocol, assetAmount);
        return positionId;
    }

    /**
     * @notice Update position value (called by manager as positions generate returns)
     * @param positionId Position to update
     * @param newValue New valuation of position in base asset
     */
    function updatePositionValueReport(bytes32 positionId, uint256 newValue) 
        external 
        onlyManager 
        nonReentrant 
    {
        require(positions[positionId].isActive, "Position not active");
        require(newValue > 0, "Invalid value");
        
        positions[positionId].currentValue = newValue;
        positions[positionId].lastValueUpdate = block.timestamp;
        
        emit PositionValueUpdated(positionId, newValue);
    }

    /**
     * @notice Close a position (manager withdraws from protocol)
     * @param positionId Position to close
     * @param finalValue Final value received from protocol
     */
    function closePosition(bytes32 positionId, uint256 finalValue) 
        external 
        onlyManager 
        nonReentrant 
    {
        ManagerPosition storage pos = positions[positionId];
        require(pos.isActive, "Position not active");
        
        pos.isActive = false;
        pos.currentValue = finalValue;
        pos.lastValueUpdate = block.timestamp;
        
        emit PositionClosed(positionId, finalValue);
    }

    /**
     * @notice Get all active positions
     * @return List of active position IDs
     */
    function getActivePositions() external view returns (bytes32[] memory) {
        return activePositionIds;
    }

    /**
     * @notice Get position details
     * @param positionId Position ID
     * @return Position data
     */
    function getPosition(bytes32 positionId) 
        external 
        view 
        returns (ManagerPosition memory) 
    {
        return positions[positionId];
    }

    /**
     * @notice Calculate total value of all active positions
     * @return Total position value in base asset
     */
    function getTotalPositionValue() external view returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i = 0; i < activePositionIds.length; ++i) {
            if (positions[activePositionIds[i]].isActive) {
                totalValue += positions[activePositionIds[i]].currentValue;
            }
        }
        return totalValue;
    }