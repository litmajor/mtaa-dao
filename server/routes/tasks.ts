import express from 'express';
import { db } from '../storage';
import { tasks, taskHistory, users } from '../../shared/schema';
import { contributionGraph } from '../../shared/reputationSchema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ReputationService, REPUTATION_VALUES } from '../reputationService';

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
  const userId = String(req.user?.claims?.sub ?? '');
    const daoIdRaw = req.params.daoId || req.body.daoId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let daoId: string | undefined = undefined;
    if (typeof daoIdRaw === 'string') {
      daoId = daoIdRaw;
    } else if (daoIdRaw) {
      daoId = String(daoIdRaw);
    }
    if (!daoId || daoId === 'null') {
      return res.status(400).json({ error: 'Invalid DAO ID' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Unauthorized: Invalid user ID' });
    }
    const safeUserId = String(userId ?? '');
    const membership = await db
      .select()
      .from(daoMemberships)
      .where(and(eq(daoMemberships.daoId, String(daoId ?? '')), eq(daoMemberships.userId, String(userId ?? ''))));
    if (
      !membership.length ||
      !roles.includes(typeof membership[0].role === 'string' ? membership[0].role : '')
    ) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Create task (DAO admin/moderator only)
router.post('/create', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const userId = req.user && req.user.claims ? req.user.claims.sub : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Ensure reward is string for DB
    const insertData: any = {
      ...validatedData,
      creatorId: userId,
      status: 'open',
      reward: String(validatedData.reward)
    };
    if (validatedData.deadline) {
      insertData.deadline = new Date(validatedData.deadline);
    }
    const task = await db.insert(tasks).values(insertData).returning();
    // Log task creation
    await db.insert(taskHistory).values({
      taskId: task[0].id,
      userId,
      action: 'created',
      details: { category: validatedData.category, reward: String(validatedData.reward) }
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

    let conditions = [];
    if (daoId) conditions.push(eq(tasks.daoId, typeof daoId === 'string' ? daoId : ''));
    if (status) conditions.push(eq(tasks.status, typeof status === 'string' ? status : ''));
    if (category) conditions.push(eq(tasks.category, typeof category === 'string' ? category : ''));
    if (difficulty) conditions.push(eq(tasks.difficulty, typeof difficulty === 'string' ? difficulty : ''));
    let query;
    if (conditions.length > 0) {
      query = db.select().from(tasks).where(and(...conditions));
    } else {
      query = db.select().from(tasks);
    }
    const taskList = await query.orderBy(desc(tasks.createdAt)).limit(Number(limit)).offset(Number(offset));
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
    const userId = req.user && req.user.claims ? req.user.claims.sub : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const userId = req.user && req.user.claims ? req.user.claims.sub : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
    const { approved, feedback, autoVerify = false } = req.body;
    const userId = req.user && req.user.claims ? req.user.claims.sub : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    let verificationScore = 0;
    let autoApproved = false;

    // Auto-verification for simple tasks
    if (autoVerify || task[0].category === 'Documentation' || task[0].difficulty === 'easy') {
      const { TaskVerificationService } = await import('../taskVerificationService');
      const submissionData = { 
        proofUrl: task[0].proofUrl, 
        description: task[0].verificationNotes || '',
        screenshots: []
      };

      verificationScore = await TaskVerificationService.calculateVerificationScore(taskId, submissionData);
      autoApproved = verificationScore >= 70; // Auto-approve if score >= 70

      if (autoApproved && !approved) {
        // Override manual decision with auto-approval
        req.body.approved = true;
        req.body.feedback = `Auto-approved with verification score: ${verificationScore}/100. ${feedback || ''}`;
      }
    }

    const finalApproval = req.body.approved || autoApproved;
    const newStatus = finalApproval ? 'completed' : 'rejected'; // Changed from 'claimed' to 'rejected'

    // Update task status with verification notes
    await db
      .update(tasks)
      .set({ 
        status: newStatus,
        verificationNotes: req.body.feedback || feedback,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    // Log verification with score
    await db.insert(taskHistory).values({
      taskId,
      userId,
      action: finalApproval ? 'approved' : 'rejected',
      details: { 
        feedback: req.body.feedback || feedback, 
        verifiedAt: new Date().toISOString(),
        verificationScore,
        autoApproved 
      }
    });

    // If approved, process bounty payment and achievements
    if (finalApproval && task[0].claimerId) {
      // Process escrow release
      const { TaskVerificationService } = await import('../taskVerificationService');
      await TaskVerificationService.processEscrowRelease(taskId, true);

      // Award reputation points based on task difficulty
      const difficultyMultiplier = { easy: 1, medium: 2, hard: 3 }[task[0].difficulty] || 1;
      await ReputationService.awardPoints(
        task[0].claimerId,
        'TASK_COMPLETED',
        50 * difficultyMultiplier,
        task[0].daoId,
        `Completed task: ${task[0].title}`,
        verificationScore / 100
      );

      // Record contribution in reputation graph
      await db.insert(contributionGraph).values({
        userId: task[0].claimerId,
        contributionType: 'task_completed',
        daoId: task[0].daoId,
        value: task[0].reward?.toString(),
        reputationWeight: 70, // Example weight, adjust as needed
        verified: true,
        verifiedBy: userId,
        verifiedAt: new Date(),
        metadata: {
          taskId: task[0].id,
          taskTitle: task[0].title,
          category: task[0].category
        },
        relatedEntityId: taskId,
        relatedEntityType: 'task'
      });


      // Check for achievement unlocks
      const { AchievementService } = await import('../achievementService');
      const newAchievements = await AchievementService.checkUserAchievements(task[0].claimerId);

      if (newAchievements.length > 0) {
        // Notify about new achievements
        const { notificationService } = await import('../notificationService');
        await notificationService.sendNotification(task[0].claimerId, {
          title: '🏆 New Achievement Unlocked!',
          message: `You've unlocked: ${newAchievements.join(', ')}`,
          type: 'achievement'
        });
      }
    } else if (!finalApproval && task[0].claimerId) {
      // If rejected, log the rejection in task history
      await db.insert(taskHistory).values({
        taskId,
        userId, // The verifier's ID
        action: 'rejected',
        details: { feedback: req.body.feedback || feedback, rejectedAt: new Date().toISOString() }
      });
    }

    res.json({ 
      message: finalApproval ? 'Task approved and bounty paid' : 'Task rejected',
      taskId,
      newStatus,
      verificationScore,
      autoApproved
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
    const userId = req.user && req.user.claims ? req.user.claims.sub : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    // Get task statistics
    let statsQuery;
    if (daoId) {
      statsQuery = db
        .select({
          status: tasks.status,
          category: tasks.category,
          difficulty: tasks.difficulty,
          count: sql<number>`count(*)`,
          totalReward: sql<number>`sum(cast(${tasks.reward} as numeric))`
        })
        .from(tasks)
        .where(eq(tasks.daoId, typeof daoId === 'string' ? daoId : ''));
    } else {
      statsQuery = db
        .select({
          status: tasks.status,
          category: tasks.category,
          difficulty: tasks.difficulty,
          count: sql<number>`count(*)`,
          totalReward: sql<number>`sum(cast(${tasks.reward} as numeric))`
        })
        .from(tasks);
    }
    const taskStats = await statsQuery;
    res.json(taskStats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;