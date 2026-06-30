import { db } from '../db';
import { referralPayouts } from '../../shared/financialEnhancedSchema';
import { eq, and, or, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { metricsCollector } from '../monitoring/metricsCollector';
import { allocateNonceBatch, verifyNonceUsage } from './nonce-allocation';
import { createWalletIfValid } from '../utils/cryptoWallet';

// payout worker for processing referral_payouts ledger
// Features:
// - Batched processing
// - Idempotency guard (checks requestId / transactionHash)
// - Dynamic fee management via provider.getFeeData()
// - Retry/backoff and max retries
// - Optional admin alert webhook on repeated failures

const BATCH_SIZE = Number(process.env.PAYOUT_BATCH_SIZE || 5);
const POLL_INTERVAL_MS = Number(process.env.PAYOUT_POLL_INTERVAL_MS || 30_000);
const MAX_RETRIES = Number(process.env.PAYOUT_MAX_RETRIES || 5);
const CONFIRMATIONS = Number(process.env.PAYOUT_CONFIRMATIONS || 2);

const REWARDS_MANAGER_ABI = [
  'function distributeReward(bytes32 requestId, address to, uint256 amount) returns (bytes)'
];

function toHexRequestId(id?: string) {
  if (id) {
    try {
      // ensure 0x-prefixed
      return id.startsWith('0x') ? id : `0x${id}`;
    } catch (e) {
      // fallthrough
    }
  }
  return `0x${randomBytes(32).toString('hex')}`;
}

async function sendAdminAlert(message: string) {
  const url = process.env.ADMIN_ALERT_WEBHOOK;
  if (!url) return;
  try {
    // Discord webhook expects { content: "..." }
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }) });
    logger.info('Sent admin alert', { message });
  } catch (e) {
    logger.error('Failed to send admin alert', e);
  }
}

