
import { pgTable, varchar, timestamp, decimal, boolean, uuid, integer } from "drizzle-orm/pg-core";
import { users } from "./schema";
import { createInsertSchema } from "drizzle-zod";

// Vesting schedules
export const vestingSchedules = pgTable("vesting_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  scheduleType: varchar("schedule_type").notNull(), // linear, cliff, milestone
  totalTokens: decimal("total_tokens", { precision: 18, scale: 8 }).notNull(),
  vestedTokens: decimal("vested_tokens", { precision: 18, scale: 8 }).default("0"),
  claimedTokens: decimal("claimed_tokens", { precision: 18, scale: 8 }).default("0"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  cliffDuration: integer("cliff_duration").default(0), // in days
  vestingDuration: integer("vesting_duration").notNull(), // in days
  vestingInterval: integer("vesting_interval").default(1), // in days
  isActive: boolean("is_active").default(true),
  reason: varchar("reason"), // airdrop, team, advisor, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Vesting claims history
export const vestingClaims = pgTable("vesting_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleId: uuid("schedule_id").references(() => vestingSchedules.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  claimedAmount: decimal("claimed_amount", { precision: 18, scale: 8 }).notNull(),
  transactionHash: varchar("transaction_hash"),
  claimedAt: timestamp("claimed_at").defaultNow(),
});

// Milestone-based vesting
export const vestingMilestones = pgTable("vesting_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleId: uuid("schedule_id").references(() => vestingSchedules.id).notNull(),
  milestoneType: varchar("milestone_type").notNull(), // reputation, time, task_completion
  description: varchar("description"),
  targetValue: decimal("target_value", { precision: 18, scale: 8 }).notNull(),
  currentValue: decimal("current_value", { precision: 18, scale: 8 }).default("0"),
  tokensToRelease: decimal("tokens_to_release", { precision: 18, scale: 8 }).notNull(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
});

export type VestingSchedule = typeof vestingSchedules.$inferSelect;
export type VestingClaim = typeof vestingClaims.$inferSelect;
export type VestingMilestone = typeof vestingMilestones.$inferSelect;

export type InsertVestingSchedule = typeof vestingSchedules.$inferInsert;
export type InsertVestingClaim = typeof vestingClaims.$inferInsert;
export type InsertVestingMilestone = typeof vestingMilestones.$inferInsert;

export const insertVestingScheduleSchema = createInsertSchema(vestingSchedules);
export const insertVestingClaimSchema = createInsertSchema(vestingClaims);
export const insertVestingMilestoneSchema = createInsertSchema(vestingMilestones);
