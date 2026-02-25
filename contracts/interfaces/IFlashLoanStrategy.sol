// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IFlashLoanStrategy
 * @dev Interface for flash loan execution strategies
 * Implementations define how to execute a flash loan opportunity
 */
interface IFlashLoanStrategy {
    /**
     * Execute a flash loan strategy
     * @param asset The borrowed asset address
     * @param amount The borrowed amount
     * @param params Encoded strategy-specific parameters
     * @return success Whether execution succeeded
     * @return profit The profit amount (in asset terms)
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external returns (bool success, uint256 profit);
}
