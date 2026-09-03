import type { Request, Response } from 'express';
import { db } from '../db';
import { daos, daoMemberships, daoRotationCycles, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { evaluateRotationRules, formatRuleRejectionMessage, logRuleEvaluation } from '../services/rules-integration';
import {
  distributeToRecipientOnChain,
  initializeRotationOnChain,
  recordContributionOnChain,
} from '../services/rotation_contract';

const logger = new Logger('rotation-service');

// In-process lock map
const rotationLocks: Map<string, boolean> = new Map();

export enum RotationSelectionMethod {
  SEQUENTIAL = 'sequential',
  LOTTERY = 'lottery',
  PROPORTIONAL = 'proportional',
}

export interface RotationRecipient {
  userId: string;
  cycleNumber: number;
  amountToReceive: string;
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
 * Select next rotation recipient based on configured method
 */
export async function selectRotationRecipient(
  daoId: string,
  rotationMethod: RotationSelectionMethod
): Promise<string> {
  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

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
        selectedMember = selectSequential(members, dao.currentRotationCycle || 0);
        break;

      case RotationSelectionMethod.LOTTERY:
        selectedMember = selectLottery(members);
        break;

      case RotationSelectionMethod.PROPORTIONAL:
        selectedMember = await selectProportional(daoId, members);
        break;

      default:
        selectedMember = members[0];
    }

    logger.info(`Selected ${selectedMember.userId} for rotation cycle ${dao.currentRotationCycle || 0}`);
    return selectedMember.userId;
  } catch (err) {
    logger.error(`Error selecting rotation recipient: ${err}`);
    throw err;
  }
}

/**
 * Sequential: Order by join date (immutably)
 */
function selectSequential(members: any[], cycleNumber: number) {
  // Immutably copy array before sorting
  const sorted = [...members].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  const index = cycleNumber % sorted.length;
  return sorted[index];
}

/**
 * Lottery: Random selection
 */
function selectLottery(members: any[]) {
  const randomIndex = Math.floor(Math.random() * members.length);
  return members[randomIndex];
}

/**
 * Proportional: Weighted random selection based on past contributions
 */
async function selectProportional(daoId: string, members: any[]) {
  try {
    const { ContributionAnalyzer } = await import('../core/nuru/analytics/contribution_analyzer');
    const analyzer = new ContributionAnalyzer();

    const memberIds = members.map((m) => m.userId || m.id);
    const weights = await analyzer.getContributionWeights(daoId, memberIds, '90d');

    const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + Number(b || 0), 0);

    if (totalWeight === 0) {
      return selectLottery(members);
    }

    let random = Math.random() * totalWeight;
    for (const member of members) {
      const memberId = member.userId || member.id;
      const weight = weights[memberId] || 1;
      random -= weight;

      if (random <= 0) {
        return member;
      }
    }

    return members[members.length - 1];
  } catch (error) {
    logger.error('Error in selectProportional, falling back to random selection:', error);
    return selectLottery(members);
  }
}

/**
 * Process rotation and update state
 */
