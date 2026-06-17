// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Minimal initializer-friendly reentrancy guard for upgradeable/cloneable contracts.
 * Provides `__ReentrancyGuard_init()` to set the initial status and a `nonReentrant` modifier.
 */
abstract contract ReentrancyGuardUpgradeable {
    uint256 private _status;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    function __ReentrancyGuard_init() internal {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}
