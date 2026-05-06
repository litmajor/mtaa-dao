// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MaonoVault_Phase1A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMTAAToken {
    function burn(uint256 amount) external;
}

/**
 * @title MaonoVaultFactory (Phase 1A - Corrected)
 * @notice Factory contract with all 6 critical fixes implemented
 * @dev
 *   FIX #1: Spawn cost collected HERE at vault deployment (not in vault on first deposit) ✓
 *   FIX #3: Per-user vault cap enforcement (5 per user, not per DAO) ✓
 *   Vault creation properly gates spawn cost payment
 */
contract MaonoVaultFactory_Phase1A is Ownable {
    using SafeERC20 for IERC20;

    // ==================== CONFIGURATION ====================
    address public platformTreasury;
    address public mtaaToken;
    address public priceOracle;

    // Supported vault asset types
    mapping(address => bool) public supportedAssets;
    address[] public supportedAssetsList;

    // ==================== VAULT REGISTRY ====================
    address[] public deployedVaults;
    mapping(address vault => VaultInfo) public vaultInfo;
    mapping(address user => address[]) public userVaults;

    struct VaultInfo {
        address vault;
        address owner;
        address asset;
        string name;
        uint256 deployedAt;
        uint256 vaultType;  // 0-4
        bool isActive;
    }

    // ==================== CRITICAL FIX #3: PER-USER VAULT CAP ====================
    mapping(address user => uint256 count) public userVaultCount;
    uint256 public constant MAX_VAULTS_PER_USER = 5;

    // Spawn cost tracking
    mapping(address user => uint256) public spawnCostsPaid;
    uint256 public totalSpawnCostCollected;
    uint256 public totalSpawnCostBurned;
    uint256 public totalSpawnCostToTreasury;

    // ==================== SPAWN COST CONFIGURATION (Celo-Optimized) ====================
    uint256[5] public SPAWN_COSTS = [
        150 ether,   // SAVINGS: 150 MTAA (cheapest option for casual savers)
        250 ether,   // ESCROW: 250 MTAA (middle option, most common for Chama)
        400 ether,   // BUSINESS: 400 MTAA
        600 ether,   // INVESTING: 600 MTAA
        1000 ether   // CUSTOM: 1000 MTAA (most expensive, maximum features)
    ];

    // Split for spawn cost (same as upkeep)
    uint256[5] public SPAWN_BURN_PERCENTAGES = [
        10000,  // SAVINGS: 100% burn
        5000,   // ESCROW: 50% burn / 50% treasury
        5000,   // BUSINESS: 50/50
        3000,   // INVESTING: 30% burn / 70% treasury
        3000    // CUSTOM: 30/70
    ];

    // ==================== EVENTS ====================
    event VaultDeployed(
        address indexed vault,
        address indexed owner,
        address indexed asset,
        string name,
        uint256 vaultType,
        uint256 spawnCostPaid,
        uint256 burnAmount,
        uint256 treasuryAmount,
        uint256 timestamp
    );

    event AssetAdded(address indexed asset, string symbol, uint256 timestamp);
    event AssetRemoved(address indexed asset, uint256 timestamp);

    event SpawnCostCollected(
        address indexed user,
        uint256 vaultType,
        uint256 totalCost,
        uint256 burnAmount,
        uint256 treasuryAmount,
        uint256 timestamp
    );

    event PriceOracleUpdated(address indexed newOracle, uint256 timestamp);

    // ==================== ERRORS ====================
    error UnsupportedAsset();
    error InvalidVaultType();
    error InvalidAddress();
    error MaxVaultsPerUserExceeded();
    error SpawnCostPaymentFailed();
    error BurnFailed();
    error TransferFailed();
    error AssetAlreadySupported();
    error AssetNotSupported();

    // ==================== CONSTRUCTOR ====================
    constructor(
        address _platformTreasury,
        address _mtaaToken,
        address _priceOracle,
        address[] memory _initialAssets
    ) Ownable(msg.sender) {
        if (_platformTreasury == address(0) || _mtaaToken == address(0)) {
            revert InvalidAddress();
        }

        platformTreasury = _platformTreasury;
        mtaaToken = _mtaaToken;
        priceOracle = _priceOracle;

        // Register initial supported assets
        for (uint256 i = 0; i < _initialAssets.length; ++i) {
            supportedAssets[_initialAssets[i]] = true;
            supportedAssetsList.push(_initialAssets[i]);
        }
    }

    // ==================== CRITICAL FIX #1: SPAWN COST COLLECTION ====================
    /**
     * @notice Deploy a new MaonoVault with spawn cost collected at factory
     * @dev Spawn cost is collected HERE from msg.sender, not on first deposit
     *      This ensures DAO admin or authorized user pays, not random first depositor
     *
     * @param asset  Address of vault asset (cUSD on Celo, USDC on Polygon, etc.)
     * @param name   Human-readable vault name
     * @param symbol Vault LP token symbol
     * @param vaultType 0=Savings, 1=Escrow, 2=Business, 3=Investing, 4=Custom
     * @return vault Address of newly deployed MaonoVault_Phase1A contract
     */
    function deployVault(
        address asset,
        string memory name,
        string memory symbol,
        uint256 vaultType
    ) external returns (address vault) {
        // Validation
        if (!supportedAssets[asset]) revert UnsupportedAsset();
        if (vaultType > 4) revert InvalidVaultType();
        if (userVaultCount[msg.sender] >= MAX_VAULTS_PER_USER) {
            revert MaxVaultsPerUserExceeded();
        }

        // ==================== CRITICAL FIX #1: COLLECT SPAWN COST ====================
        uint256 spawnCost = SPAWN_COSTS[vaultType];
        uint256 burnPercentage = SPAWN_BURN_PERCENTAGES[vaultType];
        uint256 burnAmount = (spawnCost * burnPercentage) / 10000;
        uint256 treasuryAmount = spawnCost - burnAmount;

        // Collect MTAA from msg.sender (DAO admin or authorized vault creator)
        if (!IERC20(mtaaToken).transferFrom(msg.sender, address(this), spawnCost)) {
            revert SpawnCostPaymentFailed();
        }

        // Execute burn immediately
        if (burnAmount > 0) {
            try IMTAAToken(mtaaToken).burn(burnAmount) {
                totalSpawnCostBurned += burnAmount;
            } catch {
                revert BurnFailed();
            }
        }

        // Send treasury share
        if (treasuryAmount > 0) {
            if (!IERC20(mtaaToken).transfer(platformTreasury, treasuryAmount)) {
                revert TransferFailed();
            }
            totalSpawnCostToTreasury += treasuryAmount;
        }

        // Update tracking
        totalSpawnCostCollected += spawnCost;
        spawnCostsPaid[msg.sender] += spawnCost;

        // ==================== DEPLOY VAULT ====================
        vault = address(
            new MaonoVault_Phase1A(
                asset,
                name,
                symbol,
                msg.sender,  // vault owner (DAO admin)
                MaonoVault_Phase1A.VaultType(vaultType),
                platformTreasury,  // DAO treasury for upkeep revenue
                mtaaToken,
                priceOracle
            )
        );

        // ==================== REGISTER VAULT ====================
        deployedVaults.push(vault);
        userVaults[msg.sender].push(vault);
        userVaultCount[msg.sender]++;

        vaultInfo[vault] = VaultInfo({
            vault: vault,
            owner: msg.sender,
            asset: asset,
            name: name,
            deployedAt: block.timestamp,
            vaultType: vaultType,
            isActive: true
        });

        // Emit events
        emit SpawnCostCollected(
            msg.sender,
            vaultType,
            spawnCost,
            burnAmount,
            treasuryAmount,
            block.timestamp
        );

        emit VaultDeployed(
            vault,
            msg.sender,
            asset,
            name,
            vaultType,
            spawnCost,
            burnAmount,
            treasuryAmount,
            block.timestamp
        );

        return vault;
    }

    // ==================== ASSET MANAGEMENT ====================
    /**
     * @notice Add supported vault asset
     * @dev Only owner can add assets
     */
    function addSupportedAsset(address asset, string memory symbol)
        external
        onlyOwner
    {
        if (asset == address(0)) revert InvalidAddress();
        if (supportedAssets[asset]) revert AssetAlreadySupported();

        supportedAssets[asset] = true;
        supportedAssetsList.push(asset);

        emit AssetAdded(asset, symbol, block.timestamp);
    }

    /**
     * @notice Remove supported vault asset
     * @dev Only owner
     */
    function removeSupportedAsset(address asset)
        external
        onlyOwner
    {
        if (!supportedAssets[asset]) revert AssetNotSupported();

        supportedAssets[asset] = false;

        // Remove from list
        for (uint256 i = 0; i < supportedAssetsList.length; ++i) {
            if (supportedAssetsList[i] == asset) {
                supportedAssetsList[i] = supportedAssetsList[supportedAssetsList.length - 1];
                supportedAssetsList.pop();
                break;
            }
        }

        emit AssetRemoved(asset, block.timestamp);
    }

    // ==================== ORACLE MANAGEMENT ====================
    function setPriceOracle(address _newOracle)
        external
        onlyOwner
    {
        if (_newOracle == address(0)) revert InvalidAddress();
        priceOracle = _newOracle;
        emit PriceOracleUpdated(_newOracle, block.timestamp);
    }

    // ==================== QUERY FUNCTIONS ====================
    /**
     * @notice Get all vaults created by a user
     */
    function getUserVaults(address user)
        external
        view
        returns (address[] memory)
    {
        return userVaults[user];
    }

    /**
     * @notice Check if user can spawn more vaults
     */
    function canUserSpawnVault(address user)
        external
        view
        returns (bool)
    {
        return userVaultCount[user] < MAX_VAULTS_PER_USER;
    }

    /**
     * @notice Get remaining vault slots for user
     */
    function getRemainingVaultSlots(address user)
        external
        view
        returns (uint256)
    {
        uint256 used = userVaultCount[user];
        if (used >= MAX_VAULTS_PER_USER) {
            return 0;
        }
        return MAX_VAULTS_PER_USER - used;
    }

    /**
     * @notice Get all supported vault assets
     */
    function getSupportedAssets()
        external
        view
        returns (address[] memory)
    {
        return supportedAssetsList;
    }

    /**
     * @notice Get spawn cost for vault type
     */
    function getSpawnCost(uint256 vaultType)
        external
        view
        returns (uint256 cost, uint256 burnAmount, uint256 treasuryAmount)
    {
        if (vaultType > 4) revert InvalidVaultType();

        cost = SPAWN_COSTS[vaultType];
        uint256 burnPercentage = SPAWN_BURN_PERCENTAGES[vaultType];
        burnAmount = (cost * burnPercentage) / 10000;
        treasuryAmount = cost - burnAmount;
    }

    /**
     * @notice Get total vaults deployed
     */
    function getTotalVaultsDeployed()
        external
        view
        returns (uint256)
    {
        return deployedVaults.length;
    }

    /**
     * @notice Get detailed vault info
     */
    function getVaultDetails(address vault)
        external
        view
        returns (VaultInfo memory)
    {
        return vaultInfo[vault];
    }

    /**
     * @notice Get factory statistics
     */
    function getFactoryStats()
        external
        view
        returns (
            uint256 totalVaults,
            uint256 totalSpawnCosts,
            uint256 totalBurned,
            uint256 totalToTreasury,
            uint256 supportedAssetCount
        )
    {
        return (
            deployedVaults.length,
            totalSpawnCostCollected,
            totalSpawnCostBurned,
            totalSpawnCostToTreasury,
            supportedAssetsList.length
        );
    }
}
