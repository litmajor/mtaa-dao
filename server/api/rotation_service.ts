import { Request, Response } from 'express';
import { db } from '../db';
import { daos, daoMemberships, daoRotationCycles } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { evaluateRotationRules, formatRuleRejectionMessage, logRuleEvaluation } from '../services/rules-integration';
import { distributeToRecipientOnChain } from '../services/rotation_contract';

const logger = new Logger('rotation-service');

// In-process locks to avoid concurrent rotations for the same DAO
const rotationLocks: Map<string, boolean> = new Map();

export enum RotationSelectionMethod {
  SEQUENTIAL = 'sequential',        // Predetermined order
  LOTTERY = 'lottery',              // Random selection
  PROPORTIONAL = 'proportional'     // Based on contributions
}

export interface RotationRecipient {
  userId: string;
  cycleNumber: number;
  amountToReceive: number;
  distributedAt?: Date;
}

/**
 * Get all members eligible for rotation
 */
async function getRotationEligibleMembers(daoId: string) {
  try {
    const members = await db
      .select()
      .from(daoMemberships)
      .where(
        and(
          eq(daoMemberships.daoId, daoId),
          eq(daoMemberships.status, 'approved'),
          eq(daoMemberships.isBanned, false)
        )
      );
    
    logger.info(`Found ${members.length} eligible members for rotation in DAO ${daoId}`);
    return members;
  } catch (err) {
    logger.error(`Error getting rotation eligible members: ${err}`);
    throw err;
  }
}

/**
 * Select next rotation recipient based on method
 */
export async function selectRotationRecipient(
  daoId: string,
  rotationMethod: RotationSelectionMethod
): Promise<string> {
  try {
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .then(rows => rows[0]);
    
    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const members = await getRotationEligibleMembers(daoId);
    
    if (members.length === 0) {
      throw new Error('No eligible members for rotation');
    }

    let selectedMember;

    switch (rotationMethod) {
      case RotationSelectionMethod.SEQUENTIAL:
        selectedMember = await selectSequential(daoId, members, dao.currentRotationCycle || 0);
        break;
      
      case RotationSelectionMethod.LOTTERY:
        selectedMember = selectLottery(members);
        break;
      
      case RotationSelectionMethod.PROPORTIONAL:
        selectedMember = await selectProportional(daoId, members);
        break;
      
      default:
        selectedMember = members[0]; // Fallback to first member
    }

    logger.info(`Selected ${selectedMember.userId} for rotation cycle ${dao.currentRotationCycle}`);
    return selectedMember.userId;
  } catch (err) {
    logger.error(`Error selecting rotation recipient: ${err}`);
    throw err;
  }
}

/**
 * Sequential: Predetermined order based on join date or cycle number
 */
async function selectSequential(daoId: string, members: any[], cycleNumber: number) {
  // Sort by join date to ensure consistent order
  const sorted = members.sort((a, b) => 
    new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );
  
  // Use modulo to cycle through members
  const index = cycleNumber % sorted.length;
  return sorted[index];
}

/**
 * Lottery: Random selection with weighted probability
 */
function selectLottery(members: any[]) {
  const randomIndex = Math.floor(Math.random() * members.length);
  return members[randomIndex];
}

/**
 * Proportional: Based on total contributions using ContributionAnalyzer
 * 
 * Selects members with higher contribution weights having higher probability
 * This ensures fair compensation proportional to contribution effort
 */
async function selectProportional(daoId: string, members: any[]) {
  try {
    // Import analyzer at runtime to avoid circular dependencies
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();
    
    // Get contribution weights for each member (90-day history)
    const memberIds = members.map(m => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');
    
    // Calculate total weight
    const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + (b as number), 0);
    
    if (totalWeight === 0) {
      // Fallback to random if no contribution data
      const randomIndex = Math.floor(Math.random() * members.length);
      return members[randomIndex];
    }
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const member of members) {
      const memberId = member.userId || member.id;
      const weight = weights[memberId] || 1;
      random -= weight;
      
      if (random <= 0) {
        return member;
      }
    }
    
    // Fallback to last member
    return members[members.length - 1];
  } catch (error) {
    console.error('Error in selectProportional, falling back to random:', error);
    // Fallback to random selection on error
    const randomIndex = Math.floor(Math.random() * members.length);
    return members[randomIndex];
  }
}

/**
 * Process rotation for a DAO
 * This distributes funds to the selected recipient
 */
