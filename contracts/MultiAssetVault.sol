// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MultiAssetVault
 * @notice DAO vault that holds multiple cryptocurrencies and mints shares (Phase 1: BTC & ETH)
 * @dev ERC20 share tokens representing proportional ownership of the vault's assets
 */
contract MultiAssetVault is ERC20, AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    
    // Vault configuration
    uint256 public totalValueLocked; // In USD (scaled by 1e8 for precision)
    uint256 public performanceFee; // In basis points (e.g., 200 = 2%)
    uint256 public minimumInvestment; // In USD (scaled by 1e8)
    address public feeCollector;
    
    // Supported assets (Phase 1: Wrapped BTC and ETH on Celo)
    address public wBTC; // Wrapped Bitcoin address
    address public wETH; // Wrapped Ethereum address
    
    // Asset allocations (in basis points, 10000 = 100%)
    uint256 public btcAllocation;
    uint256 public ethAllocation;
    
    // Investment tracking
    struct Investment {
        address investor;
        uint256 sharesMinted;
        uint256 usdValue;
        uint256 timestamp;
    }
    
    Investment[] public investments;
    mapping(address => uint256[]) public userInvestments;
    
    // Events
    event AssetAllocationUpdated(string asset, uint256 newAllocation);
    event Investment(address indexed investor, uint256 usdAmount, uint256 sharesMinted, uint256 sharePrice);
    event Withdrawal(address indexed investor, uint256 sharesRedeemed, uint256 usdValue, uint256 fee);
    event Rebalanced(uint256 timestamp, uint256 newTVL);
    event PerformanceFeeUpdated(uint256 newFee);
    event MinimumInvestmentUpdated(uint256 newMinimum);
    
    /**
     * @notice Initialize the multi-asset vault
     * @param name Share token name (e.g., "Crypto Pioneers Pool")
     * @param symbol Share token symbol (e.g., "CPP")
     * @param _wBTC Address of wrapped Bitcoin token
     * @param _wETH Address of wrapped Ethereum token
     * @param _feeCollector Address to collect performance fees
     */
    constructor(
        string memory name,
        string memory symbol,
        address _wBTC,
        address _wETH,
        address _feeCollector
    ) ERC20(name, symbol) {
        require(_wBTC != address(0), "Invalid wBTC address");
        require(_wETH != address(0), "Invalid wETH address");
        require(_feeCollector != address(0), "Invalid fee collector");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        
        wBTC = _wBTC;
        wETH = _wETH;
        feeCollector = _feeCollector;
        
        // Default allocations: 50% BTC, 50% ETH
        btcAllocation = 5000;
        ethAllocation = 5000;
        
        performanceFee = 200; // 2%
        minimumInvestment = 10 * 1e8; // $10 USD
    }
    
    /**
     * @notice Invest in the pool by depositing cUSD/USDT
     * @param usdAmount Amount in USD to invest (scaled by 1e8)
     * @return sharesMinted Number of shares minted to investor
     */
    function invest(uint256 usdAmount) external nonReentrant whenNotPaused returns (uint256 sharesMinted) {
        require(usdAmount >= minimumInvestment, "Below minimum investment");
        
        // Calculate shares to mint based on current pool value
        if (totalSupply() == 0) {
            // First investment: 1:1 ratio
            sharesMinted = usdAmount;
        } else {
            // Subsequent investments: proportional to TVL
            sharesMinted = (usdAmount * totalSupply()) / totalValueLocked;
        }
        
        // Mint share tokens
        _mint(msg.sender, sharesMinted);
        
        // Update TVL
        totalValueLocked += usdAmount;
        
        // Record investment
        investments.push(Investment({
            investor: msg.sender,
            sharesMinted: sharesMinted,
            usdValue: usdAmount,
            timestamp: block.timestamp
        }));
        
        userInvestments[msg.sender].push(investments.length - 1);
        
        uint256 sharePrice = getSharePrice();
        emit Investment(msg.sender, usdAmount, sharesMinted, sharePrice);
        
        return sharesMinted;
    }
    
    /**
     * @notice Withdraw from the pool by burning shares
     * @param shares Number of shares to redeem
     * @return netAmount USD amount returned after fees
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 netAmount) {
        require(balanceOf(msg.sender) >= shares, "Insufficient shares");
        
        // Calculate USD value of shares
        uint256 usdValue = (shares * totalValueLocked) / totalSupply();
        
        // Calculate performance fee
        uint256 fee = (usdValue * performanceFee) / 10000;
        netAmount = usdValue - fee;
        
        // Burn shares
        _burn(msg.sender, shares);
        
        // Update TVL
        totalValueLocked -= usdValue;
        
        // Transfer fee to collector
        if (fee > 0) {
            // Fee transfer logic would go here
        }
        
        emit Withdrawal(msg.sender, shares, usdValue, fee);
        
        return netAmount;
    }
    
    /**
     * @notice Update asset allocation percentages
     * @param _btcAllocation New BTC allocation in basis points
     * @param _ethAllocation New ETH allocation in basis points
     */
    function updateAllocations(
        uint256 _btcAllocation,
        uint256 _ethAllocation
    ) external onlyRole(MANAGER_ROLE) {
        require(_btcAllocation + _ethAllocation == 10000, "Allocations must sum to 100%");
        
        btcAllocation = _btcAllocation;
        ethAllocation = _ethAllocation;
        
        emit AssetAllocationUpdated("BTC", _btcAllocation);
        emit AssetAllocationUpdated("ETH", _ethAllocation);
    }
    
    /**
     * @notice Rebalance portfolio to match target allocations
     * @dev Called by authorized rebalancer (can be automated)
     */
    function rebalance() external onlyRole(REBALANCER_ROLE) {
        // Rebalancing logic would involve:
        // 1. Get current asset prices from oracle
        // 2. Calculate current allocations
        // 3. Swap assets via DEX to match target allocations
        // This is simplified for Phase 1 MVP
        
        emit Rebalanced(block.timestamp, totalValueLocked);
    }
    
    /**
     * @notice Get current share price in USD
     * @return Current price per share (scaled by 1e8)
     */
    function getSharePrice() public view returns (uint256) {
        if (totalSupply() == 0) return 1e8; // Initial price: $1
        return (totalValueLocked * 1e8) / totalSupply();
    }
    
    /**
     * @notice Get user's total value in the pool
     * @param user Address of the user
     * @return Total USD value of user's shares
     */
    function getUserValue(address user) external view returns (uint256) {
        uint256 userShares = balanceOf(user);
        if (totalSupply() == 0) return 0;
        return (userShares * totalValueLocked) / totalSupply();
    }
    
    /**
     * @notice Get portfolio composition
     * @return btcPercent BTC allocation percentage
     * @return ethPercent ETH allocation percentage
     */
    function getPortfolio() external view returns (uint256 btcPercent, uint256 ethPercent) {
        return (btcAllocation, ethAllocation);
    }
    
    /**
     * @notice Update performance fee
     * @param newFee New fee in basis points
     */
    function setPerformanceFee(uint256 newFee) external onlyRole(MANAGER_ROLE) {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        performanceFee = newFee;
        emit PerformanceFeeUpdated(newFee);
    }
    
    /**
     * @notice Update minimum investment amount
     * @param newMinimum New minimum in USD (scaled by 1e8)
     */
    function setMinimumInvestment(uint256 newMinimum) external onlyRole(MANAGER_ROLE) {
        minimumInvestment = newMinimum;
        emit MinimumInvestmentUpdated(newMinimum);
    }
    
    /**
     * @notice Pause all investments and withdrawals
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause investments and withdrawals
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get total number of investments made
     */
    function getInvestmentCount() external view returns (uint256) {
        return investments.length;
    }
    
    /**
     * @notice Get user's investment history
     * @param user Address of the user
     * @return Investment indices for the user
     */
    function getUserInvestments(address user) external view returns (uint256[] memory) {
        return userInvestments[user];
    }
}

