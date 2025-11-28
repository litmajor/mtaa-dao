
import { pgTable, text, serial, timestamp, decimal, date, jsonb } from 'drizzle-orm/pg-core';

export const p2pTransfers = pgTable('p2p_transfers', {
  id: serial('id').primaryKey(),
  transferId: text('transfer_id').notNull().unique(),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  amountUSD: decimal('amount_usd', { precision: 20, scale: 2 }).notNull(),
  amountKES: decimal('amount_kes', { precision: 20, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('cUSD'),
  status: text('status').notNull().default('pending'),
  senderKycTier: text('sender_kyc_tier').notNull(),
  receiverKycTier: text('receiver_kyc_tier').notNull(),
  senderDailyLimit: decimal('sender_daily_limit', { precision: 20, scale: 2 }).notNull(),
  senderMonthlyLimit: decimal('sender_monthly_limit', { precision: 20, scale: 2 }).notNull(),
  senderDailyUsed: decimal('sender_daily_used', { precision: 20, scale: 2 }).notNull(),
  senderMonthlyUsed: decimal('sender_monthly_used', { precision: 20, scale: 2 }).notNull(),
  reference: text('reference'),
  metadata: jsonb('metadata'),
  completedAt: timestamp('completed_at'),
  failedReason: text('failed_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const unifiedTransactionLimits = pgTable('unified_transaction_limits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  transactionDate: date('transaction_date').notNull(),
  dailyDepositVolume: decimal('daily_deposit_volume', { precision: 20, scale: 2 }).default('0'),
  dailyWithdrawalVolume: decimal('daily_withdrawal_volume', { precision: 20, scale: 2 }).default('0'),
  dailyP2pSentVolume: decimal('daily_p2p_sent_volume', { precision: 20, scale: 2 }).default('0'),
  dailyTotalVolume: decimal('daily_total_volume', { precision: 20, scale: 2 }).default('0'),
  monthlyDepositVolume: decimal('monthly_deposit_volume', { precision: 20, scale: 2 }).default('0'),
  monthlyWithdrawalVolume: decimal('monthly_withdrawal_volume', { precision: 20, scale: 2 }).default('0'),
  monthlyP2pSentVolume: decimal('monthly_p2p_sent_volume', { precision: 20, scale: 2 }).default('0'),
  monthlyTotalVolume: decimal('monthly_total_volume', { precision: 20, scale: 2 }).default('0'),
  lastResetDaily: timestamp('last_reset_daily').defaultNow(),
  lastResetMonthly: timestamp('last_reset_monthly').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
