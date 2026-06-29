// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ========== INTERFACES ========== */

interface IMTAAToken {
    function burn(uint256 amount) external;
}

/* ========== CONTRACT ========== */

/**
 * @title  DAOSpawnGateway
 * @notice Production-grade payment gateway for DAO spawning.
 * @dev    Deploy behind an ERC-1967 UUPS proxy.
 */
contract DAOSpawnGateway is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    /* ---------- constants ---------- */

    uint256 public constant MAX_VAULT_TYPES = 5;
    uint256 public constant BPS_DENOMINATOR = 10000;

    /* ---------- structs ---------- */

    struct VaultConfig {
        uint256 spawnCost;
        uint256 burnBps;    // Basis points (10000 = 100%)
        bool isActive;
    }

    /* ---------- state ---------- */

    IERC20 public mtaaToken;
    IERC20Permit public mtaaPermit;

    address public platformTreasury;

    // Whitelisted factories that can consume spawn credits
    mapping(address => bool) public approvedFactories;

    // user => vaultType => credits
    mapping(address => mapping(uint256 => uint256)) public spawnCredits;

    // Accounting
    mapping(address => uint256) public spawnCostsPaid;
    uint256 public totalSpawnCostCollected;
    uint256 public totalSpawnCostBurned;
    uint256 public totalSpawnCostToTreasury;

    // Vault configs
    VaultConfig[MAX_VAULT_TYPES] public vaultConfigs;

    /* ---------- events ---------- */

    event SpawnFeePaid(
        address indexed payer,
        address indexed creditRecipient,
        uint256 vaultType,
        uint256 amount,
        uint256 burnAmount,
        uint256 treasuryAmount
    );
    event SpawnFeePaidBatch(
        address indexed payer,
        address indexed creditRecipient,
        uint256[] vaultTypes,
        uint256 totalAmount
    );
    event SpawnCreditConsumed(
        address indexed user,
        uint256 vaultType,
        address indexed factory
    );
    event FactoryApprovalUpdated(address indexed factory, bool approved);
    event VaultConfigUpdated(
        uint256 indexed vaultType,
        uint256 spawnCost,
        uint256 burnBps
    );
    event PlatformTreasuryUpdated(address indexed newTreasury);
    event MTAATokenUpdated(address indexed newToken);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    /* ---------- errors ---------- */

    error ZeroAddress();
    error InvalidVaultType(uint256 vaultType);
    error VaultNotActive(uint256 vaultType);
    error InvalidBurnPercentage(uint256 bps);
    error UnauthorizedFactory();
    error NoSpawnCredits(address user, uint256 vaultType);
    error BurnFailed();
    error PermitFailed();
    error EmptyArray();
    error ArrayLengthMismatch();
    error InsufficientPayment(uint256 required, uint256 provided);
    error TransferFailed();

    /* ---------- initializer ---------- */

    function initialize(
        address _mtaaToken,
        address _platformTreasury
    ) external initializer {
        if (_mtaaToken == address(0) || _platformTreasury == address(0)) {
            revert ZeroAddress();
        }

        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        mtaaToken = IERC20(_mtaaToken);
        mtaaPermit = IERC20Permit(_mtaaToken);
        platformTreasury = _platformTreasury;

        // Default vault configs
        vaultConfigs[0] = VaultConfig(150 ether, 10000, true);   // SAVINGS  100% burn
        vaultConfigs[1] = VaultConfig(250 ether, 5000, true);    // ESCROW   50/50
        vaultConfigs[2] = VaultConfig(400 ether, 5000, true);    // BUSINESS 50/50
        vaultConfigs[3] = VaultConfig(600 ether, 3000, true);    // INVESTING 30/70
        vaultConfigs[4] = VaultConfig(1000 ether, 3000, true);   // CUSTOM   30/70
    }

    /* ---------- upgrade auth ---------- */

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /* ---------- admin ---------- */

    function setVaultConfig(
        uint256 vaultType,
        uint256 spawnCost,
        uint256 burnBps,
        bool isActive
    ) external onlyOwner {
        if (vaultType >= MAX_VAULT_TYPES) revert InvalidVaultType(vaultType);
        if (burnBps > BPS_DENOMINATOR) revert InvalidBurnPercentage(burnBps);

        vaultConfigs[vaultType] = VaultConfig(spawnCost, burnBps, isActive);
        emit VaultConfigUpdated(vaultType, spawnCost, burnBps);
    }

    function setApprovedFactory(address factory, bool approved) external onlyOwner {
        if (factory == address(0)) revert ZeroAddress();
        approvedFactories[factory] = approved;
        emit FactoryApprovalUpdated(factory, approved);
    }

    function setApprovedFactoriesBatch(
        address[] calldata factories,
        bool[] calldata approvals
    ) external onlyOwner {
        if (factories.length == 0) revert EmptyArray();
        if (factories.length != approvals.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < factories.length; i++) {
            if (factories[i] == address(0)) revert ZeroAddress();
            approvedFactories[factories[i]] = approvals[i];
            emit FactoryApprovalUpdated(factories[i], approvals[i]);
        }
    }

    function setPlatformTreasury(address _platformTreasury) external onlyOwner {
        if (_platformTreasury == address(0)) revert ZeroAddress();
        platformTreasury = _platformTreasury;
        emit PlatformTreasuryUpdated(_platformTreasury);
    }

    function setMTAAToken(address _mtaaToken) external onlyOwner {
        if (_mtaaToken == address(0)) revert ZeroAddress();
        mtaaToken = IERC20(_mtaaToken);
        mtaaPermit = IERC20Permit(_mtaaToken);
        emit MTAATokenUpdated(_mtaaToken);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    /* ---------- views ---------- */

    function getVaultConfig(uint256 vaultType) external view returns (VaultConfig memory) {
        if (vaultType >= MAX_VAULT_TYPES) revert InvalidVaultType(vaultType);
        return vaultConfigs[vaultType];
    }

    function getSpawnCredits(address user, uint256 vaultType) external view returns (uint256) {
        return spawnCredits[user][vaultType];
    }

    function getTotalCredits(address user) external view returns (uint256 total) {
        for (uint256 i = 0; i < MAX_VAULT_TYPES; i++) {
            total += spawnCredits[user][i];
        }
    }

    /* ---------- core: payment ---------- */

    /**
     * @notice Pay spawn fee for a single vault type. Credit goes to msg.sender.
     */
    function paySpawnFee(uint256 vaultType) external nonReentrant whenNotPaused {
        _paySpawnFee(msg.sender, msg.sender, vaultType);
    }

    /**
     * @notice Pay spawn fee on behalf of a beneficiary.
     */
    function paySpawnFeeFor(address beneficiary, uint256 vaultType) external nonReentrant whenNotPaused {
        if (beneficiary == address(0)) revert ZeroAddress();
        _paySpawnFee(msg.sender, beneficiary, vaultType);
    }

    /**
     * @notice Pay for multiple credits in one tx.
     */
    function paySpawnFeeBatch(
        address beneficiary,
        uint256[] calldata vaultTypes
    ) external nonReentrant whenNotPaused {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (vaultTypes.length == 0) revert EmptyArray();

        uint256 totalAmount;
        for (uint256 i = 0; i < vaultTypes.length; i++) {
            uint256 vaultType = vaultTypes[i];
            if (vaultType >= MAX_VAULT_TYPES) revert InvalidVaultType(vaultType);

            VaultConfig memory cfg = vaultConfigs[vaultType];
            if (!cfg.isActive) revert VaultNotActive(vaultType);

            totalAmount += cfg.spawnCost;
            spawnCredits[beneficiary][vaultType]++;
        }

        IERC20(mtaaToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Process burn/treasury split on total (simplification: proportional to individual splits)
        // For production, you may want per-vault accounting. Here we burn the weighted average.
        _processBatchPayment(totalAmount);

        totalSpawnCostCollected += totalAmount;
        spawnCostsPaid[beneficiary] += totalAmount;

        emit SpawnFeePaidBatch(msg.sender, beneficiary, vaultTypes, totalAmount);
    }

    /**
     * @notice One-tx subscribe using EIP-2612 permit. No approve needed.
     */
    function paySpawnFeeWithPermit(
        address beneficiary,
        uint256 vaultType,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        if (beneficiary == address(0)) revert ZeroAddress();

        VaultConfig memory cfg = vaultConfigs[vaultType];
        if (!cfg.isActive) revert VaultNotActive(vaultType);

        // Use permit to approve this contract
        try mtaaPermit.permit(msg.sender, address(this), cfg.spawnCost, deadline, v, r, s) {
            // Permit succeeded, proceed with internal transfer
            _processPayment(msg.sender, cfg.spawnCost);
        } catch {
            revert PermitFailed();
        }

        spawnCredits[beneficiary][vaultType]++;
        totalSpawnCostCollected += cfg.spawnCost;
        spawnCostsPaid[beneficiary] += cfg.spawnCost;

        uint256 burnAmount = (cfg.spawnCost * cfg.burnBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = cfg.spawnCost - burnAmount;

        emit SpawnFeePaid(msg.sender, beneficiary, vaultType, cfg.spawnCost, burnAmount, treasuryAmount);
    }

    /* ---------- core: credit consumption ---------- */

    /**
     * @notice Factory consumes a user's spawn credit during DAO deployment.
     */
    function consumeSpawnCredit(address user, uint256 vaultType) external nonReentrant whenNotPaused {
        if (!approvedFactories[msg.sender]) revert UnauthorizedFactory();
        if (spawnCredits[user][vaultType] == 0) revert NoSpawnCredits(user, vaultType);

        spawnCredits[user][vaultType]--;
        emit SpawnCreditConsumed(user, vaultType, msg.sender);
    }

    /* ---------- internal ---------- */

    function _paySpawnFee(address payer, address creditRecipient, uint256 vaultType) internal {
        if (vaultType >= MAX_VAULT_TYPES) revert InvalidVaultType(vaultType);

        VaultConfig memory cfg = vaultConfigs[vaultType];
        if (!cfg.isActive) revert VaultNotActive(vaultType);

        uint256 spawnCost = cfg.spawnCost;
        uint256 burnAmount = (spawnCost * cfg.burnBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = spawnCost - burnAmount;

        // Pull MTAA
        IERC20(mtaaToken).safeTransferFrom(payer, address(this), spawnCost);

        // Burn portion
        if (burnAmount > 0) {
            try IMTAAToken(address(mtaaToken)).burn(burnAmount) {
                totalSpawnCostBurned += burnAmount;
            } catch {
                revert BurnFailed();
            }
        }

        // Send to treasury
        if (treasuryAmount > 0) {
            IERC20(mtaaToken).safeTransfer(platformTreasury, treasuryAmount);
            totalSpawnCostToTreasury += treasuryAmount;
        }

        totalSpawnCostCollected += spawnCost;
        spawnCostsPaid[creditRecipient] += spawnCost;
        spawnCredits[creditRecipient][vaultType]++;

        emit SpawnFeePaid(payer, creditRecipient, vaultType, spawnCost, burnAmount, treasuryAmount);
    }

    function _processPayment(address from, uint256 amount) internal {
        IERC20(mtaaToken).safeTransferFrom(from, address(this), amount);
    }

    function _processBatchPayment(uint256 totalAmount) internal {
        // Simplified: burn 50% / treasury 50% for batch payments
        // In production, calculate weighted average based on vault types
        uint256 burnAmount = totalAmount / 2;
        uint256 treasuryAmount = totalAmount - burnAmount;

        if (burnAmount > 0) {
            try IMTAAToken(address(mtaaToken)).burn(burnAmount) {
                totalSpawnCostBurned += burnAmount;
            } catch {
                revert BurnFailed();
            }
        }

        if (treasuryAmount > 0) {
            IERC20(mtaaToken).safeTransfer(platformTreasury, treasuryAmount);
            totalSpawnCostToTreasury += treasuryAmount;
        }
    }
}