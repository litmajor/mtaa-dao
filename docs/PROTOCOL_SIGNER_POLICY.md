# Protocol Signer Policy

**Status**: Accepted  
**Applies to**: The platform-level `MultiSigTreasury` that controls protocol-wide authorities, including an `UpgradeableBeacon` when BeaconProxy deployments are used.

## Purpose

The protocol multisig is separate from each individual Chama's local signer set. It protects platform-wide actions such as Beacon upgrades and must remain usable without depending on one person or one key.

## Required Composition

The five seats should be filled as follows:

1. **Core technical team (1-2 seats)**: smart-contract architect or CTO who understands upgrades and incident response.
2. **Operations and finance lead (1 seat)**: CEO, COO, or finance officer responsible for treasury operations.
3. **External trusted parties (1-2 seats)**: independent security advisors, ecosystem grant leads, or trusted community delegates.

The contract enforces five unique, nonzero addresses and requires 3-of-5 approval with a mandatory 48-hour delay. It cannot prove that five addresses belong to five independent people. Before deployment and after every replacement, the team must record the seat holder, identity verification, conflict-of-interest review, and confirmation that each key is controlled independently.

## Key and Availability Requirements

- Each signer uses a dedicated hardware wallet or isolated Web3 wallet.
- No signer shares a seed phrase, device, or hot wallet with another signer.
- Signers should be distributed across locations and schedules so three approvals can be gathered promptly.
- Each signer confirms a secure backup and a tested recovery procedure without disclosing private material.
- A quarterly check records the last successful signing test and current contact route for every seat.

## Replacement Triggers

A replacement process must begin when a signer:

- leaves the team or no longer holds the role;
- reports a lost, exposed, inaccessible, or suspected-compromised key; or
- has been inactive for more than 30 consecutive days without an approved leave notice.

A signer on approved leave must name a return date and a reachable backup contact. Approved leave does not permanently transfer signing authority; inactivity beyond 30 days without that record is treated as a replacement trigger.

## Replacement Procedure

1. Record the trigger, affected seat, incident details, and proposed replacement in the governance log.
2. Immediately notify the remaining signers and complete a conflict-of-interest and independence review for the replacement.
3. If compromise is suspected, stop proposing new sensitive actions and use the existing multisig-controlled pause or incident process where available. Do not use a private-key shortcut.
4. The remaining signers submit a transaction targeting `MultiSigTreasury` itself and call `replaceSigner(oldSigner, newSigner)`.
5. Three of five signers confirm the transaction. The mandatory 48-hour timelock remains visible on-chain before execution.
6. After execution, verify the signer list, update the governance log, rotate any affected operational credentials, and run a signing test with the new seat.

If the remaining available signers cannot reach 3-of-5, the contract has no unilateral recovery path. The team must follow the documented deployment or incident-recovery procedure; a new contract deployment may be required.

## Annual Rotation

The team should plan annual seat review and rotation. The contract can enforce a pre-approved annual rotation schedule, but it cannot determine whether a real person is inactive or select a replacement. Those checks remain governance responsibilities.

## Scope Boundary

This policy governs the platform multisig. Individual Chama signers are managed under each Chama's own governance rules and are not automatically replaced by a protocol signer action.

See [ADR 0002](adr/contracts/0002-treasury-migration-via-multisig-withdrawal.md) for the related treasury migration and upgradeability decision.