export async function processRotation(daoId: string) {
  let acquiredDbLock = false;

  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      throw new Error(`DAO not found: ${daoId}`);
    }

    if (dao.durationModel !== 'rotation') {
      throw new Error('DAO does not use rotation model');
    }

    // Acquire in-process memory lock
    if (rotationLocks.get(daoId)) {
      logger.warn(`Rotation already in progress for DAO ${daoId} (in-memory lock)`);
      return { status: 'skipped', reason: 'Rotation already in progress' };
    }

    rotationLocks.set(daoId, true);

    // Acquire atomic DB lock
    const updated = await db
      .update(daos)
      .set({ rotationProcessing: true, updatedAt: new Date() })
      .where(and(eq(daos.id, daoId), eq(daos.rotationProcessing, false)))
      .returning();

    if (!updated || updated.length === 0) {
      logger.warn(`Rotation already in progress for DAO ${daoId} (database lock)`);
      rotationLocks.delete(daoId);
      return { status: 'skipped', reason: 'Rotation already in progress (db lock)' };
    }

    acquiredDbLock = true;

    // Verify rotation timing eligibility
    if (!dao.nextRotationDate || new Date() < new Date(dao.nextRotationDate)) {
      logger.info(`Not yet time for rotation. Next rotation: ${dao.nextRotationDate}`);
      return { status: 'skipped', reason: 'Not yet time for rotation' };
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const recipientUserId = await selectRotationRecipient(daoId, selectionMethod);

    // Evaluate business rules
    const ruleResult = await evaluateRotationRules(daoId, {
      nextLeader: recipientUserId,
      rotationFrequency: dao.rotationFrequency || 'monthly',
      rotationDate: new Date(),
    });

    if (!ruleResult.approved) {
      const reason = formatRuleRejectionMessage(ruleResult.results);
      logger.warn(`Rotation rejected by rules for DAO ${daoId}: ${reason}`);
      logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);
      return { status: 'rejected', reason, rules: ruleResult.results };
    }

    // Validate treasury units
    const treasuryRaw = (dao.treasuryBalanceUnits?.toString()) || dao.treasuryBalance?.toString() || '0';

    if (treasuryRaw.includes('.')) {
      logger.error(`Treasury balance contains decimal for DAO ${daoId}: ${treasuryRaw}`);
      return { status: 'error', reason: 'Treasury balance must be integer smallest-unit string' };
    }

    const treasuryBalanceBig = BigInt(treasuryRaw);

    if (treasuryBalanceBig <= BigInt(0)) {
      logger.warn(`DAO has no treasury balance for rotation: ${daoId}`);
      return { status: 'skipped', reason: 'No treasury balance' };
    }

    // Execute atomic cycle insertion & DAO schedule updates inside SQL transaction
    const result = await db.transaction(async (tx) => {
      const [daoTx] = await tx
        .select()
        .from(daos)
        .where(eq(daos.id, daoId))
        .limit(1);

      if (!daoTx) throw new Error(`DAO not found in transaction: ${daoId}`);

      const cycleNumber = (daoTx.currentRotationCycle || 0) + 1;

      const [cycle] = await tx
        .insert(daoRotationCycles)
        .values({
          daoId,
          cycleNumber,
          recipientUserId,
          status: 'pending',
          startDate: daoTx.nextRotationDate ?? new Date(),
          endDate: new Date(),
          amountDistributed: treasuryBalanceBig.toString(),
          notes: `Automatic rotation distribution - ${selectionMethod} method`,
        })
        .returning();

      const nextRotationDate = calculateNextRotationDate(new Date(), daoTx.rotationFrequency || 'monthly');

      await tx
        .update(daos)
        .set({
          currentRotationCycle: cycleNumber,
          nextRotationDate,
          updatedAt: new Date(),
        })
        .where(eq(daos.id, daoId));

      return { cycleNumber, nextRotationDate, cycleId: cycle.id };
    });

    // Execute on-chain payout
    const vaultAddress = dao.vaultAddress || dao.chamaTreasuryAddress || '';
    if (!vaultAddress) {
      await db
        .update(daoRotationCycles)
        .set({ status: 'failed', updatedAt: new Date(), notes: 'No vault address configured' })
        .where(eq(daoRotationCycles.id, result.cycleId));

      return { status: 'error', reason: 'No vault address configured' };
    }

    try {
      const onchainResult = await distributeToRecipientOnChain(vaultAddress);
      logger.info(`On-chain payout success: tx ${onchainResult.txHash} @ block ${onchainResult.blockNumber}`);

      await db.transaction(async (tx) => {
        await tx
          .update(daoRotationCycles)
          .set({
            status: 'completed',
            transactionHash: onchainResult.txHash,
            distributedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(daoRotationCycles.id, result.cycleId));

        await tx
          .update(daos)
          .set({ treasuryBalance: '0', treasuryBalanceUnits: '0', updatedAt: new Date() })
          .where(eq(daos.id, daoId));
      });
    } catch (err: any) {
      logger.error(`Failed to dispatch on-chain rotation for DAO ${daoId}: ${err}`);
      await db
        .update(daoRotationCycles)
        .set({ status: 'failed', updatedAt: new Date(), notes: `on-chain error: ${err?.message || String(err)}` })
        .where(eq(daoRotationCycles.id, result.cycleId));

      throw err;
    }

    logger.info(`Rotation completed for DAO ${daoId}: Cycle ${result.cycleNumber}, Recipient: ${recipientUserId}`);
    logRuleEvaluation(daoId, 'rotation', recipientUserId, ruleResult.results);

    return {
      status: 'completed',
      cycleNumber: result.cycleNumber,
      recipientUserId,
      amountDistributed: treasuryBalanceBig.toString(),
      nextRotationDate: result.nextRotationDate,
    };
  } catch (err) {
    logger.error(`Error processing rotation for DAO ${daoId}: ${err}`);
    throw err;
  } finally {
    if (acquiredDbLock) {
      try {
        await db
          .update(daos)
          .set({ rotationProcessing: false, updatedAt: new Date() })
          .where(eq(daos.id, daoId));
      } catch (e) {
        logger.warn(`Failed to release DB rotation lock for DAO ${daoId}: ${e}`);
      }
    }
    rotationLocks.delete(daoId);
  }
}

