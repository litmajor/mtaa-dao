import { redis } from './redis';
import { logger } from '../utils/logger';

export interface PendingAction {
  token: string;
  userId: string;
  daoId?: string;
  actionType: string;
  payload: any;
  summary?: string;
  createdAt: string;
}

class PendingActionService {
  private prefix = 'pending:action:';

  async createPendingAction(data: { userId: string; daoId?: string; actionType: string; payload: any; summary?: string; expiresIn?: number }) {
    const token = (globalThis.crypto && (globalThis.crypto as any).randomUUID) ? (globalThis.crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const entry: PendingAction = {
      token,
      userId: data.userId,
      daoId: data.daoId,
      actionType: data.actionType,
      payload: data.payload,
      summary: data.summary || '',
      createdAt: new Date().toISOString()
    };

    try {
      await redis.set(`${this.prefix}${token}`, JSON.stringify(entry), data.expiresIn || 3600);
      logger.info('[PendingAction] Created', { token, userId: data.userId, actionType: data.actionType });
      return token;
    } catch (error) {
      logger.error('[PendingAction] Failed to create pending action:', (error as Error).message);
      throw error;
    }
  }

  async getPendingAction(token: string): Promise<PendingAction | null> {
    try {
      const raw = await redis.get(`${this.prefix}${token}`);
      if (!raw) return null;
      return JSON.parse(raw) as PendingAction;
    } catch (error) {
      logger.error('[PendingAction] Failed to fetch pending action:', (error as Error).message);
      return null;
    }
  }

  async consumePendingAction(token: string): Promise<PendingAction | null> {
    const key = `${this.prefix}${token}`;
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      await redis.del(key);
      return JSON.parse(raw) as PendingAction;
    } catch (error) {
      logger.error('[PendingAction] Failed to consume pending action:', (error as Error).message);
      return null;
    }
  }
}

export const pendingActionService = new PendingActionService();
