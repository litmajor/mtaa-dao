# Financial Authority and Finality

**Status:** Phase 0 authority contract and Phase 1 operation registry implemented; Phase 2 provider settlement and Phase 3 DAO contribution settlement are partially wired as described below.

## Purpose

This document defines which record is authoritative for each financial domain, what evidence is required before funds are treated as settled or credited, and which state transitions must not be conflated.

It is a target contract, not a claim that the current application enforces every rule below. Current-state observations are explicitly identified as such.

## Core rules

1. A provider callback, governance approval, database row, or transaction hash alone is not proof that a balance changed.
2. Record intent and authorization before settlement; record settlement evidence before final credit or payout completion.
3. Every financial effect must have a stable business reference and be applied idempotently. Replaying a callback, worker job, or command must not apply the effect twice.
4. An authoritative journal is append-only for financial effects. Corrections use linked reversal/adjustment entries; they do not erase or silently rewrite the original effect.
5. Cached balances and projections may support reads but are rebuildable and are never independent authorities.
6. Asset and currency are part of every balance identity. A KES amount is not interchangeable with cUSD or USD, and a token balance must be scoped to its chain and contract.
7. Every writer of a financial journal must use the same domain rules and finality checks. A service may not mark an unverified movement `completed`.

## Authoritative balance sources

| Domain | Authoritative balance source | Required settlement evidence | Related records and non-authorities |
|---|---|---|---|
| Personal platform wallet | `accounts` balance, backed by its `account_transactions` journal | Verified provider settlement for deposits; for internal transfers, one atomic, balanced journal operation; for on-chain transfers, a successful confirmed chain receipt matching the intended asset, amount, and recipient | `walletTransactions` is history/reporting, not a second balance authority. Payment status is workflow state, not the wallet balance. |
| DAO M-Pesa/KES contribution intake | Confirmed `paymentTransactions` record plus its unique M-Pesa receipt, linked to `daoContributions` | Successful M-Pesa callback/reconciliation with matching contribution, reference, amount, and receipt. DAO approval is a separate authorization step. | Neither an M-Pesa receipt nor a DAO approval proves cUSD conversion or a cUSD vault credit. |
| DAO cUSD treasury custody | On-chain cUSD vault balance; `treasuryPositions` is the indexed balance projection and `stableInflowEvents` is the indexed movement evidence | Confirmed, risk-cleared cUSD inflow whose token and recipient match the DAO's configured vault position | `walletTransactions` records the linked accounting/audit entry, not a balance authority. `daos.treasuryBalance` is a deprecated cache and must only be refreshed from chain reconciliation. DAO proposal and approval records are workflow state. |
| Vault assets | On-chain token balances held by the configured vault contract, scoped by chain ID and token contract | Successful chain transaction receipt at the configured confirmation depth, plus event/state verification that the intended vault, asset, amount, and recipient match | Database vault balances and `vaultTransactions` are projections/audit records unless reconciled to chain state. A submitted transaction hash is not confirmation. |

### Authority implications

- Personal wallet accounting, DAO treasury accounting, DAO contribution acceptance, and vault custody are separate domains. They must not be combined into one generic `completed` flag.
- A provider-paid personal deposit may credit the personal wallet only through the personal-wallet accounting authority.
- A DAO KES contribution must not be counted both as a personal wallet credit and as DAO treasury income unless two distinct, evidenced transfers actually occurred.
- A database-only proposal disbursement may represent authorization or an internal allocation, but it is not an external payout.
- An M-Pesa KES receipt may be confirmed and approved while the DAO contribution remains unsettled in cUSD. It must not be counted as cUSD treasury value until a matching on-chain vault inflow is indexed and linked.
- If an on-chain balance and its database projection disagree, the authoritative chain state governs custody; the mismatch remains an unresolved reconciliation exception until corrected through an auditable journal adjustment.

## Financial lifecycle vocabulary

