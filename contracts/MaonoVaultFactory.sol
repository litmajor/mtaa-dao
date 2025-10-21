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

    struct VaultConfig {
        uint256 minDeposit;
        uint256 vaultCap;
        uint256 performanceFee;
        uint256 managementFee;
        uint256 withdrawalDelay;
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
    error InvalidAddress();
    error InvalidConfig();
    error VaultNotFound();
    error RateTooHigh();

    constructor(
        address _platformTreasury,
        address[] memory _initialAssets,
        string[] memory _initialAssetSymbols
    ) Ownable(msg.sender) {
        if (_platformTreasury == address(0)) revert InvalidAddress();
        platformTreasury = _platformTreasury;
        
        // Add initial supported assets
        if (_initialAssets.length != _initialAssetSymbols.length) revert("Arrays length mismatch");
        for (uint256 i = 0; i < _initialAssets.length; ++i) {
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
        if (!supportedAssets[asset]) revert UnsupportedAsset();
        if (msg.value != deploymentFee) revert InsufficientDeploymentFee(); // Exact fee only, no refund gas
        if (manager == address(0) || daoTreasury == address(0)) revert InvalidAddress();

        // Validate config
        if (config.performanceFee > 5000 || config.managementFee > 1000) revert InvalidConfig(); // e.g., max 50% perf, 10% mgmt

        // Deploy new vault (assuming MaonoVault constructor sets name/symbol – adjust if needed)
        vault = address(new MaonoVault(
            asset,
            daoTreasury,
            manager,
            initialDAOs
        ));

        // Batch config settings if MaonoVault supports an init function; otherwise, individual sets
        MaonoVault vaultInstance = MaonoVault(vault);
        if (config.minDeposit > 0) vaultInstance.setMinDeposit(config.minDeposit);
        if (config.vaultCap > 0) vaultInstance.setVaultCap(config.vaultCap);
        if (config.performanceFee > 0) vaultInstance.setPerformanceFee(config.performanceFee);
        if (config.managementFee > 0) vaultInstance.setManagementFee(config.managementFee);
        if (config.withdrawalDelay > 0) vaultInstance.setWithdrawalDelay(config.withdrawalDelay);

        // Transfer ownership to deployer
        vaultInstance.transferOwnership(msg.sender);

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

        // Send fee to platform
        payable(platformTreasury).transfer(deploymentFee);

        emit VaultDeployed(vault, msg.sender, manager, asset, vaultName, vaultSymbol);
        return vault;
    }

    // --- Admin Functions ---
    
    /**
     * @notice Add a supported asset
     * @param asset The asset address
     * @param symbol The asset symbol
     */
    function addSupportedAsset(address asset, string memory symbol) external onlyOwner {
        _addSupportedAsset(asset, symbol);
    }

    function _addSupportedAsset(address asset, string memory symbol) internal {
        if (asset == address(0)) revert InvalidAddress();
        if (supportedAssets[asset]) revert("Already supported");
        
        supportedAssets[asset] = true;
        supportedAssetsList.push(asset);
        assetSymbols[asset] = symbol;
        
        emit AssetAdded(asset, symbol);
    }

    /**
     * @notice Remove a supported asset
     * @param asset The asset address
     */
    function removeSupportedAsset(address asset) external onlyOwner {
        if (!supportedAssets[asset]) revert("Not supported");
        
        supportedAssets[asset] = false;
        
        // Unordered removal to save gas: swap with last and pop
        uint256 length = supportedAssetsList.length;
        for (uint256 i = 0; i < length; ++i) {
            if (supportedAssetsList[i] == asset) {
                if (i != length - 1) {
                    supportedAssetsList[i] = supportedAssetsList[length - 1];
                }
                supportedAssetsList.pop();
                break;
            }
        }
        
        emit AssetRemoved(asset);
    }

    /**
     * @notice Set new deployment fee
     * @param newFee The new fee amount
     */
    function setDeploymentFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeChanged(oldFee, newFee);
    }

    /**
     * @notice Set new platform fee rate
     * @param newRate The new rate in basis points
     */
    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        if (newRate > 1000) revert RateTooHigh(); // Max 10%
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;
        emit PlatformFeeRateChanged(oldRate, newRate);
    }

    /**
     * @notice Set new platform treasury
     * @param newTreasury The new treasury address
     */
    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        platformTreasury = newTreasury;
    }

    // --- View Functions ---
    
    /**
     * @notice Get count of deployed vaults
     */
    function getDeployedVaultsCount() external view returns (uint256) {
        return deployedVaults.length;
    }

    /**
     * @notice Get vaults deployed by a user
     * @param user The user address
     */
    function getUserVaults(address user) external view returns (address[] memory) {
        return userVaults[user];
    }

    /**
     * @notice Get list of supported assets
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssetsList;
    }

    /**
     * @notice Get info for a vault
     * @param vault The vault address
     */
    function getVaultInfo(address vault) external view returns (VaultInfo memory) {
        return vaultInfo[vault];
    }

    /**
     * @notice Get current deployment cost
     */
    function calculateDeploymentCost() external view returns (uint256) {
        return deploymentFee;
    }

    // --- Helper Functions for Frontend ---
    
    /**
     * @notice Get overview for a single vault
     * @param vault The vault address
     */
    function getVaultOverview(address vault) external view returns (
        VaultInfo memory info,
        uint256 tvl,
        uint256 sharePrice,
        uint256 totalShares,
        bool isPaused
    ) {
        info = vaultInfo[vault];
        if (info.owner == address(0)) revert VaultNotFound();
        
        MaonoVault vaultContract = MaonoVault(vault);
        
        tvl = vaultContract.totalAssets();
        totalShares = vaultContract.totalSupply();
        sharePrice = totalShares == 0 ? 1e18 : (tvl * 1e18) / totalShares;
        isPaused = vaultContract.paused();
    }

    /**
     * @notice Get overviews for multiple vaults
     * @param vaults Array of vault addresses
     */
    function getMultipleVaultOverviews(address[] calldata vaults) external view returns (
        VaultInfo[] memory infos,
        uint256[] memory tvls,
        uint256[] memory sharePrices
    ) {
        uint256 length = vaults.length;
        infos = new VaultInfo[](length);
        tvls = new uint256[](length);
        sharePrices = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
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
 * @notice Example deployment and usage patterns (for illustration/testing only)
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

    // Example 3: User interactions (assume approvals handled externally)
    function userDeposit(uint256 amount) external {
        // In production, use SafeERC20 and ensure approvals
        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.safeApprove(address(vault), amount);
        vault.deposit(amount, msg.sender);
    }

    function userWithdraw(uint256 shares) external {
        vault.redeem(shares, msg.sender, msg.sender);
    }

    // Example 4: Manager operations (assume caller is manager)
    function managerUpdateNAV(uint256 newNAV) external {
        vault.updateNAV(newNAV);
    }

    function managerCollectFees() external {
        vault.collectManagementFees();
    }
}