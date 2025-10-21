
import { pgTable, uuid, varchar, decimal, boolean, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { users, tasks } from "./schema";
import { createInsertSchema } from "drizzle-zod";

export const escrowAccounts = pgTable("escrow_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id),
  payerId: varchar("payer_id").references(() => users.id).notNull(),
  payeeId: varchar("payee_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull().default("cUSD"),
  status: varchar("status").notNull().default("pending"), // pending, funded, released, refunded, disputed
  milestones: jsonb("milestones").default([]), // array of milestone objects
  currentMilestone: varchar("current_milestone").default("0"),
  fundedAt: timestamp("funded_at"),
  releasedAt: timestamp("released_at"),
  refundedAt: timestamp("refunded_at"),
  disputeReason: text("dispute_reason"),
  disputedAt: timestamp("disputed_at"),
  resolvedAt: timestamp("resolved_at"),
  transactionHash: varchar("transaction_hash"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const escrowMilestones = pgTable("escrow_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  escrowId: uuid("escrow_id").references(() => escrowAccounts.id).notNull(),
  milestoneNumber: varchar("milestone_number").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  status: varchar("status").notNull().default("pending"), // pending, approved, released, disputed
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  releasedAt: timestamp("released_at"),
  proofUrl: text("proof_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const escrowDisputes = pgTable("escrow_disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  escrowId: uuid("escrow_id").references(() => escrowAccounts.id).notNull(),
  raisedBy: varchar("raised_by").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  evidence: jsonb("evidence").default([]),
  status: varchar("status").notNull().default("open"), // open, under_review, resolved
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type EscrowAccount = typeof escrowAccounts.$inferSelect;
export type InsertEscrowAccount = typeof escrowAccounts.$inferInsert;
export type EscrowMilestone = typeof escrowMilestones.$inferSelect;
export type InsertEscrowMilestone = typeof escrowMilestones.$inferInsert;
export type EscrowDispute = typeof escrowDisputes.$inferSelect;
export type InsertEscrowDispute = typeof escrowDisputes.$inferInsert;

export const insertEscrowAccountSchema = createInsertSchema(escrowAccounts);
export const insertEscrowMilestoneSchema = createInsertSchema(escrowMilestones);
export const insertEscrowDisputeSchema = createInsertSchema(escrowDisputes);