These terms describe distinct facts. Implementations and API responses should use the most specific applicable state rather than treating them as synonyms.

| State | Definition | Does it change an authoritative balance? |
|---|---|---|
| `pending` | An intent or incoming payment has been recorded, but required authorization, external settlement, or validation is incomplete. | No. |
| `authorized` | The required user, policy, DAO, or governance approvals have been obtained for the specified action. Authorization permits execution; it does not mean execution or payment occurred. | No. |
| `settled` | The external payment rail or chain has provided verifiable evidence that the specified movement succeeded. The evidence and reference are stored and match the expected amount, asset, and destination. | Not necessarily. Settlement evidence may exist before the corresponding internal ledger posting. |
| `credited` | The settled inbound movement has been applied exactly once to the authoritative destination journal/balance in a database transaction. | Yes, for the destination balance. |
| `executed` | An authorized command has been carried out. For a financial transfer, this means the transfer was submitted or performed as specified; it must not be represented as payout completion unless settlement is also confirmed. | Only if the specific action changes the authority; the status alone does not. |
| `reconciled` | Independent evidence and the authoritative journal have been compared and match. A mismatch remains an open reconciliation exception until corrected and rechecked; it is not reconciled. | No additional effect; reconciliation verifies prior effects. |

For asynchronous external transfers, represent at least `authorized` → `submitted` → `settled` → `reconciled`. `executed` may describe the execution of the command, but must not collapse these external settlement states.

Failures and reversals must be represented explicitly. A failed or reversed payment is not a successful credit; a reversal must reference the original effect and produce a compensating journal entry where an effect had already been applied.

## Conditions for a final financial entry

A financial journal entry may be considered final only when all applicable conditions are satisfied:

1. **Identity:** It has a unique, stable business reference, and the asset/currency, chain where applicable, and source/destination identities are known.
2. **Authorization:** The action passed the authorization and policy checks required for that domain. A proposal vote or admin role is not a substitute for provider or chain evidence.
3. **Settlement evidence:** The relevant provider receipt, verified provider status, or confirmed chain receipt/event is persisted and matches the intended amount, asset, and destination. For a manual contribution, the evidence and required review are recorded.
4. **Atomic posting:** The authoritative journal entry and its associated balance/state transition commit atomically, or the system has a durable, idempotent recovery process that cannot create duplicate effects.
5. **Uniqueness:** A database constraint or equivalent transactional guard prevents the same provider receipt, chain transaction/log, or business reference from being applied more than once.
6. **Auditability:** The journal entry links to its authorization, settlement evidence, originating request/proposal, and any later reversal or adjustment.
7. **Reconciliation:** The entry is eligible for independent reconciliation against its evidence source. A difference must remain visible as an exception; it must not be silently normalized.

Before these conditions hold, use an appropriate non-final state such as `pending`, `authorized`, or `submitted`. Do not insert a final `completed` movement merely to record that an operation was requested.

## Current writer inventory from source review

This is the set of writers identified in the Phase 0 source investigation, not an exhaustive repository-wide write inventory. Any additional writer discovered during implementation must be added here and made to obey the same contract.

