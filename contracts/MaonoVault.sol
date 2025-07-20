// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MaonoVault (Flagship ERC4626 Vault for MtaaDAO)
 * @notice Professionally managed, community-backed crypto vault
 * @dev Enhanced with security improvements and better fee handling
 */
contract MaonoVault is ERC4626, Ownable {
    // --- Custom Reentrancy Guard ---
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // --- Custom Pause Logic ---
    bool private _paused;
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }
    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }
    function pause() external onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }
    function unpause() external onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }
    // --- Vault Parameters ---
    uint256 public minDeposit = 10 * 1e18; // 10 cUSD (assuming 18 decimals)
    uint256 public vaultCap = 10_000 * 1e18; // 10,000 cUSD
    uint256 public performanceFee = 1500; // 15% (basis points)
    uint256 public managementFee = 200; // 2% annual (basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    address public manager;
    address public daoTreasury;
    
    // NAV tracking
    uint256 public lastNAV;
    uint256 public lastNAVUpdate;
    uint256 public lastManagementFeeCollection;
    
    // Fee tracking
    uint256 public totalPerformanceFeesCollected;
    uint256 public totalManagementFeesCollected;
    
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

    // Custom errors
    error BelowMinDeposit();
    error VaultCapExceeded();
    error NotManager();
    error ZeroAddress();
    error InvalidFee();
    error InsufficientBalance();
    error NoProfit();
    error InvalidNAV();
    error CapBelowTVL();
    error WithdrawalNotReady();
    error WithdrawalAlreadyFulfilled();

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    constructor(
        address _asset,
        address _daoTreasury,
        address _manager
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
    }

    // --- Enhanced Deposit/Withdraw ---
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        if (assets < minDeposit) revert BelowMinDeposit();
        if (totalAssets() + assets > vaultCap) revert VaultCapExceeded();
        
        // Collect management fees before deposit to ensure accurate share calculation
        _collectManagementFees();
        
        return super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) 
        public 
        override 
        nonReentrant 
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

    function fulfillWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        
        if (request.user != msg.sender) revert NotManager();
        if (request.fulfilled) revert WithdrawalAlreadyFulfilled();
        if (block.timestamp < request.requestTime + withdrawalDelay) revert WithdrawalNotReady();
        
        request.fulfilled = true;
        uint256 assets = previewRedeem(request.shares);
        
        _burn(request.user, request.shares);
        IERC20(asset()).transfer(request.user, assets);
        
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
        uint256 fee = (profit * performanceFee) / FEE_DENOMINATOR;
        if (fee > 0 && IERC20(asset()).balanceOf(address(this)) >= fee) {
            IERC20(asset()).transfer(daoTreasury, fee);
            totalPerformanceFeesCollected += fee;
            emit PerformanceFeeCollected(fee, block.timestamp);
        }
    }

    function _collectManagementFees() internal {
        uint256 timeElapsed = block.timestamp - lastManagementFeeCollection;
        if (timeElapsed > 0) {
            uint256 totalAssets_ = totalAssets();
            uint256 annualFee = (totalAssets_ * managementFee) / FEE_DENOMINATOR;
            uint256 fee = (annualFee * timeElapsed) / SECONDS_PER_YEAR;
            
            if (fee > 0 && IERC20(asset()).balanceOf(address(this)) >= fee) {
                IERC20(asset()).transfer(daoTreasury, fee);
                totalManagementFeesCollected += fee;
                lastManagementFeeCollection = block.timestamp;
                emit ManagementFeeCollected(fee, block.timestamp);
            }
        }
    }

    function collectManagementFees() external onlyManager {
        _collectManagementFees();
    }

    // --- Admin Functions ---
    function setPerformanceFee(uint256 newFee) external onlyOwner {
        if (newFee > 2000) revert InvalidFee(); // Max 20%
        uint256 oldFee = performanceFee;
        performanceFee = newFee;
        emit PerformanceFeeChanged(oldFee, newFee);
    }

    function setManagementFee(uint256 newFee) external onlyOwner {
        if (newFee > 500) revert InvalidFee(); // Max 5% annual
        uint256 oldFee = managementFee;
        managementFee = newFee;
        emit ManagementFeeChanged(oldFee, newFee);
    }

    function setVaultCap(uint256 newCap) external onlyOwner {
        if (newCap < totalAssets()) revert CapBelowTVL();
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

    // --- Emergency Functions ---
    // Pause/unpause functions removed

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        IERC20(asset()).transfer(owner(), amount);
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

    // --- Internal Functions ---
    // Custom logic can be added here as needed for future extensions.
function recordPlatformFee(string memory daoId, uint256 feeAmount) external onlyManager {
    // Record the fee for the specific DAO
    // Ensure the DAO ID and fee amount are valid
    require(bytes(daoId).length > 0, "DAO ID cannot be empty");
    require(feeAmount > 0, "Fee amount must be greater than zero");
    // Validate the DAO ID and fee amount
    // This could include checks against a list of valid DAOs or a minimum fee amount
    if (bytes(daoId).length == 0 || feeAmount == 0) {
        revert("Invalid DAO ID or fee amount");
    }
    // Emit an event to log the platform fee
    emit PlatformFeeRecorded(daoId, feeAmount, block.timestamp);
}

event PlatformFeeRecorded(string indexed daoId, uint256 feeAmount, uint256 timestamp);
}