# ADR: EDA Core v1 Frozen

## Status
Proposed

## Context

The MtaaDAO project has completed a multi-sprint migration to an Event-Driven Architecture (EDA) that includes a Command Bus, Optimistic Concurrency Control (OCC), a Transactional Outbox, Redis Streams, idempotent consumers, and strict aggregate boundaries. The attached handoff document ("MTAA-DAO-EDA-Migration-Handoff.md") summarizes the completed infrastructure and the migration progress through Payments and Trading domains, as well as the planned Vault domain work for Sprint 4.

The engineering team must now balance continued platform hardening against delivering product value. Without a clear guardrail, there's a risk of indefinite refactoring of the foundational infrastructure (new middleware, alternate buses, more abstractions) that delays feature delivery and user adoption.

## Decision

We declare an architecture freeze for the core EDA platform.

Decision: "EDA Core v1 Frozen"

This means:

- No new infrastructure layers, middleware, buses, or cross-cutting abstractions shall be introduced into the codebase without an approved exception process.
- The allowed changes to core infrastructure are limited to:
  - Bug fixes (correcting correctness issues)
  - Performance improvements (measured and benchmarked)
  - Security fixes or hardening
  - Operational improvements (observability, deployment reliability, SRE practices)

All other changes that affect product-facing behavior, features, or domain logic should proceed as product work using the existing EDA foundation (CommandBus → OCC → Transaction → Outbox → Redis → Idempotent Consumers).

## Rationale

- Scope control: The EDA stack is now functionally complete and tested for Payments and Trading. Continuing to add new platform abstractions increases cognitive load, introduces migration debt, and delays milestone-driven product goals.

- Leverage investment: Freezing the core allows teams to invest in building outward (Vaults, Treasury, UX), proving the platform by enabling real users and collecting feedback.

- Reduce risk of fragmentation: Multiple buses, middleware layers, or competing abstractions fracture the team and the runtime environment, making maintenance and onboarding harder.

- Measurable improvements only: Allowing only bug/perf/security/ops changes keeps the foundation healthy while avoiding scope creep.

## Scope and Boundaries

In-scope (allowed on the core EDA codepaths):
- Fixes to `CommandBus` middleware bugs that cause incorrect behavior.
- Correctness fixes to transactional outbox persistence.
- Security patches for Redis, DB, or secrets handling.
- Performance fixes that demonstrably reduce latency or resource use (with benchmarks or before/after metrics).
- Operational work that improves observability, retries, quarantining, and recovery (DLQ, consumer recovery job improvements).

Out-of-scope (requires an exception):
- Adding a new message bus technology (e.g., Kafka, NATS) that replaces or complements Redis Streams.
- Introducing new middleware categories (e.g., new cross-cutting recovery middleware) that alter command bus semantics.
- New global abstractions that affect the CommandBus/Outbox contract.
- Refactoring core event schemas or changing the outbox schema substantially without an explicit migration plan.

## Consequences

Positive:
- Faster product delivery as teams build on a stable foundation.
- Fewer architectural churns and lower risk of regressions.
- Easier onboarding and clearer operational expectations.

Negative:
- Some desirable refactors or technology upgrades will be deferred.
- Teams must plan larger, coordinated migration windows for any change outside the freeze scope.

## Exception Process

If a change outside the allowed scope is required, follow this process:
1. Open an ADR draft describing the proposed change and its motivation.
2. Provide a migration plan, risk assessment, and rollback strategy.
3. Include benchmarks or proof-of-concept results demonstrating benefit.
4. Obtain approval from the architecture owners (listed below) and one operations lead.

## Implementation Notes

- Add a short note in Sprint planning checklists: "Does this change touch the EDA Core v1? If yes, verify scope or file exception ADR."
- Add an automated linter rule or CI check (optional) that flags changes touching core files (e.g., `server/domain`, `server/infrastructure/postgres`, `server/infrastructure/redis`, `server/domain/commands`, `server/workers/*`) and requires an ADR link in the PR description when modifying these paths.

## Architecture Owners

- Platform Lead: (Team to define) — primary approver for exceptions
- Security Lead: (Team to define) — required approver for security-related changes
- Release/Operations Lead: (Team to define) — required approver for operational changes

## Related

- MTAA-DAO-EDA-Migration-Handoff.md (migration summary and rationale)
- `server/domain/events/catalog.ts` (event catalog)
- `server/infrastructure/postgres/OutboxRelayWorker.ts` (outbox relay)
- `server/infrastructure/consumers/IdempotencyGuard.ts` (consumer idempotency)

---

*Drafted on 2026-07-30.*