| Domain / record | Known writers or paths | Required constraint |
|---|---|---|
| Personal wallet (`accounts`, `account_transactions`) | `CompletePaymentHandler` in `server/domain/payments/PaymentHandlers.ts`; `PaymentRecoverySAGAOrchestrator` in `server/services/PaymentRecoverySAGAOrchestrator.ts`; webhook reconciliation in `server/workers/webhookReconciliationWorker.ts` dispatches the CommandBus completion path | All deposits/transfers must converge on one accounting operation. SAGA completion must be inspected; it cannot be treated as a wallet credit merely because dispatch returned. |
| Payment workflow (`paymentTransactions`) | Provider callbacks and reconciliation logic in `server/routes/v1/wallets/rails/`, `server/payments.ts`, and `server/workers/webhookReconciliationWorker.ts` | A workflow `completed` status must be tied to the authoritative journal effect or represented separately from `credited`. Pending-only recovery must also detect completed-but-uncredited records. |
| DAO KES contributions (`daoContributions`) | Contribution routes in `server/routes/v1/daos/_daoId/treasury/contributions.ts`; M-Pesa reconciliation in `server/payments.ts` | Payment confirmation and DAO acceptance/approval remain distinct; receipt details must be linked and duplicate-safe. |
| DAO cUSD treasury (`walletTransactions`, `daos.treasuryBalance`) | `TreasuryService` in `server/services/treasuryService.ts`; DAO treasury routes in `server/routes/v1/daos/_daoId/treasury/`; proposal execution in `server/proposalExecutionService.ts`; approved contribution flow in the DAO contribution routes | Ledger effects require movement evidence. `daos.treasuryBalance` is a projection, never a competing authority. Ledger-only disbursement must not claim external payout completion. |
| Vault assets and on-chain treasury | `vaultService`, `TreasuryOnchainService` in `server/services/treasuryOnchainService.ts`, vault domain handlers, and `TreasuryEventListenerWorker` in `server/workers/treasuryEventListenerWorker.ts` | Persist intent/submission separately from confirmation; verify receipt/event identity and confirmation depth before marking a payout settled. Keep database projections reconcilable to chain state. |
| Proposal execution workflow | `ProposalExecutionService` in `server/proposalExecutionService.ts`; proposal API routes in `server/routes/v1/daos/_daoId/proposals.ts`; on-chain multisig tracking in `server/workers/treasuryEventListenerWorker.ts` | Queue completion, proposal execution, and payout settlement are distinct. Claims must be atomic, persistent, and idempotent across processes. |

## Current-state gaps established by source inspection

The following are observed in the inspected code paths; they should be treated as implementation gaps until changed and tested:

- The original CommandBus composition used wildcard capabilities and allowed unmapped commands. Phase 5 below replaces that behavior with an explicit fail-closed policy; the deployed environment still needs the required application code rollout before that policy is active.
- Provider callback dispatch paths can pass the same wallet as SAGA source and destination. The SAGA requires signed transaction metadata for its blockchain step, while the inspected provider dispatch does not provide it. SAGA failures are caught and returned as state, but the dispatcher records a successful dispatch without checking that state.
- The reconciliation worker posts personal-wallet accounting through `CompletePaymentHandler`, but scans pending payment rows. It cannot be assumed to recover a row already marked completed by a separate callback path.
- The generic wallet gateway constructs a callback URL that does not match the callback paths registered in its router.
- DAO treasury helper/proposal paths can create `completed` journal rows without performing or verifying an external payout in those methods.
- Proposal queue execution updates a pending record to executing without a conditional pending-state claim. Its service catches errors internally, while an HTTP caller can return a success response after that method returns.
- The on-chain treasury event listener and the database proposal queue are distinct workflows. Source inspection did not establish that all database proposal states are reconciled to on-chain execution evidence.

These observations do not prove that a defect has occurred in a live deployment. Provider configuration, route rewrites, database state, worker activation, and deployed contract activity require separate operational validation.

## Phase 1 operation registry

The opt-in canonical operation registry is implemented in:

- `financial_operations`: operation identity, domain/asset/amount, unique durable idempotency key, external reference, and current lifecycle state.
- `financial_operation_events`: immutable operation creation, status transition, external-reference, and link events. Database triggers append these events transactionally.
- `financial_operation_links`: immutable typed references to payment transactions, DAO contributions, proposals, wallet/account ledger entries, vault transactions, blockchain transactions, and related records.
- `FinancialOperationService`: operation creation with idempotent retry semantics, constrained transitions, one-time external-reference recording, record linking, and event retrieval.
- Database migration `059-financial-operations`: operation/link constraints, status-transition guard, identity immutability, append-only protections, and automatic event capture.

