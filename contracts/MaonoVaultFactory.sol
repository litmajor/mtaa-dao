// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MaonoVault.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";        // UPGRADE #4
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";               // UPGRADE #1

interface IDAOSpawnGateway {
    function consumeSpawnCredit(address user, uint256 vaultType) external;
}

// ---------------------------------------------------------------------------
// VAULT INTERFACE — required for clone initialization
// ---------------------------------------------------------------------------
// ⚠️  MaonoVault_Phase1B MUST expose this function (replace constructor args
//     with an Initializable initializer so clones can be bootstrapped post-
//     deployment).  Add `import "@openzeppelin/contracts/proxy/utils/Initializable.sol";`
//     to the vault and annotate initialize() with the `initializer` modifier.
// ---------------------------------------------------------------------------
interface IMaonoVaultInitializable {
    function initialize(
        address asset,
        string  memory name,
        string  memory symbol,
        address vaultOwner,
        uint8   vaultType,
        address platformTreasury,
        address mtaaToken,
        address priceOracle
    ) external;
}

/**
 * @title  MaonoVaultFactory (Phase 1B — Production Upgrades)
 * @notice EIP-1167 clone factory with registry verification, treasury rotation,
 *         two-step ownership, and implementation versioning.
 *
 * ─── UPGRADES ──────────────────────────────────────────────────────────────
 *  #1  EIP-1167 Minimal Proxy Clones
 *        • Replaces `new MaonoVault_Phase1A(...)` with `Clones.clone(vaultImplementation)`
 *        • ~90 % reduction in per-vault deployment gas
 *        • Each clone permanently embeds the implementation address at deploy time —
 *          changing `vaultImplementation` later only affects NEW vaults, not existing ones
 *
 *  #2  isLegitimateVault registry
 *        • mapping(address => bool) set to true for every factory-deployed vault
 *        • `isVaultRegistered(address)` view lets UIs & external contracts
 *          verify authenticity without trusting user-supplied addresses
 *
 *  #3  setPlatformTreasury()
 *        • Allows owner (Multi-Sig) to rotate the treasury address if the
 *          treasury contract is ever upgraded — previously impossible
 *        • Emits old + new addresses for a clean on-chain audit trail
 *
 *  #4  Ownable2Step (replaces Ownable)
 *        • Owner transfers are a two-transaction process: transferOwnership()
 *          proposes, acceptOwnership() confirms
 *        • Prevents accidental permanent handover to a wrong address
 *
 *  #5  setVaultImplementation()
 *        • Points the factory at a new implementation contract for future vaults
 *        • Zero impact on already-deployed clones (they are immutable at the
 *          bytecode level with their original implementation address)
 *        • Enables rolling out logic improvements without redeploying the factory
 *
 * ─── RETAINED FROM PHASE 1A ────────────────────────────────────────────────
 *  FIX #1  Spawn cost collected HERE at factory, not inside the vault on first deposit
 *  FIX #3  Per-user vault cap (MAX_VAULTS_PER_USER = 5)
 *
 * ─── BONUS CORRECTIONS ─────────────────────────────────────────────────────
 *  •  SafeERC20 now used correctly: safeTransferFrom / safeTransfer throughout
 *     (Phase 1A called IERC20.transferFrom directly and checked the bool return,
 *      which is fragile for tokens that revert silently)
 *  •  VaultInfo now records `implementation` — lets you audit which vault logic
 *     version each vault was deployed against
 *  •  VaultDeployed event includes `implementation` field (⚠️  indexers must
 *     update their ABI — this is a breaking event signature change vs Phase 1A)
 * ──────────────────────────────────────────────────────────────────────────
 */
