Title: Client state model and UI idempotency

Context:
We needed a standard approach for updating client-side transaction state so the UI remains correct after reloads and intermittent network failures.

Decision:
Adopt a small, explicit state machine for transactions: `pending -> confirmed -> failed`. Keep all client state updates idempotent by using server-provided event IDs and optimistic updates that can be reconciled with server state on reconnect.

Consequences:
- Simpler UI reasoning and easier bug diagnosis.
- Slight complexity added in reconciliation logic.
- Requires all server events to include stable IDs.