export async function processRotation(daoId: string) {
  try {
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .then(rows => rows[0]);
    
    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    if (dao.durationModel !== 'rotation') {
      throw new Error('DAO does not use rotation model');
    }

    // Attempt to acquire a DB-backed lock to prevent cross-instance races
    // Also keep an in-process lock to avoid duplicate work in this process
    if (rotationLocks.get(daoId)) {
      logger.warn(`Rotation already in progress for DAO ${daoId} (in-process)`);
      return { status: 'skipped', reason: 'Rotation already in progress' };
    }

    rotationLocks.set(daoId, true);

    let acquiredDbLock = false;
    try {
      const updated = await db
        .update(daos)
        .set({ rotationProcessing: true, updatedAt: new Date() })
        .where(and(eq(daos.id, daoId), eq(daos.rotationProcessing, false)))
        .returning();

      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        logger.warn(`Rotation already in progress for DAO ${daoId} (db-locked)`);
        rotationLocks.delete(daoId);
        return { status: 'skipped', reason: 'Rotation already in progress (db lock)' };
      }

      acquiredDbLock = true;
    } catch (e) {
      // If lock acquisition fails for any reason, release in-process lock and abort
      rotationLocks.delete(daoId);
      throw e;
    }

    // Check if it's time for rotation
    if (!dao.nextRotationDate || new Date() < new Date(dao.nextRotationDate)) {
      logger.info(`Not yet time for rotation. Next rotation: ${dao.nextRotationDate}`);
      return { status: 'skipped', reason: 'Not yet time for rotation' };
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const recipientUserId = await selectRotationRecipient(daoId, selectionMethod);

    // Evaluate rotation rules before distributing funds
    const ruleResult = await evaluateRotationRules(daoId, {
      nextLeader: recipientUserId,
      rotationFrequency: dao.rotationFrequency || 'monthly',
      rotationDate: new Date(),
    });

    if (!ruleResult.approved) {
      logger.warn(`Rotation rejected by rules: recipient ${recipientUserId} - ${formatRuleRejectionMessage(ruleResult.results)}`);
      logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);
      return { 
        status: 'rejected', 
        reason: formatRuleRejectionMessage(ruleResult.results),
        rules: ruleResult.results 
      };
    }

    // Calculate amount to distribute (total treasury balance) using BigInt for safety
    // Prefer new integer smallest-unit column when available
    const treasuryRaw = (dao.treasuryBalanceUnits?.toString()) || dao.treasuryBalance?.toString() || '0';

    // Reject floating-point balances: require integer smallest-unit representation
    if (treasuryRaw.includes('.')) {
      logger.error(`Treasury balance contains a decimal value for DAO ${daoId}. Use integer smallest-unit strings (e.g. wei). Value: ${treasuryRaw}`);
      return { status: 'error', reason: 'Treasury balance must be integer smallest-unit string' };
    }

    let treasuryBalanceBig: bigint;
    try {
      treasuryBalanceBig = BigInt(treasuryRaw || '0');
    } catch (e) {
      logger.error(`Failed to parse treasury balance as BigInt for DAO ${daoId}: ${treasuryRaw}`);
      throw e;
    }

    if (treasuryBalanceBig <= BigInt(0)) {
      logger.warn(`DAO has no treasury balance for rotation: ${daoId}`);
      return { status: 'skipped', reason: 'No treasury balance' };
    }

    // Wrap DB changes in a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Re-read DAO inside transaction and verify balance and nextRotationDate
      const daoTx = await tx
        .select()
        .from(daos)
        .where(eq(daos.id, daoId))
        .then(rows => rows[0]);

      if (!daoTx) throw new Error(`DAO not found in transaction: ${daoId}`);

      const treasuryTxRaw = (daoTx.treasuryBalanceUnits?.toString()) || daoTx.treasuryBalance?.toString() || '0';
      if (treasuryTxRaw !== treasuryRaw) {
        throw new Error('Treasury balance changed since processing started; aborting rotation');
      }

      const cycleNumber = (daoTx.currentRotationCycle || 0) + 1;

      const [cycle] = await tx
        .insert(daoRotationCycles)
        .values({
          daoId: daoId,
          cycleNumber: cycleNumber,
          recipientUserId: recipientUserId,
          status: 'pending',
          startDate: daoTx.nextRotationDate ?? new Date(),
          endDate: new Date(),
          amountDistributed: treasuryBalanceBig.toString(),
          notes: `Automatic rotation distribution - ${selectionMethod} method`
        })
        .returning();

      const nextRotationDate = calculateNextRotationDate(
        new Date(),
        daoTx.rotationFrequency || 'monthly'
      );

      await tx
        .update(daos)
        .set({
          currentRotationCycle: cycleNumber,
          nextRotationDate: nextRotationDate,
          updatedAt: new Date()
        })
        .where(eq(daos.id, daoId));

      return { cycleNumber, nextRotationDate, cycleId: cycle.id };
    });
    // Dispatch on-chain call asynchronously and reconcile DB on success/failure
    (async () => {
      try {
        const vaultAddress = dao.vaultAddress || dao.chamaTreasuryAddress || '';
        if (!vaultAddress) {
          logger.warn(`No vault address configured for DAO ${daoId}; cannot dispatch on-chain`);
          await db.update(daoRotationCycles).set({ status: 'failed', updatedAt: new Date(), notes: 'No vault address configured' }).where(eq(daoRotationCycles.id, result.cycleId));
          return;
        }

        const onchainResult = await distributeToRecipientOnChain(vaultAddress);
        logger.info(`On-chain distribution tx: ${onchainResult.txHash} @ block ${onchainResult.blockNumber}`);

        // On success: clear treasury and mark cycle completed
        await db.transaction(async (tx) => {
          await tx.update(daoRotationCycles).set({ status: 'completed', transactionHash: onchainResult.txHash, distributedAt: new Date(), updatedAt: new Date() }).where(eq(daoRotationCycles.id, result.cycleId));
          await tx.update(daos).set({ treasuryBalance: '0', treasuryBalanceUnits: '0', updatedAt: new Date() }).where(eq(daos.id, daoId));
        });
      } catch (err: any) {
        logger.error(`Failed to dispatch on-chain rotation for DAO ${daoId}: ${err}`);
        try {
          await db.update(daoRotationCycles).set({ status: 'failed', updatedAt: new Date(), notes: `on-chain error: ${err?.message || String(err)}` }).where(eq(daoRotationCycles.id, result.cycleId));
        } catch (uerr) {
          logger.error('Failed to mark rotation cycle as failed in DB:', uerr);
        }
      }
    })();

    logger.info(`Rotation processed for DAO ${daoId}: Cycle ${result.cycleNumber}, Recipient: ${recipientUserId}, Amount: ${treasuryBalanceBig.toString()}`);
    logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);

    return {
      status: 'completed',
      cycleNumber: result.cycleNumber,
      recipientUserId,
      amountDistributed: treasuryBalanceBig.toString(),
      nextRotationDate: result.nextRotationDate
    };
  } catch (err) {
    logger.error(`Error processing rotation: ${err}`);
    throw err;
  }
  finally {
    try {
      // Release DB lock if acquired
      await db
        .update(daos)
        .set({ rotationProcessing: false, updatedAt: new Date() })
        .where(eq(daos.id, daoId));
    } catch (e) {
      logger.warn(`Failed to clear DB rotation lock for DAO ${daoId}: ${e}`);
    }

    // Release in-process lock
    rotationLocks.delete(daoId);
  }
}

