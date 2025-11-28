
import { pgTable, text, serial, timestamp, decimal, date } from 'drizzle-orm/pg-core';

export const transactionLimitTracking = pgTable('transaction_limit_tracking', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  transactionDate: date('transaction_date').notNull(),
  dailyVolume: decimal('daily_volume', { precision: 20, scale: 2 }).default('0'),
  monthlyVolume: decimal('monthly_volume', { precision: 20, scale: 2 }).default('0'),
  lastResetDaily: timestamp('last_reset_daily').defaultNow(),
  lastResetMonthly: timestamp('last_reset_monthly').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const kycTransactionHistory = pgTable('kyc_transaction_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  transactionType: text('transaction_type').notNull(),
  amountUSD: decimal('amount_usd', { precision: 20, scale: 2 }).notNull(),
  amountKES: decimal('amount_kes', { precision: 20, scale: 2 }),
  kycTier: text('kyc_tier').notNull(),
  dailyLimit: decimal('daily_limit', { precision: 20, scale: 2 }).notNull(),
  monthlyLimit: decimal('monthly_limit', { precision: 20, scale: 2 }).notNull(),
  dailyUsed: decimal('daily_used', { precision: 20, scale: 2 }).notNull(),
  monthlyUsed: decimal('monthly_used', { precision: 20, scale: 2 }).notNull(),
  status: text('status').notNull(),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});
