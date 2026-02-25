import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  decimal,
  boolean,
  uuid,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

/**
 * Micro-Withdrawals System Schema
 * 
 * Allows users to withdraw small amounts (< $10) through batching
 * Reduces gas fees by consolidating multiple requests into single transactions
 */

// Individual micro-withdrawal requests from users
export const microWithdrawals = pgTable(
  "micro_withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull(), // USDC, USDT, cUSD, ETH
    toAddress: varchar("to_address", { length: 255 }).notNull(), // Ethereum address (0x...)
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, batched, processed, failed, cancelled
    batchId: uuid("batch_id").references(() => microWithdrawalBatches.id, {
      onDelete: "set null",
    }),
    estimatedGasFee: decimal("estimated_gas_fee", { precision: 18, scale: 8 }),
    actualGasFee: decimal("actual_gas_fee", { precision: 18, scale: 8 }),
    transactionHash: varchar("transaction_hash", { length: 255 }),
    cancelledAt: timestamp("cancelled_at"),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    // Constraints
    amountRangeCheck: check(
      "amount_range",
      sql`${table.amount} >= 0.50 AND ${table.amount} <= 10.00`
    ),
    addressFormatCheck: check(
      "valid_address",
      sql`${table.toAddress} ~ '^0x[a-fA-F0-9]{40}$'`
    ),
    currencyCheck: check(
      "valid_currency",
      sql`${table.currency} IN ('USDC', 'USDT', 'cUSD', 'ETH')`
    ),
    statusCheck: check(
      "valid_status",
      sql`${table.status} IN ('pending', 'batched', 'processed', 'failed', 'cancelled')`
    ),
    // Indexes for fast queries
    userIdIdx: index("micro_withdrawals_user_id_idx").on(table.userId),
    statusIdx: index("micro_withdrawals_status_idx").on(table.status),
    batchIdIdx: index("micro_withdrawals_batch_id_idx").on(table.batchId),
    createdAtIdx: index("micro_withdrawals_created_at_idx").on(table.createdAt),
    userStatusIdx: index("micro_withdrawals_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

export type MicroWithdrawal = typeof microWithdrawals.$inferSelect;
export type InsertMicroWithdrawal = typeof microWithdrawals.$inferInsert;

// Batched micro-withdrawal transactions
export const microWithdrawalBatches = pgTable(
  "micro_withdrawal_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestCount: integer("request_count").notNull(),
    totalAmount: decimal("total_amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull(), // USDC, USDT, cUSD, ETH
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, processing, processed, failed
    estimatedGasFee: decimal("estimated_gas_fee", { precision: 18, scale: 8 }),
    actualGasFee: decimal("actual_gas_fee", { precision: 18, scale: 8 }),
    transactionHash: varchar("transaction_hash", { length: 255 }),
    failureReason: text("failure_reason"),
    triggeredBy: varchar("triggered_by", { length: 50 }).notNull(), // count, amount, time, manual, api
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusCheck: check(
      "batch_valid_status",
      sql`${table.status} IN ('pending', 'processing', 'processed', 'failed')`
    ),
    triggerCheck: check(
      "valid_trigger",
      sql`${table.triggeredBy} IN ('count', 'amount', 'time', 'manual', 'api')`
    ),
    statusIdx: index("micro_withdrawal_batches_status_idx").on(table.status),
    createdAtIdx: index("micro_withdrawal_batches_created_at_idx").on(
      table.createdAt
    ),
    triggeredByIdx: index("micro_withdrawal_batches_triggered_by_idx").on(
      table.triggeredBy
    ),
  })
);

export type MicroWithdrawalBatch = typeof microWithdrawalBatches.$inferSelect;
export type InsertMicroWithdrawalBatch =
  typeof microWithdrawalBatches.$inferInsert;

/**
 * Zod validation schemas for API requests
 */

export const createMicroWithdrawalSchema = z.object({
  amount: z
    .string()
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= 0.5 && num <= 10.0;
      },
      { message: "Amount must be between $0.50 and $10.00" }
    ),
  currency: z.enum(["USDC", "USDT", "cUSD", "ETH"]),
  toAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
});

export type CreateMicroWithdrawalRequest = z.infer<
  typeof createMicroWithdrawalSchema
>;

export const cancelMicroWithdrawalSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
});

export type CancelMicroWithdrawalRequest = z.infer<
  typeof cancelMicroWithdrawalSchema
>;

// Drizzle-Zod generated schemas
export const insertMicroWithdrawalSchema = createInsertSchema(
  microWithdrawals
);
export const selectMicroWithdrawalSchema = createInsertSchema(
  microWithdrawals
);

export const insertMicroWithdrawalBatchSchema =
  createInsertSchema(microWithdrawalBatches);
export const selectMicroWithdrawalBatchSchema = createInsertSchema(
  microWithdrawalBatches
);
