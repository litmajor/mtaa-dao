import { pgTable, text, timestamp, jsonb, integer, uniqueIndex, index, boolean, numeric, uuid, check, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Preservation of existing operational tables
// -----------------------------------------------------------------------------
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  status: text('status').notNull().default('pending'),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').default(sql`now() + '24:00:00'::interval`).notNull(),
}, (table) => ({
  expiresIdx: index('idx_idempotency_expires').on(table.expiresAt),
  statusCheck: check('idempotency_keys_status_check', sql`${table.status} IN ('pending', 'completed', 'failed')`),
}));

export const circuitBreakerStates = pgTable('circuit_breaker_states', {
  provider: text('provider').primaryKey(),
  state: text('state').notNull(),
  failureCount: integer('failure_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  lastStateChange: timestamp('last_state_change').notNull().defaultNow(),
  resetTime: timestamp('reset_time'),
  failureThreshold: integer('failure_threshold').notNull().default(5),
  successThreshold: integer('success_threshold').notNull().default(2),
  timeoutMs: integer('timeout_ms').notNull().default(60000),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  stateCheck: check('circuit_breaker_states_state_check', sql`${table.state} IN ('closed', 'open', 'half_open')`),
}));

export const providerFallbacks = pgTable('provider_fallbacks', {
  operation: text('operation').notNull(),
  provider: text('provider').notNull(),
  priority: integer('priority').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  failureRate: numeric('failure_rate', { precision: 10, scale: 6 }).notNull().default('0'),
  averageLatency: integer('average_latency').notNull().default(0),
  lastUsed: timestamp('last_used'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  operationProviderPK: primaryKey({ columns: [table.operation, table.provider] }),
  operationPriority: index('idx_provider_fallbacks_operation_priority').on(table.operation, table.priority),
}));

export const actionReversals = pgTable('action_reversals', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionType: text('action_type').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull(),
  initiatorId: text('initiator_id').notNull(),
  initiatorType: text('initiator_type').notNull(),
  initiatorRole: text('initiator_role'),
  initiatorEmail: text('initiator_email'),
  affectedEntityType: text('affected_entity_type').notNull(),
  affectedEntityId: text('affected_entity_id').notNull(),
  affectedEntityName: text('affected_entity_name'),
  actionPayload: jsonb('action_payload').notNull(),
  beforeState: jsonb('before_state').notNull(),
  afterState: jsonb('after_state').notNull(),
  confirmationType: text('confirmation_type').notNull().default('NONE'),
  requiredApprovals: integer('required_approvals'),
  approverRoles: text('approver_roles').array(),
  confirmationTimeoutMinutes: integer('confirmation_timeout_minutes').notNull().default(1440),
  gracePeriodDurationHours: integer('grace_period_duration_hours').notNull(),
  gracePeriodReminderHours: integer('grace_period_reminder_hours').array().notNull(),
  userCanAccelerate: boolean('user_can_accelerate').notNull().default(false),
  autoExecuteAtDeadline: boolean('auto_execute_at_deadline').notNull().default(false),
  reversibleFields: text('reversible_fields').array().notNull(),
  initiatorCanReverse: boolean('initiator_can_reverse').notNull().default(true),
  adminCanReverse: boolean('admin_can_reverse').notNull().default(true),
  governanceCanReverse: boolean('governance_can_reverse').notNull().default(false),
  minimumRoleToReverse: text('minimum_role_to_reverse'),
  reversalDeadlineHours: integer('reversal_deadline_hours'),
  partialReversalAllowed: boolean('partial_reversal_allowed').notNull().default(false),
  emergencyStopEnabled: boolean('emergency_stop_enabled').notNull().default(true),
  emergencyStopAllowedActors: text('emergency_stop_allowed_actors').array().default(['SUPERUSER', 'GOVERNANCE']),
  emergencyStopRequiresApproval: boolean('emergency_stop_requires_approval').notNull().default(false),
  emergencyStopDurationHours: integer('emergency_stop_duration_hours').default(24),
  emergencyStopAction: text('emergency_stop_action').default('PAUSE'),
  emergencyStopAppealable: boolean('emergency_stop_appealable').notNull().default(true),
  circuitBreakerActionCount: integer('circuit_breaker_action_count').default(0),
  circuitBreakerThreshold: integer('circuit_breaker_threshold'),
  circuitBreakerWindowMinutes: integer('circuit_breaker_window_minutes').default(60),
  circuitBreakerOpen: boolean('circuit_breaker_open').default(false),
  circuitBreakerResetAt: timestamp('circuit_breaker_reset_at'),
  initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  gracePeriodStartsAt: timestamp('grace_period_starts_at'),
  gracePeriodEndsAt: timestamp('grace_period_ends_at'),
  executedAt: timestamp('executed_at'),
  reversedAt: timestamp('reversed_at'),
  irreversibleAt: timestamp('irreversible_at'),
  executionSuccess: boolean('execution_success'),
  executionError: text('execution_error'),
  executionTransactionHash: text('execution_transaction_hash'),
  executionBlockNumber: integer('execution_block_number'),
  reversalReason: text('reversal_reason'),
  reversedById: text('reversed_by_id'),
  reversedByType: text('reversed_by_type'),
  reversedByRole: text('reversed_by_role'),
  reversalReasonText: text('reversal_reason_text'),
  reversalPayload: jsonb('reversal_payload'),
  reversalTransactionHash: text('reversal_transaction_hash'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  actionTypeIdx: index('idx_action_reversals_action_type').on(table.actionType),
  statusIdx: index('idx_action_reversals_status').on(table.status),
  initiatorIdx: index('idx_action_reversals_initiator').on(table.initiatorId, table.initiatorType),
  affectedEntityIdx: index('idx_action_reversals_affected_entity').on(table.affectedEntityType, table.affectedEntityId),
  gracePeriodEndsIdx: index('idx_action_reversals_grace_period_ends').on(table.gracePeriodEndsAt),
  createdAtIdx: index('idx_action_reversals_created_at').on(table.createdAt),
}));