async function processPendingPayouts(dryRun = false) {

  // Select rows that are pending or previously failed but under retry limit
  // Use FOR UPDATE SKIP LOCKED to avoid double-processing across workers
  const result = await db.execute(sql`
    SELECT * FROM referral_payouts
    WHERE (status = 'pending' OR (status = 'failed' AND retry_count < ${MAX_RETRIES}))
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE}
    FOR UPDATE SKIP LOCKED
  `);
  const rows = (result.rows as any[]) || [];
  if (rows.length === 0) return;

  logger.info('Payout worker processing batch', { batchSize: rows.length, dryRun });
  const batchStart = Date.now();

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = createWalletIfValid(process.env.PRIVATE_KEY, provider);
  if (!wallet) {
    logger.error('PRIVATE_KEY invalid or not set; aborting payout worker batch');
    return;
  }
  const contract = new ethers.Contract(process.env.MTAA_CONTRACT_ADDR || '', REWARDS_MANAGER_ABI, wallet);

  // Pre-flight: ensure contract has enough MTAA balance to cover the batch
  try {
    const tokenAddr = process.env.MTAA_TOKEN_ADDR || '';
    if (!tokenAddr) {
      logger.warn('MTAA_TOKEN_ADDR not set; skipping contract balance pre-flight check');
    } else {
      const mtaaToken = new ethers.Contract(tokenAddr, ['function balanceOf(address) view returns (uint256)'], provider);
      const contractAddr = process.env.MTAA_CONTRACT_ADDR || '';
      const contractBalance = await mtaaToken.balanceOf(contractAddr);
      // compute batch total
      let batchTotal = 0n;
      for (const p of rows) {
        const amountStr = String(p.amount ?? '0');
        const truncated = parseFloat(amountStr).toFixed(6);
        batchTotal += ethers.parseUnits(truncated, 18);
      }

      if (contractBalance < batchTotal) {
        const message = `Insufficient contract balance for payout batch: need ${batchTotal} but have ${contractBalance}`;
        logger.error(message);
        await sendAdminAlert(message);
        return; // abort batch to avoid mass reverts
      }
    }
  } catch (balErr) {
    logger.warn('Contract balance pre-flight check failed, proceeding with caution', { error: String(balErr) });
  }

  // Allocate a batch-level pending nonce to avoid collisions within the batch
  let nonce: number | undefined = undefined;
  let allocationId: string | undefined = undefined;
  if (!dryRun) {
    try {
      // Use atomic nonce allocation with serializable isolation
      const sender = (wallet as any).address;
      const allocation = await allocateNonceBatch(sender, rows.length, false);
      if (allocation.isSuccessful) {
        nonce = allocation.startNonce;
        allocationId = allocation.allocationId;
        logger.info('Allocated atomic nonce range', {
          sender,
          startNonce: allocation.startNonce,
          endNonce: allocation.endNonce,
          allocationId,
          batchSize: rows.length
        });
      } else {
        logger.error('Failed to allocate nonce batch', { allocationId: allocation.allocationId, error: allocation.error });
        return;
      }
    } catch (nErr) {
      logger.error('Failed to allocate nonce batch; aborting to prevent collisions', { error: String(nErr) });
      return;
    }
  }

  for (const p of rows) {
    logger.info('Processing payout', { payoutId: p.id, referrerId: p.referrer_id, amount: String(p.amount), requestId: p.request_id });
    try {
      // Idempotency: if already has transactionHash, skip
      if (p.transaction_hash) {
        await db.update(referralPayouts).set({ status: 'completed' }).where(eq(referralPayouts.id, p.id));
        logger.info('Skipping already-settled payout', { payoutId: p.id, transactionHash: p.transaction_hash });
        continue;
      }

      // Lock the row
      await db.update(referralPayouts).set({ status: 'processing' }).where(eq(referralPayouts.id, p.id));

      // Prepare args
      const requestId = toHexRequestId(p.request_id);
      const to = p.destination_address;
      if (!to) throw new Error('No destinationAddress');

      // Determine amount format; assume stored as human decimal and convert to 18-decimals
      const amountStr = String(p.amount ?? '0');
      const truncated = parseFloat(amountStr).toFixed(6);
      const amount = ethers.parseUnits(truncated, 18);

      // Fee management
      const feeData = await provider.getFeeData();
      const overrides: any = {};
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        overrides.maxFeePerGas = feeData.maxFeePerGas;
        overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      }

      // Nonce management: ensure a single nonce is allocated per batch to avoid collisions
      // (see batch nonce handling below)


      // We'll handle dryRun below after batch-level nonce is set

      // Apply batch-level nonce if available
      if (typeof nonce === 'number') overrides.nonce = nonce;

      if (dryRun) {
        logger.info('Dry-run mode - would send tx', { payoutId: p.id, to, amount: truncated, requestId });
        // Revert processing state back to pending for dry run
        await db.update(referralPayouts).set({ status: 'pending', updatedAt: new Date() as any }).where(eq(referralPayouts.id, p.id));
        // increment nonce as if we had sent (to keep ordering consistent in dry-run)
        if (typeof nonce === 'number') nonce++;
        continue;
      }

      // Send transaction
      const tx = await contract.distributeReward(requestId, to, amount, overrides);

      // Optionally save nonce for ordering/replacements
      const txNonce = tx.nonce ?? undefined;
      
      // CRITICAL: Verify nonce was actually used to detect collisions
      if (allocationId && typeof txNonce === 'number') {
        try {
          const verification = await verifyNonceUsage(p.id, tx.hash, txNonce, allocationId);
          if (!verification.verified) {
            logger.warn('Nonce verification failed - collision detected', {
              payoutId: p.id,
              nonce: txNonce,
              allocationId,
              anomaly: verification.anomaly
            });
          }
        } catch (verErr) {
          logger.warn('Failed to verify nonce usage', { payoutId: p.id, error: String(verErr) });
        }
      }

      // Wait for confirmations with replace-by-fee (RBF) fallback
      let finalTxHash = tx.hash;
      let confirmed = false;
      try {
        await provider.waitForTransaction(tx.hash, CONFIRMATIONS, 120_000);
        confirmed = true;
      } catch (waitErr) {
        logger.warn('Confirmations wait timed out for tx; attempting RBF replacements', { txHash: tx.hash, payoutId: p.id });
      }

      // If not confirmed, attempt a small number of replacements with higher fees
      let replacementAttempts = 0;
      const MAX_REPLACEMENTS = 2;
      let lastErrorDuringReplacement: any = null;
      while (!confirmed && replacementAttempts < MAX_REPLACEMENTS) {
        replacementAttempts++;
        try {
          const multiplier = 1 + 0.2 * replacementAttempts; // 1.2x, 1.4x
          const feeData2 = await provider.getFeeData();
          const replOverrides: any = { nonce: overrides.nonce ?? nonce };
          if (feeData2.maxFeePerGas && feeData2.maxPriorityFeePerGas) {
            replOverrides.maxFeePerGas = BigInt(Math.floor(Number(feeData2.maxFeePerGas) * multiplier));
            replOverrides.maxPriorityFeePerGas = BigInt(Math.floor(Number(feeData2.maxPriorityFeePerGas) * multiplier));
          }
          logger.info('Sending replacement tx with increased fees', { payoutId: p.id, attempt: replacementAttempts, replOverrides });
          const replTx = await contract.distributeReward(requestId, to, amount, replOverrides);
          finalTxHash = replTx.hash;
          // wait again
          try {
            await provider.waitForTransaction(replTx.hash, CONFIRMATIONS, 120_000);
            confirmed = true;
            break;
          } catch (waitErr2) {
            logger.warn('Replacement tx still not confirmed', { txHash: replTx.hash, attempt: replacementAttempts });
          }
        } catch (replErr) {
          lastErrorDuringReplacement = replErr;
          logger.warn('Replacement attempt failed', { attempt: replacementAttempts, error: String(replErr) });
        }
      }

      // Reorg protection: verify receipt after (attempts)
      const receipt = await provider.getTransactionReceipt(finalTxHash);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction reverted or disappeared on-chain' + (lastErrorDuringReplacement ? `; replacement error: ${String(lastErrorDuringReplacement)}` : ''));
      }

      // Mark completed with allocation tracking (store in metadata until migration adds fields)
      const metadataUpdate = {
        ...(p.metadata || {}),
        allocation_id: allocationId,
        nonce_verified: true,
        verified_at: new Date().toISOString()
      };
      await db.update(referralPayouts).set({
        status: 'completed',
        transactionHash: tx.hash,
        nonce: tx.nonce ? String(tx.nonce) : null,
        metadata: metadataUpdate as any,
        processedAt: new Date() as any
      }).where(eq(referralPayouts.id, p.id));

      logger.info('Payout completed', { payoutId: p.id, txHash: tx.hash, nonce: tx.nonce });
      // increment batch nonce after successful send to avoid collisions
      if (typeof nonce === 'number') nonce++;
      // Metrics: processed count
      try { metricsCollector.recordWorkerProcessed(1, { worker: 'payouts' }); } catch (e) { logger.debug('metrics record error', e); }

    } catch (err: any) {
      const lastError = err?.message || String(err);
      const retryCount = (p.retry_count || 0) + 1;
      const newStatus = retryCount >= MAX_RETRIES ? 'failed' : 'pending';

      await db.update(referralPayouts).set({ lastError, retryCount, status: newStatus, updatedAt: new Date() as any }).where(eq(referralPayouts.id, p.id));

      logger.error('Payout processing error', { payoutId: p.id, error: lastError, retryCount });

      try { metricsCollector.recordWorkerFailure({ worker: 'payouts' }); } catch (e) { logger.debug('metrics record error', e); }

      if (retryCount >= MAX_RETRIES) {
        await sendAdminAlert(`Payout ${p.id} failed after ${retryCount} attempts: ${lastError}`);
      }
    }
  }

  const batchDuration = Date.now() - batchStart;
  try { metricsCollector.recordWorkerDuration(batchDuration, { worker: 'payouts' }); } catch (e) { logger.debug('metrics record error', e); }

  // end batch
}

// Exported convenience function for tests to run a single pass
export async function processPendingPayoutsOnce(dryRun = false) {
  await processPendingPayouts(dryRun);
}

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;

export function getPayoutWorkerStatus() {
  return { isRunning, lastRunAt };
}

export function startPayoutWorker(intervalMs = POLL_INTERVAL_MS) {
  if (intervalHandle) return;
  isRunning = true;
  // Run immediately then schedule
  processPendingPayouts()
    .then(() => { lastRunAt = new Date(); })
    .catch(err => logger.error('Payout worker initial run failed', err));
  intervalHandle = setInterval(() => processPendingPayouts().catch(err => logger.error('Payout worker loop error', err)), intervalMs);
  logger.info('Payout worker started', { pollIntervalMs: intervalMs });
}

export function stopPayoutWorker() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  isRunning = false;
  logger.warn('Payout worker stopped');
}

export default { startPayoutWorker, stopPayoutWorker, getPayoutWorkerStatus };
