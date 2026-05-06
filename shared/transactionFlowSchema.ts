/**
 * Transaction Flow Schema
 * Deposits, Withdrawals, and Internal Transfers
 * Part of the multi-account wallet system
 * 
 * NOTE: userId fields use varchar to match the current users table structure
 * (users.id is still varchar in database, though defined as uuid in schema).
 * Foreign key constraints will be added after users.id is migrated to uuid.
 */

import { pgTable, uuid, varchar, text, timestamp, decimal, numeric, integer, index, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accounts } from './accountSchema';
import { users } from './schema';

// ===== DEPOSIT SOURCES =====
export const DEPOSIT_SOURCES = {
  OFFRAMP_STRIPE: 'offramp_stripe',
  OFFRAMP_KOTANIPAY: 'offramp_kotanipay',
  OFFRAMP_MPESA: 'offramp_mpesa',
  EXTERNAL_WALLET: 'external_wallet',
} as const;

export type DepositSource = (typeof DEPOSIT_SOURCES)[keyof typeof DEPOSIT_SOURCES];

// ===== DEPOSIT STATUSES =====
export const DEPOSIT_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type DepositStatus = (typeof DEPOSIT_STATUSES)[keyof typeof DEPOSIT_STATUSES];

/**
 * Deposits Table
 * Track all incoming funds from various sources
 */
export const deposits = pgTable(
  'deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull(),
      // Foreign key will be added after users.id is migrated to uuid
    toAccountId: uuid('to_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),

    // Source Information
    source: varchar('source', { length: 50 }).notNull(), // offramp_stripe, offramp_kotanipay, offramp_mpesa, external_wallet
    sourceIdentifier: varchar('source_identifier', { length: 255 }), // tx hash, email, phone, wallet address

    // Amount & Currency
    amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('USDC'),
    feeAmount: decimal('fee_amount', { precision: 18, scale: 8 }).default('0'),
    stableInflowEventId: uuid('stable_inflow_event_id'),
    normalizedAmountUsd: decimal('normalized_amount_usd', { precision: 24, scale: 8 }),
    stableUnitsMicroUsd: numeric('stable_units_microusd', { precision: 38, scale: 0 }),
    chainId: integer('chain_id'),
    tokenAddress: varchar('token_address', { length: 255 }),

    // Status & References
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, completed, failed, cancelled
    transactionHash: varchar('transaction_hash', { length: 255 }), // Blockchain tx hash if applicable
    externalReference: varchar('external_reference', { length: 255 }), // Off-ramp provider reference

    // Metadata
    metadata: text('metadata'), // JSON stringified provider-specific data

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('idx_deposits_user_id').on(table.userId),
    accountIdx: index('idx_deposits_to_account_id').on(table.toAccountId),
    statusIdx: index('idx_deposits_status').on(table.status),
    sourceIdx: index('idx_deposits_source').on(table.source),
    createdAtIdx: index('idx_deposits_created_at').on(table.createdAt),
    userStatusIdx: index('idx_deposits_user_status').on(table.userId, table.status),
    stableInflowIdx: index('idx_deposits_stable_inflow_event_id').on(table.stableInflowEventId),
    chainTokenIdx: index('idx_deposits_chain_token').on(table.chainId, table.tokenAddress),
  })
);

// ===== WITHDRAWAL DESTINATIONS =====
export const WITHDRAWAL_DESTINATIONS = {
  OFFRAMP_STRIPE: 'offramp_stripe',
  OFFRAMP_KOTANIPAY: 'offramp_kotanipay',
  OFFRAMP_MPESA: 'offramp_mpesa',
  EXTERNAL_WALLET: 'external_wallet',
  MICRO_WITHDRAWAL: 'micro_withdrawal',
  INTERNAL_TRANSFER: 'internal_transfer',
} as const;

export type WithdrawalDestination = (typeof WITHDRAWAL_DESTINATIONS)[keyof typeof WITHDRAWAL_DESTINATIONS];