/**
 * Get rotation status for a DAO
 */
export async function getRotationStatus(daoId: string) {
  try {
    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

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
      cycleHistory: cycles.map((c) => ({
        cycleNumber: c.cycleNumber,
        recipient: c.recipientUserId,
        amountDistributed: c.amountDistributed,
        status: c.status,
        distributedAt: c.distributedAt,
      })),
    };
  } catch (err) {
    logger.error(`Error getting rotation status: ${err}`);
    throw err;
  }
}

/**
 * Calculate next rotation date based on frequency string
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
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

export async function getRotationStatusHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const status = await getRotationStatus(daoId);
    return res.json(status);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to get rotation status' });
  }
}

export async function processRotationHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;
    const result = await processRotation(daoId);
    return res.json(result);
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to process rotation' });
  }
}

export async function getNextRecipientHandler(req: Request, res: Response) {
  try {
    const { daoId } = req.params;

    const [dao] = await db
      .select()
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const nextRecipientId = await selectRotationRecipient(daoId, selectionMethod);

    const [recipient] = await db
      .select()
      .from(daoMemberships)
      .where(eq(daoMemberships.userId, nextRecipientId))
      .limit(1);

    return res.json({
      nextRecipient: nextRecipientId,
      cycleNumber: (dao.currentRotationCycle || 0) + 1,
      estimatedDistributionDate: dao.nextRotationDate,
      estimatedAmount: dao.treasuryBalance,
      memberInfo: {
        role: recipient?.role,
        joinedAt: recipient?.joinedAt,
      },
    });
  } catch (err) {
    logger.error(`Handler error: ${err}`);
    return res.status(500).json({ error: 'Failed to get next recipient' });
  }
}

export function getRotationMemberId(userId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(userId));
}

export async function getRotationMemberBindings(daoId: string) {
  const members = await getRotationEligibleMembers(daoId);
  const bindings = await Promise.all(members.map(async (member) => {
    const [user] = await db
      .select({ id: users.id, walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, member.userId))
      .limit(1);

    if (!user?.walletAddress) {
      throw new Error(`Rotation member ${member.userId} has no wallet address`);
    }

    return {
      userId: member.userId,
      memberId: getRotationMemberId(member.userId),
      address: user.walletAddress,
    };
  }));

  return bindings;
}

export async function initializeRotationForDao(
  daoId: string,
  options: {
    vaultAddress: string;
    monthlyContribution: bigint | string | number;
    minimumParticipationBps: bigint | string | number;
    chamaTreasury: string;
    stablecoin: string;
  }
) {
  const [dao] = await db.select().from(daos).where(eq(daos.id, daoId)).limit(1);
  if (!dao) throw new Error(`DAO not found: ${daoId}`);

  const bindings = await getRotationMemberBindings(daoId);
  const result = await initializeRotationOnChain({
    ...options,
    memberIds: bindings.map((binding) => binding.memberId),
    memberAddresses: bindings.map((binding) => binding.address),
    selectionMethod: 0,
  });

  return { daoId, bindings, result };
}

export function recordRotationContribution(
  vaultAddress: string,
  userId: string,
  amount: bigint | string | number
) {
  return recordContributionOnChain(vaultAddress, getRotationMemberId(userId), amount);
}