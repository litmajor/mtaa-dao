
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
  uuid
} from "drizzle-orm/pg-core";
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
  status: varchar("status").default("open"),// open, claimed, completed
  claimerId: varchar("claimer_id").references(() => users.id),
  claimedBy: varchar("claimed_by").references(() => users.id), // legacy, keep for now
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), 
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
import { relations } from "drizzle-orm";
import { IsRestoringProvider } from "@tanstack/react-query";


// User storage table (required for Replit Auth)
export const users = pgTable("users", {
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
});

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  imageUrl: varchar("image_url"),
  bannerUrl: varchar("banner_url"),
  isArchived: boolean("is_archived").default(false), // for soft deletion
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  isFeatured: boolean("is_featured").default(false), // for featured DAOs on landing page
  featureOrder: integer("feature_order").default(0), // order of featured DAOs
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

// Proposals table
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposalType: varchar("proposal_type").default("general"), // general, budget, emergency
  tags: jsonb("tags").default([]), // e.g., ["infrastructure", "education"]
  imageUrl: varchar("image_url"),
  proposer: varchar("proposer").references(() => users.id).notNull(),
  proposerId: varchar("proposer_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  status: varchar("status").default("active"), // draft, active, resolved, expired
  voteStartTime: timestamp("vote_start_time").defaultNow(),
  voteEndTime: timestamp("vote_end_time").notNull(),
  quorumRequired: integer("quorum_required").default(100),
  yesVotes: integer("yes_votes").default(0),
  noVotes: integer("no_votes").default(0),
  abstainVotes: integer("abstain_votes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isFeatured: boolean("is_featured").default(false), // for featured proposals on DAO page
});

// Votes table
export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").references(() => proposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  voteType: varchar("vote_type").notNull(), // yes, no, abstain
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.0"),
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

// Personal Finance Vaults table
export const vaults = pgTable("vaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currency: varchar("currency").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
  monthlyGoal: decimal("monthly_goal", { precision: 10, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  // Note: no need for a vault name, just a single vault per user
  // This simplifies the vault management and aligns with the personal finance focus
  // Users can have multiple vaults for different currencies if needed
  // Each vault can have its own budget and spending limits
  // This allows for better financial management and tracking
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // Note: fromUserId and toUserId can be null for deposits or contributions
  // e.g., deposit to vault, contribution to DAO, etc.
  // This allows tracking of all wallet-related transactions in one table
  // and simplifies the wallet history retrieval for users
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
}));

export const daosRelations = relations(daos, ({ one, many }) => ({
  creator: one(users, {
    fields: [daos.creatorId],
    references: [users.id],
  }),
  memberships: many(daoMemberships),
  proposals: many(proposals),
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
  votes: many(votes),
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
  message: text("message").notNull(),
  read: boolean("read").default(false),
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

export const insertTaskSchema = createInsertSchema(tasks);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertTaskHistorySchema = createInsertSchema(taskHistory);
export type InsertDaoMembership = typeof daoMemberships.$inferInsert;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type InsertReferralReward = typeof referralRewards.$inferInsert;
export type InsertNotification = typeof notifications.$inferInsert;
export type InsertTaskHistory = typeof taskHistory.$inferInsert;

// Export all types

