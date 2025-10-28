
import { pgTable, varchar, timestamp, integer, decimal, boolean, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { users, daos, proposals, contributions } from "./schema";
import { createInsertSchema } from "drizzle-zod";

// MsiaMo Points (Reputation) table
export const msiaMoPoints = pgTable("msiamo_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id), // null for platform-wide points
  points: integer("points").notNull(),
  action: varchar("action").notNull(), // vote, propose, contribute, refer, streak, etc.
  description: varchar("description"),
  multiplier: decimal("multiplier", { precision: 3, scale: 2 }).default("1.0"),
  verifiable: boolean("verifiable").default(true), // Can be verified on-chain
  proofHash: varchar("proof_hash"), // IPFS or blockchain hash for proof
  createdAt: timestamp("created_at").defaultNow(),
});

// Contribution Graph - Track all measurable actions
export const contributionGraph = pgTable("contribution_graph", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  contributionType: varchar("contribution_type").notNull(), // gig_completed, liquidity_provided, vote_cast, mentorship_given, etc.
  daoId: uuid("dao_id").references(() => daos.id),
  
  // Metrics
  value: decimal("value", { precision: 18, scale: 8 }), // Monetary value if applicable
  reputationWeight: integer("reputation_weight").notNull(), // Weight for reputation calculation
  impactScore: integer("impact_score").default(0), // Community impact (0-100)
  
  // Verification
  verified: boolean("verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  proofData: jsonb("proof_data"), // Store proof metadata
  onChainTxHash: varchar("on_chain_tx_hash"), // Transaction hash if on-chain
  
  // Context
  metadata: jsonb("metadata"), // Additional context
  relatedEntityId: uuid("related_entity_id"), // Task, proposal, etc.
  relatedEntityType: varchar("related_entity_type"), // task, proposal, liquidity_pool, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Soulbound Reputation Badges (Non-transferable)
export const reputationBadges = pgTable("reputation_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  badgeType: varchar("badge_type").notNull(), // skill_verified, top_contributor, liquidity_provider, etc.
  badgeTier: varchar("badge_tier").notNull(), // bronze, silver, gold, platinum, diamond
  
  // Badge Details
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  category: varchar("category").notNull(), // skill, contribution, governance, economic
  
  // Earning Criteria
  criteriaType: varchar("criteria_type").notNull(), // threshold, milestone, time_based
  criteriaValue: integer("criteria_value"), // Points/actions needed
  
  // NFT Details (Soulbound)
  tokenId: varchar("token_id").unique(),
  contractAddress: varchar("contract_address"),
  chainId: integer("chain_id").default(44787), // Celo Alfajores
  isSoulbound: boolean("is_soulbound").default(true), // Non-transferable
  
  // Validity
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"), // Some badges may expire
  
  // Metadata
  metadata: jsonb("metadata"),
  earnedAt: timestamp("earned_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
});

// Economic Identity Score - Aggregated reputation for credit/loans
export const economicIdentity = pgTable("economic_identity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  phoneNumber: varchar("phone_number"), // M-Pesa/mobile money identifier
  
  // Reputation Scores (0-1000 scale)
  contributionScore: integer("contribution_score").default(0), // Work/gig completion
  liquidityScore: integer("liquidity_score").default(0), // DeFi participation
  governanceScore: integer("governance_score").default(0), // DAO voting/proposals
  socialScore: integer("social_score").default(0), // Mentorship, referrals
  reliabilityScore: integer("reliability_score").default(0), // On-time delivery, consistency
  
  // Composite Score (weighted average)
  totalScore: integer("total_score").default(0), // 0-1000
  
  // Credit Worthiness Indicators
  creditLimit: decimal("credit_limit", { precision: 18, scale: 2 }).default("0"), // In USD
  defaultRisk: varchar("default_risk").default("unknown"), // low, medium, high, unknown
  loanCount: integer("loan_count").default(0),
  loanDefaultCount: integer("loan_default_count").default(0),
  
  // Activity Metrics
  activeDays: integer("active_days").default(0),
  lastActiveDate: timestamp("last_active_date"),
  longestStreak: integer("longest_streak").default(0),
  currentStreak: integer("current_streak").default(0),
  
  // Verification Status
  phoneVerified: boolean("phone_verified").default(false),
  kycVerified: boolean("kyc_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  
  // Metadata
  verificationMetadata: jsonb("verification_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Skill Verification - Track verified skills
export const skillVerifications = pgTable("skill_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  skillName: varchar("skill_name").notNull(), // e.g., "Web Development", "Graphic Design"
  skillCategory: varchar("skill_category").notNull(), // tech, design, finance, etc.
  
  // Verification
  verified: boolean("verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verificationMethod: varchar("verification_method"), // task_completion, peer_review, certification
  verificationProof: jsonb("verification_proof"),
  
  // Proficiency
  proficiencyLevel: varchar("proficiency_level").notNull(), // beginner, intermediate, advanced, expert
  endorsementCount: integer("endorsement_count").default(0),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Reputation Summary table
export const userReputation = pgTable("user_reputation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").default(0),
  weeklyPoints: integer("weekly_points").default(0),
  monthlyPoints: integer("monthly_points").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
  badge: varchar("badge").default("Bronze"), // Bronze, Silver, Gold, Platinum, Diamond
  level: integer("level").default(1),
  nextLevelPoints: integer("next_level_points").default(100),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MsiaMo Token Conversion History
export const msiaMoConversions = pgTable("msiamo_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pointsConverted: integer("points_converted").notNull(),
  tokensReceived: decimal("tokens_received", { precision: 18, scale: 8 }).notNull(),
  conversionRate: decimal("conversion_rate", { precision: 10, scale: 4 }).notNull(), // points per token
  transactionHash: varchar("transaction_hash"),
  status: varchar("status").default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Airdrop Eligibility Tracking
export const airdropEligibility = pgTable("airdrop_eligibility", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  airdropId: varchar("airdrop_id").notNull(),
  eligibleAmount: decimal("eligible_amount", { precision: 18, scale: 8 }).notNull(),
  minimumReputation: integer("minimum_reputation").notNull(),
  userReputation: integer("user_reputation").notNull(),
  claimed: boolean("claimed").default(false),
  claimedAt: timestamp("claimed_at"),
  transactionHash: varchar("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MsiaMoPoints = typeof msiaMoPoints.$inferSelect;
export type UserReputation = typeof userReputation.$inferSelect;
export type MsiaMoConversion = typeof msiaMoConversions.$inferSelect;
export type AirdropEligibility = typeof airdropEligibility.$inferSelect;

export type InsertMsiaMoPoints = typeof msiaMoPoints.$inferInsert;
export type InsertUserReputation = typeof userReputation.$inferInsert;
export type InsertMsiaMoConversion = typeof msiaMoConversions.$inferInsert;
export type InsertAirdropEligibility = typeof airdropEligibility.$inferInsert;

export const insertMsiaMoPointsSchema = createInsertSchema(msiaMoPoints);
export const insertUserReputationSchema = createInsertSchema(userReputation);
export const insertMsiaMoConversionSchema = createInsertSchema(msiaMoConversions);
export const insertAirdropEligibilitySchema = createInsertSchema(airdropEligibility);
