Title: Server state management and idempotency

Context:
Server handlers occasionally received duplicate requests and had to ensure side-effects (like ledger updates) were not applied twice.

Decision:
Use idempotency keys for mutating endpoints and persist the last applied key per resource. Design write paths to be idempotent and use events for eventual consistency.

Consequences:
- Prevents double-apply bugs.
- Requires small persistence of idempotency metadata and careful key generation.
