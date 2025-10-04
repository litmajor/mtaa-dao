// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SampleMoolaLendingStrategy
 * @notice A sample lending strategy for MaonoVault that supplies cUSD to Moola on Celo
 * @dev Implements the IStrategy interface for depositing into and withdrawing from Moola lending pool
 */
interface ILendingPool {
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

contract SampleMoolaLendingStrategy {
    using SafeERC20 for IERC20;

    address public immutable assetAddress; // cUSD address
    address public immutable mToken; // mCUSD address
    address public immutable lendingPool; // Moola Lending Pool address
    address public immutable vault; // MaonoVault address

    /**
     * @notice Constructor to initialize the strategy
     * @param _asset cUSD token address (0x765DE816845861e75A25fCA122bb6898B8B1282a)
     * @param _mToken mCUSD token address (0x918146359264C492BD6934071c6Bd31C854EDBc3)
     * @param _lendingPool Moola Lending Pool address (0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535)
     * @param _vault Address of the MaonoVault contract
     */
    constructor(
        address _asset,
        address _mToken,
        address _lendingPool,
        address _vault
    ) {
        require(_asset != address(0), "Invalid asset address");
        require(_mToken != address(0), "Invalid mToken address");
        require(_lendingPool != address(0), "Invalid lending pool address");
        require(_vault != address(0), "Invalid vault address");

        assetAddress = _asset;
        mToken = _mToken;
        lendingPool = _lendingPool;
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Caller is not the vault");
        _;
    }

    /**
     * @notice Returns the underlying asset address
     * @return address The asset address
     */
    function asset() external view returns (address) {
        return assetAddress;
    }

    /**
     * @notice Returns the total assets managed by this strategy
     * @return uint256 The total assets (balance of mCUSD)
     */
    function totalAssets() external view returns (uint256) {
        return IERC20(mToken).balanceOf(address(this));
    }

    /**
     * @notice Deposits assets into the Moola lending pool
     * @param assets Amount of assets to deposit
     */
    function deposit(uint256 assets) external onlyVault {
        if (assets == 0) revert("Zero deposit amount");

        // Approve the lending pool to spend the assets
        IERC20(assetAddress).approve(lendingPool, assets);

        // Deposit into Moola (receives mCUSD)
        ILendingPool(lendingPool).deposit(assetAddress, assets, address(this), 0);
    }

    /**
     * @notice Withdraws assets from the Moola lending pool
     * @param assets Amount of assets to withdraw
     * @return uint256 The actual amount received
     */
    function withdraw(uint256 assets) external onlyVault returns (uint256) {
        if (assets == 0) revert("Zero withdraw amount");

        // Withdraw from Moola (burns mCUSD and sends cUSD to the vault)
        uint256 received = ILendingPool(lendingPool).withdraw(assetAddress, assets, msg.sender);

        return received;
    }
}

interface IStrategy {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets) external;
    function withdraw(uint256 assets) external returns (uint256 received);
}