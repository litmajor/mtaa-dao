import { StrategyJobWorker } from '../../../server/workers/strategyJobWorker';
import { jobQueueService } from '../../../server/services/jobQueueService';
import { db } from '../../../server/db';
import { strategiesTable } from '../../../server/db/schema/strategies';
import { eq } from 'drizzle-orm';

jest.setTimeout(180000);

describe('Strategy backtest integration', () => {
  const requiredEnv = process.env.DATABASE_URL && process.env.REDIS_HOST;

  if (!requiredEnv) {
    it('skips integration (DATABASE_URL or REDIS_HOST not set)', () => {
      console.warn('Skipping integration test: DATABASE_URL or REDIS_HOST not set');
    });
    return;
  }

  const testStrategyId = `integ-test-${Date.now()}`;
  const testUserId = 'integ-test-user';

  beforeAll(async () => {
    // Initialize workers to register processors
    StrategyJobWorker.initialize();

    // Insert a minimal strategy record
    await db.insert(strategiesTable).values({
      id: testStrategyId,
      creatorId: testUserId,
      name: 'Integration Test Strategy',
      targetAllocations: {},
      rebalanceFrequency: 'manual',
      riskLevel: 'low'
    });
  });

  afterAll(async () => {
    // cleanup
    try {
      await db.delete(strategiesTable).where(eq(strategiesTable.id, testStrategyId));
    } catch (err) {
      // ignore
    }
  });

  it('queues a backtest job and returns results', async () => {
    const payload = {
      userId: testUserId,
      strategyId: testStrategyId,
      timerange: '2020-01-01:2020-12-31',
      timestamp: Date.now()
    };

    const jobId = await jobQueueService.queueJob('strategy-backtest', payload, { timeout: 120000 });
    expect(jobId).toBeTruthy();

    // poll for completion
    const start = Date.now();
    let result = null as any;
    while (Date.now() - start < 120000) {
      // eslint-disable-next-line no-await-in-loop
      const status = await jobQueueService.getJobResult(jobId);
      if (status && status.status === 'completed') {
        result = status.result;
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(result).not.toBeNull();
    expect(result.strategyId).toBe(testStrategyId);
    expect(result.backtestResults).toBeDefined();
  });
});
