import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { reward_requests } from '../../shared/rewardsSchema.ts';
import { logger } from '../utils/logger';
import { userAchievements, achievements } from '../../shared/achievementSchema';
import { users } from '../../shared/schema';
import { batchDistributeOnChain } from './rewards_contract';

const BATCH_SIZE = Number(process.env.REWARDS_BATCH_SIZE || '50');
const POLL_INTERVAL_MS = Number(process.env.REWARDS_POLL_INTERVAL_MS || '10000');
const MAX_ATTEMPTS = Number(process.env.REWARDS_MAX_ATTEMPTS || '5');

let running = false;

export function startRewardsBatchWorker() {
  if (running) return;
  running = true;
  (async function loop() {
    while (running) {
      try {
        await processPendingBatch();
      } catch (err) {
        logger.warn('rewards_batch_worker loop error', { error: err instanceof Error ? err.message : String(err), stack: (err as any)?.stack });
      }
      await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    }
  })();
}

export function stopRewardsBatchWorker() {
  running = false;
}

async function processPendingBatch() {
  // Select pending requests with attempts < MAX_ATTEMPTS
  let pending: any[] = [];
  try {
    pending = await db.select().from(reward_requests).where(sql`${reward_requests.status} = 'pending' AND ${reward_requests.attempts} < ${MAX_ATTEMPTS}`).limit(BATCH_SIZE);
  } catch (err: any) {
    // Log full error object for diagnostics
    logger.warn('rewards_batch_worker query failed', { error: err?.message || String(err), cause: err?.cause || err });

    // If the error indicates a missing column/table, stop the worker to avoid log spam
    const code = err?.cause?.code || err?.code || null;
    if (code === '42703' || String(err?.message).includes('does not exist') || String(err?.message).includes('column')) {
      logger.error('rewards_batch_worker detected missing column/table; stopping worker. Run DB migrations (npm run migrate) to resolve.', { error: err });
      running = false;
    }
    return;
  }
  if (!pending || pending.length === 0) return;

  // mark each as processing (best-effort; continue on individual failures)
  for (const r of pending) {
    try {
      await db.update(reward_requests).set({ status: 'processing', updatedAt: new Date(), lastAttemptAt: new Date() }).where(eq(reward_requests.id, r.id) as any);
    } catch (err: any) {
      logger.warn('Failed to mark reward_request as processing', { id: r?.id, error: err?.message || String(err) });
    }
  }

  try {
    // build recipients and amounts
    const recipients: string[] = [];
    const amounts: bigint[] = [];
    for (const r of pending) {
      const u = await db.select().from(users).where(eq(users.id, r.userId));
      const wallet = u?.[0]?.walletAddress;
      if (!wallet) continue;
      recipients.push(wallet);
      amounts.push(BigInt(String(r.amountUnits)));
    }

    if (recipients.length === 0) {
      // mark each as failed and increment attempts
      for (const r of pending) {
        const newAttempts = (r.attempts || 0) + 1;
        const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await db.update(reward_requests).set({ attempts: newAttempts, status: newStatus, updatedAt: new Date() }).where(eq(reward_requests.id, r.id) as any);
      }
      return;
    }

    const res = await batchDistributeOnChain(recipients, amounts.map(a => a), 0, 'achievement_batch');
    // On success, update all involved rows
    // update each row as done
    for (const r of pending) {
      await db.update(reward_requests).set({ status: 'done', txHash: res.txHash, processedAt: new Date(), updatedAt: new Date() }).where(eq(reward_requests.id, r.id) as any);
      // mark userAchievements rewardClaimed true for processed rows
      await db.update(userAchievements).set({ rewardClaimed: true, claimedAt: new Date() }).where(eq(userAchievements.id, r.userAchievementId) as any);
    }
  } catch (err: any) {
    logger.warn('rewards_batch_worker processing failed', { error: err?.message || String(err), stack: err?.stack });
    // increment attempts and set status back to pending or failed
    for (const r of pending) {
      const newAttempts = (r.attempts || 0) + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await db.update(reward_requests).set({ attempts: newAttempts, status: newStatus, updatedAt: new Date() }).where(eq(reward_requests.id, r.id) as any);
    }
  }
}
