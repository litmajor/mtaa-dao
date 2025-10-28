import { messageReactions } from './messageReactionsSchema';

// Unique constraints for proposal_likes and comment_likes are enforced at the database level.
// Add these to your migration or run manually:
// ALTER TABLE proposal_likes ADD CONSTRAINT proposal_likes_unique UNIQUE (proposal_id, user_id);
// ALTER TABLE comment_likes ADD CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id);


import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  uuid,
  json
} from "drizzle-orm/pg-core";
import { sql } from 'drizzle-orm';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type User = typeof users.$inferSelect;
// Referral Rewards table
export const referralRewards = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardType: varchar("reward_type").default("signup"), // signup, first_contribution, milestone
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: decimal("reward", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("open"), // open, claimed, submitted, completed, disputed
  claimerId: varchar("claimer_id").references(() => users.id),
  claimedBy: varchar("claimed_by").references(() => users.id), // legacy, keep for now
  category: varchar("category").notNull(),
  difficulty: varchar("difficulty").notNull(), // easy, medium, hard
  estimatedTime: varchar("estimated_time"),
  deadline: timestamp("deadline"),
  requiresVerification: boolean("requires_verification").default(false),
  proofUrl: text("proof_url"),
  verificationNotes: text("verification_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
// Task Templates table
export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  category: varchar('category').notNull(),
  difficulty: varchar('difficulty').notNull(),
  estimatedHours: integer('estimated_hours').default(1),
  requiredSkills: jsonb('required_skills').default([]),
  bountyAmount: decimal('bounty_amount', { precision: 10, scale: 2 }).default('0'),
  deliverables: jsonb('deliverables').default([]),
  acceptanceCriteria: jsonb('acceptance_criteria').default([]),
  createdBy: varchar('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const taskTemplatesCreatedBy = taskTemplates.createdBy;
import { relations } from "drizzle-orm";
import { IsRestoringProvider } from "@tanstack/react-query";

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  // convenience full name for some callsites
  name: varchar("name"),
  username: varchar("username").unique(),
  password: varchar("password").notNull(),
  email: varchar("email").unique(),
  phone: varchar("phone").unique(),
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  emailVerificationToken: varchar("email_verification_token"),
  phoneVerificationToken: varchar("phone_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  phoneVerificationExpiresAt: timestamp("phone_verification_expires_at"),
  passwordResetToken: varchar("password_reset_token"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  profilePicture: varchar("profile_picture"),
  // wallet address used in multiple server callsites
  walletAddress: varchar("wallet_address"),
  bio: text("bio"),
  location: varchar("location"),
  website: varchar("website"),
  lastLoginAt: timestamp("last_login_at"),
  reputationScore: decimal("reputation_score", { precision: 10, scale: 2 }).default("0"),
  roles: varchar("roles").default("member"), // member, proposer, elder
  totalContributions: decimal("total_contributions", { precision: 10, scale: 2 }).default("0"),
  currentStreak: integer("current_streak").default(0),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  totalReferrals: integer("total_referrals").default(0),
  darkMode: boolean("dark_mode").default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  otp: varchar("otp", { length: 10 }),
  otpExpiresAt: timestamp("otp_expires_at"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  isSuperUser: boolean("is_super_user").default(false), // for superuser dashboard access
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0"), // for weighted voting
  telegramId: varchar("telegram_id"),
  telegramChatId: varchar("telegram_chat_id"),
  telegramUsername: varchar("telegram_username"),
  // Encrypted wallet storage fields
  encryptedWallet: text("encrypted_wallet"),
  walletSalt: text("wallet_salt"),
  walletIv: text("wallet_iv"),
  walletAuthTag: text("wallet_auth_tag"),
  hasBackedUpMnemonic: boolean("has_backed_up_mnemonic").default(false),
});

// User Activities table
export const userActivities = pgTable('user_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').references(() => users.id).notNull(),
  dao_id: uuid('dao_id').references(() => daos.id),
  type: varchar('type').notNull(), // e.g., 'proposal', 'vote', 'task', 'comment', etc.
  description: text('description'),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  roles: varchar("roles").default("member"), // member, proposer, elder
  totalContributions: decimal("total_contributions", { precision: 10, scale: 2 }).default("0"),
  currentStreak: integer("current_streak").default(0),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  totalReferrals: integer("total_referrals").default(0),
  darkMode: boolean("dark_mode").default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  otp: varchar("otp", { length: 10 }),
  otpExpiresAt: timestamp("otp_expires_at"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  isSuperUser: boolean("is_super_user").default(false), // for superuser dashboard access
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0"), // for weighted voting
  telegramId: varchar("telegram_id"),
  telegramChatId: varchar("telegram_chat_id"),
  telegramUsername: varchar("telegram_username"),
});

export const userActivitiesDaoId = userActivities.dao_id;

// DAOs table
export const daos = pgTable("daos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text("description"),
  access: varchar("access").default("public"), // "public" | "private"
  inviteOnly: boolean("invite_only").default(false),
  inviteCode: varchar("invite_code"),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(true), // legacy, keep for now
  memberCount: integer("member_count").default(1),
  treasuryBalance: decimal("treasury_balance", { precision: 10, scale: 2 }).default("0"),
  plan: varchar("plan").default("free"), // free, premium
  planExpiresAt: timestamp("plan_expires_at"),
  billingStatus: varchar("billing_status").default("active"),
  nextBillingDate: timestamp("next_billing_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  imageUrl: varchar("image_url"),
  bannerUrl: varchar("banner_url"),
  isArchived: boolean("is_archived").default(false), // for soft deletion
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  isFeatured: boolean("is_featured").default(false), // for featured DAOs on landing page
  featureOrder: integer("feature_order").default(0), // order of featured DAOs
  quorumPercentage: integer("quorum_percentage").default(20), // percentage of active members for quorum
  votingPeriod: integer("voting_period").default(72), // voting period in hours
  executionDelay: integer("execution_delay").default(24), // execution delay in hours
  tokenHoldings : boolean("token_holdings").default(false) // whether DAO requires token holdings for membership
});

export const roles = ["member", "proposer", "elder", "admin", "superUser", "moderator"] as const;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// Sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertDao = typeof daos.$inferInsert;
export type InsertUser = typeof users.$inferInsert;
export type BillingHistory = typeof billingHistory.$inferSelect;
export type InsertBillingHistory = typeof billingHistory.$inferInsert;

export const createSessionSchema = createInsertSchema(sessions);
export const sessionSchema = createSessionSchema;
// Billing History table for DAOs
export const billingHistory = pgTable("billing_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  status: varchar("status").default("paid"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Templates table
export const proposalTemplates = pgTable("proposal_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // budget, governance, member, treasury, etc.
  description: text("description").notNull(),
  titleTemplate: text("title_template").notNull(),
  descriptionTemplate: text("description_template").notNull(),
  requiredFields: jsonb("required_fields").default([]), // array of field definitions
  votingPeriod: integer("voting_period").default(72), // hours
  quorumOverride: integer("quorum_override"), // override DAO default
  isGlobal: boolean("is_global").default(false), // available to all DAOs
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposals table
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposalType: varchar("proposal_type").default("general"), // general, budget, emergency, poll
  templateId: uuid("template_id").references(() => proposalTemplates.id),
  tags: jsonb("tags").default([]), // e.g., ["infrastructure", "education"]
  imageUrl: varchar("image_url"),
  pollOptions: jsonb("poll_options").default([]), // For poll-type proposals: [{id, label, votes}]
  allowMultipleChoices: boolean("allow_multiple_choices").default(false),
  proposer: varchar("proposer").references(() => users.id).notNull(),
  proposerId: varchar("proposer_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  status: varchar("status").default("active"), // draft, active, passed, failed, executed, expired
  voteStartTime: timestamp("vote_start_time").defaultNow(),
  voteEndTime: timestamp("vote_end_time").notNull(),
  quorumRequired: integer("quorum_required").default(100),
  yesVotes: integer("yes_votes").default(0),
  noVotes: integer("no_votes").default(0),
  abstainVotes: integer("abstain_votes").default(0),
  // legacy/alias fields referenced in other services
  forVotes: integer("for_votes").default(0),
  againstVotes: integer("against_votes").default(0),
  // optional free-form metadata used by some cross-service queries
  metadata: jsonb("metadata"),
  totalVotingPower: decimal("total_voting_power", { precision: 10, scale: 2 }).default("0"),
  executionData: jsonb("execution_data"), // data needed for automatic execution
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by").references(() => users.id),
  executionTxHash: varchar("execution_tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isFeatured: boolean("is_featured").default(false), // for featured proposals on DAO page
  likesCount: integer("likes_count").default(0), // Denormalized count for performance
  commentsCount: integer("comments_count").default(0), // Denormalized count for performance
});

// Vote Delegations table
export const voteDelegations = pgTable("vote_delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  delegatorId: varchar("delegator_id").references(() => users.id).notNull(),
  delegateId: varchar("delegate_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  scope: varchar("scope").default("all"), // all, category-specific, proposal-specific
  category: varchar("category"), // if scope is category-specific
  proposalId: uuid("proposal_id").references(() => proposals.id), // if scope is proposal-specific
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Votes table
export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  voteType: varchar("vote_type").notNull(), // yes, no, abstain
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.0"),
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0"),
  isDelegated: boolean("is_delegated").default(false),
  delegatedBy: varchar("delegated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quorum Calculations table (for historical tracking)
export const quorumHistory = pgTable("quorum_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  activeMemberCount: integer("active_member_count").notNull(),
  requiredQuorum: integer("required_quorum").notNull(),
  achievedQuorum: integer("achieved_quorum").default(0),
  quorumMet: boolean("quorum_met").default(false),
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

// Proposal Execution Queue table
export const proposalExecutionQueue = pgTable("proposal_execution_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  executionType: varchar("execution_type").notNull(), // treasury_transfer, member_action, etc.
  executionData: jsonb("execution_data").notNull(),
  status: varchar("status").default("pending"), // pending, executing, completed, failed
  attempts: integer("attempts").default(0),
  lastAttempt: timestamp("last_attempt"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contributions table
export const contributions = pgTable("contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  purpose: varchar("purpose").default("general"), // general, emergency, education, infrastructure
  isAnonymous: boolean("is_anonymous").default(false),
  transactionHash: varchar("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  vault : boolean("vault").default(false), // true if contribution goes to DAO vault

});

// Locked Savings table
export const lockedSavings = pgTable("locked_savings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  lockPeriod: integer("lock_period").notNull(), // in days
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.05"), // 5% default
  lockedAt: timestamp("locked_at").defaultNow(),
  unlocksAt: timestamp("unlocks_at").notNull(),
  status: varchar("status").default("locked"), // locked, unlocked, withdrawn
  penalty: decimal("penalty", { precision: 10, scale: 2 }).default("0"), // early withdrawal penalty
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Savings Goals table
export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0"),
  currency: varchar("currency").default("KES"),
  targetDate: timestamp("target_date"),
  category: varchar("category").default("general"), // emergency, education, business, housing, etc.
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Multi-Token Vaults table for Phase 3
export const vaults = pgTable("vaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Support both personal and DAO vaults
  userId: varchar("user_id").references(() => users.id), // nullable for DAO vaults
  daoId: uuid("dao_id").references(() => daos.id), // nullable for personal vaults
  name: varchar("name").default("Personal Vault"), // vault name with default for backward compatibility
  description: text("description"),
  currency: varchar("currency").notNull(), // primary currency, kept for backward compatibility
  address: varchar("address"), // wallet address for this vault
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"), // higher precision for crypto
  monthlyGoal: decimal("monthly_goal", { precision: 18, scale: 8 }).default("0"),
  vaultType: varchar("vault_type").default("regular"), // regular, savings, locked_savings, yield, dao_treasury
  lockDuration: integer("lock_duration"), // in days for locked savings
  lockedUntil: timestamp("locked_until"), // when locked savings unlocks
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0"), // annual interest rate for savings

  // Phase 3 enhancements
  isActive: boolean("is_active").default(true),
  riskLevel: varchar("risk_level").default("low"), // low, medium, high
  minDeposit: decimal("min_deposit", { precision: 18, scale: 8 }).default("0"),
  maxDeposit: decimal("max_deposit", { precision: 18, scale: 8 }),
  totalValueLocked: decimal("total_value_locked", { precision: 18, scale: 8 }).default("0"), // TVL in USD equivalent
  // accumulated yield numeric captured by some analytics services
  yieldGenerated: decimal("yield_generated", { precision: 18, scale: 8 }).default("0"),
  yieldStrategy: varchar("yield_strategy"), // references YIELD_STRATEGIES
  performanceFee: decimal("performance_fee", { precision: 5, scale: 4 }).default("0.1"), // 10% default
  managementFee: decimal("management_fee", { precision: 5, scale: 4 }).default("0.02"), // 2% annual default

  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Budget Plans table
export const budgetPlans = pgTable("budget_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  category: varchar("category").notNull(), // food, bills, mtaa_fund, savings, etc.
  allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0"),
  month: varchar("month").notNull(), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Memberships table
export const daoMemberships = pgTable("dao_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  role: varchar("role").default("member"), // member, proposer, elder, admin
  status: varchar("status").default("approved"), // "approved" | "pending" | "rejected"
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isBanned: boolean("is_banned").default(false), // for banning members from DAOs
  banReason: text("ban_reason"), // reason for banning, if applicable
  isElder: boolean("is_elder").default(false), // for elder members with special privileges
  isAdmin: boolean("is_admin").default(false), // for DAO admins with full control
  lastActive: timestamp("last_active").defaultNow(), // for quorum calculations
});

// Payment Requests table
export const paymentRequests = pgTable("payment_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id),
  toAddress: varchar("to_address"),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  description: text("description"),
  qrCode: text("qr_code"), // Base64 encoded QR code
  celoUri: text("celo_uri"), // celo://pay?address=...&amount=...&token=...
  status: varchar("status").default("pending"), // pending, paid, expired, cancelled
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  transactionHash: varchar("transaction_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Transactions table
export const paymentTransactions = pgTable('payment_transactions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reference: text('reference').notNull().unique(),
  type: text('type').notNull(),
  amount: text('amount').notNull(),
  currency: text('currency').notNull().default('KES'),
  provider: text('provider').notNull(),
  status: text('status').notNull().default('pending'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Payment Receipts table
export const paymentReceipts = pgTable("payment_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => walletTransactions.id),
  paymentRequestId: uuid("payment_request_id").references(() => paymentRequests.id),
  receiptNumber: varchar("receipt_number").notNull().unique(),
  pdfUrl: text("pdf_url"),
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Wallet Transactions table
export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id), // optional, for vault transactions
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id),
  walletAddress: varchar("wallet_address").notNull(),
  daoId: uuid("dao_id").references(() => daos.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  type: varchar("type").notNull(), // deposit, withdrawal, transfer, contribution
  status: varchar("status").default("completed"), // pending, completed, failed
  transactionHash: varchar("transaction_hash"),
  description: text("description"),
  disbursementId: varchar("disbursement_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Phase 3: Vault Token Holdings table for multi-token support
export const vaultTokenHoldings = pgTable("vault_token_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  tokenSymbol: varchar("token_symbol").notNull(), // e.g., 'CELO', 'cUSD', 'cEUR', 'USDT'
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull(),
  valueUSD: decimal("value_usd", { precision: 18, scale: 8 }).default("0"), // USD equivalent value
  lastPriceUpdate: timestamp("last_price_update").defaultNow(),
  averageEntryPrice: decimal("average_entry_price", { precision: 18, scale: 8 }), // for P&L calculations
  totalDeposited: decimal("total_deposited", { precision: 18, scale: 8 }).default("0"), // lifetime deposits
  totalWithdrawn: decimal("total_withdrawn", { precision: 18, scale: 8 }).default("0"), // lifetime withdrawals
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Phase 3: Vault Performance Metrics table
export const vaultPerformance = pgTable("vault_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  period: varchar("period").notNull(), // daily, weekly, monthly, yearly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  startingValue: decimal("starting_value", { precision: 18, scale: 8 }).notNull(),
  endingValue: decimal("ending_value", { precision: 18, scale: 8 }).notNull(),
  yield: decimal("yield", { precision: 18, scale: 8 }).default("0"), // yield earned in period
  yieldPercentage: decimal("yield_percentage", { precision: 8, scale: 4 }).default("0"), // yield %
  feesCollected: decimal("fees_collected", { precision: 18, scale: 8 }).default("0"),
  deposits: decimal("deposits", { precision: 18, scale: 8 }).default("0"), // deposits in period
  withdrawals: decimal("withdrawals", { precision: 18, scale: 8 }).default("0"), // withdrawals in period
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }), // risk-adjusted return
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }), // maximum loss percentage
  volatility: decimal("volatility", { precision: 8, scale: 4 }), // price volatility
  createdAt: timestamp("created_at").defaultNow(),
});

// Phase 3: Yield Strategy Allocations table
export const vaultStrategyAllocations = pgTable("vault_strategy_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  strategyId: varchar("strategy_id").notNull(), // references YIELD_STRATEGIES from tokenRegistry
  tokenSymbol: varchar("token_symbol").notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 18, scale: 8 }).notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }).notNull(), // % of vault
  currentValue: decimal("current_value", { precision: 18, scale: 8 }).default("0"),
  yieldEarned: decimal("yield_earned", { precision: 18, scale: 8 }).default("0"),
  lastRebalance: timestamp("last_rebalance").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Phase 3: Vault Transactions table for detailed tracking
export const vaultTransactions = pgTable("vault_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  transactionType: varchar("transaction_type").notNull(), // deposit, withdrawal, yield_claim, rebalance, fee_collection
  tokenSymbol: varchar("token_symbol").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  valueUSD: decimal("value_usd", { precision: 18, scale: 8 }).default("0"),
  transactionHash: varchar("transaction_hash"),
  blockNumber: integer("block_number"),
  gasUsed: decimal("gas_used", { precision: 18, scale: 8 }),
  gasFee: decimal("gas_fee", { precision: 18, scale: 8 }),
  status: varchar("status").default("completed"), // pending, completed, failed
  strategyId: varchar("strategy_id"), // if related to strategy allocation
  sharesMinted: decimal("shares_minted", { precision: 18, scale: 8 }), // vault shares for deposits
  sharesBurned: decimal("shares_burned", { precision: 18, scale: 8 }), // vault shares for withdrawals
  metadata: jsonb("metadata"), // additional transaction data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Phase 3: Vault Risk Assessments table
export const vaultRiskAssessments = pgTable("vault_risk_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  assessmentDate: timestamp("assessment_date").defaultNow(),
  overallRiskScore: integer("overall_risk_score").notNull(), // 1-100 scale
  liquidityRisk: integer("liquidity_risk").default(0), // 1-100 scale
  smartContractRisk: integer("smart_contract_risk").default(0),
  marketRisk: integer("market_risk").default(0),
  concentrationRisk: integer("concentration_risk").default(0),
  protocolRisk: integer("protocol_risk").default(0),
  riskFactors: jsonb("risk_factors"), // detailed risk breakdown
  recommendations: jsonb("recommendations"), // risk mitigation suggestions
  nextAssessmentDue: timestamp("next_assessment_due"),
  assessedBy: varchar("assessed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Phase 3: DAO Vault Governance table
export const vaultGovernanceProposals = pgTable("vault_governance_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  governanceType: varchar("governance_type").notNull(), // strategy_change, allocation_change, fee_change, risk_parameter
  proposedChanges: jsonb("proposed_changes").notNull(), // structured data of proposed changes
  currentParameters: jsonb("current_parameters"), // snapshot of current state
  requiredQuorum: integer("required_quorum").default(50), // percentage
  votingDeadline: timestamp("voting_deadline").notNull(),
  status: varchar("status").default("active"), // active, passed, failed, executed
  executedAt: timestamp("executed_at"),
  executionTxHash: varchar("execution_tx_hash"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Logs table for system events
export const logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g., "create_dao", "vote", "contribute"
  details: jsonb("details"), // additional details about the action
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs table for security logging
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id").references(() => users.id),
  userEmail: varchar("user_email"),
  action: varchar("action").notNull(),
  resource: varchar("resource").notNull(),
  resourceId: varchar("resource_id"),
  method: varchar("method").notNull(),
  endpoint: varchar("endpoint").notNull(),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: varchar("user_agent").notNull(),
  status: integer("status").notNull(),
  details: jsonb("details"),
  severity: varchar("severity").default("low").notNull(),
  category: varchar("category").default("security").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// System logs table for application logging
export const systemLogs = pgTable("system_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: varchar("level").default("info").notNull(),
  message: text("message").notNull(),
  service: varchar("service").default("api").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Notification history table
export const notificationHistory = pgTable("notification_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Recent DAO type for dashboard
export type RecentDao = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  memberCount: number;
  treasuryBalance: number;
  createdAt: Date;
};

// Top Member type for dashboard
export type TopMember = {
  userId: string;
  username: string;
  totalContributions: number;
  profileImageUrl?: string;
};

// ChainInfo type for blockchain-related data
export type ChainInfo = {
  chainId?: number;
  chainName?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
};

// SystemInfo type for system-related data
export type SystemInfo = {
  version?: string;
  uptime?: number; // in seconds
};

// Analytics type for superuser dashboard
export type Analytics = {
  daos: number;
  treasury: number;
  members: number;
  subscriptions: number;
  chainInfo: ChainInfo;
  system: SystemInfo;
  recentDaos: RecentDao[];
  topMembers: TopMember[];
  contractAddresses: string[];
  systemLogs: string[];
  roleCounts: Record<string, number>; // e.g., { member: 100, proposer: 50, elder: 20 }
  IsSuperUser: boolean; // for superuser dashboard access

};

export const chainInfo = pgTable("chain_info", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  chainName: varchar("chain_name").notNull(),
  nativeCurrency: jsonb("native_currency").notNull(), // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
  rpcUrl: varchar("rpc_url").notNull(),
  blockExplorerUrl: varchar("block_explorer_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chains = pgTable("chains", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  chainId: integer("chain_id").notNull(),
  rpcUrl: varchar("rpc_url").notNull(),
  blockExplorerUrl: varchar("block_explorer_url"),
  nativeCurrency: jsonb("native_currency").notNull(), // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Comments table
export const proposalComments = pgTable("proposal_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  content: text("content").notNull(),
  parentCommentId: uuid("parent_comment_id").references((): any => proposalComments.id), // for replies
  isEdited: boolean("is_edited").default(false),
  likesCount: integer("likes_count").default(0), // Denormalized count for performance
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Likes table
export const proposalLikes = pgTable("proposal_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comment Likes table
export const commentLikes = pgTable("comment_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  commentId: uuid("comment_id").references(() => proposalComments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// DAO Messages table for group chat
export const daoMessages = pgTable("dao_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"), // text, image, system
  replyToMessageId: uuid("reply_to_message_id").references((): any => daoMessages.id),
  isPinned: boolean("is_pinned").default(false),
  pinnedAt: timestamp("pinned_at"),
  pinnedBy: varchar("pinned_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Message Reactions table
export const messageReactions = pgTable("message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => daoMessages.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Message Attachments table
export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => daoMessages.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  plan: varchar("plan").default("free"), // free, premium
  status: varchar("status").default("active"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Reputation table
export const userReputation = pgTable("user_reputation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id),
  totalScore: integer("total_score").default(0),
  proposalScore: integer("proposal_score").default(0),
  voteScore: integer("vote_score").default(0),
  contributionScore: integer("contribution_score").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform Announcements table
export const platformAnnouncements = pgTable("platform_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).default("info"), // info, warning, error, success
  priority: integer("priority").default(0), // higher numbers = higher priority
  isActive: boolean("is_active").default(true),
  targetAudience: varchar("target_audience", { length: 50 }).default("all"), // all, members, admins, specific_dao
  targetDaoId: uuid("target_dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  linkUrl: varchar("link_url", { length: 500 }),
  linkText: varchar("link_text", { length: 100 }),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Announcement Views table
export const userAnnouncementViews = pgTable("user_announcement_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  announcementId: uuid("announcement_id").references(() => platformAnnouncements.id, { onDelete: 'cascade' }).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow(),
  dismissed: boolean("dismissed").default(false),
});

// Investment Pools Tables
export const investmentPools = pgTable("investment_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  description: text("description"),
  contractAddress: varchar("contract_address", { length: 255 }),
  totalValueLocked: decimal("total_value_locked", { precision: 18, scale: 8 }).default("0"),
  shareTokenSupply: decimal("share_token_supply", { precision: 18, scale: 8 }).default("0"),
  sharePrice: decimal("share_price", { precision: 18, scale: 8 }).default("1.0"),
  performanceFee: integer("performance_fee").default(200), // basis points
  minimumInvestment: decimal("minimum_investment", { precision: 18, scale: 2 }).default("10.00"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const poolAssets = pgTable("pool_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  assetSymbol: varchar("asset_symbol", { length: 10 }).notNull(),
  assetName: varchar("asset_name", { length: 100 }),
  tokenAddress: varchar("token_address", { length: 255 }),
  network: varchar("network", { length: 50 }),
  targetAllocation: integer("target_allocation").notNull(), // basis points
  currentBalance: decimal("current_balance", { precision: 18, scale: 8 }).default("0"),
  currentValueUsd: decimal("current_value_usd", { precision: 18, scale: 2 }).default("0"),
  lastPriceUsd: decimal("last_price_usd", { precision: 18, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const poolInvestments = pgTable("pool_investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  investmentAmountUsd: decimal("investment_amount_usd", { precision: 18, scale: 2 }).notNull(),
  sharesMinted: decimal("shares_minted", { precision: 18, scale: 8 }).notNull(),
  sharePriceAtInvestment: decimal("share_price_at_investment", { precision: 18, scale: 8 }).notNull(),
  paymentToken: varchar("payment_token", { length: 50 }),
  transactionHash: varchar("transaction_hash", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  investedAt: timestamp("invested_at").defaultNow(),
});

export const poolWithdrawals = pgTable("pool_withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sharesBurned: decimal("shares_burned", { precision: 18, scale: 8 }).notNull(),
  withdrawalValueUsd: decimal("withdrawal_value_usd", { precision: 18, scale: 2 }).notNull(),
  sharePriceAtWithdrawal: decimal("share_price_at_withdrawal", { precision: 18, scale: 8 }).notNull(),
  feeCharged: decimal("fee_charged", { precision: 18, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 18, scale: 2 }),
  transactionHash: varchar("transaction_hash", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  withdrawnAt: timestamp("withdrawn_at").defaultNow(),
});

export const poolRebalances = pgTable("pool_rebalances", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  initiatedBy: varchar("initiated_by").references(() => users.id),
  tvlBefore: decimal("tvl_before", { precision: 18, scale: 2 }),
  tvlAfter: decimal("tvl_after", { precision: 18, scale: 2 }),
  assetsChanged: jsonb("assets_changed"),
  transactionHash: varchar("transaction_hash", { length: 255 }),
  reason: text("reason"),
  status: varchar("status", { length: 50 }).default("completed"),
  rebalancedAt: timestamp("rebalanced_at").defaultNow(),
});

export const poolPerformance = pgTable("pool_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }),
  sharePrice: decimal("share_price", { precision: 18, scale: 8 }),
  totalReturnPercentage: decimal("total_return_percentage", { precision: 10, scale: 4 }),
  btcPrice: decimal("btc_price", { precision: 18, scale: 2 }),
  ethPrice: decimal("eth_price", { precision: 18, scale: 2 }),
  solPrice: decimal("sol_price", { precision: 18, scale: 2 }),
  bnbPrice: decimal("bnb_price", { precision: 18, scale: 2 }),
  xrpPrice: decimal("xrp_price", { precision: 18, scale: 2 }),
  ltcPrice: decimal("ltc_price", { precision: 18, scale: 2 }),
  volatility: decimal("volatility", { precision: 10, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  snapshotAt: timestamp("snapshot_at").defaultNow(),
});

// Phase 2: Portfolio Templates
export const portfolioTemplates = pgTable("portfolio_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  riskLevel: varchar("risk_level", { length: 50 }).notNull(),
  targetReturnAnnual: decimal("target_return_annual", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templateAssetAllocations = pgTable("template_asset_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => portfolioTemplates.id, { onDelete: 'cascade' }).notNull(),
  assetSymbol: varchar("asset_symbol", { length: 10 }).notNull(),
  targetAllocation: integer("target_allocation").notNull(),
});

export const rebalancingSettings = pgTable("rebalancing_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  autoRebalanceEnabled: boolean("auto_rebalance_enabled").default(false),
  rebalanceFrequency: varchar("rebalance_frequency", { length: 50 }).default("weekly"),
  rebalanceThreshold: integer("rebalance_threshold").default(500),
  lastRebalanceCheck: timestamp("last_rebalance_check"),
  nextRebalanceScheduled: timestamp("next_rebalance_scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assetPriceHistory = pgTable("asset_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetSymbol: varchar("asset_symbol", { length: 10 }).notNull(),
  priceUsd: decimal("price_usd", { precision: 18, scale: 2 }).notNull(),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  volume24h: decimal("volume_24h", { precision: 20, scale: 2 }),
  priceChange24h: decimal("price_change_24h", { precision: 10, scale: 4 }),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const poolSwapTransactions = pgTable("pool_swap_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  rebalanceId: uuid("rebalance_id").references(() => poolRebalances.id),
  fromAsset: varchar("from_asset", { length: 10 }).notNull(),
  toAsset: varchar("to_asset", { length: 10 }).notNull(),
  amountFrom: decimal("amount_from", { precision: 18, scale: 8 }).notNull(),
  amountTo: decimal("amount_to", { precision: 18, scale: 8 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }),
  dexUsed: varchar("dex_used", { length: 50 }),
  transactionHash: varchar("transaction_hash", { length: 255 }),
  gasFee: decimal("gas_fee", { precision: 18, scale: 8 }),
  status: varchar("status", { length: 50 }).default("pending"),
  swappedAt: timestamp("swapped_at").defaultNow(),
});

// Pool Governance - Weighted Voting System
export const poolProposals = pgTable("pool_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  proposalType: varchar("proposal_type", { length: 50 }).notNull(),
  details: jsonb("details"),
  totalVotingPower: decimal("total_voting_power", { precision: 18, scale: 8 }).default("0"),
  votesFor: decimal("votes_for", { precision: 18, scale: 8 }).default("0"),
  votesAgainst: decimal("votes_against", { precision: 18, scale: 8 }).default("0"),
  votesAbstain: decimal("votes_abstain", { precision: 18, scale: 8 }).default("0"),
  quorumRequired: decimal("quorum_required", { precision: 5, scale: 2 }).default("30.00"),
  approvalThreshold: decimal("approval_threshold", { precision: 5, scale: 2 }).default("51.00"),
  status: varchar("status", { length: 50 }).default("active"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  votingEndsAt: timestamp("voting_ends_at").notNull(),
  executedAt: timestamp("executed_at"),
  executionTxHash: varchar("execution_tx_hash", { length: 255 }),
  executionResult: jsonb("execution_result"),
});

export const poolVotes = pgTable("pool_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => poolProposals.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  vote: varchar("vote", { length: 20 }).notNull(),
  votingPower: decimal("voting_power", { precision: 18, scale: 8 }).notNull(),
  sharePercentage: decimal("share_percentage", { precision: 10, scale: 6 }),
  reason: text("reason"),
  votedAt: timestamp("voted_at").defaultNow(),
});

export const poolGovernanceSettings = pgTable("pool_governance_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  defaultQuorum: decimal("default_quorum", { precision: 5, scale: 2 }).default("30.00"),
  defaultApprovalThreshold: decimal("default_approval_threshold", { precision: 5, scale: 2 }).default("51.00"),
  votingPeriodDays: integer("voting_period_days").default(3),
  minSharesToPropose: decimal("min_shares_to_propose", { precision: 18, scale: 8 }).default("1.0"),
  proposalCooldownHours: integer("proposal_cooldown_hours").default(24),
  timelockHours: integer("timelock_hours").default(24),
  governanceEnabled: boolean("governance_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const poolVoteDelegations = pgTable("pool_vote_delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => investmentPools.id, { onDelete: 'cascade' }).notNull(),
  delegatorId: varchar("delegator_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  delegateId: varchar("delegate_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  delegatedShares: decimal("delegated_shares", { precision: 18, scale: 8 }).notNull(),
  isActive: boolean("is_active").default(true),
  delegatedAt: timestamp("delegated_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// Add unique constraints to prevent duplicate likes (temporarily commented out for debugging)
// export const proposalLikesIndex = index("proposal_likes_unique").on(proposalLikes.proposalId, proposalLikes.userId);
//export const commentLikesIndex = index("comment_likes_unique").on(commentLikes.commentId, commentLikes.userId);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  proposals: many(proposals),
  votes: many(votes),
  contributions: many(contributions),
  vaults: many(vaults),
  budgetPlans: many(budgetPlans),
  daoMemberships: many(daoMemberships),
  createdDaos: many(daos),
  referralRewards: many(referralRewards),
  sentTransactions: many(walletTransactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(walletTransactions, { relationName: "receivedTransactions" }),
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
  referrals: many(users),
  sessions: many(sessions),
  tasks: many(tasks),
  billingHistory: many(billingHistory),
  logs: many(logs),
  proposalComments: many(proposalComments),
  proposalLikes: many(proposalLikes),
  commentLikes: many(commentLikes),
  daoMessages: many(daoMessages),
  delegationsGiven: many(voteDelegations, { relationName: "delegationsGiven" }),
  delegationsReceived: many(voteDelegations, { relationName: "delegationsReceived" }),
}));

export const daosRelations = relations(daos, ({ one, many }) => ({
  creator: one(users, {
    fields: [daos.creatorId],
    references: [users.id],
  }),
  memberships: many(daoMemberships),
  proposals: many(proposals),
  messages: many(daoMessages),
  templates: many(proposalTemplates),
  delegations: many(voteDelegations),
}));

export const daoMembershipsRelations = relations(daoMemberships, ({ one }) => ({
  user: one(users, {
    fields: [daoMemberships.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [daoMemberships.daoId],
    references: [daos.id],
  }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  proposer: one(users, {
    fields: [proposals.proposerId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [proposals.daoId],
    references: [daos.id],
  }),
  template: one(proposalTemplates, {
    fields: [proposals.templateId],
    references: [proposalTemplates.id],
  }),
  votes: many(votes),
  comments: many(proposalComments),
  likes: many(proposalLikes),
  delegations: many(voteDelegations),
  executionQueue: many(proposalExecutionQueue),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [votes.proposalId],
    references: [proposals.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
  delegatedByUser: one(users, {
    fields: [votes.delegatedBy],
    references: [users.id],
  }),
}));

export const voteDelegationsRelations = relations(voteDelegations, ({ one }) => ({
  delegator: one(users, {
    fields: [voteDelegations.delegatorId],
    references: [users.id],
    relationName: "delegationsGiven",
  }),
  delegate: one(users, {
    fields: [voteDelegations.delegateId],
    references: [users.id],
    relationName: "delegationsReceived",
  }),
  dao: one(daos, {
    fields: [voteDelegations.daoId],
    references: [daos.id],
  }),
  proposal: one(proposals, {
    fields: [voteDelegations.proposalId],
    references: [proposals.id],
  }),
}));

export const proposalTemplatesRelations = relations(proposalTemplates, ({ one, many }) => ({
  dao: one(daos, {
    fields: [proposalTemplates.daoId],
    references: [daos.id],
  }),
  creator: one(users, {
    fields: [proposalTemplates.createdBy],
    references: [users.id],
  }),
  proposals: many(proposals),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  user: one(users, {
    fields: [contributions.userId],
    references: [users.id],
  }),
}));

export const vaultsRelations = relations(vaults, ({ one }) => ({
  user: one(users, {
    fields: [vaults.userId],
    references: [users.id],
  }),
}));

// Add richer vault relations used by service code (tokenHoldings, transactions, performance)
export const vaultsFullRelations = relations(vaults, ({ one, many }) => ({
  user: one(users, {
    fields: [vaults.userId],
    references: [users.id],
  }),
  tokenHoldings: many(vaultTokenHoldings),
  transactions: many(vaultTransactions),
  performance: many(vaultPerformance),
  strategyAllocations: many(vaultStrategyAllocations),
  riskAssessments: many(vaultRiskAssessments),
  governanceProposals: many(vaultGovernanceProposals),
}));

export const budgetPlansRelations = relations(budgetPlans, ({ one }) => ({
  user: one(users, {
    fields: [budgetPlans.userId],
    references: [users.id],
  }),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [walletTransactions.fromUserId],
    references: [users.id],
    relationName: "sentTransactions",
  }),
  toUser: one(users, {
    fields: [walletTransactions.toUserId],
    references: [users.id],
    relationName: "receivedTransactions",
  }),
}));

export const referralRewardsRelations = relations(referralRewards, ({ one }) => ({
  referrer: one(users, {
    fields: [referralRewards.referrerId],
    references: [users.id],
  }),
  referredUser: one(users, {
    fields: [referralRewards.referredUserId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const insertDaoSchema = createInsertSchema(daos);
export const insertProposalSchema = createInsertSchema(proposals);
export const insertVoteSchema = createInsertSchema(votes);
export const insertContributionSchema = createInsertSchema(contributions);
export const insertVaultSchema = createInsertSchema(vaults);
export const insertBudgetPlanSchema = createInsertSchema(budgetPlans);
export const insertDaoMembershipSchema = createInsertSchema(daoMemberships);
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions);
export const insertReferralRewardSchema = createInsertSchema(referralRewards);

// Notifications table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // membership, task, proposal, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  daoUpdates: boolean("dao_updates").default(true),
  proposalUpdates: boolean("proposal_updates").default(true),
  taskUpdates: boolean("task_updates").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task History table
export const taskHistory = pgTable("task_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(), // created, claimed, completed, etc.
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types
export type Dao = typeof daos.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type Vault = typeof vaults.$inferSelect;
export type BudgetPlan = typeof budgetPlans.$inferSelect;
export type DaoMembership = typeof daoMemberships.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TaskHistory = typeof taskHistory.$inferSelect;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type VoteDelegation = typeof voteDelegations.$inferSelect;
export type QuorumHistory = typeof quorumHistory.$inferSelect;
export type ProposalExecutionQueue = typeof proposalExecutionQueue.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertTaskHistorySchema = createInsertSchema(taskHistory);
export const insertProposalTemplateSchema = createInsertSchema(proposalTemplates);
export const insertVoteDelegationSchema = createInsertSchema(voteDelegations);

// Cross-chain transfers table
export const crossChainTransfers = pgTable('cross_chain_transfers', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id),
  sourceChain: text('source_chain').notNull(),
  destinationChain: text('destination_chain').notNull(),
  tokenAddress: text('token_address').notNull(),
  amount: text('amount').notNull(),
  destinationAddress: text('destination_address').notNull(),
  vaultId: text('vault_id'),
  status: text('status').notNull().default('pending'), // pending, bridging, completed, failed
  txHashSource: text('tx_hash_source'),
  txHashDestination: text('tx_hash_destination'),
  bridgeProtocol: text('bridge_protocol'), // layerzero, axelar, wormhole
  gasEstimate: text('gas_estimate'),
  bridgeFee: text('bridge_fee'),
  estimatedCompletionTime: timestamp('estimated_completion_time'),
  completedAt: timestamp('completed_at'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Cross-chain governance proposals
export const crossChainProposals = pgTable('cross_chain_proposals', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  proposalId: text('proposal_id').notNull(),
  chains: text('chains').array().notNull(), // Array of chain identifiers
  votesByChain: jsonb('votes_by_chain').default({}), // Chain-specific vote tallies
  quorumByChain: jsonb('quorum_by_chain').default({}),
  executionChain: text('execution_chain'), // Primary chain for execution
  bridgeProposalId: text('bridge_proposal_id'), // Cross-chain message ID
  syncStatus: text('sync_status').default('pending'), // pending, synced, failed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertQuorumHistorySchema = createInsertSchema(quorumHistory);
export const insertProposalExecutionQueueSchema = createInsertSchema(proposalExecutionQueue);

export type InsertDaoMembership = typeof daoMemberships.$inferInsert;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type InsertReferralReward = typeof referralRewards.$inferInsert;
export type InsertNotification = typeof notifications.$inferInsert;
export type InsertTaskHistory = typeof taskHistory.$inferInsert;
export type InsertProposalTemplate = typeof proposalTemplates.$inferInsert;
export type InsertVoteDelegation = typeof voteDelegations.$inferInsert;
export type InsertQuorumHistory = typeof quorumHistory.$inferInsert;
export type InsertProposalExecutionQueue = typeof proposalExecutionQueue.$inferInsert;

// Relations for new engagement tables
export const proposalCommentsRelations = relations(proposalComments, ({ one, many }) => ({
  proposal: one(proposals, {
    fields: [proposalComments.proposalId],
    references: [proposals.id],
  }),
  user: one(users, {
    fields: [proposalComments.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [proposalComments.daoId],
    references: [daos.id],
  }),
  parentComment: one(proposalComments, {
    fields: [proposalComments.parentCommentId],
    references: [proposalComments.id],
  }),
  replies: many(proposalComments),
  likes: many(commentLikes),
}));

export const proposalLikesRelations = relations(proposalLikes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalLikes.proposalId],
    references: [proposals.id],
  }),
  user: one(users, {
    fields: [proposalLikes.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [proposalLikes.daoId],
    references: [daos.id],
  }),
}));


// Daily Challenges Tables
export const dailyChallenges = pgTable('daily_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  challengeType: text('challenge_type').notNull(), // 'daily_deposit', 'streak_maintain', etc.
  targetAmount: text('target_amount'),
  pointsReward: integer('points_reward').default(50),
  isActive: boolean('is_active').default(true),
  validFrom: timestamp('valid_from').defaultNow(),
  validUntil: timestamp('valid_until'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const userChallenges = pgTable('user_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id).notNull(),
  challengeId: uuid('challenge_id').references(() => dailyChallenges.id),
  challengeType: text('challenge_type').notNull(),
  targetAmount: text('target_amount'),
  currentProgress: text('current_progress').default('0'),
  status: text('status').default('in_progress'), // 'in_progress', 'completed', 'failed'
  pointsReward: integer('points_reward').default(50),
  rewardClaimed: boolean('reward_claimed').default(false),
  claimedAt: timestamp('claimed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Add proposals table if not exists

// Add users table reference if not exists

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(proposalComments, {
    fields: [commentLikes.commentId],
    references: [proposalComments.id],
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [commentLikes.daoId],
    references: [daos.id],
  }),
}));

export const daoMessagesRelations = relations(daoMessages, ({ one, many }) => ({
  dao: one(daos, {
    fields: [daoMessages.daoId],
    references: [daos.id],
  }),
  user: one(users, {
    fields: [daoMessages.userId],
    references: [users.id],
  }),
  replyToMessage: one(daoMessages, {
    fields: [daoMessages.replyToMessageId],
    references: [daoMessages.id],
  }),
  replies: many(daoMessages),
}));

// New type exports
export type ProposalComment = typeof proposalComments.$inferSelect;
export type ProposalLike = typeof proposalLikes.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type DaoMessage = typeof daoMessages.$inferSelect;

export type InsertProposalComment = typeof proposalComments.$inferInsert;
export type InsertProposalLike = typeof proposalLikes.$inferInsert;
export type InsertCommentLike = typeof commentLikes.$inferInsert;
export type InsertDaoMessage = typeof daoMessages.$inferInsert;

// New Zod schemas
export const insertProposalCommentSchema = createInsertSchema(proposalComments);
export const insertProposalLikeSchema = createInsertSchema(proposalLikes);
export const insertCommentLikeSchema = createInsertSchema(commentLikes);
export const insertDaoMessageSchema = createInsertSchema(daoMessages);

// Phase 3: Enhanced Vault Types and Schemas
export type EnhancedVault = typeof vaults.$inferSelect;
export type InsertVault = typeof vaults.$inferInsert;
export type VaultTokenHolding = typeof vaultTokenHoldings.$inferSelect;
export type InsertVaultTokenHolding = typeof vaultTokenHoldings.$inferInsert;
export type VaultPerformance = typeof vaultPerformance.$inferSelect;
export type InsertVaultPerformance = typeof vaultPerformance.$inferInsert;
export type VaultTransaction = typeof vaultTransactions.$inferSelect;
export type InsertVaultTransaction = typeof vaultTransactions.$inferInsert;
export type VaultRiskAssessment = typeof vaultRiskAssessments.$inferSelect;
export type InsertVaultRiskAssessment = typeof vaultRiskAssessments.$inferInsert;
export type VaultStrategyAllocation = typeof vaultStrategyAllocations.$inferSelect;
export type InsertVaultStrategyAllocation = typeof vaultStrategyAllocations.$inferInsert;
export type VaultGovernanceProposal = typeof vaultGovernanceProposals.$inferSelect;
export type InsertVaultGovernanceProposal = typeof vaultGovernanceProposals.$inferInsert;

// Create Zod schemas for validation (Phase 3 enhanced)
export const insertEnhancedVaultSchema = createInsertSchema(vaults);
export const insertVaultTokenHoldingSchema = createInsertSchema(vaultTokenHoldings);
export const insertVaultTransactionSchema = createInsertSchema(vaultTransactions);
export const insertVaultPerformanceSchema = createInsertSchema(vaultPerformance);
export const insertVaultRiskAssessmentSchema = createInsertSchema(vaultRiskAssessments);
export const insertVaultStrategyAllocationSchema = createInsertSchema(vaultStrategyAllocations);
export const insertVaultGovernanceProposalSchema = createInsertSchema(vaultGovernanceProposals);

export * from './vestingSchema';
export * from './messageReactionsSchema';
export * from './kycSchema';
export * from './escrowSchema';
export * from './invoiceSchema';
export * from './securityEnhancedSchema';
export * from './financialEnhancedSchema';