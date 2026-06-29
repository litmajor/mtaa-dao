// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Canonical subscription tiers used across the MtaaDAO ecosystem.
 *      Declare once and import to avoid duplicate identifier errors.
 */
enum SubscriptionTier {
    FREE,
    BASIC,
    PREMIUM,
    ENTERPRISE
}