// -----------------------------------------------------------------------------
// Transactional Outbox for Durable Domain Events
// -----------------------------------------------------------------------------
export const domainEvents = pgTable('domain_events', {
  id: text('id').primaryKey(), // UUID acts as determinisic Redis message ID
  eventType: text('event_type').notNull(),
  version: integer('version').default(1).notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  actor: text('actor').notNull(), // Who caused this fact
  createdAt: timestamp('created_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'), 
  publishAttempts: integer('publish_attempts').default(0).notNull(),
  lastPublishAttempt: timestamp('last_publish_attempt'),
  lastPublishError: text('last_publish_error'),
}, (table) => ({
  // OCC Constraint: Prevent concurrent transactions from emitting the same version of an aggregate
  occConstraint: uniqueIndex('domain_events_occ_idx').on(table.aggregateType, table.aggregateId, table.version),
  
  // Optimize Outbox Relay querying
  unpublishedIdx: index('idx_domain_events_unpublished').on(table.createdAt).where(sql`${table.publishedAt} IS NULL`),
  
  // Optimize historical rebuilding
  aggregateHistoryIdx: index('idx_domain_events_aggregate').on(table.aggregateType, table.aggregateId, table.version),
  
  // Optimize event type filtering
  eventTypeIdx: index('idx_domain_events_type').on(table.eventType),
}));

// -----------------------------------------------------------------------------
// Consumer Idempotency & Recovery State Machine
// -----------------------------------------------------------------------------
export const processedEvents = pgTable('processed_events', {
  eventId: text('event_id').notNull(),
  consumerName: text('consumer_name').notNull(),
  status: text('status').notNull(), // 'RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED'
  streamMessageId: text('stream_message_id'), // Redis stream ID for production tracing
  receivedAt: timestamp('received_at').defaultNow().notNull(), // When consumer first saw the event
  processingStartedAt: timestamp('processing_started_at'),
  processedAt: timestamp('processed_at'),
  retryCount: integer('retry_count').default(0).notNull(),
  lastError: text('last_error'),
}, (table) => ({
  // Core idempotency constraint
  pk: uniqueIndex('processed_events_pk').on(table.eventId, table.consumerName),
  
  // Optimize supervisor recovery queries for stalled workloads
  stalledIdx: index('idx_processed_events_stalled').on(table.status, table.processingStartedAt),
}));

// -----------------------------------------------------------------------------
// Event Dead Letters — Human Recovery Workflow
// -----------------------------------------------------------------------------
export const eventDeadLetters = pgTable('event_dead_letters', {
  id: text('id').primaryKey(), // UUID
  originalEventId: text('original_event_id').notNull(),
  eventType: text('event_type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  correlationId: text('correlation_id'),
  actor: text('actor'),
  failureReason: text('failure_reason').notNull(),
  failureSource: text('failure_source').notNull(), // 'outbox_relay' | 'consumer'
  consumerName: text('consumer_name'), // Only set when a consumer failed
  attempts: integer('attempts').default(0).notNull(),
  quarantinedAt: timestamp('quarantined_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'), // Operator who manually resolved
  resolutionNotes: text('resolution_notes'),
}, (table) => ({
  // Find unresolved dead letters for the ops dashboard
  unresolvedIdx: index('idx_dead_letters_unresolved').on(table.quarantinedAt).where(sql`${table.resolvedAt} IS NULL`),

  // Find dead letters by original event
  originalEventIdx: index('idx_dead_letters_original_event').on(table.originalEventId),
}));

// -----------------------------------------------------------------------------
// Command Log & Audit Trail
// -----------------------------------------------------------------------------
export const commandLog = pgTable('command_log', {
  commandId: text('command_id').primaryKey(), // UUID provided by client
  commandType: text('command_type').notNull(),
  actor: text('actor').notNull(),
  correlationId: text('correlation_id').notNull(),
  payload: jsonb('payload').notNull(),
  result: jsonb('result'), // Full CommandResult payload for crash-recovery replay
  status: text('status').notNull(), // 'RECEIVED', 'EXECUTING', 'COMPLETED', 'FAILED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  error: text('error'),
}, (table) => ({
  // Find commands by actor
  actorIdx: index('idx_command_log_actor').on(table.actor),
  
  // Find commands by correlation for distributed tracing
  correlationIdx: index('idx_command_log_correlation').on(table.correlationId),
}));
