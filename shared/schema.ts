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
  json,
  numeric, // Import numeric type
  date,
  unique
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
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardType: varchar("reward_type").default("signup"), // signup, first_contribution, milestone, invitation_accepted
  status: varchar("status").default("pending"), // pending, awarded, claimed
  claimed: boolean("claimed").default(false),
  awardedAt: timestamp("awarded_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Treasury Credits - Track MTAA flowing into DAO treasuries
export const daoTreasuryCredits = pgTable("dao_treasury_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  source: varchar("source", { length: 50 }).notNull(), // 'earnings_rake', 'achievement', 'task_pool', 'referral_kickback'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  userId: varchar("user_id").references(() => users.id), // User who triggered this credit
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MTAA Distribution Rules - Configure splits
export const mtaaDistributionRules = pgTable("mtaa_distribution_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }), // NULL = global default
  actionType: varchar("action_type", { length: 50 }).notNull(), // 'contribution', 'task_completion', etc
  userPercentage: integer("user_percentage").notNull().default(90),
  daoPercentage: integer("dao_percentage").notNull().default(10),
  platformPercentage: integer("platform_percentage").notNull().default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Achievement Milestones
export const daoAchievementMilestones = pgTable("dao_achievement_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'member_count', 'treasury_value', 'proposal_success'
  threshold: integer("threshold").notNull(),
  mtaaReward: decimal("mtaa_reward", { precision: 18, scale: 8 }).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DaoTreasuryCredit = typeof daoTreasuryCredits.$inferSelect;
export type InsertDaoTreasuryCredit = typeof daoTreasuryCredits.$inferInsert;
export type MtaaDistributionRule = typeof mtaaDistributionRules.$inferSelect;
export type InsertMtaaDistributionRule = typeof mtaaDistributionRules.$inferInsert;
export type DaoAchievementMilestone = typeof daoAchievementMilestones.$inferSelect;
export type InsertDaoAchievementMilestone = typeof daoAchievementMilestones.$inferInsert;

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

// Referral tier information for analytics
export const referralTiers = pgTable("referral_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  tier: varchar("tier").notNull(), // bronze, silver, gold, platinum, diamond
  totalReferrals: integer("total_referrals").default(0),
  activeReferrals: integer("active_referrals").default(0),
  totalContributionValue: decimal("total_contribution_value", { precision: 18, scale: 2 }).default("0"),
  lifetimeEarnings: decimal("lifetime_earnings", { precision: 18, scale: 2 }).default("0"),
  badges: jsonb("badges").default([]), // Array of achievement badges
  lastPingDate: timestamp("last_ping_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ReferralTier = typeof referralTiers.$inferSelect;
export type InsertReferralTier = typeof referralTiers.$inferInsert;

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

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // VARCHAR to match current database state
  // TODO: migrate to uuid after resolving all foreign key constraints
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
  referralRewards: varchar("referral_rewards"),
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
  votingTokenBalance: decimal("voting_token_balance", { precision: 10, scale: 2 }).default("0"), // Added for admin analytics compatibility
  mtaaTokenBalance: decimal("mtaa_token_balance", { precision: 10, scale: 2 }).default("0"), // Added for admin analytics compatibility
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1.0"), // for weighted voting
  telegramId: varchar("telegram_id"),
  telegramChatId: varchar("telegram_chat_id"),
  telegramUsername: varchar("telegram_username"),
  preferredCurrency: varchar("preferred_currency").default("USD"), // User's preferred currency for display
  // Encrypted wallet storage fields
  encryptedWallet: text("encrypted_wallet"),
  walletSalt: text("wallet_salt"),
  walletIv: text("wallet_iv"),
  walletAuthTag: text("wallet_auth_tag"),
  hasBackedUpMnemonic: boolean("has_backed_up_mnemonic").default(false),
  isActive: boolean("is_active").default(true), // Added for account enable/disable compatibility
  // ========================================
  // FEATURE FLAGS - PROGRESSIVE RELEASE
  // ========================================
  // JSONB array of beta features user has access to
  // Example: ["locked_savings", "ai_assistant", "advanced_analytics"]
  // Set via /api/admin/beta-access endpoint
  enabledBetaFeatures: text("enabled_beta_features").default("[]"), // JSON array as text, parsed on retrieval
  
  // ========================================
  // GATING & FEATURE UNLOCK SYSTEM
  // ========================================
  advancedMode: boolean("advanced_mode").default(false), // Manual opt-in for advanced features
  reputation: integer("reputation").default(0), // Reputation score for gating
  balance: decimal("balance", { precision: 20, scale: 2 }).default("0"), // Account balance for gating
  activeSubprofile: varchar("active_subprofile").default("okedi"), // User's active subprofile (okedi/yuki/amara) - users switch between these
  // If you need legacy/alternate spellings, use different property names or comment out as needed:
  // referralCodeLegacy: varchar("referralCode"),
  // votingTokenBalanceLegacy: decimal("votingTokenBalance", { precision: 10, scale: 2 }),
  // mtaaTokenBalanceLegacy: decimal("mtaaTokenBalance", { precision: 10, scale: 2 }),
  // referralcodeLegacy: varFchar("referralcode"),
  // votingtokenbalanceLegacy: decimal("votingtokenbalance", { precision: 10, scale: 2 }),
  // mtaatokenbalanceLegacy: decimal("mtaatokenbalance", { precision: 10, scale: 2 })

  // ========================================
  // TWO-FACTOR AUTHENTICATION (2FA)
  // ========================================
  twoFactorEnabled: boolean("two_factor_enabled").default(false), // Whether 2FA is active
  twoFactorMethod: varchar("two_factor_method").default("totp"), // totp, sms, email
  twoFactorSecret: text("two_factor_secret"), // Encrypted TOTP secret
  twoFactorBackupCodes: text("two_factor_backup_codes"), // Encrypted JSON array of backup codes
  twoFactorSetupAt: timestamp("two_factor_setup_at"), // When 2FA was set up
  twoFactorVerifiedAt: timestamp("two_factor_verified_at"), // When 2FA was last verified
  twoFactorRecoveryEmail: varchar("two_factor_recovery_email"), // Alternative recovery email

  // Soft delete fields (Day 3 Emergency Response)
  deleted_at: timestamp("deleted_at"),
  deleted_by: varchar("deleted_by"),
  delete_reason: text("delete_reason"),
  deleted_recovery_deadline: timestamp("deleted_recovery_deadline"),
});

// Beta Access table for tracking feature access
export const betaAccess = pgTable("beta_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  featureName: varchar("feature_name").notNull(), // e.g., "locked_savings", "ai_assistant"
  grantedAt: timestamp("granted_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  grantedBy: varchar("granted_by").references(() => users.id), // admin who granted this
  revokedBy: varchar("revoked_by").references(() => users.id), // admin who revoked this
  reason: text("reason"), // reason for granting/revoking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BetaAccess = typeof betaAccess.$inferSelect;
export type InsertBetaAccess = typeof betaAccess.$inferInsert;

// User Contexts table for Nuru AI system
export const userContexts = pgTable("user_contexts", {
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  role: varchar("role").notNull(), // 'guest', 'member', 'admin', 'founder'
  walletAddress: varchar("wallet_address"),
  contributionScore: decimal("contribution_score", { precision: 10, scale: 2 }).default("0"),
  lastInteraction: timestamp("last_interaction").defaultNow(),
  context: jsonb("context").notNull(), // stores preferences, sessionData, recentActions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  pk: {
    columns: [table.userId, table.daoId],
  },
  daoIdIdx: index("user_contexts_dao_id_idx").on(table.daoId),
  lastInteractionIdx: index("user_contexts_last_interaction_idx").on(table.lastInteraction),
}));

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
  activityType: varchar('activity_type'), // Added for admin analytics compatibility
  metadata: jsonb('metadata'), // Added for admin analytics compatibility
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
  // ⚠️ DEPRECATED: treasuryBalance is now computed from treasuryPositions + stableInflowEvents
  // DO NOT UPDATE THIS DIRECTLY - it will drift from actual on-chain state
  // Query: SELECT SUM(tp.balance) FROM treasuryPositions tp WHERE tp.daoId = $1
  treasuryBalance: decimal("treasury_balance", { precision: 10, scale: 2 }).default("0"),
  plan: varchar("plan").default("free"), // free, premium, short_term, collective
  daoType: varchar("dao_type").default("free"), // free, short_term, collective, governance, investment_club, meta
  planExpiresAt: timestamp("plan_expires_at"),
  billingStatus: varchar("billing_status").default("active"),
  nextBillingDate: timestamp("next_billing_date"),
  // Short-term DAO extension tracking
  extensionCount: integer("extension_count").default(0), // 0, 1, or 2 max
  originalDuration: integer("original_duration"), // in days (30, 60, 90)
  currentExtensionDuration: integer("current_extension_duration"), // halved each time
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
  tokenHoldings: boolean("token_holdings").default(false), // whether DAO requires token holdings for membership
  status: varchar("status").default("active"), // Active, archived, suspended
  subscriptionPlan: varchar("subscription_plan").default("free"), // Subscription plan type
  founderId: varchar("founder_id"), // Founder/primary contact ID
  maxDelegationPercentage: integer("max_delegation_percentage").default(10), // max % of votes a single delegate can hold
  treasuryMultisigEnabled: boolean("treasury_multisig_enabled").default(true), // Multi-sig security
  treasuryRequiredSignatures: integer("treasury_required_signatures").default(3), // minimum signatures for withdrawals
  treasurySigners: jsonb("treasury_signers").default([]), // array of signer user IDs
  treasuryWithdrawalThreshold: decimal("treasury_withdrawal_threshold", { precision: 18, scale: 2 }).default("1000.00"), // $1K threshold
  treasuryDailyLimit: decimal("treasury_daily_limit", { precision: 18, scale: 2 }).default("10000.00"), // daily spending cap
  treasuryMonthlyBudget: decimal("treasury_monthly_budget", { precision: 18, scale: 2 }), // optional monthly budget limit

  // Withdrawal and duration configuration
  withdrawalMode: varchar("withdrawal_mode").default("multisig"), // direct, multisig, rotation
  durationModel: varchar("duration_model").default("time"), // time, rotation, ongoing
  rotationFrequency: varchar("rotation_frequency"), // weekly, monthly, quarterly
  rotationSelectionMethod: varchar("rotation_selection_method").default("sequential"), // sequential, lottery, proportional
  nextRotationDate: timestamp("next_rotation_date"),
  currentRotationCycle: integer("current_rotation_cycle").default(0), // Track which cycle we're in
  totalRotationCycles: integer("total_rotation_cycles"), // Total cycles planned
  estimatedCycleDuration: integer("estimated_cycle_duration"), // in days
  minElders: integer("min_elders").default(2),
  maxElders: integer("max_elders").default(5),

  // Custom Causes - User-defined reasons for the DAO (e.g., bail money, medical, funeral)
  primaryCause: varchar("primary_cause"), // Primary custom cause (user-defined string)
  causeTags: jsonb("cause_tags").default([]), // Array of predefined cause tags: ['youthempowerment', 'funeralfund', 'education', 'healthcare', 'agriculture', 'smallbusiness']

  // Soft delete fields (Day 3 Emergency Response)
  deleted_at: timestamp("deleted_at"),
  deleted_by: varchar("deleted_by"),
  delete_reason: text("delete_reason"),
  deleted_recovery_deadline: timestamp("deleted_recovery_deadline"),
});

// DAO Abuse Prevention Tables
export const daoCreationTracker = pgTable('dao_creation_tracker', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  daoId: uuid('dao_id').notNull().references(() => daos.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  verificationMethod: varchar('verification_method').notNull(),
  verificationData: jsonb('verification_data').default({}),
  isVerified: boolean('is_verified').default(false)
});

export const daoSocialVerifications = pgTable('dao_social_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  daoId: uuid('dao_id').notNull().references(() => daos.id, { onDelete: 'cascade' }),
  verifierUserId: varchar('verifier_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  verifiedAt: timestamp('verified_at').defaultNow(),
  verificationType: varchar('verification_type').default('member_invite'),
  metadata: jsonb('metadata').default({})
});

export const daoIdentityNfts = pgTable('dao_identity_nfts', {
  id: uuid('id').defaultRandom().primaryKey(),
  daoId: uuid('dao_id').notNull().unique().references(() => daos.id, { onDelete: 'cascade' }),
  nftTokenId: varchar('nft_token_id'),
  nftContractAddress: varchar('nft_contract_address'),
  mintedAt: timestamp('minted_at').defaultNow(),
  mintCostMtaa: numeric('mint_cost_mtaa').default('10'),
  isVerified: boolean('is_verified').default(false),
  metadataUri: varchar('metadata_uri')
});

export const platformRevenue = pgTable('platform_revenue', {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id),
  userId: varchar("user_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("KES"),
  description: text("description"),
  transactionType: varchar("transaction_type").notNull(), // e.g., "subscription", "fee", "contribution"
  status: varchar("status").default("paid"), // paid, pending, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

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
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(), // For Redis sync tracking
  ipAddress: varchar("ip_address"), // Added for admin analytics compatibility
  userAgent: varchar("user_agent"), // Added for admin analytics compatibility
  sessionData: jsonb("session_data"), // Store complete session data for recovery
});

export const createSessionSchema = createInsertSchema(sessions);
export const sessionSchema = createSessionSchema;

// Refresh Tokens table - for token revocation and rotation tracking
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar("token_hash").notNull(), // Hash of the actual refresh token (bcrypt)
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false), // Mark as revoked for logout/force-logout
  revokedAt: timestamp("revoked_at"), // When token was revoked
  rotatedAt: timestamp("rotated_at"), // When token was rotated to new one (for tracking refresh chain)
  ipAddress: varchar("ip_address"), // IP address that requested the token
  userAgent: varchar("user_agent"), // User agent that requested token
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const createRefreshTokenSchema = createInsertSchema(refreshTokens);

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
  userId: varchar("user_id").references(() => users.id).notNull(), // alias for proposerId for analyzer compatibility
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
  currency: varchar("currency").default("cUSD"),
  lockPeriod: integer("lock_period").notNull(), // in days
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.05"), // 5% default
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
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
  creatorId: varchar("creator_id").references(() => users.id), // who created this vault (can be delegated for strategies)
  name: varchar("name").default("Personal Vault"), // vault name with default for backward compatibility
  description: text("description"),
  currency: varchar("currency").notNull(), // primary currency, kept for backward compatibility
  address: varchar("address"), // wallet address for this vault
  // ⚠️ DEPRECATED: balance is now computed from vaultTokenHoldings (chain-indexed, source of truth)
  // DO NOT UPDATE THIS DIRECTLY - it will drift from actual on-chain state
  // Query: SELECT SUM(vth.balance) FROM vaultTokenHoldings vth WHERE vth.vaultId = $1
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

  // Phase 4B: Vault ownership and treasury linking
  ownerType: varchar("owner_type"), // 'user' | 'dao' - replaces userId/daoId nullable logic
  ownerId: uuid("owner_id"), // userId or daoId depending on ownerType
  treasuryId: uuid("treasury_id").references(() => daos.id), // link to DAO treasury (optional, only for DAO vaults)
  vaultConfig: jsonb("vault_config"), // JSONB config for type-specific settings (lockDuration, strategy params, etc)

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

  // Withdrawal permissions
  canInitiateWithdrawal: boolean("can_initiate_withdrawal").default(false),
  canApproveWithdrawal: boolean("can_approve_withdrawal").default(false),
  isRotationRecipient: boolean("is_rotation_recipient").default(false),
  rotationRecipientDate: timestamp("rotation_recipient_date")
});

