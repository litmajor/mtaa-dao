
import { pgTable, varchar, timestamp, integer, boolean, uuid, text } from "drizzle-orm/pg-core";
import { users } from "./schema";
import { createInsertSchema } from "drizzle-zod";

// Achievement definitions
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // voting, contribution, social, streak, etc.
  criteria: text("criteria").notNull(), // JSON string with achievement criteria
  rewardPoints: integer("reward_points").default(0),
  rewardTokens: varchar("reward_tokens").default("0"),
  badge: varchar("badge"), // special badge for this achievement
  icon: varchar("icon"), // emoji or icon identifier
  rarity: varchar("rarity").default("common"), // common, rare, epic, legendary
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User achievements
export const userAchievements = pgTable("user_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  achievementId: uuid("achievement_id").references(() => achievements.id).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  progress: integer("progress").default(0), // for progressive achievements
  maxProgress: integer("max_progress").default(1),
  isCompleted: boolean("is_completed").default(false),
  rewardClaimed: boolean("reward_claimed").default(false),
  claimedAt: timestamp("claimed_at"),
});

// Achievement progress tracking
export const achievementProgress = pgTable("achievement_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  achievementId: uuid("achievement_id").references(() => achievements.id).notNull(),
  currentValue: integer("current_value").default(0),
  targetValue: integer("target_value").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type AchievementProgress = typeof achievementProgress.$inferSelect;

export type InsertAchievement = typeof achievements.$inferInsert;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;
export type InsertAchievementProgress = typeof achievementProgress.$inferInsert;

export const insertAchievementSchema = createInsertSchema(achievements);
export const insertUserAchievementSchema = createInsertSchema(userAchievements);
export const insertAchievementProgressSchema = createInsertSchema(achievementProgress);
