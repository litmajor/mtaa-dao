# Governance Domain Map

## Purpose

This document maps the governance surface in the platform across two layers:

1. DAO governance: governance flows scoped to a specific DAO, including member activity, proposals, voting, treasury operations, leaderboards, and DAO-specific analytics.
2. Protocol governance: platform-level governance operations such as proposal execution, quorum enforcement, governance rules, simulations, execution queues, and audit trails.

The goal is to make the active routes, supporting services, and likely duplication points explicit so the domain can be consolidated cleanly.

---

## 1. Executive Summary

The governance system currently exists in three overlapping layers:

- Active DAO-scoped routes under [server/routes/v1/daos/_daoId/governance.ts](../server/routes/v1/daos/_daoId/governance.ts) for leaderboard and analytics-style DAO governance reads.
- Active protocol-level governance routes under [server/routes/governance.ts](../server/routes/governance.ts), mounted at /api/governance and /api/governance/quorum via [server/routes.ts](../server/routes.ts).
- A separate, unmounted implementation draft under [server/routes/governance-v2.ts](../server/routes/governance-v2.ts) that imports [server/services/governance-service.ts](../server/services/governance-service.ts).

The most important finding is that [server/services/governance-service.ts](../server/services/governance-service.ts) is a large service module with broad DAO/governance responsibilities, but it is not wired into the active route graph except through the unmounted v2 router. In practice, that means the code exists, but the main server route registration is not using it.

---

## 2. Current Architecture Snapshot

### 2.1 DAO Governance

DAO governance is the domain for operations that are scoped to one DAO.

#### Active DAO governance surface

- File: [server/routes/v1/daos/_daoId/governance.ts](../server/routes/v1/daos/_daoId/governance.ts)
- Mounting path: /api/v1/daos/:daoId/governance
- Responsibility: DAO-specific leaderboard and activity analytics.

Current endpoints in this router:

- GET /api/v1/daos/:daoId/governance/leaderboard
- GET /api/v1/daos/:daoId/governance/stats
- GET /api/v1/daos/:daoId/governance/members/:userId/rank
- GET /api/v1/daos/:daoId/governance/top-contributors

This router is a DAO-scoped read/analytics layer and is the most clearly versioned DAO governance surface.

#### DAO governance supporting services

- [server/services/governanceLeaderboardService.ts](../server/services/governanceLeaderboardService.ts)
- [server/services/rules-integration.ts](../server/services/rules-integration.ts)
- [server/services/proposalSimulationService.ts](../server/services/proposalSimulationService.ts)
- [server/services/auditConsolidated.ts](../server/services/auditConsolidated.ts)

These services support quorum evaluation, governance rule enforcement, proposal simulation, and audit logging.

### 2.2 Protocol Governance

Protocol governance covers platform-level governance lifecycle actions such as proposal execution and governance policy checks.

#### Active protocol governance surface

- File: [server/routes/governance.ts](../server/routes/governance.ts)
- Mounting path: /api/governance and /api/governance/quorum via [server/routes.ts](../server/routes.ts)
- Responsibility: proposal execution, quorum checks, proposal cancellation, delegation, templates, and governance-related analytics.

Key capabilities:

- Quorum calculation and enforcement
- Proposal execution queueing
- Proposal cancellation with role-based permissions
- Proposal template management
- Vote delegation and revocation
- Governance leaderboard endpoints
- Rule evaluation and audit logging

### 2.3 Draft / Unmounted Governance Layer

- File: [server/routes/governance-v2.ts](../server/routes/governance-v2.ts)
- Service dependency: [server/services/governance-service.ts](../server/services/governance-service.ts)

This router is not mounted by the active server registration in [server/routes.ts](../server/routes.ts). It appears to be a newer implementation draft that was never fully wired into the live route tree.

---

## 3. Route and Service Inventory

