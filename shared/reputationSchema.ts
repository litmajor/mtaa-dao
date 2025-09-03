
import { pgTable, varchar, timestamp, integer, decimal, boolean, uuid } from "drizzle-orm/pg-core";
import { users, daos, proposals, contributions } from "./schema";
import { createInsertSchema } from "drizzle-zod";

// MsiaMo Points (Reputation) table
export const msiaMoPoints = pgTable("msiamo_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id), // null for platform-wide points
  points: integer("points").notNull(),
  action: varchar("action").notNull(), // vote, propose, contribute, refer, streak, etc.
  description: text("description"),
  multiplier: decimal("multiplier", { precision: 3, scale: 2 }).default("1.0"),
  createdAt: timestamp("created_at").defaultNow(),
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
