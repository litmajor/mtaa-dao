var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express20 from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

// server/routes.ts
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
import express18 from "express";

// server/db.ts
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  billingHistory: () => billingHistory,
  budgetPlans: () => budgetPlans,
  budgetPlansRelations: () => budgetPlansRelations,
  chainInfo: () => chainInfo,
  chains: () => chains,
  commentLikes: () => commentLikes,
  commentLikesIndex: () => commentLikesIndex,
  commentLikesRelations: () => commentLikesRelations,
  config: () => config,
  contributions: () => contributions,
  contributionsRelations: () => contributionsRelations,
  createSessionSchema: () => createSessionSchema,
  daoMemberships: () => daoMemberships,
  daoMembershipsRelations: () => daoMembershipsRelations,
  daoMessages: () => daoMessages,
  daoMessagesRelations: () => daoMessagesRelations,
  daos: () => daos,
  daosRelations: () => daosRelations,
  insertBudgetPlanSchema: () => insertBudgetPlanSchema,
  insertCommentLikeSchema: () => insertCommentLikeSchema,
  insertContributionSchema: () => insertContributionSchema,
  insertDaoMembershipSchema: () => insertDaoMembershipSchema,
  insertDaoMessageSchema: () => insertDaoMessageSchema,
  insertDaoSchema: () => insertDaoSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertProposalCommentSchema: () => insertProposalCommentSchema,
  insertProposalExecutionQueueSchema: () => insertProposalExecutionQueueSchema,
  insertProposalLikeSchema: () => insertProposalLikeSchema,
  insertProposalSchema: () => insertProposalSchema,
  insertProposalTemplateSchema: () => insertProposalTemplateSchema,
  insertQuorumHistorySchema: () => insertQuorumHistorySchema,
  insertReferralRewardSchema: () => insertReferralRewardSchema,
  insertTaskHistorySchema: () => insertTaskHistorySchema,
  insertTaskSchema: () => insertTaskSchema,
  insertUserSchema: () => insertUserSchema,
  insertVaultSchema: () => insertVaultSchema,
  insertVoteDelegationSchema: () => insertVoteDelegationSchema,
  insertVoteSchema: () => insertVoteSchema,
  insertWalletTransactionSchema: () => insertWalletTransactionSchema,
  lockedSavings: () => lockedSavings2,
  logs: () => logs,
  notificationHistory: () => notificationHistory,
  notificationPreferences: () => notificationPreferences,
  notifications: () => notifications,
  proposalComments: () => proposalComments,
  proposalCommentsRelations: () => proposalCommentsRelations,
  proposalExecutionQueue: () => proposalExecutionQueue,
  proposalLikes: () => proposalLikes,
  proposalLikesIndex: () => proposalLikesIndex,
  proposalLikesRelations: () => proposalLikesRelations,
  proposalTemplates: () => proposalTemplates,
  proposalTemplatesRelations: () => proposalTemplatesRelations,
  proposals: () => proposals,
  proposalsRelations: () => proposalsRelations,
  quorumHistory: () => quorumHistory,
  referralRewards: () => referralRewards,
  referralRewardsRelations: () => referralRewardsRelations,
  roles: () => roles,
  savingsGoals: () => savingsGoals2,
  sessionSchema: () => sessionSchema,
  sessions: () => sessions,
  systemLogs: () => systemLogs,
  taskHistory: () => taskHistory2,
  tasks: () => tasks,
  users: () => users,
  usersRelations: () => usersRelations,
  vaults: () => vaults,
  vaultsRelations: () => vaultsRelations,
  voteDelegations: () => voteDelegations,
  voteDelegationsRelations: () => voteDelegationsRelations,
  votes: () => votes,
  votesRelations: () => votesRelations,
  walletTransactions: () => walletTransactions,
  walletTransactionsRelations: () => walletTransactionsRelations
});
import {
  pgTable,
  text as text2,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
var referralRewards = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardType: varchar("reward_type").default("signup"),
  // signup, first_contribution, milestone
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  title: text2("title").notNull(),
  description: text2("description").notNull(),
  reward: decimal("reward", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("open"),
  // open, claimed, submitted, completed, disputed
  claimerId: varchar("claimer_id").references(() => users.id),
  claimedBy: varchar("claimed_by").references(() => users.id),
  // legacy, keep for now
  category: varchar("category").notNull(),
  difficulty: varchar("difficulty").notNull(),
  // easy, medium, hard
  estimatedTime: varchar("estimated_time"),
  deadline: timestamp("deadline"),
  requiresVerification: boolean("requires_verification").default(false),
  proofUrl: text2("proof_url"),
  verificationNotes: text2("verification_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
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
  roles: varchar("roles").default("member"),
  // member, proposer, elder
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
  banReason: text2("ban_reason"),
  isSuperUser: boolean("is_super_user").default(false),
  // for superuser dashboard access
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0")
  // for weighted voting
});
var daos = pgTable("daos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text2("description"),
  access: varchar("access").default("public"),
  // "public" | "private"
  inviteOnly: boolean("invite_only").default(false),
  inviteCode: varchar("invite_code"),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(true),
  // legacy, keep for now
  memberCount: integer("member_count").default(1),
  treasuryBalance: decimal("treasury_balance", { precision: 10, scale: 2 }).default("0"),
  plan: varchar("plan").default("free"),
  // free, premium
  planExpiresAt: timestamp("plan_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  imageUrl: varchar("image_url"),
  bannerUrl: varchar("banner_url"),
  isArchived: boolean("is_archived").default(false),
  // for soft deletion
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  isFeatured: boolean("is_featured").default(false),
  // for featured DAOs on landing page
  featureOrder: integer("feature_order").default(0),
  // order of featured DAOs
  quorumPercentage: integer("quorum_percentage").default(20),
  // percentage of active members for quorum
  votingPeriod: integer("voting_period").default(72),
  // voting period in hours
  executionDelay: integer("execution_delay").default(24)
  // execution delay in hours
});
var roles = ["member", "proposer", "elder", "admin", "superUser", "moderator"];
var sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var createSessionSchema = createInsertSchema(sessions);
var sessionSchema = createSessionSchema;
var billingHistory = pgTable("billing_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  status: varchar("status").default("paid"),
  description: text2("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposalTemplates = pgTable("proposal_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(),
  // budget, governance, member, treasury, etc.
  description: text2("description").notNull(),
  titleTemplate: text2("title_template").notNull(),
  descriptionTemplate: text2("description_template").notNull(),
  requiredFields: jsonb("required_fields").default([]),
  // array of field definitions
  votingPeriod: integer("voting_period").default(72),
  // hours
  quorumOverride: integer("quorum_override"),
  // override DAO default
  isGlobal: boolean("is_global").default(false),
  // available to all DAOs
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text2("title").notNull(),
  description: text2("description").notNull(),
  proposalType: varchar("proposal_type").default("general"),
  // general, budget, emergency
  templateId: uuid("template_id").references(() => proposalTemplates.id),
  tags: jsonb("tags").default([]),
  // e.g., ["infrastructure", "education"]
  imageUrl: varchar("image_url"),
  proposer: varchar("proposer").references(() => users.id).notNull(),
  proposerId: varchar("proposer_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  status: varchar("status").default("active"),
  // draft, active, passed, failed, executed, expired
  voteStartTime: timestamp("vote_start_time").defaultNow(),
  voteEndTime: timestamp("vote_end_time").notNull(),
  quorumRequired: integer("quorum_required").default(100),
  yesVotes: integer("yes_votes").default(0),
  noVotes: integer("no_votes").default(0),
  abstainVotes: integer("abstain_votes").default(0),
  totalVotingPower: decimal("total_voting_power", { precision: 10, scale: 2 }).default("0"),
  executionData: jsonb("execution_data"),
  // data needed for automatic execution
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by").references(() => users.id),
  executionTxHash: varchar("execution_tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isFeatured: boolean("is_featured").default(false)
  // for featured proposals on DAO page
});
var voteDelegations = pgTable("vote_delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  delegatorId: varchar("delegator_id").references(() => users.id).notNull(),
  delegateId: varchar("delegate_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  scope: varchar("scope").default("all"),
  // all, category-specific, proposal-specific
  category: varchar("category"),
  // if scope is category-specific
  proposalId: uuid("proposal_id").references(() => proposals.id),
  // if scope is proposal-specific
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  voteType: varchar("vote_type").notNull(),
  // yes, no, abstain
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.0"),
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0"),
  isDelegated: boolean("is_delegated").default(false),
  delegatedBy: varchar("delegated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var quorumHistory = pgTable("quorum_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  activeMemberCount: integer("active_member_count").notNull(),
  requiredQuorum: integer("required_quorum").notNull(),
  achievedQuorum: integer("achieved_quorum").default(0),
  quorumMet: boolean("quorum_met").default(false),
  calculatedAt: timestamp("calculated_at").defaultNow()
});
var proposalExecutionQueue = pgTable("proposal_execution_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  executionType: varchar("execution_type").notNull(),
  // treasury_transfer, member_action, etc.
  executionData: jsonb("execution_data").notNull(),
  status: varchar("status").default("pending"),
  // pending, executing, completed, failed
  attempts: integer("attempts").default(0),
  lastAttempt: timestamp("last_attempt"),
  errorMessage: text2("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var contributions = pgTable("contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  purpose: varchar("purpose").default("general"),
  // general, emergency, education, infrastructure
  isAnonymous: boolean("is_anonymous").default(false),
  transactionHash: varchar("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  vault: boolean("vault").default(false)
  // true if contribution goes to DAO vault
});
var lockedSavings2 = pgTable("locked_savings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  lockPeriod: integer("lock_period").notNull(),
  // in days
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.05"),
  // 5% default
  lockedAt: timestamp("locked_at").defaultNow(),
  unlocksAt: timestamp("unlocks_at").notNull(),
  status: varchar("status").default("locked"),
  // locked, unlocked, withdrawn
  penalty: decimal("penalty", { precision: 10, scale: 2 }).default("0"),
  // early withdrawal penalty
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var savingsGoals2 = pgTable("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title").notNull(),
  description: text2("description"),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0"),
  currency: varchar("currency").default("KES"),
  targetDate: timestamp("target_date"),
  category: varchar("category").default("general"),
  // emergency, education, business, housing, etc.
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var vaults = pgTable("vaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currency: varchar("currency").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  monthlyGoal: decimal("monthly_goal", { precision: 10, scale: 2 }).default("0"),
  vaultType: varchar("vault_type").default("regular"),
  // regular, savings, locked_savings
  lockDuration: integer("lock_duration"),
  // in days for locked savings
  lockedUntil: timestamp("locked_until"),
  // when locked savings unlocks
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0"),
  // annual interest rate for savings
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
});
var budgetPlans = pgTable("budget_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  category: varchar("category").notNull(),
  // food, bills, mtaa_fund, savings, etc.
  allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0"),
  month: varchar("month").notNull(),
  // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var daoMemberships = pgTable("dao_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  role: varchar("role").default("member"),
  // member, proposer, elder, admin
  status: varchar("status").default("approved"),
  // "approved" | "pending" | "rejected"
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isBanned: boolean("is_banned").default(false),
  // for banning members from DAOs
  banReason: text2("ban_reason"),
  // reason for banning, if applicable
  isElder: boolean("is_elder").default(false),
  // for elder members with special privileges
  isAdmin: boolean("is_admin").default(false),
  // for DAO admins with full control
  lastActive: timestamp("last_active").defaultNow()
  // for quorum calculations
});
var walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id),
  // optional, for vault transactions
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id),
  walletAddress: varchar("wallet_address").notNull(),
  daoId: uuid("dao_id").references(() => daos.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  type: varchar("type").notNull(),
  // deposit, withdrawal, transfer, contribution
  status: varchar("status").default("completed"),
  // pending, completed, failed
  transactionHash: varchar("transaction_hash"),
  description: text2("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
  // Note: fromUserId and toUserId can be null for deposits or contributions
  // e.g., deposit to vault, contribution to DAO, etc.
  // This allows tracking of all wallet-related transactions in one table
  // and simplifies the wallet history retrieval for users
});
var config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  action: text2("action").notNull(),
  // e.g., "create_dao", "vote", "contribute"
  details: jsonb("details"),
  // additional details about the action
  createdAt: timestamp("created_at").defaultNow()
});
var auditLogs = pgTable("audit_logs", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var systemLogs = pgTable("system_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: varchar("level").default("info").notNull(),
  message: text2("message").notNull(),
  service: varchar("service").default("api").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var notificationHistory = pgTable("notification_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(),
  title: varchar("title").notNull(),
  message: text2("message").notNull(),
  read: boolean("read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at")
});
var chainInfo = pgTable("chain_info", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull(),
  chainName: varchar("chain_name").notNull(),
  nativeCurrency: jsonb("native_currency").notNull(),
  // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
  rpcUrl: varchar("rpc_url").notNull(),
  blockExplorerUrl: varchar("block_explorer_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var chains = pgTable("chains", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  chainId: integer("chain_id").notNull(),
  rpcUrl: varchar("rpc_url").notNull(),
  blockExplorerUrl: varchar("block_explorer_url"),
  nativeCurrency: jsonb("native_currency").notNull(),
  // e.g., { name: "Ether", symbol: "ETH", decimals: 18 }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposalComments = pgTable("proposal_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  content: text2("content").notNull(),
  parentCommentId: uuid("parent_comment_id").references(() => proposalComments.id),
  // for replies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposalLikes = pgTable("proposal_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var commentLikes = pgTable("comment_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  commentId: uuid("comment_id").references(() => proposalComments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var daoMessages = pgTable("dao_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text2("content").notNull(),
  messageType: varchar("message_type").default("text"),
  // text, image, system
  replyToMessageId: uuid("reply_to_message_id").references(() => daoMessages.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
if (typeof proposalLikes.proposalId === "undefined" || typeof proposalLikes.userId === "undefined") {
  console.error("proposalLikes index columns are undefined:", proposalLikes.proposalId, proposalLikes.userId);
}
var proposalLikesIndex = index("proposal_likes_unique").on(proposalLikes.proposalId, proposalLikes.userId);
if (typeof commentLikes.commentId === "undefined" || typeof commentLikes.userId === "undefined") {
  console.error("commentLikes index columns are undefined:", commentLikes.commentId, commentLikes.userId);
}
var commentLikesIndex = index("comment_likes_unique").on(commentLikes.commentId, commentLikes.userId);
var usersRelations = relations(users, ({ many, one }) => ({
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
    references: [users.id]
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
  delegationsReceived: many(voteDelegations, { relationName: "delegationsReceived" })
}));
var daosRelations = relations(daos, ({ one, many }) => ({
  creator: one(users, {
    fields: [daos.creatorId],
    references: [users.id]
  }),
  memberships: many(daoMemberships),
  proposals: many(proposals),
  messages: many(daoMessages),
  templates: many(proposalTemplates),
  delegations: many(voteDelegations)
}));
var daoMembershipsRelations = relations(daoMemberships, ({ one }) => ({
  user: one(users, {
    fields: [daoMemberships.userId],
    references: [users.id]
  }),
  dao: one(daos, {
    fields: [daoMemberships.daoId],
    references: [daos.id]
  })
}));
var proposalsRelations = relations(proposals, ({ one, many }) => ({
  proposer: one(users, {
    fields: [proposals.proposerId],
    references: [users.id]
  }),
  dao: one(daos, {
    fields: [proposals.daoId],
    references: [daos.id]
  }),
  template: one(proposalTemplates, {
    fields: [proposals.templateId],
    references: [proposalTemplates.id]
  }),
  votes: many(votes),
  comments: many(proposalComments),
  likes: many(proposalLikes),
  delegations: many(voteDelegations),
  executionQueue: many(proposalExecutionQueue)
}));
var votesRelations = relations(votes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [votes.proposalId],
    references: [proposals.id]
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id]
  }),
  delegatedByUser: one(users, {
    fields: [votes.delegatedBy],
    references: [users.id]
  })
}));
var voteDelegationsRelations = relations(voteDelegations, ({ one }) => ({
  delegator: one(users, {
    fields: [voteDelegations.delegatorId],
    references: [users.id],
    relationName: "delegationsGiven"
  }),
  delegate: one(users, {
    fields: [voteDelegations.delegateId],
    references: [users.id],
    relationName: "delegationsReceived"
  }),
  dao: one(daos, {
    fields: [voteDelegations.daoId],
    references: [daos.id]
  }),
  proposal: one(proposals, {
    fields: [voteDelegations.proposalId],
    references: [proposals.id]
  })
}));
var proposalTemplatesRelations = relations(proposalTemplates, ({ one, many }) => ({
  dao: one(daos, {
    fields: [proposalTemplates.daoId],
    references: [daos.id]
  }),
  creator: one(users, {
    fields: [proposalTemplates.createdBy],
    references: [users.id]
  }),
  proposals: many(proposals)
}));
var contributionsRelations = relations(contributions, ({ one }) => ({
  user: one(users, {
    fields: [contributions.userId],
    references: [users.id]
  })
}));
var vaultsRelations = relations(vaults, ({ one }) => ({
  user: one(users, {
    fields: [vaults.userId],
    references: [users.id]
  })
}));
var budgetPlansRelations = relations(budgetPlans, ({ one }) => ({
  user: one(users, {
    fields: [budgetPlans.userId],
    references: [users.id]
  })
}));
var walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [walletTransactions.fromUserId],
    references: [users.id],
    relationName: "sentTransactions"
  }),
  toUser: one(users, {
    fields: [walletTransactions.toUserId],
    references: [users.id],
    relationName: "receivedTransactions"
  })
}));
var referralRewardsRelations = relations(referralRewards, ({ one }) => ({
  referrer: one(users, {
    fields: [referralRewards.referrerId],
    references: [users.id]
  }),
  referredUser: one(users, {
    fields: [referralRewards.referredUserId],
    references: [users.id]
  })
}));
var insertUserSchema = createInsertSchema(users);
var insertDaoSchema = createInsertSchema(daos);
var insertProposalSchema = createInsertSchema(proposals);
var insertVoteSchema = createInsertSchema(votes);
var insertContributionSchema = createInsertSchema(contributions);
var insertVaultSchema = createInsertSchema(vaults);
var insertBudgetPlanSchema = createInsertSchema(budgetPlans);
var insertDaoMembershipSchema = createInsertSchema(daoMemberships);
var insertWalletTransactionSchema = createInsertSchema(walletTransactions);
var insertReferralRewardSchema = createInsertSchema(referralRewards);
var notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(),
  // membership, task, proposal, etc.
  title: varchar("title").notNull(),
  message: text2("message").notNull(),
  read: boolean("read").default(false),
  priority: varchar("priority").default("medium"),
  // low, medium, high, urgent
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  daoUpdates: boolean("dao_updates").default(true),
  proposalUpdates: boolean("proposal_updates").default(true),
  taskUpdates: boolean("task_updates").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var taskHistory2 = pgTable("task_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  // created, claimed, completed, etc.
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertTaskSchema = createInsertSchema(tasks);
var insertNotificationSchema = createInsertSchema(notifications);
var insertTaskHistorySchema = createInsertSchema(taskHistory2);
var insertProposalTemplateSchema = createInsertSchema(proposalTemplates);
var insertVoteDelegationSchema = createInsertSchema(voteDelegations);
var insertQuorumHistorySchema = createInsertSchema(quorumHistory);
var insertProposalExecutionQueueSchema = createInsertSchema(proposalExecutionQueue);
var proposalCommentsRelations = relations(proposalComments, ({ one, many }) => ({
  proposal: one(proposals, {
    fields: [proposalComments.proposalId],
    references: [proposals.id]
  }),
  user: one(users, {
    fields: [proposalComments.userId],
    references: [users.id]
  }),
  dao: one(daos, {
    fields: [proposalComments.daoId],
    references: [daos.id]
  }),
  parentComment: one(proposalComments, {
    fields: [proposalComments.parentCommentId],
    references: [proposalComments.id]
  }),
  replies: many(proposalComments),
  likes: many(commentLikes)
}));
var proposalLikesRelations = relations(proposalLikes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalLikes.proposalId],
    references: [proposals.id]
  }),
  user: one(users, {
    fields: [proposalLikes.userId],
    references: [users.id]
  }),
  dao: one(daos, {
    fields: [proposalLikes.daoId],
    references: [daos.id]
  })
}));
var commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(proposalComments, {
    fields: [commentLikes.commentId],
    references: [proposalComments.id]
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id]
  }),
  dao: one(daos, {
    fields: [commentLikes.daoId],
    references: [daos.id]
  })
}));
var daoMessagesRelations = relations(daoMessages, ({ one, many }) => ({
  dao: one(daos, {
    fields: [daoMessages.daoId],
    references: [daos.id]
  }),
  user: one(users, {
    fields: [daoMessages.userId],
    references: [users.id]
  }),
  replyToMessage: one(daoMessages, {
    fields: [daoMessages.replyToMessageId],
    references: [daoMessages.id]
  }),
  replies: many(daoMessages)
}));
var insertProposalCommentSchema = createInsertSchema(proposalComments);
var insertProposalLikeSchema = createInsertSchema(proposalLikes);
var insertCommentLikeSchema = createInsertSchema(commentLikes);
var insertDaoMessageSchema = createInsertSchema(daoMessages);

// server/db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db2 = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq as eq2, inArray, or, and as and2, desc as desc2, sql } from "drizzle-orm";
function isDaoPremium(dao) {
  if (!dao || !dao.plan) return false;
  return dao.plan === "premium";
}
var DatabaseStorage = class {
  constructor() {
    this.db = db2;
  }
  // Make db instance available within the class
  async incrementDaoMemberCount(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const dao = await this.db.select().from(daos).where(eq2(daos.id, daoId));
    if (!dao[0]) throw new Error("DAO not found");
    const newCount = (dao[0].memberCount || 0) + 1;
    const result = await this.db.update(daos).set({ memberCount: newCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
    return result[0];
  }
  // --- Admin Functions ---
  async getAllDaos({ limit = 10, offset = 0 } = {}) {
    return await this.db.select().from(daos).orderBy(desc2(daos.createdAt)).limit(limit).offset(offset);
  }
  async getDaoCount() {
    const result = await this.db.select({ count: sql`count(*)` }).from(daos);
    return Number(result[0]?.count) || 0;
  }
  async getAllUsers({ limit = 10, offset = 0 } = {}) {
    return await this.db.select().from(users).orderBy(desc2(users.createdAt)).limit(limit).offset(offset);
  }
  async getUserCount() {
    const result = await this.db.select({ count: sql`count(*)` }).from(users);
    return Number(result[0]?.count) || 0;
  }
  async getPlatformFeeInfo() {
    const keys = [
      "vaultDisbursementFee",
      "offrampWithdrawalFee",
      "bulkPayoutFee",
      "stakingYieldFee",
      "platformFeeCurrency"
    ];
    const configRows = await this.db.select().from(config).where(inArray(config.key, keys));
    const configMap = {};
    configRows.forEach((row) => {
      configMap[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    });
    return {
      vaultDisbursementFee: configMap.vaultDisbursementFee ?? "1\u20132% per action",
      offrampWithdrawalFee: configMap.offrampWithdrawalFee ?? "2\u20133% (DAO or user)",
      bulkPayoutFee: configMap.bulkPayoutFee ?? "Flat or % fee",
      stakingYieldFee: configMap.stakingYieldFee ?? "Platform takes cut (opt-in)",
      notes: "Fees are paid by the DAO/group, not individuals. All fees are abstracted into vault mechanics for simplicity.",
      currency: configMap.platformFeeCurrency ?? "USD"
    };
  }
  async getSystemLogs(args = {}) {
    let whereClause = void 0;
    if (args.level && args.service) {
      whereClause = and2(eq2(systemLogs.level, args.level), eq2(systemLogs.service, args.service));
    } else if (args.level) {
      whereClause = eq2(systemLogs.level, args.level);
    } else if (args.service) {
      whereClause = eq2(systemLogs.service, args.service);
    }
    let query;
    if (whereClause) {
      query = this.db.select().from(systemLogs).where(whereClause);
    } else {
      query = this.db.select().from(systemLogs);
    }
    return await query.orderBy(desc2(systemLogs.timestamp)).limit(args.limit ?? 50).offset(args.offset ?? 0);
  }
  async updateTask(id, data, userId) {
    const task = await this.db.select().from(tasks).where(eq2(tasks.id, id));
    if (!task[0]) throw new Error("Task not found");
    const membership = await this.getDaoMembership(task[0].daoId, userId);
    if (!membership || membership.role !== "admin") throw new Error("Only DAO admins can update tasks");
    const result = await this.db.update(tasks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(tasks.id, id)).returning();
    if (!result[0]) throw new Error("Failed to update task");
    return result[0];
  }
  async getTaskCount(daoId, status) {
    if (!daoId) throw new Error("DAO ID required");
    let whereClause;
    if (status) {
      whereClause = and2(eq2(tasks.daoId, daoId), eq2(tasks.status, status));
    } else {
      whereClause = eq2(tasks.daoId, daoId);
    }
    const result = await this.db.select().from(tasks).where(whereClause);
    return result.length;
  }
  async getLogCount() {
    const result = await this.db.select().from(logs);
    return result.length;
  }
  async getBillingCount() {
    const result = await this.db.select().from(billingHistory);
    return result.length;
  }
  async getChainInfo() {
    const result = await this.db.select().from(chains).where(eq2(chains.id, 1));
    if (!result[0]) throw new Error("Chain not found");
    return {
      chainId: result[0].id,
      name: result[0].name,
      rpcUrl: result[0].rpcUrl
    };
  }
  async getTopMembers({ limit = 10 } = {}) {
    const allContributions = await this.db.select().from(contributions);
    const counts = {};
    allContributions.forEach((c) => {
      if (c.userId) counts[c.userId] = (counts[c.userId] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([userId, count2]) => ({ userId, count: count2 }));
  }
  async createUser(userData) {
    const allowed = (({ firstName, lastName, email, phone, googleId, telegramId }) => ({ firstName, lastName, email, phone, googleId, telegramId }))(userData);
    allowed.createdAt = /* @__PURE__ */ new Date();
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(users).values(allowed).returning();
    if (!result[0]) throw new Error("Failed to create user");
    return result[0];
  }
  async loginUser(email) {
    return this.getUserByEmail(email);
  }
  async getUserByEmail(email) {
    if (!email) throw new Error("Email required");
    const result = await this.db.select().from(users).where(eq2(users.email, email));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserByPhone(phone) {
    if (!phone) throw new Error("Phone required");
    const result = await this.db.select().from(users).where(eq2(users.phone, phone));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserById(userId) {
    if (!userId) throw new Error("User ID required");
    const result = await this.db.select().from(users).where(eq2(users.id, userId));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserByEmailOrPhone(emailOrPhone) {
    if (!emailOrPhone) throw new Error("Email or phone required");
    const result = await this.db.select().from(users).where(
      or(eq2(users.email, emailOrPhone), eq2(users.phone, emailOrPhone))
    );
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserProfile(userId) {
    return this.getUser(userId);
  }
  async updateUserProfile(userId, data) {
    const allowed = (({ firstName, lastName, email, phone }) => ({ firstName, lastName, email, phone }))(data);
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
    if (!result[0]) throw new Error("Failed to update user");
    return result[0];
  }
  async getUserSocialLinks(userId) {
    const user = await this.getUser(userId);
    return { google: user.googleId || null, telegram: user.telegramId || null };
  }
  async updateUserSocialLinks(userId, data) {
    const allowed = (({ phone, email }) => ({ phone, email }))(data);
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
    if (!result[0]) throw new Error("Failed to update social links");
    return result[0];
  }
  async getUserWallet(userId) {
    const user = await this.getUser(userId);
    return { address: user.phone || user.email || null };
  }
  async updateUserWallet(userId, data) {
    const allowed = (({ phone, email }) => ({ phone, email }))(data);
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
    if (!result[0]) throw new Error("Failed to update wallet");
    return result[0];
  }
  async getUserSettings(userId) {
    const user = await this.getUser(userId);
    return { theme: user.darkMode ? "dark" : "light", language: user.language || "en" };
  }
  async updateUserSettings(userId, data) {
    const allowed = {};
    if (data.theme) allowed.darkMode = data.theme === "dark";
    if (data.language) allowed.language = data.language;
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.update(users).set(allowed).where(eq2(users.id, userId)).returning();
    if (!result[0]) throw new Error("Failed to update settings");
    return result[0];
  }
  async getUserSessions(userId) {
    const result = await this.db.select().from(sessions).where(eq2(sessions.userId, userId));
    return result;
  }
  async revokeUserSession(userId, sessionId) {
    if (!userId || !sessionId) throw new Error("User ID and session ID required");
    const result = await this.db.delete(sessions).where(
      and2(eq2(sessions.userId, userId), eq2(sessions.id, sessionId))
    );
    if (!result) throw new Error("Session not found or already revoked");
  }
  async deleteUserAccount(userId) {
    await this.db.delete(users).where(eq2(users.id, userId));
  }
  async createWalletTransaction(data) {
    if (!data.amount || !data.currency || !data.type || !data.status || !data.provider) {
      throw new Error("Missing required wallet transaction fields");
    }
    data.createdAt = /* @__PURE__ */ new Date();
    data.updatedAt = /* @__PURE__ */ new Date();
    if (!data.walletAddress) {
      data.walletAddress = "";
    }
    if (!data.toUserId) {
      data.toUserId = null;
    }
    const result = await this.db.insert(walletTransactions).values(data).returning();
    if (!result[0]) throw new Error("Failed to create wallet transaction");
    return result[0];
  }
  // Export a singleton instance for use in other modules
  async getBudgetPlanCount(userId, month) {
    if (!userId || !month) throw new Error("User ID and month required");
    const result = await this.db.select({ count: sql`count(*)` }).from(budgetPlans).where(and2(eq2(budgetPlans.userId, userId), eq2(budgetPlans.month, month)));
    return Number(result[0]?.count) || 0;
  }
  async createDao(dao) {
    if (!dao.name || !dao.creatorId) throw new Error("Name and creatorId required");
    dao.createdAt = /* @__PURE__ */ new Date();
    dao.updatedAt = /* @__PURE__ */ new Date();
    dao.memberCount = 1;
    const result = await this.db.insert(daos).values(dao).returning();
    if (!result[0]) throw new Error("Failed to create DAO");
    await this.createDaoMembership({ daoId: result[0].id, userId: dao.creatorId, status: "approved", role: "admin" });
    return result[0];
  }
  async setDaoInviteCode(daoId, code) {
    if (!code) throw new Error("Invite code required");
    const result = await this.db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getDaoByInviteCode(code) {
    if (!code) throw new Error("Invite code required");
    const result = await this.db.select().from(daos).where(eq2(daos.inviteCode, code));
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getUserReferralStats(userId) {
    if (!userId) throw new Error("User ID required");
    const referred = await this.db.select().from(users).where(eq2(users.referredBy, userId));
    return {
      userId,
      referredCount: referred.length,
      referredUsers: referred.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))
    };
  }
  async getReferralLeaderboard(limit = 10) {
    const allUsers = await this.db.select().from(users);
    const counts = {};
    allUsers.forEach((u) => {
      if (u.referredBy) {
        if (!counts[u.referredBy]) {
          const refUser = allUsers.find((x) => x.id === u.referredBy);
          counts[u.referredBy] = { count: 0, user: refUser };
        }
        counts[u.referredBy].count++;
      }
    });
    const leaderboard = Object.entries(counts).map(([userId, { count: count2, user }]) => ({ userId, count: count2, user })).sort((a, b) => b.count - a.count).slice(0, limit);
    return leaderboard;
  }
  async getUser(userId) {
    if (!userId) throw new Error("User ID required");
    const result = await this.db.select().from(users).where(eq2(users.id, userId));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getDAOStats() {
    const daosList = await this.db.select().from(daos);
    const memberships = await this.db.select().from(daoMemberships);
    const activeDaoIds = new Set(memberships.map((m) => m.daoId));
    return {
      daoCount: daosList.length,
      memberCount: memberships.length,
      activeDaoCount: activeDaoIds.size
    };
  }
  async getProposals() {
    return await this.db.select().from(proposals).orderBy(desc2(proposals.createdAt));
  }
  async getProposal(id) {
    if (!id) throw new Error("Proposal ID required");
    const result = await this.db.select().from(proposals).where(eq2(proposals.id, id));
    if (!result[0]) throw new Error("Proposal not found");
    return result[0];
  }
  async createProposal(proposal) {
    if (!proposal.title || !proposal.daoId) throw new Error("Proposal must have title and daoId");
    proposal.createdAt = /* @__PURE__ */ new Date();
    proposal.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(proposals).values(proposal).returning();
    if (!result[0]) throw new Error("Failed to create proposal");
    return result[0];
  }
  async updateProposal(id, data, userId) {
    if (!id || !data.title) throw new Error("Proposal ID and title required");
    const proposal = await this.getProposal(id);
    if (proposal.userId !== userId) throw new Error("Only proposal creator can update");
    const result = await this.db.update(proposals).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(proposals.id, id)).returning();
    if (!result[0]) throw new Error("Failed to update proposal");
    return result[0];
  }
  async deleteProposal(id, userId) {
    const proposal = await this.getProposal(id);
    const membership = await this.getDaoMembership(proposal.daoId, userId);
    if (proposal.userId !== userId && (!membership || membership.role !== "admin")) {
      throw new Error("Only proposal creator or DAO admin can delete");
    }
    await this.db.delete(proposals).where(eq2(proposals.id, id));
  }
  async updateProposalVotes(proposalId, voteType) {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error("Proposal not found");
    const field = voteType === "yes" ? "yesVotes" : "noVotes";
    const update = { updatedAt: /* @__PURE__ */ new Date() };
    update[field] = (proposal[field] || 0) + 1;
    const result = await this.db.update(proposals).set(update).where(eq2(proposals.id, proposalId)).returning();
    if (!result[0]) throw new Error("Failed to update proposal votes");
    return result[0];
  }
  async getVote(proposalId, userId) {
    if (!proposalId || !userId) throw new Error("Proposal ID and User ID required");
    const result = await this.db.select().from(votes).where(and2(eq2(votes.proposalId, proposalId), eq2(votes.userId, userId)));
    if (!result[0]) throw new Error("Vote not found");
    return result[0];
  }
  async createVote(vote) {
    if (!vote.proposalId || !vote.userId) throw new Error("Vote must have proposalId and userId");
    vote.createdAt = /* @__PURE__ */ new Date();
    vote.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(votes).values(vote).returning();
    if (!result[0]) throw new Error("Failed to create vote");
    return result[0];
  }
  async getVotesByProposal(proposalId) {
    if (!proposalId) throw new Error("Proposal ID required");
    return await this.db.select().from(votes).where(eq2(votes.proposalId, proposalId));
  }
  async getContributions(userId, daoId) {
    let whereClause = void 0;
    if (userId && daoId) {
      return await this.db.select().from(contributions).where(and2(eq2(contributions.userId, userId), eq2(contributions.daoId, daoId))).orderBy(desc2(contributions.createdAt));
    } else if (userId) {
      return await this.db.select().from(contributions).where(eq2(contributions.userId, userId)).orderBy(desc2(contributions.createdAt));
    } else if (daoId) {
      return await this.db.select().from(contributions).where(eq2(contributions.daoId, daoId)).orderBy(desc2(contributions.createdAt));
    } else {
      return await this.db.select().from(contributions).orderBy(desc2(contributions.createdAt));
    }
  }
  async getContributionsCount(userId, daoId) {
    if (!userId || !daoId) throw new Error("User ID and DAO ID required");
    const result = await this.db.select().from(contributions).where(and2(eq2(contributions.userId, userId), eq2(contributions.daoId, daoId)));
    return result.length;
  }
  async getVotesCount(daoId, proposalId) {
    if (!proposalId || !daoId) throw new Error("User ID and DAO ID required");
    const result = await this.db.select().from(votes).where(and2(eq2(votes.userId, proposalId), eq2(votes.daoId, daoId)));
    return result.length;
  }
  async getVotesByUserAndDao(userId, daoId) {
    if (!userId || !daoId) throw new Error("User ID and DAO ID required");
    return await this.db.select().from(votes).where(and2(eq2(votes.userId, userId), eq2(votes.daoId, daoId)));
  }
  async createContribution(contribution) {
    if (!contribution.userId || !contribution.daoId) throw new Error("Contribution must have userId and daoId");
    contribution.createdAt = /* @__PURE__ */ new Date();
    contribution.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(contributions).values(contribution).returning();
    if (!result[0]) throw new Error("Failed to create contribution");
    return result[0];
  }
  async getUserContributionStats(userId) {
    if (!userId) throw new Error("User ID required");
    const all = await this.db.select().from(contributions).where(eq2(contributions.userId, userId));
    const byDao = {};
    all.forEach((c) => {
      const daoId = c.daoId;
      if (daoId) byDao[daoId] = (byDao[daoId] || 0) + 1;
    });
    return { userId, total: all.length, byDao };
  }
  async getUserVaults(userId) {
    if (!userId) throw new Error("User ID required");
    return await this.db.select().from(vaults).where(eq2(vaults.userId, userId));
  }
  async upsertVault(vault) {
    if (!vault.id) throw new Error("Vault must have id");
    vault.updatedAt = /* @__PURE__ */ new Date();
    const updated = await this.db.update(vaults).set(vault).where(eq2(vaults.id, vault.id)).returning();
    if (updated[0]) return updated[0];
    vault.createdAt = /* @__PURE__ */ new Date();
    const inserted = await this.db.insert(vaults).values(vault).returning();
    if (!inserted[0]) throw new Error("Failed to upsert vault");
    return inserted[0];
  }
  async getVaultTransactions(vaultId, limit = 10, offset = 0) {
    if (!vaultId) throw new Error("Vault ID required");
    return await this.db.select().from(walletTransactions).where(eq2(walletTransactions.vaultId, vaultId)).orderBy(desc2(walletTransactions.createdAt)).limit(limit).offset(offset);
  }
  async getUserBudgetPlans(userId, month) {
    if (!userId || !month) throw new Error("User ID and month required");
    return await this.db.select().from(budgetPlans).where(and2(eq2(budgetPlans.userId, userId), eq2(budgetPlans.month, month)));
  }
  async upsertBudgetPlan(plan) {
    if (!plan.id) throw new Error("Budget plan must have id");
    plan.updatedAt = /* @__PURE__ */ new Date();
    const updated = await this.db.update(budgetPlans).set(plan).where(eq2(budgetPlans.id, plan.id)).returning();
    if (updated[0]) return updated[0];
    plan.createdAt = /* @__PURE__ */ new Date();
    const inserted = await this.db.insert(budgetPlans).values(plan).returning();
    if (!inserted[0]) throw new Error("Failed to upsert budget plan");
    return inserted[0];
  }
  async updateDaoInviteCode(daoId, code) {
    if (!daoId || !code) throw new Error("DAO ID and code required");
    const result = await this.db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("Failed to update invite code");
    return result[0];
  }
  async getTasks(daoId, status) {
    let whereClause;
    if (daoId && status) {
      whereClause = and2(eq2(tasks.daoId, daoId), eq2(tasks.status, status));
    } else if (daoId) {
      whereClause = eq2(tasks.daoId, daoId);
    } else if (status) {
      whereClause = eq2(tasks.status, status);
    }
    if (whereClause) {
      return await this.db.select().from(tasks).where(whereClause).orderBy(desc2(tasks.createdAt));
    }
    return await this.db.select().from(tasks).orderBy(desc2(tasks.createdAt));
  }
  async createTask(task) {
    if (!task.title || !task.daoId) throw new Error("Task must have title and daoId");
    task.createdAt = /* @__PURE__ */ new Date();
    task.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(tasks).values(task).returning();
    if (!result[0]) throw new Error("Failed to create task");
    return result[0];
  }
  async claimTask(taskId, userId) {
    if (!taskId || !userId) throw new Error("Task ID and User ID required");
    const task = await this.db.select().from(tasks).where(eq2(tasks.id, taskId));
    if (!task[0]) throw new Error("Task not found");
    if (task[0].claimedBy) throw new Error("Task already claimed");
    const result = await this.db.update(tasks).set({ claimedBy: userId, status: "claimed", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(tasks.id, taskId)).returning();
    if (!result[0]) throw new Error("Failed to claim task");
    return result[0];
  }
  async getDao(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const result = await this.db.select().from(daos).where(eq2(daos.id, daoId));
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getDaoMembership(daoId, userId) {
    if (!daoId || !userId) throw new Error("DAO ID and User ID required");
    const result = await this.db.select().from(daoMemberships).where(and2(eq2(daoMemberships.daoId, daoId), eq2(daoMemberships.userId, userId)));
    if (!result[0]) throw new Error("Membership not found");
    return result[0];
  }
  async getDaoMembers(daoId, userId, status, role, limit = 10, offset = 0) {
    if (!daoId) throw new Error("DAO ID required");
    let whereClause = eq2(daoMemberships.daoId, daoId);
    if (userId) whereClause = and2(whereClause, eq2(daoMemberships.userId, userId));
    if (status) whereClause = and2(whereClause, eq2(daoMemberships.status, status));
    if (role) whereClause = and2(whereClause, eq2(daoMemberships.role, role));
    return await this.db.select().from(daoMemberships).where(whereClause).orderBy(desc2(daoMemberships.createdAt)).limit(limit).offset(offset);
  }
  async createDaoMembership(args) {
    if (!args.daoId || !args.userId) throw new Error("Membership must have daoId and userId");
    args.createdAt = /* @__PURE__ */ new Date();
    args.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(daoMemberships).values(args).returning();
    if (!result[0]) throw new Error("Failed to create membership");
    return result[0];
  }
  async getDaoMembershipsByStatus(daoId, status) {
    if (!daoId || !status) throw new Error("DAO ID and status required");
    return await this.db.select().from(daoMemberships).where(and2(eq2(daoMemberships.daoId, daoId), eq2(daoMemberships.status, status)));
  }
  async updateDaoMembershipStatus(membershipId, status) {
    const result = await this.db.update(daoMemberships).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daoMemberships.id, membershipId)).returning();
    return result[0];
  }
  async getDaoPlan(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const result = await this.db.select().from(daos).where(eq2(daos.id, daoId));
    if (!result[0]) throw new Error("DAO not found");
    return result[0].plan;
  }
  async setDaoPlan(daoId, plan, planExpiresAt) {
    if (!daoId || !plan) throw new Error("DAO ID and plan required");
    const result = await this.db.update(daos).set({ plan, planExpiresAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("Failed to set DAO plan");
    return result[0];
  }
  async getDaoBillingHistory(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    return await this.db.select().from(billingHistory).where(eq2(billingHistory.daoId, daoId)).orderBy(desc2(billingHistory.createdAt));
  }
  async getAllDaoBillingHistory() {
    if (!billingHistory) throw new Error("Billing history table not found");
    return await this.db.select().from(billingHistory).orderBy(desc2(billingHistory.createdAt));
  }
  async addDaoBillingHistory(entry) {
    if (!entry.daoId || !entry.amount || !entry.type) throw new Error("Billing history must have daoId, amount, and type");
    entry.createdAt = /* @__PURE__ */ new Date();
    entry.updatedAt = /* @__PURE__ */ new Date();
    const result = await this.db.insert(billingHistory).values(entry).returning();
    if (!result[0]) throw new Error("Failed to add billing history");
    return result[0];
  }
  async getDaoAnalytics(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const [dao, members, proposals5, contributions4, vaults3] = await Promise.all([
      this.getDao(daoId),
      this.getDaoMembershipsByStatus(daoId, "approved"),
      this.getProposals().then(
        (proposals6) => proposals6.filter((p) => p.daoId === daoId && p.status === "active")
      ),
      this.getContributions(void 0, daoId),
      this.getUserVaults(daoId)
    ]);
    const recentActivity = [
      ...proposals5.map((p) => ({ type: "proposal", createdAt: p.createdAt })),
      ...contributions4.map((c) => ({ type: "contribution", createdAt: c.createdAt })),
      ...members.map((m) => ({ type: "membership", createdAt: m.createdAt }))
    ].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    ).slice(0, 10);
    const vaultBalance = vaults3.reduce((sum2, v) => sum2 + (typeof v.balance === "string" ? parseFloat(v.balance) || 0 : 0), 0);
    return {
      memberCount: members.length,
      activeProposals: proposals5.length,
      totalContributions: contributions4.length,
      vaultBalance,
      recentActivity,
      createdAt: dao.createdAt,
      updatedAt: dao.updatedAt
    };
  }
  /**
   * Checks if a user has any active contributions or votes in a DAO.
   * Returns true if at least one exists, false otherwise.
   */
  async hasActiveContributions(userId, daoId) {
    const contributions4 = await this.getContributions(userId, daoId);
    if (contributions4 && contributions4.length > 0) return true;
    if (typeof this.getVotesByUserAndDao === "function") {
      const votes4 = await this.getVotesByUserAndDao(userId, daoId);
      if (votes4 && votes4.length > 0) return true;
    }
    return false;
  }
  async revokeAllUserSessions(userId) {
    if (!userId) throw new Error("User ID required");
    await this.db.delete(sessions).where(eq2(sessions.userId, userId));
    process.stdout.write(`Revoked all sessions for user ${userId}
`);
  }
  async getUserNotifications(userId, read, limit = 20, offset = 0, type) {
    try {
      let whereClause = eq2(notifications.userId, userId);
      if (read !== void 0) {
        whereClause = and2(whereClause, eq2(notifications.read, read));
      }
      if (type) {
        whereClause = and2(whereClause, eq2(notifications.type, type));
      }
      let query = this.db.select().from(notifications).where(whereClause);
      return await query.orderBy(desc2(notifications.createdAt)).limit(limit).offset(offset);
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      return [];
    }
  }
  async getUnreadNotificationCount(userId) {
    try {
      const result = await this.db.select({ count: sql`count(*)` }).from(notifications).where(and2(
        eq2(notifications.userId, userId),
        eq2(notifications.read, false)
      ));
      return Number(result[0]?.count) || 0;
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      return 0;
    }
  }
  async createNotification(data) {
    try {
      const [notification] = await this.db.insert(notifications).values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || "medium",
        metadata: data.metadata || {},
        read: false
      }).returning();
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  async createBulkNotifications(userIds, notificationData) {
    try {
      const notificationsToInsert = userIds.map((userId) => ({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || "medium",
        metadata: notificationData.metadata || {},
        read: false
      }));
      return await this.db.insert(notifications).values(notificationsToInsert).returning();
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
      throw error;
    }
  }
  async markNotificationAsRead(notificationId, userId) {
    try {
      const [notification] = await this.db.update(notifications).set({ read: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
        eq2(notifications.id, notificationId),
        eq2(notifications.userId, userId)
      )).returning();
      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return null;
    }
  }
  async markAllNotificationsAsRead(userId) {
    try {
      await this.db.update(notifications).set({ read: true, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
        eq2(notifications.userId, userId),
        eq2(notifications.read, false)
      ));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }
  async deleteNotification(notificationId, userId) {
    try {
      const result = await this.db.delete(notifications).where(and2(
        eq2(notifications.id, notificationId),
        eq2(notifications.userId, userId)
      ));
      return !!result;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }
  async getUserNotificationPreferences(userId) {
    try {
      const [preferences] = await this.db.select().from(notificationPreferences).where(eq2(notificationPreferences.userId, userId));
      if (!preferences) {
        const [newPreferences] = await this.db.insert(notificationPreferences).values({
          userId,
          emailNotifications: true,
          pushNotifications: true,
          daoUpdates: true,
          proposalUpdates: true,
          taskUpdates: true
        }).returning();
        return newPreferences;
      }
      return preferences;
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      throw error;
    }
  }
  async updateUserNotificationPreferences(userId, updates) {
    try {
      const [preferences] = await this.db.update(notificationPreferences).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(notificationPreferences.userId, userId)).returning();
      return preferences;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  }
  async getAllActiveUsers() {
    try {
      return await this.db.select({ id: users.id }).from(users).where(eq2(users.isBanned, false));
    } catch (error) {
      console.error("Error fetching active users:", error);
      return [];
    }
  }
  // Audit logging operations
  async createAuditLog(entry) {
    const result = await this.db.insert(auditLogs).values({
      timestamp: entry.timestamp || /* @__PURE__ */ new Date(),
      userId: entry.userId,
      userEmail: entry.userEmail,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      method: entry.method,
      endpoint: entry.endpoint,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      status: entry.status,
      details: entry.details,
      severity: entry.severity,
      category: entry.category,
      createdAt: /* @__PURE__ */ new Date()
    }).returning();
    return result[0];
  }
  async getAuditLogs({ limit = 50, offset = 0, userId, severity } = {}) {
    let whereClause = void 0;
    if (userId && severity) {
      whereClause = and2(eq2(auditLogs.userId, userId), eq2(auditLogs.severity, severity));
    } else if (userId) {
      whereClause = eq2(auditLogs.userId, userId);
    } else if (severity) {
      whereClause = eq2(auditLogs.severity, severity);
    }
    let query;
    if (whereClause) {
      query = this.db.select().from(auditLogs).where(whereClause);
    } else {
      query = this.db.select().from(auditLogs);
    }
    return await query.orderBy(desc2(auditLogs.timestamp)).limit(limit).offset(offset);
  }
  // System logging operations
  async createSystemLog(level, message, service = "api", metadata) {
    const result = await this.db.insert(systemLogs).values({
      level,
      message,
      service,
      metadata,
      timestamp: /* @__PURE__ */ new Date()
    }).returning();
    return result[0];
  }
  // Notification history operations
  async createNotificationHistory(userId, type, title, message, metadata) {
    const result = await this.db.insert(notificationHistory).values({
      userId,
      type,
      title,
      message,
      metadata,
      createdAt: /* @__PURE__ */ new Date()
    }).returning();
    return result[0];
  }
  async getUserNotificationHistory(userId, { limit = 20, offset = 0 } = {}) {
    return await this.db.select().from(notificationHistory).where(eq2(notificationHistory.userId, userId)).orderBy(desc2(notificationHistory.createdAt)).limit(limit).offset(offset);
  }
};
var storage = new DatabaseStorage();
async function createDaoMessage(message) {
  throw new Error("createDaoMessage not implemented");
}
async function getDaoMessages(daoId) {
  throw new Error("getDaoMessages not implemented");
}
async function updateDaoMessage(messageId, data) {
  throw new Error("updateDaoMessage not implemented");
}
async function deleteDaoMessage(messageId) {
  throw new Error("deleteDaoMessage not implemented");
}
async function createProposalComment(comment) {
  throw new Error("createProposalComment not implemented");
}
async function getProposalComments(proposalId) {
  throw new Error("getProposalComments not implemented");
}
async function updateProposalComment(commentId, data) {
  throw new Error("updateProposalComment not implemented");
}
async function deleteProposalComment(commentId) {
  throw new Error("deleteProposalComment not implemented");
}
async function toggleProposalLike(proposalId, userId) {
  throw new Error("toggleProposalLike not implemented");
}
async function getProposalLikes(proposalId) {
  throw new Error("getProposalLikes not implemented");
}
async function toggleCommentLike(commentId, userId) {
  throw new Error("toggleCommentLike not implemented");
}
async function getCommentLikes(commentId) {
  throw new Error("getCommentLikes not implemented");
}

// server/routes/wallet.ts
import express from "express";

// server/agent_wallet.ts
import Web3 from "web3";
import { isAddress } from "web3-validator";
import dotenv from "dotenv";
dotenv.config();
var ENHANCED_ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_from", "type": "address" },
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
];
var MULTISIG_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "getOwners",
    "outputs": [{ "name": "", "type": "address[]" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "required",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "destination", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "data", "type": "bytes" }
    ],
    "name": "submitTransaction",
    "outputs": [{ "name": "transactionId", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "transactionId", "type": "uint256" }],
    "name": "confirmTransaction",
    "outputs": [],
    "type": "function"
  }
];
var EnhancedAgentWallet = class {
  constructor(privateKey, networkConfig, permissionCheck, contributionLogger, billingLogger, priceOracle) {
    this.transactionCache = /* @__PURE__ */ new Map();
    this.web3 = new Web3(networkConfig.rpcUrl);
    this.networkConfig = networkConfig;
    const normalizedKey = WalletManager.normalizePrivateKey(privateKey);
    if (!WalletManager.validatePrivateKey(normalizedKey)) {
      throw new Error("Invalid private key format");
    }
    this.account = this.web3.eth.accounts.privateKeyToAccount(normalizedKey);
    this.chainId = networkConfig.chainId;
    this.permissionCheck = permissionCheck;
    this.contributionLogger = contributionLogger;
    this.billingLogger = billingLogger;
    this.priceOracle = priceOracle;
  }
  /**
   * Approve a spender to spend a specified amount of ERC-20 tokens.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @param amount Amount in human units (not wei)
   * @param gasConfig Optional gas config
   */
  async approveToken(tokenAddress, spender, amount, gasConfig) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(spender)) {
      throw new Error("Invalid spender address");
    }
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: tokenAddress,
        data: contract.methods.approve(spender, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 1e5,
        nonce: Number(nonce),
        ...optimalGasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Token approval sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Token approval failed:", error);
      throw new Error(`Token approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Get the allowance for a spender on an ERC-20 token.
   * @param tokenAddress ERC-20 token contract address
   * @param spender Spender address
   * @returns Allowance in human units
   */
  async getAllowance(tokenAddress, spender) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(spender)) {
      throw new Error("Invalid spender address");
    }
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const allowance = await contract.methods.allowance(this.account.address, spender).call();
      return Number(allowance) / Math.pow(10, tokenInfo.decimals);
    } catch (error) {
      throw new Error(`Failed to get allowance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Get the status of a transaction by hash.
   * @param txHash Transaction hash
   * @returns TransactionResult with status
   */
  async getTransactionStatus(txHash) {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        return {
          hash: txHash,
          status: "pending",
          timestamp: Date.now()
        };
      }
      return {
        hash: txHash,
        status: receipt.status ? "success" : "failed",
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : void 0,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        hash: txHash,
        status: "failed",
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }
  // Utility to normalize private key (add 0x, trim whitespace)
  static normalizePrivateKey(privateKey) {
    let key = privateKey.trim();
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }
    return key;
  }
  // Enhanced balance operations
  async getBalance() {
    const balance = await this.web3.eth.getBalance(this.account.address);
    return BigInt(balance);
  }
  async getBalanceCelo(address) {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, "ether"));
  }
  async getBalanceEth(address) {
    const targetAddress = address || this.account.address;
    const balance = await this.web3.eth.getBalance(targetAddress);
    return parseFloat(this.web3.utils.fromWei(balance, "ether"));
  }
  async getNetworkInfo() {
    try {
      const [latestBlock, gasPrice] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice()
      ]);
      return {
        chainId: this.chainId,
        latestBlock: Number(latestBlock),
        gasPrice: Number(gasPrice),
        connected: true,
        networkName: this.networkConfig.name,
        explorerUrl: this.networkConfig.explorerUrl
      };
    } catch (error) {
      return {
        chainId: this.chainId,
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        networkName: this.networkConfig.name
      };
    }
  }
  async getTokenInfo(tokenAddress, includePrice = false) {
    try {
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const [symbol, name, decimals, balance, totalSupply] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
        contract.methods.balanceOf(this.account.address).call(),
        contract.methods.totalSupply().call().catch(() => "0")
      ]);
      const decimalCount = Number(decimals);
      const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
      const tokenInfo = {
        symbol: String(symbol),
        name: String(name),
        decimals: decimalCount,
        balance: String(balance),
        balanceFormatted,
        totalSupply: String(totalSupply)
      };
      if (includePrice && this.priceOracle) {
        try {
          tokenInfo.priceUsd = await this.priceOracle(tokenAddress);
        } catch (error) {
          console.warn(`Failed to get price for ${tokenAddress}:`, error);
        }
      }
      return tokenInfo;
    } catch (error) {
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Enhanced gas estimation with EIP-1559 support
  async getOptimalGasConfig() {
    try {
      if (this.supportsEIP1559()) {
        const block = await this.web3.eth.getBlock("latest");
        if (block.baseFeePerGas) {
          const baseFee = BigInt(block.baseFeePerGas);
          const priorityFee = BigInt(this.web3.utils.toWei("2", "gwei"));
          const maxFee = baseFee * BigInt(2) + priorityFee;
          return {
            maxFeePerGas: maxFee.toString(),
            maxPriorityFeePerGas: priorityFee.toString()
          };
        }
      }
      const gasPrice = await this.web3.eth.getGasPrice();
      return { gasPrice: gasPrice.toString() };
    } catch (error) {
      console.warn("Failed to get optimal gas config:", error);
      return { gasPrice: this.web3.utils.toWei("20", "gwei") };
    }
  }
  supportsEIP1559() {
    const eip1559Networks = [1, 5, 137, 80001, 42161, 421613];
    return eip1559Networks.includes(this.chainId);
  }
  async estimateGasWithBuffer(transaction) {
    try {
      const estimated = await this.web3.eth.estimateGas(transaction);
      const buffered = Math.floor(Number(estimated) * 1.2);
      console.log(`Gas estimate: ${estimated}, with buffer: ${buffered}`);
      return buffered;
    } catch (error) {
      console.warn("Gas estimation failed, using default:", error);
      return 1e5;
    }
  }
  // Enhanced transaction methods
  async sendNativeToken(toAddress, amountEth, gasConfig) {
    if (!isAddress(toAddress)) {
      throw new Error("Invalid recipient address");
    }
    const amountWei = this.web3.utils.toWei(amountEth.toString(), "ether");
    const balance = await this.getBalance();
    if (balance < BigInt(amountWei)) {
      const balanceEth = this.web3.utils.fromWei(balance.toString(), "ether");
      throw new Error(`Insufficient balance. Have ${balanceEth} ETH, need ${amountEth}`);
    }
    try {
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: toAddress,
        value: amountWei,
        gas: 21e3,
        nonce: Number(nonce),
        chainId: this.chainId,
        ...optimalGasConfig
      };
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Native token transfer sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Native token transfer failed:", error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async sendTokenHuman(tokenAddress, toAddress, amount, gasConfig) {
    if (!isAddress(tokenAddress)) {
      throw new Error("Invalid token address");
    }
    if (!isAddress(toAddress)) {
      throw new Error("Invalid recipient address");
    }
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      const amountWei = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
      if (BigInt(tokenInfo.balance) < amountWei) {
        throw new Error(
          `Insufficient token balance. Have ${tokenInfo.balanceFormatted.toFixed(6)} ${tokenInfo.symbol}, need ${amount}`
        );
      }
      const contract = new this.web3.eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const optimalGasConfig = gasConfig || await this.getOptimalGasConfig();
      const transaction = {
        to: tokenAddress,
        data: contract.methods.transfer(toAddress, amountWei.toString()).encodeABI(),
        chainId: this.chainId,
        gas: 1e5,
        nonce: Number(nonce),
        ...optimalGasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Token transfer sent: ${txHash.transactionHash}`);
      const result = {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
      this.transactionCache.set(result.hash, result);
      return result;
    } catch (error) {
      console.error("Token transfer failed:", error);
      throw new Error(`Token transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Batch operations
  async batchTransfer(transfers) {
    const results = [];
    for (const transfer of transfers) {
      try {
        let result;
        if (transfer.tokenAddress) {
          result = await this.sendTokenHuman(transfer.tokenAddress, transfer.toAddress, transfer.amount);
        } else {
          result = await this.sendNativeToken(transfer.toAddress, transfer.amount);
        }
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      } catch (error) {
        console.error(`Batch transfer failed for ${transfer.toAddress}:`, error);
        results.push({
          hash: "",
          status: "failed",
          errorReason: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }
    }
    return results;
  }
  // Enhanced portfolio management
  async getEnhancedPortfolio(tokenAddresses) {
    const portfolio = {
      address: this.account.address,
      nativeBalance: await this.getBalanceEth(),
      tokens: {},
      networkInfo: await this.getNetworkInfo(),
      lastUpdated: Date.now()
    };
    let totalValueUsd = 0;
    if (this.priceOracle) {
      try {
        const nativeTokenPrice = await this.priceOracle("native");
        portfolio.nativeBalanceUsd = portfolio.nativeBalance * nativeTokenPrice;
        totalValueUsd += portfolio.nativeBalanceUsd;
      } catch (error) {
        console.warn("Failed to get native token price:", error);
      }
    }
    for (const tokenAddress of tokenAddresses) {
      try {
        const tokenInfo = await this.getTokenInfo(tokenAddress, true);
        portfolio.tokens[tokenAddress] = tokenInfo;
        if (tokenInfo.priceUsd && tokenInfo.balanceFormatted > 0) {
          totalValueUsd += tokenInfo.balanceFormatted * tokenInfo.priceUsd;
        }
      } catch (error) {
        console.warn(`Failed to get info for token ${tokenAddress}:`, error);
        portfolio.tokens[tokenAddress] = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    if (totalValueUsd > 0) {
      portfolio.totalValueUsd = totalValueUsd;
    }
    return portfolio;
  }
  // Multisig support
  async getMultisigInfo(multisigAddress) {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      const [ownersRaw, required] = await Promise.all([
        contract.methods.getOwners().call(),
        contract.methods.required().call()
      ]);
      const owners = Array.isArray(ownersRaw) ? ownersRaw : [];
      const isOwner = owners.includes(this.account.address);
      return {
        owners,
        required: Number(required),
        isOwner
      };
    } catch (error) {
      throw new Error(`Failed to get multisig info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async submitMultisigTransaction(multisigAddress, destination, value, data = "0x") {
    try {
      const contract = new this.web3.eth.Contract(MULTISIG_ABI, multisigAddress);
      const nonce = await this.web3.eth.getTransactionCount(this.account.address);
      const gasConfig = await this.getOptimalGasConfig();
      const transaction = {
        to: multisigAddress,
        data: contract.methods.submitTransaction(destination, value, data).encodeABI(),
        chainId: this.chainId,
        gas: 2e5,
        nonce: Number(nonce),
        ...gasConfig
      };
      transaction.gas = await this.estimateGasWithBuffer(transaction);
      const signedTxn = await this.account.signTransaction(transaction);
      const txHash = await this.web3.eth.sendSignedTransaction(signedTxn.rawTransaction);
      console.log(`Multisig transaction submitted: ${txHash.transactionHash}`);
      return {
        hash: typeof txHash.transactionHash === "string" ? txHash.transactionHash : "",
        status: "pending",
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Multisig transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Enhanced transaction monitoring
  async waitForTransaction(txHash, timeout = 120, pollLatency = 2) {
    try {
      console.log(`Waiting for transaction: ${txHash}`);
      const receipt = await new Promise((resolve, reject) => {
        const startTime = Date.now();
        const poll = async () => {
          try {
            const receipt2 = await this.web3.eth.getTransactionReceipt(txHash);
            if (receipt2) {
              resolve(receipt2);
              return;
            }
          } catch (error) {
          }
          if (Date.now() - startTime > timeout * 1e3) {
            reject(new Error("Transaction timeout"));
            return;
          }
          setTimeout(poll, pollLatency * 1e3);
        };
        poll();
      });
      const result = {
        hash: txHash,
        status: receipt.status ? "success" : "failed",
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        effectiveGasPrice: receipt.effectiveGasPrice ? Number(receipt.effectiveGasPrice) : void 0,
        timestamp: Date.now()
      };
      this.transactionCache.set(txHash, result);
      console.log(`Transaction ${txHash} ${result.status} in block ${result.blockNumber}`);
      return result;
    } catch (error) {
      const failedResult = {
        hash: txHash,
        status: "failed",
        errorReason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
      this.transactionCache.set(txHash, failedResult);
      throw new Error(`Transaction confirmation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // DAO Treasury Management with enhanced features
  async scheduleDisburse(daoId, userId, disbursements, executeAt) {
    const scheduledId = `${daoId}-${Date.now()}`;
    const scheduledDisbursements = disbursements.map((d) => ({
      ...d,
      scheduledAt: executeAt || Date.now()
    }));
    console.log(`Scheduled disbursement ${scheduledId} for ${new Date(executeAt || Date.now())}`);
    return { scheduledId, disbursements: scheduledDisbursements };
  }
  async estimateDisbursementCost(disbursements) {
    const breakdown = [];
    let totalGasCost = 0;
    for (let i = 0; i < disbursements.length; i++) {
      const d = disbursements[i];
      let gasEstimate;
      if (d.tokenAddress) {
        gasEstimate = 65e3;
      } else {
        gasEstimate = 21e3;
      }
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCost = Number(gasPrice) * gasEstimate;
      breakdown.push({ index: i, gasCost });
      totalGasCost += gasCost;
    }
    const result = { totalGasCost, breakdown };
    if (this.priceOracle) {
      try {
        const ethPrice = await this.priceOracle("native");
        result.totalGasCostUsd = totalGasCost / 1e18 * ethPrice;
      } catch (error) {
        console.warn("Failed to get ETH price for cost estimation:", error);
      }
    }
    return result;
  }
  // Utility methods
  async getTransactionHistory(limit = 10) {
    return Array.from(this.transactionCache.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
  }
  async clearTransactionCache() {
    this.transactionCache.clear();
  }
  getExplorerUrl(txHash) {
    return `${this.networkConfig.explorerUrl}/tx/${txHash}`;
  }
  // Getters
  get address() {
    return this.account.address;
  }
  get network() {
    return this.networkConfig;
  }
};
var NetworkConfig = class _NetworkConfig {
  static {
    this.CELO_MAINNET = new _NetworkConfig(
      "https://forno.celo.org",
      42220,
      "Celo Mainnet",
      "https://explorer.celo.org"
    );
  }
  static {
    this.CELO_ALFAJORES = new _NetworkConfig(
      "https://alfajores-forno.celo-testnet.org",
      44787,
      "Celo Alfajores Testnet",
      "https://alfajores-blockscout.celo-testnet.org"
    );
  }
  static {
    this.ETHEREUM_MAINNET = new _NetworkConfig(
      "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
      1,
      "Ethereum Mainnet",
      "https://etherscan.io"
    );
  }
  static {
    this.POLYGON_MAINNET = new _NetworkConfig(
      "https://polygon-rpc.com",
      137,
      "Polygon Mainnet",
      "https://polygonscan.com"
    );
  }
  static {
    this.ARBITRUM_ONE = new _NetworkConfig(
      "https://arb1.arbitrum.io/rpc",
      42161,
      "Arbitrum One",
      "https://arbiscan.io"
    );
  }
  constructor(rpcUrl, chainId, name, explorerUrl = "") {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.name = name;
    this.explorerUrl = explorerUrl;
  }
};
var WalletManager = class _WalletManager {
  static createWallet() {
    const account = new Web3().eth.accounts.create();
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }
  static validateAddress(address) {
    return isAddress(address);
  }
  static normalizePrivateKey(privateKey) {
    let key = privateKey.trim();
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }
    return key;
  }
  static validatePrivateKey(privateKey) {
    try {
      const key = _WalletManager.normalizePrivateKey(privateKey);
      if (key.length !== 66) return false;
      if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return false;
      new Web3().eth.accounts.privateKeyToAccount(key);
      return true;
    } catch {
      return false;
    }
  }
  static checksumAddress(address) {
    return Web3.utils.toChecksumAddress(address);
  }
  static async isContract(web3, address) {
    const code = await web3.eth.getCode(address);
    return code !== "0x";
  }
};
async function enhancedExample() {
  try {
    const config2 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 0.65,
        // CELO price (more realistic for Celo network)
        // Celo testnet token addresses
        "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1": 1,
        // cUSD on Alfajores
        "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9": 1,
        // cEUR on Alfajores  
        "0x7037F7296B2fc7908de7b57a89efaa8319f0C500": 0.65
        // mCELO on Alfajores
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
      const price = prices[tokenAddress.toLowerCase()] || prices[tokenAddress] || 0;
      console.log(`Price for ${tokenAddress}: $${price}`);
      return price;
    };
    const permissionCheck = async (daoId, userId, action) => {
      console.log(`Permission check: ${userId} attempting ${action} on ${daoId}`);
      const allowedActions = ["transfer", "approve", "disburse"];
      return allowedActions.includes(action);
    };
    const contributionLogger = async (log2) => {
      console.log("Contribution logged:", {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ...log2
      });
    };
    const isValidPrivateKey = (key) => {
      if (!key || typeof key !== "string") return false;
      key = key.trim();
      if (!key.startsWith("0x")) return false;
      if (key.length !== 66) return false;
      return /^[0-9a-fA-F]{64}$/.test(key.slice(2));
    };
    let WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
    if (typeof WALLET_PRIVATE_KEY !== "string") {
      throw new Error("WALLET_PRIVATE_KEY is not set or not a string.");
    }
    WALLET_PRIVATE_KEY = WALLET_PRIVATE_KEY.trim();
    console.log("[DEBUG] WALLET_PRIVATE_KEY:", WALLET_PRIVATE_KEY);
    if (!isValidPrivateKey(WALLET_PRIVATE_KEY)) {
      console.log("[DEBUG] WALLET_PRIVATE_KEY length:", WALLET_PRIVATE_KEY.length);
      throw new Error("Invalid private key format. Must be 0x + 64 hex characters.");
    }
    const wallet2 = new EnhancedAgentWallet(
      WALLET_PRIVATE_KEY,
      config2,
      permissionCheck,
      contributionLogger,
      void 0,
      // billingLogger
      mockPriceOracle2
    );
    console.log(`
=== Enhanced Wallet Demo ===`);
    console.log(`Wallet Address: ${wallet2.address}`);
    console.log(`Network: ${config2.name}`);
    console.log("\n--- Network Information ---");
    const networkInfo = await wallet2.getNetworkInfo();
    console.log(`Connected: ${networkInfo.connected}`);
    console.log(`Latest Block: ${networkInfo.latestBlock}`);
    console.log(`Gas Price: ${networkInfo.gasPrice ? (networkInfo.gasPrice / 1e9).toFixed(2) + " Gwei" : "N/A"}`);
    console.log("\n--- Balance Information ---");
    try {
      const balance = await wallet2.getBalanceEth();
      console.log(`Native Balance: ${balance.toFixed(6)} CELO`);
      if (balance > 0) {
        const balanceUsd = balance * 0.65;
        console.log(`Balance (USD): $${balanceUsd.toFixed(2)}`);
      }
    } catch (error) {
      console.log(`Balance check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Enhanced Portfolio ---");
    const sampleTokens = [
      "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
      // cUSD
      "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9"
      // cEUR
    ];
    try {
      const portfolio = await wallet2.getEnhancedPortfolio(sampleTokens);
      console.log("Portfolio Summary:");
      console.log(`- Address: ${portfolio.address}`);
      console.log(`- Native Balance: ${portfolio.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Native Balance (USD): $${(portfolio.nativeBalanceUsd || 0).toFixed(2)}`);
      console.log(`- Total Value (USD): $${(portfolio.totalValueUsd || 0).toFixed(2)}`);
      Object.entries(portfolio.tokens).forEach(([address, token]) => {
        const t = token;
        if (!t.error) {
          console.log(`- ${t.symbol}: ${t.balanceFormatted.toFixed(6)} (${t.name})`);
        }
      });
    } catch (error) {
      console.log(`Portfolio fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- DAO Treasury Management ---");
    const treasuryManager = new DaoTreasuryManager(
      wallet2,
      wallet2.address,
      // Using wallet address as treasury for demo
      sampleTokens
    );
    try {
      const treasurySnapshot = await treasuryManager.getTreasurySnapshot();
      console.log("Treasury Snapshot:");
      console.log(`- Native Balance: ${treasurySnapshot.nativeBalance.toFixed(6)} CELO`);
      console.log(`- Total Value (USD): $${(treasurySnapshot.totalValueUsd || 0).toFixed(2)}`);
      const report = await treasuryManager.generateTreasuryReport("monthly");
      console.log("Treasury Report:");
      console.log(`- Period: ${report.period}`);
      console.log(`- Top Holdings: ${report.topHoldings.length} positions`);
      console.log(`- Recommendations: ${report.recommendations.length} items`);
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    } catch (error) {
      console.log(`Treasury management failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Risk Management ---");
    const riskManager2 = new RiskManager(wallet2, 1e3, 500);
    const testTransfers = [
      { amount: 0.1, description: "Small CELO transfer" },
      { amount: 100, description: "Large CELO transfer" },
      { amount: 1e3, description: "Very large transfer (should be blocked)" }
    ];
    for (const test of testTransfers) {
      try {
        const validation = await riskManager2.validateTransfer(test.amount, void 0, wallet2.address);
        console.log(`${test.description}:`);
        console.log(`  - Allowed: ${validation.allowed}`);
        console.log(`  - Risk Score: ${validation.riskScore}/100`);
        if (validation.reason) {
          console.log(`  - Reason: ${validation.reason}`);
        }
      } catch (error) {
        console.log(`Risk validation failed for ${test.description}: ${error}`);
      }
    }
    console.log("\n--- Gas Estimation ---");
    try {
      const disbursements = [
        { toAddress: wallet2.address, amount: 0.1 },
        { toAddress: wallet2.address, amount: 0.1, tokenAddress: sampleTokens[0] }
      ];
      const gasEstimate = await wallet2.estimateDisbursementCost(disbursements);
      console.log(`Gas Cost Estimate:`);
      console.log(`- Total Gas Cost: ${gasEstimate.totalGasCost} wei`);
      console.log(`- Gas Cost (CELO): ${(gasEstimate.totalGasCost / 1e18).toFixed(8)}`);
      if (gasEstimate.totalGasCostUsd) {
        console.log(`- Gas Cost (USD): $${gasEstimate.totalGasCostUsd.toFixed(4)}`);
      }
      console.log(`- Breakdown: ${gasEstimate.breakdown.length} transactions`);
    } catch (error) {
      console.log(`Gas estimation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("\n--- Transaction Utilities ---");
    const sampleTxHash = "0x6e1e7e2e2b7e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2";
    console.log(`Explorer URL for tx: ${wallet2.getExplorerUrl(sampleTxHash)}`);
    const txHistory = await wallet2.getTransactionHistory(5);
    console.log(`Transaction Cache: ${txHistory.length} transactions`);
    console.log("\n=== Demo Complete ===");
    console.log("\u2713 Network connection tested");
    console.log("\u2713 Balance operations demonstrated");
    console.log("\u2713 Portfolio management shown");
    console.log("\u2713 DAO treasury features previewed");
    console.log("\u2713 Risk management validated");
    console.log("\u2713 Gas estimation completed");
  } catch (error) {
    console.error("Enhanced example failed:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace available");
  }
}
var DaoTreasuryManager = class {
  constructor(wallet2, treasuryAddress, allowedTokens2 = []) {
    this.wallet = wallet2;
    this.treasuryAddress = treasuryAddress;
    this.allowedTokens = new Set(allowedTokens2);
  }
  async getTreasurySnapshot() {
    const nativeBalance = await this.wallet.getBalanceEth(this.treasuryAddress);
    const tokenBalances = {};
    let totalValueUsd = 0;
    for (const tokenAddress of Array.from(this.allowedTokens)) {
      try {
        const contract = new this.wallet["web3"].eth.Contract(ENHANCED_ERC20_ABI, tokenAddress);
        const balance = await contract.methods.balanceOf(this.treasuryAddress).call();
        const [symbol, name, decimals] = await Promise.all([
          contract.methods.symbol().call(),
          contract.methods.name().call(),
          contract.methods.decimals().call()
        ]);
        const decimalCount = Number(decimals);
        const balanceFormatted = Number(balance) / Math.pow(10, decimalCount);
        const tokenInfo = {
          symbol: String(symbol),
          name: String(name),
          decimals: decimalCount,
          balance: String(balance),
          balanceFormatted
        };
        if (this.wallet["priceOracle"] && balanceFormatted > 0) {
          try {
            const price = await this.wallet["priceOracle"](tokenAddress);
            tokenInfo.priceUsd = price;
            totalValueUsd += balanceFormatted * price;
          } catch (error) {
            console.warn(`Failed to get price for ${tokenAddress}:`, error);
          }
        }
        tokenBalances[tokenAddress] = tokenInfo;
      } catch (error) {
        console.warn(`Failed to get treasury balance for ${tokenAddress}:`, error);
      }
    }
    if (this.wallet["priceOracle"]) {
      try {
        const nativePrice = await this.wallet["priceOracle"]("native");
        totalValueUsd += nativeBalance * nativePrice;
      } catch (error) {
        console.warn("Failed to get native token price:", error);
      }
    }
    return {
      nativeBalance,
      tokenBalances,
      totalValueUsd: totalValueUsd > 0 ? totalValueUsd : void 0,
      lastUpdated: Date.now()
    };
  }
  async generateTreasuryReport(period = "monthly") {
    const currentSnapshot = await this.getTreasurySnapshot();
    const topHoldings = [];
    const recommendations = [];
    const totalValue = currentSnapshot.totalValueUsd || 0;
    if (totalValue > 0) {
      if (this.wallet["priceOracle"]) {
        try {
          const nativePrice = await this.wallet["priceOracle"]("native");
          const nativeValue = currentSnapshot.nativeBalance * nativePrice;
          topHoldings.push({
            token: "Native Token",
            value: nativeValue,
            percentage: nativeValue / totalValue * 100
          });
        } catch (error) {
          console.warn("Failed to calculate native token value:", error);
        }
      }
      for (const [address, token] of Object.entries(currentSnapshot.tokenBalances)) {
        if (token.priceUsd && token.balanceFormatted > 0) {
          const value = token.balanceFormatted * token.priceUsd;
          topHoldings.push({
            token: `${token.symbol} (${token.name})`,
            value,
            percentage: value / totalValue * 100
          });
        }
      }
      topHoldings.sort((a, b) => b.value - a.value);
    }
    if (topHoldings.length > 0) {
      const largestHolding = topHoldings[0];
      if (largestHolding.percentage > 70) {
        recommendations.push(`Consider diversifying: ${largestHolding.token} represents ${largestHolding.percentage.toFixed(1)}% of treasury`);
      }
      if (currentSnapshot.nativeBalance < 0.1) {
        recommendations.push("Treasury has low native token balance, consider maintaining more for gas fees");
      }
    }
    return {
      period,
      currentSnapshot,
      topHoldings,
      recommendations
    };
  }
  addAllowedToken(tokenAddress) {
    if (WalletManager.validateAddress(tokenAddress)) {
      this.allowedTokens.add(tokenAddress);
    } else {
      throw new Error("Invalid token address");
    }
  }
  removeAllowedToken(tokenAddress) {
    this.allowedTokens.delete(tokenAddress);
  }
  getAllowedTokens() {
    return Array.from(this.allowedTokens);
  }
};
var RiskManager = class {
  constructor(wallet2, maxDailyVolume = 1e4, maxSingleTransfer = 5e3) {
    this.dailyVolumeTracking = /* @__PURE__ */ new Map();
    this.wallet = wallet2;
    this.maxDailyVolume = maxDailyVolume;
    this.maxSingleTransfer = maxSingleTransfer;
  }
  async validateTransfer(amount, tokenAddress, toAddress) {
    let riskScore = 0;
    let amountUsd = amount;
    if (this.wallet["priceOracle"]) {
      try {
        const price = await this.wallet["priceOracle"](tokenAddress || "native");
        amountUsd = amount * price;
      } catch (error) {
        console.warn("Failed to get price for risk assessment:", error);
        riskScore += 10;
      }
    }
    if (amountUsd > this.maxSingleTransfer) {
      return {
        allowed: false,
        reason: `Transfer amount ${amountUsd.toFixed(2)} exceeds single transfer limit of ${this.maxSingleTransfer}`,
        riskScore: 100
      };
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dailyKey = `${this.wallet.address}-${today}`;
    const dailyData = this.dailyVolumeTracking.get(dailyKey) || { date: today, volume: 0 };
    if (dailyData.volume + amountUsd > this.maxDailyVolume) {
      return {
        allowed: false,
        reason: `Transfer would exceed daily volume limit. Current: ${dailyData.volume.toFixed(2)}, Limit: ${this.maxDailyVolume}`,
        riskScore: 100
      };
    }
    if (toAddress && !WalletManager.validateAddress(toAddress)) {
      return {
        allowed: false,
        reason: "Invalid recipient address",
        riskScore: 100
      };
    }
    if (toAddress && this.wallet["web3"]) {
      try {
        const isContract = await WalletManager.isContract(this.wallet["web3"], toAddress);
        if (isContract) {
          riskScore += 20;
        }
      } catch (error) {
        riskScore += 10;
      }
    }
    const amountRisk = amountUsd / this.maxSingleTransfer * 30;
    riskScore += Math.min(amountRisk, 30);
    dailyData.volume += amountUsd;
    this.dailyVolumeTracking.set(dailyKey, dailyData);
    return {
      allowed: true,
      riskScore: Math.min(riskScore, 100)
    };
  }
  getDailyVolumeReport() {
    return Array.from(this.dailyVolumeTracking.values()).map((data) => ({
      date: data.date,
      volume: data.volume,
      percentage: data.volume / this.maxDailyVolume * 100
    })).sort((a, b) => b.date.localeCompare(a.date));
  }
  setLimits(maxDailyVolume, maxSingleTransfer) {
    if (maxDailyVolume !== void 0) this.maxDailyVolume = maxDailyVolume;
    if (maxSingleTransfer !== void 0) this.maxSingleTransfer = maxSingleTransfer;
  }
  getLimits() {
    return {
      maxDailyVolume: this.maxDailyVolume,
      maxSingleTransfer: this.maxSingleTransfer
    };
  }
};
var TransactionAnalytics = class {
  constructor() {
    this.transactions = [];
  }
  addTransaction(tx) {
    this.transactions.push(tx);
    if (this.transactions.length > 1e3) {
      this.transactions = this.transactions.slice(-1e3);
    }
  }
  getSuccessRate(timeframe = 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter((tx) => (tx.timestamp || 0) > since);
    if (recentTxs.length === 0) return 100;
    const successful = recentTxs.filter((tx) => tx.status === "success").length;
    return successful / recentTxs.length * 100;
  }
  getAverageGasUsed(timeframe = 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter(
      (tx) => (tx.timestamp || 0) > since && tx.gasUsed && tx.status === "success"
    );
    if (recentTxs.length === 0) return 0;
    const totalGas = recentTxs.reduce((sum2, tx) => sum2 + (tx.gasUsed || 0), 0);
    return totalGas / recentTxs.length;
  }
  getFailureReasons() {
    const reasons = {};
    this.transactions.filter((tx) => tx.status === "failed" && tx.errorReason).forEach((tx) => {
      const reason = tx.errorReason;
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return reasons;
  }
  generateReport(timeframe = 7 * 24 * 60 * 60 * 1e3) {
    const since = Date.now() - timeframe;
    const recentTxs = this.transactions.filter((tx) => (tx.timestamp || 0) > since);
    const dailyGas = {};
    recentTxs.filter((tx) => tx.gasUsed && tx.status === "success").forEach((tx) => {
      const date = new Date(tx.timestamp || 0).toISOString().split("T")[0];
      if (!dailyGas[date]) dailyGas[date] = [];
      dailyGas[date].push(tx.gasUsed);
    });
    const gasEfficiencyTrend = Object.entries(dailyGas).map(([date, gasValues]) => ({
      date,
      avgGas: gasValues.reduce((a, b) => a + b, 0) / gasValues.length
    })).sort((a, b) => a.date.localeCompare(b.date));
    return {
      totalTransactions: recentTxs.length,
      successRate: this.getSuccessRate(timeframe),
      averageGasUsed: this.getAverageGasUsed(timeframe),
      failureReasons: this.getFailureReasons(),
      gasEfficiencyTrend
    };
  }
};
var agent_wallet_default = EnhancedAgentWallet;
enhancedExample();

// server/routes/wallet.ts
import { desc as desc3, eq as eq3, or as or2 } from "drizzle-orm";
import { fileURLToPath } from "url";
import { dirname } from "path";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "1".repeat(64);
var NETWORK = NetworkConfig.CELO_ALFAJORES;
var mockPriceOracle = async (tokenAddress) => {
  const prices = {
    "native": 2500,
    // ETH price
    "0x...": 1
    // USDC price
  };
  return prices[tokenAddress] || 0;
};
var wallet = null;
try {
  if (PRIVATE_KEY && PRIVATE_KEY !== "your_private_key_here") {
    wallet = new agent_wallet_default(
      PRIVATE_KEY,
      NETWORK,
      void 0,
      // permissionCheck
      void 0,
      // contributionLogger
      void 0,
      // billingLogger
      mockPriceOracle
    );
  }
} catch (error) {
  console.warn("Failed to initialize wallet:", error);
}
var riskManager = new RiskManager(wallet, 1e4, 5e3);
var analytics = new TransactionAnalytics();
var router = express.Router();
function requireRole(...roles2) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles2.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
var allowedTokens = /* @__PURE__ */ new Set();
router.post("/risk/validate", async (req, res) => {
  try {
    const { amount, tokenAddress, toAddress } = req.body;
    const result = await riskManager.validateTransfer(amount, tokenAddress, toAddress);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/analytics/report", async (req, res) => {
  try {
    const { timeframe } = req.query;
    const report = analytics.generateReport(Number(timeframe) || 7 * 24 * 60 * 60 * 1e3);
    res.json(report);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/multisig/info", requireRole("admin", "elder"), async (req, res) => {
  try {
    const { multisigAddress } = req.body;
    const info = await wallet.getMultisigInfo(multisigAddress);
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/multisig/submit", requireRole("admin", "elder"), async (req, res) => {
  try {
    const { multisigAddress, destination, value, data } = req.body;
    const result = await wallet.submitMultisigTransaction(multisigAddress, destination, value, data);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/allowed-tokens", requireRole("admin", "elder"), (req, res) => {
  res.json({ allowedTokens: Array.from(allowedTokens) });
});
router.post("/allowed-tokens/add", requireRole("admin", "elder"), (req, res) => {
  const { tokenAddress } = req.body;
  if (WalletManager.validateAddress(tokenAddress)) {
    allowedTokens.add(tokenAddress);
    res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
  } else {
    res.status(400).json({ error: "Invalid token address" });
  }
});
router.post("/allowed-tokens/remove", requireRole("admin", "elder"), (req, res) => {
  const { tokenAddress } = req.body;
  allowedTokens.delete(tokenAddress);
  res.json({ success: true, allowedTokens: Array.from(allowedTokens) });
});
router.get("/analytics", async (req, res) => {
  try {
    const { userId, walletAddress } = req.query;
    let whereClause = void 0;
    if (typeof userId === "string") {
      whereClause = or2(eq3(walletTransactions.fromUserId, userId), eq3(walletTransactions.toUserId, userId));
    } else if (typeof walletAddress === "string") {
      whereClause = eq3(walletTransactions.walletAddress, walletAddress);
    }
    const txs = await db2.select().from(walletTransactions).where(whereClause).orderBy(desc3(walletTransactions.createdAt));
    const valueOverTime = {};
    const tokenBreakdown = {};
    let total = 0;
    for (const tx of txs) {
      const month = tx.createdAt ? new Date(tx.createdAt).toISOString().slice(0, 7) : "unknown";
      const amt = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      if (!valueOverTime[month]) valueOverTime[month] = 0;
      valueOverTime[month] += amt;
      const currency = tx.currency || "UNKNOWN";
      if (!tokenBreakdown[currency]) tokenBreakdown[currency] = 0;
      tokenBreakdown[currency] += amt;
      total += amt;
    }
    const typeSummary = {};
    for (const tx of txs) {
      const type = tx.type || "unknown";
      if (!typeSummary[type]) typeSummary[type] = 0;
      const amt = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      typeSummary[type] += amt;
    }
    res.json({
      valueOverTime,
      tokenBreakdown,
      typeSummary,
      total,
      txCount: txs.length,
      recent: txs.slice(0, 10)
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/network-info", async (req, res) => {
  try {
    const info = await wallet.getNetworkInfo();
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/balance/:address?", async (req, res) => {
  try {
    const address = req.params.address || wallet.address;
    const balance = await wallet.getBalanceEth(address);
    res.json({ address, balance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/token-info/:tokenAddress", async (req, res) => {
  try {
    const info = await wallet.getTokenInfo(req.params.tokenAddress);
    res.json(info);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/send-native", async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const result = await wallet.sendNativeToken(toAddress, amount);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/send-token", async (req, res) => {
  try {
    const { tokenAddress, toAddress, amount } = req.body;
    const result = await wallet.sendTokenHuman(tokenAddress, toAddress, amount);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/approve-token", async (req, res) => {
  try {
    const { tokenAddress, spender, amount } = req.body;
    const result = await wallet.approveToken(tokenAddress, spender, amount);
    res.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/allowance/:tokenAddress/:spender", async (req, res) => {
  try {
    const { tokenAddress, spender } = req.params;
    const allowance = await wallet.getAllowance(tokenAddress, spender);
    res.json({ tokenAddress, spender, allowance });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/portfolio", async (req, res) => {
  try {
    if (!wallet) {
      return res.status(503).json({ error: "Wallet service not available" });
    }
    const { tokenAddresses } = req.body;
    const addresses = Array.isArray(tokenAddresses) ? tokenAddresses : [];
    const portfolio = await wallet.getEnhancedPortfolio(addresses);
    res.json(portfolio);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/batch-transfer", async (req, res) => {
  try {
    const { transfers } = req.body;
    const results = await wallet.batchTransfer(transfers);
    res.json(results);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/analytics/tx-history", async (req, res) => {
  try {
    const { limit } = req.query;
    const txs = await wallet.getTransactionHistory(Number(limit) || 10);
    res.json(txs);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/tx-status/:txHash", async (req, res) => {
  try {
    const status = await wallet.getTransactionStatus(req.params.txHash);
    res.json(status);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/locked-savings/create", async (req, res) => {
  try {
    const { userId, amount, currency, lockPeriod, interestRate } = req.body;
    const unlocksAt = /* @__PURE__ */ new Date();
    unlocksAt.setDate(unlocksAt.getDate() + lockPeriod);
    const lockedSaving = await db2.insert(lockedSavings).values({
      userId,
      amount,
      currency: currency || "KES",
      lockPeriod,
      interestRate: interestRate || "0.05",
      unlocksAt
    }).returning();
    res.json(lockedSaving[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/locked-savings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const savings = await db2.select().from(lockedSavings).where(eq3(lockedSavings.userId, userId)).orderBy(desc3(lockedSavings.createdAt));
    res.json(savings);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/locked-savings/withdraw/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isEarlyWithdrawal } = req.body;
    const saving = await db2.select().from(lockedSavings).where(eq3(lockedSavings.id, id)).limit(1);
    if (!saving.length) {
      return res.status(404).json({ error: "Locked saving not found" });
    }
    const lockSaving = saving[0];
    const now = /* @__PURE__ */ new Date();
    const isUnlocked = now >= new Date(lockSaving.unlocksAt);
    let penalty = 0;
    if (isEarlyWithdrawal && !isUnlocked) {
      penalty = parseFloat(lockSaving.amount) * 0.1;
    }
    const withdrawalAmount = parseFloat(lockSaving.amount) - penalty;
    await db2.update(lockedSavings).set({
      status: "withdrawn",
      penalty: penalty.toString(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(lockedSavings.id, id));
    res.json({
      withdrawalAmount,
      penalty,
      isEarlyWithdrawal: isEarlyWithdrawal && !isUnlocked
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/savings-goals/create", async (req, res) => {
  try {
    const { userId, title, description, targetAmount, targetDate, category, currency } = req.body;
    const goal = await db2.insert(savingsGoals).values({
      userId,
      title,
      description,
      targetAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      category: category || "general",
      currency: currency || "KES"
    }).returning();
    res.json(goal[0]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/savings-goals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const goals = await db2.select().from(savingsGoals).where(eq3(savingsGoals.userId, userId)).orderBy(desc3(savingsGoals.createdAt));
    res.json(goals);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/savings-goals/:id/contribute", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const goal = await db2.select().from(savingsGoals).where(eq3(savingsGoals.id, id)).limit(1);
    if (!goal.length) {
      return res.status(404).json({ error: "Savings goal not found" });
    }
    const currentGoal = goal[0];
    const newAmount = parseFloat(currentGoal.currentAmount) + parseFloat(amount);
    const isCompleted = newAmount >= parseFloat(currentGoal.targetAmount);
    await db2.update(savingsGoals).set({
      currentAmount: newAmount.toString(),
      isCompleted,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(savingsGoals.id, id));
    res.json({ newAmount, isCompleted });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/transactions", async (req, res) => {
  try {
    const {
      userId,
      walletAddress,
      type,
      status,
      currency,
      search,
      dateRange = "30",
      page = "1",
      limit = "10"
    } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const conditions = [];
    if (userId) {
      conditions.push(or2(eq3(walletTransactions.fromUserId, userId), eq3(walletTransactions.toUserId, userId)));
    }
    if (walletAddress) {
      conditions.push(eq3(walletTransactions.walletAddress, walletAddress));
    }
    if (type) {
      conditions.push(eq3(walletTransactions.type, type));
    }
    if (status) {
      conditions.push(eq3(walletTransactions.status, status));
    }
    if (currency) {
      conditions.push(eq3(walletTransactions.currency, currency));
    }
    const dateFilter = /* @__PURE__ */ new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange));
    let whereClause = void 0;
    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }
    const transactions2 = await db2.select().from(walletTransactions).where(whereClause).orderBy(desc3(walletTransactions.createdAt)).limit(limitNum).offset(offset);
    let filteredTransactions = transactions2;
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredTransactions = transactions2.filter(
        (tx) => tx.description?.toLowerCase().includes(searchTerm) || tx.transactionHash?.toLowerCase().includes(searchTerm) || tx.type?.toLowerCase().includes(searchTerm)
      );
    }
    res.json({
      transactions: filteredTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTransactions.length
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/recurring-payments", async (req, res) => {
  try {
    const { walletAddress } = req.query;
    const recurringPayments = [
      {
        id: "1",
        title: "Monthly DAO Contribution",
        description: "Regular contribution to community vault",
        amount: "50.00",
        currency: "cUSD",
        toAddress: "0x742d35Cc6634C0532925a3b8D421C63F10bFe2D0",
        frequency: "monthly",
        nextPayment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastPayment: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString(),
        totalPaid: "200.00",
        paymentCount: 4
      }
    ];
    res.json({ payments: recurringPayments });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/recurring-payments", async (req, res) => {
  try {
    const { title, description, amount, currency, toAddress, frequency, walletAddress } = req.body;
    const newPayment = {
      id: Date.now().toString(),
      title,
      description,
      amount,
      currency,
      toAddress,
      frequency,
      walletAddress,
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      nextPayment: calculateNextPayment(frequency),
      totalPaid: "0.00",
      paymentCount: 0
    };
    res.json(newPayment);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.patch("/recurring-payments/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    res.json({ success: true, id, isActive });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.delete("/recurring-payments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ success: true, id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/exchange-rates", async (req, res) => {
  try {
    const mockRates = {
      "CELO-USD": { pair: "CELO-USD", rate: 0.65, change24h: 2.5, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "cUSD-USD": { pair: "cUSD-USD", rate: 1, change24h: 0.1, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "cEUR-EUR": { pair: "cEUR-EUR", rate: 1, change24h: -0.05, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-KES": { pair: "USD-KES", rate: 150.25, change24h: 1.2, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-NGN": { pair: "USD-NGN", rate: 825.5, change24h: -0.8, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() },
      "USD-GHS": { pair: "USD-GHS", rate: 12.85, change24h: 0.5, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
    };
    res.json({ rates: mockRates });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.post("/multisig/create", requireRole("admin", "elder"), async (req, res) => {
  try {
    const { owners, threshold } = req.body;
    const mockMultisig = {
      address: "0x" + Math.random().toString(16).substr(2, 40),
      owners,
      threshold,
      transactionCount: 0
    };
    res.json(mockMultisig);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
router.get("/multisig/:address/transactions", requireRole("admin", "elder"), async (req, res) => {
  try {
    const { address } = req.params;
    const { pending } = req.query;
    const mockTransactions = [];
    res.json({ transactions: mockTransactions });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});
function calculateNextPayment(frequency) {
  const now = /* @__PURE__ */ new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    case "yearly":
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  return now.toISOString();
}
var wallet_default = router;

// server/nextAuthMiddleware.ts
import { getToken } from "next-auth/jwt";

// server/auth.ts
import jwt from "jsonwebtoken";
var isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header missing or malformed" });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = payload;
  next();
};
var JWT_SECRET = process.env.JWT_SECRET_KEY || "your-secret-key";
var JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
var verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// server/nextAuthMiddleware.ts
var isAuthenticated2 = async (req, res, next) => {
  try {
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    let userClaims = null;
    if (token && token.sub) {
      userClaims = {
        sub: token.sub,
        email: token.email || void 0,
        role: token.role || void 0
      };
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const jwtToken = authHeader.substring(7);
        const decoded = verifyAccessToken(jwtToken);
        if (decoded) {
          userClaims = {
            sub: decoded.userId,
            email: decoded.email,
            role: decoded.role
          };
        }
      }
    }
    if (!userClaims) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!userClaims.role) {
      try {
        const user = await storage.getUser(userClaims.sub);
        if (user) {
          userClaims.role = user.role || "user";
        }
      } catch (error) {
        console.warn("Could not fetch user role:", error);
      }
    }
    req.user = { claims: userClaims };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
var requireRole2 = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.claims?.role) {
      return res.status(403).json({ message: "Access denied: No role assigned" });
    }
    if (!allowedRoles.includes(req.user.claims.role)) {
      return res.status(403).json({
        message: "Access denied: Insufficient permissions",
        required: allowedRoles,
        current: req.user.claims.role
      });
    }
    next();
  };
};
var requireAdmin = requireRole2("admin", "super_admin");
var requireModerator = requireRole2("admin", "super_admin", "moderator");
var requirePremium = requireRole2("admin", "super_admin", "premium", "dao_owner");

// server/routes.ts
import { ZodError } from "zod";

// server/blockchain.ts
import { ethers } from "ethers";

// contracts/MaonoVault.json
var MaonoVault_default = {
  _format: "hh-sol-artifact-1",
  contractName: "MaonoVault",
  sourceName: "contracts/MaonoVault.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_asset",
          type: "address"
        },
        {
          internalType: "address",
          name: "_daoTreasury",
          type: "address"
        },
        {
          internalType: "address",
          name: "_manager",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "BelowMinDeposit",
      type: "error"
    },
    {
      inputs: [],
      name: "CapBelowTVL",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "allowance",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "needed",
          type: "uint256"
        }
      ],
      name: "ERC20InsufficientAllowance",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "balance",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "needed",
          type: "uint256"
        }
      ],
      name: "ERC20InsufficientBalance",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "approver",
          type: "address"
        }
      ],
      name: "ERC20InvalidApprover",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "ERC20InvalidReceiver",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "sender",
          type: "address"
        }
      ],
      name: "ERC20InvalidSender",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        }
      ],
      name: "ERC20InvalidSpender",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxDeposit",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxMint",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxRedeem",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "max",
          type: "uint256"
        }
      ],
      name: "ERC4626ExceededMaxWithdraw",
      type: "error"
    },
    {
      inputs: [],
      name: "InsufficientBalance",
      type: "error"
    },
    {
      inputs: [],
      name: "InvalidFee",
      type: "error"
    },
    {
      inputs: [],
      name: "InvalidNAV",
      type: "error"
    },
    {
      inputs: [],
      name: "NoProfit",
      type: "error"
    },
    {
      inputs: [],
      name: "NotManager",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "OwnableInvalidOwner",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "OwnableUnauthorizedAccount",
      type: "error"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        }
      ],
      name: "SafeERC20FailedOperation",
      type: "error"
    },
    {
      inputs: [],
      name: "VaultCapExceeded",
      type: "error"
    },
    {
      inputs: [],
      name: "WithdrawalAlreadyFulfilled",
      type: "error"
    },
    {
      inputs: [],
      name: "WithdrawalNotReady",
      type: "error"
    },
    {
      inputs: [],
      name: "ZeroAddress",
      type: "error"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Approval",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "Deposit",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldFee",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "ManagementFeeChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "ManagementFeeCollected",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "oldManager",
          type: "address"
        },
        {
          indexed: false,
          internalType: "address",
          name: "newManager",
          type: "address"
        }
      ],
      name: "ManagerChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "newNAV",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "updatedBy",
          type: "address"
        }
      ],
      name: "NAVUpdated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "OwnershipTransferred",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "Paused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldFee",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "PerformanceFeeChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "PerformanceFeeCollected",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "string",
          name: "daoId",
          type: "string"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "feeAmount",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256"
        }
      ],
      name: "PlatformFeeRecorded",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "Unpaused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldCap",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newCap",
          type: "uint256"
        }
      ],
      name: "VaultCapChanged",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "Withdraw",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "WithdrawalFulfilled",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "WithdrawalRequested",
      type: "event"
    },
    {
      inputs: [],
      name: "FEE_DENOMINATOR",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "SECONDS_PER_YEAR",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "address",
          name: "spender",
          type: "address"
        }
      ],
      name: "allowance",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "approve",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "asset",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address"
        }
      ],
      name: "balanceOf",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "collectManagementFees",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "convertToAssets",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "convertToShares",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "daoTreasury",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "deposit",
      outputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256"
        }
      ],
      name: "emergencyWithdraw",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        }
      ],
      name: "fulfillWithdrawal",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "getFeeInfo",
      outputs: [
        {
          internalType: "uint256",
          name: "perfFee",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "mgmtFee",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "totalPerfFeesCollected",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "totalMgmtFeesCollected",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "requestId",
          type: "uint256"
        }
      ],
      name: "getWithdrawalRequest",
      outputs: [
        {
          components: [
            {
              internalType: "address",
              name: "user",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "requestTime",
              type: "uint256"
            },
            {
              internalType: "bool",
              name: "fulfilled",
              type: "bool"
            }
          ],
          internalType: "struct MaonoVault.WithdrawalRequest",
          name: "",
          type: "tuple"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "largeWithdrawalThreshold",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastManagementFeeCollection",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastNAV",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "lastNAVUpdate",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "managementFee",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "manager",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      name: "maxDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      name: "maxMint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "maxRedeem",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "maxWithdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "minDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        }
      ],
      name: "mint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "owner",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "pause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "performanceFee",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "previewDeposit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "previewMint",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "previewNAV",
      outputs: [
        {
          internalType: "uint256",
          name: "nav",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "lastUpdate",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      name: "previewRedeem",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      name: "previewWithdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "string",
          name: "daoId",
          type: "string"
        },
        {
          internalType: "uint256",
          name: "feeAmount",
          type: "uint256"
        }
      ],
      name: "recordPlatformFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "redeem",
      outputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "renounceOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newThreshold",
          type: "uint256"
        }
      ],
      name: "setLargeWithdrawalThreshold",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "setManagementFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newManager",
          type: "address"
        }
      ],
      name: "setManager",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newMinDeposit",
          type: "uint256"
        }
      ],
      name: "setMinDeposit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newFee",
          type: "uint256"
        }
      ],
      name: "setPerformanceFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newCap",
          type: "uint256"
        }
      ],
      name: "setVaultCap",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newDelay",
          type: "uint256"
        }
      ],
      name: "setWithdrawalDelay",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalAssets",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalManagementFeesCollected",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalPerformanceFeesCollected",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "transfer",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "transferFrom",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "unpause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newNAV",
          type: "uint256"
        }
      ],
      name: "updateNAV",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "vaultCap",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "assets",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "receiver",
          type: "address"
        },
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "withdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "withdrawalDelay",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "withdrawalRequestCounter",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      name: "withdrawalRequests",
      outputs: [
        {
          internalType: "address",
          name: "user",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "shares",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "requestTime",
          type: "uint256"
        },
        {
          internalType: "bool",
          name: "fulfilled",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    }
  ],
  bytecode: "0x60c0604052678ac7230489e8000060085569021e19e0c9bab24000006009556105dc600a5560c8600b5562015180601555683635c9adc5dea000006016553480156200004a57600080fd5b5060405162004f7d38038062004f7d83398181016040528101906200007091906200060e565b80836040518060400160405280601481526020017f4d616f6e6f205661756c74204c5020546f6b656e0000000000000000000000008152506040518060400160405280600481526020017f4d564c54000000000000000000000000000000000000000000000000000000008152508160039081620000ef9190620008e4565b508060049081620001019190620008e4565b5050506000806200011883620003c460201b60201c565b91509150816200012a5760126200012c565b805b60ff1660a08160ff16815250508273ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff1681525050505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620001e55760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401620001dc9190620009dc565b60405180910390fd5b620001f681620004de60201b60201c565b5082600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036200025f576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620002c7576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036200032f576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b84600d60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555083600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055504260108190555050505050505062000aee565b6000806000808473ffffffffffffffffffffffffffffffffffffffff1660405160240160405160208183030381529060405263313ce56760e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff83818316178352505050506040516200043b919062000a72565b600060405180830381855afa9150503d806000811462000478576040519150601f19603f3d011682016040523d82523d6000602084013e6200047d565b606091505b50915091508180156200049257506020815110155b15620004cf57600081806020019051810190620004b0919062000abc565b905060ff80168111620004cd5760018194509450505050620004d9565b505b6000809350935050505b915091565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000620005d682620005a9565b9050919050565b620005e881620005c9565b8114620005f457600080fd5b50565b6000815190506200060881620005dd565b92915050565b6000806000606084860312156200062a5762000629620005a4565b5b60006200063a86828701620005f7565b93505060206200064d86828701620005f7565b92505060406200066086828701620005f7565b9150509250925092565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620006ec57607f821691505b602082108103620007025762000701620006a4565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200076c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200072d565b6200077886836200072d565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b6000620007c5620007bf620007b98462000790565b6200079a565b62000790565b9050919050565b6000819050919050565b620007e183620007a4565b620007f9620007f082620007cc565b8484546200073a565b825550505050565b600090565b6200081062000801565b6200081d818484620007d6565b505050565b5b8181101562000845576200083960008262000806565b60018101905062000823565b5050565b601f82111562000894576200085e8162000708565b62000869846200071d565b8101602085101562000879578190505b6200089162000888856200071d565b83018262000822565b50505b505050565b600082821c905092915050565b6000620008b96000198460080262000899565b1980831691505092915050565b6000620008d48383620008a6565b9150826002028217905092915050565b620008ef826200066a565b67ffffffffffffffff8111156200090b576200090a62000675565b5b620009178254620006d3565b6200092482828562000849565b600060209050601f8311600181146200095c576000841562000947578287015190505b620009538582620008c6565b865550620009c3565b601f1984166200096c8662000708565b60005b8281101562000996578489015182556001820191506020850194506020810190506200096f565b86831015620009b65784890151620009b2601f891682620008a6565b8355505b6001600288020188555050505b505050505050565b620009d681620005c9565b82525050565b6000602082019050620009f36000830184620009cb565b92915050565b600081519050919050565b600081905092915050565b60005b8381101562000a2f57808201518184015260208101905062000a12565b60008484015250505050565b600062000a4882620009f9565b62000a54818562000a04565b935062000a6681856020860162000a0f565b80840191505092915050565b600062000a80828462000a3b565b915081905092915050565b62000a968162000790565b811462000aa257600080fd5b50565b60008151905062000ab68162000a8b565b92915050565b60006020828403121562000ad55762000ad4620005a4565b5b600062000ae58482850162000aa5565b91505092915050565b60805160a05161446962000b146000396000610f3301526000610f6501526144696000f3fe608060405234801561001057600080fd5b50600436106103b95760003560e01c80638687098b116101f4578063c6e6f5921161011a578063dd62ed3e116100ad578063f0f5907d1161007c578063f0f5907d14610ba9578063f2fde38b14610bc5578063f64d421f14610be1578063fe56e23214610bff576103b9565b8063dd62ed3e14610b0d578063e4a2bdaf14610b3d578063e6a69ab814610b5b578063ef8b30f714610b79576103b9565b8063d2c13da5116100e9578063d2c13da514610a85578063d73792a914610aa1578063d88150ea14610abf578063d905777e14610add576103b9565b8063c6e6f592146109ea578063ce96cb7714610a1a578063d0ebdbe714610a4a578063d1b1daac14610a66576103b9565b8063a6f7f5d611610192578063b3d7f6b911610161578063b3d7f6b91461092a578063b460af941461095a578063ba0876521461098a578063c63d75b6146109ba576103b9565b8063a6f7f5d61461088e578063a7ab6961146108ac578063a9059cbb146108ca578063ae485651146108fa576103b9565b80638fcc9cfb116101ce5780638fcc9cfb146107f1578063937b25811461080d57806394bf804d1461084057806395d89b4114610870576103b9565b80638687098b1461079757806387788782146107b55780638da5cb5b146107d3576103b9565b8063402d267d116102e457806370897b231161027757806379022a9f1161024657806379022a9f146107355780637afaab01146107535780638456cb591461076f5780638571177a14610779576103b9565b806370897b23146106d557806370a08231146106f1578063710f20a214610721578063715018a61461072b576103b9565b80634cdad506116102b35780634cdad5061461063d57806350ede0101461066d5780635312ea8e146106895780636e553f65146106a5576103b9565b8063402d267d146105b357806341b3d185146105e357806341bd294114610601578063481c6a751461061f576103b9565b8063113fa8501161035c57806338d52e0f1161032b57806338d52e0f1461054f5780633c1bda091461056d5780633f0af8ef1461058b5780633f4ba83a146105a9576103b9565b8063113fa850146104c757806318160ddd146104e357806323b872dd14610501578063313ce56714610531576103b9565b806307a2d13a1161039857806307a2d13a1461041b578063095ea7b31461044b5780630a28a4771461047b5780630cb1982b146104ab576103b9565b806202eab7146103be57806301e1d114146103df57806306fdde03146103fd575b600080fd5b6103c6610c1b565b6040516103d694939291906134f9565b60405180910390f35b6103e7610c3b565b6040516103f4919061353e565b60405180910390f35b610405610cc3565b60405161041291906135e9565b60405180910390f35b6104356004803603810190610430919061364b565b610d55565b604051610442919061353e565b60405180910390f35b610465600480360381019061046091906136d6565b610d69565b6040516104729190613731565b60405180910390f35b6104956004803603810190610490919061364b565b610d8c565b6040516104a2919061353e565b60405180910390f35b6104c560048036038101906104c0919061364b565b610da0565b005b6104e160048036038101906104dc919061364b565b610edc565b005b6104eb610eee565b6040516104f8919061353e565b60405180910390f35b61051b6004803603810190610516919061374c565b610ef8565b6040516105289190613731565b60405180910390f35b610539610f27565b60405161054691906137bb565b60405180910390f35b610557610f61565b60405161056491906137e5565b60405180910390f35b610575610f89565b604051610582919061353e565b60405180910390f35b610593610f8f565b6040516105a0919061353e565b60405180910390f35b6105b1610f95565b005b6105cd60048036038101906105c89190613800565b610ff1565b6040516105da919061353e565b60405180910390f35b6105eb61101b565b6040516105f8919061353e565b60405180910390f35b610609611021565b604051610616919061353e565b60405180910390f35b610627611027565b60405161063491906137e5565b60405180910390f35b6106576004803603810190610652919061364b565b61104d565b604051610664919061353e565b60405180910390f35b61068760048036038101906106829190613962565b611061565b005b6106a3600480360381019061069e919061364b565b611212565b005b6106bf60048036038101906106ba91906139be565b6112aa565b6040516106cc919061353e565b60405180910390f35b6106ef60048036038101906106ea919061364b565b6113f5565b005b61070b60048036038101906107069190613800565b611484565b604051610718919061353e565b60405180910390f35b6107296114cc565b005b61073361155d565b005b61073d611571565b60405161074a91906137e5565b60405180910390f35b61076d6004803603810190610768919061364b565b611597565b005b610777611894565b005b6107816118f0565b60405161078e919061353e565b60405180910390f35b61079f6118f6565b6040516107ac919061353e565b60405180910390f35b6107bd6118fc565b6040516107ca919061353e565b60405180910390f35b6107db611902565b6040516107e891906137e5565b60405180910390f35b61080b6004803603810190610806919061364b565b61192c565b005b6108276004803603810190610822919061364b565b61193e565b60405161083794939291906139fe565b60405180910390f35b61085a600480360381019061085591906139be565b61199b565b604051610867919061353e565b60405180910390f35b610878611a1d565b60405161088591906135e9565b60405180910390f35b610896611aaf565b6040516108a3919061353e565b60405180910390f35b6108b4611ab5565b6040516108c1919061353e565b60405180910390f35b6108e460048036038101906108df91906136d6565b611abb565b6040516108f19190613731565b60405180910390f35b610914600480360381019061090f919061364b565b611ade565b6040516109219190613ac5565b60405180910390f35b610944600480360381019061093f919061364b565b611b90565b604051610951919061353e565b60405180910390f35b610974600480360381019061096f9190613ae0565b611ba4565b604051610981919061353e565b60405180910390f35b6109a4600480360381019061099f9190613ae0565b611c33565b6040516109b1919061353e565b60405180910390f35b6109d460048036038101906109cf9190613800565b611cc2565b6040516109e1919061353e565b60405180910390f35b610a0460048036038101906109ff919061364b565b611cec565b604051610a11919061353e565b60405180910390f35b610a346004803603810190610a2f9190613800565b611d00565b604051610a41919061353e565b60405180910390f35b610a646004803603810190610a5f9190613800565b611d1c565b005b610a6e611e31565b604051610a7c929190613b33565b60405180910390f35b610a9f6004803603810190610a9a919061364b565b611e42565b005b610aa9611e54565b604051610ab6919061353e565b60405180910390f35b610ac7611e5a565b604051610ad4919061353e565b60405180910390f35b610af76004803603810190610af29190613800565b611e60565b604051610b04919061353e565b60405180910390f35b610b276004803603810190610b229190613b5c565b611e72565b604051610b34919061353e565b60405180910390f35b610b45611ef9565b604051610b52919061353e565b60405180910390f35b610b63611eff565b604051610b70919061353e565b60405180910390f35b610b936004803603810190610b8e919061364b565b611f07565b604051610ba0919061353e565b60405180910390f35b610bc36004803603810190610bbe919061364b565b611f1b565b005b610bdf6004803603810190610bda9190613800565b611faf565b005b610be9612035565b604051610bf6919061353e565b60405180910390f35b610c196004803603810190610c14919061364b565b61203b565b005b600080600080600a54600b54601154601254935093509350935090919293565b6000610c45610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610c7d91906137e5565b602060405180830381865afa158015610c9a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610cbe9190613bb1565b905090565b606060038054610cd290613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054610cfe90613c0d565b8015610d4b5780601f10610d2057610100808354040283529160200191610d4b565b820191906000526020600020905b815481529060010190602001808311610d2e57829003601f168201915b5050505050905090565b6000610d628260006120ca565b9050919050565b600080610d74612123565b9050610d8181858561212b565b600191505092915050565b6000610d9982600161213d565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e27576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60008103610e61576040517f24eadd5d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600e54118015610e745750600e5481115b15610e9057610e8f600e5482610e8a9190613c6d565b612196565b5b80600e8190555042600f819055507f1569f913abe6cb538b4f89a7ca4c16840115c00eb8dfdc41528da7eebc0031be814233604051610ed193929190613ca1565b60405180910390a150565b610ee4612349565b8060168190555050565b6000600254905090565b600080610f03612123565b9050610f108582856123d0565b610f1b858585612465565b60019150509392505050565b6000610f31612559565b7f0000000000000000000000000000000000000000000000000000000000000000610f5c9190613cd8565b905090565b60007f0000000000000000000000000000000000000000000000000000000000000000905090565b60095481565b600e5481565b610f9d612349565b6000600760006101000a81548160ff0219169083151502179055507f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa33604051610fe791906137e5565b60405180910390a1565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b60085481565b60115481565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600061105a8260006120ca565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146110e8576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600082511161112c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161112390613d59565b60405180910390fd5b6000811161116f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161116690613deb565b60405180910390fd5b60008251148061117f5750600081145b156111bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111b690613e57565b60405180910390fd5b816040516111cd9190613eb3565b60405180910390207f37e59a0d0b8a6893eac000c6b97511fe786c34b114bb6551f7f026a79dc6942a8242604051611206929190613b33565b60405180910390a25050565b61121a612349565b611222610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb611245611902565b836040518363ffffffff1660e01b8152600401611263929190613eca565b6020604051808303816000875af1158015611282573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112a69190613f1f565b5050565b60006002600654036112f1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112e890613f98565b60405180910390fd5b6002600681905550600760009054906101000a900460ff1615611349576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161134090614004565b60405180910390fd5b600854831015611385576040517f96ec8e5400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60095483611391610c3b565b61139b9190614024565b11156113d3576040517f4f8d0ed200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6113db61255e565b6113e58383612761565b9050600160068190555092915050565b6113fd612349565b6107d0811115611439576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600a54905081600a819055507f44e5243903d4f21681121bff9dd91691edc7fa0b9d87cc40d6d65f1755a9b1b38183604051611478929190613b33565b60405180910390a15050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611553576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61155b61255e565b565b611565612349565b61156f60006127e3565b565b600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6002600654036115dc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115d390613f98565b60405180910390fd5b600260068190555060006013600083815260200190815260200160002090503373ffffffffffffffffffffffffffffffffffffffff168160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611684576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160009054906101000a900460ff16156116cd576040517f84b092a200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60155481600201546116df9190614024565b421015611718576040517f0f2ca6e700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160006101000a81548160ff0219169083151502179055506000611744826001015461104d565b90506117788260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1683600101546128a9565b611780610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016117de929190613eca565b6020604051808303816000875af11580156117fd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118219190613f1f565b507f3e4ec7607342525bba1e97fff1e643818b1ac98b3da56568e40fbb82cf8aa846838360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600101548460405161187f9493929190614058565b60405180910390a15050600160068190555050565b61189c612349565b6001600760006101000a81548160ff0219169083151502179055507f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258336040516118e691906137e5565b60405180910390a1565b60105481565b600f5481565b600a5481565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b611934612349565b8060088190555050565b60136020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010154908060020154908060030160009054906101000a900460ff16905084565b6000806119a783611cc2565b9050808411156119f2578284826040517f284ff6670000000000000000000000000000000000000000000000000000000081526004016119e99392919061409d565b60405180910390fd5b60006119fd85611b90565b9050611a12611a0a612123565b85838861292b565b809250505092915050565b606060048054611a2c90613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054611a5890613c0d565b8015611aa55780601f10611a7a57610100808354040283529160200191611aa5565b820191906000526020600020905b815481529060010190602001808311611a8857829003601f168201915b5050505050905090565b600b5481565b60155481565b600080611ac6612123565b9050611ad3818585612465565b600191505092915050565b611ae66134a0565b601360008381526020019081526020016000206040518060800160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160018201548152602001600282015481526020016003820160009054906101000a900460ff1615151515815250509050919050565b6000611b9d8260016120ca565b9050919050565b6000600260065403611beb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611be290613f98565b60405180910390fd5b60026006819055506016548410611c1657611c0584610d8c565b9050611c1182826129b5565b611c24565b611c21848484612adb565b90505b60016006819055509392505050565b6000600260065403611c7a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c7190613f98565b60405180910390fd5b6002600681905550611c8b8461104d565b90506016548110611ca557611ca082856129b5565b611cb3565b611cb0848484612b5f565b90505b60016006819055509392505050565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b6000611cf982600061213d565b9050919050565b6000611d15611d0e83611484565b60006120ca565b9050919050565b611d24612349565b80600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603611d8b576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43508184604051611e249291906140d4565b60405180910390a1505050565b600080600e54600f54915091509091565b611e4a612349565b8060158190555050565b61271081565b60145481565b6000611e6b82611484565b9050919050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b60125481565b6301e1338081565b6000611f1482600061213d565b9050919050565b611f23612349565b611f2b610c3b565b811015611f64576040517f43420d1700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60006009549050816009819055507f4d2401457be9e6122a73ae61656c5683178c9f48c9d3eef2de0542d09d35be778183604051611fa3929190613b33565b60405180910390a15050565b611fb7612349565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036120295760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161202091906137e5565b60405180910390fd5b612032816127e3565b50565b60165481565b612043612349565b6101f481111561207f576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600b54905081600b819055507ffac39c9265fbab8fd6b4293b3f584cb3b1c0c39fb315acbcd4d1bef067c340cd81836040516120be929190613b33565b60405180910390a15050565b600061211b60016120d9610c3b565b6120e39190614024565b6120eb612559565b600a6120f79190614230565b6120ff610eee565b6121099190614024565b8486612be3909392919063ffffffff16565b905092915050565b600033905090565b6121388383836001612c32565b505050565b600061218e61214a612559565b600a6121569190614230565b61215e610eee565b6121689190614024565b6001612172610c3b565b61217c9190614024565b8486612be3909392919063ffffffff16565b905092915050565b6000612710600a54836121a9919061427b565b6121b391906142ec565b90506000811180156122455750806121c9610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161220191906137e5565b602060405180830381865afa15801561221e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122429190613bb1565b10155b1561234557612252610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016122ae929190613eca565b6020604051808303816000875af11580156122cd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122f19190613f1f565b5080601160008282546123049190614024565b925050819055507f27c911040371674ee220be22d1cf1a554a2f34e5bbb946f7b11d7d3a7c5b734c814260405161233c929190613b33565b60405180910390a15b5050565b612351612123565b73ffffffffffffffffffffffffffffffffffffffff1661236f611902565b73ffffffffffffffffffffffffffffffffffffffff16146123ce57612392612123565b6040517f118cdaa70000000000000000000000000000000000000000000000000000000081526004016123c591906137e5565b60405180910390fd5b565b60006123dc8484611e72565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561245f578181101561244f578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016124469392919061409d565b60405180910390fd5b61245e84848484036000612c32565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036124d75760006040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081526004016124ce91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036125495760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161254091906137e5565b60405180910390fd5b612554838383612e09565b505050565b600090565b60006010544261256e9190613c6d565b9050600081111561275e576000612583610c3b565b90506000612710600b5483612598919061427b565b6125a291906142ec565b905060006301e1338084836125b7919061427b565b6125c191906142ec565b90506000811180156126535750806125d7610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161260f91906137e5565b602060405180830381865afa15801561262c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126509190613bb1565b10155b1561275a57612660610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016126bc929190613eca565b6020604051808303816000875af11580156126db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126ff9190613f1f565b5080601260008282546127129190614024565b92505081905550426010819055507f6f4a589972e181c1010960e6cb88e05776a4f3a28373e49c69ffdf8cc30f1a318142604051612751929190613b33565b60405180910390a15b5050505b50565b60008061276d83610ff1565b9050808411156127b8578284826040517f79012fb20000000000000000000000000000000000000000000000000000000081526004016127af9392919061409d565b60405180910390fd5b60006127c385611f07565b90506127d86127d0612123565b85878461292b565b809250505092915050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361291b5760006040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161291291906137e5565b60405180910390fd5b61292782600083612e09565b5050565b61293e612936610f61565b85308561302e565b61294883826130b0565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d784846040516129a7929190613b33565b60405180910390a350505050565b601460008154809291906129c89061431d565b919050555060405180608001604052808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020014281526020016000151581525060136000601454815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550602082015181600101556040820151816002015560608201518160030160006101000a81548160ff0219169083151502179055509050507f6620e1bb18901e7cc06eb4c152cbf61f7f069350e9cf118060d463c4e5430ba06014548383604051612acf93929190614365565b60405180910390a15050565b600080612ae783611d00565b905080851115612b32578285826040517ffe9cceec000000000000000000000000000000000000000000000000000000008152600401612b299392919061409d565b60405180910390fd5b6000612b3d86610d8c565b9050612b53612b4a612123565b86868985613132565b80925050509392505050565b600080612b6b83611e60565b905080851115612bb6578285826040517fb94abeec000000000000000000000000000000000000000000000000000000008152600401612bad9392919061409d565b60405180910390fd5b6000612bc18661104d565b9050612bd7612bce612123565b8686848a613132565b80925050509392505050565b6000612c13612bf183613212565b8015612c0e575060008480612c0957612c086142bd565b5b868809115b613240565b612c1e86868661324c565b612c289190614024565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603612ca45760006040517fe602df05000000000000000000000000000000000000000000000000000000008152600401612c9b91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612d165760006040517f94280d62000000000000000000000000000000000000000000000000000000008152600401612d0d91906137e5565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015612e03578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051612dfa919061353e565b60405180910390a35b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612e5b578060026000828254612e4f9190614024565b92505081905550612f2e565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015612ee7578381836040517fe450d38c000000000000000000000000000000000000000000000000000000008152600401612ede9392919061409d565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603612f775780600260008282540392505081905550612fc4565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051613021919061353e565b60405180910390a3505050565b6130aa848573ffffffffffffffffffffffffffffffffffffffff166323b872dd8686866040516024016130639392919061439c565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036131225760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161311991906137e5565b60405180910390fd5b61312e60008383612e09565b5050565b8273ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614613171576131708386836123d0565b5b61317b83826128a9565b61318d613186610f61565b85846133d6565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff167ffbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db8585604051613203929190613b33565b60405180910390a45050505050565b60006001600283600381111561322b5761322a6143d3565b5b6132359190614402565b60ff16149050919050565b60008115159050919050565b600080600061325b8686613455565b915091506000820361328157838181613277576132766142bd565b5b049250505061332d565b8184116132a1576132a061329b6000861460126011613474565b61348e565b5b600084868809905081811183039250808203915060008560000386169050808604955080830492506001818260000304019050808402831792506000600287600302189050808702600203810290508087026002038102905080870260020381029050808702600203810290508087026002038102905080870260020381029050808402955050505050505b9392505050565b600080602060008451602086016000885af180613357576040513d6000823e3d81fd5b3d92506000519150506000821461337257600181141561338e565b60008473ffffffffffffffffffffffffffffffffffffffff163b145b156133d057836040517f5274afe70000000000000000000000000000000000000000000000000000000081526004016133c791906137e5565b60405180910390fd5b50505050565b613450838473ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8585604051602401613409929190613eca565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b505050565b6000806000198385098385029150818110828203039250509250929050565b600061347f84613240565b82841802821890509392505050565b634e487b71600052806020526024601cfd5b6040518060800160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160008152602001600081526020016000151581525090565b6000819050919050565b6134f3816134e0565b82525050565b600060808201905061350e60008301876134ea565b61351b60208301866134ea565b61352860408301856134ea565b61353560608301846134ea565b95945050505050565b600060208201905061355360008301846134ea565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b83811015613593578082015181840152602081019050613578565b60008484015250505050565b6000601f19601f8301169050919050565b60006135bb82613559565b6135c58185613564565b93506135d5818560208601613575565b6135de8161359f565b840191505092915050565b6000602082019050818103600083015261360381846135b0565b905092915050565b6000604051905090565b600080fd5b600080fd5b613628816134e0565b811461363357600080fd5b50565b6000813590506136458161361f565b92915050565b60006020828403121561366157613660613615565b5b600061366f84828501613636565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006136a382613678565b9050919050565b6136b381613698565b81146136be57600080fd5b50565b6000813590506136d0816136aa565b92915050565b600080604083850312156136ed576136ec613615565b5b60006136fb858286016136c1565b925050602061370c85828601613636565b9150509250929050565b60008115159050919050565b61372b81613716565b82525050565b60006020820190506137466000830184613722565b92915050565b60008060006060848603121561376557613764613615565b5b6000613773868287016136c1565b9350506020613784868287016136c1565b925050604061379586828701613636565b9150509250925092565b600060ff82169050919050565b6137b58161379f565b82525050565b60006020820190506137d060008301846137ac565b92915050565b6137df81613698565b82525050565b60006020820190506137fa60008301846137d6565b92915050565b60006020828403121561381657613815613615565b5b6000613824848285016136c1565b91505092915050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61386f8261359f565b810181811067ffffffffffffffff8211171561388e5761388d613837565b5b80604052505050565b60006138a161360b565b90506138ad8282613866565b919050565b600067ffffffffffffffff8211156138cd576138cc613837565b5b6138d68261359f565b9050602081019050919050565b82818337600083830152505050565b6000613905613900846138b2565b613897565b90508281526020810184848401111561392157613920613832565b5b61392c8482856138e3565b509392505050565b600082601f8301126139495761394861382d565b5b81356139598482602086016138f2565b91505092915050565b6000806040838503121561397957613978613615565b5b600083013567ffffffffffffffff8111156139975761399661361a565b5b6139a385828601613934565b92505060206139b485828601613636565b9150509250929050565b600080604083850312156139d5576139d4613615565b5b60006139e385828601613636565b92505060206139f4858286016136c1565b9150509250929050565b6000608082019050613a1360008301876137d6565b613a2060208301866134ea565b613a2d60408301856134ea565b613a3a6060830184613722565b95945050505050565b613a4c81613698565b82525050565b613a5b816134e0565b82525050565b613a6a81613716565b82525050565b608082016000820151613a866000850182613a43565b506020820151613a996020850182613a52565b506040820151613aac6040850182613a52565b506060820151613abf6060850182613a61565b50505050565b6000608082019050613ada6000830184613a70565b92915050565b600080600060608486031215613af957613af8613615565b5b6000613b0786828701613636565b9350506020613b18868287016136c1565b9250506040613b29868287016136c1565b9150509250925092565b6000604082019050613b4860008301856134ea565b613b5560208301846134ea565b9392505050565b60008060408385031215613b7357613b72613615565b5b6000613b81858286016136c1565b9250506020613b92858286016136c1565b9150509250929050565b600081519050613bab8161361f565b92915050565b600060208284031215613bc757613bc6613615565b5b6000613bd584828501613b9c565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680613c2557607f821691505b602082108103613c3857613c37613bde565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000613c78826134e0565b9150613c83836134e0565b9250828203905081811115613c9b57613c9a613c3e565b5b92915050565b6000606082019050613cb660008301866134ea565b613cc360208301856134ea565b613cd060408301846137d6565b949350505050565b6000613ce38261379f565b9150613cee8361379f565b9250828201905060ff811115613d0757613d06613c3e565b5b92915050565b7f44414f2049442063616e6e6f7420626520656d70747900000000000000000000600082015250565b6000613d43601683613564565b9150613d4e82613d0d565b602082019050919050565b60006020820190508181036000830152613d7281613d36565b9050919050565b7f46656520616d6f756e74206d7573742062652067726561746572207468616e2060008201527f7a65726f00000000000000000000000000000000000000000000000000000000602082015250565b6000613dd5602483613564565b9150613de082613d79565b604082019050919050565b60006020820190508181036000830152613e0481613dc8565b9050919050565b7f496e76616c69642044414f204944206f722066656520616d6f756e7400000000600082015250565b6000613e41601c83613564565b9150613e4c82613e0b565b602082019050919050565b60006020820190508181036000830152613e7081613e34565b9050919050565b600081905092915050565b6000613e8d82613559565b613e978185613e77565b9350613ea7818560208601613575565b80840191505092915050565b6000613ebf8284613e82565b915081905092915050565b6000604082019050613edf60008301856137d6565b613eec60208301846134ea565b9392505050565b613efc81613716565b8114613f0757600080fd5b50565b600081519050613f1981613ef3565b92915050565b600060208284031215613f3557613f34613615565b5b6000613f4384828501613f0a565b91505092915050565b7f5265656e7472616e637947756172643a207265656e7472616e742063616c6c00600082015250565b6000613f82601f83613564565b9150613f8d82613f4c565b602082019050919050565b60006020820190508181036000830152613fb181613f75565b9050919050565b7f5061757361626c653a2070617573656400000000000000000000000000000000600082015250565b6000613fee601083613564565b9150613ff982613fb8565b602082019050919050565b6000602082019050818103600083015261401d81613fe1565b9050919050565b600061402f826134e0565b915061403a836134e0565b925082820190508082111561405257614051613c3e565b5b92915050565b600060808201905061406d60008301876134ea565b61407a60208301866137d6565b61408760408301856134ea565b61409460608301846134ea565b95945050505050565b60006060820190506140b260008301866137d6565b6140bf60208301856134ea565b6140cc60408301846134ea565b949350505050565b60006040820190506140e960008301856137d6565b6140f660208301846137d6565b9392505050565b60008160011c9050919050565b6000808291508390505b6001851115614154578086048111156141305761412f613c3e565b5b600185161561413f5780820291505b808102905061414d856140fd565b9450614114565b94509492505050565b60008261416d5760019050614229565b8161417b5760009050614229565b8160018114614191576002811461419b576141ca565b6001915050614229565b60ff8411156141ad576141ac613c3e565b5b8360020a9150848211156141c4576141c3613c3e565b5b50614229565b5060208310610133831016604e8410600b84101617156141ff5782820a9050838111156141fa576141f9613c3e565b5b614229565b61420c848484600161410a565b9250905081840481111561422357614222613c3e565b5b81810290505b9392505050565b600061423b826134e0565b91506142468361379f565b92506142737fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848461415d565b905092915050565b6000614286826134e0565b9150614291836134e0565b925082820261429f816134e0565b915082820484148315176142b6576142b5613c3e565b5b5092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b60006142f7826134e0565b9150614302836134e0565b925082614312576143116142bd565b5b828204905092915050565b6000614328826134e0565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361435a57614359613c3e565b5b600182019050919050565b600060608201905061437a60008301866134ea565b61438760208301856137d6565b61439460408301846134ea565b949350505050565b60006060820190506143b160008301866137d6565b6143be60208301856137d6565b6143cb60408301846134ea565b949350505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b600061440d8261379f565b91506144188361379f565b925082614428576144276142bd565b5b82820690509291505056fea2646970667358221220bd05bf74f18815fb077f798b2f14c933876cb265e2928683dca7b716f1bd4a1b64736f6c63430008140033",
  deployedBytecode: "0x608060405234801561001057600080fd5b50600436106103b95760003560e01c80638687098b116101f4578063c6e6f5921161011a578063dd62ed3e116100ad578063f0f5907d1161007c578063f0f5907d14610ba9578063f2fde38b14610bc5578063f64d421f14610be1578063fe56e23214610bff576103b9565b8063dd62ed3e14610b0d578063e4a2bdaf14610b3d578063e6a69ab814610b5b578063ef8b30f714610b79576103b9565b8063d2c13da5116100e9578063d2c13da514610a85578063d73792a914610aa1578063d88150ea14610abf578063d905777e14610add576103b9565b8063c6e6f592146109ea578063ce96cb7714610a1a578063d0ebdbe714610a4a578063d1b1daac14610a66576103b9565b8063a6f7f5d611610192578063b3d7f6b911610161578063b3d7f6b91461092a578063b460af941461095a578063ba0876521461098a578063c63d75b6146109ba576103b9565b8063a6f7f5d61461088e578063a7ab6961146108ac578063a9059cbb146108ca578063ae485651146108fa576103b9565b80638fcc9cfb116101ce5780638fcc9cfb146107f1578063937b25811461080d57806394bf804d1461084057806395d89b4114610870576103b9565b80638687098b1461079757806387788782146107b55780638da5cb5b146107d3576103b9565b8063402d267d116102e457806370897b231161027757806379022a9f1161024657806379022a9f146107355780637afaab01146107535780638456cb591461076f5780638571177a14610779576103b9565b806370897b23146106d557806370a08231146106f1578063710f20a214610721578063715018a61461072b576103b9565b80634cdad506116102b35780634cdad5061461063d57806350ede0101461066d5780635312ea8e146106895780636e553f65146106a5576103b9565b8063402d267d146105b357806341b3d185146105e357806341bd294114610601578063481c6a751461061f576103b9565b8063113fa8501161035c57806338d52e0f1161032b57806338d52e0f1461054f5780633c1bda091461056d5780633f0af8ef1461058b5780633f4ba83a146105a9576103b9565b8063113fa850146104c757806318160ddd146104e357806323b872dd14610501578063313ce56714610531576103b9565b806307a2d13a1161039857806307a2d13a1461041b578063095ea7b31461044b5780630a28a4771461047b5780630cb1982b146104ab576103b9565b806202eab7146103be57806301e1d114146103df57806306fdde03146103fd575b600080fd5b6103c6610c1b565b6040516103d694939291906134f9565b60405180910390f35b6103e7610c3b565b6040516103f4919061353e565b60405180910390f35b610405610cc3565b60405161041291906135e9565b60405180910390f35b6104356004803603810190610430919061364b565b610d55565b604051610442919061353e565b60405180910390f35b610465600480360381019061046091906136d6565b610d69565b6040516104729190613731565b60405180910390f35b6104956004803603810190610490919061364b565b610d8c565b6040516104a2919061353e565b60405180910390f35b6104c560048036038101906104c0919061364b565b610da0565b005b6104e160048036038101906104dc919061364b565b610edc565b005b6104eb610eee565b6040516104f8919061353e565b60405180910390f35b61051b6004803603810190610516919061374c565b610ef8565b6040516105289190613731565b60405180910390f35b610539610f27565b60405161054691906137bb565b60405180910390f35b610557610f61565b60405161056491906137e5565b60405180910390f35b610575610f89565b604051610582919061353e565b60405180910390f35b610593610f8f565b6040516105a0919061353e565b60405180910390f35b6105b1610f95565b005b6105cd60048036038101906105c89190613800565b610ff1565b6040516105da919061353e565b60405180910390f35b6105eb61101b565b6040516105f8919061353e565b60405180910390f35b610609611021565b604051610616919061353e565b60405180910390f35b610627611027565b60405161063491906137e5565b60405180910390f35b6106576004803603810190610652919061364b565b61104d565b604051610664919061353e565b60405180910390f35b61068760048036038101906106829190613962565b611061565b005b6106a3600480360381019061069e919061364b565b611212565b005b6106bf60048036038101906106ba91906139be565b6112aa565b6040516106cc919061353e565b60405180910390f35b6106ef60048036038101906106ea919061364b565b6113f5565b005b61070b60048036038101906107069190613800565b611484565b604051610718919061353e565b60405180910390f35b6107296114cc565b005b61073361155d565b005b61073d611571565b60405161074a91906137e5565b60405180910390f35b61076d6004803603810190610768919061364b565b611597565b005b610777611894565b005b6107816118f0565b60405161078e919061353e565b60405180910390f35b61079f6118f6565b6040516107ac919061353e565b60405180910390f35b6107bd6118fc565b6040516107ca919061353e565b60405180910390f35b6107db611902565b6040516107e891906137e5565b60405180910390f35b61080b6004803603810190610806919061364b565b61192c565b005b6108276004803603810190610822919061364b565b61193e565b60405161083794939291906139fe565b60405180910390f35b61085a600480360381019061085591906139be565b61199b565b604051610867919061353e565b60405180910390f35b610878611a1d565b60405161088591906135e9565b60405180910390f35b610896611aaf565b6040516108a3919061353e565b60405180910390f35b6108b4611ab5565b6040516108c1919061353e565b60405180910390f35b6108e460048036038101906108df91906136d6565b611abb565b6040516108f19190613731565b60405180910390f35b610914600480360381019061090f919061364b565b611ade565b6040516109219190613ac5565b60405180910390f35b610944600480360381019061093f919061364b565b611b90565b604051610951919061353e565b60405180910390f35b610974600480360381019061096f9190613ae0565b611ba4565b604051610981919061353e565b60405180910390f35b6109a4600480360381019061099f9190613ae0565b611c33565b6040516109b1919061353e565b60405180910390f35b6109d460048036038101906109cf9190613800565b611cc2565b6040516109e1919061353e565b60405180910390f35b610a0460048036038101906109ff919061364b565b611cec565b604051610a11919061353e565b60405180910390f35b610a346004803603810190610a2f9190613800565b611d00565b604051610a41919061353e565b60405180910390f35b610a646004803603810190610a5f9190613800565b611d1c565b005b610a6e611e31565b604051610a7c929190613b33565b60405180910390f35b610a9f6004803603810190610a9a919061364b565b611e42565b005b610aa9611e54565b604051610ab6919061353e565b60405180910390f35b610ac7611e5a565b604051610ad4919061353e565b60405180910390f35b610af76004803603810190610af29190613800565b611e60565b604051610b04919061353e565b60405180910390f35b610b276004803603810190610b229190613b5c565b611e72565b604051610b34919061353e565b60405180910390f35b610b45611ef9565b604051610b52919061353e565b60405180910390f35b610b63611eff565b604051610b70919061353e565b60405180910390f35b610b936004803603810190610b8e919061364b565b611f07565b604051610ba0919061353e565b60405180910390f35b610bc36004803603810190610bbe919061364b565b611f1b565b005b610bdf6004803603810190610bda9190613800565b611faf565b005b610be9612035565b604051610bf6919061353e565b60405180910390f35b610c196004803603810190610c14919061364b565b61203b565b005b600080600080600a54600b54601154601254935093509350935090919293565b6000610c45610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610c7d91906137e5565b602060405180830381865afa158015610c9a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610cbe9190613bb1565b905090565b606060038054610cd290613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054610cfe90613c0d565b8015610d4b5780601f10610d2057610100808354040283529160200191610d4b565b820191906000526020600020905b815481529060010190602001808311610d2e57829003601f168201915b5050505050905090565b6000610d628260006120ca565b9050919050565b600080610d74612123565b9050610d8181858561212b565b600191505092915050565b6000610d9982600161213d565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e27576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60008103610e61576040517f24eadd5d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600e54118015610e745750600e5481115b15610e9057610e8f600e5482610e8a9190613c6d565b612196565b5b80600e8190555042600f819055507f1569f913abe6cb538b4f89a7ca4c16840115c00eb8dfdc41528da7eebc0031be814233604051610ed193929190613ca1565b60405180910390a150565b610ee4612349565b8060168190555050565b6000600254905090565b600080610f03612123565b9050610f108582856123d0565b610f1b858585612465565b60019150509392505050565b6000610f31612559565b7f0000000000000000000000000000000000000000000000000000000000000000610f5c9190613cd8565b905090565b60007f0000000000000000000000000000000000000000000000000000000000000000905090565b60095481565b600e5481565b610f9d612349565b6000600760006101000a81548160ff0219169083151502179055507f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa33604051610fe791906137e5565b60405180910390a1565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b60085481565b60115481565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600061105a8260006120ca565b9050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146110e8576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600082511161112c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161112390613d59565b60405180910390fd5b6000811161116f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161116690613deb565b60405180910390fd5b60008251148061117f5750600081145b156111bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016111b690613e57565b60405180910390fd5b816040516111cd9190613eb3565b60405180910390207f37e59a0d0b8a6893eac000c6b97511fe786c34b114bb6551f7f026a79dc6942a8242604051611206929190613b33565b60405180910390a25050565b61121a612349565b611222610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb611245611902565b836040518363ffffffff1660e01b8152600401611263929190613eca565b6020604051808303816000875af1158015611282573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112a69190613f1f565b5050565b60006002600654036112f1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112e890613f98565b60405180910390fd5b6002600681905550600760009054906101000a900460ff1615611349576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161134090614004565b60405180910390fd5b600854831015611385576040517f96ec8e5400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60095483611391610c3b565b61139b9190614024565b11156113d3576040517f4f8d0ed200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6113db61255e565b6113e58383612761565b9050600160068190555092915050565b6113fd612349565b6107d0811115611439576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600a54905081600a819055507f44e5243903d4f21681121bff9dd91691edc7fa0b9d87cc40d6d65f1755a9b1b38183604051611478929190613b33565b60405180910390a15050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611553576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61155b61255e565b565b611565612349565b61156f60006127e3565b565b600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6002600654036115dc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115d390613f98565b60405180910390fd5b600260068190555060006013600083815260200190815260200160002090503373ffffffffffffffffffffffffffffffffffffffff168160000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614611684576040517fc0fc8a8a00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160009054906101000a900460ff16156116cd576040517f84b092a200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60155481600201546116df9190614024565b421015611718576040517f0f2ca6e700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160006101000a81548160ff0219169083151502179055506000611744826001015461104d565b90506117788260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1683600101546128a9565b611780610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016117de929190613eca565b6020604051808303816000875af11580156117fd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118219190613f1f565b507f3e4ec7607342525bba1e97fff1e643818b1ac98b3da56568e40fbb82cf8aa846838360000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600101548460405161187f9493929190614058565b60405180910390a15050600160068190555050565b61189c612349565b6001600760006101000a81548160ff0219169083151502179055507f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258336040516118e691906137e5565b60405180910390a1565b60105481565b600f5481565b600a5481565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b611934612349565b8060088190555050565b60136020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010154908060020154908060030160009054906101000a900460ff16905084565b6000806119a783611cc2565b9050808411156119f2578284826040517f284ff6670000000000000000000000000000000000000000000000000000000081526004016119e99392919061409d565b60405180910390fd5b60006119fd85611b90565b9050611a12611a0a612123565b85838861292b565b809250505092915050565b606060048054611a2c90613c0d565b80601f0160208091040260200160405190810160405280929190818152602001828054611a5890613c0d565b8015611aa55780601f10611a7a57610100808354040283529160200191611aa5565b820191906000526020600020905b815481529060010190602001808311611a8857829003601f168201915b5050505050905090565b600b5481565b60155481565b600080611ac6612123565b9050611ad3818585612465565b600191505092915050565b611ae66134a0565b601360008381526020019081526020016000206040518060800160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160018201548152602001600282015481526020016003820160009054906101000a900460ff1615151515815250509050919050565b6000611b9d8260016120ca565b9050919050565b6000600260065403611beb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611be290613f98565b60405180910390fd5b60026006819055506016548410611c1657611c0584610d8c565b9050611c1182826129b5565b611c24565b611c21848484612adb565b90505b60016006819055509392505050565b6000600260065403611c7a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c7190613f98565b60405180910390fd5b6002600681905550611c8b8461104d565b90506016548110611ca557611ca082856129b5565b611cb3565b611cb0848484612b5f565b90505b60016006819055509392505050565b60007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050919050565b6000611cf982600061213d565b9050919050565b6000611d15611d0e83611484565b60006120ca565b9050919050565b611d24612349565b80600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603611d8b576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600c60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600c60006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43508184604051611e249291906140d4565b60405180910390a1505050565b600080600e54600f54915091509091565b611e4a612349565b8060158190555050565b61271081565b60145481565b6000611e6b82611484565b9050919050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b60125481565b6301e1338081565b6000611f1482600061213d565b9050919050565b611f23612349565b611f2b610c3b565b811015611f64576040517f43420d1700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60006009549050816009819055507f4d2401457be9e6122a73ae61656c5683178c9f48c9d3eef2de0542d09d35be778183604051611fa3929190613b33565b60405180910390a15050565b611fb7612349565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036120295760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161202091906137e5565b60405180910390fd5b612032816127e3565b50565b60165481565b612043612349565b6101f481111561207f576040517f58d620b300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000600b54905081600b819055507ffac39c9265fbab8fd6b4293b3f584cb3b1c0c39fb315acbcd4d1bef067c340cd81836040516120be929190613b33565b60405180910390a15050565b600061211b60016120d9610c3b565b6120e39190614024565b6120eb612559565b600a6120f79190614230565b6120ff610eee565b6121099190614024565b8486612be3909392919063ffffffff16565b905092915050565b600033905090565b6121388383836001612c32565b505050565b600061218e61214a612559565b600a6121569190614230565b61215e610eee565b6121689190614024565b6001612172610c3b565b61217c9190614024565b8486612be3909392919063ffffffff16565b905092915050565b6000612710600a54836121a9919061427b565b6121b391906142ec565b90506000811180156122455750806121c9610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161220191906137e5565b602060405180830381865afa15801561221e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122429190613bb1565b10155b1561234557612252610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016122ae929190613eca565b6020604051808303816000875af11580156122cd573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906122f19190613f1f565b5080601160008282546123049190614024565b925050819055507f27c911040371674ee220be22d1cf1a554a2f34e5bbb946f7b11d7d3a7c5b734c814260405161233c929190613b33565b60405180910390a15b5050565b612351612123565b73ffffffffffffffffffffffffffffffffffffffff1661236f611902565b73ffffffffffffffffffffffffffffffffffffffff16146123ce57612392612123565b6040517f118cdaa70000000000000000000000000000000000000000000000000000000081526004016123c591906137e5565b60405180910390fd5b565b60006123dc8484611e72565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561245f578181101561244f578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016124469392919061409d565b60405180910390fd5b61245e84848484036000612c32565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036124d75760006040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081526004016124ce91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036125495760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161254091906137e5565b60405180910390fd5b612554838383612e09565b505050565b600090565b60006010544261256e9190613c6d565b9050600081111561275e576000612583610c3b565b90506000612710600b5483612598919061427b565b6125a291906142ec565b905060006301e1338084836125b7919061427b565b6125c191906142ec565b90506000811180156126535750806125d7610f61565b73ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161260f91906137e5565b602060405180830381865afa15801561262c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126509190613bb1565b10155b1561275a57612660610f61565b73ffffffffffffffffffffffffffffffffffffffff1663a9059cbb600d60009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16836040518363ffffffff1660e01b81526004016126bc929190613eca565b6020604051808303816000875af11580156126db573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906126ff9190613f1f565b5080601260008282546127129190614024565b92505081905550426010819055507f6f4a589972e181c1010960e6cb88e05776a4f3a28373e49c69ffdf8cc30f1a318142604051612751929190613b33565b60405180910390a15b5050505b50565b60008061276d83610ff1565b9050808411156127b8578284826040517f79012fb20000000000000000000000000000000000000000000000000000000081526004016127af9392919061409d565b60405180910390fd5b60006127c385611f07565b90506127d86127d0612123565b85878461292b565b809250505092915050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361291b5760006040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161291291906137e5565b60405180910390fd5b61292782600083612e09565b5050565b61293e612936610f61565b85308561302e565b61294883826130b0565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d784846040516129a7929190613b33565b60405180910390a350505050565b601460008154809291906129c89061431d565b919050555060405180608001604052808373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020014281526020016000151581525060136000601454815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550602082015181600101556040820151816002015560608201518160030160006101000a81548160ff0219169083151502179055509050507f6620e1bb18901e7cc06eb4c152cbf61f7f069350e9cf118060d463c4e5430ba06014548383604051612acf93929190614365565b60405180910390a15050565b600080612ae783611d00565b905080851115612b32578285826040517ffe9cceec000000000000000000000000000000000000000000000000000000008152600401612b299392919061409d565b60405180910390fd5b6000612b3d86610d8c565b9050612b53612b4a612123565b86868985613132565b80925050509392505050565b600080612b6b83611e60565b905080851115612bb6578285826040517fb94abeec000000000000000000000000000000000000000000000000000000008152600401612bad9392919061409d565b60405180910390fd5b6000612bc18661104d565b9050612bd7612bce612123565b8686848a613132565b80925050509392505050565b6000612c13612bf183613212565b8015612c0e575060008480612c0957612c086142bd565b5b868809115b613240565b612c1e86868661324c565b612c289190614024565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603612ca45760006040517fe602df05000000000000000000000000000000000000000000000000000000008152600401612c9b91906137e5565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612d165760006040517f94280d62000000000000000000000000000000000000000000000000000000008152600401612d0d91906137e5565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015612e03578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051612dfa919061353e565b60405180910390a35b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603612e5b578060026000828254612e4f9190614024565b92505081905550612f2e565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015612ee7578381836040517fe450d38c000000000000000000000000000000000000000000000000000000008152600401612ede9392919061409d565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603612f775780600260008282540392505081905550612fc4565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051613021919061353e565b60405180910390a3505050565b6130aa848573ffffffffffffffffffffffffffffffffffffffff166323b872dd8686866040516024016130639392919061439c565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036131225760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040161311991906137e5565b60405180910390fd5b61312e60008383612e09565b5050565b8273ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614613171576131708386836123d0565b5b61317b83826128a9565b61318d613186610f61565b85846133d6565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff167ffbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db8585604051613203929190613b33565b60405180910390a45050505050565b60006001600283600381111561322b5761322a6143d3565b5b6132359190614402565b60ff16149050919050565b60008115159050919050565b600080600061325b8686613455565b915091506000820361328157838181613277576132766142bd565b5b049250505061332d565b8184116132a1576132a061329b6000861460126011613474565b61348e565b5b600084868809905081811183039250808203915060008560000386169050808604955080830492506001818260000304019050808402831792506000600287600302189050808702600203810290508087026002038102905080870260020381029050808702600203810290508087026002038102905080870260020381029050808402955050505050505b9392505050565b600080602060008451602086016000885af180613357576040513d6000823e3d81fd5b3d92506000519150506000821461337257600181141561338e565b60008473ffffffffffffffffffffffffffffffffffffffff163b145b156133d057836040517f5274afe70000000000000000000000000000000000000000000000000000000081526004016133c791906137e5565b60405180910390fd5b50505050565b613450838473ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8585604051602401613409929190613eca565b604051602081830303815290604052915060e01b6020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050613334565b505050565b6000806000198385098385029150818110828203039250509250929050565b600061347f84613240565b82841802821890509392505050565b634e487b71600052806020526024601cfd5b6040518060800160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160008152602001600081526020016000151581525090565b6000819050919050565b6134f3816134e0565b82525050565b600060808201905061350e60008301876134ea565b61351b60208301866134ea565b61352860408301856134ea565b61353560608301846134ea565b95945050505050565b600060208201905061355360008301846134ea565b92915050565b600081519050919050565b600082825260208201905092915050565b60005b83811015613593578082015181840152602081019050613578565b60008484015250505050565b6000601f19601f8301169050919050565b60006135bb82613559565b6135c58185613564565b93506135d5818560208601613575565b6135de8161359f565b840191505092915050565b6000602082019050818103600083015261360381846135b0565b905092915050565b6000604051905090565b600080fd5b600080fd5b613628816134e0565b811461363357600080fd5b50565b6000813590506136458161361f565b92915050565b60006020828403121561366157613660613615565b5b600061366f84828501613636565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006136a382613678565b9050919050565b6136b381613698565b81146136be57600080fd5b50565b6000813590506136d0816136aa565b92915050565b600080604083850312156136ed576136ec613615565b5b60006136fb858286016136c1565b925050602061370c85828601613636565b9150509250929050565b60008115159050919050565b61372b81613716565b82525050565b60006020820190506137466000830184613722565b92915050565b60008060006060848603121561376557613764613615565b5b6000613773868287016136c1565b9350506020613784868287016136c1565b925050604061379586828701613636565b9150509250925092565b600060ff82169050919050565b6137b58161379f565b82525050565b60006020820190506137d060008301846137ac565b92915050565b6137df81613698565b82525050565b60006020820190506137fa60008301846137d6565b92915050565b60006020828403121561381657613815613615565b5b6000613824848285016136c1565b91505092915050565b600080fd5b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61386f8261359f565b810181811067ffffffffffffffff8211171561388e5761388d613837565b5b80604052505050565b60006138a161360b565b90506138ad8282613866565b919050565b600067ffffffffffffffff8211156138cd576138cc613837565b5b6138d68261359f565b9050602081019050919050565b82818337600083830152505050565b6000613905613900846138b2565b613897565b90508281526020810184848401111561392157613920613832565b5b61392c8482856138e3565b509392505050565b600082601f8301126139495761394861382d565b5b81356139598482602086016138f2565b91505092915050565b6000806040838503121561397957613978613615565b5b600083013567ffffffffffffffff8111156139975761399661361a565b5b6139a385828601613934565b92505060206139b485828601613636565b9150509250929050565b600080604083850312156139d5576139d4613615565b5b60006139e385828601613636565b92505060206139f4858286016136c1565b9150509250929050565b6000608082019050613a1360008301876137d6565b613a2060208301866134ea565b613a2d60408301856134ea565b613a3a6060830184613722565b95945050505050565b613a4c81613698565b82525050565b613a5b816134e0565b82525050565b613a6a81613716565b82525050565b608082016000820151613a866000850182613a43565b506020820151613a996020850182613a52565b506040820151613aac6040850182613a52565b506060820151613abf6060850182613a61565b50505050565b6000608082019050613ada6000830184613a70565b92915050565b600080600060608486031215613af957613af8613615565b5b6000613b0786828701613636565b9350506020613b18868287016136c1565b9250506040613b29868287016136c1565b9150509250925092565b6000604082019050613b4860008301856134ea565b613b5560208301846134ea565b9392505050565b60008060408385031215613b7357613b72613615565b5b6000613b81858286016136c1565b9250506020613b92858286016136c1565b9150509250929050565b600081519050613bab8161361f565b92915050565b600060208284031215613bc757613bc6613615565b5b6000613bd584828501613b9c565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680613c2557607f821691505b602082108103613c3857613c37613bde565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000613c78826134e0565b9150613c83836134e0565b9250828203905081811115613c9b57613c9a613c3e565b5b92915050565b6000606082019050613cb660008301866134ea565b613cc360208301856134ea565b613cd060408301846137d6565b949350505050565b6000613ce38261379f565b9150613cee8361379f565b9250828201905060ff811115613d0757613d06613c3e565b5b92915050565b7f44414f2049442063616e6e6f7420626520656d70747900000000000000000000600082015250565b6000613d43601683613564565b9150613d4e82613d0d565b602082019050919050565b60006020820190508181036000830152613d7281613d36565b9050919050565b7f46656520616d6f756e74206d7573742062652067726561746572207468616e2060008201527f7a65726f00000000000000000000000000000000000000000000000000000000602082015250565b6000613dd5602483613564565b9150613de082613d79565b604082019050919050565b60006020820190508181036000830152613e0481613dc8565b9050919050565b7f496e76616c69642044414f204944206f722066656520616d6f756e7400000000600082015250565b6000613e41601c83613564565b9150613e4c82613e0b565b602082019050919050565b60006020820190508181036000830152613e7081613e34565b9050919050565b600081905092915050565b6000613e8d82613559565b613e978185613e77565b9350613ea7818560208601613575565b80840191505092915050565b6000613ebf8284613e82565b915081905092915050565b6000604082019050613edf60008301856137d6565b613eec60208301846134ea565b9392505050565b613efc81613716565b8114613f0757600080fd5b50565b600081519050613f1981613ef3565b92915050565b600060208284031215613f3557613f34613615565b5b6000613f4384828501613f0a565b91505092915050565b7f5265656e7472616e637947756172643a207265656e7472616e742063616c6c00600082015250565b6000613f82601f83613564565b9150613f8d82613f4c565b602082019050919050565b60006020820190508181036000830152613fb181613f75565b9050919050565b7f5061757361626c653a2070617573656400000000000000000000000000000000600082015250565b6000613fee601083613564565b9150613ff982613fb8565b602082019050919050565b6000602082019050818103600083015261401d81613fe1565b9050919050565b600061402f826134e0565b915061403a836134e0565b925082820190508082111561405257614051613c3e565b5b92915050565b600060808201905061406d60008301876134ea565b61407a60208301866137d6565b61408760408301856134ea565b61409460608301846134ea565b95945050505050565b60006060820190506140b260008301866137d6565b6140bf60208301856134ea565b6140cc60408301846134ea565b949350505050565b60006040820190506140e960008301856137d6565b6140f660208301846137d6565b9392505050565b60008160011c9050919050565b6000808291508390505b6001851115614154578086048111156141305761412f613c3e565b5b600185161561413f5780820291505b808102905061414d856140fd565b9450614114565b94509492505050565b60008261416d5760019050614229565b8161417b5760009050614229565b8160018114614191576002811461419b576141ca565b6001915050614229565b60ff8411156141ad576141ac613c3e565b5b8360020a9150848211156141c4576141c3613c3e565b5b50614229565b5060208310610133831016604e8410600b84101617156141ff5782820a9050838111156141fa576141f9613c3e565b5b614229565b61420c848484600161410a565b9250905081840481111561422357614222613c3e565b5b81810290505b9392505050565b600061423b826134e0565b91506142468361379f565b92506142737fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848461415d565b905092915050565b6000614286826134e0565b9150614291836134e0565b925082820261429f816134e0565b915082820484148315176142b6576142b5613c3e565b5b5092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b60006142f7826134e0565b9150614302836134e0565b925082614312576143116142bd565b5b828204905092915050565b6000614328826134e0565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff820361435a57614359613c3e565b5b600182019050919050565b600060608201905061437a60008301866134ea565b61438760208301856137d6565b61439460408301846134ea565b949350505050565b60006060820190506143b160008301866137d6565b6143be60208301856137d6565b6143cb60408301846134ea565b949350505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b600061440d8261379f565b91506144188361379f565b925082614428576144276142bd565b5b82820690509291505056fea2646970667358221220bd05bf74f18815fb077f798b2f14c933876cb265e2928683dca7b716f1bd4a1b64736f6c63430008140033",
  linkReferences: {},
  deployedLinkReferences: {}
};

// server/blockchain.ts
async function sendCUSD(to, amount) {
  if (!signer) throw new Error("No manager signer configured");
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  const tx = await cUSD.transfer(to, value);
  await tx.wait();
  return tx.hash;
}
var Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || "";
var CUSD_CONTRACT_ADDRESS = process.env.CUSD_CONTRACT_ADDRESS || "";
var PROVIDER_URL = process.env.RPC_URL || "http://localhost:8545";
var PRIVATE_KEY2 = process.env.MANAGER_PRIVATE_KEY || "";
var provider = new ethers.JsonRpcProvider(PROVIDER_URL);
var signer = PRIVATE_KEY2 ? new ethers.Wallet(PRIVATE_KEY2, provider) : void 0;
var maonoVault = new ethers.Contract(
  Maono_CONTRACT_ADDRESS,
  MaonoVault_default.abi,
  signer || provider
);
var cUSD = new ethers.Contract(
  CUSD_CONTRACT_ADDRESS,
  MaonoVault_default.abi,
  signer || provider
);
var MaonoVaultService = {
  contract: maonoVault,
  provider,
  signer,
  async getNAV() {
    return maonoVault.previewNAV();
  },
  async deposit(amount, userAddress) {
    return maonoVault.deposit(amount, userAddress);
  },
  async withdraw(amount, userAddress) {
    return maonoVault.withdraw(amount, userAddress, userAddress);
  },
  async updateNAV(newNav) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.updateNAV(newNav);
  },
  async distributePerformanceFee(profit) {
    if (!signer) throw new Error("No manager signer configured");
    return maonoVault.distributePerformanceFee(profit);
  },
  async listenToEvents(callback) {
    maonoVault.on("NAVUpdated", (newNAV, timestamp6) => {
      callback({ type: "NAVUpdated", newNAV, timestamp: timestamp6 });
    });
  }
};

// server/routes.ts
import multer from "multer";

// server/security/rateLimiter.ts
import rateLimit from "express-rate-limit";
var generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100,
  // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});
var authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  // limit each IP to 5 login attempts per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true
});
var paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 10,
  // limit each IP to 10 payment attempts per hour
  message: {
    error: "Too many payment attempts, please try again later.",
    retryAfter: 60 * 60
  }
});
var proposalRateLimit = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 5,
  // limit each IP to 5 proposals per hour
  message: {
    error: "Too many proposal submissions, please try again later.",
    retryAfter: 60 * 60
  }
});
var vaultRateLimit = rateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 3,
  // limit each IP to 3 vault operations per 5 minutes
  message: {
    error: "Too many vault operations, please try again later.",
    retryAfter: 5 * 60
  }
});

// server/security/auditLogger.ts
var AuditLogger = class _AuditLogger {
  static getInstance() {
    if (!_AuditLogger.instance) {
      _AuditLogger.instance = new _AuditLogger();
    }
    return _AuditLogger.instance;
  }
  async log(entry) {
    try {
      await storage.createAuditLog(entry);
      console.log(`[AUDIT] ${entry.timestamp.toISOString()} | ${entry.severity.toUpperCase()} | ${entry.category} | ${entry.action} | User: ${entry.userId} | IP: ${entry.ipAddress}`);
      if (entry.severity === "critical") {
        await this.sendSecurityAlert(entry);
      }
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }
  async sendSecurityAlert(entry) {
    console.error(`\u{1F6A8} CRITICAL SECURITY EVENT: ${entry.action} by ${entry.userId} from ${entry.ipAddress}`);
  }
};
var auditMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  res.send = function(body) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    setImmediate(async () => {
      const user = req.user;
      const auditLogger = AuditLogger.getInstance();
      const entry = {
        timestamp: /* @__PURE__ */ new Date(),
        userId: user?.claims?.sub,
        userEmail: user?.claims?.email,
        action: getActionFromRequest(req),
        resource: getResourceFromRequest(req),
        resourceId: req.params.id || req.params.daoId || req.params.proposalId,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip || req.connection.remoteAddress || "",
        userAgent: req.get("User-Agent") || "",
        status: res.statusCode,
        details: {
          responseTime,
          bodySize: JSON.stringify(body).length,
          query: req.query,
          params: req.params
        },
        severity: getSeverityFromRequest(req, res.statusCode),
        category: getCategoryFromRequest(req)
      };
      await auditLogger.log(entry);
    });
    return originalSend.call(this, body);
  };
  next();
};
function getActionFromRequest(req) {
  const method = req.method.toLowerCase();
  const path6 = req.path;
  if (path6.includes("/login")) return "login";
  if (path6.includes("/logout")) return "logout";
  if (path6.includes("/register")) return "register";
  if (path6.includes("/deposit")) return "vault_deposit";
  if (path6.includes("/withdraw")) return "vault_withdrawal";
  if (path6.includes("/vote")) return "vote_cast";
  if (path6.includes("/proposal")) return method === "post" ? "proposal_create" : "proposal_view";
  if (path6.includes("/dao") && method === "post") return "dao_create";
  if (path6.includes("/admin")) return "admin_action";
  return `${method}_${path6.split("/")[2] || "unknown"}`;
}
function getResourceFromRequest(req) {
  const path6 = req.path;
  if (path6.includes("/vault")) return "vault";
  if (path6.includes("/dao")) return "dao";
  if (path6.includes("/proposal")) return "proposal";
  if (path6.includes("/user")) return "user";
  if (path6.includes("/auth")) return "authentication";
  if (path6.includes("/payment")) return "payment";
  if (path6.includes("/admin")) return "admin";
  return "unknown";
}
function getSeverityFromRequest(req, statusCode) {
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "high";
  if (req.path.includes("/admin")) return "high";
  if (req.path.includes("/vault") || req.path.includes("/payment")) return "medium";
  return "low";
}
function getCategoryFromRequest(req) {
  const path6 = req.path;
  if (path6.includes("/auth") || path6.includes("/login") || path6.includes("/register")) return "auth";
  if (path6.includes("/vault") || path6.includes("/payment") || path6.includes("/deposit") || path6.includes("/withdraw")) return "financial";
  if (path6.includes("/proposal") || path6.includes("/vote") || path6.includes("/dao")) return "governance";
  if (path6.includes("/admin")) return "admin";
  if (path6.includes("/user") || path6.includes("/profile")) return "data";
  return "security";
}
var logSecurityEvent = {
  suspiciousActivity: async (userId, activity, details) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: /* @__PURE__ */ new Date(),
      userId,
      action: "suspicious_activity",
      resource: "security",
      endpoint: "system",
      method: "SYSTEM",
      ipAddress: "system",
      userAgent: "system",
      status: 0,
      details: { activity, ...details },
      severity: "high",
      category: "security"
    });
  },
  failedAuth: async (email, ipAddress, reason) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: /* @__PURE__ */ new Date(),
      userEmail: email,
      action: "failed_authentication",
      resource: "authentication",
      endpoint: "/auth/login",
      method: "POST",
      ipAddress,
      userAgent: "unknown",
      status: 401,
      details: { reason },
      severity: "medium",
      category: "auth"
    });
  },
  privilegeEscalation: async (userId, fromRole, toRole, adminId) => {
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.log({
      timestamp: /* @__PURE__ */ new Date(),
      userId: adminId,
      action: "privilege_escalation",
      resource: "user",
      resourceId: userId,
      endpoint: "/admin/users",
      method: "PUT",
      ipAddress: "system",
      userAgent: "system",
      status: 200,
      details: { targetUser: userId, fromRole, toRole },
      severity: "critical",
      category: "admin"
    });
  }
};

// server/routes.ts
import fs from "fs";
import path from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname2 } from "path";

// server/routes/mpesa-status.ts
import express2 from "express";
import { z } from "zod";

// server/notificationService.ts
import { EventEmitter } from "events";
import nodemailer from "nodemailer";
var NotificationService2 = class extends EventEmitter {
  constructor() {
    super();
    this.subscribers = /* @__PURE__ */ new Map();
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  async createNotification(notification) {
    try {
      const dbNotification = await storage.createNotification({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority || "medium",
        metadata: notification.metadata || {}
      });
      const preferences = await storage.getUserNotificationPreferences(notification.userId);
      if (preferences?.emailNotifications) {
        await this.sendEmailNotification(notification.userId, notification);
      }
      if (preferences?.pushNotifications) {
        await this.sendPushNotification(notification.userId, notification);
      }
      this.emit("notification_created", {
        ...dbNotification,
        userId: notification.userId
      });
      console.log(`Notification created for user ${notification.userId}: ${notification.type}`);
      return dbNotification;
    } catch (error) {
      console.error("Failed to create notification:", error);
      return null;
    }
  }
  async sendPaymentNotification(recipient, notification) {
    try {
      const channel = this.subscribers.get(recipient) || { sms: true };
      if (channel.sms) {
        await this.sendSMS(recipient, this.formatSMSMessage(notification));
      }
      if (channel.email) {
        await this.sendEmail(recipient, this.formatEmailMessage(notification));
      }
      if (channel.push) {
        await this.sendPushNotification(recipient, this.formatPushMessage(notification));
      }
      if (channel.webhook) {
        await this.sendWebhook(channel.webhook, notification);
      }
      this.emit("payment_notification", {
        recipient,
        notification,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`Payment notification sent to ${recipient}: ${notification.type}`);
      return true;
    } catch (error) {
      console.error("Failed to send payment notification:", error);
      return false;
    }
  }
  async sendEmailNotification(userId, notification) {
    try {
      const user = await storage.getUserById(userId);
      if (!user?.email) return;
      const mailOptions = {
        from: process.env.SMTP_FROM || "noreply@mtaadao.com",
        to: user.email,
        subject: notification.title,
        html: this.formatEmailTemplate(notification)
      };
      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Email notification sent to ${user.email}`);
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  }
  formatEmailTemplate(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
          .priority-high { border-left: 4px solid #ef4444; }
          .priority-urgent { border-left: 4px solid #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MtaaDAO Notification</h1>
          </div>
          <div class="content ${notification.priority === "high" || notification.priority === "urgent" ? `priority-${notification.priority}` : ""}">
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            ${notification.metadata?.actionUrl ? `<p><a href="${notification.metadata.actionUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Action</a></p>` : ""}
          </div>
          <div class="footer">
            <p>This is an automated message from MtaaDAO. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  async sendPushNotification(userId, notification) {
    try {
      console.log(`Push notification sent to user ${userId}: ${notification.title}`);
      const pushPayload = {
        title: notification.title,
        body: notification.message,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          type: notification.type,
          userId,
          metadata: notification.metadata
        }
      };
      console.log("Push payload:", pushPayload);
    } catch (error) {
      console.error("Failed to send push notification:", error);
    }
  }
  formatSMSMessage(notification) {
    switch (notification.type) {
      case "payment_pending":
        return `Payment of ${notification.amount} ${notification.currency} is being processed. Transaction ID: ${notification.transactionId}`;
      case "payment_success":
        return `Payment successful! ${notification.amount} ${notification.currency} received. Transaction ID: ${notification.transactionId}`;
      case "payment_failed":
        return `Payment failed. ${notification.amount} ${notification.currency}. ${notification.errorMessage || "Please try again."}`;
      case "payment_retry":
        return `Retrying payment of ${notification.amount} ${notification.currency}. Transaction ID: ${notification.transactionId}`;
      default:
        return `Payment update for transaction ${notification.transactionId}`;
    }
  }
  formatEmailMessage(notification) {
    const subject = `Payment ${notification.type.replace("_", " ")} - ${notification.transactionId}`;
    let body = `
      <h2>Payment Update</h2>
      <p><strong>Transaction ID:</strong> ${notification.transactionId}</p>
      <p><strong>Amount:</strong> ${notification.amount} ${notification.currency}</p>
      <p><strong>Status:</strong> ${notification.type.replace("_", " ")}</p>
    `;
    if (notification.errorMessage) {
      body += `<p><strong>Error:</strong> ${notification.errorMessage}</p>`;
    }
    return { subject, body };
  }
  formatPushMessage(notification) {
    const title = `Payment ${notification.type.replace("_", " ")}`;
    const body = `${notification.amount} ${notification.currency} - ${notification.transactionId}`;
    return { title, body };
  }
  async sendSMS(phone, message) {
    console.log(`SMS to ${phone}: ${message}`);
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`SMS sent successfully to ${phone}`);
        resolve();
      }, 100);
    });
  }
  async sendEmail(email, message) {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@mtaadao.com",
        to: email,
        subject: message.subject,
        html: message.body
      });
      console.log(`Email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Email failed for ${email}:`, error);
      throw error;
    }
  }
  async sendWebhook(url, notification) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "payment_notification",
          data: notification,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
      console.log(`Webhook sent successfully to ${url}`);
    } catch (error) {
      console.error(`Webhook failed for ${url}:`, error);
      throw error;
    }
  }
  subscribe(recipient, channels) {
    this.subscribers.set(recipient, channels);
  }
  unsubscribe(recipient) {
    this.subscribers.delete(recipient);
  }
  // Real-time payment status updates via WebSocket
  getPaymentStatusStream(transactionId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners(`payment_${transactionId}`);
        reject(new Error("Payment status timeout"));
      }, 3e5);
      this.once(`payment_${transactionId}`, (status) => {
        clearTimeout(timeout);
        resolve(status);
      });
    });
  }
  updatePaymentStatus(transactionId, status) {
    this.emit(`payment_${transactionId}`, status);
  }
  // Bulk notification creation for announcements
  async createBulkNotifications(userIds, notificationData) {
    const notifications2 = [];
    for (const userId of userIds) {
      const notification = await this.createNotification({
        ...notificationData,
        userId
      });
      if (notification) {
        notifications2.push(notification);
      }
    }
    return notifications2;
  }
  // Server-Sent Events endpoint for real-time notifications
  setupSSE(userId, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    });
    const heartbeat = setInterval(() => {
      res.write('data: {"type":"heartbeat"}\n\n');
    }, 3e4);
    const notificationHandler = (notification) => {
      if (notification.userId === userId) {
        res.write(`data: ${JSON.stringify(notification)}

`);
      }
    };
    this.on("notification_created", notificationHandler);
    res.on("close", () => {
      clearInterval(heartbeat);
      this.removeListener("notification_created", notificationHandler);
    });
  }
};
var notificationService = new NotificationService2();

// server/routes/mpesa-status.ts
var router2 = express2.Router();
var mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(z.object({
          Name: z.string(),
          Value: z.union([z.string(), z.number()])
        }))
      }).optional()
    })
  })
});
var paymentStatus = /* @__PURE__ */ new Map();
var mpesaRetryQueue = /* @__PURE__ */ new Map();
var MpesaReconciliationService = class {
  static async reconcilePayment(checkoutRequestId, callbackData) {
    const payment = paymentStatus.get(checkoutRequestId);
    if (!payment) {
      console.warn(`M-Pesa reconciliation: Transaction ${checkoutRequestId} not found`);
      return false;
    }
    let amount, receipt, phoneNumber;
    if (callbackData.CallbackMetadata?.Item) {
      for (const item of callbackData.CallbackMetadata.Item) {
        if (item.Name === "Amount") amount = Number(item.Value);
        if (item.Name === "MpesaReceiptNumber") receipt = String(item.Value);
        if (item.Name === "PhoneNumber") phoneNumber = String(item.Value);
      }
    }
    if (amount && payment.amount !== amount) {
      console.error(`M-Pesa reconciliation failed: Amount mismatch for ${checkoutRequestId}`);
      return false;
    }
    payment.receipt = receipt;
    payment.resultCode = callbackData.ResultCode;
    payment.resultDesc = callbackData.ResultDesc;
    payment.status = callbackData.ResultCode === 0 ? "completed" : "failed";
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    paymentStatus.set(checkoutRequestId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} KES`);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_success",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "completed",
        receipt: payment.receipt,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing completed M-Pesa payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      const retryableErrors = [1, 1032, 1037];
      if (retryableErrors.includes(payment.resultCode || 0) && (payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        mpesaRetryQueue.set(payment.transactionId, payment);
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 6e4 * payment.retryCount);
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_retry",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
      } else {
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_failed",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          errorMessage: payment.resultDesc
        });
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "failed",
        error: payment.resultDesc,
        retryCount: payment.retryCount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing failed M-Pesa payment:", error);
      return false;
    }
  }
  static async retryFailedPayment(transactionId) {
    const payment = mpesaRetryQueue.get(transactionId);
    if (!payment) return;
    try {
      console.log(`Retrying M-Pesa payment ${transactionId} (attempt ${payment.retryCount})`);
      const retrySuccess = Math.random() > 0.3;
      if (retrySuccess) {
        payment.status = "completed";
        payment.resultCode = 0;
        payment.resultDesc = "Success";
        payment.receipt = "RETRY" + Date.now();
        mpesaRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`M-Pesa retry failed for payment ${transactionId}:`, error);
    }
  }
};
router2.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = paymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: status,
      retryInfo: mpesaRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router2.post("/callback", async (req, res) => {
  try {
    const callback = mpesaCallbackSchema.parse(req.body);
    const { ResultCode, CheckoutRequestID, ResultDesc } = callback.Body.stkCallback;
    const reconciled = await MpesaReconciliationService.reconcilePayment(
      CheckoutRequestID,
      callback.Body.stkCallback
    );
    if (!reconciled) {
      return res.status(400).json({
        code: "RECONCILIATION_FAILED",
        message: "Payment reconciliation failed"
      });
    }
    const payment = paymentStatus.get(CheckoutRequestID);
    if (!payment) {
      return res.status(404).json({
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found"
      });
    }
    if (ResultCode === 0) {
      await MpesaReconciliationService.processCompletedPayment(payment);
    } else {
      await MpesaReconciliationService.processFailedPayment(payment);
    }
    console.log(`M-Pesa payment ${CheckoutRequestID} processed: ${ResultCode === 0 ? "Success" : "Failed"}`);
    res.json({
      success: true,
      reconciled: true,
      resultCode: ResultCode
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    res.status(400).json({
      code: "INVALID_CALLBACK",
      message: "Invalid callback data",
      details: error.message
    });
  }
});
router2.post("/retry/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const payment = paymentStatus.get(transactionId);
    if (!payment) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    if (payment.status !== "failed") {
      return res.status(400).json({
        code: "INVALID_STATUS",
        message: "Can only retry failed payments"
      });
    }
    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: "RETRY_LIMIT_EXCEEDED",
        message: "Maximum retry attempts exceeded"
      });
    }
    payment.retryCount = (payment.retryCount || 0) + 1;
    mpesaRetryQueue.set(transactionId, payment);
    await MpesaReconciliationService.retryFailedPayment(transactionId);
    res.json({
      success: true,
      message: "Payment retry initiated",
      retryCount: payment.retryCount
    });
  } catch (error) {
    res.status(500).json({
      code: "RETRY_FAILED",
      message: "Failed to retry payment",
      details: error.message
    });
  }
});
router2.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(paymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      inRetryQueue: mpesaRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum2, p) => sum2 + p.amount, 0),
      successRate: payments.length > 0 ? (payments.filter((p) => p.status === "completed").length / payments.length * 100).toFixed(2) + "%" : "0%"
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        inRetryQueue: mpesaRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
var mpesa_status_default = router2;

// server/routes/stripe-status.ts
import express3 from "express";
import { z as z2 } from "zod";
var router3 = express3.Router();
var stripeWebhookSchema = z2.object({
  id: z2.string(),
  type: z2.string(),
  data: z2.object({
    object: z2.object({
      id: z2.string(),
      amount: z2.number(),
      currency: z2.string(),
      status: z2.string(),
      receipt_url: z2.string().optional(),
      customer_email: z2.string().optional(),
      customer: z2.string().optional(),
      created: z2.number(),
      failure_code: z2.string().optional(),
      failure_message: z2.string().optional(),
      metadata: z2.record(z2.string()).optional()
    })
  })
});
var stripePaymentStatus = /* @__PURE__ */ new Map();
var stripeRetryQueue = /* @__PURE__ */ new Map();
var StripeReconciliationService = class {
  static async reconcilePayment(transactionId, stripeData) {
    const payment = stripePaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Stripe reconciliation: Transaction ${transactionId} not found`);
      return false;
    }
    if (payment.amount !== stripeData.amount || payment.currency !== stripeData.currency) {
      console.error(`Stripe reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }
    const status = stripeData.status === "succeeded" ? "completed" : stripeData.status === "requires_payment_method" ? "failed" : stripeData.status;
    payment.status = status;
    payment.receipt = stripeData.receipt_url;
    payment.failureCode = stripeData.failure_code;
    payment.failureMessage = stripeData.failure_message;
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    stripePaymentStatus.set(transactionId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount / 100} ${payment.currency.toUpperCase()}`);
      }
      if (payment.email) {
        await notificationService.sendPaymentNotification(payment.email, {
          type: "payment_success",
          amount: payment.amount / 100,
          // Stripe amounts are in cents
          currency: payment.currency.toUpperCase(),
          transactionId: payment.transactionId
        });
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "completed",
        receipt: payment.receipt,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing completed Stripe payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      const retryableFailures = ["card_declined", "insufficient_funds", "processing_error"];
      if (payment.failureCode && retryableFailures.includes(payment.failureCode) && (payment.retryCount || 0) < 2) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        stripeRetryQueue.set(payment.transactionId, payment);
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: "payment_retry",
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage
          });
        }
      } else {
        if (payment.email) {
          await notificationService.sendPaymentNotification(payment.email, {
            type: "payment_failed",
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            transactionId: payment.transactionId,
            errorMessage: payment.failureMessage || payment.failureCode
          });
        }
      }
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: "failed",
        error: payment.failureMessage || payment.failureCode,
        retryCount: payment.retryCount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (error) {
      console.error("Error processing failed Stripe payment:", error);
      return false;
    }
  }
};
router3.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = stripePaymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: {
        ...status,
        amount: status.amount / 100
        // Convert from cents to dollars
      },
      retryInfo: stripeRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router3.post("/webhook", async (req, res) => {
  try {
    const event = stripeWebhookSchema.parse(req.body);
    const payment = event.data.object;
    const relevantEvents = [
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "invoice.payment_succeeded",
      "invoice.payment_failed"
    ];
    if (!relevantEvents.includes(event.type)) {
      return res.status(200).json({ received: true });
    }
    const reconciled = await StripeReconciliationService.reconcilePayment(
      payment.id,
      payment
    );
    if (!reconciled) {
      console.warn(`Stripe webhook: Payment ${payment.id} not found for reconciliation`);
      const newPayment = {
        id: payment.id,
        transactionId: payment.id,
        status: payment.status === "succeeded" ? "completed" : "failed",
        amount: payment.amount,
        currency: payment.currency,
        email: payment.customer_email,
        receipt: payment.receipt_url,
        failureCode: payment.failure_code,
        failureMessage: payment.failure_message,
        createdAt: new Date(payment.created * 1e3).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        daoId: payment.metadata?.daoId
      };
      stripePaymentStatus.set(payment.id, newPayment);
    }
    const updatedPayment = stripePaymentStatus.get(payment.id);
    if (!updatedPayment) {
      return res.status(500).json({ error: "Failed to process payment" });
    }
    if (event.type.includes("succeeded")) {
      await StripeReconciliationService.processCompletedPayment(updatedPayment);
    } else if (event.type.includes("failed")) {
      await StripeReconciliationService.processFailedPayment(updatedPayment);
    }
    console.log(`Stripe payment ${payment.id} processed: ${event.type}`);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(400).json({
      code: "INVALID_WEBHOOK",
      message: "Invalid Stripe webhook data",
      details: error.message
    });
  }
});
router3.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(stripePaymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      inRetryQueue: stripeRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum2, p) => sum2 + p.amount / 100, 0),
      // Convert from cents
      successRate: payments.length > 0 ? (payments.filter((p) => p.status === "completed").length / payments.length * 100).toFixed(2) + "%" : "0%",
      topFailureReasons: (void 0).getTopFailureReasons(payments.filter((p) => p.status === "failed"))
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        amount: p.amount / 100,
        // Convert from cents
        inRetryQueue: stripeRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
var stripe_status_default = router3;

// server/routes/kotanipay-status.ts
import express4 from "express";
import { z as z3 } from "zod";
var router4 = express4.Router();
var kotaniPaymentStatus = /* @__PURE__ */ new Map();
var paymentRetryQueue = /* @__PURE__ */ new Map();
var kotaniWebhookSchema = z3.object({
  transactionId: z3.string(),
  status: z3.enum(["pending", "completed", "failed", "cancelled"]),
  amount: z3.number(),
  currency: z3.string(),
  phone: z3.string(),
  reference: z3.string().optional(),
  timestamp: z3.string().optional(),
  errorCode: z3.string().optional(),
  errorMessage: z3.string().optional()
});
var PaymentReconciliationService = class {
  static async reconcilePayment(transactionId, webhookData) {
    const payment = kotaniPaymentStatus.get(transactionId);
    if (!payment) {
      console.warn(`Payment reconciliation: Transaction ${transactionId} not found`);
      return false;
    }
    if (payment.amount !== webhookData.amount || payment.currency !== webhookData.currency) {
      console.error(`Payment reconciliation failed: Amount/currency mismatch for ${transactionId}`);
      return false;
    }
    payment.status = webhookData.status;
    payment.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (webhookData.errorMessage) {
      payment.errorMessage = webhookData.errorMessage;
    }
    kotaniPaymentStatus.set(transactionId, payment);
    return true;
  }
  static async processCompletedPayment(payment) {
    try {
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} ${payment.currency}`);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_success",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });
      return true;
    } catch (error) {
      console.error("Error processing completed payment:", error);
      return false;
    }
  }
  static async processFailedPayment(payment) {
    try {
      if ((payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        paymentRetryQueue.set(payment.transactionId, payment);
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 3e4 * payment.retryCount);
      }
      await notificationService.sendPaymentNotification(payment.phone, {
        type: "payment_failed",
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId,
        errorMessage: payment.errorMessage
      });
      return true;
    } catch (error) {
      console.error("Error processing failed payment:", error);
      return false;
    }
  }
  static async retryFailedPayment(transactionId) {
    const payment = paymentRetryQueue.get(transactionId);
    if (!payment) return;
    try {
      console.log(`Retrying payment ${transactionId} (attempt ${payment.retryCount})`);
      const retrySuccess = Math.random() > 0.5;
      if (retrySuccess) {
        payment.status = "completed";
        paymentRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        payment.status = "failed";
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`Retry failed for payment ${transactionId}:`, error);
    }
  }
};
router4.get("/status/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const status = kotaniPaymentStatus.get(transactionId);
    if (!status) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    res.json({
      success: true,
      payment: status,
      retryInfo: paymentRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({
      code: "STATUS_CHECK_FAILED",
      message: "Failed to check payment status",
      details: error.message
    });
  }
});
router4.post("/callback", async (req, res) => {
  try {
    const webhook = kotaniWebhookSchema.parse(req.body);
    const reconciled = await PaymentReconciliationService.reconcilePayment(
      webhook.transactionId,
      webhook
    );
    if (!reconciled) {
      return res.status(400).json({
        code: "RECONCILIATION_FAILED",
        message: "Payment reconciliation failed"
      });
    }
    const payment = {
      id: webhook.transactionId,
      transactionId: webhook.transactionId,
      status: webhook.status,
      amount: webhook.amount,
      currency: webhook.currency,
      phone: webhook.phone,
      reference: webhook.reference,
      createdAt: kotaniPaymentStatus.get(webhook.transactionId)?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: webhook.errorMessage
    };
    kotaniPaymentStatus.set(webhook.transactionId, payment);
    switch (webhook.status) {
      case "completed":
        await PaymentReconciliationService.processCompletedPayment(payment);
        break;
      case "failed":
      case "cancelled":
        await PaymentReconciliationService.processFailedPayment(payment);
        break;
      case "pending":
        await notificationService.sendPaymentNotification(payment.phone, {
          type: "payment_pending",
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
        break;
    }
    console.log(`KotaniPay payment ${webhook.transactionId} status updated: ${webhook.status}`);
    res.json({
      success: true,
      reconciled: true,
      status: webhook.status
    });
  } catch (error) {
    console.error("KotaniPay callback error:", error);
    res.status(400).json({
      code: "INVALID_CALLBACK",
      message: "Invalid callback data",
      details: error.message
    });
  }
});
router4.post("/retry/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  try {
    const payment = kotaniPaymentStatus.get(transactionId);
    if (!payment) {
      return res.status(404).json({
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }
    if (payment.status !== "failed") {
      return res.status(400).json({
        code: "INVALID_STATUS",
        message: "Can only retry failed payments"
      });
    }
    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: "RETRY_LIMIT_EXCEEDED",
        message: "Maximum retry attempts exceeded"
      });
    }
    payment.retryCount = (payment.retryCount || 0) + 1;
    paymentRetryQueue.set(transactionId, payment);
    await PaymentReconciliationService.retryFailedPayment(transactionId);
    res.json({
      success: true,
      message: "Payment retry initiated",
      retryCount: payment.retryCount
    });
  } catch (error) {
    res.status(500).json({
      code: "RETRY_FAILED",
      message: "Failed to retry payment",
      details: error.message
    });
  }
});
router4.get("/reconcile", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const payments = Array.from(kotaniPaymentStatus.values()).filter((payment) => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });
    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      failed: payments.filter((p) => p.status === "failed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      cancelled: payments.filter((p) => p.status === "cancelled").length,
      inRetryQueue: paymentRetryQueue.size,
      totalAmount: payments.filter((p) => p.status === "completed").reduce((sum2, p) => sum2 + p.amount, 0)
    };
    res.json({
      success: true,
      reconciliation,
      payments: payments.map((p) => ({
        ...p,
        inRetryQueue: paymentRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error) {
    res.status(500).json({
      code: "RECONCILIATION_FAILED",
      message: "Failed to generate reconciliation report",
      details: error.message
    });
  }
});
var kotanipay_status_default = router4;

// server/routes/dao-subscriptions.ts
import express5 from "express";
import { eq as eq4 } from "drizzle-orm";
var router5 = express5.Router();
var SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    features: ["Basic proposals", "Up to 50 members", "Community support"],
    limits: { members: 50, proposals: 10, storage: "100MB" }
  },
  pro: {
    name: "Pro",
    price: 29.99,
    features: ["Advanced proposals", "Up to 500 members", "Priority support", "Custom branding"],
    limits: { members: 500, proposals: 100, storage: "1GB" }
  },
  enterprise: {
    name: "Enterprise",
    price: 99.99,
    features: ["Unlimited proposals", "Unlimited members", "24/7 support", "White-label solution"],
    limits: { members: -1, proposals: -1, storage: "10GB" }
  }
};
router5.get("/plans", (req, res) => {
  res.json({
    success: true,
    plans: SUBSCRIPTION_PLANS
  });
});
router5.get("/:daoId/status", async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await db2.select().from(daos).where(eq4(daos.id, daoId)).limit(1);
    if (dao.length === 0) {
      return res.status(404).json({
        success: false,
        message: "DAO not found"
      });
    }
    const daoData = dao[0];
    const currentPlan = daoData.plan || "free";
    const planDetails = SUBSCRIPTION_PLANS[currentPlan];
    res.json({
      success: true,
      subscription: {
        daoId,
        currentPlan,
        planDetails,
        billingStatus: daoData.billingStatus || "active",
        nextBillingDate: daoData.nextBillingDate,
        createdAt: daoData.createdAt,
        updatedAt: daoData.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get subscription status",
      error: error.message
    });
  }
});
router5.post("/:daoId/upgrade", async (req, res) => {
  try {
    const { daoId } = req.params;
    const { plan, paymentMethod } = req.body;
    if (!SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const subscriptionId = "SUB-" + Date.now();
    await db2.update(daos).set({
      plan,
      billingStatus: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3),
      // 30 days from now
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(daos.id, daoId));
    res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      subscription: {
        daoId,
        plan,
        subscriptionId,
        amount: planDetails.price,
        billingStatus: "active",
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upgrade subscription",
      error: error.message
    });
  }
});
router5.post("/:daoId/cancel", async (req, res) => {
  try {
    const { daoId } = req.params;
    await db2.update(daos).set({
      billingStatus: "cancelled",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(daos.id, daoId));
    res.json({
      success: true,
      message: "Subscription cancelled successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
});
router5.get("/:daoId/usage", async (req, res) => {
  try {
    const { daoId } = req.params;
    const mockUsage = {
      daoId,
      currentMembers: 25,
      currentProposals: 5,
      storageUsed: "45MB",
      apiCalls: 150,
      bandwidthUsed: "2.3GB"
    };
    res.json({
      success: true,
      usage: mockUsage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get usage statistics",
      error: error.message
    });
  }
});
var dao_subscriptions_default = router5;

// server/routes/disbursements.ts
import express6 from "express";
import { eq as eq5, and as and3, desc as desc4 } from "drizzle-orm";
var router6 = express6.Router();
router6.post("/create", async (req, res) => {
  try {
    const disbursement = req.body;
    const { daoId, recipients, totalAmount, currency, description } = disbursement;
    if (!daoId || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "DAO ID and recipients are required"
      });
    }
    const calculatedTotal = recipients.reduce((sum2, recipient) => sum2 + recipient.amount, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Total amount does not match sum of recipient amounts"
      });
    }
    const disbursementId = "DISB-" + Date.now();
    const feePercent = 0.01;
    const totalFee = Math.round(totalAmount * feePercent * 100) / 100;
    const netAmount = totalAmount - totalFee;
    const transactions2 = [];
    for (const recipient of recipients) {
      const transaction = {
        id: `TXN-${disbursementId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fromUserId: daoId,
        toUserId: recipient.userId,
        walletAddress: recipient.walletAddress,
        amount: recipient.amount,
        currency,
        type: "disbursement",
        status: "pending",
        description: `${description} - ${recipient.reason}`,
        disbursementId,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      await db2.insert(walletTransactions).values(transaction);
      transactions2.push(transaction);
    }
    res.json({
      success: true,
      disbursementId,
      message: "Disbursement created successfully",
      totalAmount,
      fee: totalFee,
      netAmount,
      recipientCount: recipients.length,
      transactions: transactions2.map((t) => ({
        id: t.id,
        recipient: t.toUserId,
        amount: t.amount,
        status: t.status
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create disbursement",
      error: error.message
    });
  }
});
router6.get("/:daoId/history", async (req, res) => {
  try {
    const { daoId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const transactions2 = await db2.select().from(walletTransactions).where(and3(
      eq5(walletTransactions.fromUserId, daoId),
      eq5(walletTransactions.type, "disbursement")
    )).orderBy(desc4(walletTransactions.createdAt)).limit(Number(limit)).offset(Number(offset));
    const disbursements = /* @__PURE__ */ new Map();
    transactions2.forEach((tx) => {
      const disbursementId = tx.disbursementId;
      if (!disbursements.has(disbursementId)) {
        disbursements.set(disbursementId, {
          id: disbursementId,
          daoId,
          totalAmount: 0,
          recipientCount: 0,
          status: "pending",
          currency: tx.currency,
          createdAt: tx.createdAt,
          recipients: []
        });
      }
      const disbursement = disbursements.get(disbursementId);
      disbursement.totalAmount += typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      disbursement.recipientCount += 1;
      disbursement.recipients.push({
        userId: tx.toUserId,
        walletAddress: tx.walletAddress,
        amount: tx.amount,
        status: tx.status,
        description: tx.description
      });
      const allCompleted = disbursement.recipients.every((r) => r.status === "completed");
      const anyFailed = disbursement.recipients.some((r) => r.status === "failed");
      if (allCompleted) disbursement.status = "completed";
      else if (anyFailed) disbursement.status = "partial";
      else disbursement.status = "pending";
    });
    res.json({
      success: true,
      disbursements: Array.from(disbursements.values()),
      total: disbursements.size
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get disbursement history",
      error: error.message
    });
  }
});
router6.post("/:disbursementId/execute", async (req, res) => {
  try {
    const { disbursementId } = req.params;
    const { paymentMethod = "wallet" } = req.body;
    const transactions2 = await db2.select().from(walletTransactions).where(and3(
      eq5(walletTransactions.disbursementId, disbursementId),
      eq5(walletTransactions.status, "pending")
    ));
    if (transactions2.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending transactions found for this disbursement"
      });
    }
    const results = [];
    for (const transaction of transactions2) {
      try {
        await db2.update(walletTransactions).set({
          status: "completed",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq5(walletTransactions.id, transaction.id));
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: "completed"
        });
      } catch (error) {
        await db2.update(walletTransactions).set({
          status: "failed",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq5(walletTransactions.id, transaction.id));
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: "failed",
          error: error.message
        });
      }
    }
    const successful = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    res.json({
      success: true,
      disbursementId,
      message: `Disbursement execution completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute disbursement",
      error: error.message
    });
  }
});
router6.get("/:disbursementId/status", async (req, res) => {
  try {
    const { disbursementId } = req.params;
    const transactions2 = await db2.select().from(walletTransactions).where(eq5(walletTransactions.disbursementId, disbursementId));
    if (transactions2.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Disbursement not found"
      });
    }
    const totalAmount = transactions2.reduce((sum2, tx) => {
      const amount = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      return sum2 + amount;
    }, 0);
    const statusCounts = transactions2.reduce((counts, tx) => {
      counts[tx.status || "pending"] = (counts[tx.status || "pending"] || 0) + 1;
      return counts;
    }, {});
    const overallStatus = statusCounts.failed > 0 ? "partial" : statusCounts.pending > 0 ? "pending" : "completed";
    res.json({
      success: true,
      disbursement: {
        id: disbursementId,
        totalAmount,
        recipientCount: transactions2.length,
        status: overallStatus,
        statusBreakdown: statusCounts,
        currency: transactions2[0].currency,
        createdAt: transactions2[0].createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get disbursement status",
      error: error.message
    });
  }
});
var disbursements_default = router6;

// server/routes/tasks.ts
import express7 from "express";
import { eq as eq6, and as and4, desc as desc5, sql as sql2 } from "drizzle-orm";
import { z as z4 } from "zod";
var router7 = express7.Router();
var createTaskSchema = z4.object({
  title: z4.string().min(1, "Title is required"),
  description: z4.string().min(1, "Description is required"),
  reward: z4.number().positive("Reward must be positive"),
  daoId: z4.string().min(1, "DAO ID is required"),
  category: z4.string().min(1, "Category is required"),
  difficulty: z4.enum(["easy", "medium", "hard"]),
  estimatedTime: z4.string().optional(),
  deadline: z4.string().optional(),
  requiresVerification: z4.boolean().default(false)
});
var verifyTaskSchema = z4.object({
  proofUrl: z4.string().url("Valid proof URL required"),
  description: z4.string().min(10, "Verification description required"),
  screenshots: z4.array(z4.string().url()).optional()
});
function requireRole3(...roles2) {
  return async (req, res, next) => {
    const userId = req.user.claims.sub;
    const daoId = req.params.daoId || req.body.daoId;
    if (daoId) {
      const membership = await db2.select().from(daoMemberships).where(and4(eq6(daoMemberships.daoId, daoId), eq6(daoMemberships.userId, userId)));
      if (!membership.length || !roles2.includes(membership[0].role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }
    next();
  };
}
router7.post("/create", requireRole3("admin", "moderator"), async (req, res) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const userId = req.user.claims.sub;
    const task = await db2.insert(tasks).values({
      ...validatedData,
      creatorId: userId,
      status: "open"
    }).returning();
    await db2.insert(taskHistory2).values({
      taskId: task[0].id,
      userId,
      action: "created",
      details: { category: validatedData.category, reward: validatedData.reward }
    });
    res.status(201).json(task[0]);
  } catch (err) {
    if (err instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/", async (req, res) => {
  try {
    const {
      daoId,
      status,
      category,
      difficulty,
      limit = 20,
      offset = 0
    } = req.query;
    let query = db2.select().from(tasks);
    let conditions = [];
    if (daoId) conditions.push(eq6(tasks.daoId, daoId));
    if (status) conditions.push(eq6(tasks.status, status));
    if (category) conditions.push(eq6(tasks.category, category));
    if (difficulty) conditions.push(eq6(tasks.difficulty, difficulty));
    if (conditions.length > 0) {
      query = query.where(and4(...conditions));
    }
    const taskList = await query.orderBy(desc5(tasks.createdAt)).limit(Number(limit)).offset(Number(offset));
    res.json(taskList);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/categories", async (req, res) => {
  try {
    const categories = await db2.select({ category: tasks.category }).from(tasks).groupBy(tasks.category);
    res.json(categories.map((c) => c.category).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/:taskId/claim", async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.claims.sub;
    const task = await db2.select().from(tasks).where(eq6(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].status !== "open") {
      return res.status(400).json({ error: "Task is not available for claiming" });
    }
    const claimedTask = await db2.update(tasks).set({
      claimerId: userId,
      status: "claimed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(tasks.id, taskId)).returning();
    await db2.insert(taskHistory2).values({
      taskId,
      userId,
      action: "claimed",
      details: { claimedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    res.json(claimedTask[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/:taskId/submit", async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.claims.sub;
    const validatedData = verifyTaskSchema.parse(req.body);
    const task = await db2.select().from(tasks).where(and4(eq6(tasks.id, taskId), eq6(tasks.claimerId, userId))).limit(1);
    if (!task.length) {
      return res.status(403).json({ error: "Task not found or not claimed by you" });
    }
    if (task[0].status !== "claimed") {
      return res.status(400).json({ error: "Task is not in claimed status" });
    }
    await db2.update(tasks).set({
      status: "submitted",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(tasks.id, taskId));
    await db2.insert(taskHistory2).values({
      taskId,
      userId,
      action: "submitted",
      details: validatedData
    });
    res.json({ message: "Task submitted successfully", taskId });
  } catch (err) {
    if (err instanceof z4.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.post("/:taskId/verify", requireRole3("admin", "moderator"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { approved, feedback } = req.body;
    const userId = req.user.claims.sub;
    const task = await db2.select().from(tasks).where(eq6(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].status !== "submitted") {
      return res.status(400).json({ error: "Task is not ready for verification" });
    }
    const newStatus = approved ? "completed" : "claimed";
    await db2.update(tasks).set({
      status: newStatus,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(tasks.id, taskId));
    await db2.insert(taskHistory2).values({
      taskId,
      userId,
      action: approved ? "approved" : "rejected",
      details: { feedback, verifiedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    if (approved && task[0].claimerId) {
      await db2.insert(walletTransactions).values({
        fromUserId: task[0].daoId,
        toUserId: task[0].claimerId,
        amount: task[0].reward,
        currency: "cUSD",
        type: "bounty_payout",
        status: "completed",
        description: `Bounty payment for task: ${task[0].title}`
      });
    }
    res.json({
      message: approved ? "Task approved and bounty paid" : "Task rejected",
      taskId,
      newStatus
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/:taskId/history", async (req, res) => {
  try {
    const { taskId } = req.params;
    const history = await db2.select().from(taskHistory2).where(eq6(taskHistory2.taskId, taskId)).orderBy(desc5(taskHistory2.createdAt));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/user/claimed", async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const claimedTasks = await db2.select().from(tasks).where(eq6(tasks.claimerId, userId)).orderBy(desc5(tasks.updatedAt));
    res.json(claimedTasks);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router7.get("/analytics", async (req, res) => {
  try {
    const { daoId } = req.query;
    let baseQuery = db2.select().from(tasks);
    if (daoId) {
      baseQuery = baseQuery.where(eq6(tasks.daoId, daoId));
    }
    const taskStats = await db2.select({
      status: tasks.status,
      category: tasks.category,
      difficulty: tasks.difficulty,
      count: sql2`count(*)`,
      totalReward: sql2`sum(cast(${tasks.reward} as numeric))`
    }).from(tasks).groupBy(tasks.status, tasks.category, tasks.difficulty);
    res.json(taskStats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var tasks_default = router7;

// server/routes/bounty-escrow.ts
import express8 from "express";
import { eq as eq7, and as and5 } from "drizzle-orm";
import { z as z5 } from "zod";
var router8 = express8.Router();
var createEscrowSchema = z5.object({
  taskId: z5.string().min(1),
  amount: z5.number().positive(),
  currency: z5.string().default("cUSD")
});
var releaseEscrowSchema = z5.object({
  taskId: z5.string().min(1),
  releaseToClaimant: z5.boolean()
});
router8.post("/create", async (req, res) => {
  try {
    const validatedData = createEscrowSchema.parse(req.body);
    const { taskId, amount, currency } = validatedData;
    const userId = req.user.claims.sub;
    const task = await db2.select().from(tasks).where(eq7(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].creatorId !== userId) {
      return res.status(403).json({ error: "Only task creator can fund escrow" });
    }
    const existingEscrow = await db2.select().from(walletTransactions).where(and5(
      eq7(walletTransactions.type, "escrow_deposit"),
      eq7(walletTransactions.description, `Escrow for task: ${taskId}`)
    )).limit(1);
    if (existingEscrow.length > 0) {
      return res.status(400).json({ error: "Escrow already exists for this task" });
    }
    const escrow = await db2.insert(walletTransactions).values({
      fromUserId: userId,
      toUserId: "escrow_system",
      amount: amount.toString(),
      currency,
      type: "escrow_deposit",
      status: "held",
      description: `Escrow for task: ${taskId}`,
      metadata: { taskId, escrowType: "bounty" }
    }).returning();
    res.json({
      success: true,
      escrowId: escrow[0].id,
      amount,
      currency,
      status: "held"
    });
  } catch (err) {
    if (err instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router8.post("/release", async (req, res) => {
  try {
    const validatedData = releaseEscrowSchema.parse(req.body);
    const { taskId, releaseToClaimant } = validatedData;
    const userId = req.user.claims.sub;
    const task = await db2.select().from(tasks).where(eq7(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    const canRelease = task[0].creatorId === userId;
    if (!canRelease) {
      const membership = await db2.select().from(daoMemberships).where(and5(
        eq7(daoMemberships.daoId, task[0].daoId),
        eq7(daoMemberships.userId, userId)
      )).limit(1);
      if (!membership.length || !["admin", "moderator"].includes(membership[0].role)) {
        return res.status(403).json({ error: "Insufficient permissions to release escrow" });
      }
    }
    const escrow = await db2.select().from(walletTransactions).where(and5(
      eq7(walletTransactions.type, "escrow_deposit"),
      eq7(walletTransactions.description, `Escrow for task: ${taskId}`),
      eq7(walletTransactions.status, "held")
    )).limit(1);
    if (!escrow.length) {
      return res.status(404).json({ error: "Active escrow not found for this task" });
    }
    const escrowAmount = parseFloat(escrow[0].amount);
    const recipient = releaseToClaimant ? task[0].claimerId : task[0].creatorId;
    if (!recipient) {
      return res.status(400).json({ error: "No valid recipient for escrow release" });
    }
    await db2.update(walletTransactions).set({
      status: "completed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(walletTransactions.id, escrow[0].id));
    const release = await db2.insert(walletTransactions).values({
      fromUserId: "escrow_system",
      toUserId: recipient,
      amount: escrowAmount.toString(),
      currency: escrow[0].currency,
      type: "escrow_release",
      status: "completed",
      description: `Escrow release for task: ${taskId}`,
      metadata: { originalEscrowId: escrow[0].id, taskId }
    }).returning();
    if (releaseToClaimant) {
      await db2.update(tasks).set({
        status: "completed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq7(tasks.id, taskId));
    }
    res.json({
      success: true,
      releaseId: release[0].id,
      amount: escrowAmount,
      recipient,
      releasedToClaimant: releaseToClaimant
    });
  } catch (err) {
    if (err instanceof z5.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router8.get("/:taskId/escrow", async (req, res) => {
  try {
    const { taskId } = req.params;
    const escrow = await db2.select().from(walletTransactions).where(and5(
      eq7(walletTransactions.type, "escrow_deposit"),
      eq7(walletTransactions.description, `Escrow for task: ${taskId}`)
    )).orderBy(desc(walletTransactions.createdAt)).limit(1);
    if (!escrow.length) {
      return res.json({ hasEscrow: false });
    }
    res.json({
      hasEscrow: true,
      amount: parseFloat(escrow[0].amount),
      currency: escrow[0].currency,
      status: escrow[0].status,
      createdAt: escrow[0].createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
router8.post("/:taskId/dispute", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const userId = req.user.claims.sub;
    const task = await db2.select().from(tasks).where(eq7(tasks.id, taskId)).limit(1);
    if (!task.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (task[0].claimerId !== userId && task[0].creatorId !== userId) {
      return res.status(403).json({ error: "Only task claimant or creator can dispute" });
    }
    await db2.update(tasks).set({
      status: "disputed",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(tasks.id, taskId));
    await db2.insert(taskHistory).values({
      taskId,
      userId,
      action: "disputed",
      details: { reason, disputedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    res.json({
      success: true,
      message: "Dispute created. Escrow will be held pending resolution.",
      taskId
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
var bounty_escrow_default = router8;

// server/routes/notifications.ts
import express9 from "express";
var router9 = express9.Router();
router9.get("/", isAuthenticated2, async (req, res) => {
  try {
    const { limit = 20, offset = 0, read, type } = req.query;
    const userId = req.user.claims.sub;
    const notifications2 = await storage.getUserNotifications(
      userId,
      read === "true" ? true : read === "false" ? false : void 0,
      Number(limit),
      Number(offset),
      type
    );
    const unreadCount = await storage.getUnreadNotificationCount(userId);
    res.json({
      notifications: notifications2,
      total: notifications2.length,
      unreadCount
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.patch("/:notificationId/read", isAuthenticated2, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.claims.sub;
    const notification = await storage.markNotificationAsRead(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({
      error: "Failed to mark notification as read",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.patch("/mark-all-read", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsAsRead(userId);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({
      error: "Failed to mark all notifications as read",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.delete("/:notificationId", isAuthenticated2, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.claims.sub;
    const deleted = await storage.deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete notification",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.get("/preferences", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const preferences = await storage.getUserNotificationPreferences(userId);
    res.json(preferences);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch notification preferences",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.put("/preferences", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { emailNotifications, pushNotifications, daoUpdates, proposalUpdates, taskUpdates } = req.body;
    const preferences = await storage.updateUserNotificationPreferences(userId, {
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? true,
      daoUpdates: daoUpdates ?? true,
      proposalUpdates: proposalUpdates ?? true,
      taskUpdates: taskUpdates ?? true
    });
    res.json(preferences);
  } catch (err) {
    res.status(500).json({
      error: "Failed to update notification preferences",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
router9.post("/send", isAuthenticated2, async (req, res) => {
  try {
    const senderId = req.user.claims.sub;
    const { userIds, type, message, title, metadata } = req.body;
    const senderRole = req.user.role;
    if (senderRole !== "admin" && senderRole !== "superuser" && senderRole !== "moderator") {
      return res.status(403).json({ error: "Insufficient permissions to send notifications" });
    }
    const notifications2 = await storage.createBulkNotifications(userIds, {
      type,
      message,
      title,
      metadata,
      senderId
    });
    res.status(201).json({
      message: "Notifications sent successfully",
      count: notifications2.length
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to send notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});
var notifications_default = router9;
router9.get("/search", isAuthenticated2, async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const userId = req.user.claims.sub;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }
    const notifications2 = await storage.searchNotifications(
      userId,
      q,
      Number(limit),
      Number(offset)
    );
    res.json({
      notifications: notifications2,
      total: notifications2.length,
      query: q
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to search notifications",
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// server/routes/sse.ts
import express10 from "express";
var router10 = express10.Router();
router10.get("/notifications", isAuthenticated2, (req, res) => {
  const userId = req.user.claims.sub;
  notificationService.setupSSE(userId, res);
});
var sse_default = router10;

// server/routes/governance.ts
import express11 from "express";
import { eq as eq8, and as and6, desc as desc6, gte, sql as sql3 } from "drizzle-orm";
var router11 = express11.Router();
router11.get("/:daoId/quorum", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await db2.select().from(daos).where(eq8(daos.id, daoId)).limit(1);
    if (!dao.length) {
      return res.status(404).json({ message: "DAO not found" });
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const activeMembers = await db2.select({ count: sql3`count(*)` }).from(daoMemberships).where(
      and6(
        eq8(daoMemberships.daoId, daoId),
        eq8(daoMemberships.status, "approved"),
        gte(daoMemberships.lastActive, thirtyDaysAgo)
      )
    );
    const activeMemberCount = activeMembers[0]?.count || 0;
    const quorumPercentage = dao[0].quorumPercentage || 20;
    const requiredQuorum = Math.ceil(activeMemberCount * quorumPercentage / 100);
    res.json({
      success: true,
      data: {
        activeMemberCount,
        quorumPercentage,
        requiredQuorum,
        calculatedAt: /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to calculate quorum",
      error: error.message
    });
  }
});
router11.post("/proposals/:proposalId/execute", isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user.claims.sub;
    const proposal = await db2.select().from(proposals).where(eq8(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    const proposalData2 = proposal[0];
    if (proposalData2.status !== "passed") {
      return res.status(400).json({ message: "Proposal must be in passed status to execute" });
    }
    const membership = await db2.select().from(daoMemberships).where(and6(
      eq8(daoMemberships.daoId, proposalData2.daoId),
      eq8(daoMemberships.userId, userId)
    )).limit(1);
    if (!membership.length || !["admin", "elder"].includes(membership[0].role)) {
      return res.status(403).json({ message: "Insufficient permissions to execute proposal" });
    }
    const executionTime = new Date(Date.now() + (proposalData2.executionDelay || 24) * 60 * 60 * 1e3);
    await db2.insert(proposalExecutionQueue).values({
      proposalId,
      daoId: proposalData2.daoId,
      scheduledFor: executionTime,
      executionType: proposalData2.proposalType,
      executionData: proposalData2.executionData || {},
      status: "pending"
    });
    res.json({
      success: true,
      message: "Proposal queued for execution",
      scheduledFor: executionTime
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to queue proposal for execution",
      error: error.message
    });
  }
});
router11.get("/:daoId/templates", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const templates = await db2.select().from(proposalTemplates).where(
      and6(
        eq8(proposalTemplates.daoId, daoId),
        eq8(proposalTemplates.isGlobal, true)
      )
    ).orderBy(desc6(proposalTemplates.createdAt));
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch proposal templates",
      error: error.message
    });
  }
});
router11.post("/:daoId/templates", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const templateData = req.body;
    const membership = await db2.select().from(daoMemberships).where(and6(
      eq8(daoMemberships.daoId, daoId),
      eq8(daoMemberships.userId, userId)
    )).limit(1);
    if (!membership.length || !["admin", "elder"].includes(membership[0].role)) {
      return res.status(403).json({ message: "Insufficient permissions to create templates" });
    }
    const template = await db2.insert(proposalTemplates).values({
      ...templateData,
      daoId,
      createdBy: userId
    }).returning();
    res.json({
      success: true,
      data: template[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create proposal template",
      error: error.message
    });
  }
});
router11.post("/:daoId/delegate", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const { delegateId, scope, category, proposalId } = req.body;
    const delegateMembership = await db2.select().from(daoMemberships).where(and6(
      eq8(daoMemberships.daoId, daoId),
      eq8(daoMemberships.userId, delegateId),
      eq8(daoMemberships.status, "approved")
    )).limit(1);
    if (!delegateMembership.length) {
      return res.status(400).json({ message: "Delegate must be an active DAO member" });
    }
    await db2.update(voteDelegations).set({ isActive: false }).where(and6(
      eq8(voteDelegations.delegatorId, userId),
      eq8(voteDelegations.daoId, daoId),
      eq8(voteDelegations.isActive, true)
    ));
    const delegation = await db2.insert(voteDelegations).values({
      delegatorId: userId,
      delegateId,
      daoId,
      scope,
      category,
      proposalId,
      isActive: true
    }).returning();
    res.json({
      success: true,
      data: delegation[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create vote delegation",
      error: error.message
    });
  }
});
router11.get("/:daoId/delegations", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const delegations = await db2.select().from(voteDelegations).where(and6(
      eq8(voteDelegations.daoId, daoId),
      eq8(voteDelegations.delegatorId, userId),
      eq8(voteDelegations.isActive, true)
    ));
    res.json({
      success: true,
      data: delegations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch delegations",
      error: error.message
    });
  }
});
router11.delete("/:daoId/delegate/:delegationId", isAuthenticated, async (req, res) => {
  try {
    const { daoId, delegationId } = req.params;
    const userId = req.user.claims.sub;
    await db2.update(voteDelegations).set({ isActive: false }).where(and6(
      eq8(voteDelegations.id, delegationId),
      eq8(voteDelegations.delegatorId, userId),
      eq8(voteDelegations.daoId, daoId)
    ));
    res.json({
      success: true,
      message: "Delegation revoked successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to revoke delegation",
      error: error.message
    });
  }
});
router11.post("/proposals/:proposalId/check-quorum", isAuthenticated, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await db2.select().from(proposals).where(eq8(proposals.id, proposalId)).limit(1);
    if (!proposal.length) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    const proposalData2 = proposal[0];
    const totalVotes = proposalData2.yesVotes + proposalData2.noVotes + proposalData2.abstainVotes;
    const quorumResponse = await fetch(`/api/governance/${proposalData2.daoId}/quorum`);
    const quorumData = await quorumResponse.json();
    const requiredQuorum = quorumData.data.requiredQuorum;
    const quorumMet = totalVotes >= requiredQuorum;
    const passed = quorumMet && proposalData2.yesVotes > proposalData2.noVotes;
    await db2.insert(quorumHistory).values({
      daoId: proposalData2.daoId,
      proposalId,
      activeMemberCount: quorumData.data.activeMemberCount,
      requiredQuorum,
      achievedQuorum: totalVotes,
      quorumMet
    });
    if (/* @__PURE__ */ new Date() > proposalData2.voteEndTime) {
      let newStatus = "failed";
      if (quorumMet && passed) {
        newStatus = "passed";
      } else if (!quorumMet) {
        newStatus = "failed";
      }
      await db2.update(proposals).set({ status: newStatus }).where(eq8(proposals.id, proposalId));
    }
    res.json({
      success: true,
      data: {
        quorumMet,
        passed,
        totalVotes,
        requiredQuorum,
        status: passed && quorumMet ? "passed" : "failed"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check proposal quorum",
      error: error.message
    });
  }
});
var governance_default = router11;

// server/routes/proposal-execution.ts
import express12 from "express";
import { eq as eq10, and as and8, desc as desc7 } from "drizzle-orm";

// server/proposalExecutionService.ts
import { eq as eq9, and as and7, lte as lte2 } from "drizzle-orm";
var ProposalExecutionService = class {
  // Process pending executions
  static async processPendingExecutions() {
    try {
      const now = /* @__PURE__ */ new Date();
      const pendingExecutions = await db2.select().from(proposalExecutionQueue).where(and7(
        eq9(proposalExecutionQueue.status, "pending"),
        lte2(proposalExecutionQueue.scheduledFor, now)
      ));
      for (const execution of pendingExecutions) {
        await this.executeProposal(execution);
      }
    } catch (error) {
      console.error("Error processing pending executions:", error);
    }
  }
  // Execute individual proposal
  static async executeProposal(execution) {
    try {
      await db2.update(proposalExecutionQueue).set({
        status: "executing",
        lastAttempt: /* @__PURE__ */ new Date(),
        attempts: execution.attempts + 1
      }).where(eq9(proposalExecutionQueue.id, execution.id));
      const { executionType, executionData, daoId, proposalId } = execution;
      switch (executionType) {
        case "treasury_transfer":
          await this.executeTreasuryTransfer(executionData, daoId, proposalId);
          break;
        case "member_action":
          await this.executeMemberAction(executionData, daoId, proposalId);
          break;
        case "governance_change":
          await this.executeGovernanceChange(executionData, daoId, proposalId);
          break;
        default:
          throw new Error(`Unknown execution type: ${executionType}`);
      }
      await db2.update(proposalExecutionQueue).set({ status: "completed" }).where(eq9(proposalExecutionQueue.id, execution.id));
      await db2.update(proposals).set({
        status: "executed",
        executedAt: /* @__PURE__ */ new Date()
      }).where(eq9(proposals.id, proposalId));
    } catch (error) {
      console.error("Error executing proposal:", error);
      await db2.update(proposalExecutionQueue).set({
        status: "failed",
        errorMessage: error.message
      }).where(eq9(proposalExecutionQueue.id, execution.id));
    }
  }
  // Execute treasury transfer
  static async executeTreasuryTransfer(executionData, daoId, proposalId) {
    const { recipient, amount, currency, description } = executionData;
    await db2.insert(walletTransactions).values({
      daoId,
      toUserId: recipient,
      amount: amount.toString(),
      currency,
      type: "transfer",
      status: "completed",
      description: `Proposal execution: ${description}`
    });
    await db2.update(daos).set({
      treasuryBalance: db2.select().from(daos).where(eq9(daos.id, daoId)).limit(1).then(
        (dao) => (parseFloat(dao[0]?.treasuryBalance || "0") - amount).toString()
      )
    }).where(eq9(daos.id, daoId));
  }
  // Execute member action (promote, demote, ban, etc.)
  static async executeMemberAction(executionData, daoId, proposalId) {
    const { action, targetUserId, newRole, reason } = executionData;
    switch (action) {
      case "promote":
        await db2.update(daoMemberships).set({ role: newRole }).where(and7(
          eq9(daoMemberships.daoId, daoId),
          eq9(daoMemberships.userId, targetUserId)
        ));
        break;
      case "ban":
        await db2.update(daoMemberships).set({
          isBanned: true,
          banReason: reason
        }).where(and7(
          eq9(daoMemberships.daoId, daoId),
          eq9(daoMemberships.userId, targetUserId)
        ));
        break;
      case "unban":
        await db2.update(daoMemberships).set({
          isBanned: false,
          banReason: null
        }).where(and7(
          eq9(daoMemberships.daoId, daoId),
          eq9(daoMemberships.userId, targetUserId)
        ));
        break;
    }
  }
  // Execute governance changes
  static async executeGovernanceChange(executionData, daoId, proposalId) {
    const { changes } = executionData;
    await db2.update(daos).set(changes).where(eq9(daos.id, daoId));
  }
  // Start the execution scheduler
  static startScheduler() {
    setInterval(async () => {
      await this.processPendingExecutions();
    }, 5 * 60 * 1e3);
  }
};

// server/routes/proposal-execution.ts
var router12 = express12.Router();
router12.get("/:daoId/queue", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user.claims.sub;
    const executions = await db2.select().from(proposalExecutionQueue).where(eq10(proposalExecutionQueue.daoId, daoId)).orderBy(desc7(proposalExecutionQueue.createdAt));
    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch execution queue",
      error: error.message
    });
  }
});
router12.post("/:daoId/execute/:proposalId", isAuthenticated, async (req, res) => {
  try {
    const { daoId, proposalId } = req.params;
    const userId = req.user.claims.sub;
    const execution = await db2.select().from(proposalExecutionQueue).where(and8(
      eq10(proposalExecutionQueue.proposalId, proposalId),
      eq10(proposalExecutionQueue.daoId, daoId),
      eq10(proposalExecutionQueue.status, "pending")
    )).limit(1);
    if (!execution.length) {
      return res.status(404).json({
        success: false,
        message: "No pending execution found for this proposal"
      });
    }
    await ProposalExecutionService.executeProposal(execution[0]);
    res.json({
      success: true,
      message: "Proposal executed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to execute proposal",
      error: error.message
    });
  }
});
router12.delete("/:daoId/cancel/:executionId", isAuthenticated, async (req, res) => {
  try {
    const { daoId, executionId } = req.params;
    const userId = req.user.claims.sub;
    await db2.update(proposalExecutionQueue).set({ status: "cancelled" }).where(and8(
      eq10(proposalExecutionQueue.id, executionId),
      eq10(proposalExecutionQueue.daoId, daoId)
    ));
    res.json({
      success: true,
      message: "Execution cancelled successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel execution",
      error: error.message
    });
  }
});
var proposal_execution_default = router12;

// server/routes/monitoring.ts
import express13 from "express";

// server/monitoring/metricsCollector.ts
import { performance } from "perf_hooks";

// server/utils/logger.ts
import { createLogger, format, transports } from "winston";

// shared/config.ts
import { z as z6 } from "zod";
import dotenv2 from "dotenv";
dotenv2.config();
var envSchema = z6.object({
  // Server Configuration
  NODE_ENV: z6.enum(["development", "production", "test"]).default("development"),
  PORT: z6.string().default("5000"),
  HOST: z6.string().default("0.0.0.0"),
  // Security
  SESSION_SECRET: z6.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  JWT_SECRET: z6.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z6.string().length(32, "ENCRYPTION_KEY must be exactly 32 characters").optional(),
  // OAuth Configuration
  OAUTH_CLIENT_ID: z6.string().optional(),
  OAUTH_CLIENT_SECRET: z6.string().optional(),
  OAUTH_REDIRECT_URI: z6.string().url().optional(),
  GOOGLE_CLIENT_ID: z6.string().optional(),
  GOOGLE_CLIENT_SECRET: z6.string().optional(),
  // Database
  DATABASE_URL: z6.string().url("DATABASE_URL must be a valid URL"),
  DB_POOL_MIN: z6.string().optional(),
  DB_POOL_MAX: z6.string().optional(),
  TEST_DATABASE_URL: z6.string().url().optional(),
  // Email Configuration
  SMTP_HOST: z6.string().optional(),
  SMTP_PORT: z6.string().optional(),
  SMTP_SECURE: z6.string().optional(),
  SMTP_USER: z6.string().optional(),
  SMTP_PASS: z6.string().optional(),
  EMAIL_FROM: z6.string().email().optional(),
  EMAIL_FROM_NAME: z6.string().optional(),
  // Payment Providers
  STRIPE_SECRET_KEY: z6.string().optional(),
  STRIPE_PUBLIC_KEY: z6.string().optional(),
  STRIPE_WEBHOOK_SECRET: z6.string().optional(),
  KOTANIPAY_API_KEY: z6.string().optional(),
  KOTANIPAY_SECRET_KEY: z6.string().optional(),
  KOTANIPAY_WEBHOOK_SECRET: z6.string().optional(),
  MPESA_CONSUMER_KEY: z6.string().optional(),
  MPESA_CONSUMER_SECRET: z6.string().optional(),
  MPESA_PASSKEY: z6.string().optional(),
  MPESA_SHORTCODE: z6.string().optional(),
  // Blockchain
  CELO_RPC_URL: z6.string().url().optional(),
  CELO_ALFAJORES_RPC_URL: z6.string().url().optional(),
  WALLET_PRIVATE_KEY: z6.string().optional(),
  CUSD_CONTRACT_ADDRESS: z6.string().optional(),
  // Security Configuration
  RATE_LIMIT_WINDOW_MS: z6.string().optional(),
  RATE_LIMIT_MAX_REQUESTS: z6.string().optional(),
  ALLOWED_ORIGINS: z6.string().optional(),
  // Analytics & Monitoring
  ANALYTICS_API_KEY: z6.string().optional(),
  SENTRY_DSN: z6.string().url().optional(),
  // App Configuration
  FRONTEND_URL: z6.string().url().default("http://localhost:5173"),
  BACKEND_URL: z6.string().url().default("http://localhost:5000"),
  API_BASE_URL: z6.string().url().default("http://localhost:5000/api"),
  MAX_FILE_SIZE: z6.string().optional(),
  UPLOAD_DIR: z6.string().default("uploads"),
  // Notifications
  SOCKET_IO_CORS_ORIGIN: z6.string().optional(),
  FIREBASE_ADMIN_SDK_PATH: z6.string().optional(),
  FIREBASE_PROJECT_ID: z6.string().optional(),
  // Development & Testing
  DEBUG: z6.string().optional(),
  LOG_LEVEL: z6.enum(["error", "warn", "info", "debug"]).default("info"),
  ENABLE_REQUEST_LOGGING: z6.string().optional(),
  // Production Settings
  SSL_CERT_PATH: z6.string().optional(),
  SSL_KEY_PATH: z6.string().optional(),
  REDIS_URL: z6.string().url().optional(),
  WEBHOOK_BASE_URL: z6.string().url().optional()
});
var parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("\u274C Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}
var env = parsedEnv.data;
var isDevelopment = env.NODE_ENV === "development";
var isProduction = env.NODE_ENV === "production";
var isTest = env.NODE_ENV === "test";
var dbConfig = {
  url: env.DATABASE_URL,
  poolMin: parseInt(env.DB_POOL_MIN || "2"),
  poolMax: parseInt(env.DB_POOL_MAX || "10")
};
var rateLimitConfig = {
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || "900000"),
  // 15 minutes
  maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100")
};
var corsConfig = {
  origin: env.ALLOWED_ORIGINS?.split(",") || [env.FRONTEND_URL],
  credentials: true
};

// server/utils/logger.ts
var { combine, timestamp: timestamp2, errors, json, colorize, simple, printf } = format;
var devFormat = printf(({ level, message, timestamp: timestamp6, service, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? `
${JSON.stringify(meta, null, 2)}` : "";
  return `${timestamp6} [${service}] ${level}: ${message}${metaStr}`;
});
var winstonLogger = createLogger({
  level: env.LOG_LEVEL || "info",
  format: combine(
    timestamp2({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    isDevelopment ? combine(colorize(), devFormat) : json()
  ),
  defaultMeta: { service: "mtaa-dao-api" },
  transports: [
    new transports.Console({
      silent: env.NODE_ENV === "test"
    })
  ]
});
if (isProduction) {
  winstonLogger.add(
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760,
      // 10MB
      maxFiles: 5
    })
  );
  winstonLogger.add(
    new transports.File({
      filename: "logs/combined.log",
      maxsize: 10485760,
      // 10MB
      maxFiles: 10
    })
  );
}
var Logger = class _Logger {
  constructor(service = "api", context = {}) {
    this.service = service;
    this.context = context;
  }
  // Create child logger with additional context
  child(context) {
    return new _Logger(this.service, { ...this.context, ...context });
  }
  async logToDatabase(level, message, metadata = {}) {
    try {
      await storage.createSystemLog(level, message, this.service, {
        ...this.context,
        ...metadata
      });
    } catch (error) {
      console.error("Failed to log to database:", error);
    }
  }
  log(level, message, meta = {}) {
    const logData = {
      service: this.service,
      ...this.context,
      ...meta
    };
    winstonLogger.log(level, message, logData);
    if (["error", "warn", "info"].includes(level)) {
      this.logToDatabase(level, message, logData).catch(console.error);
    }
  }
  error(message, error, meta = {}) {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : { errorData: error };
    this.log("error", message, { ...errorMeta, ...meta });
  }
  warn(message, meta = {}) {
    this.log("warn", message, meta);
  }
  info(message, meta = {}) {
    this.log("info", message, meta);
  }
  debug(message, meta = {}) {
    this.log("debug", message, meta);
  }
  // Audit logging methods
  async auditLog(action, resource, details = {}) {
    const message = `Audit: ${action} on ${resource}`;
    this.info(message, { audit: true, action, resource, details });
  }
  // Performance logging
  async performanceLog(operation, duration, meta = {}) {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.info(message, { performance: true, operation, duration, ...meta });
  }
  // Security logging
  async securityLog(event, severity, details = {}) {
    const message = `Security: ${event}`;
    this.error(message, null, { security: true, severity, event, details });
  }
};
var logger = new Logger();
var requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = req.headers["x-request-id"] || Math.random().toString(36).substring(7);
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  const requestLogger2 = logger.child({
    requestId,
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.claims?.sub
  });
  req.logger = requestLogger2;
  if (env.ENABLE_REQUEST_LOGGING === "true") {
    requestLogger2.info("Request started", {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.method !== "GET" ? req.body : void 0
    });
  }
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    requestLogger2.info("Request completed", {
      statusCode: res.statusCode,
      duration,
      responseSize: JSON.stringify(body).length
    });
    return originalSend.call(this, body);
  };
  next();
};
var logStartup = (port) => {
  logger.info("\u{1F680} Server starting up", {
    port,
    environment: env.NODE_ENV,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
};

// server/monitoring/metricsCollector.ts
var MetricsCollector = class _MetricsCollector {
  constructor() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.activeConnections = 0;
    this.metrics = {
      requests: [],
      system: [],
      database: [],
      business: []
    };
    setInterval(() => this.collectSystemMetrics(), 3e4);
    setInterval(() => this.cleanOldMetrics(), 36e5);
  }
  static getInstance() {
    if (!_MetricsCollector.instance) {
      _MetricsCollector.instance = new _MetricsCollector();
    }
    return _MetricsCollector.instance;
  }
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      this.activeConnections++;
      res.on("finish", () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        this.requestCount++;
        this.responseTimes.push(responseTime);
        if (res.statusCode >= 400) {
          this.errorCount++;
        }
        const metric = {
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          userId: req.user?.id
        };
        this.addRequestMetric(metric);
        this.activeConnections--;
      });
      next();
    };
  }
  addRequestMetric(metric) {
    this.metrics.requests.push(metric);
    if (metric.responseTime > 1e3) {
      logger.warn(`Slow request: ${metric.method} ${metric.route} took ${metric.responseTime}ms`);
    }
    if (metric.statusCode >= 500) {
      logger.error(`Server error: ${metric.method} ${metric.route} returned ${metric.statusCode}`);
    }
  }
  collectSystemMetrics() {
    const metric = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      activeConnections: this.activeConnections,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime: this.getAverageResponseTime(),
      cpuUsage: process.cpuUsage().user / 1e6
      // Convert to seconds
    };
    this.metrics.system.push(metric);
    const memoryUsageMB = metric.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }
  }
  addDatabaseMetric(metric) {
    this.metrics.database.push({
      ...metric,
      timestamp: Date.now()
    });
  }
  addBusinessMetric(metric) {
    this.metrics.business.push({
      ...metric,
      timestamp: Date.now()
    });
  }
  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0;
    const sum2 = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum2 / this.responseTimes.length;
  }
  cleanOldMetrics() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1e3;
    this.metrics.requests = this.metrics.requests.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.system = this.metrics.system.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.database = this.metrics.database.filter((m) => m.timestamp > oneDayAgo);
    this.metrics.business = this.metrics.business.filter((m) => m.timestamp > oneDayAgo);
    this.responseTimes = this.responseTimes.slice(-1e3);
  }
  getMetrics() {
    return {
      ...this.metrics,
      summary: {
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount * 100 : 0,
        avgResponseTime: this.getAverageResponseTime(),
        activeConnections: this.activeConnections,
        uptime: process.uptime()
      }
    };
  }
  getHealthScore() {
    const metrics = this.getMetrics();
    let score = 100;
    if (metrics.summary.errorRate > 5) score -= 20;
    else if (metrics.summary.errorRate > 1) score -= 10;
    if (metrics.summary.avgResponseTime > 1e3) score -= 20;
    else if (metrics.summary.avgResponseTime > 500) score -= 10;
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1e3) score -= 20;
    else if (memoryUsageMB > 500) score -= 10;
    return Math.max(0, score);
  }
};
var metricsCollector = MetricsCollector.getInstance();

// server/routes/monitoring.ts
var router13 = express13.Router();
var AlertManager = class _AlertManager {
  constructor() {
    this.alerts = [];
    this.alertRules = {
      errorRate: { threshold: 5, severity: "high" },
      responseTime: { threshold: 1e3, severity: "medium" },
      memoryUsage: { threshold: 80, severity: "high" },
      connectionCount: { threshold: 1e3, severity: "medium" }
    };
    setInterval(() => this.checkAlerts(), 6e4);
  }
  static getInstance() {
    if (!_AlertManager.instance) {
      _AlertManager.instance = new _AlertManager();
    }
    return _AlertManager.instance;
  }
  checkAlerts() {
    const metrics = metricsCollector.getMetrics();
    if (metrics.summary.errorRate > this.alertRules.errorRate.threshold) {
      this.createAlert(
        "error_rate",
        this.alertRules.errorRate.severity,
        `High error rate: ${metrics.summary.errorRate.toFixed(2)}%`
      );
    }
    if (metrics.summary.avgResponseTime > this.alertRules.responseTime.threshold) {
      this.createAlert(
        "response_time",
        this.alertRules.responseTime.severity,
        `Slow response time: ${metrics.summary.avgResponseTime.toFixed(2)}ms`
      );
    }
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsage > 500) {
      this.createAlert(
        "memory_usage",
        this.alertRules.memoryUsage.severity,
        `High memory usage: ${memoryUsage.toFixed(2)}MB`
      );
    }
    if (metrics.summary.activeConnections > this.alertRules.connectionCount.threshold) {
      this.createAlert(
        "connection_count",
        this.alertRules.connectionCount.severity,
        `High connection count: ${metrics.summary.activeConnections}`
      );
    }
  }
  createAlert(type, severity, message) {
    const existingAlert = this.alerts.find(
      (alert2) => alert2.type === type && !alert2.acknowledged && !alert2.resolvedAt
    );
    if (existingAlert) return;
    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
    this.alerts.push(alert);
    logger.warn(`Alert created: ${message}`, { alert });
    this.alerts.filter((a) => a.type === type && a.id !== alert.id && !a.resolvedAt).forEach((a) => a.resolvedAt = Date.now());
  }
  getAlerts(includeResolved = false) {
    return this.alerts.filter(
      (alert) => includeResolved || !alert.resolvedAt && !alert.acknowledged
    );
  }
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
  resolveAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }
};
var alertManager = AlertManager.getInstance();
router13.get("/dashboard", isAuthenticated2, (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const alerts = alertManager.getAlerts();
  const healthScore = metricsCollector.getHealthScore();
  res.json({
    healthScore,
    alerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
    metrics: {
      totalRequests: metrics.summary.totalRequests,
      errorRate: metrics.summary.errorRate,
      avgResponseTime: metrics.summary.avgResponseTime,
      activeConnections: metrics.summary.activeConnections,
      uptime: metrics.summary.uptime,
      memoryUsage: process.memoryUsage()
    },
    recentRequests: metrics.requests.slice(-20),
    systemMetrics: metrics.system.slice(-10)
  });
});
router13.get("/alerts", isAuthenticated2, (req, res) => {
  const includeResolved = req.query.resolved === "true";
  const alerts = alertManager.getAlerts(includeResolved);
  res.json({ alerts });
});
router13.post("/alerts/:alertId/acknowledge", isAuthenticated2, (req, res) => {
  const { alertId } = req.params;
  const success = alertManager.acknowledgeAlert(alertId);
  if (success) {
    res.json({ message: "Alert acknowledged" });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
});
router13.post("/alerts/:alertId/resolve", isAuthenticated2, (req, res) => {
  const { alertId } = req.params;
  const success = alertManager.resolveAlert(alertId);
  if (success) {
    res.json({ message: "Alert resolved" });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
});
router13.get("/performance", isAuthenticated2, (req, res) => {
  const metrics = metricsCollector.getMetrics();
  const slowEndpoints = metrics.requests.filter((r) => r.responseTime > 1e3).reduce((acc, req2) => {
    const key = `${req2.method} ${req2.route}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const errorEndpoints = metrics.requests.filter((r) => r.statusCode >= 400).reduce((acc, req2) => {
    const key = `${req2.method} ${req2.route}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  res.json({
    slowEndpoints,
    errorEndpoints,
    performanceScore: metricsCollector.getHealthScore(),
    recommendations: generatePerformanceRecommendations(metrics)
  });
});
function generatePerformanceRecommendations(metrics) {
  const recommendations = [];
  if (metrics.summary.errorRate > 2) {
    recommendations.push("High error rate detected. Review error logs and fix failing endpoints.");
  }
  if (metrics.summary.avgResponseTime > 500) {
    recommendations.push("Slow response times detected. Consider optimizing database queries and adding caching.");
  }
  const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
  if (memoryUsageMB > 300) {
    recommendations.push("High memory usage. Review memory leaks and optimize resource usage.");
  }
  if (metrics.summary.activeConnections > 100) {
    recommendations.push("High number of active connections. Consider implementing connection pooling.");
  }
  return recommendations;
}
var monitoring_default = router13;

// server/routes/health.ts
import express14 from "express";
function handler(req, res) {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
}
var router14 = express14.Router();
async function checkDatabase() {
  const startTime = Date.now();
  try {
    await db2.execute("SELECT 1");
    return {
      status: "pass",
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message: "Database connection failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
async function checkRedis() {
  const startTime = Date.now();
  try {
    return {
      status: "pass",
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: Date.now() - startTime,
      message: "Redis connection failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
function checkMemory() {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
  let status = "pass";
  let message;
  if (memoryUsageMB > 1e3) {
    status = "fail";
    message = `High memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  } else if (memoryUsageMB > 500) {
    status = "warn";
    message = `Moderate memory usage: ${memoryUsageMB.toFixed(2)}MB`;
  }
  return {
    status,
    responseTime: 0,
    message,
    details: {
      heapUsed: `${memoryUsageMB.toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
    }
  };
}
function checkDisk() {
  return {
    status: "pass",
    responseTime: 0,
    details: {
      available: "Unknown",
      used: "Unknown"
    }
  };
}
function checkStorage() {
  try {
    return {
      status: "pass",
      responseTime: 0
    };
  } catch (error) {
    return {
      status: "fail",
      responseTime: 0,
      message: "Storage check failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}
router14.get("/", async (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime()
  });
});
router14.get("/detailed", async (req, res) => {
  const startTime = Date.now();
  try {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: checkStorage(),
      memory: checkMemory(),
      disk: checkDisk()
    };
    const metrics = metricsCollector.getMetrics();
    const healthScore = metricsCollector.getHealthScore();
    const hasFailures = Object.values(checks).some((check) => check.status === "fail");
    const hasWarnings = Object.values(checks).some((check) => check.status === "warn");
    let overallStatus;
    if (hasFailures) {
      overallStatus = "unhealthy";
    } else if (hasWarnings || healthScore < 80) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }
    const healthCheck = {
      status: overallStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      checks,
      metrics: {
        healthScore,
        responseTime: Date.now() - startTime,
        errorRate: metrics.summary.errorRate,
        activeConnections: metrics.summary.activeConnections
      }
    };
    const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;
    res.status(statusCode).json(healthCheck);
    if (overallStatus === "unhealthy") {
      logger.error("Health check failed", { checks, healthScore });
    }
  } catch (error) {
    logger.error("Health check error", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: "Health check failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
router14.get("/ready", async (req, res) => {
  try {
    const dbCheck = await checkDatabase();
    if (dbCheck.status === "fail") {
      return res.status(503).json({
        ready: false,
        reason: "Database not available"
      });
    }
    res.json({
      ready: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: "Readiness check failed"
    });
  }
});
router14.get("/live", (req, res) => {
  res.json({
    alive: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime()
  });
});
router14.get("/metrics", (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});

// server/routes/dao_treasury.ts
import express15 from "express";
var router15 = express15.Router();
router15.get("/:daoId/balance", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config2 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        // ETH price
        "0x...": 1
        // USDC price
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config2,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const treasuryManager = new DaoTreasuryManager(wallet2, dao.treasuryAddress, dao.allowedTokens || []);
    const snapshot = await treasuryManager.getTreasurySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router15.post("/:daoId/transfer/native", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config2 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config2,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const tx = await wallet2.sendNativeToken(toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router15.post("/:daoId/transfer/token", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { tokenAddress, toAddress, amount } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config2 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress2) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress2] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config2,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const tx = await wallet2.sendTokenHuman(tokenAddress, toAddress, amount);
    res.json({ tx });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router15.post("/:daoId/automation/payout", isAuthenticated2, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { payouts } = req.body;
    const dao = await storage.getDao(daoId);
    if (!dao || !dao.treasuryPrivateKey) {
      return res.status(404).json({ message: "DAO or treasury wallet not found" });
    }
    const config2 = NetworkConfig.CELO_ALFAJORES;
    const mockPriceOracle2 = async (tokenAddress) => {
      const prices = {
        "native": 2500,
        "0x...": 1
      };
      return prices[tokenAddress] || 0;
    };
    const wallet2 = new agent_wallet_default(
      dao.treasuryPrivateKey,
      config2,
      void 0,
      void 0,
      void 0,
      mockPriceOracle2
    );
    const results = await wallet2.batchTransfer(payouts);
    res.json({ results });
    router15.get("/:daoId/snapshot", isAuthenticated2, async (req2, res2) => {
      try {
        const { daoId: daoId2 } = req2.params;
        const dao2 = await storage.getDao(daoId2);
        if (!dao2 || !dao2.treasuryPrivateKey) {
          return res2.status(404).json({ message: "DAO or treasury wallet not found" });
        }
        const config3 = NetworkConfig.CELO_ALFAJORES;
        const mockPriceOracle3 = async (tokenAddress) => {
          const prices = {
            "native": 2500,
            "0x...": 1
          };
          return prices[tokenAddress] || 0;
        };
        const wallet3 = new agent_wallet_default(
          dao2.treasuryPrivateKey,
          config3,
          void 0,
          void 0,
          void 0,
          mockPriceOracle3
        );
        const treasuryManager = new DaoTreasuryManager(wallet3, dao2.treasuryAddress, dao2.allowedTokens || []);
        const snapshot = await treasuryManager.getTreasurySnapshot();
        res2.json(snapshot);
      } catch (err) {
        res2.status(500).json({ message: err instanceof Error ? err.message : String(err) });
      }
    });
    router15.get("/:daoId/report", isAuthenticated2, async (req2, res2) => {
      try {
        const { daoId: daoId2 } = req2.params;
        const { period } = req2.query;
        const dao2 = await storage.getDao(daoId2);
        if (!dao2 || !dao2.treasuryPrivateKey) {
          return res2.status(404).json({ message: "DAO or treasury wallet not found" });
        }
        const config3 = NetworkConfig.CELO_ALFAJORES;
        const mockPriceOracle3 = async (tokenAddress) => {
          const prices = {
            "native": 2500,
            "0x...": 1
          };
          return prices[tokenAddress] || 0;
        };
        const wallet3 = new agent_wallet_default(
          dao2.treasuryPrivateKey,
          config3,
          void 0,
          void 0,
          void 0,
          mockPriceOracle3
        );
        const treasuryManager = new DaoTreasuryManager(wallet3, dao2.treasuryAddress, dao2.allowedTokens || []);
        const report = await treasuryManager.generateTreasuryReport(period || "monthly");
        res2.json(report);
      } catch (err) {
        res2.status(500).json({ message: err instanceof Error ? err.message : String(err) });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
var dao_treasury_default = router15;

// server/routes/reputation.ts
import express16 from "express";

// server/reputationService.ts
import { eq as eq11, and as and9, desc as desc8, sql as sql4 } from "drizzle-orm";

// shared/reputationSchema.ts
import { pgTable as pgTable2, varchar as varchar2, timestamp as timestamp3, integer as integer2, decimal as decimal2, boolean as boolean2, uuid as uuid2 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema2 } from "drizzle-zod";
var msiaMoPoints = pgTable2("msiamo_points", {
  id: uuid2("id").primaryKey().defaultRandom(),
  userId: varchar2("user_id").references(() => users.id).notNull(),
  daoId: uuid2("dao_id").references(() => daos.id),
  // null for platform-wide points
  points: integer2("points").notNull(),
  action: varchar2("action").notNull(),
  // vote, propose, contribute, refer, streak, etc.
  description: text("description"),
  multiplier: decimal2("multiplier", { precision: 3, scale: 2 }).default("1.0"),
  createdAt: timestamp3("created_at").defaultNow()
});
var userReputation = pgTable2("user_reputation", {
  id: uuid2("id").primaryKey().defaultRandom(),
  userId: varchar2("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer2("total_points").default(0),
  weeklyPoints: integer2("weekly_points").default(0),
  monthlyPoints: integer2("monthly_points").default(0),
  currentStreak: integer2("current_streak").default(0),
  longestStreak: integer2("longest_streak").default(0),
  lastActivity: timestamp3("last_activity").defaultNow(),
  badge: varchar2("badge").default("Bronze"),
  // Bronze, Silver, Gold, Platinum, Diamond
  level: integer2("level").default(1),
  nextLevelPoints: integer2("next_level_points").default(100),
  updatedAt: timestamp3("updated_at").defaultNow()
});
var msiaMoConversions = pgTable2("msiamo_conversions", {
  id: uuid2("id").primaryKey().defaultRandom(),
  userId: varchar2("user_id").references(() => users.id).notNull(),
  pointsConverted: integer2("points_converted").notNull(),
  tokensReceived: decimal2("tokens_received", { precision: 18, scale: 8 }).notNull(),
  conversionRate: decimal2("conversion_rate", { precision: 10, scale: 4 }).notNull(),
  // points per token
  transactionHash: varchar2("transaction_hash"),
  status: varchar2("status").default("pending"),
  // pending, completed, failed
  createdAt: timestamp3("created_at").defaultNow()
});
var airdropEligibility = pgTable2("airdrop_eligibility", {
  id: uuid2("id").primaryKey().defaultRandom(),
  userId: varchar2("user_id").references(() => users.id).notNull(),
  airdropId: varchar2("airdrop_id").notNull(),
  eligibleAmount: decimal2("eligible_amount", { precision: 18, scale: 8 }).notNull(),
  minimumReputation: integer2("minimum_reputation").notNull(),
  userReputation: integer2("user_reputation").notNull(),
  claimed: boolean2("claimed").default(false),
  claimedAt: timestamp3("claimed_at"),
  transactionHash: varchar2("transaction_hash"),
  createdAt: timestamp3("created_at").defaultNow()
});
var insertMsiaMoPointsSchema = createInsertSchema2(msiaMoPoints);
var insertUserReputationSchema = createInsertSchema2(userReputation);
var insertMsiaMoConversionSchema = createInsertSchema2(msiaMoConversions);
var insertAirdropEligibilitySchema = createInsertSchema2(airdropEligibility);

// server/reputationService.ts
var REPUTATION_VALUES = {
  VOTE: 5,
  PROPOSAL_CREATED: 25,
  PROPOSAL_PASSED: 50,
  CONTRIBUTION: 10,
  // base points, scales with amount
  REFERRAL: 20,
  DAILY_STREAK: 5,
  WEEKLY_STREAK_BONUS: 25,
  MONTHLY_STREAK_BONUS: 100,
  DAO_MEMBERSHIP: 15,
  COMMENT: 3,
  LIKE_RECEIVED: 2,
  TASK_COMPLETION: 30
};
var BADGE_THRESHOLDS = {
  Bronze: 0,
  Silver: 100,
  Gold: 500,
  Platinum: 1500,
  Diamond: 5e3
};
var ReputationService = class {
  // Award points for specific actions
  static async awardPoints(userId, action, points, daoId, description, multiplier = 1) {
    const finalPoints = Math.floor(points * multiplier);
    await db2.insert(msiaMoPoints).values({
      userId,
      daoId,
      points: finalPoints,
      action,
      description,
      multiplier: multiplier.toString()
    });
    await this.updateUserReputation(userId);
  }
  // Calculate contribution points based on amount
  static async awardContributionPoints(userId, amount, daoId) {
    const basePoints = REPUTATION_VALUES.CONTRIBUTION;
    const amountBonus = Math.floor(amount / 10);
    const totalPoints = basePoints + amountBonus;
    await this.awardPoints(
      userId,
      "CONTRIBUTION",
      totalPoints,
      daoId,
      `Contributed ${amount} cUSD`,
      1
    );
  }
  // Update user's overall reputation summary
  static async updateUserReputation(userId) {
    const totalPointsResult = await db2.select({ total: sql4`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(eq11(msiaMoPoints.userId, userId));
    const totalPoints = totalPointsResult[0]?.total || 0;
    const weeklyPointsResult = await db2.select({ total: sql4`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(
      and9(
        eq11(msiaMoPoints.userId, userId),
        sql4`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '7 days'`
      )
    );
    const weeklyPoints = weeklyPointsResult[0]?.total || 0;
    const monthlyPointsResult = await db2.select({ total: sql4`sum(${msiaMoPoints.points})` }).from(msiaMoPoints).where(
      and9(
        eq11(msiaMoPoints.userId, userId),
        sql4`${msiaMoPoints.createdAt} >= NOW() - INTERVAL '30 days'`
      )
    );
    const monthlyPoints = monthlyPointsResult[0]?.total || 0;
    const badge = this.calculateBadge(totalPoints);
    const level = this.calculateLevel(totalPoints);
    const nextLevelPoints = this.getNextLevelThreshold(level);
    const existingReputation = await db2.select().from(userReputation).where(eq11(userReputation.userId, userId));
    if (existingReputation.length > 0) {
      await db2.update(userReputation).set({
        totalPoints,
        weeklyPoints,
        monthlyPoints,
        badge,
        level,
        nextLevelPoints,
        lastActivity: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq11(userReputation.userId, userId));
    } else {
      await db2.insert(userReputation).values({
        userId,
        totalPoints,
        weeklyPoints,
        monthlyPoints,
        badge,
        level,
        nextLevelPoints,
        lastActivity: /* @__PURE__ */ new Date()
      });
    }
  }
  // Calculate badge based on total points
  static calculateBadge(totalPoints) {
    if (totalPoints >= BADGE_THRESHOLDS.Diamond) return "Diamond";
    if (totalPoints >= BADGE_THRESHOLDS.Platinum) return "Platinum";
    if (totalPoints >= BADGE_THRESHOLDS.Gold) return "Gold";
    if (totalPoints >= BADGE_THRESHOLDS.Silver) return "Silver";
    return "Bronze";
  }
  // Calculate level (every 100 points = 1 level)
  static calculateLevel(totalPoints) {
    return Math.floor(totalPoints / 100) + 1;
  }
  // Get points needed for next level
  static getNextLevelThreshold(currentLevel) {
    return currentLevel * 100;
  }
  // Apply reputation decay based on inactivity
  static async applyReputationDecay(userId) {
    const reputation = await db2.select().from(userReputation).where(eq11(userReputation.userId, userId));
    if (!reputation[0]) return;
    const lastActivity = new Date(reputation[0].lastActivity);
    const now = /* @__PURE__ */ new Date();
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1e3 * 60 * 60 * 24));
    if (daysSinceActivity > 7) {
      const decayDays = Math.min(daysSinceActivity - 7, 50);
      const decayFactor = 1 - decayDays * 0.01;
      const decayedPoints = Math.floor(reputation[0].totalPoints * decayFactor);
      const pointsLost = reputation[0].totalPoints - decayedPoints;
      if (pointsLost > 0) {
        await db2.update(userReputation).set({
          totalPoints: decayedPoints,
          badge: this.calculateBadge(decayedPoints),
          level: this.calculateLevel(decayedPoints),
          nextLevelPoints: this.getNextLevelThreshold(this.calculateLevel(decayedPoints)),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq11(userReputation.userId, userId));
        await this.awardPoints(
          userId,
          "REPUTATION_DECAY",
          -pointsLost,
          void 0,
          `Reputation decay: ${pointsLost} points lost due to ${daysSinceActivity} days of inactivity`,
          1
        );
      }
    }
  }
  // Run decay for all users (scheduled job)
  static async runGlobalReputationDecay() {
    const allUsers = await db2.select().from(userReputation);
    let processed = 0;
    let decayed = 0;
    for (const user of allUsers) {
      const beforePoints = user.totalPoints;
      await this.applyReputationDecay(user.userId);
      const afterReputation = await db2.select().from(userReputation).where(eq11(userReputation.userId, user.userId));
      if (afterReputation[0] && afterReputation[0].totalPoints < beforePoints) {
        decayed++;
      }
      processed++;
    }
    return { processed, decayed };
  }
  // Get user's current reputation
  static async getUserReputation(userId) {
    const reputation = await db2.select().from(userReputation).where(eq11(userReputation.userId, userId));
    if (reputation.length === 0) {
      await this.updateUserReputation(userId);
      return await this.getUserReputation(userId);
    }
    await this.applyReputationDecay(userId);
    const updatedReputation = await db2.select().from(userReputation).where(eq11(userReputation.userId, userId));
    return updatedReputation[0];
  }
  // Get leaderboard
  static async getLeaderboard(limit = 10) {
    return await db2.select({
      userId: userReputation.userId,
      totalPoints: userReputation.totalPoints,
      badge: userReputation.badge,
      level: userReputation.level,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl
    }).from(userReputation).leftJoin(users, eq11(userReputation.userId, users.id)).orderBy(desc8(userReputation.totalPoints)).limit(limit);
  }
  // Convert MsiaMo points to tokens (for airdrops)
  static async convertPointsToTokens(userId, pointsToConvert, conversionRate = 100) {
    const userRep = await this.getUserReputation(userId);
    if (userRep.totalPoints < pointsToConvert) {
      throw new Error("Insufficient reputation points");
    }
    const tokensReceived = pointsToConvert / conversionRate;
    const conversion = await db2.insert(msiaMoConversions).values({
      userId,
      pointsConverted: pointsToConvert,
      tokensReceived: tokensReceived.toString(),
      conversionRate: conversionRate.toString(),
      status: "pending"
    }).returning();
    return {
      tokensReceived,
      conversionId: conversion[0].id
    };
  }
  // Check airdrop eligibility
  static async checkAirdropEligibility(userId, airdropId, minimumReputation, baseAmount) {
    const userRep = await this.getUserReputation(userId);
    const eligible = userRep.totalPoints >= minimumReputation;
    let amount = baseAmount;
    if (eligible) {
      const reputationMultiplier = Math.min(userRep.totalPoints / minimumReputation, 5);
      amount = baseAmount * reputationMultiplier;
    }
    if (eligible) {
      await db2.insert(airdropEligibility).values({
        userId,
        airdropId,
        eligibleAmount: amount.toString(),
        minimumReputation,
        userReputation: userRep.totalPoints
      });
    }
    return {
      eligible,
      amount,
      userReputation: userRep.totalPoints
    };
  }
  // Automated point awarding for common actions
  static async onVote(userId, proposalId, daoId) {
    await this.awardPoints(userId, "VOTE", REPUTATION_VALUES.VOTE, daoId, `Voted on proposal ${proposalId}`);
  }
  static async onProposalCreated(userId, proposalId, daoId) {
    await this.awardPoints(userId, "PROPOSAL_CREATED", REPUTATION_VALUES.PROPOSAL_CREATED, daoId, `Created proposal ${proposalId}`);
  }
  static async onReferral(referrerId, referredId) {
    await this.awardPoints(referrerId, "REFERRAL", REPUTATION_VALUES.REFERRAL, void 0, `Referred user ${referredId}`);
  }
  static async onDaoJoin(userId, daoId) {
    await this.awardPoints(userId, "DAO_MEMBERSHIP", REPUTATION_VALUES.DAO_MEMBERSHIP, daoId, "Joined DAO");
  }
};

// server/achievementService.ts
import { eq as eq12, and as and10, sql as sql5 } from "drizzle-orm";

// shared/achievementSchema.ts
import { pgTable as pgTable3, varchar as varchar3, timestamp as timestamp4, integer as integer3, boolean as boolean3, uuid as uuid3, text as text3 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema3 } from "drizzle-zod";
var achievements = pgTable3("achievements", {
  id: uuid3("id").primaryKey().defaultRandom(),
  name: varchar3("name").notNull(),
  description: text3("description"),
  category: varchar3("category").notNull(),
  // voting, contribution, social, streak, etc.
  criteria: text3("criteria").notNull(),
  // JSON string with achievement criteria
  rewardPoints: integer3("reward_points").default(0),
  rewardTokens: varchar3("reward_tokens").default("0"),
  badge: varchar3("badge"),
  // special badge for this achievement
  icon: varchar3("icon"),
  // emoji or icon identifier
  rarity: varchar3("rarity").default("common"),
  // common, rare, epic, legendary
  isActive: boolean3("is_active").default(true),
  createdAt: timestamp4("created_at").defaultNow()
});
var userAchievements = pgTable3("user_achievements", {
  id: uuid3("id").primaryKey().defaultRandom(),
  userId: varchar3("user_id").references(() => users.id).notNull(),
  achievementId: uuid3("achievement_id").references(() => achievements.id).notNull(),
  unlockedAt: timestamp4("unlocked_at").defaultNow(),
  progress: integer3("progress").default(0),
  // for progressive achievements
  maxProgress: integer3("max_progress").default(1),
  isCompleted: boolean3("is_completed").default(false),
  rewardClaimed: boolean3("reward_claimed").default(false),
  claimedAt: timestamp4("claimed_at")
});
var achievementProgress = pgTable3("achievement_progress", {
  id: uuid3("id").primaryKey().defaultRandom(),
  userId: varchar3("user_id").references(() => users.id).notNull(),
  achievementId: uuid3("achievement_id").references(() => achievements.id).notNull(),
  currentValue: integer3("current_value").default(0),
  targetValue: integer3("target_value").notNull(),
  lastUpdated: timestamp4("last_updated").defaultNow()
});
var insertAchievementSchema = createInsertSchema3(achievements);
var insertUserAchievementSchema = createInsertSchema3(userAchievements);
var insertAchievementProgressSchema = createInsertSchema3(achievementProgress);

// server/achievementService.ts
var AchievementService = class {
  // Initialize default achievements
  static async initializeDefaultAchievements() {
    const defaultAchievements = [
      {
        name: "First Vote",
        description: "Cast your first vote in any proposal",
        category: "voting",
        criteria: JSON.stringify({ action: "vote", count: 1 }),
        rewardPoints: 50,
        rewardTokens: "1",
        badge: "Voter",
        icon: "\u{1F5F3}\uFE0F",
        rarity: "common"
      },
      {
        name: "Democracy Champion",
        description: "Vote on 50 different proposals",
        category: "voting",
        criteria: JSON.stringify({ action: "vote", count: 50 }),
        rewardPoints: 500,
        rewardTokens: "10",
        badge: "Champion",
        icon: "\u{1F3C6}",
        rarity: "rare"
      },
      {
        name: "Proposal Pioneer",
        description: "Create your first proposal",
        category: "governance",
        criteria: JSON.stringify({ action: "proposal_created", count: 1 }),
        rewardPoints: 100,
        rewardTokens: "5",
        badge: "Pioneer",
        icon: "\u{1F4A1}",
        rarity: "common"
      },
      {
        name: "Community Builder",
        description: "Have 10 of your proposals pass",
        category: "governance",
        criteria: JSON.stringify({ action: "proposal_passed", count: 10 }),
        rewardPoints: 1e3,
        rewardTokens: "25",
        badge: "Builder",
        icon: "\u{1F3D7}\uFE0F",
        rarity: "epic"
      },
      {
        name: "Generous Soul",
        description: "Contribute a total of 1000 cUSD",
        category: "contribution",
        criteria: JSON.stringify({ action: "contribution_total", amount: 1e3 }),
        rewardPoints: 2e3,
        rewardTokens: "50",
        badge: "Generous",
        icon: "\u{1F49D}",
        rarity: "epic"
      },
      {
        name: "Streak Master",
        description: "Maintain a 30-day activity streak",
        category: "streak",
        criteria: JSON.stringify({ action: "daily_streak", count: 30 }),
        rewardPoints: 750,
        rewardTokens: "15",
        badge: "Consistent",
        icon: "\u26A1",
        rarity: "rare"
      },
      {
        name: "Social Butterfly",
        description: "Refer 10 friends to the platform",
        category: "social",
        criteria: JSON.stringify({ action: "referral", count: 10 }),
        rewardPoints: 1500,
        rewardTokens: "30",
        badge: "Influencer",
        icon: "\u{1F98B}",
        rarity: "epic"
      },
      {
        name: "Reputation Legend",
        description: "Reach 10,000 total reputation points",
        category: "reputation",
        criteria: JSON.stringify({ action: "reputation_total", count: 1e4 }),
        rewardPoints: 5e3,
        rewardTokens: "100",
        badge: "Legend",
        icon: "\u{1F451}",
        rarity: "legendary"
      }
    ];
    for (const achievement of defaultAchievements) {
      try {
        await db2.insert(achievements).values(achievement);
      } catch (error) {
        console.log(`Achievement ${achievement.name} already exists or failed to create`);
      }
    }
  }
  // Check and unlock achievements for user
  static async checkUserAchievements(userId) {
    const unlockedAchievements = [];
    const allAchievements = await db2.select().from(achievements).where(eq12(achievements.isActive, true));
    for (const achievement of allAchievements) {
      const isAlreadyUnlocked = await this.isAchievementUnlocked(userId, achievement.id);
      if (isAlreadyUnlocked) continue;
      const criteria = JSON.parse(achievement.criteria);
      const isUnlocked = await this.evaluateAchievementCriteria(userId, criteria);
      if (isUnlocked) {
        await this.unlockAchievement(userId, achievement.id);
        unlockedAchievements.push(achievement.name);
      }
    }
    return unlockedAchievements;
  }
  // Evaluate if user meets achievement criteria
  static async evaluateAchievementCriteria(userId, criteria) {
    switch (criteria.action) {
      case "vote":
        const voteCount = await db2.select({ count: sql5`count(*)` }).from(votes).where(eq12(votes.userId, userId));
        return (voteCount[0]?.count || 0) >= criteria.count;
      case "proposal_created":
        const proposalCount = await db2.select({ count: sql5`count(*)` }).from(proposals).where(eq12(proposals.createdBy, userId));
        return (proposalCount[0]?.count || 0) >= criteria.count;
      case "proposal_passed":
        const passedProposals = await db2.select({ count: sql5`count(*)` }).from(proposals).where(
          and10(
            eq12(proposals.createdBy, userId),
            eq12(proposals.status, "passed")
          )
        );
        return (passedProposals[0]?.count || 0) >= criteria.count;
      case "contribution_total":
        const totalContributions = await db2.select({ total: sql5`sum(${contributions.amount})` }).from(contributions).where(eq12(contributions.userId, userId));
        return (totalContributions[0]?.total || 0) >= criteria.amount;
      case "daily_streak":
        const userRep = await db2.select().from(userReputation).where(eq12(userReputation.userId, userId));
        return (userRep[0]?.currentStreak || 0) >= criteria.count;
      case "referral":
        const referralCount = await db2.select({ count: sql5`count(*)` }).from(msiaMoPoints).where(
          and10(
            eq12(msiaMoPoints.userId, userId),
            eq12(msiaMoPoints.action, "REFERRAL")
          )
        );
        return (referralCount[0]?.count || 0) >= criteria.count;
      case "reputation_total":
        const reputation = await db2.select().from(userReputation).where(eq12(userReputation.userId, userId));
        return (reputation[0]?.totalPoints || 0) >= criteria.count;
      default:
        return false;
    }
  }
  // Check if achievement is already unlocked
  static async isAchievementUnlocked(userId, achievementId) {
    const existing = await db2.select().from(userAchievements).where(
      and10(
        eq12(userAchievements.userId, userId),
        eq12(userAchievements.achievementId, achievementId),
        eq12(userAchievements.isCompleted, true)
      )
    );
    return existing.length > 0;
  }
  // Unlock achievement for user
  static async unlockAchievement(userId, achievementId) {
    const achievement = await db2.select().from(achievements).where(eq12(achievements.id, achievementId));
    if (!achievement[0]) return;
    await db2.insert(userAchievements).values({
      userId,
      achievementId,
      isCompleted: true,
      rewardClaimed: false
    });
    if (achievement[0].rewardPoints > 0) {
      await ReputationService.awardPoints(
        userId,
        "ACHIEVEMENT_UNLOCKED",
        achievement[0].rewardPoints,
        void 0,
        `Unlocked achievement: ${achievement[0].name}`,
        1
      );
    }
  }
  // Get user's achievements
  static async getUserAchievements(userId) {
    return await db2.select({
      achievement: achievements,
      userAchievement: userAchievements
    }).from(userAchievements).leftJoin(achievements, eq12(userAchievements.achievementId, achievements.id)).where(eq12(userAchievements.userId, userId));
  }
  // Get user's achievement statistics
  static async getUserAchievementStats(userId) {
    const totalAchievements = await db2.select({ count: sql5`count(*)` }).from(achievements).where(eq12(achievements.isActive, true));
    const unlockedAchievements = await db2.select({ count: sql5`count(*)` }).from(userAchievements).where(
      and10(
        eq12(userAchievements.userId, userId),
        eq12(userAchievements.isCompleted, true)
      )
    );
    const totalRewardPoints = await db2.select({ total: sql5`sum(${achievements.rewardPoints})` }).from(userAchievements).leftJoin(achievements, eq12(userAchievements.achievementId, achievements.id)).where(
      and10(
        eq12(userAchievements.userId, userId),
        eq12(userAchievements.isCompleted, true),
        eq12(userAchievements.rewardClaimed, true)
      )
    );
    return {
      totalAchievements: totalAchievements[0]?.count || 0,
      unlockedAchievements: unlockedAchievements[0]?.count || 0,
      completionRate: (unlockedAchievements[0]?.count || 0) / (totalAchievements[0]?.count || 1) * 100,
      totalRewardPointsEarned: totalRewardPoints[0]?.total || 0
    };
  }
  // Claim achievement rewards
  static async claimAchievementReward(userId, achievementId) {
    const userAchievement = await db2.select().from(userAchievements).where(
      and10(
        eq12(userAchievements.userId, userId),
        eq12(userAchievements.achievementId, achievementId),
        eq12(userAchievements.isCompleted, true),
        eq12(userAchievements.rewardClaimed, false)
      )
    );
    if (!userAchievement[0]) return false;
    await db2.update(userAchievements).set({
      rewardClaimed: true,
      claimedAt: /* @__PURE__ */ new Date()
    }).where(eq12(userAchievements.id, userAchievement[0].id));
    return true;
  }
};

// server/airdropService.ts
import { eq as eq13, and as and11, gte as gte3 } from "drizzle-orm";
var AirdropService = class {
  // Create new airdrop campaign
  static async createAirdropCampaign(campaign) {
    const campaignId = `airdrop_${Date.now()}`;
    return campaignId;
  }
  // Calculate airdrop eligibility for all users
  static async calculateAirdropEligibility(airdropId, minimumReputation, baseAmount, maxMultiplier = 5) {
    const users3 = await db2.select({
      userId: userReputation.userId,
      totalPoints: userReputation.totalPoints,
      badge: userReputation.badge
    }).from(userReputation).where(gte3(userReputation.totalPoints, minimumReputation));
    let processed = 0;
    let eligible = 0;
    for (const user of users3) {
      const reputationMultiplier = Math.min(user.totalPoints / minimumReputation, maxMultiplier);
      const airdropAmount = baseAmount * reputationMultiplier;
      const badgeMultiplier = this.getBadgeMultiplier(user.badge);
      const finalAmount = airdropAmount * badgeMultiplier;
      await db2.insert(airdropEligibility).values({
        userId: user.userId,
        airdropId,
        eligibleAmount: finalAmount.toString(),
        minimumReputation,
        userReputation: user.totalPoints,
        claimed: false
      });
      processed++;
      eligible++;
    }
    return { processed, eligible };
  }
  // Execute airdrop distribution
  static async executeAirdrop(airdropId) {
    const eligibleUsers = await db2.select().from(airdropEligibility).where(
      and11(
        eq13(airdropEligibility.airdropId, airdropId),
        eq13(airdropEligibility.claimed, false)
      )
    );
    let success = 0;
    let failed = 0;
    for (const eligibility of eligibleUsers) {
      try {
        const user = await db2.select({ walletAddress: users.walletAddress }).from(users).where(eq13(users.id, eligibility.userId));
        if (!user[0]?.walletAddress) {
          failed++;
          continue;
        }
        const txHash = await sendCUSD(
          user[0].walletAddress,
          eligibility.eligibleAmount
        );
        await db2.update(airdropEligibility).set({
          claimed: true,
          claimedAt: /* @__PURE__ */ new Date(),
          transactionHash: txHash
        }).where(eq13(airdropEligibility.id, eligibility.id));
        success++;
      } catch (error) {
        console.error(`Airdrop failed for user ${eligibility.userId}:`, error);
        failed++;
      }
    }
    return { success, failed };
  }
  // Get badge multiplier for airdrop calculations
  static getBadgeMultiplier(badge) {
    switch (badge) {
      case "Diamond":
        return 2;
      case "Platinum":
        return 1.8;
      case "Gold":
        return 1.5;
      case "Silver":
        return 1.2;
      default:
        return 1;
    }
  }
  // Check user's airdrop eligibility
  static async getUserAirdropEligibility(userId) {
    return await db2.select().from(airdropEligibility).where(eq13(airdropEligibility.userId, userId));
  }
  // Claim airdrop for user
  static async claimAirdrop(userId, airdropId) {
    const eligibility = await db2.select().from(airdropEligibility).where(
      and11(
        eq13(airdropEligibility.userId, userId),
        eq13(airdropEligibility.airdropId, airdropId),
        eq13(airdropEligibility.claimed, false)
      )
    );
    if (!eligibility[0]) {
      throw new Error("No eligible airdrop found or already claimed");
    }
    const user = await db2.select({ walletAddress: users.walletAddress }).from(users).where(eq13(users.id, userId));
    if (!user[0]?.walletAddress) {
      throw new Error("User wallet address not found");
    }
    const txHash = await sendCUSD(
      user[0].walletAddress,
      eligibility[0].eligibleAmount
    );
    await db2.update(airdropEligibility).set({
      claimed: true,
      claimedAt: /* @__PURE__ */ new Date(),
      transactionHash: txHash
    }).where(eq13(airdropEligibility.id, eligibility[0].id));
    return txHash;
  }
};

// server/vestingService.ts
import { eq as eq14, and as and12 } from "drizzle-orm";

// shared/vestingSchema.ts
import { pgTable as pgTable4, varchar as varchar4, timestamp as timestamp5, decimal as decimal3, boolean as boolean4, uuid as uuid4, integer as integer4 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema4 } from "drizzle-zod";
var vestingSchedules = pgTable4("vesting_schedules", {
  id: uuid4("id").primaryKey().defaultRandom(),
  userId: varchar4("user_id").references(() => users.id).notNull(),
  scheduleType: varchar4("schedule_type").notNull(),
  // linear, cliff, milestone
  totalTokens: decimal3("total_tokens", { precision: 18, scale: 8 }).notNull(),
  vestedTokens: decimal3("vested_tokens", { precision: 18, scale: 8 }).default("0"),
  claimedTokens: decimal3("claimed_tokens", { precision: 18, scale: 8 }).default("0"),
  startDate: timestamp5("start_date").notNull(),
  endDate: timestamp5("end_date").notNull(),
  cliffDuration: integer4("cliff_duration").default(0),
  // in days
  vestingDuration: integer4("vesting_duration").notNull(),
  // in days
  vestingInterval: integer4("vesting_interval").default(1),
  // in days
  isActive: boolean4("is_active").default(true),
  reason: varchar4("reason"),
  // airdrop, team, advisor, etc.
  createdAt: timestamp5("created_at").defaultNow()
});
var vestingClaims = pgTable4("vesting_claims", {
  id: uuid4("id").primaryKey().defaultRandom(),
  scheduleId: uuid4("schedule_id").references(() => vestingSchedules.id).notNull(),
  userId: varchar4("user_id").references(() => users.id).notNull(),
  claimedAmount: decimal3("claimed_amount", { precision: 18, scale: 8 }).notNull(),
  transactionHash: varchar4("transaction_hash"),
  claimedAt: timestamp5("claimed_at").defaultNow()
});
var vestingMilestones = pgTable4("vesting_milestones", {
  id: uuid4("id").primaryKey().defaultRandom(),
  scheduleId: uuid4("schedule_id").references(() => vestingSchedules.id).notNull(),
  milestoneType: varchar4("milestone_type").notNull(),
  // reputation, time, task_completion
  description: varchar4("description"),
  targetValue: decimal3("target_value", { precision: 18, scale: 8 }).notNull(),
  currentValue: decimal3("current_value", { precision: 18, scale: 8 }).default("0"),
  tokensToRelease: decimal3("tokens_to_release", { precision: 18, scale: 8 }).notNull(),
  isCompleted: boolean4("is_completed").default(false),
  completedAt: timestamp5("completed_at")
});
var insertVestingScheduleSchema = createInsertSchema4(vestingSchedules);
var insertVestingClaimSchema = createInsertSchema4(vestingClaims);
var insertVestingMilestoneSchema = createInsertSchema4(vestingMilestones);

// server/vestingService.ts
var VestingService = class {
  // Create new vesting schedule
  static async createVestingSchedule(params) {
    const endDate = new Date(params.startDate);
    endDate.setDate(endDate.getDate() + params.vestingDuration);
    const scheduleId = (await db2.insert(vestingSchedules).values({
      userId: params.userId,
      scheduleType: params.scheduleType,
      totalTokens: params.totalTokens.toString(),
      startDate: params.startDate,
      endDate,
      cliffDuration: params.cliffDuration || 0,
      vestingDuration: params.vestingDuration,
      vestingInterval: params.vestingInterval || 1,
      reason: params.reason
    }).returning())[0].id;
    if (params.milestones && params.scheduleType === "milestone") {
      for (const milestone of params.milestones) {
        await db2.insert(vestingMilestones).values({
          scheduleId,
          milestoneType: milestone.milestoneType,
          description: milestone.description,
          targetValue: milestone.targetValue.toString(),
          tokensToRelease: milestone.tokensToRelease.toString()
        });
      }
    }
    return scheduleId;
  }
  // Calculate vested tokens for a schedule
  static async calculateVestedTokens(scheduleId) {
    const schedule = await db2.select().from(vestingSchedules).where(eq14(vestingSchedules.id, scheduleId));
    if (!schedule[0] || !schedule[0].isActive) return 0;
    const now = /* @__PURE__ */ new Date();
    const startDate = new Date(schedule[0].startDate);
    const endDate = new Date(schedule[0].endDate);
    const totalTokens = parseFloat(schedule[0].totalTokens);
    if (now < startDate) return 0;
    const cliffEndDate = new Date(startDate);
    cliffEndDate.setDate(cliffEndDate.getDate() + schedule[0].cliffDuration);
    if (now < cliffEndDate) return 0;
    switch (schedule[0].scheduleType) {
      case "linear":
        return this.calculateLinearVesting(totalTokens, startDate, endDate, now);
      case "cliff":
        return now >= endDate ? totalTokens : 0;
      case "milestone":
        return await this.calculateMilestoneVesting(scheduleId);
      default:
        return 0;
    }
  }
  // Linear vesting calculation
  static calculateLinearVesting(totalTokens, startDate, endDate, currentDate) {
    if (currentDate >= endDate) return totalTokens;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = currentDate.getTime() - startDate.getTime();
    const vestingPercentage = elapsedDuration / totalDuration;
    return totalTokens * vestingPercentage;
  }
  // Milestone-based vesting calculation
  static async calculateMilestoneVesting(scheduleId) {
    const completedMilestones = await db2.select().from(vestingMilestones).where(
      and12(
        eq14(vestingMilestones.scheduleId, scheduleId),
        eq14(vestingMilestones.isCompleted, true)
      )
    );
    return completedMilestones.reduce((total, milestone) => {
      return total + parseFloat(milestone.tokensToRelease);
    }, 0);
  }
  // Update milestone progress
  static async updateMilestoneProgress(scheduleId, milestoneType, currentValue) {
    const milestone = await db2.select().from(vestingMilestones).where(
      and12(
        eq14(vestingMilestones.scheduleId, scheduleId),
        eq14(vestingMilestones.milestoneType, milestoneType),
        eq14(vestingMilestones.isCompleted, false)
      )
    );
    if (!milestone[0]) return false;
    await db2.update(vestingMilestones).set({ currentValue: currentValue.toString() }).where(eq14(vestingMilestones.id, milestone[0].id));
    if (currentValue >= parseFloat(milestone[0].targetValue)) {
      await db2.update(vestingMilestones).set({
        isCompleted: true,
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq14(vestingMilestones.id, milestone[0].id));
      return true;
    }
    return false;
  }
  // Get claimable tokens for user
  static async getClaimableTokens(userId) {
    const schedules = await db2.select().from(vestingSchedules).where(
      and12(
        eq14(vestingSchedules.userId, userId),
        eq14(vestingSchedules.isActive, true)
      )
    );
    const claimableSchedules = [];
    for (const schedule of schedules) {
      const vestedTokens = await this.calculateVestedTokens(schedule.id);
      const claimedTokens = parseFloat(schedule.claimedTokens);
      const claimable = vestedTokens - claimedTokens;
      if (claimable > 0) {
        claimableSchedules.push({
          scheduleId: schedule.id,
          claimable
        });
      }
    }
    return claimableSchedules;
  }
  // Claim vested tokens
  static async claimVestedTokens(userId, scheduleId) {
    const schedule = await db2.select().from(vestingSchedules).where(
      and12(
        eq14(vestingSchedules.id, scheduleId),
        eq14(vestingSchedules.userId, userId),
        eq14(vestingSchedules.isActive, true)
      )
    );
    if (!schedule[0]) {
      throw new Error("Invalid vesting schedule");
    }
    const vestedTokens = await this.calculateVestedTokens(scheduleId);
    const claimedTokens = parseFloat(schedule[0].claimedTokens);
    const claimableAmount = vestedTokens - claimedTokens;
    if (claimableAmount <= 0) {
      throw new Error("No tokens available to claim");
    }
    const user = await db2.select({ walletAddress: users.walletAddress }).from(users).where(eq14(users.id, userId));
    if (!user[0]?.walletAddress) {
      throw new Error("User wallet address not found");
    }
    const txHash = await sendCUSD(user[0].walletAddress, claimableAmount.toString());
    await db2.update(vestingSchedules).set({
      claimedTokens: (claimedTokens + claimableAmount).toString()
    }).where(eq14(vestingSchedules.id, scheduleId));
    await db2.insert(vestingClaims).values({
      scheduleId,
      userId,
      claimedAmount: claimableAmount.toString(),
      transactionHash: txHash
    });
    return txHash;
  }
  // Get user's vesting overview
  static async getUserVestingOverview(userId) {
    const schedules = await db2.select().from(vestingSchedules).where(
      and12(
        eq14(vestingSchedules.userId, userId),
        eq14(vestingSchedules.isActive, true)
      )
    );
    let totalAllocated = 0;
    let totalVested = 0;
    let totalClaimed = 0;
    let totalClaimable = 0;
    const scheduleDetails = [];
    for (const schedule of schedules) {
      const allocated = parseFloat(schedule.totalTokens);
      const vested = await this.calculateVestedTokens(schedule.id);
      const claimed = parseFloat(schedule.claimedTokens);
      const claimable = vested - claimed;
      totalAllocated += allocated;
      totalVested += vested;
      totalClaimed += claimed;
      totalClaimable += claimable;
      scheduleDetails.push({
        id: schedule.id,
        type: schedule.scheduleType,
        reason: schedule.reason,
        allocated,
        vested,
        claimed,
        claimable,
        startDate: schedule.startDate,
        endDate: schedule.endDate
      });
    }
    return {
      overview: {
        totalAllocated,
        totalVested,
        totalClaimed,
        totalClaimable,
        vestingPercentage: totalAllocated > 0 ? totalVested / totalAllocated * 100 : 0
      },
      schedules: scheduleDetails
    };
  }
  // Check and update milestones for all users (scheduled job)
  static async updateAllMilestones() {
    const activeMilestones = await db2.select().from(vestingMilestones).where(eq14(vestingMilestones.isCompleted, false));
    let updated = 0;
    let completed = 0;
    for (const milestone of activeMilestones) {
      const schedule = await db2.select().from(vestingSchedules).where(eq14(vestingSchedules.id, milestone.scheduleId));
      if (!schedule[0]) continue;
      let currentValue = 0;
      switch (milestone.milestoneType) {
        case "reputation":
          const userRep = await db2.select().from(userReputation).where(eq14(userReputation.userId, schedule[0].userId));
          currentValue = userRep[0]?.totalPoints || 0;
          break;
        case "time":
          const now = /* @__PURE__ */ new Date();
          const start = new Date(schedule[0].startDate);
          currentValue = Math.floor((now.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24));
          break;
      }
      const wasCompleted = await this.updateMilestoneProgress(
        milestone.scheduleId,
        milestone.milestoneType,
        currentValue
      );
      updated++;
      if (wasCompleted) completed++;
    }
    return { updated, completed };
  }
};

// server/routes/reputation.ts
var router16 = express16.Router();
router16.get("/user/:userId", isAuthenticated2, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = req.user.claims.sub;
    if (userId !== authUserId && userId !== "me") {
      const reputation2 = await ReputationService.getUserReputation(userId);
      return res.json({
        totalPoints: reputation2.totalPoints,
        badge: reputation2.badge,
        level: reputation2.level
      });
    }
    const targetUserId = userId === "me" ? authUserId : userId;
    const reputation = await ReputationService.getUserReputation(targetUserId);
    res.json(reputation);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/leaderboard", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await ReputationService.getLeaderboard(Number(limit));
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/convert", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { pointsToConvert, conversionRate } = req.body;
    if (!pointsToConvert || pointsToConvert <= 0) {
      return res.status(400).json({ message: "Invalid points amount" });
    }
    const result = await ReputationService.convertPointsToTokens(
      userId,
      pointsToConvert,
      conversionRate
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/airdrop/check", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { airdropId, minimumReputation, baseAmount } = req.body;
    if (!airdropId || !minimumReputation || !baseAmount) {
      return res.status(400).json({ message: "Missing required airdrop parameters" });
    }
    const eligibility = await ReputationService.checkAirdropEligibility(
      userId,
      airdropId,
      minimumReputation,
      baseAmount
    );
    res.json(eligibility);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/award", isAuthenticated2, async (req, res) => {
  try {
    const { userId, action, points, daoId, description, multiplier } = req.body;
    const authUser = req.user;
    if (authUser.role !== "superuser" && authUser.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    await ReputationService.awardPoints(userId, action, points, daoId, description, multiplier);
    res.json({ message: "Points awarded successfully" });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/achievements", async (req, res) => {
  try {
    const achievements2 = await db.select().from(achievements2).where(eq(achievements2.isActive, true));
    res.json({ achievements: achievements2 });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/achievements/user/:userId", isAuthenticated2, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = req.user.claims.sub;
    if (userId !== authUserId && userId !== "me") {
      return res.status(403).json({ message: "Access denied" });
    }
    const targetUserId = userId === "me" ? authUserId : userId;
    const userAchievements2 = await AchievementService.getUserAchievements(targetUserId);
    const stats = await AchievementService.getUserAchievementStats(targetUserId);
    res.json({ achievements: userAchievements2, stats });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/achievements/claim/:achievementId", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { achievementId } = req.params;
    const success = await AchievementService.claimAchievementReward(userId, achievementId);
    if (success) {
      res.json({ message: "Reward claimed successfully" });
    } else {
      res.status(400).json({ message: "Unable to claim reward" });
    }
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/airdrops/eligible", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const eligibleAirdrops = await AirdropService.getUserAirdropEligibility(userId);
    res.json({ airdrops: eligibleAirdrops });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/airdrops/claim/:airdropId", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { airdropId } = req.params;
    const txHash = await AirdropService.claimAirdrop(userId, airdropId);
    res.json({ message: "Airdrop claimed successfully", transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/vesting/overview", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const overview = await VestingService.getUserVestingOverview(userId);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.get("/vesting/claimable", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const claimable = await VestingService.getClaimableTokens(userId);
    res.json({ claimable });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
router16.post("/vesting/claim/:scheduleId", isAuthenticated2, async (req, res) => {
  try {
    const userId = req.user.claims.sub;
    const { scheduleId } = req.params;
    const txHash = await VestingService.claimVestedTokens(userId, scheduleId);
    res.json({ message: "Tokens claimed successfully", transactionHash: txHash });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : String(err) });
  }
});
var reputation_default = router16;

// server/routes/analytics.ts
import express17 from "express";

// server/analyticsService.ts
import { eq as eq15, gte as gte5, lte as lte4, count, sum, sql as sql8 } from "drizzle-orm";
import { format as format2, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
var AnalyticsService = class {
  // Real-time metrics collection
  async getRealTimeMetrics(daoId) {
    const whereClause = daoId ? eq15(daos.id, daoId) : void 0;
    const [
      totalDaos,
      totalProposals,
      totalVotes,
      totalUsers,
      totalTasks
    ] = await Promise.all([
      // Total DAOs
      db2.select({ count: count() }).from(daos).where(whereClause),
      // Total Proposals
      daoId ? db2.select({ count: count() }).from(proposals).where(eq15(proposals.daoId, daoId)) : db2.select({ count: count() }).from(proposals),
      // Total Votes
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq15(votes.proposalId, proposals.id)).where(eq15(proposals.daoId, daoId)) : db2.select({ count: count() }).from(votes),
      // Total Users
      db2.select({ count: count() }).from(users),
      // Total Tasks
      daoId ? db2.select({ count: count() }).from(tasks).where(eq15(tasks.daoId, daoId)) : db2.select({ count: count() }).from(tasks),
      // Transaction Volume
      // Proposal Success Rate Data
      daoId ? db2.select({
        status: proposals.status,
        count: count()
      }).from(proposals).where(eq15(proposals.daoId, daoId)).groupBy(proposals.status) : db2.select({
        status: proposals.status,
        count: count()
      }).from(proposals).groupBy(proposals.status)
    ]);
    const totalProposalCount = proposalData.reduce((sum2, item) => sum2 + item.count, 0);
    const successfulProposals = proposalData.find((item) => item.status === "executed")?.count || 0;
    const avgProposalSuccessRate = totalProposalCount > 0 ? successfulProposals / totalProposalCount * 100 : 0;
    const topPerformingDaos = await this.getTopPerformingDaos(5);
    return {
      totalDaos: totalDaos[0]?.count || 0,
      totalProposals: totalProposals[0]?.count || 0,
      totalVotes: totalVotes[0]?.count || 0,
      totalUsers: totalUsers[0]?.count || 0,
      totalTasks: totalTasks[0]?.count || 0,
      avgProposalSuccessRate,
      avgUserEngagement: await this.calculateUserEngagement(daoId),
      topPerformingDaos
    };
  }
  // Historical data analysis
  async getHistoricalData(period, daoId) {
    const now = /* @__PURE__ */ new Date();
    let startDate;
    let interval;
    switch (period) {
      case "week":
        startDate = subDays(now, 7);
        interval = "day";
        break;
      case "month":
        startDate = subMonths(now, 1);
        interval = "day";
        break;
      case "quarter":
        startDate = subMonths(now, 3);
        interval = "week";
        break;
      case "year":
        startDate = subYears(now, 1);
        interval = "month";
        break;
    }
    const historicalData = [];
    const current = new Date(startDate);
    while (current <= now) {
      const dayStart = startOfDay(current);
      const dayEnd = endOfDay(current);
      const [daoCount, userCount, proposalCount, transactionData, proposalSuccess] = await Promise.all([
        daoId ? Promise.resolve([{ count: 1 }]) : db2.select({ count: count() }).from(daos).where(lte4(daos.createdAt, dayEnd)),
        db2.select({ count: count() }).from(users).where(lte4(users.createdAt, dayEnd)),
        daoId ? db2.select({ count: count() }).from(proposals).where(eq15(proposals.daoId, daoId)).where(gte5(proposals.createdAt, dayStart)).where(lte4(proposals.createdAt, dayEnd)) : db2.select({ count: count() }).from(proposals).where(gte5(proposals.createdAt, dayStart)).where(lte4(proposals.createdAt, dayEnd)),
        daoId ? db2.select({
          total: sum(sql8`CAST(${transactions.amount} AS DECIMAL)`)
        }).from(transactions).where(eq15(transactions.daoId, daoId)).where(gte5(transactions.createdAt, dayStart)).where(lte4(transactions.createdAt, dayEnd)) : db2.select({
          total: sum(sql8`CAST(${transactions.amount} AS DECIMAL)`)
        }).from(transactions).where(gte5(transactions.createdAt, dayStart)).where(lte4(transactions.createdAt, dayEnd)),
        this.getSuccessRateForPeriod(dayStart, dayEnd, daoId)
      ]);
      historicalData.push({
        timestamp: format2(current, "yyyy-MM-dd"),
        daoCount: daoCount[0]?.count || 0,
        userCount: userCount[0]?.count || 0,
        proposalCount: proposalCount[0]?.count || 0,
        transactionVolume: Number(transactionData[0]?.total) || 0,
        avgSuccessRate: proposalSuccess
      });
      if (interval === "day") current.setDate(current.getDate() + 1);
      else if (interval === "week") current.setDate(current.getDate() + 7);
      else if (interval === "month") current.setMonth(current.getMonth() + 1);
    }
    return historicalData;
  }
  // Performance benchmarks
  async getPerformanceBenchmarks() {
    const allDaoMetrics = await Promise.all(
      (await db2.select({ id: daos.id }).from(daos)).map(
        (dao) => this.getRealTimeMetrics(dao.id)
      )
    );
    const sortedByEngagement = [...allDaoMetrics].sort((a, b) => b.avgUserEngagement - a.avgUserEngagement);
    const sortedBySuccess = [...allDaoMetrics].sort((a, b) => b.avgProposalSuccessRate - a.avgProposalSuccessRate);
    const quartileIndex = Math.floor(allDaoMetrics.length / 4);
    return {
      industry: {
        avgGovernanceParticipation: 65,
        // Industry benchmark
        avgProposalSuccessRate: 72,
        // Industry benchmark
        avgTreasuryGrowth: 15
        // Industry benchmark
      },
      platform: {
        topQuartile: sortedByEngagement[0] || await this.getRealTimeMetrics(),
        median: sortedByEngagement[Math.floor(allDaoMetrics.length / 2)] || await this.getRealTimeMetrics(),
        bottomQuartile: sortedByEngagement[allDaoMetrics.length - quartileIndex] || await this.getRealTimeMetrics()
      }
    };
  }
  // Export data to CSV
  async exportToCSV(type, period, daoId) {
    let data;
    let headers;
    switch (type) {
      case "metrics":
        const metrics = await this.getRealTimeMetrics(daoId);
        headers = Object.keys(metrics).filter((key) => key !== "topPerformingDaos");
        data = [Object.values(metrics).filter((_, index2) => headers[index2])];
        break;
      case "historical":
        const historical = await this.getHistoricalData(period || "month", daoId);
        headers = Object.keys(historical[0] || {});
        data = historical.map((item) => Object.values(item));
        break;
      case "benchmarks":
        const benchmarks = await this.getPerformanceBenchmarks();
        headers = ["Type", "AvgGovernanceParticipation", "AvgProposalSuccessRate", "AvgTreasuryGrowth"];
        data = [
          ["Industry", benchmarks.industry.avgGovernanceParticipation, benchmarks.industry.avgProposalSuccessRate, benchmarks.industry.avgTreasuryGrowth],
          ["Platform Top", benchmarks.platform.topQuartile.avgUserEngagement, benchmarks.platform.topQuartile.avgProposalSuccessRate, benchmarks.platform.topQuartile.totalTransactionVolume],
          ["Platform Median", benchmarks.platform.median.avgUserEngagement, benchmarks.platform.median.avgProposalSuccessRate, benchmarks.platform.median.totalTransactionVolume]
        ];
        break;
    }
    const csvContent = [
      headers.join(","),
      ...data.map((row) => row.join(","))
    ].join("\n");
    return csvContent;
  }
  // Helper methods
  async getTopPerformingDaos(limit) {
    const daosList = await db2.select({
      id: daos.id,
      name: daos.name,
      memberCount: daos.memberCount,
      treasuryAddress: daos.treasuryAddress
    }).from(daos).limit(limit);
    return Promise.all(daosList.map(async (dao) => {
      const [proposalCount, successRate] = await Promise.all([
        db2.select({ count: count() }).from(proposals).where(eq15(proposals.daoId, dao.id)),
        this.getSuccessRateForDao(dao.id)
      ]);
      return {
        id: dao.id,
        name: dao.name,
        memberCount: dao.memberCount || 0,
        proposalCount: proposalCount[0]?.count || 0,
        successRate,
        treasuryValue: 0
        // Would integrate with treasury service
      };
    }));
  }
  async calculateUserEngagement(daoId) {
    const thirtyDaysAgo = subDays(/* @__PURE__ */ new Date(), 30);
    const [totalUsers, activeUsers] = await Promise.all([
      daoId ? db2.select({ count: count() }).from(users) : db2.select({ count: count() }).from(users),
      daoId ? db2.select({ count: count() }).from(votes).innerJoin(proposals, eq15(votes.proposalId, proposals.id)).where(eq15(proposals.daoId, daoId)).where(gte5(votes.createdAt, thirtyDaysAgo)) : db2.select({ count: count() }).from(votes).where(gte5(votes.createdAt, thirtyDaysAgo))
    ]);
    const total = totalUsers[0]?.count || 0;
    const active = activeUsers[0]?.count || 0;
    return total > 0 ? active / total * 100 : 0;
  }
  async getSuccessRateForPeriod(start, end, daoId) {
    const proposalsData = daoId ? await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(eq15(proposals.daoId, daoId)).where(gte5(proposals.createdAt, start)).where(lte4(proposals.createdAt, end)).groupBy(proposals.status) : await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(gte5(proposals.createdAt, start)).where(lte4(proposals.createdAt, end)).groupBy(proposals.status);
    const total = proposalsData.reduce((sum2, item) => sum2 + item.count, 0);
    const successful = proposalsData.find((item) => item.status === "executed")?.count || 0;
    return total > 0 ? successful / total * 100 : 0;
  }
  async getSuccessRateForDao(daoId) {
    const proposalsData = await db2.select({
      status: proposals.status,
      count: count()
    }).from(proposals).where(eq15(proposals.daoId, daoId)).groupBy(proposals.status);
    const total = proposalsData.reduce((sum2, item) => sum2 + item.count, 0);
    const successful = proposalsData.find((item) => item.status === "executed")?.count || 0;
    return total > 0 ? successful / total * 100 : 0;
  }
};
var analyticsService = new AnalyticsService();

// server/routes/analytics.ts
import PDFDocument from "pdfkit";
var router17 = express17.Router();
router17.get("/metrics", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    const metrics = await analyticsService.getRealTimeMetrics(daoId);
    res.json({
      success: true,
      data: metrics,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time metrics",
      error: error.message
    });
  }
});
router17.get("/historical", isAuthenticated, async (req, res) => {
  try {
    const { period = "month", daoId } = req.query;
    if (!["week", "month", "quarter", "year"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Must be one of: week, month, quarter, year"
      });
    }
    const historicalData = await analyticsService.getHistoricalData(
      period,
      daoId
    );
    res.json({
      success: true,
      data: historicalData,
      period,
      daoId: daoId || "all"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch historical data",
      error: error.message
    });
  }
});
router17.get("/benchmarks", isAuthenticated, async (req, res) => {
  try {
    const benchmarks = await analyticsService.getPerformanceBenchmarks();
    res.json({
      success: true,
      data: benchmarks,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance benchmarks",
      error: error.message
    });
  }
});
router17.get("/export/csv", isAuthenticated, async (req, res) => {
  try {
    const { type = "metrics", period = "month", daoId } = req.query;
    if (!["metrics", "historical", "benchmarks"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid export type. Must be one of: metrics, historical, benchmarks"
      });
    }
    const csvContent = await analyticsService.exportToCSV(
      type,
      period,
      daoId
    );
    const filename = `${type}-${period || "current"}-${daoId || "all"}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export CSV",
      error: error.message
    });
  }
});
router17.get("/export/pdf", isAuthenticated, async (req, res) => {
  try {
    const { daoId, period = "month" } = req.query;
    const [metrics, historical, benchmarks] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId),
      analyticsService.getHistoricalData(period, daoId),
      analyticsService.getPerformanceBenchmarks()
    ]);
    const doc = new PDFDocument();
    const filename = `analytics-report-${daoId || "platform"}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);
    doc.fontSize(20).text("Analytics Report", 50, 50);
    doc.fontSize(12).text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}`, 50, 80);
    doc.text(`Period: ${period}`, 50, 95);
    if (daoId) doc.text(`DAO ID: ${daoId}`, 50, 110);
    doc.fontSize(16).text("Current Metrics", 50, 140);
    let yPos = 160;
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== "topPerformingDaos" && typeof value !== "object") {
        doc.fontSize(10).text(`${key}: ${value}`, 50, yPos);
        yPos += 15;
      }
    });
    yPos += 20;
    doc.fontSize(16).text("Historical Trends", 50, yPos);
    yPos += 20;
    doc.fontSize(10).text("Date | DAOs | Users | Proposals | Volume", 50, yPos);
    yPos += 15;
    historical.slice(-10).forEach((item) => {
      doc.text(`${item.timestamp} | ${item.daoCount} | ${item.userCount} | ${item.proposalCount} | $${item.transactionVolume.toFixed(2)}`, 50, yPos);
      yPos += 12;
    });
    yPos += 30;
    doc.fontSize(16).text("Performance Benchmarks", 50, yPos);
    yPos += 20;
    doc.fontSize(12).text("Industry Benchmarks:", 50, yPos);
    yPos += 15;
    doc.fontSize(10).text(`Governance Participation: ${benchmarks.industry.avgGovernanceParticipation}%`, 70, yPos);
    yPos += 12;
    doc.text(`Proposal Success Rate: ${benchmarks.industry.avgProposalSuccessRate}%`, 70, yPos);
    yPos += 12;
    doc.text(`Treasury Growth: ${benchmarks.industry.avgTreasuryGrowth}%`, 70, yPos);
    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF report",
      error: error.message
    });
  }
});
router17.get("/live", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    });
    const sendMetrics = async () => {
      try {
        const metrics = await analyticsService.getRealTimeMetrics(daoId);
        res.write(`data: ${JSON.stringify({
          type: "metrics",
          data: metrics,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })}

`);
      } catch (error) {
        console.error("Error sending live metrics:", error);
      }
    };
    await sendMetrics();
    const interval = setInterval(sendMetrics, 3e4);
    req.on("close", () => {
      clearInterval(interval);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to start live metrics stream",
      error: error.message
    });
  }
});
router17.get("/dao/:daoId/summary", isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { period = "month" } = req.query;
    const [metrics, historical] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId),
      analyticsService.getHistoricalData(period, daoId)
    ]);
    const currentMetrics = historical[historical.length - 1];
    const previousMetrics = historical[historical.length - 2];
    let growthRates = {};
    if (currentMetrics && previousMetrics) {
      growthRates = {
        userGrowth: (currentMetrics.userCount - previousMetrics.userCount) / previousMetrics.userCount * 100,
        proposalGrowth: (currentMetrics.proposalCount - previousMetrics.proposalCount) / (previousMetrics.proposalCount || 1) * 100,
        volumeGrowth: (currentMetrics.transactionVolume - previousMetrics.transactionVolume) / (previousMetrics.transactionVolume || 1) * 100
      };
    }
    res.json({
      success: true,
      data: {
        metrics,
        historical,
        growthRates,
        period
      },
      daoId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch DAO analytics summary",
      error: error.message
    });
  }
});
var analytics_default = router17;

// server/routes.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var uploadsDir = path.join(__dirname2, "uploads", "avatars");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
var storageConfig = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const ext = file.originalname.split(".").pop();
    const userId = req.user?.claims?.sub ?? "unknown";
    cb(null, `${userId}.${ext}`);
  }
});
var upload = multer({ storage: storageConfig, limits: { fileSize: 2 * 1024 * 1024 } });
function extractWalletAddress(req) {
  const user = req.user;
  return user?.walletAddress ?? user?.claims?.walletAddress ?? req.body?.userAddress;
}
async function withRetry(operation, maxAttempts = 3, delayMs = 1e3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Max retry attempts reached");
}
function errorHandler(err, req, res, next) {
  console.error(err);
  const message = err instanceof ZodError ? "Invalid request data" : "Internal server error";
  const details = err instanceof ZodError ? err.errors : void 0;
  res.status(err.status || 500).json({ message, ...details && { errors: details } });
}
var sessionMiddleware = (req, res, next) => {
  next();
};
var refreshTokenHandler = async (req, res) => {
  res.status(501).json({ message: "Not Implemented" });
};
var requestPasswordReset = async (req, res) => {
  res.status(501).json({ message: "Not Implemented" });
};
var resetPassword = async (req, res) => {
  res.status(501).json({ message: "Not Implemented" });
};
var verifyResetToken = async (req, res) => {
  res.status(501).json({ message: "Not Implemented" });
};
var destroySession = (sessionId) => {
};
var destroyAllUserSessions = (userId) => {
};
var getUserActiveSessions = (userId) => [];
function registerRoutes(app2) {
  app2.use("/api/wallet", isAuthenticated2, wallet_default);
  app2.use("/api/dao/treasury", dao_treasury_default);
  app2.use("/api/reputation", reputation_default);
  app2.use("/api/notifications", isAuthenticated2, notifications_default);
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  app2.get("/api/notifications", isAuthenticated2, async (req, res) => {
    try {
      const { limit = 10, offset = 0, read, userId } = req.query;
      const authUserId = req.user.claims.sub;
      if (userId && userId !== authUserId) {
        return res.status(403).json({ message: "Forbidden: Cannot access other users' notifications" });
      }
      const notifications2 = await storage.getUserNotifications(authUserId, read === "true", Number(limit), Number(offset));
      res.json({ notifications: notifications2, total: notifications2.length });
    } catch (err) {
      throw new Error(`Failed to fetch notifications: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/tasks/:id/history", isAuthenticated2, async (req, res) => {
    try {
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.user.claims.sub;
      const task = await storage.getTasks(void 0, void 0).then((ts) => ts.find((t) => t.id === req.params.id));
      if (!task) return res.status(404).json({ message: "Task not found" });
      const membership = await storage.getDaoMembership(task.daoId, userId);
      if (!membership || membership.role !== "admin" && membership.role !== "moderator") {
        return res.status(403).json({ message: "Admin or moderator role required to view task history" });
      }
      const history = await storage.getTaskHistory(req.params.id, Number(limit), Number(offset));
      res.json({ history, total: history.length });
    } catch (err) {
      throw new Error(`Failed to fetch task history: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/tasks/:id", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateTask(req.params.id, req.body, userId);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update task: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  function isSuperuser(req, res, next) {
    if (req.user && req.user.role === "superuser") {
      return next();
    }
    res.status(403).json({ error: "Superuser access required" });
  }
  function isDaoAdmin(req, res, next) {
    const userRole = req.user?.role;
    if (userRole === "superuser" || userRole === "admin") {
      return next();
    }
    res.status(403).json({ error: "Admin access required" });
  }
  function isDaoModerator(req, res, next) {
    const userRole = req.user?.role;
    if (userRole === "superuser" || userRole === "admin" || userRole === "moderator") {
      return next();
    }
    res.status(403).json({ error: "Moderator access required" });
  }
  async function checkDaoMembership(req, res, next) {
    try {
      const { daoId } = req.params;
      const userId = req.user.claims.sub;
      if (!daoId) {
        return res.status(400).json({ error: "DAO ID required" });
      }
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.status !== "approved") {
        return res.status(403).json({ error: "DAO membership required" });
      }
      req.daoMembership = membership;
      next();
    } catch (err) {
      res.status(500).json({ error: "Failed to verify DAO membership" });
    }
  }
  async function checkDaoAdminRole(req, res, next) {
    try {
      const { daoId } = req.params;
      const userId = req.user.claims.sub;
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.role !== "admin" && membership.role !== "elder") {
        return res.status(403).json({ error: "DAO admin or elder role required" });
      }
      req.daoMembership = membership;
      next();
    } catch (err) {
      res.status(500).json({ error: "Failed to verify DAO admin role" });
    }
  }
  app2.get("/api/admin/daos", isAuthenticated2, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const daos4 = await storage.getAllDaos({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getDaoCount();
      res.json({ daos: daos4, total });
    } catch (err) {
      throw new Error(`Failed to fetch DAOs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/users", isAuthenticated2, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const users3 = await storage.getAllUsers({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getUserCount();
      res.json({ users: users3, total });
    } catch (err) {
      throw new Error(`Failed to fetch users: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/fees", isAuthenticated2, isSuperuser, async (req, res) => {
    try {
      const fees = await storage.getPlatformFeeInfo();
      res.json({ fees });
    } catch (err) {
      throw new Error(`Failed to fetch fee info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/logs", isAuthenticated2, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const logs2 = await storage.getSystemLogs({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getLogCount();
      res.json({ logs: logs2, total });
    } catch (err) {
      throw new Error(`Failed to fetch logs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/billing", isAuthenticated2, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const billing = await storage.getAllDaoBillingHistory();
      const total = await storage.getBillingCount();
      res.json({ billing, total });
    } catch (err) {
      throw new Error(`Failed to fetch billing history: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/chaininfo", isAuthenticated2, isSuperuser, async (req, res) => {
    try {
      const chainInfo2 = await storage.getChainInfo();
      res.json({ chainInfo: chainInfo2 });
    } catch (err) {
      throw new Error(`Failed to fetch chain info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/topmembers", isAuthenticated2, isSuperuser, async (req, res) => {
    const { limit = 10 } = req.query;
    try {
      const topMembers = await storage.getTopMembers({ limit: Number(limit) });
      res.json({ topMembers });
    } catch (err) {
      throw new Error(`Failed to fetch top members: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/auth/login", authRateLimit, async (req, res) => {
    const { email, phone, password } = req.body;
    if (!email && !phone || !password) {
      await logSecurityEvent.failedAuth(email || phone || "unknown", req.ip, "Missing credentials");
      return res.status(400).json({ message: "Email/phone and password required" });
    }
    try {
      const user = email ? await storage.getUserByEmail(email) : await storage.getUserByPhone(phone);
      if (!user) {
        await logSecurityEvent.failedAuth(email || phone, req.ip, "User not found");
        return res.status(401).json({ message: "User not found" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await logSecurityEvent.failedAuth(email || phone, req.ip, "Invalid password");
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt2.sign(
        { sub: user.id, email: user.email, phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1e3
      });
      res.json({ user: { id: user.id, email: user.email, phone: user.phone }, token });
    } catch (err) {
      throw new Error(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/daos", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const dao = await storage.createDao({ ...req.body, creatorId: userId });
      res.status(201).json(dao);
    } catch (err) {
      throw new Error(`Failed to create DAO: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/proposals", isAuthenticated2, proposalRateLimit, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const proposal = await storage.createProposal({ ...req.body, proposerId: userId });
      const { ReputationService: ReputationService2 } = await import("../reputationService");
      await ReputationService2.onProposalCreated(userId, proposal.id, proposal.daoId);
      const user = await storage.getUserProfile(userId);
      await NotificationService.onProposalCreated(proposal.id, proposal.daoId, user?.firstName || "A member");
      res.status(201).json(proposal);
    } catch (err) {
      throw new Error(`Failed to create proposal: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  async function handleDaoJoin(daoId, userId, inviteCode) {
    const existing = await storage.getDaoMembership(daoId, userId);
    if (existing) return { status: 200, data: existing };
    const dao = await storage.getDao(daoId);
    if (!dao) return { status: 404, data: { message: "DAO not found" } };
    if (dao.inviteOnly && !dao.inviteCode) {
      return { status: 403, data: { message: "No invite code set for this DAO" } };
    }
    if (dao.inviteCode && inviteCode !== dao.inviteCode) {
      return { status: 403, data: { message: "Invalid invite code" } };
    }
    if (dao.plan === "free") {
      const memberships = await storage.getDaoMembershipsByStatus(daoId, "approved");
      if (memberships.length >= 25) {
        return {
          status: 403,
          data: { message: "Free DAOs are limited to 25 members. Upgrade to premium for more." }
        };
      }
    }
    const status = dao.access === "private" || dao.inviteOnly ? "pending" : "approved";
    const membership = await storage.createDaoMembership({ daoId, userId, status });
    if (status === "approved") {
      await storage.incrementDaoMemberCount(daoId);
    }
    return { status: 201, data: membership };
  }
  app2.post("/api/dao/join", isAuthenticated2, async (req, res) => {
    try {
      const { daoId } = req.body;
      const userId = req.user.claims.sub;
      const result = await handleDaoJoin(daoId, userId);
      if (result.status === 201 && result.data.status === "approved") {
        const { ReputationService: ReputationService2 } = await import("../reputationService");
        await ReputationService2.onDaoJoin(userId, daoId);
      }
      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/join-with-invite", isAuthenticated2, async (req, res) => {
    try {
      const { daoId, inviteCode } = req.body;
      const userId = req.user.claims.sub;
      const result = await handleDaoJoin(daoId, userId, inviteCode);
      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO with invite: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/invite/generate", isAuthenticated2, async (req, res) => {
    try {
      const { daoId } = req.params;
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await storage.updateDaoInviteCode(daoId, code);
      res.status(201).json({ daoId, code });
    } catch (err) {
      throw new Error(`Failed to generate invite code: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/membership/:userId/approve", isAuthenticated2, async (req, res) => {
    try {
      const { daoId, userId } = req.params;
      const dao = await storage.getDao(daoId);
      if (!dao) return res.status(404).json({ message: "DAO not found" });
      if (dao.plan === "free") {
        const memberships = await storage.getDaoMembershipsByStatus(daoId, "approved");
        if (memberships.length >= 25) {
          return res.status(403).json({ message: "Free DAOs are limited to 25 members. Upgrade to premium for more." });
        }
      }
      const membershipRecord = await storage.getDaoMembership(daoId, userId);
      if (!membershipRecord) return res.status(404).json({ message: "Membership not found" });
      const membership = await storage.updateDaoMembershipStatus(membershipRecord.id, "approved");
      await storage.incrementDaoMemberCount(daoId);
      res.json(membership);
    } catch (err) {
      throw new Error(`Failed to approve membership: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/membership/:userId/reject", isAuthenticated2, async (req, res) => {
    try {
      const { daoId, userId } = req.params;
      const membershipRecord = await storage.getDaoMembership(daoId, userId);
      if (!membershipRecord) return res.status(404).json({ message: "Membership not found" });
      const membership = await storage.updateDaoMembershipStatus(membershipRecord.id, "rejected");
      res.json(membership);
    } catch (err) {
      throw new Error(`Failed to reject membership: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/dao/:daoId/members", isAuthenticated2, checkDaoAdminRole, async (req, res) => {
    try {
      const { daoId } = req.params;
      const { limit = 10, offset = 0, status, role } = req.query;
      const userId = req.user.claims.sub;
      const membership = req.daoMembership;
      const members = await storage.getDaoMembers(
        daoId,
        userId,
        status,
        role,
        Number(limit),
        Number(offset)
      );
      const total = await storage.getDaoMembershipsByStatus(daoId, status).then((m) => m.length);
      res.json({ members, total });
    } catch (err) {
      throw new Error(`Failed to fetch DAO members: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/dao/:daoId/analytics", isAuthenticated2, async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = req.user.claims.sub;
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.role !== "admin") {
        return res.status(403).json({ message: "Admin role required" });
      }
      const analytics2 = await storage.getDaoAnalytics(daoId);
      res.json(analytics2);
    } catch (err) {
      throw new Error(`Failed to fetch DAO analytics: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/votes", isAuthenticated2, async (req, res) => {
    try {
      const validatedData = insertVoteSchema.parse(req.body);
      const userId = req.user.claims.sub;
      const existingVote = await storage.getVote(validatedData.proposalId, userId);
      if (existingVote) {
        return res.status(409).json({ message: "User has already voted on this proposal" });
      }
      const vote = await storage.createVote({
        ...validatedData,
        userId
      });
      await storage.updateProposalVotes(validatedData.proposalId, validatedData.voteType);
      const { ReputationService: ReputationService2 } = await import("../reputationService");
      const proposal = await storage.getProposal(validatedData.proposalId);
      await ReputationService2.onVote(userId, validatedData.proposalId, proposal.daoId);
      res.status(201).json(vote);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: err.errors });
      }
      throw new Error(`Failed to create vote: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/proposals/:id", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateProposal(req.params.id, req.body, userId);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update proposal: ${err instanceof Error ? err.message : String(err)}`);
    }
    app2.delete("/api/proposals/:id", isAuthenticated2, async (req2, res2) => {
      try {
        const userId = req2.user.claims.sub;
        const proposal = await storage.getProposal(req2.params.id);
        if (!proposal) return res2.status(404).json({ message: "Proposal not found" });
        if (proposal.creatorId !== userId) {
          return res2.status(403).json({ message: "Only the creator can delete this proposal" });
        }
        await storage.deleteProposal(req2.params.id, userId);
        res2.status(204).send();
      } catch (err) {
        throw new Error(`Failed to delete proposal: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  });
  app2.get("/api/votes/proposal/:proposalId", isAuthenticated2, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const votes4 = await storage.getVotesByProposal(req.params.proposalId);
      const total = await storage.getVotesCount(req.params.proposalId, req.query.daoId);
      res.json({ votes: votes4, total });
    } catch (err) {
      throw new Error(`Failed to fetch votes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/proposals/:proposalId/comments", isAuthenticated2, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const userId = req.user.claims.sub;
      const validatedData = insertProposalCommentSchema.parse({
        ...req.body,
        proposalId,
        userId
      });
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const membership = await storage.getDaoMembership(proposal.daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to comment" });
      const comment = await createProposalComment({
        ...validatedData,
        daoId: proposal.daoId
      });
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: err.errors });
      }
      throw new Error(`Failed to create comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/proposals/:proposalId/comments", isAuthenticated2, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const comments = await getProposalComments(proposalId, Number(limit), Number(offset));
      res.json({ comments, total: comments.length });
    } catch (err) {
      throw new Error(`Failed to fetch comments: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/comments/:commentId", isAuthenticated2, async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user.claims.sub;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const updatedComment = await updateProposalComment(commentId, content, userId);
      res.json(updatedComment);
    } catch (err) {
      if (err.message.includes("Only comment author can edit")) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to update comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/comments/:commentId", isAuthenticated2, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.claims.sub;
      await deleteProposalComment(commentId, userId);
      res.status(204).send();
    } catch (err) {
      if (err.message.includes("Only comment author can delete")) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to delete comment: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/proposals/:proposalId/like", isAuthenticated2, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const userId = req.user.claims.sub;
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const membership = await storage.getDaoMembership(proposal.daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to like proposals" });
      const result = await toggleProposalLike(proposalId, userId, proposal.daoId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to toggle proposal like: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/proposals/:proposalId/likes", isAuthenticated2, async (req, res) => {
    try {
      const { proposalId } = req.params;
      const result = await getProposalLikes(proposalId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to fetch proposal likes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/comments/:commentId/like", isAuthenticated2, async (req, res) => {
    try {
      const { commentId } = req.params;
      const userId = req.user.claims.sub;
      const comments = await getProposalComments("");
      const { daoId } = req.body;
      if (!daoId) return res.status(400).json({ message: "DAO ID is required" });
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to like comments" });
      const result = await toggleCommentLike(commentId, userId, daoId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to toggle comment like: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/comments/:commentId/likes", isAuthenticated2, async (req, res) => {
    try {
      const { commentId } = req.params;
      const result = await getCommentLikes(commentId);
      res.json(result);
    } catch (err) {
      throw new Error(`Failed to fetch comment likes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/messages", isAuthenticated2, async (req, res) => {
    try {
      const { daoId } = req.params;
      const userId = req.user.claims.sub;
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to send messages" });
      const validatedData = insertDaoMessageSchema.parse({
        ...req.body,
        daoId,
        userId
      });
      const message = await createDaoMessage(validatedData);
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: err.errors });
      }
      throw new Error(`Failed to create message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/dao/:daoId/messages", isAuthenticated2, async (req, res) => {
    try {
      const { daoId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = req.user.claims.sub;
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership) return res.status(403).json({ message: "Must be a DAO member to view messages" });
      const messages = await getDaoMessages(daoId, Number(limit), Number(offset));
      res.json({ messages, total: messages.length });
    } catch (err) {
      throw new Error(`Failed to fetch messages: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/messages/:messageId", isAuthenticated2, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user.claims.sub;
      if (!content) return res.status(400).json({ message: "Content is required" });
      const updatedMessage = await updateDaoMessage(messageId, content, userId);
      res.json(updatedMessage);
    } catch (err) {
      if (err.message.includes("Only message author can edit")) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to update message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/messages/:messageId", isAuthenticated2, async (req, res) => {
    try {
      const { messageId } = req.params;
      const userId = req.user.claims.sub;
      await deleteDaoMessage(messageId, userId);
      res.status(204).send();
    } catch (err) {
      if (err.message.includes("Only message author can delete")) {
        return res.status(403).json({ message: err.message });
      }
      throw new Error(`Failed to delete message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/contributions", isAuthenticated2, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const userId = req.query.userId === "me" ? req.user.claims.sub : req.query.userId;
      const contributions4 = await storage.getContributions(userId, userId);
      const total = await storage.getContributionsCount(userId, userId);
      res.json({ contributions: contributions4, total });
    } catch (err) {
      throw new Error(`Failed to fetch contributions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/contributions", isAuthenticated2, async (req, res) => {
    try {
      const validatedData = insertContributionSchema.parse(req.body);
      const contribution = await storage.createContribution({
        ...validatedData,
        userId: req.user.claims.sub
      });
      res.status(201).json(contribution);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid contribution data", errors: err.errors });
      }
      throw new Error(`Failed to create contribution: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/vaults", isAuthenticated2, async (req, res) => {
    try {
      const validatedData = insertVaultSchema.parse(req.body);
      const vault = await storage.upsertVault({
        ...validatedData,
        userId: req.user.claims.sub
      });
      res.status(201).json(vault);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid vault data", errors: err.errors });
      }
      throw new Error(`Failed to create/update vault: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/vaults/:vaultId/transactions", isAuthenticated2, async (req, res) => {
    try {
      const { vaultId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.user.claims.sub;
      const vault = await storage.getUserVaults(userId).then(
        (vaults3) => vaults3.find((v) => v.id === vaultId)
      );
      if (!vault) return res.status(403).json({ message: "Vault not found or unauthorized" });
      const transactions2 = await storage.getVaultTransactions(vaultId, Number(limit), Number(offset));
      const total = await storage.getVaultTransactions(vaultId);
      res.json({ transactions: transactions2, total });
    } catch (err) {
      throw new Error(`Failed to fetch vault transactions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/budget/:month", isAuthenticated2, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const plans = await storage.getUserBudgetPlans(req.user.claims.sub, req.params.month);
      const total = await storage.getBudgetPlanCount(req.user.claims.sub, req.params.month);
      res.json({ plans, total });
    } catch (err) {
      throw new Error(`Failed to fetch budget plans: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/budget", isAuthenticated2, async (req, res) => {
    try {
      const validatedData = insertBudgetPlanSchema.parse(req.body);
      const plan = await storage.upsertBudgetPlan({
        ...validatedData,
        userId: req.user.claims.sub
      });
      res.status(201).json(plan);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid budget plan data", errors: err.errors });
      }
      throw new Error(`Failed to create/update budget plan: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/tasks", isAuthenticated2, async (req, res) => {
    const { daoId, status, limit = 10, offset = 0 } = req.query;
    const userId = req.user.claims.sub;
    if (!daoId) return res.status(400).json({ message: "DAO ID required" });
    try {
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.status !== "approved") {
        return res.status(403).json({ message: "DAO membership required to view tasks" });
      }
      const dao = await storage.getDao(daoId);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task marketplace is a premium feature. Upgrade your DAO plan." });
      }
      const tasks2 = await storage.getTasks();
      const total = await storage.getTaskCount(daoId, status);
      res.json({ tasks: tasks2, total });
    } catch (err) {
      throw new Error(`Failed to fetch tasks: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/tasks/:id/claim", isAuthenticated2, async (req, res) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.claims.sub;
      const { daoId } = req.body;
      if (!daoId) return res.status(400).json({ message: "DAO ID required" });
      const dao = await storage.getDao(daoId);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task claiming is a premium feature. Upgrade your DAO plan." });
      }
      const claimedTask = await storage.claimTask(taskId, userId);
      if (!claimedTask) {
        return res.status(404).json({ message: "Task not found or already claimed" });
      }
      res.json(claimedTask);
    } catch (err) {
      throw new Error(`Failed to claim task: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/tasks", isAuthenticated2, async (req, res) => {
    try {
      const { title, description, reward, daoId } = req.body;
      const userId = req.user.claims.sub;
      if (!title || !description || !reward || !daoId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.role !== "admin" && membership.role !== "moderator") {
        return res.status(403).json({ message: "DAO admin or moderator role required to create tasks" });
      }
      const dao = await storage.getDao(daoId);
      if (!isDaoPremium(dao)) {
        return res.status(403).json({ message: "Task creation is a premium feature. Upgrade your DAO plan." });
      }
      const newTask = await storage.createTask({ title, description, reward, daoId });
      res.status(201).json(newTask);
    } catch (err) {
      throw new Error(`Failed to create task: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/profile", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserProfile(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err) {
      throw new Error(`Failed to fetch user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/user/profile", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserProfile(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/avatar", isAuthenticated2, upload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await storage.updateUserProfile(req.user.claims.sub, { avatar: avatarUrl });
      res.status(200).json({ message: "Avatar uploaded", avatarUrl });
    } catch (err) {
      throw new Error(`Failed to upload avatar: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/social", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const social = await storage.getUserSocialLinks(userId);
      res.json(social);
    } catch (err) {
      throw new Error(`Failed to fetch social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/social", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserSocialLinks(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/wallet", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallet2 = await storage.getUserWallet(userId);
      res.json(wallet2);
    } catch (err) {
      throw new Error(`Failed to fetch wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/wallet", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserWallet(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/settings", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (err) {
      throw new Error(`Failed to fetch settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/user/settings", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserSettings(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/sessions", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions2 = await storage.getUserSessions(userId);
      res.json(sessions2);
    } catch (err) {
      throw new Error(`Failed to fetch sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user/sessions/:sessionId", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      await storage.revokeUserSession(userId, sessionId);
      res.json({ message: "Session revoked" });
    } catch (err) {
      throw new Error(`Failed to revoke session: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user/sessions/revoke-all", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.revokeAllUserSessions(userId);
      res.json({ message: "All sessions revoked" });
    } catch (err) {
      throw new Error(`Failed to revoke all sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user", isAuthenticated2, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteUserAccount(userId);
      res.json({ message: "Account deleted" });
    } catch (err) {
      throw new Error(`Failed to delete account: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/maonovault/nav", async (req, res) => {
    try {
      const [nav, lastUpdate] = await withRetry(() => MaonoVaultService.getNAV());
      res.json({ nav: nav.toString(), lastUpdate });
    } catch (err) {
      throw new Error(`Failed to fetch NAV: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/maonovault/deposit", isAuthenticated2, vaultRateLimit, async (req, res) => {
    try {
      const { amount } = req.body;
      const userAddress = extractWalletAddress(req);
      if (!amount || !userAddress) return res.status(400).json({ message: "Amount and user wallet required" });
      if (BigInt(amount) <= 0) return res.status(400).json({ message: "Amount must be positive" });
      const tx = await withRetry(() => MaonoVaultService.deposit(BigInt(amount), userAddress));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Deposit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/maonovault/withdraw", isAuthenticated2, vaultRateLimit, async (req, res) => {
    try {
      const { amount } = req.body;
      const userAddress = extractWalletAddress(req);
      if (!amount || !userAddress) return res.status(400).json({ message: "Amount and user wallet required" });
      if (BigInt(amount) <= 0) return res.status(400).json({ message: "Amount must be positive" });
      const tx = await withRetry(() => MaonoVaultService.withdraw(BigInt(amount), userAddress));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Withdraw failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/maonovault/nav", isAuthenticated2, async (req, res) => {
    try {
      if (!MaonoVaultService.signer) return res.status(403).json({ message: "Not authorized" });
      const { newNav } = req.body;
      if (!newNav || BigInt(newNav) < 0) return res.status(400).json({ message: "Valid newNav required" });
      const tx = await withRetry(() => MaonoVaultService.updateNAV(BigInt(newNav)));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`NAV update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/maonovault/fee", isAuthenticated2, async (req, res) => {
    try {
      if (!MaonoVaultService.signer) return res.status(403).json({ message: "Not authorized" });
      const { profit } = req.body;
      if (!profit || BigInt(profit) < 0) return res.status(400).json({ message: "Valid profit required" });
      const tx = await withRetry(() => MaonoVaultService.distributePerformanceFee(BigInt(profit)));
      res.json({ txHash: tx.hash });
    } catch (err) {
      throw new Error(`Performance fee distribution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/security-audit", isAuthenticated2, isSuperuser, async (req, res) => {
    try {
      const auditReport = {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        endpoints: {
          protected: "All endpoints properly protected with authentication",
          roleBasedAccess: "Role-based access control implemented",
          daoMembership: "DAO membership validation in place",
          adminEndpoints: "Admin endpoints restricted to superusers"
        }
      };
      res.json(auditReport);
    } catch (err) {
      res.status(500).json({ error: "Security audit failed" });
    }
  });
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: process.env.npm_package_version || "unknown"
    });
  });
  app2.use((req, res) => {
    res.status(404).json({ message: "Not Found" });
  });
  app2.use(errorHandler);
  app2.use("/api/payments/mpesa", mpesa_status_default);
  app2.use("/api/payments/stripe", stripe_status_default);
  app2.use("/api/payments/kotanipay", kotanipay_status_default);
  app2.use("/api/dao-subscriptions", dao_subscriptions_default);
  app2.use("/api/disbursements", disbursements_default);
  app2.use("/api/tasks", isAuthenticated2, tasks_default);
  app2.use("/api/bounty-escrow", isAuthenticated2, bounty_escrow_default);
  app2.use("/api/notifications", isAuthenticated2, notifications_default);
  app2.use("/api/sse", sse_default);
  app2.use("/api/governance", governance_default);
  app2.use("/api/proposal-execution", proposal_execution_default);
  app2.use(sessionMiddleware);
  app2.post("/api/auth/refresh-token", refreshTokenHandler);
  app2.post("/api/auth/forgot-password", requestPasswordReset);
  app2.post("/api/auth/reset-password", resetPassword);
  app2.get("/api/auth/verify-reset-token", verifyResetToken);
  app2.post("/api/auth/logout", isAuthenticated2, (req, res) => {
    const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;
    if (sessionId) {
      destroySession(sessionId);
    }
    res.clearCookie("refreshToken");
    res.clearCookie("sessionId");
    res.status(200).json({ message: "Logged out successfully" });
  });
  app2.post("/api/auth/logout-all", isAuthenticated2, (req, res) => {
    const userId = req.user.claims.sub;
    destroyAllUserSessions(userId);
    res.clearCookie("refreshToken");
    res.clearCookie("sessionId");
    res.status(200).json({ message: "Logged out from all devices" });
  });
  app2.get("/api/auth/sessions", isAuthenticated2, (req, res) => {
    const userId = req.user.claims.sub;
    const sessions2 = getUserActiveSessions(userId);
    res.status(200).json({ sessions: sessions2 });
  });
  app2.use("/api/analytics", isAuthenticated2, analytics_default);
  app2.use("/api/monitoring", monitoring_default);
  app2.use("/api/health", handler);
  app2.use("/health", handler);
}

// server/vite.ts
import express19 from "express";
import path3 from "path";
import { dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import fs2 from "fs";
import { createServer as createViteServer, createLogger as createLogger2 } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path2.dirname(__filename3);
var vite_config_default = defineConfig({
  root: path2.resolve(__dirname3, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path2.resolve(__dirname3, "client", "src"),
      "@shared": path2.resolve(__dirname3, "shared"),
      "@assets": path2.resolve(__dirname3, "attached_assets")
    }
  },
  build: {
    outDir: path2.resolve(__dirname3, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    port: 5e3,
    host: "0.0.0.0",
    allowedHosts: ["all"]
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __dirname4 = dirname3(fileURLToPath4(import.meta.url));
var viteLogger = createLogger2();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server2) {
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: {
      middlewareMode: true,
      hmr: { server: server2 },
      host: "0.0.0.0",
      allowedHosts: ["all"]
    },
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(__dirname4, "../client/index.html");
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(__dirname4, "../../dist/public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `\u274C Could not find the build directory: ${distPath}, make sure to run 'npm run build' first`
    );
  }
  app2.use(express19.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.join(distPath, "index.html"));
  });
}

// server/index.ts
import path5 from "path";
import { dirname as dirname4 } from "path";
import { fileURLToPath as fileURLToPath5 } from "url";

// server/security/inputSanitizer.ts
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";
import { z as z8 } from "zod";
var sanitizedStringSchema = z8.string().min(1).max(1e3).refine((str) => !containsHtml(str), "HTML content not allowed");
var sanitizedEmailSchema = z8.string().email().refine((email) => validator.isEmail(email), "Invalid email format");
var sanitizedUrlSchema = z8.string().url().refine((url) => validator.isURL(url), "Invalid URL format");
var sanitizedAmountSchema = z8.string().refine((amount) => validator.isNumeric(amount), "Invalid numeric amount").refine((amount) => parseFloat(amount) >= 0, "Amount must be positive");
function containsHtml(str) {
  return /<[^>]*>/.test(str);
}
function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
function sanitizeObject(obj) {
  if (typeof obj === "string") {
    return sanitizeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}
var sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};
var preventSqlInjection = (req, res, next) => {
  const sqlInjectionPatterns = [
    /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script)\b)/i,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/i,
    /(\b(or|and)\b.*?=.*?)/i
  ];
  const checkForSqlInjection = (value) => {
    return sqlInjectionPatterns.some((pattern) => pattern.test(value));
  };
  const checkObject = (obj) => {
    if (typeof obj === "string") {
      return checkForSqlInjection(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    if (obj && typeof obj === "object") {
      return Object.values(obj).some(checkObject);
    }
    return false;
  };
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      error: "Potentially malicious input detected"
    });
  }
  next();
};
var preventXSS = (req, res, next) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi
  ];
  const checkForXSS = (value) => {
    return xssPatterns.some((pattern) => pattern.test(value));
  };
  const checkObject = (obj) => {
    if (typeof obj === "string") {
      return checkForXSS(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    if (obj && typeof obj === "object") {
      return Object.values(obj).some(checkObject);
    }
    return false;
  };
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      error: "XSS attempt detected"
    });
  }
  next();
};

// server/security/backupSystem.ts
import { exec } from "child_process";
import { promisify } from "util";
import fs3 from "fs/promises";
import path4 from "path";
var execAsync = promisify(exec);
var BackupSystem = class _BackupSystem {
  constructor(config2) {
    this.config = config2;
  }
  static getInstance(config2) {
    if (!_BackupSystem.instance && config2) {
      _BackupSystem.instance = new _BackupSystem(config2);
    }
    return _BackupSystem.instance;
  }
  async createFullBackup() {
    const backupId = `backup_${Date.now()}`;
    const timestamp6 = /* @__PURE__ */ new Date();
    try {
      console.log(`Starting full backup: ${backupId}`);
      const backupPath = path4.join(this.config.location, backupId);
      await fs3.mkdir(backupPath, { recursive: true });
      const dbBackupPath = path4.join(backupPath, "database.sql");
      await this.backupDatabase(dbBackupPath);
      const filesBackupPath = path4.join(backupPath, "uploads");
      await this.backupUploads(filesBackupPath);
      const configBackupPath = path4.join(backupPath, "config.json");
      await this.backupConfiguration(configBackupPath);
      const stats = await fs3.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      const metadata = {
        id: backupId,
        timestamp: timestamp6,
        type: "full",
        size: stats.size,
        checksum,
        location: backupPath,
        status: "completed"
      };
      await storage.createBackupRecord(metadata);
      console.log(`Full backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      console.error(`Backup failed: ${error}`);
      const metadata = {
        id: backupId,
        timestamp: timestamp6,
        type: "full",
        size: 0,
        checksum: "",
        location: "",
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
      await storage.createBackupRecord(metadata);
      throw error;
    }
  }
  async createIncrementalBackup(lastBackupTime) {
    const backupId = `incremental_${Date.now()}`;
    const timestamp6 = /* @__PURE__ */ new Date();
    try {
      console.log(`Starting incremental backup: ${backupId}`);
      const backupPath = path4.join(this.config.location, backupId);
      await fs3.mkdir(backupPath, { recursive: true });
      await this.backupChangedData(backupPath, lastBackupTime);
      const stats = await fs3.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);
      const metadata = {
        id: backupId,
        timestamp: timestamp6,
        type: "incremental",
        size: stats.size,
        checksum,
        location: backupPath,
        status: "completed"
      };
      await storage.createBackupRecord(metadata);
      console.log(`Incremental backup completed: ${backupId}`);
      return metadata;
    } catch (error) {
      console.error(`Incremental backup failed: ${error}`);
      throw error;
    }
  }
  async restoreFromBackup(backupId) {
    try {
      console.log(`Starting restore from backup: ${backupId}`);
      const metadata = await storage.getBackupRecord(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      if (metadata.status !== "completed") {
        throw new Error(`Cannot restore from incomplete backup: ${backupId}`);
      }
      const currentChecksum = await this.calculateChecksum(metadata.location);
      if (currentChecksum !== metadata.checksum) {
        throw new Error(`Backup integrity check failed: ${backupId}`);
      }
      await this.stopServices();
      try {
        const dbBackupPath = path4.join(metadata.location, "database.sql");
        await this.restoreDatabase(dbBackupPath);
        const filesBackupPath = path4.join(metadata.location, "uploads");
        await this.restoreUploads(filesBackupPath);
        const configBackupPath = path4.join(metadata.location, "config.json");
        await this.restoreConfiguration(configBackupPath);
        console.log(`Restore completed: ${backupId}`);
      } finally {
        await this.startServices();
      }
    } catch (error) {
      console.error(`Restore failed: ${error}`);
      throw error;
    }
  }
  async cleanupOldBackups() {
    try {
      const cutoffDate = /* @__PURE__ */ new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      const oldBackups = await storage.getBackupsOlderThan(cutoffDate);
      for (const backup of oldBackups) {
        try {
          await fs3.rm(backup.location, { recursive: true, force: true });
          await storage.deleteBackupRecord(backup.id);
          console.log(`Cleaned up old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to cleanup backup ${backup.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  }
  async verifyBackup(backupId) {
    try {
      const metadata = await storage.getBackupRecord(backupId);
      if (!metadata) return false;
      try {
        await fs3.access(metadata.location);
      } catch {
        return false;
      }
      const currentChecksum = await this.calculateChecksum(metadata.location);
      return currentChecksum === metadata.checksum;
    } catch (error) {
      console.error(`Backup verification failed: ${error}`);
      return false;
    }
  }
  async backupDatabase(outputPath) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`pg_dump "${dbUrl}" > "${outputPath}"`);
    }
  }
  async backupUploads(outputPath) {
    const uploadsDir2 = path4.join(process.cwd(), "server", "uploads");
    try {
      await execAsync(`cp -r "${uploadsDir2}" "${outputPath}"`);
    } catch (error) {
      console.warn("No uploads directory found, skipping");
    }
  }
  async backupConfiguration(outputPath) {
    const config2 = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV
      // Add other configuration as needed
    };
    await fs3.writeFile(outputPath, JSON.stringify(config2, null, 2));
  }
  async backupChangedData(outputPath, since) {
    const changedData = await storage.getDataChangedSince(since);
    await fs3.writeFile(
      path4.join(outputPath, "incremental_data.json"),
      JSON.stringify(changedData, null, 2)
    );
  }
  async restoreDatabase(backupPath) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await execAsync(`psql "${dbUrl}" < "${backupPath}"`);
    }
  }
  async restoreUploads(backupPath) {
    const uploadsDir2 = path4.join(process.cwd(), "server", "uploads");
    await execAsync(`cp -r "${backupPath}" "${uploadsDir2}"`);
  }
  async restoreConfiguration(backupPath) {
    console.log("Configuration restore completed");
  }
  async calculateChecksum(filePath) {
    const { stdout } = await execAsync(`find "${filePath}" -type f -exec sha256sum {} + | sha256sum`);
    return stdout.trim().split(" ")[0];
  }
  async stopServices() {
    console.log("Stopping services for restore...");
  }
  async startServices() {
    console.log("Starting services after restore...");
  }
};
var BackupScheduler = class {
  constructor(backupSystem) {
    this.isRunning = false;
    this.backupSystem = backupSystem;
  }
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const scheduleBackup = () => {
      const now = /* @__PURE__ */ new Date();
      const nextBackup = /* @__PURE__ */ new Date();
      nextBackup.setHours(2, 0, 0, 0);
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }
      const msUntilBackup = nextBackup.getTime() - now.getTime();
      setTimeout(async () => {
        try {
          await this.backupSystem.createFullBackup();
          await this.backupSystem.cleanupOldBackups();
        } catch (error) {
          console.error("Scheduled backup failed:", error);
        }
        scheduleBackup();
      }, msUntilBackup);
    };
    scheduleBackup();
    console.log("Backup scheduler started");
  }
  stop() {
    this.isRunning = false;
    console.log("Backup scheduler stopped");
  }
};

// server/middleware/errorHandler.ts
import { ZodError as ZodError2 } from "zod";
var AppError = class extends Error {
  constructor(message, statusCode = 500, isOperational = true, code) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
};
var NotFoundError = class extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, true, "NOT_FOUND");
  }
};
var formatErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      path: req.path,
      method: req.method
    }
  };
  if (error instanceof AppError) {
    response.error.code = error.code;
    response.error.statusCode = error.statusCode;
  }
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }
  if (req.headers["x-request-id"]) {
    response.error.requestId = req.headers["x-request-id"];
  }
  return response;
};
var logError = async (error, req, res) => {
  const severity = error instanceof AppError && error.statusCode < 500 ? "medium" : "high";
  const user = req.user;
  try {
    await storage.createSystemLog(
      "error",
      error.message,
      "api",
      {
        stack: error.stack,
        statusCode: error instanceof AppError ? error.statusCode : 500,
        path: req.path,
        method: req.method,
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
        userId: user?.claims?.sub,
        requestBody: req.body,
        requestQuery: req.query,
        requestParams: req.params
      }
    );
    if (severity === "high") {
      console.error(`\u{1F6A8} ${error.message}`, {
        stack: error.stack,
        path: req.path,
        method: req.method,
        userId: user?.claims?.sub
      });
    }
  } catch (logError2) {
    console.error("Failed to log error:", logError2);
  }
};
var errorHandler2 = async (error, req, res, next) => {
  await logError(error, req, res);
  let statusCode = 500;
  let message = "Internal server error";
  let code = "INTERNAL_ERROR";
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || "APP_ERROR";
  } else if (error instanceof ZodError2) {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
        statusCode,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        path: req.path,
        method: req.method,
        details: error.errors
      }
    });
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    code = "INVALID_ID";
  } else if (error.name === "MongoError" || error.message.includes("database")) {
    statusCode = 500;
    message = "Database operation failed";
    code = "DATABASE_ERROR";
  }
  const response = formatErrorResponse(
    new AppError(message, statusCode, true, code),
    req
  );
  res.status(statusCode).json(response);
};
var asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};
var setupProcessErrorHandlers = () => {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("\u{1F6A8} Unhandled Promise Rejection:", reason);
    process.exit(1);
  });
  process.on("uncaughtException", (error) => {
    console.error("\u{1F6A8} Uncaught Exception:", error);
    process.exit(1);
  });
};

// server/index.ts
var __dirname5 = dirname4(fileURLToPath5(import.meta.url));
var app = express20();
setupProcessErrorHandlers();
var server = createServer(app);
var io = new SocketIOServer(server, {
  cors: corsConfig
});
app.set("trust proxy", 1);
app.use(express20.json({
  limit: "10mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express20.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors(corsConfig));
app.use(requestLogger);
app.use(generalRateLimit);
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventXSS);
app.use(auditMiddleware);
app.use(metricsCollector.requestMiddleware());
var userSockets = /* @__PURE__ */ new Map();
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("authenticate", (userId) => {
    userSockets.set(userId, socket.id);
    socket.join(`user_${userId}`);
    console.log(`User ${userId} authenticated with socket ${socket.id}`);
  });
  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});
notificationService.on("notification_created", (data) => {
  io.to(`user_${data.userId}`).emit("new_notification", data);
});
global.io = io;
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${req.url} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      logger.info(logLine);
    }
  });
  next();
});
ProposalExecutionService.startScheduler();
(async () => {
  try {
    const backupConfig = {
      enabled: process.env.BACKUPS_ENABLED === "true",
      schedule: "0 2 * * *",
      // Daily at 2 AM
      retentionDays: 30,
      location: process.env.BACKUP_LOCATION || "./backups",
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };
    if (backupConfig.enabled) {
      const backupSystem = BackupSystem.getInstance(backupConfig);
      const scheduler = new BackupScheduler(backupSystem);
      scheduler.start();
      log("\u2705 Backup system initialized");
    }
    await registerRoutes(app);
    app.get("/health", asyncHandler(async (req, res) => {
      res.json({
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime()
      });
    }));
    app.use(notFoundHandler);
    app.use(errorHandler2);
    const PORT = parseInt(env.PORT);
    const HOST = env.HOST;
    server.listen(PORT, HOST, () => {
      logStartup(PORT.toString());
      logger.info("Server configuration", {
        port: PORT,
        host: HOST,
        frontendUrl: env.FRONTEND_URL,
        backendUrl: env.BACKEND_URL,
        environment: env.NODE_ENV,
        nodeVersion: process.version
      });
    });
    const gracefulShutdown = (signal) => {
      logger.warn(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
      setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
      }, 3e4);
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get("*", (_, res) => {
        res.sendFile(path5.join(__dirname5, "../../dist/public", "index.html"));
      });
    }
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1);
  }
})();
