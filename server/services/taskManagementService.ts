import { db } from '../storage';
import { eq, and, gte, lte, desc, asc, sql, count, inArray, isNull } from 'drizzle-orm';
import {
  tasks,
  taskAssignments,
  taskBounties,
  bountyClaims,
  taskComments,
  taskMilestones,
  taskActivityLog,
  taskStatistics,
  taskTemplates,
} from '../../shared/taskManagementSchema';
import { users } from '../../shared/schema';

export class TaskManagementService {
  // ============ TASK CRUD OPERATIONS ============

  /**
   * Create new task
   */
  static async createTask(data: {
    title: string;
    description: string;
    category: string;
    createdById: string;
    priority?: string;
    bountyAmount?: number;
    bountyToken?: string;
    requiredSkills?: string[];
    skillLevel?: string;
    dueDate?: Date;
    tags?: string[];
    isPublic?: boolean;
  }) {
    const [task] = await db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description,
        category: data.category as any,
        createdById: data.createdById,
        priority: (data.priority || 'medium') as any,
        bountyAmount: data.bountyAmount?.toString() || '0',
        bountyToken: data.bountyToken || 'MTAA',
        requiredSkills: data.requiredSkills || [],
        skillLevel: data.skillLevel,
        dueDate: data.dueDate,
        tags: data.tags || [],
        isPublic: data.isPublic !== false,
      })
      .returning();

    // Log activity
    await this.logActivity(task.id, data.createdById, 'created', { title: data.title });

    return task;
  }

  /**
   * Get task by ID
   */
  static async getTaskById(taskId: string) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    return task;
  }

  /**
   * List tasks with filters
   */
  static async listTasks(options?: {
    status?: string;
    category?: string;
    priority?: string;
    assignedToId?: string;
    createdById?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
  }) {
    let whereConditions: any[] = [eq(tasks.isHidden, false)];

    if (options?.status) {
      whereConditions.push(eq(tasks.status, options.status as any));
    }
    if (options?.category) {
      whereConditions.push(eq(tasks.category, options.category as any));
    }
    if (options?.priority) {
      whereConditions.push(eq(tasks.priority, options.priority as any));
    }
    if (options?.assignedToId) {
      whereConditions.push(eq(tasks.assignedToId, options.assignedToId));
    }
    if (options?.createdById) {
      whereConditions.push(eq(tasks.createdById, options.createdById));
    }

    let baseQuery = db
      .select()
      .from(tasks)
      .where(and(...whereConditions));

    // Sorting
    let query: any = baseQuery;
    if (options?.sortBy === 'priority') {
      query = baseQuery.orderBy(desc(tasks.priority));
    } else if (options?.sortBy === 'due_date') {
      query = baseQuery.orderBy(asc(tasks.dueDate));
    } else if (options?.sortBy === 'bounty') {
      query = baseQuery.orderBy(desc(tasks.bountyAmount));
    } else {
      query = baseQuery.orderBy(desc(tasks.createdAt));
    }

    // Pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  /**
   * Update task
   */
  static async updateTask(taskId: string, data: any, updatedById: string) {
    const [updated] = await db
      .update(tasks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    await this.logActivity(taskId, updatedById, 'updated', data);
    return updated;
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(taskId: string, status: string, updatedById: string) {
    const completedAt = status === 'completed' ? new Date() : null;

    const [updated] = await db
      .update(tasks)
      .set({
        status: status as any,
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    await this.logActivity(taskId, updatedById, 'status_changed', { newStatus: status, oldStatus: updated.status });
    return updated;
  }

  /**
   * Delete task (soft delete)
   */
  static async deleteTask(taskId: string, deletedById: string) {
    const [deleted] = await db
      .update(tasks)
      .set({
        isHidden: true,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    await this.logActivity(taskId, deletedById, 'deleted', {});
    return deleted;
  }

  // ============ TASK ASSIGNMENT ============

  /**
   * Assign user to task
   */
  static async assignUserToTask(data: {
    taskId: string;
    userId: string;
    role?: string;
    capacityPercent?: number;
    assignedById: string;
  }) {
    const [assignment] = await db
      .insert(taskAssignments)
      .values({
        taskId: data.taskId,
        userId: data.userId,
        role: data.role || 'contributor',
        capacityPercent: data.capacityPercent || 100,
      })
      .returning();

    // Update task status if needed
    const task = await this.getTaskById(data.taskId);
    if (task.status === 'open') {
      await this.updateTaskStatus(data.taskId, 'in_progress', data.assignedById);
    }

    await this.logActivity(data.taskId, data.assignedById, 'assigned', { userId: data.userId, role: data.role });
    return assignment;
  }

  /**
   * Get task assignments
   */
  static async getTaskAssignments(taskId: string) {
    return await db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId));
  }

  /**
   * Accept assignment
   */
  static async acceptAssignment(assignmentId: string, userId: string) {
    const [updated] = await db
      .update(taskAssignments)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(taskAssignments.id, assignmentId))
      .returning();

    return updated;
  }

  /**
   * Get user's tasks
   */
  static async getUserTasks(userId: string, status?: string) {
    let whereConditions: any[] = [eq(taskAssignments.userId, userId)];

    if (status) {
      whereConditions.push(eq(tasks.status, status as any));
    }

    return await db
      .select()
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .where(and(...whereConditions));
  }

  // ============ BOUNTY MANAGEMENT ============

  /**
   * Create bounty for task
   */
  static async createBounty(data: {
    taskId: string;
    totalAmount: number;
    tokenSymbol: string;
    tokenAddress?: string;
    distributionType?: string;
    maxClaimers?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const [bounty] = await db
      .insert(taskBounties)
      .values({
        taskId: data.taskId,
        totalAmount: data.totalAmount.toString(),
        tokenSymbol: data.tokenSymbol,
        tokenAddress: data.tokenAddress,
        distributionType: data.distributionType || 'equal',
        maxClaimers: data.maxClaimers,
        startDate: data.startDate,
        endDate: data.endDate,
      })
      .returning();

    return bounty;
  }

  /**
   * Get active bounties
   */
  static async getActiveBounties() {
    return await db
      .select()
      .from(taskBounties)
      .where(eq(taskBounties.isActive, true))
      .orderBy(desc(taskBounties.totalAmount));
  }

  /**
   * Get bounty by task
   */
  static async getBountyByTask(taskId: string) {
    const [bounty] = await db
      .select()
      .from(taskBounties)
      .where(eq(taskBounties.taskId, taskId));

    return bounty;
  }

  /**
   * Get available bounty amount for task
   */
  static async getAvailableBountyAmount(taskId: string) {
    const bounty = await this.getBountyByTask(taskId);
    if (!bounty) return 0;

    // Get total claimed amount
    const result = await db
      .select({ total: sql<number>`SUM(CAST(${bountyClaims.claimAmount} AS NUMERIC))` })
      .from(bountyClaims)
      .where(and(eq(bountyClaims.taskId, taskId), eq(bountyClaims.status, 'approved' as any)));

    const claimed = parseFloat(String(result[0]?.total || '0'));
    return parseFloat(bounty.totalAmount.toString()) - claimed;
  }

  // ============ BOUNTY CLAIMS ============

  /**
   * Submit bounty claim
   */
  static async submitBountyClaim(data: {
    bountyId: string;
    taskId: string;
    userId: string;
    claimAmount: number;
    proof: any;
    walletAddress: string;
  }) {
    const [claim] = await db
      .insert(bountyClaims)
      .values({
        bountyId: data.bountyId,
        taskId: data.taskId,
        claimerUserId: data.userId,
        claimAmount: data.claimAmount.toString(),
        proof: data.proof,
        walletAddress: data.walletAddress,
      })
      .returning();

    await this.logActivity(data.taskId, data.userId, 'bounty_claimed', {
      amount: data.claimAmount,
      claimId: claim.id,
    });

    return claim;
  }

  /**
   * Get bounty claims for task
   */
  static async getTaskBountyClaims(taskId: string, status?: string) {
    let whereConditions: any[] = [eq(bountyClaims.taskId, taskId)];

    if (status) {
      whereConditions.push(eq(bountyClaims.status, status as any));
    }

    return await db
      .select()
      .from(bountyClaims)
      .where(and(...whereConditions))
      .orderBy(desc(bountyClaims.submittedAt));
  }

  /**
   * Get user's bounty claims
   */
  static async getUserBountyClaims(userId: string) {
    return await db
      .select()
      .from(bountyClaims)
      .where(eq(bountyClaims.claimerUserId, userId))
      .orderBy(desc(bountyClaims.submittedAt));
  }

  /**
   * Review bounty claim
   */
  static async reviewBountyClaim(claimId: string, data: {
    status: string;
    reviewedById: string;
    reviewNotes?: string;
  }) {
    const reviewedAt = new Date();
    const paidAt = data.status === 'paid' ? new Date() : null;

    const [updated] = await db
      .update(bountyClaims)
      .set({
        status: data.status as any,
        reviewedById: data.reviewedById,
        reviewNotes: data.reviewNotes,
        reviewedAt,
        paidAt,
      })
      .where(eq(bountyClaims.id, claimId))
      .returning();

    return updated;
  }

  /**
   * Get claim statistics
   */
  static async getClaimStatistics(taskId?: string) {
    let whereConditions: any[] = [];

    if (taskId) {
      whereConditions.push(eq(bountyClaims.taskId, taskId));
    }

    const result = await db
      .select({
        total: sql`COUNT(*)`,
        approved: sql`COUNT(CASE WHEN ${bountyClaims.status} = 'approved' THEN 1 END)`,
        rejected: sql`COUNT(CASE WHEN ${bountyClaims.status} = 'rejected' THEN 1 END)`,
        totalAmount: sql`SUM(CASE WHEN ${bountyClaims.status} = 'approved' THEN ${bountyClaims.claimAmount} ELSE 0 END)`,
      })
      .from(bountyClaims)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return result[0];
  }

  // ============ TASK MILESTONES ============

  /**
   * Create milestone
   */
  static async createMilestone(data: {
    taskId: string;
    name: string;
    description?: string;
    order: number;
    dueDate?: Date;
    milestoneBounty?: number;
  }) {
    const [milestone] = await db
      .insert(taskMilestones)
      .values({
        taskId: data.taskId,
        name: data.name,
        description: data.description,
        order: data.order,
        dueDate: data.dueDate,
        milestoneBounty: data.milestoneBounty?.toString() || '0',
      })
      .returning();

    return milestone;
  }

  /**
   * Get task milestones
   */
  static async getTaskMilestones(taskId: string) {
    return await db
      .select()
      .from(taskMilestones)
      .where(eq(taskMilestones.taskId, taskId))
      .orderBy(asc(taskMilestones.order));
  }

  /**
   * Update milestone status
   */
  static async updateMilestoneStatus(milestoneId: string, status: string) {
    const completedAt = status === 'completed' ? new Date() : null;

    const [updated] = await db
      .update(taskMilestones)
      .set({
        status,
        completedAt,
      })
      .where(eq(taskMilestones.id, milestoneId))
      .returning();

    return updated;
  }

  // ============ TASK COMMENTS ============

  /**
   * Add comment to task
   */
  static async addComment(data: {
    taskId: string;
    userId: string;
    content: string;
    mentions?: string[];
    parentCommentId?: string;
  }) {
    const [comment] = await db
      .insert(taskComments)
      .values({
        taskId: data.taskId,
        userId: data.userId,
        content: data.content,
        mentions: data.mentions || [],
        parentCommentId: data.parentCommentId,
      })
      .returning();

    return comment;
  }

  /**
   * Get task comments
   */
  static async getTaskComments(taskId: string) {
    return await db
      .select()
      .from(taskComments)
      .where(and(eq(taskComments.taskId, taskId), isNull(taskComments.deletedAt)))
      .orderBy(asc(taskComments.createdAt));
  }

  /**
   * Delete comment
   */
  static async deleteComment(commentId: string) {
    const [deleted] = await db
      .update(taskComments)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(taskComments.id, commentId))
      .returning();

    return deleted;
  }

  // ============ TASK STATISTICS ============

  /**
   * Calculate and cache task statistics
   */
  static async calculateStatistics() {
    const totalTasksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(eq(tasks.isHidden, false));

    const openTasksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(eq(tasks.status, 'open' as any), eq(tasks.isHidden, false)));

    const completedTasksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(eq(tasks.status, 'completed' as any), eq(tasks.isHidden, false)));

    const totalBountyResult = await db
      .select({ total: sql<number>`SUM(CAST(${tasks.bountyAmount} AS NUMERIC))` })
      .from(tasks);

    const claimedBountyResult = await db
      .select({ total: sql<number>`SUM(CAST(${bountyClaims.claimAmount} AS NUMERIC))` })
      .from(bountyClaims)
      .where(eq(bountyClaims.status, 'approved' as any));

    const [stats] = await db
      .insert(taskStatistics)
      .values({
        totalTasks: parseInt(String(totalTasksResult[0]?.count || '0')),
        openTasks: parseInt(String(openTasksResult[0]?.count || '0')),
        completedTasks: parseInt(String(completedTasksResult[0]?.count || '0')),
        totalBountyPool: (totalBountyResult[0]?.total || '0').toString(),
        claimedBounties: (claimedBountyResult[0]?.total || '0').toString(),
        paidBounties: '0', // Would need to track paid separately
        activeContributors: 0, // Would need separate calculation
      })
      .returning();

    return stats;
  }

  /**
   * Get latest statistics
   */
  static async getLatestStatistics() {
    const [stats] = await db
      .select()
      .from(taskStatistics)
      .orderBy(desc(taskStatistics.calculatedAt))
      .limit(1);

    return stats;
  }

  // ============ ACTIVITY LOGGING ============

  /**
   * Log activity
   */
  static async logActivity(taskId: string, userId: string | null, action: string, details: any) {
    const [log] = await db
      .insert(taskActivityLog)
      .values({
        taskId,
        userId,
        action,
        details,
      })
      .returning();

    return log;
  }

  /**
   * Get task activity
   */
  static async getTaskActivity(taskId: string, limit: number = 50) {
    return await db
      .select()
      .from(taskActivityLog)
      .where(eq(taskActivityLog.taskId, taskId))
      .orderBy(desc(taskActivityLog.createdAt))
      .limit(limit);
  }

  // ============ TASK TEMPLATES ============

  /**
   * Create task template
   */
  static async createTemplate(data: {
    name: string;
    description?: string;
    category: string;
    template: any;
    isPublic?: boolean;
  }) {
    const [template] = await db
      .insert(taskTemplates)
      .values({
        name: data.name,
        description: data.description,
        category: data.category as any,
        template: data.template,
        isPublic: data.isPublic !== false,
      })
      .returning();

    return template;
  }

  /**
   * Get templates
   */
  static async getTemplates(category?: string, publicOnly: boolean = true) {
    let whereConditions: any[] = [];

    if (publicOnly) {
      whereConditions.push(eq(taskTemplates.isPublic, true));
    }

    if (category) {
      whereConditions.push(eq(taskTemplates.category, category as any));
    }

    return await db
      .select()
      .from(taskTemplates)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
  }

  /**
   * Create task from template
   */
  static async createTaskFromTemplate(templateId: string, data: any, createdById: string) {
    const template = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, templateId));

    if (!template || template.length === 0) {
      throw new Error('Template not found');
    }

    const templateData = template[0].template as Record<string, any>;
    const task = await this.createTask({
      title: data.title || templateData?.title,
      description: data.description || templateData?.description,
      category: data.category || templateData?.category,
      createdById,
      priority: data.priority || templateData?.priority,
      bountyAmount: data.bountyAmount || templateData?.bountyAmount,
      requiredSkills: data.requiredSkills || templateData?.requiredSkills,
      dueDate: data.dueDate,
    });

    // Increment usage count
    await db
      .update(taskTemplates)
      .set({
        usageCount: sql`${taskTemplates.usageCount} + 1`,
      })
      .where(eq(taskTemplates.id, templateId));

    return task;
  }
}
