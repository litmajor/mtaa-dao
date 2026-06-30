/**
 * CRITICAL FIX #1: Atomic Nonce Allocation + Sequence Verification
 * Purpose: Prevent silent nonce collisions in payout batches
 * Priority: CRITICAL (do not deploy without this)
 * 
 * This file provides deterministic nonce allocation with race condition protection.
 * Deploy BEFORE scaling beyond 1K payouts/week.
 */

import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

/**
 * Atomic batch nonce allocation
 * Returns a guaranteed unique nonce range for this batch
 */
export const allocateNonceBatch = async (
  senderAddress: string,
  batchSize: number,
  dryRun: boolean = false
): Promise<{
  startNonce: number;
  endNonce: number;
  allocationId: string;
  isSuccessful: boolean;
  error?: string;
}> => {
  const allocationId = randomBytes(16).toString('hex');

  if (dryRun) {
    // Dry-run: just preview without modifying state
    try {
      const nextNonce = await provider.getTransactionCount(senderAddress, 'pending');
      logger.debug('Dry-run nonce allocation', {
        senderAddress,
        predictedStartNonce: nextNonce,
        predictedEndNonce: nextNonce + batchSize,
        allocationId
      });
      return {
        startNonce: nextNonce,
        endNonce: nextNonce + batchSize,
        allocationId,
        isSuccessful: true
      };
    } catch (err) {
      return {
        startNonce: 0,
        endNonce: 0,
        allocationId,
        isSuccessful: false,
        error: `Dry-run failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  // Production: Atomic allocation with serializable isolation
  try {
    // Use serializable isolation to prevent concurrent allocations
    const result = await db.execute(sql`
      -- Use SERIALIZABLE isolation for atomic allocation
      BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
      
      WITH max_used_nonce AS (
        -- Find the highest nonce ever allocated for this sender
        SELECT COALESCE(MAX(end_nonce), 0) as max_allocated
        FROM nonce_allocations
        WHERE address = ${senderAddress}
      ),
      new_allocation AS (
        INSERT INTO nonce_allocations (
          address,
          allocation_id,
          batch_size,
          start_nonce,
          end_nonce,
          status,
          allocated_at
        )
        SELECT
          ${senderAddress},
          ${allocationId},
          ${batchSize},
          m.max_allocated,
          m.max_allocated + ${batchSize},
          'active',
          NOW()
        FROM max_used_nonce m
        RETURNING start_nonce, end_nonce
      )
      SELECT * FROM new_allocation;
      
      COMMIT;
    `);

    if (!result.rows[0]) {
      return {
        startNonce: 0,
        endNonce: 0,
        allocationId,
        isSuccessful: false,
        error: 'Failed to insert nonce allocation (transaction conflict?)'
      };
    }

    const { start_nonce, end_nonce } = result.rows[0] as any;

    logger.info('Nonce batch allocated successfully', {
      senderAddress,
      allocationId,
      startNonce: start_nonce,
      endNonce: end_nonce,
      batchSize
    });

    return {
      startNonce: start_nonce,
      endNonce: end_nonce,
      allocationId,
      isSuccessful: true
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Nonce batch allocation failed', {
      senderAddress,
      allocationId,
      batchSize,
      error: errorMsg
    });

    // FALLBACK: If allocation fails, return error (don't proceed with txs)
    return {
      startNonce: 0,
      endNonce: 0,
      allocationId,
      isSuccessful: false,
      error: `Allocation failed: ${errorMsg}`
    };
  }
};

/**
 * Verify that a transaction used the expected nonce
 * Call after tx is sent to catch anomalies early
 */
export const verifyNonceUsage = async (
  payoutId: string,
  transactionHash: string,
  expectedNonce: number,
  allocationId: string
): Promise<{ verified: boolean; actualNonce?: number; anomaly: boolean }> => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const tx = await provider.getTransaction(transactionHash);

    if (!tx) {
      return {
        verified: false,
        anomaly: true
      };
    }

    const actualNonce = tx.nonce;

    if (actualNonce !== expectedNonce) {
      logger.error('NONCE MISMATCH DETECTED', {
        payoutId,
        transactionHash,
        expectedNonce,
        actualNonce,
        allocationId,
        anomaly: true
      });

      // Mark allocation as corrupted
      await db.execute(sql`
        UPDATE nonce_allocations
        SET status = 'corrupted',
            failure_reason = 'Tx nonce mismatch: expected ' || ${expectedNonce} || ' but got ' || ${actualNonce}
        WHERE allocation_id = ${allocationId}
      `);

      return {
        verified: false,
        actualNonce,
        anomaly: true
      };
    }

    return {
      verified: true,
      actualNonce,
      anomaly: false
    };
  } catch (err) {
    logger.warn('Could not verify nonce usage', {
      payoutId,
      transactionHash,
      error: err instanceof Error ? err.message : String(err)
    });

    return {
      verified: false,
      anomaly: false // Uncertain, not definitive anomaly
    };
  }
};

/**
 * Get audit report for nonce allocations
 * Use this to detect orphaned allocations and recovery needs
 */
export const getNonceAllocationAudit = async (
  senderAddress: string,
  hoursBack: number = 24
): Promise<{
  totalAllocations: number;
  activeAllocations: number;
  completedAllocations: number;
  failedAllocations: number;
  corruptedAllocations: number;
  orphanedRanges: Array<{ startNonce: number; endNonce: number; allocationId: string }>;
  gapDetected: boolean;
}> => {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) FILTER (WHERE status = 'corrupted') as corrupted_count,
      COUNT(*) FILTER (WHERE allocated_at > NOW() - INTERVAL '${hoursBack} hours') as recent_count,
      MAX(end_nonce) as max_nonce,
      MIN(start_nonce) as min_nonce
    FROM nonce_allocations
    WHERE address = ${senderAddress}
  `);

  const stats = result.rows[0] as any;

  // Find orphaned allocations (no payouts mapped to them)
  const orphanedResult = await db.execute(sql`
    SELECT
      na.allocation_id,
      na.start_nonce,
      na.end_nonce,
      COUNT(rp.id) as payout_count,
      na.status,
      na.allocated_at
    FROM nonce_allocations na
    LEFT JOIN referral_payouts rp
      ON rp.allocation_id = na.allocation_id
    WHERE na.address = ${senderAddress}
      AND na.allocated_at > NOW() - INTERVAL '${hoursBack} hours'
    GROUP BY na.id
    HAVING COUNT(rp.id) = 0 OR na.status = 'failed'
    ORDER BY na.allocated_at DESC
  `);

  const orphanedRanges = orphanedResult.rows as any[];

  // Check for gaps in nonce sequence
  const gapResult = await db.execute(sql`
    WITH consecutive_ranges AS (
      SELECT
        allocation_id,
        start_nonce,
        end_nonce,
        LAG(end_nonce) OVER (ORDER BY start_nonce) as prev_end_nonce
      FROM nonce_allocations
      WHERE address = ${senderAddress}
        AND status IN ('completed', 'corrupted')
      ORDER BY start_nonce
    )
    SELECT
      COUNT(*) FILTER (WHERE start_nonce > prev_end_nonce + 1) as gap_count
    FROM consecutive_ranges
    WHERE prev_end_nonce IS NOT NULL
  `);

  const gapDetected = parseInt((gapResult.rows[0] as any).gap_count || 0) > 0;

  return {
    totalAllocations: stats.recent_count || 0,
    activeAllocations: stats.active_count || 0,
    completedAllocations: stats.completed_count || 0,
    failedAllocations: stats.failed_count || 0,
    corruptedAllocations: stats.corrupted_count || 0,
    orphanedRanges: orphanedRanges.map(r => ({
      startNonce: r.start_nonce,
      endNonce: r.end_nonce,
      allocationId: r.allocation_id
    })),
    gapDetected
  };
};

/**
 * Recover from nonce sequence corruption
 * CAUTION: Manual operation, verify before executing
 */
export const repairNonceSequence = async (
  senderAddress: string,
  lastConfirmedNonce: number
): Promise<{ success: boolean; newStartNonce: number; message: string }> => {
  logger.warn('⚠️ NONCE SEQUENCE REPAIR INITIATED', {
    senderAddress,
    lastConfirmedNonce,
    timestamp: new Date().toISOString()
  });

  try {
    // Mark all active allocations as failed
    await db.execute(sql`
      UPDATE nonce_allocations
      SET status = 'failed',
          failure_reason = 'Manual repair: Resetting sequence from ' || ${lastConfirmedNonce}
      WHERE address = ${senderAddress}
        AND status = 'active'
    `);

    // Rebase all future allocations to start from lastConfirmedNonce + 1
    const rebaseResult = await db.execute(sql`
      UPDATE nonce_allocations
      SET start_nonce = ${lastConfirmedNonce + 1},
          end_nonce = ${lastConfirmedNonce + 1} + (end_nonce - start_nonce),
          failure_reason = 'Rebased from ' || start_nonce || ' to ' || ${lastConfirmedNonce + 1}
      WHERE address = ${senderAddress}
        AND status IN ('failed', 'orphaned')
      RETURNING start_nonce, end_nonce
    `);

    logger.info('Nonce sequence repaired', {
      senderAddress,
      rebasedAllocations: rebaseResult.rows.length,
      newStartNonce: lastConfirmedNonce + 1
    });

    return {
      success: true,
      newStartNonce: lastConfirmedNonce + 1,
      message: `Sequence repaired. New allocations will start from nonce ${lastConfirmedNonce + 1}`
    };
  } catch (err) {
    logger.error('Nonce sequence repair failed', {
      senderAddress,
      error: err instanceof Error ? err.message : String(err)
    });

    return {
      success: false,
      newStartNonce: 0,
      message: `Repair failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

export default {
  allocateNonceBatch,
  verifyNonceUsage,
  getNonceAllocationAudit,
  repairNonceSequence
};
