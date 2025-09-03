
import express from 'express';
import { db } from '../storage';
import { tasks, taskHistory, users, daoMemberships, walletTransactions } from '../../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Task creation schema
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  reward: z.number().positive('Reward must be positive'),
  daoId: z.string().min(1, 'DAO ID is required'),
  category: z.string().min(1, 'Category is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  estimatedTime: z.string().optional(),
  deadline: z.string().optional(),
  requiresVerification: z.boolean().default(false)
});

// Task verification schema
const verifyTaskSchema = z.object({
  proofUrl: z.string().url('Valid proof URL required'),
  description: z.string().min(10, 'Verification description required'),
  screenshots: z.array(z.string().url()).optional()
});

// Middleware for role checking
function requireRole(...roles: string[]) {
  return async (req: any, res: any, next: any) => {
    const userId = req.user.claims.sub;
    const daoId = req.params.daoId || req.body.daoId;
    
    if (daoId) {
      const membership = await db
        .select()
        .from(daoMemberships)
        .where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)));
      
      if (!membership.length || !roles.includes(membership[0].role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    next();
  };
}

// Create task (DAO admin/moderator only)
router.post('/create', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const userId = req.user.claims.sub;

    // Create task with escrow
    const task = await db.insert(tasks).values({
      ...validatedData,
      creatorId: userId,
      status: 'open'
    }).returning();

    // Log task creation
    await db.insert(taskHistory).values({
      taskId: task[0].id,
      userId,
      action: 'created',
      details: { category: validatedData.category, reward: validatedData.reward }
    });

    res.status(201).json(task[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get tasks with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      daoId, 
      status, 
      category, 
      difficulty, 
      limit = 20, 
      offset = 0 
    } = req.query;

    let query = db.select().from(tasks);
    let conditions = [];

    if (daoId) conditions.push(eq(tasks.daoId, daoId as string));
    if (status) conditions.push(eq(tasks.status, status as string));
    if (category) conditions.push(eq(tasks.category, category as string));
    if (difficulty) conditions.push(eq(tasks.difficulty, difficulty as string));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const taskList = await query
      .orderBy(desc(tasks.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(taskList);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get task categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db
      .select({ category: tasks.category })
      .from(tasks)
      .groupBy(tasks.category);
    
    res.json(categories.map(c => c.category).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Claim task
router.post('/:taskId/claim', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.claims.sub;

    // Check if task exists and is open
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task[0].status !== 'open') {
      return res.status(400).json({ error: 'Task is not available for claiming' });
    }

    // Update task status
    const claimedTask = await db
      .update(tasks)
      .set({ 
        claimerId: userId,
        status: 'claimed',
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Log claim action
    await db.insert(taskHistory).values({
      taskId,
      userId,
      action: 'claimed',
      details: { claimedAt: new Date().toISOString() }
    });

    res.json(claimedTask[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Submit task completion
router.post('/:taskId/submit', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.claims.sub;
    const validatedData = verifyTaskSchema.parse(req.body);

    // Verify user claimed the task
    const task = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.claimerId, userId)))
      .limit(1);

    if (!task.length) {
      return res.status(403).json({ error: 'Task not found or not claimed by you' });
    }

    if (task[0].status !== 'claimed') {
      return res.status(400).json({ error: 'Task is not in claimed status' });
    }

    // Update task to submitted
    await db
      .update(tasks)
      .set({ 
        status: 'submitted',
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    // Log submission
    await db.insert(taskHistory).values({
      taskId,
      userId,
      action: 'submitted',
      details: validatedData
    });

    res.json({ message: 'Task submitted successfully', taskId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Verify and approve task completion (DAO admin/moderator only)
router.post('/:taskId/verify', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { approved, feedback } = req.body;
    const userId = req.user.claims.sub;

    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task[0].status !== 'submitted') {
      return res.status(400).json({ error: 'Task is not ready for verification' });
    }

    const newStatus = approved ? 'completed' : 'claimed';
    
    // Update task status
    await db
      .update(tasks)
      .set({ 
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    // Log verification
    await db.insert(taskHistory).values({
      taskId,
      userId,
      action: approved ? 'approved' : 'rejected',
      details: { feedback, verifiedAt: new Date().toISOString() }
    });

    // If approved, process bounty payment
    if (approved && task[0].claimerId) {
      await db.insert(walletTransactions).values({
        fromUserId: task[0].daoId,
        toUserId: task[0].claimerId,
        amount: task[0].reward,
        currency: 'cUSD',
        type: 'bounty_payout',
        status: 'completed',
        description: `Bounty payment for task: ${task[0].title}`
      });
    }

    res.json({ 
      message: approved ? 'Task approved and bounty paid' : 'Task rejected',
      taskId,
      newStatus 
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get task history
router.get('/:taskId/history', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const history = await db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .orderBy(desc(taskHistory.createdAt));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get user's claimed tasks
router.get('/user/claimed', async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const claimedTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.claimerId, userId))
      .orderBy(desc(tasks.updatedAt));

    res.json(claimedTasks);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Task analytics
router.get('/analytics', async (req, res) => {
  try {
    const { daoId } = req.query;
    
    let baseQuery = db.select().from(tasks);
    if (daoId) {
      baseQuery = baseQuery.where(eq(tasks.daoId, daoId as string));
    }

    // Get task statistics
    const taskStats = await db
      .select({
        status: tasks.status,
        category: tasks.category,
        difficulty: tasks.difficulty,
        count: sql<number>`count(*)`,
        totalReward: sql<number>`sum(cast(${tasks.reward} as numeric))`
      })
      .from(tasks)
      .groupBy(tasks.status, tasks.category, tasks.difficulty);

    res.json(taskStats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
