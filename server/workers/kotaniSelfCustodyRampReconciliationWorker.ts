import { KotaniSelfCustodyRampService } from '../services/kotaniSelfCustodyRampService';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();
const configuredIntervalMs = Number(process.env.KOTANIPAY_RECONCILE_INTERVAL_MS || '60000');
const intervalMs = Number.isFinite(configuredIntervalMs) && configuredIntervalMs >= 15_000
  ? configuredIntervalMs
  : 60_000;
if (process.env.KOTANIPAY_RECONCILE_INTERVAL_MS && intervalMs !== configuredIntervalMs) {
  logger.warn('Invalid KotaniPay reconciliation interval; using the 60 second default.', {
    configuredIntervalMs: process.env.KOTANIPAY_RECONCILE_INTERVAL_MS,
  });
}
let intervalHandle: NodeJS.Timeout | undefined;
let runInProgress = false;

async function runOnce(): Promise<void> {
  if (runInProgress || !KotaniSelfCustodyRampService.isAvailable()) return;
  runInProgress = true;
  try {
    const inboxResult = await KotaniSelfCustodyRampService.processWebhookInbox();
    const statusResult = await KotaniSelfCustodyRampService.reconcileProviderStatuses();
    if (inboxResult.checked > 0 || statusResult.checked > 0) {
      logger.info('KotaniPay ramp reconciliation completed', { inbox: inboxResult, providerStatus: statusResult });
    }
    if (inboxResult.failed > 0 || statusResult.failed > 0) {
      logger.error('KotaniPay ramp reconciliation has unresolved events or provider statuses', {
        inbox: inboxResult,
        providerStatus: statusResult,
      });
    }
  } catch (error) {
    logger.error('KotaniPay ramp status reconciliation scan failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    runInProgress = false;
  }
}

export function startKotaniSelfCustodyRampReconciliationWorker(): void {
  if (intervalHandle || !KotaniSelfCustodyRampService.isAvailable()) return;
  void runOnce();
  intervalHandle = setInterval(() => void runOnce(), intervalMs);
  logger.info('KotaniPay self-custody ramp status reconciliation worker started', { intervalMs });
}

export function stopKotaniSelfCustodyRampReconciliationWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
}
