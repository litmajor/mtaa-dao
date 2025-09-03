var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express5 from "express";

// server/routes.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express3 from "express";

// server/db.ts
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  billingHistory: () => billingHistory,
  budgetPlans: () => budgetPlans,
  budgetPlansRelations: () => budgetPlansRelations,
  chainInfo: () => chainInfo,
  chains: () => chains,
  config: () => config,
  contributions: () => contributions,
  contributionsRelations: () => contributionsRelations,
  createSessionSchema: () => createSessionSchema,
  daoMemberships: () => daoMemberships,
  daoMembershipsRelations: () => daoMembershipsRelations,
  daos: () => daos,
  daosRelations: () => daosRelations,
  insertBudgetPlanSchema: () => insertBudgetPlanSchema,
  insertContributionSchema: () => insertContributionSchema,
  insertDaoMembershipSchema: () => insertDaoMembershipSchema,
  insertDaoSchema: () => insertDaoSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertProposalSchema: () => insertProposalSchema,
  insertReferralRewardSchema: () => insertReferralRewardSchema,
  insertTaskHistorySchema: () => insertTaskHistorySchema,
  insertTaskSchema: () => insertTaskSchema,
  insertUserSchema: () => insertUserSchema,
  insertVaultSchema: () => insertVaultSchema,
  insertVoteSchema: () => insertVoteSchema,
  insertWalletTransactionSchema: () => insertWalletTransactionSchema,
  logs: () => logs,
  notifications: () => notifications,
  proposals: () => proposals,
  proposalsRelations: () => proposalsRelations,
  referralRewards: () => referralRewards,
  referralRewardsRelations: () => referralRewardsRelations,
  roles: () => roles,
  sessionSchema: () => sessionSchema,
  sessions: () => sessions,
  taskHistory: () => taskHistory,
  tasks: () => tasks,
  users: () => users,
  usersRelations: () => usersRelations,
  vaults: () => vaults,
  vaultsRelations: () => vaultsRelations,
  votes: () => votes,
  votesRelations: () => votesRelations,
  walletTransactions: () => walletTransactions,
  walletTransactionsRelations: () => walletTransactionsRelations
});
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
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
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: decimal("reward", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("open"),
  // open, claimed, completed
  claimerId: varchar("claimer_id").references(() => users.id),
  claimedBy: varchar("claimed_by").references(() => users.id),
  // legacy, keep for now
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
  banReason: text("ban_reason"),
  isSuperUser: boolean("is_super_user").default(false)
  // for superuser dashboard access
});
var daos = pgTable("daos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text("description"),
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
  featureOrder: integer("feature_order").default(0)
  // order of featured DAOs
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
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposalType: varchar("proposal_type").default("general"),
  // general, budget, emergency
  tags: jsonb("tags").default([]),
  // e.g., ["infrastructure", "education"]
  imageUrl: varchar("image_url"),
  proposer: varchar("proposer").references(() => users.id).notNull(),
  proposerId: varchar("proposer_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  status: varchar("status").default("active"),
  // draft, active, resolved, expired
  voteStartTime: timestamp("vote_start_time").defaultNow(),
  voteEndTime: timestamp("vote_end_time").notNull(),
  quorumRequired: integer("quorum_required").default(100),
  yesVotes: integer("yes_votes").default(0),
  noVotes: integer("no_votes").default(0),
  abstainVotes: integer("abstain_votes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isFeatured: boolean("is_featured").default(false)
  // for featured proposals on DAO page
});
var votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  voteType: varchar("vote_type").notNull(),
  // yes, no, abstain
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.0"),
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
var vaults = pgTable("vaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currency: varchar("currency").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  monthlyGoal: decimal("monthly_goal", { precision: 10, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
  // Note: no need for a vault name, just a single vault per user
  // This simplifies the vault management and aligns with the personal finance focus
  // Users can have multiple vaults for different currencies if needed
  // Each vault can have its own budget and spending limits
  // This allows for better financial management and tracking
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
  banReason: text("ban_reason"),
  // reason for banning, if applicable
  isElder: boolean("is_elder").default(false),
  // for elder members with special privileges
  isAdmin: boolean("is_admin").default(false)
  // for DAO admins with full control
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
  description: text("description"),
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
  action: text("action").notNull(),
  // e.g., "create_dao", "vote", "contribute"
  details: jsonb("details"),
  // additional details about the action
  createdAt: timestamp("created_at").defaultNow()
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
  logs: many(logs)
}));
var daosRelations = relations(daos, ({ one, many }) => ({
  creator: one(users, {
    fields: [daos.creatorId],
    references: [users.id]
  }),
  memberships: many(daoMemberships),
  proposals: many(proposals)
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
  votes: many(votes)
}));
var votesRelations = relations(votes, ({ one }) => ({
  proposal: one(proposals, {
    fields: [votes.proposalId],
    references: [proposals.id]
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id]
  })
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
  message: text("message").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var taskHistory = pgTable("task_history", {
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
var insertTaskHistorySchema = createInsertSchema(taskHistory);

// server/db.ts
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, inArray, or } from "drizzle-orm";
import { and, desc } from "drizzle-orm";
function isDaoPremium(dao) {
  if (!dao || !dao.plan) return false;
  return dao.plan === "premium";
}
var DatabaseStorage = class {
  async incrementDaoMemberCount(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const dao = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao[0]) throw new Error("DAO not found");
    const newCount = (dao[0].memberCount || 0) + 1;
    const result = await db.update(daos).set({ memberCount: newCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq(daos.id, daoId)).returning();
    return result[0];
  }
  // --- Admin Functions ---
  async getAllDaos({ limit = 10, offset = 0 } = {}) {
    return await db.select().from(daos).orderBy(desc(daos.createdAt)).limit(limit).offset(offset);
  }
  async getDaoCount() {
    const result = await db.select().from(daos);
    return result.length;
  }
  async getAllUsers({ limit = 10, offset = 0 } = {}) {
    return await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }
  async getUserCount() {
    const result = await db.select().from(users);
    return result.length;
  }
  async getPlatformFeeInfo() {
    const keys = [
      "vaultDisbursementFee",
      "offrampWithdrawalFee",
      "bulkPayoutFee",
      "stakingYieldFee",
      "platformFeeCurrency"
    ];
    const configRows = await db.select().from(config).where(inArray(config.key, keys));
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
  async getSystemLogs({ limit = 10, offset = 0 } = {}) {
    return await db.select().from(logs).orderBy(desc(logs.createdAt)).limit(limit).offset(offset);
  }
  async updateTask(id, data, userId) {
    const task = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task[0]) throw new Error("Task not found");
    const membership = await this.getDaoMembership(task[0].daoId, userId);
    if (!membership || membership.role !== "admin") throw new Error("Only DAO admins can update tasks");
    const result = await db.update(tasks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(tasks.id, id)).returning();
    if (!result[0]) throw new Error("Failed to update task");
    return result[0];
  }
  async getTaskCount(daoId, status) {
    if (!daoId) throw new Error("DAO ID required");
    let whereClause;
    if (status) {
      whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
    } else {
      whereClause = eq(tasks.daoId, daoId);
    }
    const result = await db.select().from(tasks).where(whereClause);
    return result.length;
  }
  async getLogCount() {
    const result = await db.select().from(logs);
    return result.length;
  }
  async getBillingCount() {
    const result = await db.select().from(billingHistory);
    return result.length;
  }
  async getChainInfo() {
    const result = await db.select().from(chains).where(eq(chains.id, 1));
    if (!result[0]) throw new Error("Chain not found");
    return {
      chainId: result[0].id,
      name: result[0].name,
      rpcUrl: result[0].rpcUrl
    };
  }
  async getTopMembers({ limit = 10 } = {}) {
    const allContributions = await db.select().from(contributions);
    const counts = {};
    allContributions.forEach((c) => {
      if (c.userId) counts[c.userId] = (counts[c.userId] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([userId, count]) => ({ userId, count }));
  }
  async createUser(userData) {
    const allowed = (({ firstName, lastName, email, phone, googleId, telegramId }) => ({ firstName, lastName, email, phone, googleId, telegramId }))(userData);
    allowed.createdAt = /* @__PURE__ */ new Date();
    allowed.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(users).values(allowed).returning();
    if (!result[0]) throw new Error("Failed to create user");
    return result[0];
  }
  async loginUser(email) {
    return this.getUserByEmail(email);
  }
  async getUserByEmail(email) {
    if (!email) throw new Error("Email required");
    const result = await db.select().from(users).where(eq(users.email, email));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserByPhone(phone) {
    if (!phone) throw new Error("Phone required");
    const result = await db.select().from(users).where(eq(users.phone, phone));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserById(userId) {
    if (!userId) throw new Error("User ID required");
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getUserByEmailOrPhone(emailOrPhone) {
    if (!emailOrPhone) throw new Error("Email or phone required");
    const result = await db.select().from(users).where(
      or(eq(users.email, emailOrPhone), eq(users.phone, emailOrPhone))
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
    const result = await db.update(users).set(allowed).where(eq(users.id, userId)).returning();
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
    const result = await db.update(users).set(allowed).where(eq(users.id, userId)).returning();
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
    const result = await db.update(users).set(allowed).where(eq(users.id, userId)).returning();
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
    const result = await db.update(users).set(allowed).where(eq(users.id, userId)).returning();
    if (!result[0]) throw new Error("Failed to update settings");
    return result[0];
  }
  async getUserSessions(userId) {
    const result = await db.select().from(sessions).where(eq(sessions.userId, userId));
    return result;
  }
  async revokeUserSession(userId, sessionId) {
    if (!userId || !sessionId) throw new Error("User ID and session ID required");
    const result = await db.delete(sessions).where(
      and(eq(sessions.userId, userId), eq(sessions.id, sessionId))
    );
    if (!result) throw new Error("Session not found or already revoked");
  }
  async deleteUserAccount(userId) {
    await db.delete(users).where(eq(users.id, userId));
  }
  async createWalletTransaction(data) {
    if (!data.amount || !data.currency || !data.type || !data.status || !data.provider) {
      throw new Error("Missing required wallet transaction fields");
    }
    data.createdAt = /* @__PURE__ */ new Date();
    data.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(walletTransactions).values(data).returning();
    if (!result[0]) throw new Error("Failed to create wallet transaction");
    return result[0];
  }
  // Export a singleton instance for use in routes and elsewhere
  async getBudgetPlanCount(userId, month) {
    if (!userId || !month) throw new Error("User ID and month required");
    const result = await db.select().from(budgetPlans).where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.month, month)));
    return result.length;
  }
  async createDao(dao) {
    if (!dao.name || !dao.creatorId) throw new Error("Name and creatorId required");
    dao.createdAt = /* @__PURE__ */ new Date();
    dao.updatedAt = /* @__PURE__ */ new Date();
    dao.memberCount = 1;
    const result = await db.insert(daos).values(dao).returning();
    if (!result[0]) throw new Error("Failed to create DAO");
    await this.createDaoMembership({ daoId: result[0].id, userId: dao.creatorId, status: "approved", role: "admin" });
    return result[0];
  }
  async setDaoInviteCode(daoId, code) {
    if (!code) throw new Error("Invite code required");
    const result = await db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getDaoByInviteCode(code) {
    if (!code) throw new Error("Invite code required");
    const result = await db.select().from(daos).where(eq(daos.inviteCode, code));
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getUserReferralStats(userId) {
    if (!userId) throw new Error("User ID required");
    const referred = await db.select().from(users).where(eq(users.referredBy, userId));
    return {
      userId,
      referredCount: referred.length,
      referredUsers: referred.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))
    };
  }
  async getReferralLeaderboard(limit = 10) {
    const allUsers = await db.select().from(users);
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
    const leaderboard = Object.entries(counts).map(([userId, { count, user }]) => ({ userId, count, user })).sort((a, b) => b.count - a.count).slice(0, limit);
    return leaderboard;
  }
  async getUser(userId) {
    if (!userId) throw new Error("User ID required");
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }
  async getDAOStats() {
    const daosList = await db.select().from(daos);
    const memberships = await db.select().from(daoMemberships);
    const activeDaoIds = new Set(memberships.map((m) => m.daoId));
    return {
      daoCount: daosList.length,
      memberCount: memberships.length,
      activeDaoCount: activeDaoIds.size
    };
  }
  async getProposals() {
    return await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  }
  async getProposal(id) {
    if (!id) throw new Error("Proposal ID required");
    const result = await db.select().from(proposals).where(eq(proposals.id, id));
    if (!result[0]) throw new Error("Proposal not found");
    return result[0];
  }
  async createProposal(proposal) {
    if (!proposal.title || !proposal.daoId) throw new Error("Proposal must have title and daoId");
    proposal.createdAt = /* @__PURE__ */ new Date();
    proposal.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(proposals).values(proposal).returning();
    if (!result[0]) throw new Error("Failed to create proposal");
    return result[0];
  }
  async updateProposal(id, data, userId) {
    if (!id || !data.title) throw new Error("Proposal ID and title required");
    const proposal = await this.getProposal(id);
    if (proposal.userId !== userId) throw new Error("Only proposal creator can update");
    const result = await db.update(proposals).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(proposals.id, id)).returning();
    if (!result[0]) throw new Error("Failed to update proposal");
    return result[0];
  }
  async deleteProposal(id, userId) {
    const proposal = await this.getProposal(id);
    const membership = await this.getDaoMembership(proposal.daoId, userId);
    if (proposal.userId !== userId && (!membership || membership.role !== "admin")) {
      throw new Error("Only proposal creator or DAO admin can delete");
    }
    await db.delete(proposals).where(eq(proposals.id, id));
  }
  async updateProposalVotes(proposalId, voteType) {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error("Proposal not found");
    const field = voteType === "yes" ? "yesVotes" : "noVotes";
    const update = { updatedAt: /* @__PURE__ */ new Date() };
    update[field] = (proposal[field] || 0) + 1;
    const result = await db.update(proposals).set(update).where(eq(proposals.id, proposalId)).returning();
    if (!result[0]) throw new Error("Failed to update proposal votes");
    return result[0];
  }
  async getVote(proposalId, userId) {
    if (!proposalId || !userId) throw new Error("Proposal ID and User ID required");
    const result = await db.select().from(votes).where(and(eq(votes.proposalId, proposalId), eq(votes.userId, userId)));
    if (!result[0]) throw new Error("Vote not found");
    return result[0];
  }
  async createVote(vote) {
    if (!vote.proposalId || !vote.userId) throw new Error("Vote must have proposalId and userId");
    vote.createdAt = /* @__PURE__ */ new Date();
    vote.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(votes).values(vote).returning();
    if (!result[0]) throw new Error("Failed to create vote");
    return result[0];
  }
  async getVotesByProposal(proposalId) {
    if (!proposalId) throw new Error("Proposal ID required");
    return await db.select().from(votes).where(eq(votes.proposalId, proposalId));
  }
  async getContributions(userId, daoId) {
    let whereClause = void 0;
    if (userId && daoId) {
      return await db.select().from(contributions).where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId))).orderBy(desc(contributions.createdAt));
    } else if (userId) {
      return await db.select().from(contributions).where(eq(contributions.userId, userId)).orderBy(desc(contributions.createdAt));
    } else if (daoId) {
      return await db.select().from(contributions).where(eq(contributions.daoId, daoId)).orderBy(desc(contributions.createdAt));
    } else {
      return await db.select().from(contributions).orderBy(desc(contributions.createdAt));
    }
  }
  async getContributionsCount(userId, daoId) {
    if (!userId || !daoId) throw new Error("User ID and DAO ID required");
    const result = await db.select().from(contributions).where(and(eq(contributions.userId, userId), eq(contributions.daoId, daoId)));
    return result.length;
  }
  async getVotesCount(daoId, proposalId) {
    if (!proposalId || !daoId) throw new Error("User ID and DAO ID required");
    const result = await db.select().from(votes).where(and(eq(votes.userId, proposalId), eq(votes.daoId, daoId)));
    return result.length;
  }
  async getVotesByUserAndDao(userId, daoId) {
    if (!userId || !daoId) throw new Error("User ID and DAO ID required");
    return await db.select().from(votes).where(and(eq(votes.userId, userId), eq(votes.daoId, daoId)));
  }
  async createContribution(contribution) {
    if (!contribution.userId || !contribution.daoId) throw new Error("Contribution must have userId and daoId");
    contribution.createdAt = /* @__PURE__ */ new Date();
    contribution.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(contributions).values(contribution).returning();
    if (!result[0]) throw new Error("Failed to create contribution");
    return result[0];
  }
  async getUserContributionStats(userId) {
    if (!userId) throw new Error("User ID required");
    const all = await db.select().from(contributions).where(eq(contributions.userId, userId));
    const byDao = {};
    all.forEach((c) => {
      const daoId = c.daoId;
      if (daoId) byDao[daoId] = (byDao[daoId] || 0) + 1;
    });
    return { userId, total: all.length, byDao };
  }
  async getUserVaults(userId) {
    if (!userId) throw new Error("User ID required");
    return await db.select().from(vaults).where(eq(vaults.userId, userId));
  }
  async upsertVault(vault) {
    if (!vault.id) throw new Error("Vault must have id");
    vault.updatedAt = /* @__PURE__ */ new Date();
    const updated = await db.update(vaults).set(vault).where(eq(vaults.id, vault.id)).returning();
    if (updated[0]) return updated[0];
    vault.createdAt = /* @__PURE__ */ new Date();
    const inserted = await db.insert(vaults).values(vault).returning();
    if (!inserted[0]) throw new Error("Failed to upsert vault");
    return inserted[0];
  }
  async getVaultTransactions(vaultId, limit = 10, offset = 0) {
    if (!vaultId) throw new Error("Vault ID required");
    return await db.select().from(walletTransactions).where(eq(walletTransactions.vaultId, vaultId)).orderBy(desc(walletTransactions.createdAt)).limit(limit).offset(offset);
  }
  async getUserBudgetPlans(userId, month) {
    if (!userId || !month) throw new Error("User ID and month required");
    return await db.select().from(budgetPlans).where(and(eq(budgetPlans.userId, userId), eq(budgetPlans.month, month)));
  }
  async upsertBudgetPlan(plan) {
    if (!plan.id) throw new Error("Budget plan must have id");
    plan.updatedAt = /* @__PURE__ */ new Date();
    const updated = await db.update(budgetPlans).set(plan).where(eq(budgetPlans.id, plan.id)).returning();
    if (updated[0]) return updated[0];
    plan.createdAt = /* @__PURE__ */ new Date();
    const inserted = await db.insert(budgetPlans).values(plan).returning();
    if (!inserted[0]) throw new Error("Failed to upsert budget plan");
    return inserted[0];
  }
  async updateDaoInviteCode(daoId, code) {
    if (!daoId || !code) throw new Error("DAO ID and code required");
    const result = await db.update(daos).set({ inviteCode: code, updatedAt: /* @__PURE__ */ new Date() }).where(eq(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("Failed to update invite code");
    return result[0];
  }
  async getTasks(daoId, status) {
    let whereClause;
    if (daoId && status) {
      whereClause = and(eq(tasks.daoId, daoId), eq(tasks.status, status));
    } else if (daoId) {
      whereClause = eq(tasks.daoId, daoId);
    } else if (status) {
      whereClause = eq(tasks.status, status);
    }
    if (whereClause) {
      return await db.select().from(tasks).where(whereClause).orderBy(desc(tasks.createdAt));
    }
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }
  async createTask(task) {
    if (!task.title || !task.daoId) throw new Error("Task must have title and daoId");
    task.createdAt = /* @__PURE__ */ new Date();
    task.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(tasks).values(task).returning();
    if (!result[0]) throw new Error("Failed to create task");
    return result[0];
  }
  async claimTask(taskId, userId) {
    if (!taskId || !userId) throw new Error("Task ID and User ID required");
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task[0]) throw new Error("Task not found");
    if (task[0].claimedBy) throw new Error("Task already claimed");
    const result = await db.update(tasks).set({ claimedBy: userId, status: "claimed", updatedAt: /* @__PURE__ */ new Date() }).where(eq(tasks.id, taskId)).returning();
    if (!result[0]) throw new Error("Failed to claim task");
    return result[0];
  }
  async getDao(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const result = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!result[0]) throw new Error("DAO not found");
    return result[0];
  }
  async getDaoMembership(daoId, userId) {
    if (!daoId || !userId) throw new Error("DAO ID and User ID required");
    const result = await db.select().from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.userId, userId)));
    if (!result[0]) throw new Error("Membership not found");
    return result[0];
  }
  async getDaoMembers(daoId, userId, status, role, limit = 10, offset = 0) {
    if (!daoId) throw new Error("DAO ID required");
    let whereClause = eq(daoMemberships.daoId, daoId);
    if (userId) whereClause = and(whereClause, eq(daoMemberships.userId, userId));
    if (status) whereClause = and(whereClause, eq(daoMemberships.status, status));
    if (role) whereClause = and(whereClause, eq(daoMemberships.role, role));
    return await db.select().from(daoMemberships).where(whereClause).orderBy(desc(daoMemberships.createdAt)).limit(limit).offset(offset);
  }
  async createDaoMembership(args) {
    if (!args.daoId || !args.userId) throw new Error("Membership must have daoId and userId");
    args.createdAt = /* @__PURE__ */ new Date();
    args.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(daoMemberships).values(args).returning();
    if (!result[0]) throw new Error("Failed to create membership");
    return result[0];
  }
  async getDaoMembershipsByStatus(daoId, status) {
    if (!daoId || !status) throw new Error("DAO ID and status required");
    return await db.select().from(daoMemberships).where(and(eq(daoMemberships.daoId, daoId), eq(daoMemberships.status, status)));
  }
  async updateDaoMembershipStatus(membershipId, status) {
    const result = await db.update(daoMemberships).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(daoMemberships.id, membershipId)).returning();
    return result[0];
  }
  async getDaoPlan(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const result = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!result[0]) throw new Error("DAO not found");
    return result[0].plan;
  }
  async setDaoPlan(daoId, plan, planExpiresAt) {
    if (!daoId || !plan) throw new Error("DAO ID and plan required");
    const result = await db.update(daos).set({ plan, planExpiresAt, updatedAt: /* @__PURE__ */ new Date() }).where(eq(daos.id, daoId)).returning();
    if (!result[0]) throw new Error("Failed to set DAO plan");
    return result[0];
  }
  async getDaoBillingHistory(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    return await db.select().from(billingHistory).where(eq(billingHistory.daoId, daoId)).orderBy(desc(billingHistory.createdAt));
  }
  async getAllDaoBillingHistory() {
    if (!billingHistory) throw new Error("Billing history table not found");
    return await db.select().from(billingHistory).orderBy(desc(billingHistory.createdAt));
  }
  async addDaoBillingHistory(entry) {
    if (!entry.daoId || !entry.amount || !entry.type) throw new Error("Billing history must have daoId, amount, and type");
    entry.createdAt = /* @__PURE__ */ new Date();
    entry.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(billingHistory).values(entry).returning();
    if (!result[0]) throw new Error("Failed to add billing history");
    return result[0];
  }
  async getDaoAnalytics(daoId) {
    if (!daoId) throw new Error("DAO ID required");
    const [dao, members, proposals2, contributions2, vaults2] = await Promise.all([
      this.getDao(daoId),
      this.getDaoMembershipsByStatus(daoId, "approved"),
      this.getProposals().then(
        (proposals3) => proposals3.filter((p) => p.daoId === daoId && p.status === "active")
      ),
      this.getContributions(void 0, daoId),
      this.getUserVaults(daoId)
    ]);
    const recentActivity = [
      ...proposals2.map((p) => ({ type: "proposal", createdAt: p.createdAt })),
      ...contributions2.map((c) => ({ type: "contribution", createdAt: c.createdAt })),
      ...members.map((m) => ({ type: "membership", createdAt: m.createdAt }))
    ].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    ).slice(0, 10);
    const vaultBalance = vaults2.reduce((sum, v) => sum + (parseFloat(v.balance) || 0), 0);
    return {
      memberCount: members.length,
      activeProposals: proposals2.length,
      totalContributions: contributions2.length,
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
    const contributions2 = await this.getContributions(userId, daoId);
    if (contributions2 && contributions2.length > 0) return true;
    if (typeof this.getVotesByUserAndDao === "function") {
      const votes2 = await this.getVotesByUserAndDao(userId, daoId);
      if (votes2 && votes2.length > 0) return true;
    }
    return false;
  }
  async revokeAllUserSessions(userId) {
    if (!userId) throw new Error("User ID required");
    await db.delete(sessions).where(eq(sessions.userId, userId));
    process.stdout.write(`Revoked all sessions for user ${userId}
`);
  }
  async createNotification(notification) {
    notification.createdAt = /* @__PURE__ */ new Date();
    notification.updatedAt = /* @__PURE__ */ new Date();
    const result = await db.insert(notifications).values(notification).returning();
    if (!result[0]) throw new Error("Failed to create notification");
    return result[0];
  }
  async getUserNotifications(userId, read, limit = 10, offset = 0) {
    let whereClause = eq(notifications.userId, userId);
    if (read !== void 0) whereClause = and(whereClause, eq(notifications.read, read));
    return await db.select().from(notifications).where(whereClause).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset);
  }
  async getTaskHistory(taskId, limit = 10, offset = 0) {
    return await db.select().from(taskHistory).where(eq(taskHistory.taskId, taskId)).orderBy(desc(taskHistory.createdAt)).limit(limit).offset(offset);
  }
};
var storage = new DatabaseStorage();

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
  web3;
  account;
  chainId;
  networkConfig;
  permissionCheck;
  contributionLogger;
  billingLogger;
  priceOracle;
  transactionCache = /* @__PURE__ */ new Map();
  constructor(privateKey, networkConfig, permissionCheck, contributionLogger, billingLogger, priceOracle) {
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
  static CELO_MAINNET = new _NetworkConfig(
    "https://forno.celo.org",
    42220,
    "Celo Mainnet",
    "https://explorer.celo.org"
  );
  static CELO_ALFAJORES = new _NetworkConfig(
    "https://alfajores-forno.celo-testnet.org",
    44787,
    "Celo Alfajores Testnet",
    "https://alfajores-blockscout.celo-testnet.org"
  );
  static ETHEREUM_MAINNET = new _NetworkConfig(
    "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
    1,
    "Ethereum Mainnet",
    "https://etherscan.io"
  );
  static POLYGON_MAINNET = new _NetworkConfig(
    "https://polygon-rpc.com",
    137,
    "Polygon Mainnet",
    "https://polygonscan.com"
  );
  static ARBITRUM_ONE = new _NetworkConfig(
    "https://arb1.arbitrum.io/rpc",
    42161,
    "Arbitrum One",
    "https://arbiscan.io"
  );
  rpcUrl;
  chainId;
  name;
  explorerUrl;
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
  wallet;
  treasuryAddress;
  allowedTokens;
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
  wallet;
  maxDailyVolume;
  maxSingleTransfer;
  dailyVolumeTracking = /* @__PURE__ */ new Map();
  constructor(wallet2, maxDailyVolume = 1e4, maxSingleTransfer = 5e3) {
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
  transactions = [];
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
    const totalGas = recentTxs.reduce((sum, tx) => sum + (tx.gasUsed || 0), 0);
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
import { desc as desc2, eq as eq2, or as or2 } from "drizzle-orm";
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
      whereClause = or2(eq2(walletTransactions.fromUserId, userId), eq2(walletTransactions.toUserId, userId));
    } else if (typeof walletAddress === "string") {
      whereClause = eq2(walletTransactions.walletAddress, walletAddress);
    }
    const txs = await db.select().from(walletTransactions).where(whereClause).orderBy(desc2(walletTransactions.createdAt));
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
var wallet_default = router;

// server/nextAuthMiddleware.ts
import { getToken } from "next-auth/jwt";
var isAuthenticated = async (req, res, next) => {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!token.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: token.sub } };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

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
var Maono_CONTRACT_ADDRESS = process.env.MAONO_CONTRACT_ADDRESS || "";
var PROVIDER_URL = process.env.RPC_URL || "http://localhost:8545";
var PRIVATE_KEY2 = process.env.MANAGER_PRIVATE_KEY || "";
var provider = new ethers.JsonRpcProvider(PROVIDER_URL);
var signer = PRIVATE_KEY2 ? new ethers.Wallet(PRIVATE_KEY2, provider) : void 0;
var maonoVault = new ethers.Contract(
  Maono_CONTRACT_ADDRESS,
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
    maonoVault.on("NAVUpdated", (newNAV, timestamp2) => {
      callback({ type: "NAVUpdated", newNAV, timestamp: timestamp2 });
    });
  }
};