// DAO Invitations table - for member invites
export const daoInvitations = pgTable("dao_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  invitedBy: varchar("invited_by").references(() => users.id), // Who sent invite
  referrerId: varchar("referrer_id").references(() => users.id), // Who referred (for rewards)
  invitedEmail: varchar("invited_email"), // Email of recipient
  invitedPhone: varchar("invited_phone"), // Phone of recipient
  recipientUserId: varchar("recipient_user_id").references(() => users.id), // If already a user
  role: varchar("role").default("member"), // member, elder, treasurer, proposer
  inviteLink: varchar("invite_link").unique().notNull(), // Unique token
  status: varchar("status").default("pending"), // pending, accepted, rejected, expired, revoked
  expiresAt: timestamp("expires_at"), // 30 days default
  invitationSentAt: timestamp("invitation_sent_at"), // When invitation was sent
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  userExistedAtInvite: boolean("user_existed_at_invite").default(false), // Was user already registered?
  isPeerInvite: boolean("is_peer_invite").default(false), // Member referred by peer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Rotation Cycles - track each rotation cycle
export const daoRotationCycles = pgTable("dao_rotation_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  cycleNumber: integer("cycle_number").notNull(), // 1, 2, 3, etc
  recipientUserId: varchar("recipient_user_id").references(() => users.id).notNull(),
  status: varchar("status").default("pending"), // pending, active, completed, skipped
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  amountDistributed: decimal("amount_distributed", { precision: 18, scale: 8 }).default("0"),
  transactionHash: varchar("transaction_hash"), // Blockchain tx hash
  distributedAt: timestamp("distributed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Custom Rules table
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
  stableInflowEventId: uuid("stable_inflow_event_id"),
  stableUnitsMicroUsd: numeric("stable_units_microusd", { precision: 38, scale: 0 }),
  chainId: integer("chain_id"),
  tokenAddress: varchar("token_address", { length: 255 }),
  metadata: jsonb("metadata"), // Added for transaction monitor compatibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Stable Asset Registry
 * Canonical stablecoin metadata by chain + token.
 */
export const stableAssetRegistry = pgTable("stable_asset_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  chain: varchar("chain", { length: 50 }).notNull(),
  chainId: integer("chain_id").notNull(),
  tokenAddress: varchar("token_address", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  decimals: integer("decimals").notNull().default(6),
  riskScore: integer("risk_score").notNull().default(20),
  liquidityScore: integer("liquidity_score").notNull().default(70),
  depegThresholdBps: integer("depeg_threshold_bps").notNull().default(100),
  minConfirmations: integer("min_confirmations").notNull().default(3),
  maxConfirmationDelaySec: integer("max_confirmation_delay_sec").notNull().default(900),
  pegTargetUsd: decimal("peg_target_usd", { precision: 18, scale: 8 }).notNull().default("1.00000000"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainTokenIdx: index("stable_asset_registry_chain_token_idx").on(table.chainId, table.tokenAddress),
  symbolIdx: index("stable_asset_registry_symbol_idx").on(table.symbol),
  activeIdx: index("stable_asset_registry_active_idx").on(table.isActive),
}));

/**
 * Stable Inflow Events (append-only ledger)
 * Canonical normalized intake records for stablecoin deposits.
 */
export const stableInflowEvents = pgTable("stable_inflow_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 50 }).notNull().default("webhook"),
  chain: varchar("chain", { length: 50 }).notNull(),
  chainId: integer("chain_id").notNull(),
  txHash: varchar("tx_hash", { length: 255 }).notNull(),
  logIndex: integer("log_index").notNull().default(0),
  tokenAddress: varchar("token_address", { length: 255 }).notNull(),
  tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(),
  tokenDecimals: integer("token_decimals").notNull(),
  toAddress: varchar("to_address", { length: 255 }).notNull(),
  fromAddress: varchar("from_address", { length: 255 }),
  rawAmount: numeric("raw_amount", { precision: 78, scale: 0 }).notNull(),
  normalizedTokenAmount: decimal("normalized_token_amount", { precision: 38, scale: 18 }).notNull(),
  normalizedAmountUsd: decimal("normalized_amount_usd", { precision: 24, scale: 8 }).notNull(),
  stableUnitsMicroUsd: numeric("stable_units_microusd", { precision: 38, scale: 0 }).notNull(),
  confirmations: integer("confirmations").default(0),
  minConfirmations: integer("min_confirmations").default(0),
  confirmationState: varchar("confirmation_state", { length: 30 }).notNull().default("pending"),
  delayState: varchar("delay_state", { length: 30 }).notNull().default("unknown"),
  observedConfirmationDelaySec: integer("observed_confirmation_delay_sec"),
  pegTargetUsd: decimal("peg_target_usd", { precision: 18, scale: 8 }).default("1.00000000"),
  observedPriceUsd: decimal("observed_price_usd", { precision: 24, scale: 8 }),
  pegDeviationBps: integer("peg_deviation_bps").default(0),
  riskFlags: jsonb("risk_flags").default({}),
  status: varchar("status", { length: 30 }).notNull().default("received"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  idempotencyIdx: index("stable_inflow_events_idempotency_idx").on(
    table.chainId,
    table.txHash,
    table.logIndex,
    table.tokenAddress,
    table.toAddress
  ),
  statusIdx: index("stable_inflow_events_status_idx").on(table.status),
  symbolIdx: index("stable_inflow_events_symbol_idx").on(table.tokenSymbol),
  createdAtIdx: index("stable_inflow_events_created_at_idx").on(table.createdAt),
}));

// ════════════════════════════════════════════════════════════════════════════════
// DAO MULTI-SIG & CONTRIBUTION CONFIGURATION TABLES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * DAO Contribution Types Configuration
 * Defines what types of contributions a DAO accepts (contribution, donation, investment)
 * Examples:
 *   - Contribution: Regular member payments to shared fund
 *   - Donation: Voluntary contributions without equity stake
 *   - Investment: Capital investment with ROI expectations
 */
export const daoContributionTypes = pgTable("dao_contribution_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 50 }).notNull(), // 'contribution', 'donation', 'investment'
  description: text("description"),
  minimumAmount: decimal("minimum_amount", { precision: 18, scale: 2 }).default("0"),
  maximumAmount: decimal("maximum_amount", { precision: 18, scale: 2 }), // null = no limit
  requiresApproval: boolean("requires_approval").default(false), // if false, auto-accepted
  approvalsNeeded: integer("approvals_needed").default(1), // N-of-M threshold
  allowRecurring: boolean("allow_recurring").default(false),
  trackEquity: boolean("track_equity").default(false), // for investment types
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * DAO Contribution Requests
 * Tracks all contributions made by members
 */
export const daoContributions = pgTable("dao_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  contributorId: varchar("contributor_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contributionTypeId: uuid("contribution_type_id").references(() => daoContributionTypes.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  status: varchar("status").default("pending"), // pending, approved, rejected, completed
  approvalStatus: varchar("approval_status").default("awaiting"), // awaiting, unanimousApproval, majoritApproval, rejected
  approvalsCount: integer("approvals_count").default(0),
  requiredApprovals: integer("required_approvals").notNull(),
  rejectionReason: text("rejection_reason"),
  completedAt: timestamp("completed_at"),
  description: text("description"),
  metadata: jsonb("metadata").default({}), // Can store additional info like investment terms, equity %
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Contribution Approvals Track
 * Tracks individual approvals from DAO members/admins
 */
export const daoContributionApprovals = pgTable("dao_contribution_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  contributionId: uuid("contribution_id").references(() => daoContributions.id, { onDelete: 'cascade' }).notNull(),
  approverId: varchar("approver_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  approved: boolean("approved").notNull(),
  comment: text("comment"),
  approvedAt: timestamp("approved_at").defaultNow(),
});

/**
 * DAO Multi-Signature Configuration
 * Separate from wallet transactions for treasury operations
 * Links withdrawals to required approvals
 */
export const daoMultisigConfig = pgTable("dao_multisig_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  requiredApprovals: integer("required_approvals").notNull().default(2), // N-of-M
  totalSigners: integer("total_signers").notNull(), // M signers
  signerAddresses: jsonb("signer_addresses").default([]), // Array of authorized signer user IDs
  withdrawalThreshold: decimal("withdrawal_threshold", { precision: 18, scale: 2 }).default("1000.00"),
  rolesAllowedToApprove: jsonb("roles_allowed_to_approve").default(["admin", "elder"]), // which roles can approve
  autoCompleteOnThreshold: boolean("auto_complete_on_threshold").default(true), // auto-complete when threshold met
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Treasury Withdrawal Approvals Track
 * Separate from wallet transactions for multi-sig tracking
 */
export const treasuryWithdrawalApprovals = pgTable("treasury_withdrawal_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  withdrawalId: uuid("withdrawal_id").references(() => walletTransactions.id, { onDelete: 'cascade' }).notNull(),
  approverId: varchar("approver_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  approved: boolean("approved").notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
  comment: text("comment"),
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
  provider: varchar("provider").default("unknown"), // Added for admin analytics compatibility
  fromAddress: varchar("from_address"), // Added for admin analytics compatibility
  timestamp: timestamp("timestamp").defaultNow(), // Added for admin analytics compatibility
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
  nextAssessmentDue: timestamp("nextAssessmentDue"),
  assessedBy: varchar("assessed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ========== MARKET NERVOUS SYSTEM: ASSET GRAPH L1 ==========

/**
 * Treasury Position
 * 
 * Represents a single position in a DAO treasury across multi-chain environment.
 * Context-aware: same asset, different DAO type = different cognition behavior.
 * 
 * DAO Personas:
 * - free: No treasury
 * - short_term (30/60/90 days): Rotation-based distribution to members
 * - long_term: Ongoing, multi-sig controlled
 * - bail_fund: Emergency rotation distributions to recipients
 * - funeral_fund: Mutual aid, emergency distributions
 * - investment_club: Yield strategy accumulation (no forced distributions)
 * - foundation: Endowment mode, sustainable spend rate
 */
export const treasuryPositions = pgTable("treasury_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Identity
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  treasuryVaultId: uuid("treasury_vault_id").references(() => vaults.id, { onDelete: 'set null' }),
  
  // Asset reference (links to AssetGraph)
  assetNodeId: varchar("asset_node_id").notNull(), // e.g., "celo:0x765DE816..."
  symbol: varchar("symbol", { length: 20 }).notNull(), // cUSD, CELO, cEUR, etc.
  
  // Chain-specific holding (CRITICAL FOR MULTI-CHAIN)
  chain: varchar("chain", { length: 20 }).notNull(), // celo, ethereum, base, polygon
  contractAddress: varchar("contract_address", { length: 255 }).notNull(),
  
  // Position tracking
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0"),
  balanceUsd: decimal("balance_usd", { precision: 18, scale: 2 }), // USD equivalent at last update
  costBasis: decimal("cost_basis", { precision: 18, scale: 2 }), // USD paid for this position
  acquisitionTimestamp: timestamp("acquisition_timestamp"),
  lastRebalanceTimestamp: timestamp("last_rebalance_timestamp"),
  
  // Asset classification
  assetClass: varchar("asset_class", { length: 30 }), // stable, volatile, yield, lp, vault, nft, wrapped, exotic
  riskLevel: varchar("risk_level", { length: 20 }), // low, medium, high
  
  // DAO-specific context (makes Cognition decisions DAO-aware)
  daoType: varchar("dao_type", { length: 30 }), // free, short_term, long_term, bail_fund, etc.
  treasuryMode: varchar("treasury_mode", { length: 30 }), // accumulative (growth) vs distributive (payouts)
  treasurySize: varchar("treasury_size", { length: 30 }), // small, medium, large
  riskProfile: varchar("risk_profile", { length: 30 }), // conservative, balanced, aggressive
  
  // For rotation DAOs (critical!)
  nextDistributionWindow: timestamp("next_distribution_window"), // When do members get paid?
  needsLiquidityBy: timestamp("needs_liquidity_by"), // Hard deadline to exit
  
  // Yield tracking (for Investment Club & yield vaults)
  yieldEarned: decimal("yield_earned", { precision: 18, scale: 8 }).default("0"),
  yieldStrategy: varchar("yield_strategy", { length: 50 }), // moola-lending, celo-staking, ubeswap-lp
  
  // Execution hints (for Cognition to plan exit routes)
  exitLiquidity: varchar("exit_liquidity", { length: 20 }), // immediate, fast, slow, illiquid
  exitTimeAt5PercentSlippage: integer("exit_time_at_5_percent_slippage"), // seconds
  bridgeCostIfMoving: decimal("bridge_cost_if_moving", { precision: 5, scale: 2 }), // % fee
  
  // Rebalancing tracking
  rebalanceDeviation: decimal("rebalance_deviation", { precision: 5, scale: 2 }), // % away from target
  isLockedUntil: timestamp("is_locked_until"), // For locked_savings vaults
  
  // Metadata
  metadata: jsonb("metadata").default({}), // Custom data per DAO
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  daoIdIdx: index("treasury_positions_dao_id_idx").on(table.daoId),
  symbolIdx: index("treasury_positions_symbol_idx").on(table.symbol),
  chainIdx: index("treasury_positions_chain_idx").on(table.chain),
  daoTypeIdx: index("treasury_positions_dao_type_idx").on(table.daoType),
  nextDistributionIdx: index("treasury_positions_next_distribution_idx").on(table.nextDistributionWindow),
}));

/**
 * Asset Graph Versions (Separate from Snapshots)
 * 
 * Stores the complete graph at a point in time.
 * Updated ONLY when graph changes (new bridge, new LP pair, new yield track).
 * Not updated with every shard cycle.
 * 
 * Snapshots reference this version number.
 */
/**
 * Asset Nodes Table
 * 
 * Stores all asset nodes separately from versions.
 * Allows efficient queries like "get all nodes for version X"
 * or "get node Y across versions"
 */
export const assetNodes = pgTable("asset_nodes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  version: integer("version").notNull(), // Which graph version(s) include this node?
  
  // Full asset node data
  nodeData: jsonb("node_data").notNull(), // Full AssetNode JSON
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  versionIdx: index("asset_nodes_version_idx").on(table.version),
  idVersionIdx: index("asset_nodes_id_version_idx").on(table.id, table.version),
}));

/**
 * Asset Edges Table
 * 
 * Stores all edges separately from versions.
 * Allows efficient queries like "get bridges only" or "get liquidity routes"
 */
export const assetEdges = pgTable("asset_edges", {
  id: varchar("id", { length: 255 }).primaryKey(),
  version: integer("version").notNull(), // Which graph version(s) include this edge?
  
  sourceAssetId: varchar("source_asset_id", { length: 255 }).notNull(),
  targetAssetId: varchar("target_asset_id", { length: 255 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  
  // Full edge data
  edgeData: jsonb("edge_data").notNull(), // Full AssetEdge JSON
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  versionIdx: index("asset_edges_version_idx").on(table.version),
  sourceIdx: index("asset_edges_source_idx").on(table.sourceAssetId),
  typeIdx: index("asset_edges_type_idx").on(table.relationshipType),
  versionTypeIdx: index("asset_edges_version_type_idx").on(table.version, table.relationshipType),
}));

/**
 * Asset Graph Versions (HASH-BASED, LIGHTWEIGHT)
 * 
 * No longer embeds full node/edge arrays.
 * Instead: references nodes/edges by version number in separate tables.
 * This prevents O(version * nodes * edges) storage explosion.
 * 
 * Design: Git-like commits, not full copies
 */
export const assetGraphVersions = pgTable("asset_graph_versions", {
  version: integer("version").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // ========== HASH-BASED REFERENCES (NOT FULL COPIES) ==========
  nodeHash: varchar("node_hash", { length: 64 }).notNull(), // SHA256 of all nodes
  edgeHash: varchar("edge_hash", { length: 64 }).notNull(), // SHA256 of all edges
  
  // ========== COUNTS (for quick access) ==========
  nodeCount: integer("node_count").notNull(),
  edgeCount: integer("edge_count").notNull(),
  
  // ========== CHANGE TRACKING ==========
  changeReason: varchar("change_reason", { length: 50 }),
  changeDetails: text("change_details"),
  
  // Edge counts by type/chain (for efficient queries without loading full graph)
  edgeCountByType: jsonb("edge_count_by_type").default({}),
  edgeCountByChain: jsonb("edge_count_by_chain").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  timestampIdx: index("asset_graph_versions_timestamp_idx").on(table.timestamp),
  nodeHashIdx: index("asset_graph_versions_node_hash_idx").on(table.nodeHash),
}));

/**
 * Correlation Matrices (INDEPENDENT VERSIONING)
 * 
 * Decoupled from AssetGraphVersion.
 * 
 * Correlation updates independently from graph updates:
 * - Graph updates: bridge added, new LP pair, new yield strategy
 * - Correlation updates: market dynamics shift, lookback window changes
 * 
 * Example: Adding a bridge doesn't invalidate yesterday's correlations
 */
export const correlationMatrices = pgTable("correlation_matrices", {
  matrixVersion: integer("matrix_version").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Which graph version was this computed against?
  computedAgainstGraphVersion: integer("computed_against_graph_version").notNull(),
  
  // Sparse correlation matrix: { from_id: { to_id: CorrelationData } }
  correlationMatrix: jsonb("correlation_matrix").notNull().default({}),
  
  // Quick access indexes
  strongPositiveCorrelations: jsonb("strong_positive_correlations").default([]),
  strongNegativeCorrelations: jsonb("strong_negative_correlations").default([]),
  
  // Lookback period for this matrix
  lookbackPeriod: varchar("lookback_period", { length: 10 }).default('30d'),
  
  // Data quality
  completeness: integer("completeness"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matrixVersionIdx: index("correlation_matrices_matrix_version_idx").on(table.matrixVersion),
  graphVersionIdx: index("correlation_matrices_graph_version_idx").on(table.computedAgainstGraphVersion),
  timestampIdx: index("correlation_matrices_timestamp_idx").on(table.timestamp),
}));

/**
 * Asset State Snapshots (LEAN - NO GRAPH OR CORRELATIONS)
 * 
 * One snapshot per asset per update cycle ensures consistency.
 * Only stores core shard data (price, technical, yield, risk, liquidity).
 * 
 * Graph and correlations are stored separately and referenced by version number.
 * This prevents O(n²) bloat and allows independent updates.
 */
export const assetStateSnapshots = pgTable("asset_state_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Identity
  assetNodeId: varchar("asset_node_id", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // ========== CORE SHARD DATA (LIGHTWEIGHT) ==========
  
  // Price Shard (1-minute update cycle)
  priceUsd: decimal("price_usd", { precision: 18, scale: 8 }),
  priceConfidence: integer("price_confidence"), // 0-100
  priceSources: jsonb("price_sources").default([]),
  chainSpecificPrices: jsonb("chain_specific_prices").default({}),
  
  // Technical Shard (1-hour update cycle)
  technicalRsi14: decimal("technical_rsi14", { precision: 5, scale: 2 }),
  technicalMacdValue: decimal("technical_macd_value", { precision: 18, scale: 8 }),
  technicalMacdSignal: decimal("technical_macd_signal", { precision: 18, scale: 8 }),
  technicalMacdHistogram: decimal("technical_macd_histogram", { precision: 18, scale: 8 }),
  technicalTrend: varchar("technical_trend", { length: 30 }),
  technicalMomentum: integer("technical_momentum"),
  technicalSignals: jsonb("technical_signals").default({}),
  
  // Yield Shard (variable update cycle)
  yieldData: jsonb("yield_data").default({}),
  yieldEstimate30d: decimal("yield_estimate_30d", { precision: 18, scale: 8 }),
  yieldEstimate1y: decimal("yield_estimate_1y", { precision: 18, scale: 8 }),
  
  // Risk Shard (24-hour update cycle, DAO-weighted)
  riskSmartContractScore: integer("risk_smart_contract_score"),
  riskOracleScore: integer("risk_oracle_score"),
  riskGovernanceScore: integer("risk_governance_score"),
  riskLiquidationRisk: integer("risk_liquidation_risk"),
  riskOverallScore: integer("risk_overall_score"),
  riskWeightedByDaoType: jsonb("risk_weighted_by_dao_type").default({}),
  
  // Liquidity Shard (4-hour update cycle)
  liquidityDepth1pct: decimal("liquidity_depth_1pct", { precision: 18, scale: 2 }),
  liquidityDepth5pct: decimal("liquidity_depth_5pct", { precision: 18, scale: 2 }),
  liquidityByChain: jsonb("liquidity_by_chain").default({}),
  
  // ========== GRAPH REFERENCE (NOT EMBEDDED) ==========
  graphVersion: integer("graph_version").notNull().default(0),
  
  /**
   * Which correlation matrix version applies to this snapshot?
   * INDEPENDENT from graphVersion (correlation updates on different cycle)
   */
  correlationVersion: integer("correlation_version").notNull().default(0),
  
  // ========== SHARD UPDATE TRACKING ==========
  shardUpdateStatus: jsonb("shard_update_status").default({}),
  
  // Metadata
  isStale: boolean("is_stale").default(false),
  completeness: integer("completeness"), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  assetNodeIdIdx: index("asset_state_snapshots_asset_node_id_idx").on(table.assetNodeId),
  symbolIdx: index("asset_state_snapshots_symbol_idx").on(table.symbol),
  timestampIdx: index("asset_state_snapshots_timestamp_idx").on(table.timestamp),
  graphVersionIdx: index("asset_state_snapshots_graph_version_idx").on(table.graphVersion),
}));

// Pending Transactions table for queue management
export const pendingTransactions = pgTable("pending_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  transactionType: varchar("transaction_type").notNull(), // deposit, withdrawal, rebalance
  amount: decimal("amount", { precision: 18, scale: 8 }),
  tokenSymbol: varchar("token_symbol"),
  status: varchar("status").default("pending"), // pending, processing, completed, failed
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(5),
  txHash: varchar("tx_hash"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PendingTransaction = typeof pendingTransactions.$inferSelect;
export type InsertPendingTransaction = typeof pendingTransactions.$inferInsert;

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



// Treasury Multi-Sig Transactions
export const treasuryMultisigTransactions = pgTable("treasury_multisig_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  multisigWalletId: uuid("multisig_wallet_id").references(() => multisigWallets.id).notNull(),
  proposedBy: varchar("proposed_by").references(() => users.id).notNull(),
  transactionType: varchar("transaction_type").notNull(), // withdrawal, disbursement, budget_allocation
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency").default("cUSD"),
  recipient: varchar("recipient"), // wallet address or user ID
  purpose: text("purpose").notNull(),

  // ✅ On-chain execution tracking (for Gnosis Safe / trustless multisig)
  // contractFunction: the method to call on the deployed multisig contract
  contractFunction: varchar("contract_function"), // 'execTransaction', 'transfer', 'batchTransfer', etc.
  // params: the encoded parameters for the on-chain function call
  params: jsonb("params"), // {to, value, data, operation} for Gnosis Safe format

  // Multi-sig tracking (DB-managed workflow)
  requiredSignatures: integer("required_signatures").notNull(),
  currentSignatures: integer("current_signatures").default(0),
  signers: jsonb("signers").default([]), // array of {userId, signedAt, signature}

  // Status
  status: varchar("status").default("pending"), // pending, signed, submitted, executed, rejected, expired
  approvedAt: timestamp("approved_at"),
  // ✅ Execution on chain (NOT just DB update)
  submittedAt: timestamp("submitted_at"), // When we submitted the aggregated signatures to the multisig contract
  submittedTxHash: varchar("submitted_tx_hash"), // ✅ The actual on-chain transaction hash (proof of execution)
  executedAt: timestamp("executed_at"), // When the tx was mined / confirmed
  // DEPRECATED: executionTxHash → use submittedTxHash instead
  executionTxHash: varchar("execution_tx_hash"),
  expiresAt: timestamp("expires_at").notNull(), // 7 days expiry

  // Metadata
  metadata: jsonb("metadata"), // additional transaction details
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL APPROVAL & MULTISIG TABLES (Phase 4B)
// ════════════════════════════════════════════════════════════════════════════════

// Withdrawal Approvals - Tracks pending multisig approval requests for vault withdrawals
export const withdrawalApprovals = pgTable("withdrawal_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(), // Requester
  amount: decimal("amount", { precision: 25, scale: 8 }).notNull(),
  destination: varchar("destination").notNull(), // Address or recipient
  status: varchar("status").default("pending").notNull(), // pending|approved|rejected|executed|expired
  requiredSignatures: integer("required_signatures").notNull(),
  currentSignatures: integer("current_signatures").default(0).notNull(),
  signers: jsonb("signers").default([]).notNull(), // Array of signer info
  expiresAt: timestamp("expires_at").notNull(),
  executedAt: timestamp("executed_at"),
  executedBy: uuid("executed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Multisig Signatures - Tracks individual signer approvals
export const multisigSignatures = pgTable("multisig_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  approvalId: uuid("approval_id").references(() => withdrawalApprovals.id).notNull(),
  signerId: uuid("signer_id").references(() => users.id).notNull(),
  signerRole: varchar("signer_role").notNull(), // member|elder|admin
  signature: text("signature").notNull(), // Cryptographic signature or approval token
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address"), // IPv4 or IPv6
  isValid: boolean("is_valid").default(true).notNull(),
  verificationError: text("verification_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vault Withdrawal Tracking - Tracks daily withdrawal totals per vault
export const vaultWithdrawalTracking = pgTable("vault_withdrawal_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  vaultId: uuid("vault_id").references(() => vaults.id).notNull(),
  date: date("date").notNull(),
  dailyTotalWithdrawn: decimal("daily_total_withdrawn", { precision: 25, scale: 8 }).default("0").notNull(),
  withdrawalCount: integer("withdrawal_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVaultDate: unique().on(table.vaultId, table.date),
}));

// Treasury Budget Allocations
export const treasuryBudgetAllocations = pgTable("treasury_budget_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  category: varchar("category").notNull(), // operations, grants, development, marketing, etc.
  allocatedAmount: decimal("allocated_amount", { precision: 18, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 18, scale: 2 }).default("0"),
  remainingAmount: decimal("remaining_amount", { precision: 18, scale: 2 }).notNull(),
  period: varchar("period").notNull(), // monthly, quarterly, yearly
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treasury Audit Log
export const treasuryAuditLog = pgTable("treasury_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull(),
  actorId: varchar("actor_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(), // withdrawal, deposit, budget_change, signer_added, signer_removed
  amount: decimal("amount", { precision: 18, scale: 2 }),
  previousBalance: decimal("previous_balance", { precision: 18, scale: 2 }),
  newBalance: decimal("new_balance", { precision: 18, scale: 2 }),
  category: varchar("category"), // budget category if applicable
  reason: text("reason").notNull(),
  multisigTxId: uuid("multisig_tx_id").references(() => treasuryMultisigTransactions.id),
  transactionHash: varchar("transaction_hash"),
  ipAddress: varchar("ip_address"),
  metadata: jsonb("metadata"), // additional audit data
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type TreasuryMultisigTransaction = typeof treasuryMultisigTransactions.$inferSelect;
export type InsertTreasuryMultisigTransaction = typeof treasuryMultisigTransactions.$inferInsert;
export type TreasuryBudgetAllocation = typeof treasuryBudgetAllocations.$inferSelect;
export type InsertTreasuryBudgetAllocation = typeof treasuryBudgetAllocations.$inferInsert;
export type TreasuryAuditLog = typeof treasuryAuditLog.$inferSelect;
export type InsertTreasuryAuditLog = typeof treasuryAuditLog.$inferInsert;

// Treasury Reconciliation Audits - for on-chain validation and drift detection
export const treasuryReconciliationAudits = pgTable("treasury_reconciliation_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  reconciliationType: varchar("reconciliation_type").notNull(), // 'dao_treasury' | 'vault_balance' | 'multisig_transactions'
  entityId: uuid("entity_id").notNull(), // daoId or vaultId being reconciled
  computedValue: decimal("computed_value", { precision: 20, scale: 8 }).notNull(), // value from our computation
  onChainValue: decimal("on_chain_value", { precision: 20, scale: 8 }).notNull(), // value from blockchain
  discrepancy: decimal("discrepancy", { precision: 20, scale: 8 }).notNull(), // absolute difference
  discrepancyPercent: decimal("discrepancy_percent", { precision: 5, scale: 4 }).notNull(), // percentage difference (0.0500 = 5%)
  reconciliationStatus: varchar("reconciliation_status").default("matched").notNull(), // 'matched' | 'warning' | 'critical'
  lastOnChainCheck: timestamp("last_on_chain_check").notNull(), // when we last checked on-chain
  notes: text("notes"), // any additional notes about the discrepancy
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TreasuryReconciliationAudit = typeof treasuryReconciliationAudits.$inferSelect;
export type InsertTreasuryReconciliationAudit = typeof treasuryReconciliationAudits.$inferInsert;

// Withdrawal Approval Types
export type WithdrawalApproval = typeof withdrawalApprovals.$inferSelect;
export type InsertWithdrawalApproval = typeof withdrawalApprovals.$inferInsert;
export type MultisigSignature = typeof multisigSignatures.$inferSelect;
export type InsertMultisigSignature = typeof multisigSignatures.$inferInsert;
export type VaultWithdrawalTracking = typeof vaultWithdrawalTracking.$inferSelect;
export type InsertVaultWithdrawalTracking = typeof vaultWithdrawalTracking.$inferInsert;

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
  investedAt: timestamp("investedAt").defaultNow(),
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
  withdrawnAt: timestamp("withdrawnAt").defaultNow(),
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
  rebalancedAt: timestamp("rebalancedAt").defaultNow(),
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
  snapshot_at: timestamp("snapshot_at").defaultNow(),
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
  swappedAt: timestamp("swappedAt").defaultNow(),
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
  votedAt: timestamp("votedAt").defaultNow(),
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
  delegatedAt: timestamp("delegatedAt").defaultNow(),
  revokedAt: timestamp("revokedAt"),
});

// Add unique constraints to prevent duplicate likes (temporarily commented out for debugging)
// export const proposalLikesIndex = index("proposal_likes_unique").on(proposalLikes.proposalId, proposalLikes.userId);
//export const commentLikesIndex = index("comment_likes_unique").on(commentLikes.commentId, commentLikes.userId);

// Wallet Management
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  currency: varchar("currency").notNull(), // e.g., "KES", "USDC", "cUSD", "ETH"
  address: varchar("address").notNull().unique(), // wallet address
  walletType: varchar("wallet_type").default("personal"), // personal, dao, treasury, smart_contract
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Balance Tracking across wallets
export const userBalances = pgTable("user_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).default("0"),
  currency: varchar("currency").notNull(), // duplicate of wallet currency for quick access
  lockedBalance: decimal("locked_balance", { precision: 18, scale: 8 }).default("0"), // for staking/governance
  availableBalance: decimal("available_balance", { precision: 18, scale: 8 }).default("0"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Private Key Storage (encrypted)
export const walletPrivateKeys = pgTable("wallet_private_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // AES-256 encrypted
  encryptionIv: text("encryption_iv").notNull(), // initialization vector
  encryptionSalt: text("encryption_salt").notNull(), // salt for key derivation
  authTag: text("auth_tag").notNull(), // GCM auth tag for integrity verification
  keyDerivationFunction: varchar("key_derivation_function").default("pbkdf2"), // pbkdf2, argon2
  encryptionAlgorithm: varchar("encryption_algorithm").default("aes-256-gcm"),
  isBackedUp: boolean("is_backed_up").default(false),
  backupVerifiedAt: timestamp("backup_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Seed Phrase Backup (encrypted)
export const walletSeedPhrases = pgTable("wallet_seed_phrases", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull().unique(),
  encryptedSeedPhrase: text("encrypted_seed_phrase").notNull(), // AES-256 encrypted BIP39 mnemonic
  wordCount: integer("word_count").default(12), // 12, 24 words
  encryptionIv: text("encryption_iv").notNull(),
  encryptionSalt: text("encryption_salt").notNull(),
  authTag: text("auth_tag").notNull(),
  derivationPath: varchar("derivation_path").default("m/44'/60'/0'/0"), // BIP44 standard
  isBackedUp: boolean("is_backed_up").default(false),
  backupMethod: varchar("backup_method"), // encrypted_storage, hardware_wallet, user_saved
  backupVerifiedAt: timestamp("backup_verified_at"),
  backupLocation: varchar("backup_location"), // cloud, local, hybrid
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Public Keys
export const walletPublicKeys = pgTable("wallet_public_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull().unique(),
  publicKey: text("public_key").notNull(), // unencrypted public key
  publicKeyFormat: varchar("public_key_format").default("uncompressed"), // uncompressed, compressed
  derivationPath: varchar("derivation_path").default("m/44'/60'/0'/0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Security Settings
export const walletSecuritySettings = pgTable("wallet_security_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull().unique(),
  requiresPin: boolean("requires_pin").default(true),
  requiresBiometric: boolean("requires_biometric").default(false),
  encryptedPin: text("encrypted_pin"), // hashed PIN for local validation
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorMethod: varchar("two_factor_method"), // sms, email, authenticator
  withdrawalLimit: decimal("withdrawal_limit", { precision: 18, scale: 8 }), // daily limit
  whitelistedAddresses: jsonb("whitelisted_addresses").default([]), // array of approved recipient addresses
  requiresApprovalAboveThreshold: boolean("requires_approval_above_threshold").default(true),
  approvalThreshold: decimal("approval_threshold", { precision: 18, scale: 8 }),
  lastAccessAt: timestamp("last_access_at"),
  lastModifiedAt: timestamp("last_modified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Sessions - Track active wallet connections (PIN-based access)
export const walletSessions = pgTable("wallet_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionToken: varchar("session_token").unique().notNull(), // Unique token for this session
  isActive: boolean("is_active").default(true),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  disconnectedAt: timestamp("disconnected_at"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(), // Track usage for timeout
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  deviceId: varchar("device_id"),
  deviceName: varchar("device_name"), // e.g., "Chrome on Windows", "Safari on iPhone"
  expiresAt: timestamp("expires_at").notNull(), // Session timeout (e.g., 24 hours)
  lastActivityAt: timestamp("last_activity_at").defaultNow(), // For auto-extend
  autoExtendEnabled: boolean("auto_extend_enabled").default(true), // Auto-extend on activity
  warningShownAt: timestamp("warning_shown_at"), // Track if expiry warning shown
  biometricEnabled: boolean("biometric_enabled").default(false), // Was this session unlocked with biometric?
  location: varchar("location"), // Geolocation info
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet Access Log (audit trail)
export const walletAccessLog = pgTable("wallet_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar("action").notNull(), // view, send, receive, export, backup, modify_settings
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  deviceId: varchar("device_id"),
  status: varchar("status").default("success"), // success, failed, blocked
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Session Notifications - Alerts for new logins from other devices
export const sessionNotifications = pgTable("session_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid("session_id").references(() => walletSessions.id, { onDelete: 'cascade' }).notNull(),
  notificationType: varchar("notification_type").notNull(), // new_login, login_from_new_device, suspicious_activity
  title: varchar("title").notNull(),
  message: text("message"),
  deviceName: varchar("device_name"),
  location: varchar("location"),
  ipAddress: varchar("ip_address"),
  isRead: boolean("is_read").default(false),
  actionRequired: boolean("action_required").default(false), // e.g., approve login
  actionToken: varchar("action_token"), // Token for approval/denial
  actionExpiresAt: timestamp("action_expires_at"), // When action token expires
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// PIN Reset Requests - For resetting PIN via email/SMS
export const pinResetRequests = pgTable("pin_reset_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  resetToken: varchar("reset_token").unique().notNull(),
  resetMethod: varchar("reset_method").notNull(), // email, sms, security_question
  verificationSent: timestamp("verification_sent").defaultNow(),
  verificationCode: varchar("verification_code"), // For email/SMS verification
  verificationCodeExpiresAt: timestamp("verification_code_expires_at"),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  newPinHash: varchar("new_pin_hash"), // Hash of new PIN (not stored plaintext)
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(), // Reset request expires after 24 hours
  createdAt: timestamp("created_at").defaultNow(),
});

// Biometric Unlocks - Track which devices have biometric enabled
export const biometricSettings = pgTable("biometric_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  deviceId: varchar("device_id").notNull(),
  deviceName: varchar("device_name").notNull(),
  biometricType: varchar("biometric_type").notNull(), // fingerprint, face_id, iris, windows_hello
  biometricPublicKey: text("biometric_public_key"), // For verification
  isEnabled: boolean("is_enabled").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multisig Wallets - For DAO treasury and shared ownership
export const multisigWallets = pgTable("multisig_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: 'cascade' }).notNull().unique(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  // ✅ Must be a deployed Gnosis Safe or compatible multisig contract on-chain
  contractAddress: varchar("contract_address").notNull().unique(), // Smart contract address (on-chain)
  chain: varchar("chain").notNull(), // ethereum, polygon, arbitrum, optimism, etc.
  chainId: integer("chain_id").notNull(), // Which blockchain (1 for Ethereum, etc.)
  requiredSignatures: integer("required_signatures").notNull(), // M in M-of-N
  totalSigners: integer("total_signers").notNull(), // N in M-of-N
  walletStandard: varchar("wallet_standard").default("gnosis"), // gnosis, safe, multisig, custom
  // ✅ Deployment tracking for on-chain verification
  deployedAt: timestamp("deployed_at"), // When the multisig contract was deployed
  deploymentTxHash: varchar("deployment_tx_hash"), // Deployment transaction hash on-chain (for verification)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multisig Signers - Individual signers for multisig wallets
export const multisigSigners = pgTable("multisig_signers", {
  id: uuid("id").primaryKey().defaultRandom(),
  multisigWalletId: uuid("multisig_wallet_id").references(() => multisigWallets.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  signerAddress: varchar("signer_address").notNull(), // Individual signer's wallet address
  signerIndex: integer("signer_index").notNull(), // Order of signers (for deterministic ordering)
  role: varchar("role").default("signer"), // signer, lead_signer, validator
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  removedAt: timestamp("removed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multisig Creation Jobs - queued requests to create multisig wallets (processed by worker)
export const multisigCreationJobs = pgTable("multisig_creation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: varchar("job_id").notNull().unique(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  signers: jsonb("signers").default([]),
  requiredSignatures: integer("required_signatures").notNull(),
  chainId: integer("chain_id"),
  payload: jsonb("payload").default({}),
  status: varchar("status").default("queued"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Multisig Signer Keys - Private key data for each signer (NOT stored - reference only)
export const multisigSignerKeys = pgTable("multisig_signer_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  multisigSignerId: uuid("multisig_signer_id").references(() => multisigSigners.id, { onDelete: 'cascade' }).notNull().unique(),
  // NOTE: Private keys should NEVER be stored in the database
  // This table is for reference/metadata only
  keyStorageLocation: varchar("key_storage_location").notNull(), // hardware_wallet, key_management_service, encrypted_local
  keyManagementProvider: varchar("key_management_provider"), // aws_kms, azure_key_vault, hardware_wallet_id, none
  publicKeyHash: varchar("public_key_hash").notNull(), // Hash of public key for verification
  canSign: boolean("can_sign").default(true),
  lastSignedAt: timestamp("last_signed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multisig Transactions - Pending and executed transactions
export const multisigTransactions = pgTable("multisig_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  multisigWalletId: uuid("multisig_wallet_id").references(() => multisigWallets.id, { onDelete: 'cascade' }).notNull(),
  transactionHash: varchar("transaction_hash"), // On-chain transaction hash once executed
  recipient: varchar("recipient").notNull(), // Recipient address
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  data: text("data"), // Transaction data/payload
  status: varchar("status").default("pending"), // pending, approved, executed, rejected, expired
  currentSignatures: integer("current_signatures").default(0),
  requiredSignatures: integer("required_signatures").notNull(),
  proposedBy: varchar("proposed_by").references(() => users.id).notNull(),
  proposedAt: timestamp("proposed_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multisig Transaction Signatures - Individual signatures from each signer
export const multisigTransactionSignatures = pgTable("multisig_transaction_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  multisigTransactionId: uuid("multisig_transaction_id").references(() => multisigTransactions.id, { onDelete: 'cascade' }).notNull(),
  multisigSignerId: uuid("multisig_signer_id").references(() => multisigSigners.id, { onDelete: 'cascade' }).notNull(),
  signature: text("signature").notNull(), // Actual signature data
  signedAt: timestamp("signed_at").defaultNow(),
  signatureValid: boolean("signature_valid").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// DAO of the Week / Featured DAOs
export const daoOfTheWeek = pgTable("dao_of_the_week", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull().unique(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  rank: integer("rank").default(1), // 1st, 2nd, 3rd place
  reasons: text("reasons"), // Why this DAO was featured
  engagementScore: decimal("engagement_score", { precision: 10, scale: 2 }), // Calculated metric
  memberGrowth: integer("member_growth"), // New members this week
  proposalCount: integer("proposal_count"), // Active proposals
  transactionVolume: decimal("transaction_volume", { precision: 18, scale: 2 }), // Treasury activity
  isCurrent: boolean("is_current").default(false),
  featuredAt: timestamp("featured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Badges / Achievements
export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  badgeType: varchar("badge_type").notNull(), // founder, early_adopter, contributor, whale, thought_leader, etc.
  badgeName: varchar("badge_name").notNull(),
  description: text("description"),
  iconUrl: varchar("icon_url"),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  rarity: varchar("rarity").default("common"), // common, rare, epic, legendary
  metadata: jsonb("metadata").default({}), // Additional badge info
  createdAt: timestamp("created_at").defaultNow(),
});

// User Achievements / Milestones
export const userAchievements = pgTable("user_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  achievementType: varchar("achievement_type").notNull(), // first_dao, first_proposal, 100_contributions, etc.
  achievementName: varchar("achievement_name").notNull(),
  description: text("description"),
  progress: integer("progress").default(0), // Current progress (e.g., 75/100)
  targetProgress: integer("target_progress").notNull(), // Goal (e.g., 100)
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardCurrency: varchar("reward_currency").default("MTAA"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Ratings & Reviews
export const daoRatings = pgTable("dao_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  reviewTitle: varchar("review_title"),
  reviewContent: text("review_content"),
  aspects: jsonb("aspects").default({}), // {governance: 4, transparency: 5, growth: 3}
  isVerifiedMember: boolean("is_verified_member").default(false),
  helpfulCount: integer("helpful_count").default(0),
  status: varchar("status").default("published"), // published, pending_review, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Leaderboards
export const leaderboards = pgTable("leaderboards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  leaderboardType: varchar("leaderboard_type").notNull(), // contributions, governance, earnings, growth, etc.
  rank: integer("rank"),
  score: decimal("score", { precision: 18, scale: 2 }).notNull(),
  period: varchar("period").default("all_time"), // weekly, monthly, all_time
  periodStartDate: timestamp("period_start_date"),
  periodEndDate: timestamp("period_end_date"),
  previousRank: integer("previous_rank"), // For tracking movement
  movementIndicator: integer("movement_indicator"), // +/- for leaderboard changes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Engagement Metrics
export const daoEngagementMetrics = pgTable("dao_engagement_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  period: varchar("period").notNull(), // daily, weekly, monthly
  periodDate: timestamp("period_date").notNull(),
  activeMembers: integer("active_members").default(0),
  newMembers: integer("new_members").default(0),
  proposalsCreated: integer("proposals_created").default(0),
  proposalsPassed: integer("proposals_passed").default(0),
  votesParticipation: decimal("votes_participation", { precision: 5, scale: 2 }).default("0"), // percentage
  transactionCount: integer("transaction_count").default(0),
  transactionVolume: decimal("transaction_volume", { precision: 18, scale: 2 }).default("0"),
  treasuryBalance: decimal("treasury_balance", { precision: 18, scale: 2 }).default("0"),
  engagementScore: decimal("engagement_score", { precision: 10, scale: 2 }).default("0"), // Calculated
  createdAt: timestamp("created_at").defaultNow(),
});

// Content / Blog Posts for DAOs
export const daoContent = pgTable("dao_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }).notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  contentType: varchar("content_type").notNull(), // blog, announcement, update, tutorial
  title: varchar("title").notNull(),
  slug: varchar("slug").unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  coverImage: varchar("cover_image"),
  tags: jsonb("tags").default([]),
  status: varchar("status").default("draft"), // draft, published, archived
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content Moderation - Report/Flag system
export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: varchar("reporter_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentType: varchar("content_type").notNull(), // proposal, comment, message, content, user
  contentId: uuid("content_id").notNull(), // ID of reported content
  reason: varchar("reason").notNull(), // spam, harassment, inappropriate, scam, illegal, other
  description: text("description"),
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  moderatorId: varchar("moderator_id").references(() => users.id),
  moderatorAction: varchar("moderator_action"), // warning, suspend, ban, delete, dismiss
  moderatorNotes: text("moderator_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Moderation History
export const userModerationLog = pgTable("user_moderation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar("action").notNull(), // warning, mute, suspend, ban, restore
  reason: text("reason").notNull(),
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  duration: integer("duration"), // Duration in hours (null = permanent)
  expiresAt: timestamp("expires_at"),
  moderatorId: varchar("moderator_id").references(() => users.id).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC (Know Your Customer) Data
export const userKyc = pgTable("user_kyc", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  fullName: varchar("full_name"),
  dateOfBirth: varchar("date_of_birth"), // YYYY-MM-DD format
  nationalId: varchar("national_id"),
  nationalIdType: varchar("national_id_type"), // passport, driver_license, national_id
  country: varchar("country"),
  address: text("address"),
  city: varchar("city"),
  postalCode: varchar("postal_code"),
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  documentHash: varchar("document_hash"), // Hash of uploaded document for verification
  riskLevel: varchar("risk_level").default("low"), // low, medium, high
  amlScreeningStatus: varchar("aml_screening_status"), // passed, failed, pending
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Preferences
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  inAppNotifications: boolean("in_app_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  proposalUpdates: boolean("proposal_updates").default(true),
  treasuryUpdates: boolean("treasury_updates").default(true),
  membershipUpdates: boolean("membership_updates").default(true),
  votingReminders: boolean("voting_reminders").default(true),
  daoAnnouncements: boolean("dao_announcements").default(true),
  weeklyDigest: boolean("weekly_digest").default(false),
  dailyDigest: boolean("daily_digest").default(false),
  unsubscribeAll: boolean("unsubscribe_all").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Follows - Follow users or DAOs for updates
export const userFollows = pgTable("user_follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: varchar("follower_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  followingId: varchar("following_id").references(() => users.id, { onDelete: 'cascade' }),
  followingDaoId: uuid("following_dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  followType: varchar("follow_type").default("user"), // user, dao
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity Feed - Unified activity log
export const activityFeed = pgTable("activity_feed", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  daoId: uuid("dao_id").references(() => daos.id, { onDelete: 'cascade' }),
  activityType: varchar("activity_type").notNull(), // proposal_created, voted, contributed, member_joined, etc.
  actorId: varchar("actor_id").references(() => users.id),
  relatedEntityType: varchar("related_entity_type"), // proposal, dao, user, contribution
  relatedEntityId: varchar("related_entity_id"),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  visibility: varchar("visibility").default("public"), // public, private, dao
  createdAt: timestamp("created_at").defaultNow(),
});

// API Keys for Developer Integration
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  keyHash: varchar("key_hash").notNull().unique(), // Hash of actual key (never store plain key)
  name: varchar("name").notNull(), // User-friendly name for the key
  permissions: jsonb("permissions").default([]), // Array of permission scopes
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  ipWhitelist: jsonb("ip_whitelist").default([]), // Array of whitelisted IPs
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File Uploads Metadata
export const fileUploads = pgTable("file_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // image, document, video, etc.
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  storagePath: varchar("storage_path").notNull(), // S3/Cloud storage path
  fileHash: varchar("file_hash"), // SHA-256 hash for deduplication
  isPublic: boolean("is_public").default(false),
  relatedEntityType: varchar("related_entity_type"), // user, dao, proposal, content
  relatedEntityId: varchar("related_entity_id"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
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
  proposalComments: many(proposalComments),
  proposalLikes: many(proposalLikes),
  commentLikes: many(commentLikes),
  daoMessages: many(daoMessages),
  delegationsGiven: many(voteDelegations, { relationName: "delegationsGiven" }),
  delegationsReceived: many(voteDelegations, { relationName: "delegationsReceived" }),
  wallets: many(wallets),
  balances: many(userBalances),
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

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [wallets.daoId],
    references: [daos.id],
  }),
  balances: many(userBalances),
  privateKey: one(walletPrivateKeys),
  seedPhrase: one(walletSeedPhrases),
  publicKey: one(walletPublicKeys),
  securitySettings: one(walletSecuritySettings),
  accessLogs: many(walletAccessLog),
  sessions: many(walletSessions),
}));

export const userBalancesRelations = relations(userBalances, ({ one }) => ({
  user: one(users, {
    fields: [userBalances.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [userBalances.walletId],
    references: [wallets.id],
  }),
}));

export const walletPrivateKeysRelations = relations(walletPrivateKeys, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletPrivateKeys.walletId],
    references: [wallets.id],
  }),
}));

export const walletSeedPhrasesRelations = relations(walletSeedPhrases, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletSeedPhrases.walletId],
    references: [wallets.id],
  }),
}));

export const walletPublicKeysRelations = relations(walletPublicKeys, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletPublicKeys.walletId],
    references: [wallets.id],
  }),
}));

export const walletSecuritySettingsRelations = relations(walletSecuritySettings, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletSecuritySettings.walletId],
    references: [wallets.id],
  }),
}));

export const walletSessionsRelations = relations(walletSessions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletSessions.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletSessions.userId],
    references: [users.id],
  }),
}));

export const walletAccessLogRelations = relations(walletAccessLog, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletAccessLog.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletAccessLog.userId],
    references: [users.id],
  }),
}));

export const multisigWalletsRelations = relations(multisigWallets, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [multisigWallets.walletId],
    references: [wallets.id],
  }),
  dao: one(daos, {
    fields: [multisigWallets.daoId],
    references: [daos.id],
  }),
  signers: many(multisigSigners),
  transactions: many(multisigTransactions),
}));

export const multisigSignersRelations = relations(multisigSigners, ({ one, many }) => ({
  multisigWallet: one(multisigWallets, {
    fields: [multisigSigners.multisigWalletId],
    references: [multisigWallets.id],
  }),
  user: one(users, {
    fields: [multisigSigners.userId],
    references: [users.id],
  }),
  signerKeys: one(multisigSignerKeys),
  signatures: many(multisigTransactionSignatures),
}));

export const multisigSignerKeysRelations = relations(multisigSignerKeys, ({ one }) => ({
  multisigSigner: one(multisigSigners, {
    fields: [multisigSignerKeys.multisigSignerId],
    references: [multisigSigners.id],
  }),
}));

export const multisigTransactionsRelations = relations(multisigTransactions, ({ one, many }) => ({
  multisigWallet: one(multisigWallets, {
    fields: [multisigTransactions.multisigWalletId],
    references: [multisigWallets.id],
  }),
  proposedByUser: one(users, {
    fields: [multisigTransactions.proposedBy],
    references: [users.id],
  }),
  executedByUser: one(users, {
    fields: [multisigTransactions.executedBy],
    references: [users.id],
  }),
  rejectedByUser: one(users, {
    fields: [multisigTransactions.rejectedBy],
    references: [users.id],
  }),
  signatures: many(multisigTransactionSignatures),
}));

export const multisigTransactionSignaturesRelations = relations(multisigTransactionSignatures, ({ one }) => ({
  multisigTransaction: one(multisigTransactions, {
    fields: [multisigTransactionSignatures.multisigTransactionId],
    references: [multisigTransactions.id],
  }),
  multisigSigner: one(multisigSigners, {
    fields: [multisigTransactionSignatures.multisigSignerId],
    references: [multisigSigners.id],
  }),
}));

export const daoOfTheWeekRelations = relations(daoOfTheWeek, ({ one }) => ({
  dao: one(daos, {
    fields: [daoOfTheWeek.daoId],
    references: [daos.id],
  }),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
}));

export const daoRatingsRelations = relations(daoRatings, ({ one }) => ({
  dao: one(daos, {
    fields: [daoRatings.daoId],
    references: [daos.id],
  }),
  user: one(users, {
    fields: [daoRatings.userId],
    references: [users.id],
  }),
}));

export const leaderboardsRelations = relations(leaderboards, ({ one }) => ({
  user: one(users, {
    fields: [leaderboards.userId],
    references: [users.id],
  }),
}));

export const daoEngagementMetricsRelations = relations(daoEngagementMetrics, ({ one }) => ({
  dao: one(daos, {
    fields: [daoEngagementMetrics.daoId],
    references: [daos.id],
  }),
}));

export const daoContentRelations = relations(daoContent, ({ one }) => ({
  dao: one(daos, {
    fields: [daoContent.daoId],
    references: [daos.id],
  }),
  author: one(users, {
    fields: [daoContent.authorId],
    references: [users.id],
  }),
}));

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
  reporter: one(users, {
    fields: [contentReports.reporterId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [contentReports.moderatorId],
    references: [users.id],
  }),
}));

export const userModerationLogRelations = relations(userModerationLog, ({ one }) => ({
  user: one(users, {
    fields: [userModerationLog.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [userModerationLog.moderatorId],
    references: [users.id],
  }),
  revokedBy: one(users, {
    fields: [userModerationLog.revokedBy],
    references: [users.id],
  }),
}));

export const userKycRelations = relations(userKyc, ({ one }) => ({
  user: one(users, {
    fields: [userKyc.userId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [userKyc.verifiedBy],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
  }),
  followingDao: one(daos, {
    fields: [userFollows.followingDaoId],
    references: [daos.id],
  }),
}));

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  user: one(users, {
    fields: [activityFeed.userId],
    references: [users.id],
  }),
  dao: one(daos, {
    fields: [activityFeed.daoId],
    references: [daos.id],
  }),
  actor: one(users, {
    fields: [activityFeed.actorId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
  user: one(users, {
    fields: [fileUploads.userId],
    references: [users.id],
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
export const insertDaoContributionTypeSchema = createInsertSchema(daoContributionTypes);
export const insertDaoContributionSchema = createInsertSchema(daoContributions);
export const insertDaoContributionApprovalSchema = createInsertSchema(daoContributionApprovals);
export const insertDaoMultisigConfigSchema = createInsertSchema(daoMultisigConfig);
export const insertTreasuryWithdrawalApprovalSchema = createInsertSchema(treasuryWithdrawalApprovals);
export const insertReferralRewardSchema = createInsertSchema(referralRewards);
export const insertWalletSchema = createInsertSchema(wallets);
export const insertUserBalanceSchema = createInsertSchema(userBalances);
export const insertWalletPrivateKeySchema = createInsertSchema(walletPrivateKeys);
export const insertWalletSeedPhraseSchema = createInsertSchema(walletSeedPhrases);
export const insertWalletPublicKeySchema = createInsertSchema(walletPublicKeys);
export const insertWalletSecuritySettingsSchema = createInsertSchema(walletSecuritySettings);
export const insertWalletAccessLogSchema = createInsertSchema(walletAccessLog);
export const insertMultisigWalletSchema = createInsertSchema(multisigWallets);
export const insertMultisigSignerSchema = createInsertSchema(multisigSigners);
export const insertMultisigSignerKeysSchema = createInsertSchema(multisigSignerKeys);
export const insertMultisigTransactionSchema = createInsertSchema(multisigTransactions);
export const insertMultisigTransactionSignaturesSchema = createInsertSchema(multisigTransactionSignatures);
export const insertDaoOfTheWeekSchema = createInsertSchema(daoOfTheWeek);
export const insertUserBadgeSchema = createInsertSchema(userBadges);
export const insertUserAchievementSchema = createInsertSchema(userAchievements);
export const insertDaoRatingSchema = createInsertSchema(daoRatings);
export const insertLeaderboardSchema = createInsertSchema(leaderboards);
export const insertDaoEngagementMetricSchema = createInsertSchema(daoEngagementMetrics);
export const insertDaoContentSchema = createInsertSchema(daoContent);
export const insertContentReportSchema = createInsertSchema(contentReports);
export const insertUserModerationLogSchema = createInsertSchema(userModerationLog);
export const insertUserKycSchema = createInsertSchema(userKyc);
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences);
export const insertUserFollowSchema = createInsertSchema(userFollows);
export const insertActivityFeedSchema = createInsertSchema(activityFeed);
export const insertApiKeySchema = createInsertSchema(apiKeys);
export const insertFileUploadSchema = createInsertSchema(fileUploads);


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
export type DaoContributionType = typeof daoContributionTypes.$inferSelect;
export type InsertDaoContributionType = typeof daoContributionTypes.$inferInsert;
export type DaoContribution = typeof daoContributions.$inferSelect;
export type InsertDaoContribution = typeof daoContributions.$inferInsert;
export type DaoContributionApproval = typeof daoContributionApprovals.$inferSelect;
export type InsertDaoContributionApproval = typeof daoContributionApprovals.$inferInsert;
export type DaoMultisigConfig = typeof daoMultisigConfig.$inferSelect;
export type InsertDaoMultisigConfig = typeof daoMultisigConfig.$inferInsert;
export type TreasuryWithdrawalApproval = typeof treasuryWithdrawalApprovals.$inferSelect;
export type InsertTreasuryWithdrawalApproval = typeof treasuryWithdrawalApprovals.$inferInsert;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TaskHistory = typeof taskHistory.$inferSelect;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type VoteDelegation = typeof voteDelegations.$inferSelect;
export type QuorumHistory = typeof quorumHistory.$inferSelect;
export type ProposalExecutionQueue = typeof proposalExecutionQueue.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type UserBalance = typeof userBalances.$inferSelect;
export type InsertUserBalance = typeof userBalances.$inferInsert;
export type WalletPrivateKey = typeof walletPrivateKeys.$inferSelect;
export type InsertWalletPrivateKey = typeof walletPrivateKeys.$inferInsert;
export type WalletSeedPhrase = typeof walletSeedPhrases.$inferSelect;
export type InsertWalletSeedPhrase = typeof walletSeedPhrases.$inferInsert;
export type WalletPublicKey = typeof walletPublicKeys.$inferSelect;
export type InsertWalletPublicKey = typeof walletPublicKeys.$inferInsert;
export type WalletSecuritySettings = typeof walletSecuritySettings.$inferSelect;
export type InsertWalletSecuritySettings = typeof walletSecuritySettings.$inferInsert;
export type WalletSession = typeof walletSessions.$inferSelect;
export type InsertWalletSession = typeof walletSessions.$inferInsert;
export type WalletAccessLog = typeof walletAccessLog.$inferSelect;
export type InsertWalletAccessLog = typeof walletAccessLog.$inferInsert;
export type MultisigWallet = typeof multisigWallets.$inferSelect;
export type InsertMultisigWallet = typeof multisigWallets.$inferInsert;
export type MultisigSigner = typeof multisigSigners.$inferSelect;
export type InsertMultisigSigner = typeof multisigSigners.$inferInsert;
export type MultisigSignerKeys = typeof multisigSignerKeys.$inferSelect;
export type InsertMultisigSignerKeys = typeof multisigSignerKeys.$inferInsert;
export type MultisigTransaction = typeof multisigTransactions.$inferSelect;
export type InsertMultisigTransaction = typeof multisigTransactions.$inferInsert;
export type MultisigTransactionSignature = typeof multisigTransactionSignatures.$inferSelect;
export type InsertMultisigTransactionSignature = typeof multisigTransactionSignatures.$inferInsert;
export type DaoOfTheWeek = typeof daoOfTheWeek.$inferSelect;
export type InsertDaoOfTheWeek = typeof daoOfTheWeek.$inferInsert;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;
export type DaoRating = typeof daoRatings.$inferSelect;
export type InsertDaoRating = typeof daoRatings.$inferInsert;
export type Leaderboard = typeof leaderboards.$inferSelect;
export type InsertLeaderboard = typeof leaderboards.$inferInsert;
export type DaoEngagementMetric = typeof daoEngagementMetrics.$inferSelect;
export type InsertDaoEngagementMetric = typeof daoEngagementMetrics.$inferInsert;
export type DaoContent = typeof daoContent.$inferSelect;
export type InsertDaoContent = typeof daoContent.$inferInsert;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = typeof contentReports.$inferInsert;
export type UserModerationLog = typeof userModerationLog.$inferSelect;
export type InsertUserModerationLog = typeof userModerationLog.$inferInsert;
export type UserKyc = typeof userKyc.$inferSelect;
export type InsertUserKyc = typeof userKyc.$inferInsert;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = typeof userFollows.$inferInsert;
export type ActivityFeedEntry = typeof activityFeed.$inferSelect;
export type InsertActivityFeedEntry = typeof activityFeed.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = typeof fileUploads.$inferInsert;


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
// DAO Invites table
export const daoInvites = pgTable('dao_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  dao_id: uuid('dao_id').references(() => daos.id).notNull(),
  inviter_id: varchar('inviter_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  used: boolean('used').default(false),
  accepted_by: varchar('accepted_by').references(() => users.id),
  accepted_at: timestamp('accepted_at'),
  revoked: boolean('revoked').default(false),
  revoked_at: timestamp('revoked_at'),
  revoked_by: varchar('revoked_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
});

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

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: serial("ticket_number"),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  category: varchar("category").notNull(), // general, billing, technical, partnership
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("open"), // open, in_progress, resolved, closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Success stories table
export const successStories = pgTable("success_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  title: text("title").notNull(),
  story: text("story").notNull(),
  impact: text("impact"),
  metrics: jsonb("metrics"), // e.g., { earnings: 1000, members: 50 }
  status: varchar("status").default("pending_review"), // pending_review, approved, published, rejected
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});

// Vouchers table
export const vouchers = pgTable("vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code").unique().notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  token: varchar("token").notNull(), // cUSD, cEUR, MTAA, etc
  message: text("message"),
  expiryDate: timestamp("expiry_date").notNull(),
  redeemedBy: varchar("redeemed_by").references(() => users.id),
  redeemedAt: timestamp("redeemed_at"),
  status: varchar("status").default("active"), // active, redeemed, expired, revoked
  createdAt: timestamp("created_at").defaultNow(),
});

// New type exports
export type ProposalComment = typeof proposalComments.$inferSelect;
export type ProposalLike = typeof proposalLikes.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type DaoMessage = typeof daoMessages.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type SuccessStory = typeof successStories.$inferSelect;
export type Voucher = typeof vouchers.$inferSelect;

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

// User Contexts types and schemas
export type UserContext = typeof userContexts.$inferSelect;
export type InsertUserContext = typeof userContexts.$inferInsert;
export const insertUserContextSchema = createInsertSchema(userContexts);

// Phase 3: Rules Engine Tables
export const ruleTemplates = pgTable("rule_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull().unique(),
  category: varchar("category").notNull(), // 'entry', 'withdrawal', 'rotation', 'financial', 'governance'
  description: text("description"),
  ruleConfig: jsonb("rule_config").notNull(), // Contains conditions and actions
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const daoRules = pgTable("dao_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => ruleTemplates.id),
  name: varchar("name").notNull(),
  description: text("description"),
  eventType: varchar("event_type").notNull(), // 'member_entry', 'member_exit', 'proposal', 'contribution', 'rotation', 'withdrawal'
  ruleConfig: jsonb("rule_config").notNull(), // Contains conditions and actions
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(100), // Higher number = higher priority
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const ruleExecutions = pgTable("rule_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => daoRules.id, { onDelete: "cascade" }),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(), // 'member_entry', 'member_exit', etc.
  context: jsonb("context").notNull(), // The data that triggered the rule
  conditionsMet: boolean("conditions_met").notNull(),
  actionsExecuted: jsonb("actions_executed").default(sql`'[]'::jsonb`), // Array of executed actions
  executionResult: varchar("execution_result").notNull(), // 'success', 'failed', 'partial'
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  executedAt: timestamp("executed_at").defaultNow(),
  executedBy: varchar("executed_by").references(() => users.id),
});

// ========== MARKET NERVOUS SYSTEM TYPES ==========
// Treasury Position Types
export type TreasuryPosition = typeof treasuryPositions.$inferSelect;
export type InsertTreasuryPosition = typeof treasuryPositions.$inferInsert;

// Asset State Snapshot Types
export type AssetStateSnapshot = typeof assetStateSnapshots.$inferSelect;
export type InsertAssetStateSnapshot = typeof assetStateSnapshots.$inferInsert;

// Asset Node & Edge Types (separated from versions)
export type AssetNode = typeof assetNodes.$inferSelect;
export type InsertAssetNode = typeof assetNodes.$inferInsert;
export type AssetEdge = typeof assetEdges.$inferSelect;
export type InsertAssetEdge = typeof assetEdges.$inferInsert;

// Asset Graph Version Types
export type AssetGraphVersion = typeof assetGraphVersions.$inferSelect;
export type InsertAssetGraphVersion = typeof assetGraphVersions.$inferInsert;

// Correlation Matrix Types
export type CorrelationMatrix = typeof correlationMatrices.$inferSelect;
export type InsertCorrelationMatrix = typeof correlationMatrices.$inferInsert;

// Zod schemas for Market Nervous System
export const insertTreasuryPositionSchema = createInsertSchema(treasuryPositions);
export const insertAssetStateSnapshotSchema = createInsertSchema(assetStateSnapshots);
export const insertAssetNodeSchema = createInsertSchema(assetNodes);
export const insertAssetEdgeSchema = createInsertSchema(assetEdges);
export const insertAssetGraphVersionSchema = createInsertSchema(assetGraphVersions);
export const insertCorrelationMatrixSchema = createInsertSchema(correlationMatrices);

// Rules Engine Types
export type RuleTemplate = typeof ruleTemplates.$inferSelect;
export type InsertRuleTemplate = typeof ruleTemplates.$inferInsert;
export type DaoRule = typeof daoRules.$inferSelect;
export type InsertDaoRule = typeof daoRules.$inferInsert;
export type RuleExecution = typeof ruleExecutions.$inferSelect;
export type InsertRuleExecution = typeof ruleExecutions.$inferInsert;

// Zod schemas for Rules Engine
export const insertRuleTemplateSchema = createInsertSchema(ruleTemplates);
export const insertDaoRuleSchema = createInsertSchema(daoRules);
export const insertRuleExecutionSchema = createInsertSchema(ruleExecutions);

// === PHASE 3: SMART ORDER ROUTER - LIMIT ORDERS TABLE ===
export const limitOrders = pgTable("limit_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  exchange: varchar("exchange", { length: 50 }).notNull(), // 'binance', 'coinbase', etc
  orderId: varchar("order_id", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: varchar("side", { length: 10 }).notNull(), // 'buy' or 'sell'
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  status: varchar("status", { length: 20 }).default('pending').notNull(), // 'pending', 'filled', 'canceled', 'expired'
  filledAmount: numeric("filled_amount", { precision: 20, scale: 8 }).default('0'),
  filledPrice: numeric("filled_price", { precision: 20, scale: 8 }),
  fee: numeric("fee", { precision: 20, scale: 8 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
  expiresAt: timestamp("expires_at").notNull(),
  canceledAt: timestamp("canceled_at"),
  lastCheckedAt: timestamp("last_checked_at"),
});

// Limit Orders Types
export type LimitOrder = typeof limitOrders.$inferSelect;
export type InsertLimitOrder = typeof limitOrders.$inferInsert;

// Zod schema for Limit Orders
export const insertLimitOrderSchema = createInsertSchema(limitOrders);

// Bill Split Tables
export const billSplits = pgTable("bill_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: varchar("creator_id").notNull(),
  daoId: uuid("dao_id"),
  title: varchar("title").notNull(),
  description: text("description"),
  totalAmount: decimal("total_amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("cUSD"),
  splitMethod: varchar("split_method", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const billSplitParticipants = pgTable("bill_split_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  billSplitId: uuid("bill_split_id").notNull().references(() => billSplits.id, { onDelete: 'cascade' }),
  userId: varchar("user_id"),
  daoId: uuid("dao_id"),
  walletAddress: varchar("wallet_address"),
  sharePercentage: decimal("share_percentage", { precision: 5, scale: 2 }),
  customAmount: decimal("custom_amount", { precision: 18, scale: 8 }),
  amountOwed: decimal("amount_owed", { precision: 18, scale: 8 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 18, scale: 8 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  transactionHash: varchar("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treasury Health History - Track treasury health over time for monitoring
export const treasuryHealthHistory = pgTable("treasury_health_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: 'cascade' }),
  healthStatus: varchar("health_status", { length: 20 }).notNull(), // 'healthy', 'caution', 'critical'
  healthScore: integer("health_score").notNull(), // 0-100
  
  // Key metrics at time of snapshot
  assetCount: integer("asset_count").default(0),
  totalValueUsd: decimal("total_value_usd", { precision: 18, scale: 2 }),
  stableExposurePercent: decimal("stable_exposure_percent", { precision: 5, scale: 2 }),
  volatileExposurePercent: decimal("volatile_exposure_percent", { precision: 5, scale: 2 }),
  yieldExposurePercent: decimal("yield_exposure_percent", { precision: 5, scale: 2 }),
  
  // Risk metrics
  assetConcentration: decimal("asset_concentration", { precision: 5, scale: 4 }), // 0-1
  chainConcentration: decimal("chain_concentration", { precision: 5, scale: 4 }), // 0-1
  chainCount: integer("chain_count").default(1),
  
  // Alerts and recommendations
  alertCount: integer("alert_count").default(0),
  recommendationCount: integer("recommendation_count").default(0),
  
  // Metadata
  snapshotReason: varchar("snapshot_reason", { length: 50 }), // 'scheduled', 'manual', 'webhook'
  metadata: jsonb("metadata").default({}), // Store full intelligence for future analysis
  
  recordedAt: timestamp("recorded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TreasuryHealthHistory = typeof treasuryHealthHistory.$inferSelect;
export type InsertTreasuryHealthHistory = typeof treasuryHealthHistory.$inferInsert;

// Bridge Transfers
export const bridgeTransfers = pgTable("bridge_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceChain: varchar("source_chain", { length: 50 }).notNull(),
  destinationChain: varchar("destination_chain", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  tokenAddress: varchar("token_address", { length: 255 }).notNull(),
  fromAddress: varchar("from_address", { length: 255 }).notNull(),
  toAddress: varchar("to_address", { length: 255 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const billSplitPayments = pgTable("bill_split_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billSplitId: uuid("bill_split_id").notNull().references(() => billSplits.id, { onDelete: 'cascade' }),
  paymentId: uuid("payment_id").references(() => billSplitParticipants.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  transactionHash: varchar("transaction_hash").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  confirmedAt: timestamp("confirmed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bill Split Types
export type BillSplit = typeof billSplits.$inferSelect;
export type InsertBillSplit = typeof billSplits.$inferInsert;
export type BillSplitParticipant = typeof billSplitParticipants.$inferSelect;
export type InsertBillSplitParticipant = typeof billSplitParticipants.$inferInsert;
export type BillSplitPayment = typeof billSplitPayments.$inferSelect;
export type InsertBillSplitPayment = typeof billSplitPayments.$inferInsert;

// Bridge Transfer Types
export type BridgeTransfer = typeof bridgeTransfers.$inferSelect;
export type InsertBridgeTransfer = typeof bridgeTransfers.$inferInsert;

// ============================================================================
// PHASE 2: TREASURY CONTROLS - Whitelist, Amount Limits, Multisig Approvals
// ============================================================================

/**
 * Treasury Whitelist - Recipient address approval (Ethereum addresses)
 * Categories: charity, payments, team, disbursements, other
 * All treasury transfers must be to whitelisted addresses
 * Admin must approve new whitelist entries
 */
export const treasuryWhitelist = pgTable("treasury_whitelist", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: 'cascade' }),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(), // 0x + 40 hex chars
  category: varchar("category", { length: 20 }).notNull(), // charity, payments, team, disbursements, other
  recipientName: text("recipient_name"),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected, revoked
  approvedBy: varchar("approved_by").references(() => users.id), // Admin who approved
  approvedAt: timestamp("approved_at"),
  expiresAt: timestamp("expires_at"), // Optional: expiration date for temporary approvals
  requestedBy: varchar("requested_by").notNull().references(() => users.id), // User who requested
  rejectionReason: text("rejection_reason"), // Reason for rejection if status='rejected'
  metadata: jsonb("metadata").default({}), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  daoIdIdx: index("treasury_whitelist_dao_id_idx").on(table.daoId),
  walletAddressIdx: index("treasury_whitelist_wallet_address_idx").on(table.walletAddress),
  statusIdx: index("treasury_whitelist_status_idx").on(table.status),
  daoWalletUnique: sql`UNIQUE(dao_id, wallet_address)`, // One entry per address per DAO
}));

/**
 * Treasury Limits - Per-DAO configuration for transfer restrictions
 * Controls daily caps, single transfer maximums, multisig thresholds
 * One record per DAO with configurable parameters
 */
export const treasuryLimits = pgTable("treasury_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: 'cascade' }),
  dailyCapPercentage: decimal("daily_cap_percentage", { precision: 5, scale: 2 }).notNull().default("10"), // Max % of treasury per day
  singleTransferMaxPercentage: decimal("single_transfer_max_percentage", { precision: 5, scale: 2 }).notNull().default("20"), // Max % per single transfer
  multisigThresholdUSD: decimal("multisig_threshold_usd", { precision: 18, scale: 2 }).notNull().default("10000"), // Threshold in USD that requires multisig
  multisigRequiredSignatures: integer("multisig_required_signatures").notNull().default(2), // Number of signatures needed (e.g., 2 of 3)
  multisigWindowDays: integer("multisig_window_days").notNull().default(7), // Days to collect signatures (7 = 7-day expiration)
  updatedBy: varchar("updated_by").references(() => users.id), // Admin who last updated
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  daoIdUnique: sql`UNIQUE(dao_id)`, // One config per DAO
  daoIdIdx: index("treasury_limits_dao_id_idx").on(table.daoId),
}));

/**
 * Treasury Approvals - Multisig approval tracking for large transfers
 * Stores pending multisig requests and signature collection
 * Transfers > multisigThresholdUSD need N signatures to execute
 * Expires after multisigWindowDays with no execution
 */
export const treasuryApprovals = pgTable("treasury_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: 'cascade' }),
  transactionId: varchar("transaction_id"), // Reference to original transaction/proposal
  recipientAddress: varchar("recipient_address", { length: 42 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(), // Amount in token
  amountUSD: decimal("amount_usd", { precision: 18, scale: 2 }).notNull(), // Amount in USD for comparison
  description: text("description"), // Purpose/reason for transfer
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected, executed, expired
  requiredSignatures: integer("required_signatures").notNull(), // How many signatures needed (set at creation)
  
  // Signature tracking - stored as JSONB array of {signerId, signature, signedAt}
  signatures: jsonb("signatures").default(sql`'[]'::jsonb`), 
  
  rejectionReason: text("rejection_reason"), // Reason if status='rejected'
  rejectedBy: varchar("rejected_by").references(() => users.id), // Admin who rejected
  rejectedAt: timestamp("rejected_at"),
  
  executedAt: timestamp("executed_at"), // When transfer was actually executed
  executedBy: varchar("executed_by").references(() => users.id), // User who executed
  
  expiresAt: timestamp("expires_at").notNull(), // Approval expires (7 days from creation by default)
  createdBy: varchar("created_by").notNull().references(() => users.id), // User who requested transfer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  daoIdIdx: index("treasury_approvals_dao_id_idx").on(table.daoId),
  statusIdx: index("treasury_approvals_status_idx").on(table.status),
  expiresAtIdx: index("treasury_approvals_expires_at_idx").on(table.expiresAt),
  recipientIdx: index("treasury_approvals_recipient_idx").on(table.recipientAddress),
}));

/**
 * Treasury Transactions - Audit log of all treasury transfers
 * Complete audit trail for compliance and forensics
 * Every transfer (approved or rejected) is logged here
 */
export const treasuryTransactions = pgTable("treasury_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").notNull().references(() => daos.id, { onDelete: 'cascade' }),
  transactionId: varchar("transaction_id"), // Blockchain or internal tx ID
  recipientAddress: varchar("recipient_address", { length: 42 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  amountUSD: decimal("amount_usd", { precision: 18, scale: 2 }),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull(), // approved, rejected, executed, pending
  
  // Validation results
  whitelistApproved: boolean("whitelist_approved").notNull().default(false),
  amountValidated: boolean("amount_validated").notNull().default(false),
  multisigRequired: boolean("multisig_required").notNull().default(false),
  multisigApproved: boolean("multisig_approved").notNull().default(false), // false = not yet decided or rejected or rejected
  
  // Executor information
  executorUserId: varchar("executor_user_id").references(() => users.id),
  executorRole: varchar("executor_role"), // Role of executor at time of execution
  
  // Approval reference
  approvalId: uuid("approval_id").references(() => treasuryApprovals.id),
  
  // Error tracking
  errorMessage: text("error_message"), // If rejected, why
  
  metadata: jsonb("metadata").default({}), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  daoIdIdx: index("treasury_transactions_dao_id_idx").on(table.daoId),
  statusIdx: index("treasury_transactions_status_idx").on(table.status),
  createdAtIdx: index("treasury_transactions_created_at_idx").on(table.createdAt),
  recipientIdx: index("treasury_transactions_recipient_idx").on(table.recipientAddress),
}));

// Treasury Types for type safety
export type TreasuryWhitelist = typeof treasuryWhitelist.$inferSelect;
export type InsertTreasuryWhitelist = typeof treasuryWhitelist.$inferInsert;
export type TreasuryLimits = typeof treasuryLimits.$inferSelect;
export type InsertTreasuryLimits = typeof treasuryLimits.$inferInsert;
export type TreasuryApproval = typeof treasuryApprovals.$inferSelect;
export type InsertTreasuryApproval = typeof treasuryApprovals.$inferInsert;
export type TreasuryTransaction = typeof treasuryTransactions.$inferSelect;
export type InsertTreasuryTransaction = typeof treasuryTransactions.$inferInsert;

export * from './vestingSchema';
export * from './messageReactionsSchema';
export * from './kycSchema';
export * from './accountSchema';
export * from './transactionFlowSchema';
export * from './escrowSchema';
export * from './invoiceSchema';
export * from './securityEnhancedSchema';
export * from './financialEnhancedSchema';
export * from './onboardingSchema';

// ============================================================================
// METRICS TABLES
// ============================================================================

// Platform Metrics - Real-time system health tracking
export const platformMetrics = pgTable('platform_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  totalDaos: integer('total_daos').notNull().default(0),
  activeDaos: integer('active_daos').notNull().default(0),
  totalMembers: integer('total_members').notNull().default(0),
  totalVaults: integer('total_vaults').notNull().default(0),
  activeVaults: integer('active_vaults').notNull().default(0),
  totalTvl: numeric('total_tvl', { precision: 20, scale: 8 }).notNull().default('0'),
  totalTransactions: integer('total_transactions').notNull().default(0),
  totalFees: numeric('total_fees', { precision: 20, scale: 8 }).notNull().default('0'),
  totalRevenue: numeric('total_revenue', { precision: 20, scale: 8 }).notNull().default('0'),
  cpuUsage: numeric('cpu_usage', { precision: 5, scale: 2 }).default('0'),
  memoryUsage: numeric('memory_usage', { precision: 5, scale: 2 }).default('0'),
  diskUsage: numeric('disk_usage', { precision: 5, scale: 2 }).default('0'),
  networkLatency: integer('network_latency').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// DeFi Protocol Metrics
export const defiProtocolMetrics = pgTable('defi_protocol_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  protocolName: varchar('protocol_name').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  tvl: numeric('tvl', { precision: 20, scale: 8 }).default('0'),
  totalUsers: integer('total_users').default(0),
  status: varchar('status').default('active'),
  lastUpdate: timestamp('last_update').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// CeFi Exchange Metrics
export const cefiExchangeMetrics = pgTable('cefi_exchange_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  exchangeName: varchar('exchange_name').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  volume24h: numeric('volume_24h', { precision: 20, scale: 8 }).default('0'),
  users: integer('users').default(0),
  status: varchar('status').default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Blockchain Health Metrics
export const blockchainHealthMetrics = pgTable('blockchain_health_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  chainName: varchar('chain_name').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  blockHeight: integer('block_height').default(0),
  transactionCount: integer('transaction_count').default(0),
  averageBlockTime: numeric('average_block_time', { precision: 10, scale: 2 }).default('0'),
  networkHealthScore: numeric('network_health_score', { precision: 5, scale: 2 }).default('100'),
  status: varchar('status').default('healthy'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Liquidity Pool Metrics
export const liquidityPoolMetrics = pgTable('liquidity_pool_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolAddress: varchar('pool_address').notNull(),
  chainId: varchar('chain_id').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  totalLiquidity: numeric('total_liquidity', { precision: 20, scale: 8 }).default('0'),
  volume24h: numeric('volume_24h', { precision: 20, scale: 8 }).default('0'),
  fee24h: numeric('fee_24h', { precision: 20, scale: 8 }).default('0'),
  tokenABalance: numeric('token_a_balance', { precision: 20, scale: 8 }).default('0'),
  tokenBBalance: numeric('token_b_balance', { precision: 20, scale: 8 }).default('0'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Revenue Metrics
export const revenueMetrics = pgTable('revenue_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(),
  totalRevenue: numeric('total_revenue', { precision: 20, scale: 8 }).notNull().default('0'),
  transactionFees: numeric('transaction_fees', { precision: 20, scale: 8 }).notNull().default('0'),
  platformFees: numeric('platform_fees', { precision: 20, scale: 8 }).notNull().default('0'),
  otherRevenue: numeric('other_revenue', { precision: 20, scale: 8 }).notNull().default('0'),
  revenueBySource: jsonb('revenue_by_source').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Payment Provider Metrics
export const paymentProviderMetrics = pgTable('payment_provider_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerName: varchar('provider_name').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).default('0'),
  totalTransactions: integer('total_transactions').default(0),
  totalVolume: numeric('total_volume', { precision: 20, scale: 8 }).default('0'),
  status: varchar('status').default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agent Performance Metrics
export const agentPerformanceMetrics = pgTable('agent_performance_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id').notNull(),
  date: text('date').notNull(),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).default('0'),
  averageResponseTime: numeric('average_response_time', { precision: 10, scale: 2 }).default('0'),
  userSatisfaction: numeric('user_satisfaction', { precision: 5, scale: 2 }).default('0'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// API Usage Metrics
export const apiUsageMetrics = pgTable('api_usage_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(),
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  averageResponseTime: numeric('average_response_time', { precision: 10, scale: 2 }).default('0'),
  totalDataTransferred: numeric('total_data_transferred', { precision: 20, scale: 8 }).default('0'),
  topEndpoints: jsonb('top_endpoints').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Platform Growth Metrics
export const platformGrowthMetrics = pgTable('platform_growth_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(),
  newUsers: integer('new_users').notNull().default(0),
  totalUsers: integer('total_users').notNull().default(0),
  userRetention: numeric('user_retention', { precision: 5, scale: 2 }).default('0'),
  newDaos: integer('new_daos').notNull().default(0),
  totalDaos: integer('total_daos').notNull().default(0),
  monthlyActiveUsers: integer('monthly_active_users').notNull().default(0),
  weeklyActiveUsers: integer('weekly_active_users').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Referral Metrics
export const referralMetrics = pgTable('referral_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(),
  totalReferrals: integer('total_referrals').notNull().default(0),
  newReferralsToday: integer('new_referrals_today').notNull().default(0),
  referredUsersCount: integer('referred_users_count').notNull().default(0),
  referredUsersActive: integer('referred_users_active').notNull().default(0),
  totalReferralRewards: numeric('total_referral_rewards', { precision: 20, scale: 8 }).notNull().default('0'),
  rewardsDistributedToday: numeric('rewards_distributed_today', { precision: 20, scale: 8 }).notNull().default('0'),
  averageRewardPerReferral: numeric('average_reward_per_referral', { precision: 20, scale: 8 }).notNull().default('0'),
  topReferrerCount: integer('top_referrer_count').default(0),
  averageReferralsPerUser: numeric('average_referrals_per_user', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Leaderboard Rankings
export const leaderboardRankings = pgTable('leaderboard_rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  rankingType: varchar('ranking_type').notNull(),
  date: text('date').notNull(),
  rank: integer('rank').notNull(),
  score: numeric('score', { precision: 20, scale: 8 }).notNull().default('0'),
  previousRank: integer('previous_rank').default(0),
  rankChange: integer('rank_change').default(0),
  metricValue: numeric('metric_value', { precision: 20, scale: 8 }).default('0'),
  tier: varchar('tier').default('bronze'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Reward Distribution
export const rewardDistribution = pgTable('reward_distribution', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: varchar('recipient_id').notNull(),
  rewardType: varchar('reward_type').notNull(),
  date: text('date').notNull(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull().default('0'),
  status: varchar('status').notNull().default('pending'),
  distributionDate: timestamp('distribution_date'),
  source: varchar('source').default('activities'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// DAO Analytics
export const daoAnalytics = pgTable('dao_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  daoId: uuid('dao_id').notNull().references(() => daos.id),
  date: text('date').notNull(),
  totalMembers: integer('total_members').notNull().default(0),
  newMembersToday: integer('new_members_today').notNull().default(0),
  activeMembers: integer('active_members').notNull().default(0),
  membersByTier: jsonb('members_by_tier').default({}),
  totalProposals: integer('total_proposals').notNull().default(0),
  activeProposals: integer('active_proposals').notNull().default(0),
  totalVotes: integer('total_votes').notNull().default(0),
  averageParticipation: numeric('average_participation', { precision: 5, scale: 2 }).default('0'),
  treasuryBalance: numeric('treasury_balance', { precision: 20, scale: 8 }).notNull().default('0'),
  inflows: numeric('inflows', { precision: 20, scale: 8 }).notNull().default('0'),
  outflows: numeric('outflows', { precision: 20, scale: 8 }).notNull().default('0'),
  netFlow: numeric('net_flow', { precision: 20, scale: 8 }).notNull().default('0'),
  daoType: varchar('dao_type'),
  region: varchar('region'),
  causeCategory: varchar('cause_category'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Support Ticket Metrics
export const supportTicketMetrics = pgTable('support_ticket_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(),
  totalTickets: integer('total_tickets').notNull().default(0),
  openTickets: integer('open_tickets').notNull().default(0),
  resolvedTickets: integer('resolved_tickets').notNull().default(0),
  averageResolutionTime: numeric('average_resolution_time', { precision: 10, scale: 2 }).default('0'),
  customerSatisfaction: numeric('customer_satisfaction', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════════════
// YUKI Orders - Execution Metrics & Machine Learning System
// ════════════════════════════════════════════════════════════════════════════════

// Execution Metrics - Track execution performance for learning & optimization
export const executionMetrics = pgTable('execution_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: varchar('order_id', { length: 255 }).notNull(),
  exchange: varchar('exchange', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  
  // Price metrics
  expectedPrice: numeric('expected_price', { precision: 20, scale: 8 }).notNull(),
  actualPrice: numeric('actual_price', { precision: 20, scale: 8 }).notNull(),
  slippagePercent: numeric('slippage_percent', { precision: 10, scale: 6 }).notNull().default('0'),
  
  // Execution metrics
  filled: numeric('filled', { precision: 20, scale: 8 }),
  fillTimeMs: integer('fill_time_ms'),
  success: boolean('success').notNull().default(true),
  accuracy: numeric('accuracy', { precision: 5, scale: 2 }).notNull().default('100'),
  
  // Strategy metadata
  strategy: varchar('strategy', { length: 50 }).default('unknown'),
  side: varchar('side', { length: 10 }),
  amount: numeric('amount', { precision: 20, scale: 8 }),
  
  recordedAt: timestamp('recorded_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  exchangeSymbolIdx: index('idx_execution_metrics_exchange_symbol').on(table.exchange, table.symbol, table.recordedAt),
  recordedAtIdx: index('idx_execution_metrics_recorded_at').on(table.recordedAt),
  orderIdIdx: index('idx_execution_metrics_order_id').on(table.orderId),
  successIdx: index('idx_execution_metrics_success').on(table.success, table.recordedAt),
}));

export type ExecutionMetric = typeof executionMetrics.$inferSelect;
export type InsertExecutionMetric = typeof executionMetrics.$inferInsert;

// Execution Statistics - Aggregated performance by venue and symbol
export const executionStatistics = pgTable('execution_statistics', {
  id: uuid('id').primaryKey().defaultRandom(),
  exchange: varchar('exchange', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  
  // Aggregated metrics (30-day rolling)
  totalExecutions: integer('total_executions').notNull().default(0),
  successfulExecutions: integer('successful_executions').notNull().default(0),
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  
  averageSlippage: numeric('average_slippage', { precision: 10, scale: 6 }).notNull().default('0'),
  minSlippage: numeric('min_slippage', { precision: 10, scale: 6 }),
  maxSlippage: numeric('max_slippage', { precision: 10, scale: 6 }),
  
  averageFillTimeMs: integer('average_fill_time_ms').default(0),
  averageAccuracy: numeric('average_accuracy', { precision: 5, scale: 2 }).notNull().default('0'),
  
  // Performance trend
  accuracyTrend: numeric('accuracy_trend', { precision: 5, scale: 2 }).default('0'),
  improvementRate: numeric('improvement_rate', { precision: 5, scale: 2 }).default('0'),
  
  lastUpdated: timestamp('last_updated').defaultNow(),
  windowStart: date('window_start').notNull(),
  windowEnd: date('window_end').notNull(),
}, (table) => ({
  exchangeSymbolIdx: index('idx_execution_statistics_exchange_symbol').on(table.exchange, table.symbol),
  windowIdx: index('idx_execution_statistics_window').on(table.windowStart, table.windowEnd),
  uniqueWindow: unique('execution_statistics_unique').on(table.exchange, table.symbol, table.windowStart, table.windowEnd),
}));

export type ExecutionStatistic = typeof executionStatistics.$inferSelect;
export type InsertExecutionStatistic = typeof executionStatistics.$inferInsert;

// Execution History - User-specific execution tracking for attribution
export const executionHistory = pgTable('execution_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  orderId: varchar('order_id', { length: 255 }).notNull(),
  exchange: varchar('exchange', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  
  side: varchar('side', { length: 10 }).notNull(),
  amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
  expectedPrice: numeric('expected_price', { precision: 20, scale: 8 }).notNull(),
  actualPrice: numeric('actual_price', { precision: 20, scale: 8 }),
  
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  filledAmount: numeric('filled_amount', { precision: 20, scale: 8 }).default('0'),
  slippagePercent: numeric('slippage_percent', { precision: 10, scale: 6 }).default('0'),
  accuracy: numeric('accuracy', { precision: 5, scale: 2 }).default('100'),
  
  strategyUsed: varchar('strategy_used', { length: 50 }),
  venueRecommendation: varchar('venue_recommendation', { length: 100 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  executedAt: timestamp('executed_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  userIdIdx: index('idx_execution_history_user_id').on(table.userId, table.createdAt),
  statusIdx: index('idx_execution_history_status').on(table.status, table.createdAt),
  symbolIdx: index('idx_execution_history_symbol').on(table.symbol, table.createdAt),
}));

export type ExecutionHistoryRecord = typeof executionHistory.$inferSelect;
export type InsertExecutionHistoryRecord = typeof executionHistory.$inferInsert;

// Venue Performance - Real-time confidence scoring by venue
export const venuePerformance = pgTable('venue_performance', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueType: varchar('venue_type', { length: 10 }).notNull(), // 'dex' or 'cex'
  exchange: varchar('exchange', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 20 }),
  
  // Confidence metrics
  successRate: numeric('success_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  averageAccuracy: numeric('average_accuracy', { precision: 5, scale: 2 }).notNull().default('0'),
  averageSlippage: numeric('average_slippage', { precision: 10, scale: 6 }).notNull().default('0'),
  averageFillTimeMs: integer('average_fill_time_ms').default(0),
  
  // Recent performance (last 7 days)
  recentSuccessRate: numeric('recent_success_rate', { precision: 5, scale: 2 }).default('0'),
  recentAccuracy: numeric('recent_accuracy', { precision: 5, scale: 2 }).default('0'),
  
  // Trend indicators
  uptrend: boolean('uptrend').default(false),
  downtrend: boolean('downtrend').default(false),
  volatility: numeric('volatility', { precision: 5, scale: 2 }).default('0'),
  
  lastExecutionAt: timestamp('last_execution_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeExchangeIdx: index('idx_venue_performance_type_exchange').on(table.venueType, table.exchange),
  updatedAtIdx: index('idx_venue_performance_updated_at').on(table.updatedAt),
  uniqueVenue: unique('venue_performance_unique').on(table.venueType, table.exchange, table.symbol),
}));

export type VenuePerformanceRecord = typeof venuePerformance.$inferSelect;
export type InsertVenuePerformanceRecord = typeof venuePerformance.$inferInsert;

// Machine Learning Training Data - Features for ML models
export const mlTrainingData = pgTable('ml_training_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Input features
  symbol: varchar('symbol', { length: 20 }).notNull(),
  orderSize: numeric('order_size', { precision: 20, scale: 8 }).notNull(),
  timeOfDay: varchar('time_of_day', { length: 20 }), // morning, midday, afternoon, evening, night
  marketVolatility: numeric('market_volatility', { precision: 5, scale: 2 }),
  orderQueueDepth: integer('order_queue_depth'),
  
  // Venue information
  venueType: varchar('venue_type', { length: 10 }),
  exchange: varchar('exchange', { length: 50 }),
  liquidityScore: numeric('liquidity_score', { precision: 5, scale: 2 }),
  
  // Output / Target variable
  actualSlippage: numeric('actual_slippage', { precision: 10, scale: 6 }).notNull(),
  actualFillTimeMs: integer('actual_fill_time_ms').notNull(),
  executionSuccess: boolean('execution_success').notNull(),
  
  // Metadata
  modelVersion: varchar('model_version', { length: 20 }),
  predictionAccuracy: numeric('prediction_accuracy', { precision: 5, scale: 2 }),
  featureImportance: jsonb('feature_importance'),
  
  recordedAt: timestamp('recorded_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolTimeIdx: index('idx_ml_training_data_symbol_time').on(table.symbol, table.recordedAt),
  venueIdx: index('idx_ml_training_data_venue').on(table.venueType, table.exchange),
  successIdx: index('idx_ml_training_data_success').on(table.executionSuccess, table.recordedAt),
}));

export type MLTrainingDataRecord = typeof mlTrainingData.$inferSelect;
export type InsertMLTrainingDataRecord = typeof mlTrainingData.$inferInsert;

// Operational Framework Schema Extensions
export * from '../server/services/operational/schema';
