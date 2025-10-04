// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MaonoVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MaonoVaultFactory
 * @notice Factory contract for creating MaonoVault instances
 * @dev Allows anyone to deploy their own managed vault with customizable parameters
 */
contract MaonoVaultFactory is Ownable {
    using SafeERC20 for IERC20;

    // Factory configuration
    uint256 public deploymentFee = 0.01 ether; // Fee to deploy a vault (in native token)
    uint256 public platformFeeRate = 100; // 1% of vault fees go to platform (basis points)
    address public platformTreasury;
    
    // Supported assets for vaults
    mapping(address => bool) public supportedAssets;
    address[] public supportedAssetsList;
    mapping(address => string) public assetSymbols; // Persist asset symbol metadata
    
    // Vault registry
    address[] public deployedVaults;
    mapping(address => address[]) public userVaults; // user => their vaults
    mapping(address => VaultInfo) public vaultInfo;
    
    struct VaultInfo {
        address owner;
        address manager;
        address asset;
        string name;
        string symbol;
        uint256 deployedAt;
        bool isActive;
    }

    // Events
    event VaultDeployed(
        address indexed vault,
        address indexed owner,
        address indexed manager,
        address asset,
        string name,
        string symbol
    );
    event AssetAdded(address indexed asset, string symbol);
    event AssetRemoved(address indexed asset);
    event DeploymentFeeChanged(uint256 oldFee, uint256 newFee);
    event PlatformFeeRateChanged(uint256 oldRate, uint256 newRate);

    // Errors
    error UnsupportedAsset();
    error InsufficientDeploymentFee();
    error VaultNotFound();

    constructor(
        address _platformTreasury,
        address[] memory _initialAssets,
        string[] memory _initialAssetSymbols
    ) Ownable(msg.sender) {
        platformTreasury = _platformTreasury;
        
        // Add initial supported assets
        require(_initialAssets.length == _initialAssetSymbols.length, "Arrays length mismatch");
        for (uint i = 0; i < _initialAssets.length; i++) {
            _addSupportedAsset(_initialAssets[i], _initialAssetSymbols[i]);
        }
    }

    /**
     * @notice Deploy a new MaonoVault instance
     * @param asset The underlying asset address (must be supported)
     * @param manager The vault manager address
     * @param daoTreasury The DAO treasury address (receives fees)
     * @param vaultName Name for the vault LP token
     * @param vaultSymbol Symbol for the vault LP token
     * @param initialDAOs Array of initial valid DAO IDs
     * @param config Vault configuration parameters
     */
    function deployVault(
        address asset,
        address manager,
        address daoTreasury,
        string memory vaultName,
        string memory vaultSymbol,
        string[] memory initialDAOs,
        VaultConfig memory config
    ) external payable returns (address vault) {
        // Validate inputs
        if (!supportedAssets[asset]) revert UnsupportedAsset();
        if (msg.value < deploymentFee) revert InsufficientDeploymentFee();
        require(manager != address(0) && daoTreasury != address(0), "Zero address");

        // Deploy new vault
        vault = address(new MaonoVault(
            asset,
            daoTreasury,
            manager,
            initialDAOs
        ));

        // Configure vault parameters if provided
        if (config.minDeposit > 0) {
            MaonoVault(vault).setMinDeposit(config.minDeposit);
        }
        if (config.vaultCap > 0) {
            MaonoVault(vault).setVaultCap(config.vaultCap);
        }
        if (config.performanceFee > 0) {
            MaonoVault(vault).setPerformanceFee(config.performanceFee);
        }
        if (config.managementFee > 0) {
            MaonoVault(vault).setManagementFee(config.managementFee);
        }
        if (config.withdrawalDelay > 0) {
            MaonoVault(vault).setWithdrawalDelay(config.withdrawalDelay);
        }

        // Transfer ownership to deployer (DAO founder). Manager retains operational control.
        MaonoVault(vault).transferOwnership(msg.sender);

        // Record vault info
        vaultInfo[vault] = VaultInfo({
            owner: msg.sender,
            manager: manager,
            asset: asset,
            name: vaultName,
            symbol: vaultSymbol,
            deployedAt: block.timestamp,
            isActive: true
        });

        // Update registries
        deployedVaults.push(vault);
        userVaults[msg.sender].push(vault);

        // Send deployment fee to platform, refund excess
        uint256 fee = deploymentFee;
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee); // refund excess
        }
        payable(platformTreasury).transfer(fee);

        emit VaultDeployed(vault, msg.sender, manager, asset, vaultName, vaultSymbol);
        return vault;
    }

    struct VaultConfig {
        uint256 minDeposit;
        uint256 vaultCap;
        uint256 performanceFee;
        uint256 managementFee;
        uint256 withdrawalDelay;
    }

    // --- Admin Functions ---
    
    function addSupportedAsset(address asset, string memory symbol) external onlyOwner {
        _addSupportedAsset(asset, symbol);
    }

    function _addSupportedAsset(address asset, string memory symbol) internal {
    require(asset != address(0), "Zero address");
    require(!supportedAssets[asset], "Already supported");
        
    supportedAssets[asset] = true;
    supportedAssetsList.push(asset);
    assetSymbols[asset] = symbol;
        
    emit AssetAdded(asset, symbol);
    }

    function removeSupportedAsset(address asset) external onlyOwner {
        require(supportedAssets[asset], "Not supported");
        
        supportedAssets[asset] = false;
        
        // Remove from array (expensive but infrequent operation)
        for (uint i = 0; i < supportedAssetsList.length; i++) {
            if (supportedAssetsList[i] == asset) {
                supportedAssetsList[i] = supportedAssetsList[supportedAssetsList.length - 1];
                supportedAssetsList.pop();
                break;
            }
        }
        
        emit AssetRemoved(asset);
    }

    function setDeploymentFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeChanged(oldFee, newFee);
    }

    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Rate too high"); // Max 10%
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;
        emit PlatformFeeRateChanged(oldRate, newRate);
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Zero address");
        platformTreasury = newTreasury;
    }

    // --- View Functions ---
    
    function getDeployedVaultsCount() external view returns (uint256) {
        return deployedVaults.length;
    }

    function getUserVaults(address user) external view returns (address[] memory) {
        return userVaults[user];
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssetsList;
    }

    function getVaultInfo(address vault) external view returns (VaultInfo memory) {
        return vaultInfo[vault];
    }

    function calculateDeploymentCost() external view returns (uint256) {
        return deploymentFee;
    }

    // --- Helper Functions for Frontend ---
    
    function getVaultOverview(address vault) external view returns (
        VaultInfo memory info,
        uint256 tvl,
        uint256 sharePrice,
        uint256 totalShares,
        bool isPaused
    ) {
        if (vaultInfo[vault].owner == address(0)) revert VaultNotFound();
        
        info = vaultInfo[vault];
        MaonoVault vaultContract = MaonoVault(vault);
        
        tvl = vaultContract.totalAssets();
        totalShares = vaultContract.totalSupply();
        sharePrice = totalShares == 0 ? 1e18 : (tvl * 1e18) / totalShares;
        isPaused = vaultContract.paused();
    }

    function getMultipleVaultOverviews(address[] calldata vaults) external view returns (
        VaultInfo[] memory infos,
        uint256[] memory tvls,
        uint256[] memory sharePrices
    ) {
        uint256 length = vaults.length;
        infos = new VaultInfo[](length);
        tvls = new uint256[](length);
        sharePrices = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address vault = vaults[i];
            infos[i] = vaultInfo[vault];
            
            if (infos[i].owner != address(0)) {
                MaonoVault vaultContract = MaonoVault(vault);
                tvls[i] = vaultContract.totalAssets();
                uint256 totalShares = vaultContract.totalSupply();
                sharePrices[i] = totalShares == 0 ? 1e18 : (tvls[i] * 1e18) / totalShares;
            }
        }
    }
}

