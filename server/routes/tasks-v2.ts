import { Router, Request, Response } from 'express';
import { TaskManagementService } from '../services/taskManagementService';

const router = Router();

// ============ TASK MANAGEMENT ============

// NOTE: More specific routes must come BEFORE generic /:taskId routes

// ============ USER TASK ROUTES ============

/**
 * GET /api/tasks-v2/user/my-tasks - Get user's tasks
 */
router.get('/user/my-tasks', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { status } = req.query;

    const userTasks = await TaskManagementService.getUserTasks(userId, status as string);

    res.json({
      success: true,
      tasks: userTasks,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

/**
 * GET /api/tasks-v2/user/my-claims - Get user's bounty claims
 */
router.get('/user/my-claims', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const claims = await TaskManagementService.getUserBountyClaims(userId);

    res.json({
      success: true,
      count: claims.length,
      claims,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user claims' });
  }
});

// ============ ASSIGNMENT ROUTES ============

/**
 * POST /api/tasks-v2/assignments/:assignmentId/accept - Accept assignment
 */
router.post('/assignments/:assignmentId/accept', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const updated = await TaskManagementService.acceptAssignment(req.params.assignmentId, userId);

    res.json({
      success: true,
      assignment: updated,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to accept assignment' });
  }
});

// ============ BOUNTY ROUTES ============

/**
 * GET /api/tasks-v2/bounties/active - Get active bounties
 */
router.get('/bounties/active', async (req: Request, res: Response) => {
  try {
    const bounties = await TaskManagementService.getActiveBounties();

    res.json({
      success: true,
      count: bounties.length,
      bounties,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bounties' });
  }
});

// ============ CLAIMS ROUTES ============

/**
 * PATCH /api/tasks-v2/claims/:claimId - Review bounty claim (admin)
 */
router.patch('/claims/:claimId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Add admin role check
    const userId = (req.user as any).id || (req.user as any).sub;
    const { status, reviewNotes } = req.body;

    // Validate required field
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    const updated = await TaskManagementService.reviewBountyClaim(req.params.claimId, {
      status,
      reviewedById: userId,
      reviewNotes,
    });

    res.json({
      success: true,
      claim: updated,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to review claim' });
  }
});

// ============ STATISTICS ROUTES ============

/**
 * GET /api/tasks-v2/stats/overview - Get task statistics
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await TaskManagementService.getLatestStatistics();

    if (!stats) {
      const calculated = await TaskManagementService.calculateStatistics();
      return res.json({
        success: true,
        statistics: calculated,
      });
    }

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * POST /api/tasks-v2/stats/refresh - Refresh statistics (admin)
 */
router.post('/stats/refresh', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    const stats = await TaskManagementService.calculateStatistics();

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh statistics' });
  }
});

// ============ GENERIC TASK ROUTES (LESS SPECIFIC) ============

/**
 * GET /api/tasks-v2 - List all tasks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category, priority, assignedTo, sortBy, limit = 50, offset = 0 } = req.query;

    const tasks = await TaskManagementService.listTasks({
      status: status as string,
      category: category as string,
      priority: priority as string,
      assignedToId: assignedTo as string,
      sortBy: sortBy as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks-v2 - Create new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { title, description, category, priority, bountyAmount, bountyToken, distributionType, ...restData } = req.body;

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, category',
      });
    }

    const task = await TaskManagementService.createTask({
      title,
      description,
      category,
      createdById: userId,
      priority,
      ...restData,
    });

    // Create bounty if specified
    if (bountyAmount) {
      const bounty = await TaskManagementService.createBounty({
        taskId: task.id,
        totalAmount: bountyAmount,
        tokenSymbol: bountyToken || 'MTAA',
        distributionType,
      });

      return res.status(201).json({
        success: true,
        task,
        bounty,
      });
    }

    res.status(201).json({
      success: true,
      task,
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).json({ error: 'Failed to create task' });
  }
});

/**
 * GET /api/tasks-v2/:taskId - Get task details
 */
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const task = await TaskManagementService.getTaskById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const assignments = await TaskManagementService.getTaskAssignments(req.params.taskId);
    const bounty = await TaskManagementService.getBountyByTask(req.params.taskId);
    const milestones = await TaskManagementService.getTaskMilestones(req.params.taskId);
    const comments = await TaskManagementService.getTaskComments(req.params.taskId);

    res.json({
      success: true,
      task,
      assignments,
      bounty,
      milestones,
      comments,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * POST /api/tasks-v2 - Create new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const taskData = req.body;

    const task = await TaskManagementService.createTask({
      ...taskData,
      createdById: userId,
    });

    // Create bounty if specified
    if (taskData.bountyAmount) {
      const bounty = await TaskManagementService.createBounty({
        taskId: task.id,
        totalAmount: taskData.bountyAmount,
        tokenSymbol: taskData.bountyToken || 'MTAA',
        distributionType: taskData.distributionType,
      });

      return res.status(201).json({
        success: true,
        task,
        bounty,
      });
    }

    res.status(201).json({
      success: true,
      task,
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(400).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks-v2/:taskId - Update task
 */
router.put('/:taskId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const updated = await TaskManagementService.updateTask(req.params.taskId, req.body, userId);

    res.json({
      success: true,
      task: updated,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update task' });
  }
});

/**
 * PATCH /api/tasks-v2/:taskId/status - Update task status
 */
router.patch('/:taskId/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const updated = await TaskManagementService.updateTaskStatus(req.params.taskId, status, userId);

    res.json({
      success: true,
      task: updated,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update status' });
  }
});

/**
 * DELETE /api/tasks-v2/:taskId - Delete task
 */
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const deleted = await TaskManagementService.deleteTask(req.params.taskId, userId);

    res.json({
      success: true,
      task: deleted,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete task' });
  }
});

// ============ TASK ASSIGNMENTS ============

/**
 * POST /api/tasks-v2/:taskId/assign - Assign user to task
 */
router.post('/:taskId/assign', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { assignUserId, role, capacityPercent } = req.body;

    // Validate required field
    if (!assignUserId) {
      return res.status(400).json({ error: 'Missing required field: assignUserId' });
    }

    const assignment = await TaskManagementService.assignUserToTask({
      taskId: req.params.taskId,
      userId: assignUserId,
      role,
      capacityPercent,
      assignedById: userId,
    });

    res.status(201).json({
      success: true,
      assignment,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to assign user' });
  }
});

/**
 * GET /api/tasks-v2/:taskId/assignments - Get task assignments
 */
router.get('/:taskId/assignments', async (req: Request, res: Response) => {
  try {
    const assignments = await TaskManagementService.getTaskAssignments(req.params.taskId);

    res.json({
      success: true,
      assignments,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ============ TASK BOUNTIES ============

/**
 * GET /api/tasks-v2/:taskId/bounty - Get task bounty
 */
router.get('/:taskId/bounty', async (req: Request, res: Response) => {
  try {
    const bounty = await TaskManagementService.getBountyByTask(req.params.taskId);
    const available = await TaskManagementService.getAvailableBountyAmount(req.params.taskId);

    res.json({
      success: true,
      bounty,
      availableAmount: available,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bounty' });
  }
});

// ============ BOUNTY CLAIMS ============

/**
 * POST /api/tasks-v2/:taskId/bounty/claim - Submit bounty claim
 */
router.post('/:taskId/bounty/claim', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { bountyId, claimAmount, walletAddress, proof } = req.body;

    // Validate required fields
    if (!bountyId || !claimAmount || !walletAddress) {
      return res.status(400).json({
        error: 'Missing required fields: bountyId, claimAmount, walletAddress',
      });
    }

    const claim = await TaskManagementService.submitBountyClaim({
      bountyId,
      taskId: req.params.taskId,
      userId,
      claimAmount,
      proof,
      walletAddress,
    });

    res.status(201).json({
      success: true,
      claim,
    });
  } catch (err) {
    console.error('Error submitting claim:', err);
    res.status(400).json({ error: 'Failed to submit bounty claim' });
  }
});

/**
 * GET /api/tasks-v2/:taskId/bounty/claims - Get bounty claims
 */
router.get('/:taskId/bounty/claims', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const claims = await TaskManagementService.getTaskBountyClaims(req.params.taskId, status as string);

    res.json({
      success: true,
      count: claims.length,
      claims,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// ============ TASK COMMENTS ============

/**
 * POST /api/tasks-v2/:taskId/comments - Add comment
 */
router.post('/:taskId/comments', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = (req.user as any).id || (req.user as any).sub;
    const { content, mentions, parentCommentId } = req.body;

    const comment = await TaskManagementService.addComment({
      taskId: req.params.taskId,
      userId,
      content,
      mentions,
      parentCommentId,
    });

    res.status(201).json({
      success: true,
      comment,
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/tasks-v2/:taskId/comments - Get task comments
 */
router.get('/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const comments = await TaskManagementService.getTaskComments(req.params.taskId);

    res.json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

export default router;
