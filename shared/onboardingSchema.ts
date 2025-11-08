
import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./schema";

export const onboardingProgress = pgTable("onboarding_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currentStep: varchar("current_step").notNull(), // welcome, wallet_setup, dao_join, first_proposal, etc.
  completedSteps: jsonb("completed_steps").default([]), // Array of completed step IDs
  skippedSteps: jsonb("skipped_steps").default([]),
  progress: integer("progress").default(0), // Percentage 0-100
  isCompleted: boolean("is_completed").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  metadata: jsonb("metadata").default({}), // Additional context data
});

export const onboardingSteps = pgTable("onboarding_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  stepId: varchar("step_id").notNull().unique(), // e.g., 'wallet_setup', 'dao_join'
  title: varchar("title").notNull(),
  description: varchar("description"),
  order: integer("order").notNull(),
  isRequired: boolean("is_required").default(true),
  category: varchar("category").default("general"), // general, financial, governance
  estimatedMinutes: integer("estimated_minutes").default(5),
  icon: varchar("icon"), // Lucide icon name
  createdAt: timestamp("created_at").defaultNow(),
});

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = typeof onboardingProgress.$inferInsert;
export type OnboardingStep = typeof onboardingSteps.$inferSelect;
