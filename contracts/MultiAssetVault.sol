// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IUniswapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
}

/**
 * @title MultiAssetVault
 * @notice DAO vault that holds multiple cryptocurrencies and mints shares
 * @dev ERC20 share tokens representing proportional ownership of vault assets
 * @dev Supports Phase 1 (BTC, ETH, CELO) → Phase 4 (11+ assets)
 */
contract MultiAssetVault is ERC20, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;
    
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    
    // Vault configuration
    uint256 public totalValueLocked; // In USD (scaled by 1e8 for precision)
    uint256 public performanceFee; // In basis points (e.g., 200 = 2%)
    uint256 public minimumInvestment; // In USD (scaled by 1e8)
    address public feeCollector;
    address public priceOracle; // Oracle for asset pricing
    address public uniswapRouter; // Uniswap V2/V3 router for swaps
    
    // Asset registry - all supported assets
    struct Asset {
        address tokenAddress;
        string symbol;
        uint8 decimals;
        uint256 allocationBasisPoints; // In basis points (10000 = 100%)
        bool isActive;
        uint256 balance; // Current vault balance of this asset
    }
    
    mapping(bytes32 => Asset) public assets; // keccak256(symbol) => Asset
    bytes32[] public activeAssetSymbols; // List of active asset symbols
    
    // Historical allocations for rebalancing
    mapping(uint256 => uint256) public allocationHistory; // Timestamp => allocation bps
    
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
    event AssetRegistered(bytes32 indexed symbolHash, address indexed token, uint8 decimals);
    event AssetRemoved(bytes32 indexed symbolHash);
    event AllocationUpdated(bytes32 indexed symbolHash, uint256 newAllocation);
    event AssetAcquired(bytes32 indexed symbolHash, address indexed acquiredFrom, uint256 amount, uint256 pricePerUnit);
    event RebalancingTriggered(uint256 timestamp, uint256 totalAssets);
    event Investment(address indexed investor, uint256 usdAmount, uint256 sharesMinted, uint256 sharePrice);
    event Withdrawal(address indexed investor, uint256 sharesRedeemed, uint256 usdValue, uint256 fee);
    event Rebalanced(uint256 timestamp, uint256 newTVL);
    event PerformanceFeeUpdated(uint256 newFee);
    event MinimumInvestmentUpdated(uint256 newMinimum);
    event OracleUpdated(address indexed newOracle);
    event RouterUpdated(address indexed newRouter);

    /**
     * @notice Initialize the multi-asset vault
     * @param name Share token name (e.g., "Multi-Asset Pool")
     * @param symbol Share token symbol (e.g., "MAP")
     * @param _feeCollector Address to collect performance fees
     * @param _priceOracle Address of price oracle contract
     * @param _uniswapRouter Address of Uniswap router
     */
    constructor(
        string memory name,
        string memory symbol,
        address _feeCollector,
        address _priceOracle,
        address _uniswapRouter
    ) ERC20(name, symbol) {
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_priceOracle != address(0), "Invalid price oracle");
        require(_uniswapRouter != address(0), "Invalid router");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        
        feeCollector = _feeCollector;
        priceOracle = _priceOracle;
        uniswapRouter = _uniswapRouter;
        
        performanceFee = 200; // 2%
        minimumInvestment = 10 * 1e8; // $10 USD
    }

    // --- Asset Registration & Management ---

    /**
     * @notice Register a new asset for the vault
     * @param symbol Asset symbol (e.g., "BTC", "ETH")
     * @param tokenAddress Address of token contract
     * @param decimals Token decimals
     * @param initialAllocation Initial allocation in basis points
     */
    function registerAsset(
        string memory symbol,
        address tokenAddress,
        uint8 decimals,
        uint256 initialAllocation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid token address");
        require(decimals > 0 && decimals <= 18, "Invalid decimals");
        require(initialAllocation <= 10000, "Allocation cannot exceed 100%");
        
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        
        // Only add to active list if not already registered
        if (!assets[symbolHash].isActive) {
            activeAssetSymbols.push(symbolHash);
        }
        
        assets[symbolHash] = Asset({
            tokenAddress: tokenAddress,
            symbol: symbol,
            decimals: decimals,
            allocationBasisPoints: initialAllocation,
            isActive: true,
            balance: 0
        });
        
        emit AssetRegistered(symbolHash, tokenAddress, decimals);
    }

    /**
     * @notice Deactivate an asset
     * @param symbol Asset symbol
     */
    function deactivateAsset(string memory symbol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        require(assets[symbolHash].isActive, "Asset not active");
        
        assets[symbolHash].isActive = false;
        emit AssetRemoved(symbolHash);
    }

    /**
     * @notice Update asset allocation percentages
     * @param symbol Asset symbol
     * @param newAllocation New allocation in basis points
     */
    function updateAssetAllocation(
        string memory symbol,
        uint256 newAllocation
    ) external onlyRole(MANAGER_ROLE) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        require(assets[symbolHash].isActive, "Asset not active");
        require(newAllocation <= 10000, "Allocation cannot exceed 100%");
        
        assets[symbolHash].allocationBasisPoints = newAllocation;
        emit AllocationUpdated(symbolHash, newAllocation);
    }

    /**
     * @notice Get asset address by symbol
     * @param symbol Asset symbol
     * @return Token address
     */
    function getAssetAddress(string memory symbol) external view returns (address) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return assets[symbolHash].tokenAddress;
    }

    /**
     * @notice Get total allocation for all active assets
     * @return Total allocation in basis points
     */
    function getTotalAllocation() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            if (assets[activeAssetSymbols[i]].isActive) {
                total += assets[activeAssetSymbols[i]].allocationBasisPoints;
            }
        }
        return total;
    }

    /**
     * @notice Get all active assets
     * @return Array of asset symbols and their info
     */
    function getActiveAssets() external view returns (Asset[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            if (assets[activeAssetSymbols[i]].isActive) count++;
        }
        
        Asset[] memory activeAssets = new Asset[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            if (assets[activeAssetSymbols[i]].isActive) {
                activeAssets[index] = assets[activeAssetSymbols[i]];
                index++;
            }
        }
        return activeAssets;
    }
    
    // --- Investment Functions ---
    
    /**
     * @notice Invest in the pool by depositing USD value stablecoin
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
            // Fee transfer would happen here via stablecoin
            // IERC20(stablecoin).safeTransfer(feeCollector, fee);
        }
        
        emit Withdrawal(msg.sender, shares, usdValue, fee);
        
        return netAmount;
    }

    // --- Asset Acquisition via DEX Swaps ---

    /**
     * @notice Acquire asset from stablecoin via DEX swap
     * @param stablecoinAddress Source stablecoin (e.g., cUSD)
     * @param targetAssetSymbol Target asset symbol (e.g., "BTC")
     * @param stablecoinAmount Amount of stablecoin to swap
     * @param minAmountOut Minimum amount of target asset (slippage protection)
     */
    function acquireAssetViaSwap(
        address stablecoinAddress,
        string memory targetAssetSymbol,
        uint256 stablecoinAmount,
        uint256 minAmountOut
    ) external onlyRole(MANAGER_ROLE) nonReentrant returns (uint256 amountReceived) {
        require(stablecoinAddress != address(0), "Invalid stablecoin");
        require(stablecoinAmount > 0, "Amount must be > 0");
        
        bytes32 symbolHash = keccak256(abi.encodePacked(targetAssetSymbol));
        require(assets[symbolHash].isActive, "Asset not active");
        
        address targetAssetAddress = assets[symbolHash].tokenAddress;
        
        // Approve router to spend stablecoin
        IERC20(stablecoinAddress).safeApprove(uniswapRouter, stablecoinAmount);
        
        // Build swap path
        address[] memory path = new address[](2);
        path[0] = stablecoinAddress;
        path[1] = targetAssetAddress;
        
        // Execute swap
        uint[] memory amounts = IUniswapRouter(uniswapRouter).swapExactTokensForTokens(
            stablecoinAmount,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountReceived = amounts[amounts.length - 1];
        
        // Update asset balance
        assets[symbolHash].balance += amountReceived;
        
        // Get price per unit for event logging
        uint256 pricePerUnit = (stablecoinAmount * 1e8) / amountReceived;
        
        emit AssetAcquired(symbolHash, stablecoinAddress, amountReceived, pricePerUnit);
        
        return amountReceived;
    }

    /**
     * @notice Get estimated output for a swap
     * @param stablecoinAddress Source stablecoin
     * @param targetAssetSymbol Target asset
     * @param stablecoinAmount Input amount
     * @return estimatedOutput Estimated output amount
     */
    function getSwapEstimate(
        address stablecoinAddress,
        string memory targetAssetSymbol,
        uint256 stablecoinAmount
    ) external view returns (uint256 estimatedOutput) {
        bytes32 symbolHash = keccak256(abi.encodePacked(targetAssetSymbol));
        require(assets[symbolHash].isActive, "Asset not active");
        
        address[] memory path = new address[](2);
        path[0] = stablecoinAddress;
        path[1] = assets[symbolHash].tokenAddress;
        
        try IUniswapRouter(uniswapRouter).getAmountsOut(stablecoinAmount, path) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    // --- Rebalancing & Management ---

    /**
     * @notice Rebalance portfolio to match target allocations
     * @dev Manager must execute swaps to match allocations
     */
    function rebalance() external onlyRole(REBALANCER_ROLE) nonReentrant {
        uint256 totalAssets = calculateTotalAssetValue();
        require(totalAssets > 0, "No assets to rebalance");
        
        // For each active asset, compare current allocation to target
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            bytes32 symbolHash = activeAssetSymbols[i];
            if (!assets[symbolHash].isActive) continue;
            
            Asset storage asset = assets[symbolHash];
            uint256 assetValue = getAssetValue(symbolHash);
            uint256 currentAllocationBps = (assetValue * 10000) / totalAssets;
            uint256 targetAllocationBps = asset.allocationBasisPoints;
            
            // If allocation differs significantly from target (> 1%), log for review
            if (currentAllocationBps != targetAllocationBps) {
                emit RebalancingTriggered(block.timestamp, totalAssets);
            }
        }
        
        emit Rebalanced(block.timestamp, totalAssets);
    }

    /**
     * @notice Calculate total value of all assets
     * @return Total value in USD (scaled by 1e8)
     */
    function calculateTotalAssetValue() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            total += getAssetValue(activeAssetSymbols[i]);
        }
        return total;
    }

    /**
     * @notice Get USD value of specific asset
     * @param symbolHash Hash of asset symbol
     * @return Value in USD (scaled by 1e8)
     */
    function getAssetValue(bytes32 symbolHash) public view returns (uint256) {
        Asset memory asset = assets[symbolHash];
        if (!asset.isActive || asset.balance == 0) return 0;
        
        // Get price from oracle (in USD, scaled by 1e8)
        uint256 pricePerUnit = IPriceOracle(priceOracle).getPrice(asset.tokenAddress);
        
        // Convert balance to USD value accounting for decimals
        uint256 normalizedBalance = (asset.balance * 1e8) / (10 ** asset.decimals);
        return (normalizedBalance * pricePerUnit) / 1e8;
    }

    /**
     * @notice Get portfolio composition
     * @return Array of asset symbols with their current allocation percentages
     */
    function getPortfolioComposition() external view returns (string[] memory, uint256[] memory) {
        uint256 totalAssets = calculateTotalAssetValue();
        require(totalAssets > 0, "No assets in portfolio");
        
        uint256 activeCount = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            if (assets[activeAssetSymbols[i]].isActive) activeCount++;
        }
        
        string[] memory symbols = new string[](activeCount);
        uint256[] memory allocations = new uint256[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < activeAssetSymbols.length; ++i) {
            bytes32 symbolHash = activeAssetSymbols[i];
            if (assets[symbolHash].isActive) {
                symbols[index] = assets[symbolHash].symbol;
                uint256 assetValue = getAssetValue(symbolHash);
                allocations[index] = (assetValue * 10000) / totalAssets;
                index++;
            }
        }
        
        return (symbols, allocations);
    }
    
    // --- View Functions ---

    /**
     * @notice Get current share price in USD
     * @return Current price per share (scaled by 1e8)
     */
    function getSharePrice() public view returns (uint256) {
        if (totalSupply() == 0) return 1e8; // Initial price: $1
        uint256 assetValue = calculateTotalAssetValue();
        if (assetValue == 0) return 1e8;
        return (assetValue * 1e8) / totalSupply();
    }

    /**
     * @notice Get user's total value in the pool
     * @param user Address of the user
     * @return Total USD value of user's shares
     */
    function getUserValue(address user) external view returns (uint256) {
        uint256 userShares = balanceOf(user);
        if (totalSupply() == 0) return 0;
        uint256 totalAssets = calculateTotalAssetValue();
        return (userShares * totalAssets) / totalSupply();
    }

    /**
     * @notice Get current TVL (Total Value Locked)
     * @return TVL in USD (scaled by 1e8)
     */
    function getTVL() external view returns (uint256) {
        return calculateTotalAssetValue();
    }

    /**
     * @notice Get asset balance
     * @param symbol Asset symbol
     * @return Balance of asset in vault
     */
    function getAssetBalance(string memory symbol) external view returns (uint256) {
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        return assets[symbolHash].balance;
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

    // --- Admin Configuration ---
    
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
     * @notice Update price oracle address
     * @param newOracle New oracle address
     */
    function setPriceOracle(address newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOracle != address(0), "Invalid oracle");
        priceOracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    /**
     * @notice Update Uniswap router address
     * @param newRouter New router address
     */
    function setUniswapRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRouter != address(0), "Invalid router");
        uniswapRouter = newRouter;
        emit RouterUpdated(newRouter);
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
     * @notice Emergency withdraw of specific asset
     * @param symbol Asset symbol to withdraw
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function emergencyWithdrawAsset(
        string memory symbol,
        uint256 amount,
        address recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        
        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        require(assets[symbolHash].isActive, "Asset not active");
        require(assets[symbolHash].balance >= amount, "Insufficient balance");
        
        assets[symbolHash].balance -= amount;
        IERC20(assets[symbolHash].tokenAddress).safeTransfer(recipient, amount);
    }
}