The registry deliberately does **not** replace or automatically modify `paymentTransactions`, `daoContributions`, `walletTransactions`, account journals, proposal execution records, or vault records. Existing financial flows are not yet calling the operation service. Until each flow is migrated and tested, the registry is an additional coordination/audit layer, not the live source of any balance and not evidence that a movement settled.

## Acceptance criteria for Phase 0

- Each financial balance has exactly one named authority and a defined asset identity.
- The lifecycle vocabulary above is used consistently in schemas, services, API responses, logs, and reports.
- Every service that writes an authoritative financial journal is inventoried and routed through the domain's finality and idempotency rules.
- No service can silently create a final/completed financial movement without the required settlement evidence or a clearly defined non-external accounting action.
- Cached balances are explicitly projections and can be rebuilt from their named authority.
- The subsequent implementation plan has focused tests for duplicate callbacks, missing/failed settlement evidence, concurrent execution, reversals, and reconciliation mismatches.

## Phase 1 integration acceptance criteria

- Each migrated flow creates or reuses exactly one operation using a stable idempotency key derived from its business reference.
- Existing records are linked to that operation in the same transaction as the corresponding state change where possible.
- Settlement evidence is recorded in transition-event details without storing credentials or unnecessary personal data.
- The source and destination domain services remain responsible for their authoritative journal entries; the operation service orchestrates and correlates but does not itself post balances.
- Duplicate provider callbacks, retries, concurrent transitions, illegal status changes, event mutation, and duplicate cross-operation links are covered by integration tests against PostgreSQL.
- Before rollout, apply migration `059` in the target environment and verify the database role used by the application cannot bypass the intended database constraints.

## Phase 2 provider settlement

The personal-wallet payment gateway now sends verified provider callbacks through the Payment CommandBus:

- Paystack and Flutterwave callbacks are HMAC/shared-secret verified against the exact captured request body/header, then normalized to a common provider-event shape.
- M-Pesa STK callbacks retain the per-payment callback token check. An approved personal-wallet deposit is credited through `CompletePayment`; review-required payments remain uncredited.
- Successful settlement updates the provider transaction reference under a database unique constraint and posts the personal-wallet balance plus journal in the existing atomic `CompletePayment` handler. Provider callback handling no longer uses the payment-recovery SAGA or a wallet self-transfer.
- If command execution fails, the callback returns an error so the provider can retry; a failed SAGA can no longer be logged as successful payment dispatch.
- The reconciliation worker independently verifies pending Paystack, Flutterwave, and M-Pesa transactions with the provider and routes confirmed results through the same payment command handlers.

Configure provider dashboards to call:

| Provider | Webhook URL |
|---|---|
| Paystack | `https://<backend-host>/api/payment-gateway/webhooks/paystack` |
| Flutterwave | `https://<backend-host>/api/payment-gateway/webhooks/flutterwave` |
| M-Pesa STK | Generated per request as `https://<backend-host>/api/payment-gateway/webhooks/mpesa?token=...` |

These webhook routes are mounted before authenticated wallet routes and perform provider-specific verification themselves. Paystack and Flutterwave hosted checkout `callback_url` / `redirect_url` values are browser return URLs, not webhook endpoints; configure `PAYMENT_RETURN_URL` separately. Set `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`, and a publicly reachable HTTPS `MPESA_CALLBACK_URL` (or use the generated M-Pesa URL) in the runtime environment. The sample values in `.env.example` are local development placeholders, not production callback URLs.

Migration `060-provider-settlement-identifiers` adds `payment_transactions.provider_reference` and a unique `(provider, provider_reference)` index. Apply it before enabling this code in an existing environment. The registry from migration `059` remains opt-in and is not yet linked to each payment operation.

## Phase 3 DAO contribution and treasury settlement

The DAO contribution flow now keeps these milestones separate:

