# Governance Domain Architecture

## Overview

This document captures the intended governance architecture for both DAO governance and protocol governance in the platform.

## Scope

### DAO governance

DAO governance covers features that are scoped to a single DAO, including:

- DAO membership and member activity
- DAO-specific proposals and votes
- DAO treasury and budget operations
- DAO leaderboards and member ranking
- DAO-specific governance metrics

### Protocol governance

Protocol governance covers platform-wide governance flows that apply across DAOs or to the broader platform, including:

- Proposal execution
- Quorum enforcement
- Governance rules evaluation
- Delegation and voting mechanics
- Governance auditing and analytics

---

## Architecture Principles

1. Keep DAO-scoped governance under the DAO namespace.
2. Keep platform-wide governance under the protocol governance namespace.
3. Keep route handlers thin and push business logic into services.
4. Use shared services for rules, audit, simulation, and leaderboards.
5. Treat the v2 governance router and governance service as the consolidation target rather than as a second implementation.

---

## Recommended Topology

### DAO governance API

Base path:

- /api/v1/daos/:daoId/governance

Examples:

- /api/v1/daos/:daoId/governance/leaderboard
- /api/v1/daos/:daoId/governance/stats
- /api/v1/daos/:daoId/governance/members/:userId/rank
- /api/v1/daos/:daoId/governance/top-contributors

### Protocol governance API

Base path:

- /api/governance

Examples:

- /api/governance/proposals/:proposalId/execute
- /api/governance/proposals/:proposalId/cancel
- /api/governance/quorum
- /api/governance/delegate
- /api/governance/templates

---

## Service Boundaries

### DAO-scoped services

- DAO membership and role queries
- DAO-specific proposal and vote retrieval
- DAO-specific treasury and access control
- DAO leaderboards and score aggregation

### Protocol services

- Quorum calculation and enforcement
- Proposal execution queueing
- Governance rules validation
- Proposal simulation
- Audit event emission

### Shared support services

- [server/services/rules-integration.ts](../server/services/rules-integration.ts)
- [server/services/proposalSimulationService.ts](../server/services/proposalSimulationService.ts)
- [server/services/governanceLeaderboardService.ts](../server/services/governanceLeaderboardService.ts)
- [server/services/auditConsolidated.ts](../server/services/auditConsolidated.ts)

---

## Current State and Gap

The current codebase contains a split implementation:

- active DAO-scoped governance routes in [server/routes/v1/daos/_daoId/governance.ts](../server/routes/v1/daos/_daoId/governance.ts)
- active protocol governance routes in [server/routes/governance.ts](../server/routes/governance.ts)
- a larger, unmounted implementation draft in [server/routes/governance-v2.ts](../server/routes/governance-v2.ts) backed by [server/services/governance-service.ts](../server/services/governance-service.ts)

That means the governance domain is not yet consolidated into a single live implementation.

---

## Recommended Next Step

Treat the v2 router and the large governance service as the canonical implementation target and migrate the active route files to that service layer incrementally.
