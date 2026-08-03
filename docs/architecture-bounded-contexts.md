# Architecture Bounded Contexts

This document freezes the current domain map for the platform so future work can evolve around stable boundaries instead of ad hoc route growth.

## Bounded contexts

- Dao Governance: proposals, voting, delegation, policy execution, and related governance workflow state.
- Treasury and Vaults: vault lifecycle, treasury balances, disbursements, yield, and treasury automation.
- Payments and Recovery: payment flows, reconciliation, recovery workflows, refunds, and compensating actions.
- Trading and Market Data: exchange integration, order routing, market discovery, signals, and execution analytics.
- Identity and Access: authentication, authorization, permissions, user profile state, and security posture.
- Observability and Control: monitoring, audit, recovery controls, kill-switch behavior, and operational health.

## Architectural intent

- Route ownership should stay close to the bounded context that owns the workflow.
- Control-plane concerns should be isolated from business-domain routes.
- Event-driven integration should be the primary surface for cross-context coordination.
