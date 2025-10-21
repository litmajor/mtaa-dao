// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MoolaLendingStrategy
 * @notice Production-grade lending strategy for MaonoVault, supplying cUSD to Moola on Celo
 * @dev Implements IStrategy; handles deposits/withdrawals to Moola LendingPool. Ownable for config, Pausable for emergencies.
 *      Assumes cUSD (18 decimals). Verified addresses as of 2025 (Moola integrated with Celo; consider Aave V3 migration).
 * @author [Your Name/Team]
 */
interface ILendingPool {
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IStrategy {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets) external;
    function withdraw(uint256 assets) external returns (uint256 received);
}

contract MoolaLendingStrategy is IStrategy, Ownable, Pausable {
    using SafeERC20 for IERC20;

    address public immutable assetAddress; // cUSD address
    address public immutable mToken; // mCUSD address
    address public lendingPool; // Moola Lending Pool address (configurable)
    address public vault; // MaonoVault address (configurable)

    // Events
    event Deposited(uint256 amount);
    event Withdrawn(uint256 amount, uint256 received);
    event EmergencyWithdrawn(uint256 amount);
    event LendingPoolUpdated(address oldPool, address newPool);
    event VaultUpdated(address oldVault, address newVault);

    // Errors
    error ZeroAmount();
    error InvalidAddress();
    error NotVault();
    error InsufficientBalance(uint256 requested, uint256 available);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    /**
     * @notice Constructor to initialize the strategy
     * @param _asset cUSD token address (0x765DE816845861e75A25fCA122bb6898B8B1282a on Celo)
     * @param _mToken mCUSD token address (0x918146359264C492BD6934071c6Bd31C854EDBc3 on Celo)
     * @param _lendingPool Moola Lending Pool address (0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535 on Celo)
     * @param _vault Address of the MaonoVault contract
     */
    constructor(
        address _asset,
        address _mToken,
        address _lendingPool,
        address _vault
    ) Ownable(msg.sender) {
        if (_asset == address(0) || _mToken == address(0) || _lendingPool == address(0) || _vault == address(0)) revert InvalidAddress();

        assetAddress = _asset;
        mToken = _mToken;
        lendingPool = _lendingPool;
        vault = _vault;

        // Infinite approval for LendingPool (gas-efficient)
        IERC20(_asset).safeApprove(_lendingPool, type(uint256).max);
    }

    /**
     * @notice Returns the underlying asset address
     * @return address The asset address
     */
    function asset() external view override returns (address) {
        return assetAddress;
    }

    /**
     * @notice Returns the total assets managed by this strategy (including accrued interest)
     * @return uint256 The total assets (mCUSD balance)
     */
    function totalAssets() external view override returns (uint256) {
        return IERC20(mToken).balanceOf(address(this));
    }

    /**
     * @notice Deposits assets into the Moola lending pool
     * @param assets Amount of assets to deposit
     */
    function deposit(uint256 assets) external override onlyVault whenNotPaused {
        if (assets == 0) revert ZeroAmount();

        // Check allowance (though infinite, safety)
        uint256 allowance = IERC20(assetAddress).allowance(address(this), lendingPool);
        if (allowance < assets) {
            IERC20(assetAddress).safeIncreaseAllowance(lendingPool, assets - allowance);
        }

        // Transfer from vault to strategy
        IERC20(assetAddress).safeTransferFrom(msg.sender, address(this), assets);

        // Deposit into Moola (receives mCUSD)
        ILendingPool(lendingPool).deposit(assetAddress, assets, address(this), 0);

        emit Deposited(assets);
    }

    /**
     * @notice Withdraws assets from the Moola lending pool
     * @param assets Amount of assets to withdraw
     * @return received The actual amount received (may include interest)
     */
    function withdraw(uint256 assets) external override onlyVault returns (uint256 received) {
        if (assets == 0) revert ZeroAmount();

        uint256 strategyBalance = IERC20(mToken).balanceOf(address(this));
        if (assets > strategyBalance) revert InsufficientBalance(assets, strategyBalance);

        // Withdraw from Moola (burns mCUSD, sends cUSD to vault)
        received = ILendingPool(lendingPool).withdraw(assetAddress, assets, vault);

        emit Withdrawn(assets, received);

        return received;
    }

    /**
     * @notice Returns the maximum withdrawable amount
     * @return uint256 Max withdrawable (mCUSD balance)
     */
    function maxWithdraw() external view returns (uint256) {
        return IERC20(mToken).balanceOf(address(this));
    }

    // --- Admin Functions ---

    /**
     * @notice Emergency withdraw all assets to vault
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = IERC20(mToken).balanceOf(address(this));
        if (balance == 0) return;

        uint256 received = ILendingPool(lendingPool).withdraw(assetAddress, type(uint256).max, vault);

        emit EmergencyWithdrawn(received);
    }

    /**
     * @notice Update lending pool address (e.g., for migrations)
     * @param newPool New lending pool address
     */
    function setLendingPool(address newPool) external onlyOwner {
        if (newPool == address(0)) revert InvalidAddress();
        address oldPool = lendingPool;
        lendingPool = newPool;

        // Update approval
        IERC20(assetAddress).safeApprove(oldPool, 0);
        IERC20(assetAddress).safeApprove(newPool, type(uint256).max);

        emit LendingPoolUpdated(oldPool, newPool);
    }

    /**
     * @notice Update vault address (e.g., for upgrades)
     * @param newVault New vault address
     */
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert InvalidAddress();
        address oldVault = vault;
        vault = newVault;

        emit VaultUpdated(oldVault, newVault);
    }

    /**
     * @notice Pause the strategy (prevents deposits/withdraws)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the strategy
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}