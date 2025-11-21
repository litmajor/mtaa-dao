import { pgTable, pgEnum, text, varchar, integer, decimal, timestamp, boolean, jsonb, serial, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './schema';
import { nanoid } from 'nanoid';

// Task status enum
export const taskStatusEnum = pgEnum('task_status', [
  'draft',
  'open',
  'in_progress',
  'review',
  'completed',
  'closed',
  'archived'
]);

// Task priority enum
export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

// Task category enum
export const taskCategoryEnum = pgEnum('task_category', [
  'development',
  'design',
  'documentation',
  'testing',
  'research',
  'community',
  'governance',
  'marketing',
  'operations',
  'other'
]);

// Bounty claim status enum
export const bountiesClaimStatusEnum = pgEnum('bounty_claim_status', [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'paid'
]);

/**
 * Tasks - Core task definitions
 */
export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  // Basic info
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: taskCategoryEnum('category').notNull(),
  
  // Assignment and status
  assignedToId: varchar('assigned_to_id', { length: 255 }).references(() => users.id),
  createdById: varchar('created_by_id', { length: 255 }).references(() => users.id),
  status: taskStatusEnum('status').notNull().default('open'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  
  // Bounty info
  bountyAmount: decimal('bounty_amount', { precision: 18, scale: 8 }).notNull().default('0'),
  bountyToken: varchar('bounty_token', { length: 100 }).default('MTAA'),
  totalBountyPool: decimal('total_bounty_pool', { precision: 18, scale: 8 }).default('0'),
  
  // Skills and requirements
  requiredSkills: jsonb('required_skills'), // array of strings
  skillLevel: varchar('skill_level', { length: 50 }), // 'beginner', 'intermediate', 'advanced'
  
  // Deadlines
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  
  // Metadata
  tags: jsonb('tags'), // array of strings
  attachments: jsonb('attachments'), // array of { name, url }
  metadata: jsonb('metadata'), // custom fields
  
  // Display
  displayOrder: integer('display_order').default(0),
  isPublic: boolean('is_public').notNull().default(true),
  isHidden: boolean('is_hidden').notNull().default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Task Assignments - Track multiple assignees per task
 */
export const taskAssignments = pgTable('task_assignments', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id).notNull(),
  
  // Role and capacity
  role: varchar('role', { length: 100 }), // 'lead', 'contributor', 'reviewer', 'QA'
  capacityPercent: integer('capacity_percent').default(100), // % of effort
  
  // Status
  status: varchar('status', { length: 50 }).notNull().default('assigned'), // 'assigned', 'accepted', 'in_progress', 'completed', 'declined'
  acceptedAt: timestamp('accepted_at'),
  
  // Timestamps
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

/**
 * Task Bounties - Track bounty distribution and claims
 */
export const taskBounties = pgTable('task_bounties', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  
  // Bounty details
  totalAmount: decimal('total_amount', { precision: 18, scale: 8 }).notNull(),
  tokenAddress: varchar('token_address', { length: 255 }),
  tokenSymbol: varchar('token_symbol', { length: 50 }).notNull(),
  
  // Distribution
  distributionType: varchar('distribution_type', { length: 50 }).notNull(), // 'equal', 'weighted', 'first_come', 'milestone'
  maxClaimers: integer('max_claimers'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * Bounty Claims - Track who claims bounty rewards
 */
export const bountyClaims = pgTable('bounty_claims', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  bountyId: varchar('bounty_id', { length: 255 }).references(() => taskBounties.id).notNull(),
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  claimerUserId: varchar('claimer_user_id', { length: 255 }).references(() => users.id).notNull(),
  
  // Claim details
  claimAmount: decimal('claim_amount', { precision: 18, scale: 8 }).notNull(),
  proof: jsonb('proof'), // evidence of work completion { url, hash, metadata }
  
  // Review process
  status: bountiesClaimStatusEnum('status').notNull().default('submitted'),
  reviewedById: varchar('reviewed_by_id', { length: 255 }),
  reviewNotes: text('review_notes'),
  
  // Payment
  transactionHash: varchar('transaction_hash', { length: 255 }),
  walletAddress: varchar('wallet_address', { length: 255 }).notNull(),
  
  // Timestamps
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
  paidAt: timestamp('paid_at'),
  
  // Metadata
  metadata: jsonb('metadata'),
});

/**
 * Task Comments - Discussion and collaboration
 */
export const taskComments = pgTable('task_comments', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id).notNull(),
  
  content: text('content').notNull(),
  mentions: jsonb('mentions'), // array of user IDs mentioned
  
  // Threading
  parentCommentId: varchar('parent_comment_id', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

/**
 * Task Milestones - Track progress checkpoints
 */
export const taskMilestones = pgTable('task_milestones', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  
  // Milestone details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  
  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed'
  completedAt: timestamp('completed_at'),
  
  // Bounty for this milestone
  milestoneBounty: decimal('milestone_bounty', { precision: 18, scale: 8 }).default('0'),
  
  // Timestamps
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Task Activity Log - Track all changes
 */
export const taskActivityLog = pgTable('task_activity_log', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  taskId: varchar('task_id', { length: 255 }).references(() => tasks.id).notNull(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id),
  
  // Activity
  action: varchar('action', { length: 100 }).notNull(), // 'created', 'assigned', 'status_changed', 'bounty_claimed', etc
  details: jsonb('details'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Task Statistics - Cached stats for performance
 */
export const taskStatistics = pgTable('task_statistics', {
  id: serial('id').primaryKey(),
  
  // Overall stats
  totalTasks: integer('total_tasks').default(0),
  openTasks: integer('open_tasks').default(0),
  completedTasks: integer('completed_tasks').default(0),
  
  // Bounty stats
  totalBountyPool: decimal('total_bounty_pool', { precision: 18, scale: 8 }).default('0'),
  claimedBounties: decimal('claimed_bounties', { precision: 18, scale: 8 }).default('0'),
  paidBounties: decimal('paid_bounties', { precision: 18, scale: 8 }).default('0'),
  
  // User stats
  activeContributors: integer('active_contributors').default(0),
  
  // Timestamps
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
});

/**
 * Task Templates - Reusable task blueprints
 */
export const taskTemplates = pgTable('task_templates', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => nanoid()),
  
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: taskCategoryEnum('category').notNull(),
  
  // Template content
  template: jsonb('template').notNull(), // { title, description, requiredSkills, defaultBounty, etc }
  
  // Usage
  isPublic: boolean('is_public').notNull().default(true),
  usageCount: integer('usage_count').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Indexes for performance
 */
export const taskIndexes = sql`
  CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
  CREATE INDEX IF NOT EXISTS tasks_category_idx ON tasks(category);
  CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks(created_by_id);
  CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to_id);
  CREATE INDEX IF NOT EXISTS task_assignments_user_idx ON task_assignments(user_id);
  CREATE INDEX IF NOT EXISTS task_assignments_task_idx ON task_assignments(task_id);
  CREATE INDEX IF NOT EXISTS bounty_claims_status_idx ON bounty_claims(status);
  CREATE INDEX IF NOT EXISTS bounty_claims_claimer_idx ON bounty_claims(claimer_user_id);
  CREATE INDEX IF NOT EXISTS task_milestones_task_idx ON task_milestones(task_id);
`;
