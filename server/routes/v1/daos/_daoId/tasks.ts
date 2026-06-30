/**
 * V1 DAO Tasks Router
 *
 * Endpoints:
 * - GET    /api/v1/daos/:daoId/tasks             — list tasks (all members)
 * - POST   /api/v1/daos/:daoId/tasks             — create task (admin/elder)
 * - GET    /api/v1/daos/:daoId/tasks/:taskId     — get task detail (all members)
 * - PATCH  /api/v1/daos/:daoId/tasks/:taskId/claim   — claim task (any member)
 * - PATCH  /api/v1/daos/:daoId/tasks/:taskId/verify  — verify completion (admin/elder)
 * - PATCH  /api/v1/daos/:daoId/tasks/:taskId/cancel  — cancel task (admin/elder)
 *
 * Security: authenticate + daoMembershipGuard via parent router (index.ts)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { rateLimitPerUser } from '../../../../middleware/rateLimit';
import { treasuryAdminGuard } from './treasury/security';
import { logConsolidatedAuditEvent } from '../../../../services/auditConsolidated';
import { db } from '../../../../db';
import { eq, and, desc } from 'drizzle-orm';
import { daoTasks } from '@shared/schema';

const router = express.Router({ mergeParams: true });

/**
 * GET /api/v1/daos/:daoId/tasks
 * List all tasks for a DAO with optional status filter
 */
router.get(
  '/',
  rateLimitPerUser('dao-tasks-list', 60, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const { status, category } = req.query;

      let filters: any[] = [eq(daoTasks.daoId, daoId)];
      
      if (status && status !== 'all') {
        filters.push(eq(daoTasks.status, status as string));
      }
      if (category) {
        filters.push(eq(daoTasks.category, category as string));
      }

      const tasks = await db.select()
        .from(daoTasks)
        .where(and(...filters))
        .orderBy(desc(daoTasks.createdAt));

      const formattedTasks = tasks.map(t => ({
        ...t,
        reward: Number(t.reward),
      }));

      // Sort: open first, then claimed, then completed
      const order: Record<string, number> = { open: 0, claimed: 1, completed: 2, cancelled: 3 };
      formattedTasks.sort((a, b) => (order[a.status || 'open'] ?? 9) - (order[b.status || 'open'] ?? 9));

      res.json({
        success: true,
        daoId,
        count: formattedTasks.length,
        tasks: formattedTasks,
      });
    } catch (error) {
      console.error('DAO tasks list error:', error);
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  }
);

/**
 * POST /api/v1/daos/:daoId/tasks
 * Create a new task — admin/elder only
 */
router.post(
  '/',
  treasuryAdminGuard,
  rateLimitPerUser('dao-tasks-create', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const {
        title,
        description,
        reward = 0,
        difficulty = 'medium',
        category = 'General',
        estimatedTime,
        deadline,
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Task title is required' });
      }

      const [task] = await db.insert(daoTasks).values({
        id: randomUUID(),
        daoId,
        title,
        description: description || '',
        reward: String(reward),
        difficulty,
        category,
        estimatedTime: estimatedTime || null,
        deadline: deadline ? new Date(deadline) : null,
        status: 'open',
        createdBy: userId,
      }).returning();

      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'dao_task_created',
        severity: 'low',
        details: { taskId: task.id, title, reward, difficulty, category },
      } as any);

      res.status(201).json({ success: true, task });
    } catch (error) {
      console.error('DAO task creation error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

/**
 * GET /api/v1/daos/:daoId/tasks/:taskId
 * Get a single task detail
 */
router.get(
  '/:taskId',
  rateLimitPerUser('dao-tasks-get', 60, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, taskId } = req.params;
      
      const [task] = await db.select()
        .from(daoTasks)
        .where(and(eq(daoTasks.id, taskId), eq(daoTasks.daoId, daoId)))
        .limit(1);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ success: true, task: { ...task, reward: Number(task.reward) } });
    } catch (error) {
      console.error('DAO task fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  }
);

/**
 * PATCH /api/v1/daos/:daoId/tasks/:taskId/claim
 * Member claims an open task
 */
router.patch(
  '/:taskId/claim',
  rateLimitPerUser('dao-tasks-claim', 5, '5min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;

      const [task] = await db.select()
        .from(daoTasks)
        .where(and(eq(daoTasks.id, taskId), eq(daoTasks.daoId, daoId)))
        .limit(1);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status !== 'open') {
        return res.status(409).json({ error: `Task is already ${task.status}` });
      }

      const [updatedTask] = await db.update(daoTasks)
        .set({
          status: 'claimed',
          claimer: userId,
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(daoTasks.id, taskId))
        .returning();

      res.json({ success: true, task: updatedTask });
    } catch (error) {
      console.error('DAO task claim error:', error);
      res.status(500).json({ error: 'Failed to claim task' });
    }
  }
);

/**
 * PATCH /api/v1/daos/:daoId/tasks/:taskId/verify
 * Admin/elder verifies task completion and releases reward
 */
router.patch(
  '/:taskId/verify',
  treasuryAdminGuard,
  rateLimitPerUser('dao-tasks-verify', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;

      const [task] = await db.select()
        .from(daoTasks)
        .where(and(eq(daoTasks.id, taskId), eq(daoTasks.daoId, daoId)))
        .limit(1);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status !== 'claimed') {
        return res.status(409).json({ error: 'Task must be claimed before verification' });
      }

      const [updatedTask] = await db.update(daoTasks)
        .set({
          status: 'completed',
          verifiedBy: userId,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(daoTasks.id, taskId))
        .returning();

      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'dao_task_verified',
        severity: 'medium',
        details: { taskId, claimer: task.claimer, reward: task.reward },
      } as any);

      res.json({ success: true, task: updatedTask });
    } catch (error) {
      console.error('DAO task verify error:', error);
      res.status(500).json({ error: 'Failed to verify task' });
    }
  }
);

/**
 * PATCH /api/v1/daos/:daoId/tasks/:taskId/cancel
 * Admin/elder cancels a task
 */
router.patch(
  '/:taskId/cancel',
  treasuryAdminGuard,
  rateLimitPerUser('dao-tasks-cancel', 10, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, taskId } = req.params;
      const userId = (req as any).user?.id;

      const [task] = await db.select()
        .from(daoTasks)
        .where(and(eq(daoTasks.id, taskId), eq(daoTasks.daoId, daoId)))
        .limit(1);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status === 'completed') {
        return res.status(409).json({ error: 'Cannot cancel a completed task' });
      }

      const [updatedTask] = await db.update(daoTasks)
        .set({
          status: 'cancelled',
          cancelledBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(daoTasks.id, taskId))
        .returning();

      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'dao_task_cancelled',
        severity: 'low',
        details: { taskId },
      } as any);

      res.json({ success: true, task: updatedTask });
    } catch (error) {
      console.error('DAO task cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel task' });
    }
  }
);

export default router;
