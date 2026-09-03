# ADR 0002: Migrate Treasury Funds Through Multisig Withdrawal

**Date**: 2026-08-25  
**Status**: Accepted

## Context

`ChamaTreasury` does not expose a special migration, sweep, or emergency fund-transfer function. `ChamaTreasuryFactory.deactivateTreasury()` only marks a treasury record inactive in the factory registry; it does not move funds or replace the treasury.

## Decision

Treasury migration uses the normal multisig withdrawal flow:

1. A signer calls `proposeWithdrawal()` with the replacement treasury address as the recipient.
2. The required signers confirm the proposal with `confirmProposal()`.
3. A signer calls `executeProposal()` after the configured timelock expires.

The applicable delay is selected from the transfer amount using `smallTransferLimit`, `smallTransferDelay`, and `largeTransferDelay`. `pause()` may be used as a separate safety action, but it is not a migration mechanism.

## Consequences

- Migration remains explicit, auditable, and governed by the configured signer threshold.
- Funds cannot be moved instantly; confirmations and the amount-based timelock are required.
- Operators must not treat factory deactivation as a fund transfer or assume a special sweep path exists.

## Governance Boundary

The protocol multisig is a separate governance body from an individual chama's signer set. The contract enforces exactly five unique, nonzero signer addresses and the existing 3-of-5, 48-hour execution delay. It cannot establish that those addresses are controlled by five independent people. Founder, advisor, and community-delegate independence is therefore an operational deployment and governance responsibility, not an on-chain guarantee.

## Upgradeability Boundary

Use ERC-1167 clones for the lowest-cost Chama deployments when existing instances do not need upgrades. If global upgrades for existing groups are required, use `BeaconProxy` instances behind an `UpgradeableBeacon` owned by `MultiSigTreasury`. The Beacon address must first be added to `allowedTargets` through a multisig self-call; subsequent `upgradeTo(newImplementation)` calls then inherit the multisig's 3-of-5 approval and mandatory 48-hour delay. A Beacon upgrade affects every proxy, so implementations require the same review and release discipline as a platform-wide migration.

The protocol multisig is deployed before `MTAAToken` because the token constructor needs its address. The deployment account performs a one-time `setMtaaToken()` bootstrap immediately after token deployment; this initializes the token allowlist entry. It cannot be used to change the token after initialization.

## Notes

- [ChamaTreasury.sol](../../../contracts/ChamaTreasury.sol) — withdrawal proposal, confirmation, timelock, and execution flow.
- [ChamaTreasuryFactory.sol](../../../contracts/ChamaTreasuryFactory.sol) — clone deployment and registry-only deactivation.
- [README.md](../../../README.md) — Hardhat and Foundry toolchain boundary.