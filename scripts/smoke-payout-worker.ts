import 'dotenv/config';
import { db } from '../server/db';
import { referralPayouts } from '../shared/financialEnhancedSchema';
import { randomUUID } from 'crypto';
import { processPendingPayoutsOnce } from '../server/workers/payout-worker';

async function enqueueTestPayout() {
  const id = randomUUID();
  const now = new Date();
  const row = {
    id,
    requestId: `0x${id.replace(/-/g, '')}`,
    referrerId: 'smoke-test',
    destinationAddress: process.env.SMOKE_TEST_ADDRESS || '0x0000000000000000000000000000000000000000',
    amount: '0.001',
    currency: 'MTAA',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  } as any;

  try {
    await db.insert(referralPayouts).values(row);
    console.log('Enqueued smoke payout', id);
    return id;
  } catch (e) {
    console.error('Failed to enqueue test payout', e);
    process.exit(1);
  }
}

async function run() {
  console.log('Starting smoke test (dry-run)');
  await enqueueTestPayout();
  await processPendingPayoutsOnce(true);
  console.log('Dry-run completed. Check logs for simulated tx details.');
  process.exit(0);
}

run().catch((e) => {
  console.error('Smoke test failed', e);
  process.exit(1);
});
