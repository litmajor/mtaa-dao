import { kwetu } from '../core/kwetu';
import { storage } from '../storage';
import { db } from '../db';
import { daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { pendingActionService } from './pendingActionService';
import { logger } from '../utils/logger';

class KwetuService {
  async safeExecuteAction(pendingActionToken: string, executingUserId: string) {
    // Consume pending action
    const pending = await pendingActionService.consumePendingAction(pendingActionToken);
    if (!pending) throw new Error('Pending action not found or expired');

    // Permission check: ensure user is member of DAO
    if (pending.daoId) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.daoId, pending.daoId),
            eq(daoMemberships.userId, executingUserId)
          )
        )
        .limit(1);

      if (!membership || membership.length === 0) {
        throw new Error('User lacks membership/permissions for this DAO');
      }
    }

    // Execute based on action type
    let result: any = null;
    try {
      switch (pending.actionType) {
        case 'create_proposal':
          result = await storage.createProposal({ ...pending.payload, createdAt: new Date(), updatedAt: new Date() });
          break;
        case 'cast_vote':
          result = await storage.createVote(pending.payload);
          break;
        case 'open_withdrawal':
        case 'withdraw':
          // Route to KWETU execution
          result = await kwetu.execute({ type: 'treasury', service: 'execution', method: 'executeOperation', params: { plan: pending.payload } } as any);
          break;
        default:
          throw new Error(`Unsupported action type: ${pending.actionType}`);
      }

      // Log audit
      try {
        await storage.createAuditLog({
          actor: executingUserId,
          daoId: pending.daoId,
          actionType: pending.actionType,
          payload: pending.payload,
          result,
          pendingActionToken: pending.token,
          timestamp: new Date()
        });
      } catch (e) {
        logger.warn('Failed to write audit log for pending action:', e);
      }

      return result;
    } catch (error) {
      // In case of failure, create audit record with error
      try {
        await storage.createAuditLog({
          actor: executingUserId,
          daoId: pending.daoId,
          actionType: pending.actionType,
          payload: pending.payload,
          error: (error as Error).message,
          pendingActionToken: pending.token,
          timestamp: new Date()
        });
      } catch (e) {
        logger.warn('Failed to write failed audit log for pending action:', e);
      }
      throw error;
    }
  }
}

export const kwetuService = new KwetuService();
