import client from 'prom-client';

// Default registry
const register = client.register;

// Create a counter for saga DB degradation events
export const sagaDbDegradedCounter = new client.Counter({
  name: 'saga_db_degraded_total',
  help: 'Total number of SAGA DB degraded events (persistence failures)',
  labelNames: ['saga_id', 'step'] as string[],
});

export const sagaReconciliationRuns = new client.Counter({
  name: 'saga_reconciliation_runs_total',
  help: 'Total number of reconciliation job runs',
});

export const sagaReconciledCounter = new client.Counter({
  name: 'saga_reconciled_total',
  help: 'Total number of sagas reconciled by background job',
  labelNames: ['saga_id', 'outcome'] as string[],
});

// Webhook reconciliation metrics
export const webhookReconciliationRuns = new client.Counter({
  name: 'webhook_reconciliation_runs_total',
  help: 'Total number of webhook reconciliation job runs',
});

export const webhookReconciliationSuccess = new client.Counter({
  name: 'webhook_reconciliation_success_total',
  help: 'Total number of webhook reconciliation successes (transactions marked completed)',
  labelNames: ['provider'] as string[],
});

export const webhookReconciliationFailure = new client.Counter({
  name: 'webhook_reconciliation_failure_total',
  help: 'Total number of webhook reconciliation failures (transactions marked failed)',
  labelNames: ['provider'] as string[],
});

export const webhookReconciliationExternalCalls = new client.Counter({
  name: 'webhook_reconciliation_external_calls_total',
  help: 'External API calls made by webhook reconciliation',
  labelNames: ['provider', 'endpoint'] as string[],
});

// Expose helper to return metrics as string for /metrics endpoint
export async function metricsEndpoint(): Promise<string> {
  return await register.metrics();
}

// Optional: expose default collect function for process metrics
client.collectDefaultMetrics({ prefix: 'mtaa_' });

export default register;
