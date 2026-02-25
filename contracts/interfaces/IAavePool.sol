// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAavePool
 * @dev Interface for Aave V3 Pool
 * Minimal interface for flash loan functionality
 */
interface IAavePool {
    /**
     * Execute a flashloan
     */
    function flashLoan(
        address receiver,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    /**
     * Get flash loan fee in basis points
     */
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}