1. A verified M-Pesa callback marks the `paymentTransactions` record paid and stores the receipt and paid amount on the matching KES `daoContributions` record. The contribution remains pending for DAO review.
2. DAO approval changes the contribution to `approved`; it does not set `completedAt`, create a completed cUSD journal row, or mutate the cached DAO treasury balance.
3. An authorized DAO admin can call `POST /api/v1/daos/:daoId/treasury/contributions/:contributionId/settle` with an indexed `stableInflowEventId`. The handler requires a confirmed, risk-cleared cUSD inflow to a holder/token/chain position configured for that DAO. For KES contributions, it also checks the matching completed M-Pesa ledger record, receipt, and paid amount, and requires the conversion provider and external conversion reference to be recorded.
4. In one database transaction, the handler records the cUSD `walletTransactions` audit entry with the chain tx hash, asset identity and exact token amount; marks the indexed inflow credited; and completes the contribution with linked M-Pesa receipt and conversion/settlement evidence, including the observed KES-to-cUSD ratio. The provider/reference are operator-recorded context, not independently verified conversion proofs; the indexed chain event proves only that cUSD reached the DAO vault.

`wallet_transactions.amount` is widened to preserve the indexed token amount without rounding to cents. Migration `061-dao-contribution-settlement-evidence` adds the one-to-one stable inflow credit constraint. Apply it before deploying the endpoint; it intentionally fails with the duplicate event ID if existing data already links one inflow to multiple wallet transactions. The rollback removes the uniqueness constraint but does not reduce numeric precision.

This records evidence after cUSD reaches the configured DAO vault; it does not initiate or independently verify the off-chain KES-to-cUSD exchange. The M-Pesa receipt remains the KES payment evidence, while the indexed chain event proves cUSD arrival. `TreasuryService.recordDeposit()` and the DAO treasury deposit endpoint now require either a matching confirmed on-chain inflow or a documented internal-adjustment reference and reason before writing a completed entry. The legacy treasury core contribution-approval route now follows the same approval-only rule as the contribution sub-router. The current computed treasury projection continues to use indexed `treasuryPositions`; wallet transaction entries and contribution approvals do not change that projection. API-side writes to `daos.treasuryBalance` have been removed from deposit, withdrawal-approval, contribution-approval, and treasury-initialization paths; only the explicit chain reconciliation compatibility updater may refresh that deprecated field. The legacy multisig execute handler also refuses to invent a transaction hash or update a balance when no on-chain executor is configured, leaving the approved withdrawal pending.

## Phase 4 proposal execution safety

The legacy `proposalExecutionQueue` and the DAO treasury multisig records are separate systems. Approval/queueing is not payout submission, and payout submission is not confirmed execution.

- Queue claims use a conditional `pending` → `executing` database update and an idempotency key persisted on the queue row. Database indexes prevent key reuse and multiple active queue records for one DAO proposal. Repeated requests with the same key return the stored state/result; a different key conflicts.
- Non-financial proposal actions can complete in the legacy executor. `treasury_transfer`, `vault_operation`, and `disbursement` actions stop at `settlement_pending`; they no longer create completed ledger rows or change a proposal to executed without external settlement evidence.
- To associate a transfer with the on-chain multisig, submit it through `POST /api/v1/daos/:daoId/treasury/multisig/propose` with the approved `proposalId`. The handler only accepts a matching queued treasury transfer and stores the explicit proposal link on the multisig transaction.
- Reconcile with `POST /api/v1/daos/:daoId/proposals/execution/:executionId/reconcile`. A submitted multisig transaction advances the queue to `submitted`; only an executed transaction carrying the on-chain listener's execution event metadata can complete the queue and set the proposal to `executed`. Ambiguous or failed records remain visible as reconciliation/failure states.
- Execution errors are persisted as `reconciliation_required` and propagated to HTTP callers; they are not reported as success. The scheduler logs each failed item and continues processing other queue items.

