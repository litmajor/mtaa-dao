import { logger } from '../observability/logger';
import { runWorkerTask } from '../observability/workerContext';

export interface ReconciliationResult {
  status: 'SUCCESS' | 'MISMATCH' | 'ERROR';
  mismatches: any[];
  error?: string;
}

export interface ReconciliationProvider {
  reconcile(): Promise<ReconciliationResult>;
}

export class ReconciliationJob {
  private providers: ReconciliationProvider[] = [];

  registerProvider(provider: ReconciliationProvider) {
    this.providers.push(provider);
  }

  async execute(): Promise<void> {
    await runWorkerTask('reconciliation_job', async () => {
      logger.info({ message: 'Starting nightly reconciliation' });
      
      for (const provider of this.providers) {
        try {
          const result = await provider.reconcile();
          
          if (result.status === 'MISMATCH') {
            logger.error({ 
              message: 'TradeReconciliationFailed', 
              mismatches: result.mismatches 
            });
            // Phase 1 integration point: publish TradeReconciliationFailed Event here
          } else if (result.status === 'SUCCESS') {
            logger.info({ message: 'Reconciliation successful for provider' });
          } else {
             logger.warn({ message: 'Reconciliation provider returned ERROR status', error: result.error });
          }
        } catch (error) {
          logger.error({ 
            message: 'Error during reconciliation execution', 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    });
  }
}
