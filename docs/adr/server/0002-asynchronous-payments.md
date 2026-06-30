# ADR: Transition to Asynchronous Saga-Based Payouts

**Status:** Accepted

**Date:** 2026-06-18

**Author:** Lead Engineer -- litmajor

**Context:** Payouts of MTAA rewards via on-chain contract.

## 1. Context and Problem Statement

Our initial implementation attempted to trigger on-chain contract interactions synchronously during the `POST /api/referral-rewards/claim` lifecycle.

**The Issues Identified:**

* **Latency & Timeout:** Users experienced long loading times while waiting for the Ethereum/L2 provider to confirm transactions.
* **Brittle Reliability:** If the RPC node, contract, or network timed out, the API request failed. This left the user in a state of uncertainty: *Did the claim happen? Did I lose my reward?*
* **Operational Risk:** Synchronous calls lack transactional atomicity between the database state (rewards status) and the blockchain state (tokens transferred).
* **Anti-Abuse Gaps:** There was no automated way to ensure eligibility checks (vesting, Sybil filtering) were finalized before contract interaction.

## 2. Decision

We have implemented a **Transactional Outbox / Saga Pattern**.

* **Decoupled Architecture:** The API now only performs "Enqueue" operations (updating DB status to `pending`).
* **Background Settlement:** A standalone `payout-worker` service acts as the reliable actor, polling for `pending` payouts and settling them on-chain with retry logic.
* **Single Source of Truth:** The database (`referral_payouts` table) now tracks the *intent* and the *result* of the blockchain transaction.

## 3. Justification (The "Why")

### Reliability & User Experience

By moving to a `202 Accepted` response pattern, we provide instant gratification to the user. The system becomes resilient to network jitter; if the blockchain is congested, the worker simply retries later. The user no longer faces "gateway timeouts."

### Atomic Integrity (The Saga Pattern)

By using database transactions (`db.transaction`) for the "Enqueue" step, we ensure that a reward is never marked as `claimed` without a corresponding `pending` record in the payout ledger. This prevents the "missing reward" syndrome.

### Fault Tolerance & Idempotency

Because we introduced `requestId` and track `transactionHash`, the `payout-worker` is inherently **idempotent**. If the server reboots in the middle of a transaction, the worker resumes exactly where it left off, preventing double-payments—a non-negotiable requirement for financial systems.

### Observability

The ledger-based approach provides a clear audit trail. We can now query the status of any payout (`pending`, `processing`, `completed`, `failed`) and provide a status dashboard for both the users and the DAO admins.

## 4. Consequences (Trade-offs)

* **Complexity:** We have introduced a background process that must be monitored. We now have a dependency on the worker's uptime.
* **Latency in Settlement:** The user no longer receives instant on-chain confirmation. There is a programmed delay (worker polling interval) between "Claiming" and "Receiving." We believe this is an acceptable trade-off for the massive increase in system reliability.
* **Operations:** We must now manage `ADMIN_ALERT_WEBHOOK` notifications to ensure we are alerted if the worker fails repeatedly.

---

## Journal Entry: The Engineering Intuition

*Reflecting on this move, it feels right. When dealing with crypto-native assets, **synchronicity is the enemy of reliability.** By treating the database as the ledger and the blockchain as an external service to be reconciled, we have effectively hardened our system against the chaotic nature of public networks. We are no longer hoping the network is fast; we are ensuring the system is durable.*