// ===== WITHDRAWAL STATUSES =====
export const WITHDRAWAL_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[keyof typeof WITHDRAWAL_STATUSES];

/**
 * Withdrawals Table
 * Track all outgoing funds to various destinations
 */
export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull(),
      // Foreign key will be added after users.id is migrated to uuid
    fromAccountId: uuid('from_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),

    // Destination Information
    destination: varchar('destination', { length: 50 }).notNull(), // offramp_stripe, external_wallet, micro_withdrawal, internal_transfer
    destinationAddress: varchar('destination_address', { length: 255 }), // wallet address or off-ramp identifier

    // Amount & Currency
    amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('USDC'),
    feeAmount: decimal('fee_amount', { precision: 18, scale: 8 }).default('0'),

    // Status & References
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed, cancelled
    transactionHash: varchar('transaction_hash', { length: 255 }), // Blockchain tx hash if applicable
    externalReference: varchar('external_reference', { length: 255 }), // Off-ramp provider reference
    microWithdrawalId: uuid('micro_withdrawal_id'), // Link to micro-withdrawal if destination is micro_withdrawal

    // Metadata
    metadata: text('metadata'), // JSON stringified provider-specific data

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('idx_withdrawals_user_id').on(table.userId),
    accountIdx: index('idx_withdrawals_from_account_id').on(table.fromAccountId),
    statusIdx: index('idx_withdrawals_status').on(table.status),
    destinationIdx: index('idx_withdrawals_destination').on(table.destination),
    createdAtIdx: index('idx_withdrawals_created_at').on(table.createdAt),
    userStatusIdx: index('idx_withdrawals_user_status').on(table.userId, table.status),
    microWithdrawalIdx: index('idx_withdrawals_micro_withdrawal_id').on(table.microWithdrawalId),
  })
);

// ===== INTERNAL TRANSFER REASONS =====
export const TRANSFER_REASONS = {
  TRADING: 'trading',
  SAVINGS: 'savings',
  PROFIT_LOCK: 'profit_lock',
  REBALANCE: 'rebalance',
  MANUAL: 'manual',
} as const;

export type TransferReason = (typeof TRANSFER_REASONS)[keyof typeof TRANSFER_REASONS];

/**
 * Internal Transfers Table
 * Track movements between user's own accounts
 */
export const internalTransfers = pgTable(
  'internal_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull(),
      // Foreign key will be added after users.id is migrated to uuid
    fromAccountId: uuid('from_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),

    // Transfer Details
    amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('USDC'),
    reason: varchar('reason', { length: 50 }), // trading, savings, profit_lock, rebalance, manual

    // Status
    status: varchar('status', { length: 20 }).notNull().default('completed'), // completed, failed (most are instant)

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_transfers_user_id').on(table.userId),
    fromAccountIdx: index('idx_transfers_from_account_id').on(table.fromAccountId),
    toAccountIdx: index('idx_transfers_to_account_id').on(table.toAccountId),
    createdAtIdx: index('idx_transfers_created_at').on(table.createdAt),
    userFromToIdx: index('idx_transfers_user_from_to').on(table.userId, table.fromAccountId, table.toAccountId),
    reasonIdx: index('idx_transfers_reason').on(table.reason),
  })
);

// ===== RELATIONS =====

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, {
    fields: [deposits.userId],
    references: [users.id],
  }),
  toAccount: one(accounts, {
    fields: [deposits.toAccountId],
    references: [accounts.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, {
    fields: [withdrawals.userId],
    references: [users.id],
  }),
  fromAccount: one(accounts, {
    fields: [withdrawals.fromAccountId],
    references: [accounts.id],
  }),
}));

export const internalTransfersRelations = relations(internalTransfers, ({ one }) => ({
  user: one(users, {
    fields: [internalTransfers.userId],
    references: [users.id],
  }),
  fromAccount: one(accounts, {
    fields: [internalTransfers.fromAccountId],
    references: [accounts.id],
  }),
  toAccount: one(accounts, {
    fields: [internalTransfers.toAccountId],
    references: [accounts.id],
  }),
}));
