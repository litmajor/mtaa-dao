import { Request, Response } from 'express';
import { db } from '../db';
import { daos, daoMemberships, daoRotationCycles } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('rotation-service');

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
 * Proportional: Based on total contributions (future implementation)
 * For now, defaults to equal probability
 */
async function selectProportional(daoId: string, members: any[]) {
  // TODO: Calculate contribution amounts from payment history
  // For MVP, treat as equal probability
  const randomIndex = Math.floor(Math.random() * members.length);
  return members[randomIndex];
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

    // Check if it's time for rotation
    if (!dao.nextRotationDate || new Date() < new Date(dao.nextRotationDate)) {
      logger.info(`Not yet time for rotation. Next rotation: ${dao.nextRotationDate}`);
      return { status: 'skipped', reason: 'Not yet time for rotation' };
    }

    const selectionMethod = (dao.rotationSelectionMethod || 'sequential') as RotationSelectionMethod;
    const recipientUserId = await selectRotationRecipient(daoId, selectionMethod);

    // Calculate amount to distribute (total treasury balance)
    const treasuryBalance = parseFloat(dao.treasuryBalance?.toString() || '0');

    if (treasuryBalance <= 0) {
      logger.warn(`DAO has no treasury balance for rotation: ${daoId}`);
      return { status: 'skipped', reason: 'No treasury balance' };
    }

    // Create rotation cycle record
    const cycleNumber = (dao.currentRotationCycle || 0) + 1;
    
    const [cycle] = await db
      .insert(daoRotationCycles)
      .values({
        id: uuidv4(),
        daoId: daoId,
        cycleNumber: cycleNumber,
        recipientUserId: recipientUserId,
        status: 'completed',
        startDate: dao.nextRotationDate,
        endDate: new Date(),
        amountDistributed: treasuryBalance.toString(),
        distributedAt: new Date(),
        notes: `Automatic rotation distribution - ${selectionMethod} method`
      })
      .returning();

    // Update DAO to next rotation date and cycle
    const nextRotationDate = calculateNextRotationDate(
      new Date(),
      dao.rotationFrequency || 'monthly'
    );

    await db
      .update(daos)
      .set({
        currentRotationCycle: cycleNumber,
        nextRotationDate: nextRotationDate,
        treasuryBalance: '0', // Treasury depletes
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    logger.info(`Rotation processed for DAO ${daoId}: Cycle ${cycleNumber}, Recipient: ${recipientUserId}, Amount: ${treasuryBalance}`);

    return {
      status: 'completed',
      cycleNumber,
      recipientUserId,
      amountDistributed: treasuryBalance,
      nextRotationDate
    };
  } catch (err) {
    logger.error(`Error processing rotation: ${err}`);
    throw err;
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