| Area | Canonical file | Status | Notes |
| --- | --- | --- | --- |
| DAO-scoped governance reads | [server/routes/v1/daos/_daoId/governance.ts](../server/routes/v1/daos/_daoId/governance.ts) | Active | DAO-scoped leaderboard and stats endpoints |
| Protocol governance | [server/routes/governance.ts](../server/routes/governance.ts) | Active | Proposal lifecycle, quorum, delegation, analytics |
| Quorum router | [server/routes/governance-quorum.ts](../server/routes/governance-quorum.ts) | Active | Mounted separately under /api/governance/quorum |
| Draft governance v2 API | [server/routes/governance-v2.ts](../server/routes/governance-v2.ts) | Unmounted | Imports the large service module but is not wired in |
| Large governance service | [server/services/governance-service.ts](../server/services/governance-service.ts) | Standalone / draft | Large, broad surface, not currently used by active routes |
| Governance rule engine | [server/services/rules-integration.ts](../server/services/rules-integration.ts) | Active | Rule enforcement and rejection formatting |
| Proposal simulation | [server/services/proposalSimulationService.ts](../server/services/proposalSimulationService.ts) | Active | Proposal simulation support |
| Governance analytics | [server/services/governanceLeaderboardService.ts](../server/services/governanceLeaderboardService.ts) | Active | Leaderboard support |
| Audit trail | [server/services/auditConsolidated.ts](../server/services/auditConsolidated.ts) | Active | Governance and audit event logging |

---

## 4. Duplications and Risk Areas

### 4.1 Two governance entry points for similar concepts

There are effectively two governance entry points:

- /api/governance for protocol-level governance operations
- /api/v1/daos/:daoId/governance for DAO-scoped analytics and leadership views

That split is reasonable, but it is currently not fully disciplined. Some concepts are implemented in both places, and some capabilities exist only in the unmounted v2 draft.

### 4.2 Large service module is not in the active call graph

The service in [server/services/governance-service.ts](../server/services/governance-service.ts) is broad and likely intended to become the canonical business-logic layer for governance, but it is not currently used by the active production route tree.

This creates a few risks:

- Business logic can drift between the active routes and the draft service
- Duplicate data access patterns can accidentally diverge
- Future changes become harder because there is no single authoritative implementation

### 4.3 Governance v2 looks like a consolidation target

The router in [server/routes/governance-v2.ts](../server/routes/governance-v2.ts) looks like a route-level consolidation target for DAO and protocol governance operations. It is likely an earlier architecture pass that was never fully adopted.

---

## 5. Recommended Target Model

The governance domain should converge on a single, intentional topology:

### 5.1 DAO Governance

Use a dedicated DAO-scoped namespace for DAO-specific operations:

- /api/v1/daos/:daoId/governance/leaderboard
- /api/v1/daos/:daoId/governance/stats
- /api/v1/daos/:daoId/governance/members/:userId/rank
- /api/v1/daos/:daoId/governance/top-contributors

These routes should remain DAO-scoped and read-oriented, with auth enforced for any user-specific data.

### 5.2 Protocol Governance

Use a protocol-level namespace for cross-DAO governance actions:

- /api/governance/proposals
- /api/governance/proposals/:proposalId/execute
- /api/governance/proposals/:proposalId/cancel
- /api/governance/quorum
- /api/governance/delegate
- /api/governance/templates

These routes should own proposal lifecycle enforcement, quorum logic, execution queueing, rule evaluation, and audit handling.

### 5.3 Shared service boundary

The canonical governance logic should live in one service layer, not in route handlers directly. The best target is to either:

- fully adopt [server/services/governance-service.ts](../server/services/governance-service.ts) as the single governance business layer, or
- split it into a more focused governance domain package and keep the route layers thin.

The active route modules should become thin adapters over that service layer.

---

## 6. Architecture Decisions to Preserve

The following decisions should be documented as the governing principles for the governance domain:

1. DAO-scoped governance reads should stay under the v1 DAO namespace.
2. Protocol governance actions should stay under the platform-level governance namespace.
3. Mutating governance operations should enforce authentication and rate limiting in the route layer.
4. Proposal execution should remain governed by quorum, majority approval, and rules evaluation before being queued.
5. Governance events should be recorded through the shared audit pipeline.
6. The unmounted v2 route and large governance service should be treated as a consolidation target, not as a second live implementation.

---

## 7. Suggested Consolidation Plan

1. Decide the canonical route surface for DAO governance.
2. Decide the canonical route surface for protocol governance.
3. Move the business logic from route handlers into a single governance service layer.
4. Mount the v2 router only after its operations are verified and the service is adopted.
5. Remove or deprecate the old draft implementation once parity is achieved.

---

## 8. Bottom Line

The governance domain is partially implemented and partially duplicated. The main active pieces are the DAO-scoped v1 governance router and the protocol-level governance router, while the large governance service and governance-v2 router appear to be an unfinished consolidation pass.

The most practical next step is to treat [server/routes/governance-v2.ts](../server/routes/governance-v2.ts) and [server/services/governance-service.ts](../server/services/governance-service.ts) as the future canonical implementation target, then migrate the active route handlers to that service layer.
