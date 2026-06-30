import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { paymentRecoverySAGA } from '../services/PaymentRecoverySAGAOrchestrator';
import { sagaReconciledCounter } from '../utils/metrics';
import { Logger } from '../utils/logger';
import { sendSAGADegradedAlert } from '../utils/emailNotifier';

const logger = Logger.getLogger();

const redisUrl = process.env.REDIS_URL || (() => {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || '6379');
  const password = process.env.REDIS_PASSWORD;
  if (password) return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  return `redis://${host}:${port}`;
})();

// Use connection options object to avoid cross-module ioredis type mismatch
const connectionOptions = { url: redisUrl };

const QUEUE_NAME = process.env.SAGA_RECONCILE_QUEUE_NAME || 'saga-reconcile-queue';

const queue = new Queue(QUEUE_NAME, { connection: connectionOptions as any });

let worker: Worker | null = null;

export async function enqueueSagaReconcile(sagaId: string, opts?: { delayMs?: number }) {
  try {
    const jobId = `reconcile:${sagaId}`;
    await queue.add('reconcile', { sagaId }, {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: Number(process.env.SAGA_RETRY_ATTEMPTS || '5'),
      backoff: {
        type: 'exponential',
        delay: Number(process.env.SAGA_RETRY_BASE_MS || '1000')
      },
      delay: opts?.delayMs ?? 0,
    });
  } catch (err) {
    logger.error('[SagaQueue] Failed to enqueue reconcile job', err);
  }
}

export function startSagaWorker(opts?: { concurrency?: number }) {
  if (worker) return;
  const concurrency = opts?.concurrency ?? Number(process.env.SAGA_WORKER_CONCURRENCY || '4');

  worker = new Worker(QUEUE_NAME, async (job: Job) => {
    const { sagaId } = (job?.data || {}) as { sagaId: string };
    logger.info(`[SagaQueue] Processing reconcile job for ${sagaId}`);
    try {
      const result = await paymentRecoverySAGA.reconcileSaga(sagaId);
      sagaReconciledCounter.inc({ saga_id: sagaId, outcome: result?.outcome || 'unknown' } as any);
      logger.info(`[SagaQueue] Reconcile completed for ${sagaId}`, result);
      return { success: true, result };
    } catch (err) {
      logger.error(`[SagaQueue] Reconcile failed for ${sagaId}`, err);
      // Send an alert for worker-level failures (non-DB)
      try { await sendSAGADegradedAlert(sagaId, 'RECONCILE_WORKER', err); } catch(_){}
      throw err; // rethrow to allow retries/backoff
    }
  }, { connection: connectionOptions as any, concurrency });

  worker.on('failed', (job, err) => {
    logger.warn(`[SagaQueue] Job ${job?.id ?? 'unknown'} failed: ${err?.message || String(err)}`);
  });

  worker.on('completed', (job) => {
    logger.debug(`[SagaQueue] Job ${job?.id ?? 'unknown'} completed`);
  });

  logger.info(`[SagaQueue] Worker started (concurrency=${concurrency})`);
}

export async function stopSagaWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  try { await queue.close(); } catch (e) {}
}

export default { enqueueSagaReconcile, startSagaWorker, stopSagaWorker };
