// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IPoolAddressesProvider
 * @dev Interface to get the Aave Pool address
 */
interface IPoolAddressesProvider {
    /**
     * Get the Aave pool address
     */
    function getPool() external view returns (address);
}
