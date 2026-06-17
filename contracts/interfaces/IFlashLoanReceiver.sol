// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IFlashLoanReceiver
 * @dev Interface for flash loan receivers (extended)
 */
interface IFlashLoanReceiver {
    /**
     * Called by Aave pool during flash loan execution
     * Must return true and repay the loan + premium
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    /**
     * Get the Aave pool address
     */
    function POOL() external view returns (address);
}