// --- Deployment and Usage Examples ---

/**
 * @title DeploymentExample
 * @notice Example deployment and usage patterns
 */
contract DeploymentExample {
    MaonoVaultFactory public factory;
    MaonoVault public vault;
    IERC20 public asset;

    // Example 1: Deploy the factory
    function deployFactory(
        address platformTreasury,
        address usdcAddress,
        address daiAddress
    ) external {
        address[] memory assets = new address[](2);
        string[] memory symbols = new string[](2);
        
        assets[0] = usdcAddress;
        assets[1] = daiAddress;
        symbols[0] = "USDC";
        symbols[1] = "DAI";

        factory = new MaonoVaultFactory(
            platformTreasury,
            assets,
            symbols
        );
    }

    // Example 2: Deploy a new vault instance
    function deployMyVault(
        address assetAddress,
        address managerAddress,
        address treasuryAddress
    ) external payable {
        string[] memory initialDAOs = new string[](2);
        initialDAOs[0] = "DAO_1";
        initialDAOs[1] = "DAO_2";

        MaonoVaultFactory.VaultConfig memory config = MaonoVaultFactory.VaultConfig({
            minDeposit: 100 * 1e18,    // 100 tokens minimum
            vaultCap: 1000000 * 1e18,  // 1M tokens cap
            performanceFee: 2000,       // 20%
            managementFee: 200,         // 2%
            withdrawalDelay: 2 days     // 2 day delay
        });

        address vaultAddress = factory.deployVault{value: msg.value}(
            assetAddress,
            managerAddress,
            treasuryAddress,
            "My Community Vault",
            "MCV",
            initialDAOs,
            config
        );

        vault = MaonoVault(vaultAddress);
    }

    // Example 3: User interactions
    function userDeposit(uint256 amount) external {
        asset.transferFrom(msg.sender, address(this), amount);
        asset.approve(address(vault), amount);
        vault.deposit(amount, msg.sender);
    }

    function userWithdraw(uint256 shares) external {
        vault.redeem(shares, msg.sender, msg.sender);
    }

    // Example 4: Manager operations
    function managerUpdateNAV(uint256 newNAV) external {
        // Only vault manager can call this
        vault.updateNAV(newNAV);
    }

    function managerCollectFees() external {
        // Only vault manager can call this
        vault.collectManagementFees();
    }
}