Migration `062-proposal-execution-safety` adds durable execution keys/results and external references, and guards the active-queue and multisig proposal links. It deliberately refuses to run when duplicate active queue rows, reused execution keys, or duplicate on-chain proposal links already exist; inspect and resolve those records before applying the migration. Existing queue rows are not silently joined to multisig transactions. Only rows explicitly tagged with the proposal ID can be reconciled.

## Transactional outbox delivery

The payment completion transaction already writes the wallet history row, canonical account journal/balance, payment `COMPLETED` state, and `PaymentCompleted` domain event in one database transaction. A crash cannot leave that handler's payment marked completed without its wallet accounting, or commit the accounting without the status. If the provider confirms payment but the application stops before this transaction, the payment remains incomplete and the provider reconciliation path can retry it.

The durable event outbox is now operational as well:

- `OutboxMiddleware` persists successful command events through `PostgresEventPublisher` using the same transaction context as the handler. Failed commands emit no outbox event.
- The PostgreSQL relay claims rows using expiring claim leases and `FOR UPDATE SKIP LOCKED`, publishes at least once to Redis Streams, then marks each event published. A crashed relay leaves a lease that expires so another instance can retry. Duplicate Redis delivery is expected and consumers deduplicate by the domain event ID.
- Failed publishes release their claim and record the attempt/error for retry. Poison events are quarantined and written to `event_dead_letters` in one PostgreSQL transaction.
- The relay starts with the normal worker set. The payment-completed consumer reads from the beginning when creating a group and claims sufficiently idle pending messages, allowing it to recover messages that predate startup or were left pending after a worker crash.

Migration `063-transactional-outbox-leases` adds the lease and quarantine fields/index to `domain_events`; apply it before deploying the relay worker. Redis delivery is at-least-once, not exactly-once. The existing payment-completed consumer's work is downstream orchestration (for example DAO-spawn processing); authoritative wallet credit remains inside the atomic payment-completion transaction rather than being deferred to a separate event consumer.

## Phase 5 CommandBus authorization

The CommandBus now uses an explicit command-to-capability map and a database-backed authorization service in `server/domain/setup.ts`. Commands without a mapped capability are rejected. Payment and vault handlers repeat the authorization check before accessing repositories or applying journal changes, so direct handler invocation does not bypass the policy.

- Payment initiation is limited to the actor whose ID matches the payment's `userId`.
- Provider webhook actors are restricted to the configured providers and must match the provider on the persisted payment. The reconciliation worker uses the separate `system:payment-reconciliation` identity after checking provider status; that identity has only the enumerated payment-processing capabilities and cannot initiate payments. DAO-spawn metadata updates use a separate `system:dao-spawn` identity, limited to specific metadata keys on existing DAO-spawn fee records.
- Vault creation requires the user to own the vault or an approved DAO admin/elder membership for a DAO-owned vault. Deposits require ownership or approved DAO membership. Generic withdrawals from DAO vaults are denied and must go through the DAO multisig workflow; user-vault withdrawals require ownership.
- No reversal command is currently registered or authorized. New financial commands and any future reversal path must receive an explicit capability and policy before use.

These are application-level controls, not a substitute for provider signature validation, route authentication, DAO governance approval, database constraints, or confirmed settlement evidence. Direct handler deny-path tests and command authorization policy tests cover the core restrictions; the full environment and production actors still require operational verification.

## Phase 6.1 reconciliation registry

The shared reconciliation registry is introduced in migration `064-financial-reconciliation-registry`. It records reconciliation runs, keeps one current finding per stable finding key, and appends immutable finding lifecycle events. The lifecycle supports `open`, `acknowledged`, `resolved`, and `reopened`; acknowledgement does not mean the discrepancy is fixed, and resolution requires an explanation. Repeated detection updates the existing finding and appends evidence; detecting a previously resolved finding reopens it.

`FinancialReconciliationService` is a read-only control-plane component: it records findings and run outcomes but does not write financial journals or balances. Migration `064` must be applied before deploying code that uses the registry. Production-like reconciliation, provider/chain evidence verification, and an unresolved-finding baseline remain outstanding.