/**
 * Get rotation status for a DAO
 */
export async function getRotationStatus(daoId: string) {
  try {
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .then(rows => rows[0]);

    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const cycles = await db
      .select()
      .from(daoRotationCycles)
      .where(eq(daoRotationCycles.daoId, daoId))
      .orderBy(daoRotationCycles.cycleNumber);

    const members = await getRotationEligibleMembers(daoId);

    return {
      daoId,
      daoType: dao.daoType,
      durationModel: dao.durationModel,
      rotationFrequency: dao.rotationFrequency,
      selectionMethod: dao.rotationSelectionMethod,
      currentCycle: dao.currentRotationCycle || 0,
      totalCycles: dao.totalRotationCycles,
      nextRotationDate: dao.nextRotationDate,
      treasuryBalance: dao.treasuryBalance,
      totalMembers: members.length,
      cycleHistory: cycles.map(c => ({
        cycleNumber: c.cycleNumber,
        recipient: c.recipientUserId,
        amountDistributed: c.amountDistributed,
        status: c.status,
        distributedAt: c.distributedAt
      }))
    };
  } catch (err) {
    logger.error(`Error getting rotation status: ${err}`);
    throw err;
  }
}

/**
 * Calculate next rotation date based on frequency
 */
function calculateNextRotationDate(from: Date, frequency: string): Date {
  const next = new Date(from);
  
  switch (frequency.toLowerCase()) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'bi-weekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }
  
  return next;
}

/**
 * Handler: GET /api/dao/:daoId/rotation/status
 */
export async function getRotationStatusHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const status = await getRotationStatus(daoId);
    res.json(status);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get rotation status' });
  }
}

/**
 * Handler: POST /api/dao/:daoId/rotation/process
 * Admin/scheduled endpoint to trigger rotation
 */
export async function processRotationHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const result = await processRotation(daoId);
    res.json(result);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to process rotation' });
  }
}

/**
 * Handler: GET /api/dao/:daoId/rotation/next-recipient
 * Preview who will receive next rotation
 */
export async function getNextRecipientHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    
    const dao = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .then(rows => rows[0]);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const nextRecipientId = await selectRotationRecipient(daoId, selectionMethod);
    
    const recipient = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, nextRecipientId))
      .then(rows => rows[0]);

    res.json({
      nextRecipient: nextRecipientId,
      cycleNumber: (dao.currentRotationCycle || 0) + 1,
      estimatedDistributionDate: dao.nextRotationDate,
      estimatedAmount: dao.treasuryBalance,
      memberInfo: {
        role: recipient?.role,
        joinedAt: recipient?.joinedAt
      }
    });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    res.status(500).json({ error: 'Failed to get next recipient' });
  }
}
