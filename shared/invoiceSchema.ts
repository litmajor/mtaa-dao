
import { pgTable, uuid, varchar, decimal, boolean, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { users, daos } from "./schema";
import { createInsertSchema } from "drizzle-zod";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: varchar("invoice_number").notNull().unique(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(), // issuerId
  toUserId: varchar("to_user_id").references(() => users.id),
  daoId: uuid("dao_id").references(() => daos.id),
  recipientEmail: varchar("recipient_email"), // Email of invoice recipient
  recipientName: varchar("recipient_name"), // Name of recipient
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull().default("cUSD"), // token
  description: text("description").notNull(),
  lineItems: jsonb("line_items").default([]), // array of {description, quantity, rate, amount}
  subtotal: decimal("subtotal", { precision: 18, scale: 8 }).default("0"), // Amount before tax
  tax: decimal("tax", { precision: 18, scale: 8 }).default("0"), // Tax amount
  total: decimal("total", { precision: 18, scale: 8 }), // subtotal + tax (or use amount if no tax)
  status: varchar("status").notNull().default("draft"), // draft, sent, paid, cancelled, overdue
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"), // When invoice was sent to recipient
  paidAt: timestamp("paid_at"),
  paymentMethod: varchar("payment_method"), // wallet, mpesa, stripe, etc.
  transactionHash: varchar("transaction_hash"),
  notes: text("notes"),
  termsAndConditions: text("terms_and_conditions"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoicePayments = pgTable("invoice_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  payerId: varchar("payer_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  transactionHash: varchar("transaction_hash"),
  status: varchar("status").notNull().default("pending"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = typeof invoicePayments.$inferInsert;

export const insertInvoiceSchema = createInsertSchema(invoices);
export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments);