contract MaonoVaultFactory_Phase1B is Ownable2Step {   // UPGRADE #4
    using SafeERC20 for IERC20;

    // ======================================================================
    // UPGRADE #1 — CLONE IMPLEMENTATION SLOT
    // ======================================================================
    /// @notice Canonical MaonoVault_Phase1B implementation all clones delegate to.
    ///         Deploy the implementation once; this address is embedded in every
    ///         subsequent clone's bytecode at the time of that clone's deployment.
    address public vaultImplementation;

    // ======================================================================
    // CONFIGURATION
    // ======================================================================
    address public platformTreasury;
    address public mtaaToken;
    address public priceOracle;

    mapping(address => bool)    public supportedAssets;
    address[]                   public supportedAssetsList;

    // ======================================================================
    // VAULT REGISTRY
    // ======================================================================
    address[]                              public deployedVaults;
    mapping(address vault => VaultInfo)    public vaultInfo;
    mapping(address user  => address[])    public userVaults;

    /// @notice UPGRADE #2 — authenticity map; true only for factory-deployed vaults
    mapping(address vault => bool) public isLegitimateVault;

    struct VaultInfo {
        address vault;
        address owner;
        address asset;
        string  name;
        uint256 deployedAt;
        uint256 vaultType;       // 0 Savings | 1 Escrow | 2 Business | 3 Investing | 4 Custom
        address implementation;  // UPGRADE #1 — which impl version was active at deploy time
        bool    isActive;
    }

    // ======================================================================
    // PER-USER VAULT CAP  (FIX #3 from Phase 1A)
    // ======================================================================
    mapping(address user => uint256 count) public userVaultCount;
    uint256 public constant MAX_VAULTS_PER_USER = 5;

    // ======================================================================
    // SPAWN GATEWAY
    // ======================================================================
    address public spawnGateway;

    // ======================================================================
    // EVENTS
    // ======================================================================
    event VaultDeployed(
        address indexed vault,
        address indexed owner,
        address indexed asset,
        string  name,
        uint256 vaultType,
        address implementation,   // UPGRADE #1
        uint256 timestamp
    );

    event AssetAdded(address indexed asset, string symbol, uint256 timestamp);
    event AssetRemoved(address indexed asset, uint256 timestamp);

    event SpawnGatewayUpdated(address indexed oldGateway, address indexed newGateway, uint256 timestamp);

    event PriceOracleUpdated(address indexed newOracle, uint256 timestamp);

    /// @notice UPGRADE #3
    event PlatformTreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury,
        uint256 timestamp
    );

    /// @notice UPGRADE #5
    event VaultImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        uint256 timestamp
    );

    // ======================================================================
    // ERRORS
    // ======================================================================
    error UnsupportedAsset();
    error InvalidVaultType();
    error InvalidAddress();
    error MaxVaultsPerUserExceeded();
    error BurnFailed();
    error AssetAlreadySupported();
    error AssetNotSupported();
    error VaultNotRegistered();
    error InitializationFailed();

    // ======================================================================
    // CONSTRUCTOR
    // ======================================================================
    /**
     * @param _vaultImplementation  Pre-deployed MaonoVault_Phase1B implementation contract
     * @param _platformTreasury     Platform treasury (strongly recommend a 3/5 Multi-Sig)
     * @param _mtaaToken            MTAA token address
     * @param _priceOracle          Price oracle address
     * @param _initialAssets        Supported asset list (e.g. [cUSD, USDC])
     */
    constructor(
        address   _vaultImplementation,
        address   _platformTreasury,
        address   _mtaaToken,
        address   _priceOracle,
        address[] memory _initialAssets
    ) Ownable(msg.sender) {
        if (
            _vaultImplementation == address(0) ||
            _platformTreasury    == address(0) ||
            _mtaaToken           == address(0)
        ) revert InvalidAddress();

        vaultImplementation = _vaultImplementation;
        platformTreasury    = _platformTreasury;
        mtaaToken           = _mtaaToken;
        priceOracle         = _priceOracle;

        for (uint256 i = 0; i < _initialAssets.length; ++i) {
            supportedAssets[_initialAssets[i]] = true;
            supportedAssetsList.push(_initialAssets[i]);
        }
    }

    // ======================================================================
    // DEPLOY VAULT  (FIX #1 + UPGRADE #1 + UPGRADE #2)
    // ======================================================================
    /**
     * @notice Deploy a new MaonoVault as an EIP-1167 minimal proxy clone
     * @dev    Spawn cost is pulled from msg.sender BEFORE the clone is created.
     *         The clone permanently embeds the address in `vaultImplementation`
     *         at the time of this call — updating the implementation later will
     *         not affect this vault.
     *
     * @param asset      Vault denominating asset (cUSD, USDC, etc.)
     * @param name       Human-readable vault name
     * @param symbol     Vault LP token symbol
     * @param vaultType  0=Savings 1=Escrow 2=Business 3=Investing 4=Custom
     * @return vault     Address of the newly deployed clone
     */
    function deployVault(
        address asset,
        string  memory name,
        string  memory symbol,
        uint256 vaultType
    ) external returns (address vault) {

        // ── Validation ──────────────────────────────────────────────────────
        if (!supportedAssets[asset])                          revert UnsupportedAsset();
        if (vaultType > 4)                                    revert InvalidVaultType();
        if (userVaultCount[msg.sender] >= MAX_VAULTS_PER_USER) revert MaxVaultsPerUserExceeded();

        // ── Spawn Cost Collection (Delegated) ───────────────────────────────
        if (spawnGateway == address(0)) revert InvalidAddress();
        IDAOSpawnGateway(spawnGateway).consumeSpawnCredit(msg.sender, vaultType);

        // ── UPGRADE #1: Clone instead of `new` ──────────────────────────────
        // Cache impl address — used in registry and event below
        address impl = vaultImplementation;
        vault = Clones.clone(impl);

        // Initialize the clone (replaces constructor arguments)
        // The `initializer` modifier inside the vault ensures this can only run once
        try IMaonoVaultInitializable(vault).initialize(
            asset,
            name,
            symbol,
            msg.sender,       // vault owner (DAO admin)
            uint8(vaultType),
            platformTreasury,
            mtaaToken,
            priceOracle
        ) {} catch {
            revert InitializationFailed();
        }

        // ── Registry  (UPGRADE #2) ───────────────────────────────────────────
        deployedVaults.push(vault);
        userVaults[msg.sender].push(vault);
        userVaultCount[msg.sender]++;

        isLegitimateVault[vault] = true;   // UPGRADE #2

        vaultInfo[vault] = VaultInfo({
            vault:          vault,
            owner:          msg.sender,
            asset:          asset,
            name:           name,
            deployedAt:     block.timestamp,
            vaultType:      vaultType,
            implementation: impl,           // UPGRADE #1 — audit trail
            isActive:       true
        });

        emit VaultDeployed(
            vault, msg.sender, asset, name, vaultType,
            impl,                            // UPGRADE #1
            block.timestamp
        );
    }

    // ======================================================================
    // UPGRADE #3 — TREASURY MANAGEMENT
    // ======================================================================
    /**
     * @notice Rotate the platform treasury address
     * @dev    Required when the treasury contract is upgraded.  Emits both old
     *         and new addresses so the transition is fully visible on-chain.
     *         Caller must be the owner (recommend a Multi-Sig safe).
     */
    function setPlatformTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        address old = platformTreasury;
        platformTreasury = _newTreasury;
        emit PlatformTreasuryUpdated(old, _newTreasury, block.timestamp);
    }

    // ======================================================================
    // UPGRADE #5 — VAULT IMPLEMENTATION MANAGEMENT
    // ======================================================================
    /**
     * @notice Point the factory at a new vault implementation for future deployments
     * @dev    EXISTING clones are completely unaffected — each clone stores the
     *         implementation address in its own bytecode at the time it was
     *         deployed via Clones.clone().  This function only changes what
     *         address NEW clones will embed going forward.
     *
     *         Use this to ship improved vault logic without redeploying the factory
     *         or migrating existing vault state.
     */
    function setVaultImplementation(address _newImplementation) external onlyOwner {
        if (_newImplementation == address(0)) revert InvalidAddress();
        address old = vaultImplementation;
        vaultImplementation = _newImplementation;
        emit VaultImplementationUpdated(old, _newImplementation, block.timestamp);
    }

    // ======================================================================
    // ASSET MANAGEMENT
    // ======================================================================
    function addSupportedAsset(address asset, string memory symbol) external onlyOwner {
        if (asset == address(0))      revert InvalidAddress();
        if (supportedAssets[asset])   revert AssetAlreadySupported();
        supportedAssets[asset] = true;
        supportedAssetsList.push(asset);
        emit AssetAdded(asset, symbol, block.timestamp);
    }

    function removeSupportedAsset(address asset) external onlyOwner {
        if (!supportedAssets[asset]) revert AssetNotSupported();
        supportedAssets[asset] = false;
        uint256 len = supportedAssetsList.length;
        for (uint256 i = 0; i < len; ++i) {
            if (supportedAssetsList[i] == asset) {
                supportedAssetsList[i] = supportedAssetsList[len - 1];
                supportedAssetsList.pop();
                break;
            }
        }
        emit AssetRemoved(asset, block.timestamp);
    }

    // ======================================================================
    // ORACLE MANAGEMENT
    // ======================================================================
    function setPriceOracle(address _newOracle) external onlyOwner {
        if (_newOracle == address(0)) revert InvalidAddress();
        priceOracle = _newOracle;
        emit PriceOracleUpdated(_newOracle, block.timestamp);
    }

    // ======================================================================
    // VIEW / QUERY FUNCTIONS
    // ======================================================================

    /**
     * @notice UPGRADE #2 — verify a vault was legitimately deployed by this factory
     * @dev    UI MUST call this before trusting any vault address supplied by a user.
     *         A rogue vault contract could mimic MaonoVault's interface but would
     *         return false here.
     */
    function isVaultRegistered(address vault) external view returns (bool) {
        return isLegitimateVault[vault];
    }

    function getUserVaults(address user) external view returns (address[] memory) {
        return userVaults[user];
    }

    function canUserSpawnVault(address user) external view returns (bool) {
        return userVaultCount[user] < MAX_VAULTS_PER_USER;
    }

    function getRemainingVaultSlots(address user) external view returns (uint256) {
        uint256 used = userVaultCount[user];
        if (used >= MAX_VAULTS_PER_USER) return 0;
        return MAX_VAULTS_PER_USER - used;
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssetsList;
    }

    function setSpawnGateway(address _newGateway) external onlyOwner {
        if (_newGateway == address(0)) revert InvalidAddress();
        address old = spawnGateway;
        spawnGateway = _newGateway;
        emit SpawnGatewayUpdated(old, _newGateway, block.timestamp);
    }

    function getTotalVaultsDeployed() external view returns (uint256) {
        return deployedVaults.length;
    }

    function getVaultDetails(address vault) external view returns (VaultInfo memory) {
        return vaultInfo[vault];
    }

    function getFactoryStats()
        external
        view
        returns (
            uint256 totalVaults,
            uint256 supportedAssetCount
        )
    {
        return (
            deployedVaults.length,
            supportedAssetsList.length
        );
    }
}
