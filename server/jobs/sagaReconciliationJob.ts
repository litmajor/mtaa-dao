import { pool } from '../db';
import { sagaReconciliationRuns } from '../utils/metrics';
import { Logger } from '../utils/logger';
import { enqueueSagaReconcile } from '../queues/sagaQueue';

const logger = Logger.getLogger();

let intervalHandle: NodeJS.Timeout | null = null;

export async function runSagaReconciliationOnce(staleThresholdMs: number, batchSize = 50) {
  sagaReconciliationRuns.inc();
  const thresholdDate = new Date(Date.now() - staleThresholdMs);
  try {
    const res = await pool.query(
      `SELECT id FROM payment_sagas WHERE status IN ('pending','compensating') AND updated_at < $1 LIMIT $2`,
      [thresholdDate, batchSize]
    );
    const rows = res.rows || [];
    logger.info(`[SagaReconcile] Found ${rows.length} stale sagas to enqueue older than ${thresholdDate.toISOString()}`);
    for (const row of rows) {
      try {
        const sagaId = row.id;
        // Enqueue job for worker processing and retries
        await enqueueSagaReconcile(sagaId);
      } catch (e) {
        logger.error('[SagaReconcile] Failed to enqueue saga for reconciliation', { id: row.id, error: e });
      }
    }
  } catch (err) {
    logger.error('[SagaReconcile] DB query failed while scanning for stale sagas', err);
  }
}

export function startSagaReconciliationJob(opts?: { intervalMs?: number; staleThresholdMs?: number }) {
  const intervalMs = opts?.intervalMs ?? Number(process.env.SAGA_RECONCILE_INTERVAL_MS || '60000');
  const staleThresholdMs = opts?.staleThresholdMs ?? Number(process.env.SAGA_STALE_THRESHOLD_MS || '300000');
  if (intervalHandle) return;
  // Run immediately then schedule
  runSagaReconciliationOnce(staleThresholdMs).catch(err => logger.error('[SagaReconcile] initial run failed', err));
  intervalHandle = setInterval(() => {
    runSagaReconciliationOnce(staleThresholdMs).catch(err => logger.error('[SagaReconcile] scheduled run failed', err));
  }, intervalMs);
  logger.info(`[SagaReconcile] Started reconciliation job (interval=${intervalMs}ms, staleThreshold=${staleThresholdMs}ms)`);
}

export function stopSagaReconciliationJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export default { startSagaReconciliationJob, stopSagaReconciliationJob, runSagaReconciliationOnce };
