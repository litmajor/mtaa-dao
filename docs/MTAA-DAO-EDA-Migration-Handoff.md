# MtaaDAO EDA Migration — Project Handoff (Start of Sprint 4)

## Project Goal
Migrate MtaaDAO from direct service/database mutations to an institutional-grade Event-Driven Architecture with:

- Command Bus
- Optimistic Concurrency Control (OCC)
- Transactional Outbox
- Redis Streams
- Idempotent Consumers
- Strict Aggregate Boundaries
- ACID financial accounting

The objective is that **every financial write path** follows the same execution pipeline.

---

## Current Architecture

```
Request
    ↓
CommandBus
    ↓
Authorization
    ↓
Validation
    ↓
Idempotency
    ↓
Command Handler
    ↓
BEGIN DATABASE TRANSACTION
    ↓
Aggregate Mutation (OCC)
    ↓
Ledger Writes
    ↓
Outbox Insert
    ↓
COMMIT
    ↓
Redis Streams
    ↓
Consumers
```

This architecture is implemented and is the required pattern for all future financial domains.

---

## Completed Infrastructure

### Phase 0

- Correlation Context
- Structured Logging
- Worker Context
- Observability

Status: Complete

---

### Phase 1

Completed:

- Domain Event interfaces
- Event Catalog
- Command Bus
- Authorization Middleware
- Validation Middleware
- Idempotency Middleware
- Transaction Middleware
- Command Log
- Transactional Outbox
- Redis Stream Adapter
- Outbox Relay
- Consumer Idempotency Guard
- Dead Letter Queue
- Consumer Recovery

Status:

All tests passing.

---

## Trading Domain (Sprint 1)

Completed.

Implemented:

- OCC
- Order Repository
- Order State Machine
- Command Handlers
- CommandBus integration
- Outbox publishing

Aggregate:

```
limitOrders
```

State Machine:

```
CREATED

↓

RISK_APPROVED

↓

EXECUTING

↓

SUBMITTED

↓

ACCEPTED

↓

PARTIALLY_FILLED

↓

FILLED
```

Invariant examples:

- Filled amount ≤ requested amount
- FILLED → EXECUTING forbidden
- averageFillPrice immutable after FILLED

Tests:

Passing.

---

## Payments Domain (Sprint 2)

Completed.

Aggregate:

```
paymentTransactions
```

Current authoritative accounting:

```
walletTransactions
+
userBalances
```

Payment completion executes inside one database transaction:

```
Verify payment

↓

Update payment

↓

Insert walletTransaction

↓

Update userBalances

↓

Insert PaymentCompleted event

↓

Commit
```

OCC implemented on:

- paymentTransactions
- userBalances

Six legacy writers migrated to CommandBus.

Tests:

Passing.

---

## Vault Domain (Sprint 3)

Planning complete.

Implementation beginning.

Scope is intentionally limited.

Sprint 3 includes only:

- Vault aggregate
- Deposits
- Withdrawals
- NAV updates
- Fee collection
- Vault status

Sprint 3 explicitly excludes:

- Treasury
- Yield engine
- Rebalancer
- AMM
- Portfolio optimizer
- Saga orchestration

---

## Architectural Decisions (Fixed)
These are considered project contracts and should not be changed without strong justification.

### 1.
Every financial mutation must execute through CommandBus.

No direct service → database mutations.

---

### 2.
Every aggregate mutation uses OCC.

Pattern:

```
UPDATE ...

WHERE
id = ?
AND version = ?
```

---

### 3.
Every financial command executes inside one ACID transaction.

---

### 4.
Outbox insert occurs inside the same transaction.

Never publish directly.

---

### 5.
Redis Streams are only used after commit.

---

### 6.
Consumers are idempotent.

---

### 7.
Duplicate external events must be harmless.

Examples:

- duplicate webhooks
- duplicate exchange callbacks
- worker restarts
- replay

---

### 8.
Every balance mutation requires a corresponding ledger entry.

Never update balances without recording an immutable financial fact.

---

### 9.
State machines are strict.

Illegal transitions throw.

---

### 10.
Business logic belongs in Command Handlers.

Controllers and workers dispatch commands only.

---

## Open Architectural Decisions
These remain intentionally unresolved.

### Vault accounting
Need final decision regarding:

- TVL ownership
- shareSupply ownership
- share price calculation

Current recommendation:

Handler computes share price.

Clients never provide it.

---

### Future userBalances
Currently:

Aggregate Root protected by OCC.

Long-term:

Projection rebuilt from walletTransactions.

Not part of current migration.

---

### Pending Domains
Still to migrate:

- Vaults
- Treasury
- Portfolio
- Yield Engine
- Rebalancer
- Strategy Execution
- Saga Orchestrator
- Reconciliation Engine

---

## Sprint 4 Objective
Continue Vault Domain migration.

Implement only:

- VaultRepository
- VaultStateMachine
- VaultCommands
- VaultHandlers
- OCC
- CommandBus registration
- Tests

Do NOT begin:

- Treasury
- AMM
- Yield Engine
- Cross-domain workflows

---

## Success Criteria
The migration is complete only when **every financial write path** in the application follows:

```
CommandBus

↓

OCC

↓

ACID Transaction

↓

Ledger

↓

Outbox

↓

Redis Streams

↓

Idempotent Consumers
```

Any legacy path that mutates financial state outside this pipeline should be treated as technical debt and migrated before introducing new financial features.