## Phase 6.2 payment and wallet reconciliation

The webhook reconciliation worker now records run outcomes and submits the initial payment/wallet checks to the shared finding registry:

- **R01:** provider-verified payment without a completed canonical account deposit.
- **R02:** completed `payment:<id>` account deposit without a linked completed payment carrying verified settlement evidence.
- **R03:** a provider reference associated with more than one completed account deposit.
- **R04:** an account balance different from the latest completed account-journal balance (or zero when no completed journal entry exists).

Verified provider webhooks now persist `settlementEvidenceVerified`, its timestamp, and provider identity; the existing gateway status reconciliation marker is also recognized for compatibility. Finding detection itself performs only reads and registry writes. The existing webhook worker's pre-existing provider recovery behavior is unchanged and can still complete payments through the established payment command flow. Each rule processes up to 100 oldest findings not already open, acknowledged, or reopened; unresolved findings stay visible without generating duplicate lifecycle events on every run, and larger backlogs are picked up in subsequent runs. Resolved findings are eligible again so a returning discrepancy reopens them. Rule coverage and evidence classification still require production-like validation, especially for legacy credits that predate the durable verification marker. R10 and operational reporting remain outstanding.

## Phase 6.3 DAO and treasury reconciliation

The existing treasury reconciliation job now shares a registry run with:

- **R05:** completed DAO contribution credits whose recorded approval evidence does not meet the contribution's required approval count.
- **R06:** warning/critical DAO treasury asset mismatches between the indexed position and the existing job's independent chain read. Findings retain chain, token, holder, block, and balance evidence. Vault-only mismatches remain in the existing treasury audit until a corresponding rule is added.
- **R07:** completed DAO treasury deposits lacking a matching confirmed, risk-cleared, configured-vault inflow or a documented internal adjustment reference and reason.

The DAO and treasury finding scans write only reconciliation runs/findings; they do not adjust contribution state, treasury journals, or balances. Existing treasury audit writes and chain reads remain unchanged. The production database and live chain evidence have not been verified here; R10, admin reporting, and production baseline work remain.

## Phase 6.4 proposal and blockchain reconciliation

The proposal rules are integrated into the existing treasury reconciliation job:

- **R08:** completed financial proposal queue items at least 30 minutes old without a matching executed multisig record carrying confirmed chain-execution metadata and a transaction hash. The grace period avoids reporting ordinary confirmation/indexer delay as a discrepancy.
- **R09:** executed multisig records that lack a matching completed queue record, correct multisig reference, or a queue hash matching either the on-chain proposal submission or execution transaction. The treasury event listener also records R09 when a confirmed proposal event has no unambiguous corresponding database record; unmatched events retain contract, proposal, transaction, block, and log-index evidence.

These checks only read execution records and write reconciliation findings. They do not update proposal, queue, multisig, or balance state. Event replays use stable evidence keys, and an already-recorded execution event is not treated as a new discrepancy. The 30-minute R08 grace period is a conservative initial default and should be tuned against production confirmation/indexing latency. The reconciliation job currently has no scheduled caller in the source tree, so its scan must be invoked by an operator until a scheduling/monitoring milestone wires an approved cadence. Production receipts, indexer lag, and database-to-chain parity have not been validated against live systems.

## Operational questions for later phases

- Which provider callback URLs are configured in each environment, and are ingress rewrites in place?
- Is M-Pesa automatic settlement enabled? Which payments require manual review, and who resolves exceptions?
- Which DAO treasury actions are internal accounting allocations versus actual wallet, provider, or chain transfers?
- Which vaults/contracts and token deployments are active, and what confirmation depth is required for each chain?
- Are payment reconciliation and treasury event-listener workers running in every intended environment, and who invokes the treasury reconciliation job?
- How are discrepancies between provider records, account journals, DAO journals, and chain balances detected, escalated, and resolved?