// server/routes.ts
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname2 } from "path";

// server/routes/dao_treasury.ts
import express2 from "express";
var router2 = express2.Router();
router2.get("/:daoId/balance", isAuthenticated, async (req, res) => {
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
router2.post("/:daoId/transfer/native", isAuthenticated, async (req, res) => {
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
router2.post("/:daoId/transfer/token", isAuthenticated, async (req, res) => {
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
router2.post("/:daoId/automation/payout", isAuthenticated, async (req, res) => {
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
    router2.get("/:daoId/snapshot", isAuthenticated, async (req2, res2) => {
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
    router2.get("/:daoId/report", isAuthenticated, async (req2, res2) => {
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
var dao_treasury_default = router2;

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
function registerRoutes(app2) {
  app2.use("/api/wallet", isAuthenticated, wallet_default);
  app2.use("/api/dao/treasury", dao_treasury_default);
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  app2.get("/api/notifications", isAuthenticated, async (req, res) => {
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
  app2.get("/api/tasks/:id/history", isAuthenticated, async (req, res) => {
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
  app2.put("/api/tasks/:id", isAuthenticated, async (req, res) => {
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
  app2.get("/api/admin/daos", isAuthenticated, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const daos2 = await storage.getAllDaos({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getDaoCount();
      res.json({ daos: daos2, total });
    } catch (err) {
      throw new Error(`Failed to fetch DAOs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/users", isAuthenticated, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const users2 = await storage.getAllUsers({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getUserCount();
      res.json({ users: users2, total });
    } catch (err) {
      throw new Error(`Failed to fetch users: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/fees", isAuthenticated, isSuperuser, async (req, res) => {
    try {
      const fees = await storage.getPlatformFeeInfo();
      res.json({ fees });
    } catch (err) {
      throw new Error(`Failed to fetch fee info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/logs", isAuthenticated, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const logs2 = await storage.getSystemLogs({ limit: Number(limit), offset: Number(offset) });
      const total = await storage.getLogCount();
      res.json({ logs: logs2, total });
    } catch (err) {
      throw new Error(`Failed to fetch logs: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/billing", isAuthenticated, isSuperuser, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const billing = await storage.getAllDaoBillingHistory();
      const total = await storage.getBillingCount();
      res.json({ billing, total });
    } catch (err) {
      throw new Error(`Failed to fetch billing history: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/chaininfo", isAuthenticated, isSuperuser, async (req, res) => {
    try {
      const chainInfo2 = await storage.getChainInfo();
      res.json({ chainInfo: chainInfo2 });
    } catch (err) {
      throw new Error(`Failed to fetch chain info: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/admin/topmembers", isAuthenticated, isSuperuser, async (req, res) => {
    const { limit = 10 } = req.query;
    try {
      const topMembers = await storage.getTopMembers({ limit: Number(limit) });
      res.json({ topMembers });
    } catch (err) {
      throw new Error(`Failed to fetch top members: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    const { email, phone, password } = req.body;
    if (!email && !phone || !password) {
      return res.status(400).json({ message: "Email/phone and password required" });
    }
    try {
      const user = email ? await storage.getUserByEmail(email) : await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
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
  app2.post("/api/daos", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const dao = await storage.createDao({ ...req.body, creatorId: userId });
      res.status(201).json(dao);
    } catch (err) {
      throw new Error(`Failed to create DAO: ${err instanceof Error ? err.message : String(err)}`);
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
  app2.post("/api/dao/join", isAuthenticated, async (req, res) => {
    try {
      const { daoId } = req.body;
      const userId = req.user.claims.sub;
      const result = await handleDaoJoin(daoId, userId);
      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/join-with-invite", isAuthenticated, async (req, res) => {
    try {
      const { daoId, inviteCode } = req.body;
      const userId = req.user.claims.sub;
      const result = await handleDaoJoin(daoId, userId, inviteCode);
      res.status(result.status).json(result.data);
    } catch (err) {
      throw new Error(`Failed to join DAO with invite: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/invite/generate", isAuthenticated, async (req, res) => {
    try {
      const { daoId } = req.params;
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await storage.updateDaoInviteCode(daoId, code);
      res.status(201).json({ daoId, code });
    } catch (err) {
      throw new Error(`Failed to generate invite code: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/dao/:daoId/membership/:userId/approve", isAuthenticated, async (req, res) => {
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
  app2.post("/api/dao/:daoId/membership/:userId/reject", isAuthenticated, async (req, res) => {
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
  app2.get("/api/dao/:daoId/members", isAuthenticated, async (req, res) => {
    try {
      const { daoId } = req.params;
      const { limit = 10, offset = 0, status, role } = req.query;
      const userId = req.user.claims.sub;
      const membership = await storage.getDaoMembership(daoId, userId);
      if (!membership || membership.role !== "admin" && membership.role !== "elder") {
        return res.status(403).json({ message: "Admin or elder role required" });
      }
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
  app2.get("/api/dao/:daoId/analytics", isAuthenticated, async (req, res) => {
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
  app2.post("/api/votes", isAuthenticated, async (req, res) => {
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
      res.status(201).json(vote);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: err.errors });
      }
      throw new Error(`Failed to create vote: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/proposals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateProposal(req.params.id, req.body, userId);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update proposal: ${err instanceof Error ? err.message : String(err)}`);
    }
    app2.delete("/api/proposals/:id", isAuthenticated, async (req2, res2) => {
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
  app2.get("/api/votes/proposal/:proposalId", async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const votes2 = await storage.getVotesByProposal(req.params.proposalId);
      const total = await storage.getVotesCount(req.params.proposalId, req.query.daoId);
      res.json({ votes: votes2, total });
    } catch (err) {
      throw new Error(`Failed to fetch votes: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/contributions", isAuthenticated, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const userId = req.query.userId === "me" ? req.user.claims.sub : req.query.userId;
      const contributions2 = await storage.getContributions(userId, userId);
      const total = await storage.getContributionsCount(userId, userId);
      res.json({ contributions: contributions2, total });
    } catch (err) {
      throw new Error(`Failed to fetch contributions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/contributions", isAuthenticated, async (req, res) => {
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
  app2.post("/api/vaults", isAuthenticated, async (req, res) => {
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
  app2.get("/api/vaults/:vaultId/transactions", isAuthenticated, async (req, res) => {
    try {
      const { vaultId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      const userId = req.user.claims.sub;
      const vault = await storage.getUserVaults(userId).then(
        (vaults2) => vaults2.find((v) => v.id === vaultId)
      );
      if (!vault) return res.status(403).json({ message: "Vault not found or unauthorized" });
      const transactions = await storage.getVaultTransactions(vaultId, Number(limit), Number(offset));
      const total = await storage.getVaultTransactions(vaultId);
      res.json({ transactions, total });
    } catch (err) {
      throw new Error(`Failed to fetch vault transactions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/budget/:month", isAuthenticated, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
      const plans = await storage.getUserBudgetPlans(req.user.claims.sub, req.params.month);
      const total = await storage.getBudgetPlanCount(req.user.claims.sub, req.params.month);
      res.json({ plans, total });
    } catch (err) {
      throw new Error(`Failed to fetch budget plans: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/budget", isAuthenticated, async (req, res) => {
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
  app2.get("/api/tasks", async (req, res) => {
    const { daoId, status, limit = 10, offset = 0 } = req.query;
    if (!daoId) return res.status(400).json({ message: "DAO ID required" });
    try {
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
  app2.post("/api/tasks/:id/claim", isAuthenticated, async (req, res) => {
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
  app2.post("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const { title, description, reward, daoId } = req.body;
      if (!title || !description || !reward || !daoId) {
        return res.status(400).json({ message: "Missing required fields" });
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
  app2.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserProfile(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err) {
      throw new Error(`Failed to fetch user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserProfile(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update user profile: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/avatar", isAuthenticated, upload.single("avatar"), async (req, res) => {
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
  app2.get("/api/user/social", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const social = await storage.getUserSocialLinks(userId);
      res.json(social);
    } catch (err) {
      throw new Error(`Failed to fetch social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/social", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserSocialLinks(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update social links: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/wallet", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallet2 = await storage.getUserWallet(userId);
      res.json(wallet2);
    } catch (err) {
      throw new Error(`Failed to fetch wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.post("/api/user/wallet", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserWallet(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (err) {
      throw new Error(`Failed to fetch settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.put("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserSettings(userId, req.body);
      res.json(updated);
    } catch (err) {
      throw new Error(`Failed to update settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.get("/api/user/sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions2 = await storage.getUserSessions(userId);
      res.json(sessions2);
    } catch (err) {
      throw new Error(`Failed to fetch sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user/sessions/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      await storage.revokeUserSession(userId, sessionId);
      res.json({ message: "Session revoked" });
    } catch (err) {
      throw new Error(`Failed to revoke session: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user/sessions/revoke-all", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.revokeAllUserSessions(userId);
      res.json({ message: "All sessions revoked" });
    } catch (err) {
      throw new Error(`Failed to revoke all sessions: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  app2.delete("/api/user", isAuthenticated, async (req, res) => {
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
  app2.post("/api/maonovault/deposit", isAuthenticated, async (req, res) => {
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
  app2.post("/api/maonovault/withdraw", isAuthenticated, async (req, res) => {
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
  app2.post("/api/maonovault/nav", isAuthenticated, async (req, res) => {
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
  app2.post("/api/maonovault/fee", isAuthenticated, async (req, res) => {
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
}

// server/vite.ts
import express4 from "express";
import path3 from "path";
import { dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import fs2 from "fs";
import { createServer as createViteServer, createLogger } from "vite";

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
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: ["all"]
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __dirname4 = dirname3(fileURLToPath4(import.meta.url));
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
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
      hmr: { server },
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
  app2.use(express4.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.join(distPath, "index.html"));
  });
}

// server/index.ts
import path4 from "path";
import { dirname as dirname4 } from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
var __dirname5 = dirname4(fileURLToPath5(import.meta.url));
var app = express5();
app.use(express5.json());
app.use(express5.urlencoded({ extended: false }));
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
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    await registerRoutes(app);
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });
    const port = Number(process.env.PORT) || 4e3;
    const server = app.listen(port, "0.0.0.0", () => {
      log(`\u{1F680} Server running on http://localhost:${port}`);
    });
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get("*", (_, res) => {
        res.sendFile(path4.join(__dirname5, "../../dist/public", "index.html"));
      });
    }
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1);
  }
})();
