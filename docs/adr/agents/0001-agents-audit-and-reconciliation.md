Title: Agents auditability and reconciliation

Context:
Autonomous agents perform actions that must be auditable and reversible when possible.

Decision:
Require agents to emit structured audit events for every external action, include correlation IDs, and support a reconciliation job that verifies agent actions against observed state.

Consequences:
- Easier debugging and forensic analysis.
- Additional development for audit logging and reconciliation tasks.
