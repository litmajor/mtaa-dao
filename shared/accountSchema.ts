/**
 * Account Schema
 * Multi-account system: Wallet, Trading, Vault, Escrow
 */

import { pgTable, text, uuid, decimal, timestamp, index, varchar, integer, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

// Account types
export const ACCOUNT_TYPES = {
  WALLET: 'wallet',
  TRADING: 'trading',
  VAULT: 'vault',
  ESCROW: 'escrow',
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

// Account statuses
export const ACCOUNT_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[keyof typeof ACCOUNT_STATUSES];

/**
 * Accounts Table
 * Stores user's multiple accounts with separate balances
 * Supports internal transfers between accounts (e.g., okedi <-> yuki)
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .notNull(),
      // TODO: add foreign key reference after users.id is migrated
    accountType: text('account_type')
      .notNull()
      .$type<AccountType>()
      // Enforce valid account types
      .default(ACCOUNT_TYPES.WALLET),
    accountNumber: varchar('account_number').unique(), // Unique identifier for the account
    balance: decimal('balance', { precision: 18, scale: 8 })
      .notNull()
      .default('0'),
    currency: text('currency').notNull().default('USDC'),
    status: text('status')
      .notNull()
      .$type<AccountStatus>()
      .default(ACCOUNT_STATUSES.ACTIVE),
    locked: decimal('locked', { precision: 18, scale: 8 })
      .notNull()
      .default('0'), // Amount locked in vault or escrow
    // Aggregate statistics for account
    totalDeposited: decimal('total_deposited', { precision: 18, scale: 8 })
      .notNull()
      .default('0'),
    totalWithdrawn: decimal('total_withdrawn', { precision: 18, scale: 8 })
      .notNull()
      .default('0'),
    totalTransactions: integer('total_transactions')
      .notNull()
      .default(0),
    // Transaction limits
    dailyLimit: decimal('daily_limit', { precision: 18, scale: 8 }),
    monthlyLimit: decimal('monthly_limit', { precision: 18, scale: 8 }),
    maxBalance: decimal('max_balance', { precision: 18, scale: 8 }),
    // DAO-specific accounts
    daoId: uuid('dao_id'),
    // Activity tracking
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    // Verification & blocking
    isVerified: boolean('is_verified').default(false),
    kycStatus: varchar('kyc_status').default('pending'), // pending, verified, rejected
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    isBlocked: boolean('is_blocked').default(false),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite index: userId + accountType + currency
    userAccountIdx: index('idx_user_account_type')
      .on(table.userId, table.accountType, table.currency),
    // Index for balance queries
    userBalanceIdx: index('idx_user_balance').on(table.userId, table.status),
    // Index for status queries
    statusIdx: index('idx_account_status').on(table.status),
    // Account number lookup
    accountNumberIdx: index('idx_account_number').on(table.accountNumber),
    // DAO accounts
    daoIdIdx: index('idx_dao_id').on(table.daoId),
  })
);

/**
 * Account Transactions Table
 * Tracks all transactions between accounts (deposits, withdrawals, internal transfers)
 * Supports internal transfers between account profiles (e.g., okedi <-> yuki)
 */
export const accountTransactions = pgTable(
  'account_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    transactionType: varchar('transaction_type').notNull(), // deposit, withdrawal, transfer, fee, interest
    amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
    currency: text('currency').notNull().default('USDC'),
    description: text('description'),
    reference: varchar('reference'), // Reference number or external ID
    fromAccountId: uuid('from_account_id').references(() => accounts.id),
    toAccountId: uuid('to_account_id').references(() => accounts.id),
    fromUserId: varchar('from_user_id'),
    toUserId: varchar('to_user_id'),
    status: varchar('status').notNull().default('completed'), // pending, completed, failed, reversed
    balanceBefore: decimal('balance_before', { precision: 18, scale: 8 }),
    balanceAfter: decimal('balance_after', { precision: 18, scale: 8 }),
    transactionHash: varchar('transaction_hash'), // Blockchain tx hash if applicable
    chainId: integer('chain_id'), // Blockchain chain ID
    metadata: text('metadata'), // JSON metadata for additional context
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    accountIdIdx: index('idx_account_tx_account_id').on(table.accountId),
    transactionTypeIdx: index('idx_account_tx_type').on(table.transactionType),
    fromAccountIdx: index('idx_account_tx_from').on(table.fromAccountId),
    toAccountIdx: index('idx_account_tx_to').on(table.toAccountId),
    createdAtIdx: index('idx_account_tx_created').on(table.createdAt),
  })
);

/**
 * Account Settings Table
 * Per-account configuration and preferences
 */
export const accountSettings = pgTable(
  'account_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .unique()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    autoWithdraw: boolean('auto_withdraw').default(false),
    autoCompound: boolean('auto_compound').default(false),
    notificationsEnabled: boolean('notifications_enabled').default(true),
    preferredLanguage: varchar('preferred_language').default('en'),
    timezone: varchar('timezone'),
    theme: varchar('theme').default('light'), // light, dark
    metadata: text('metadata'), // JSON for custom settings
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

/**
 * Account Statements Table
 * Generated monthly, quarterly, yearly account statements
 */
export const accountStatements = pgTable(
  'account_statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    statementPeriod: varchar('statement_period').notNull(), // monthly, quarterly, yearly
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    openingBalance: decimal('opening_balance', { precision: 18, scale: 8 }).notNull(),
    closingBalance: decimal('closing_balance', { precision: 18, scale: 8 }).notNull(),
    totalDeposits: decimal('total_deposits', { precision: 18, scale: 8 }).default('0'),
    totalWithdrawals: decimal('total_withdrawals', { precision: 18, scale: 8 }).default('0'),
    totalTransfers: decimal('total_transfers', { precision: 18, scale: 8 }).default('0'),
    totalFees: decimal('total_fees', { precision: 18, scale: 8 }).default('0'),
    totalInterest: decimal('total_interest', { precision: 18, scale: 8 }).default('0'),
    transactionCount: integer('transaction_count').default(0),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    accountIdIdx: index('idx_stmt_account_id').on(table.accountId),
    periodIdx: index('idx_stmt_period').on(table.periodStart, table.periodEnd),
  })
);

/**
 * Account Access Logs Table
 * Audit trail for account access and modifications
 */
export const accountAccessLogs = pgTable(
  'account_access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    userId: varchar('user_id'),
    action: varchar('action').notNull(), // create_account, update_account, close_account, login, logout, etc
    resourceType: varchar('resource_type'),
    resourceId: varchar('resource_id'),
    status: varchar('status').notNull().default('success'), // success, failed
    errorMessage: text('error_message'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata'), // JSON metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    accountIdIdx: index('idx_log_account_id').on(table.accountId),
    userIdIdx: index('idx_log_user_id').on(table.userId),
    actionIdx: index('idx_log_action').on(table.action),
    createdAtIdx: index('idx_log_created').on(table.createdAt),
  })
);

/**
 * Type exports for all account-related tables
 */
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountTransaction = typeof accountTransactions.$inferSelect;
export type InsertAccountTransaction = typeof accountTransactions.$inferInsert;
export type AccountSettings = typeof accountSettings.$inferSelect;
export type InsertAccountSettings = typeof accountSettings.$inferInsert;
export type AccountStatement = typeof accountStatements.$inferSelect;
export type InsertAccountStatement = typeof accountStatements.$inferInsert;
export type AccountAccessLog = typeof accountAccessLogs.$inferSelect;
export type InsertAccountAccessLog = typeof accountAccessLogs.$inferInsert;

/**
 * Zod Schemas for validation
 */

// Create account schema (admin only)
export const createAccountSchema = z.object({
  userId: z.string(),
  accountType: z.enum(['wallet', 'trading', 'vault', 'escrow']),
  currency: z.string().default('USDC'),
  initialBalance: z.string().optional().default('0'),
  daoId: z.string().uuid().optional(),
});

// Update account schema (admin only)
export const updateAccountSchema = z.object({
  accountNumber: z.string().optional(),
  balance: z.string().optional(),
  locked: z.string().optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  totalDeposited: z.string().optional(),
  totalWithdrawn: z.string().optional(),
  totalTransactions: z.number().optional(),
  dailyLimit: z.string().optional(),
  monthlyLimit: z.string().optional(),
  maxBalance: z.string().optional(),
  isVerified: z.boolean().optional(),
  kycStatus: z.string().optional(),
  isBlocked: z.boolean().optional(),
});

// Account transaction schema
export const createAccountTransactionSchema = z.object({
  accountId: z.string().uuid(),
  transactionType: z.enum(['deposit', 'withdrawal', 'transfer', 'fee', 'interest']),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().optional().default('USDC'),
  description: z.string().optional(),
  reference: z.string().optional(),
  fromAccountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
  fromUserId: z.string().optional(),
  toUserId: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed']).optional(),
  transactionHash: z.string().optional(),
  chainId: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertAccountTransactionSchema = createInsertSchema(accountTransactions);

// Account settings schema
export const createAccountSettingsSchema = z.object({
  accountId: z.string().uuid(),
  autoWithdraw: z.boolean().optional().default(false),
  autoCompound: z.boolean().optional().default(false),
  notificationsEnabled: z.boolean().optional().default(true),
  preferredLanguage: z.string().optional().default('en'),
  timezone: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional().default('light'),
  metadata: z.record(z.any()).optional(),
});

export const insertAccountSettingsSchema = createInsertSchema(accountSettings);

// Account statement schema
export const createAccountStatementSchema = z.object({
  accountId: z.string().uuid(),
  statementPeriod: z.enum(['monthly', 'quarterly', 'yearly']),
  periodStart: z.date(),
  periodEnd: z.date(),
  openingBalance: z.string(),
  closingBalance: z.string(),
  totalDeposits: z.string().optional().default('0'),
  totalWithdrawals: z.string().optional().default('0'),
  totalTransfers: z.string().optional().default('0'),
  totalFees: z.string().optional().default('0'),
  totalInterest: z.string().optional().default('0'),
  transactionCount: z.number().optional().default(0),
});

export const insertAccountStatementSchema = createInsertSchema(accountStatements);

// Access log schema
export const createAccountAccessLogSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().optional(),
  action: z.string(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  status: z.enum(['success', 'failed']).optional().default('success'),
  errorMessage: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const insertAccountAccessLogSchema = createInsertSchema(accountAccessLogs);

/**
 * Multi-Chain Support: Chain Accounts
 * Tracks service account balances across all 7 supported chains
 */
export const chainAccounts = pgTable(
  'chain_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceAccountId: uuid('service_account_id').notNull(), // Reference to unified service account
    chain: varchar('chain').notNull(), // ethereum, bsc, polygon, arbitrum, optimism, tron, avalanche
    walletAddress: varchar('wallet_address').notNull(),
    balance: decimal('balance', { precision: 36, scale: 18 }).notNull().default('0'),
    balanceUSD: decimal('balance_usd', { precision: 18, scale: 6 }).notNull().default('0'),
    
    // Token holdings on specific chain
    tokenSymbol: varchar('token_symbol').notNull(), // USDC, USDT, cUSD, etc
    tokenAddress: varchar('token_address').notNull(),
    tokenBalance: decimal('token_balance', { precision: 36, scale: 18 }).notNull().default('0'),
    
    // RPC and configuration
    rpcUrl: varchar('rpc_url'),
    blockExplorerUrl: varchar('block_explorer_url'),
    lastSync: timestamp('last_sync', { withTimezone: true }),
    syncStatus: varchar('sync_status').default('pending'), // pending, syncing, synced, failed
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chainAccountIdx: index('idx_chain_account').on(table.serviceAccountId, table.chain),
    addressIdx: index('idx_wallet_address').on(table.walletAddress),
    chainIdx: index('idx_chain').on(table.chain),
    tokenChainIdx: index('idx_token_chain').on(table.tokenSymbol, table.chain),
  })
);

/**
 * Cross-Chain Transfers
 * Records all cross-chain withdrawal transfers, bridges, swaps
 */
export const crossChainTransfers = pgTable(
  'cross_chain_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    withdrawalId: uuid('withdrawal_id').notNull(),
    
    // Source
    sourceChain: varchar('source_chain').notNull(),
    sourceToken: varchar('source_token').notNull(),
    sourceAmount: decimal('source_amount', { precision: 36, scale: 18 }).notNull(),
    sourceTxHash: varchar('source_tx_hash'),
    
    // Target
    targetChain: varchar('target_chain').notNull(),
    targetToken: varchar('target_token').notNull(),
    targetAmount: decimal('target_amount', { precision: 36, scale: 18 }).notNull(),
    targetTxHash: varchar('target_tx_hash'),
    recipientAddress: varchar('recipient_address').notNull(),
    
    // Bridge information
    bridgeProtocol: varchar('bridge_protocol').notNull().default('none'), // layerzero, axelar, wormhole, stargate, direct
    bridgeTransactionHash: varchar('bridge_tx_hash'),
    
    // Status tracking
    status: varchar('status').notNull().default('pending'), // pending, bridging, confirmed, failed, refunded
    statusReason: text('status_reason'),
    
    // Fee breakdown (in USD)
    gasFeeSource: decimal('gas_fee_source', { precision: 18, scale: 6 }).notNull().default('0'),
    gasFeeTarget: decimal('gas_fee_target', { precision: 18, scale: 6 }).notNull().default('0'),
    bridgeFee: decimal('bridge_fee', { precision: 18, scale: 6 }).notNull().default('0'),
    swapSlippage: decimal('swap_slippage', { precision: 18, scale: 6 }).default('0'),
    totalCostUSD: decimal('total_cost_usd', { precision: 18, scale: 6 }).notNull().default('0'),
    
    // Timing
    estimatedTime: integer('estimated_time'), // seconds
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    bridgeInitiatedAt: timestamp('bridge_initiated_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    withdrawalIdx: index('idx_withdrawal_id').on(table.withdrawalId),
    sourceChainIdx: index('idx_source_chain').on(table.sourceChain),
    targetChainIdx: index('idx_target_chain').on(table.targetChain),
    statusIdx: index('idx_transfer_status').on(table.status),
    sourceTxIdx: index('idx_source_tx').on(table.sourceTxHash),
    targetTxIdx: index('idx_target_tx').on(table.targetTxHash),
    createDateIdx: index('idx_created_at').on(table.createdAt),
  })
);

/**
 * Chain Metrics
 * Real-time metrics for each chain (gas prices, congestion, bridge latency)
 */
export const chainMetrics = pgTable(
  'chain_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chain: varchar('chain').notNull(),
    
    // Gas metrics (in Gwei for EVM, Sun for Tron)
    gasPriceLow: decimal('gas_price_low', { precision: 18, scale: 9 }).notNull(),
    gasPriceStandard: decimal('gas_price_standard', { precision: 18, scale: 9 }).notNull(),
    gasPriceFast: decimal('gas_price_fast', { precision: 18, scale: 9 }).notNull(),
    baseFee: decimal('base_fee', { precision: 18, scale: 9 }),
    priorityFee: decimal('priority_fee', { precision: 18, scale: 9 }),
    
    // Network congestion
    congestionLevel: varchar('congestion_level').notNull().default('low'), // low, medium, high, critical
    mempoolSize: integer('mempool_size'),
    pendingTransactions: integer('pending_transactions'),
    
    // Block time
    avgBlockTime: decimal('avg_block_time', { precision: 10, scale: 3 }).notNull(),
    
    // Bridge metrics
    bridgeLatencySeconds: integer('bridge_latency_seconds'),
    failedBridges: integer('failed_bridges').default(0),
    
    // Token prices (for gas cost calculation)
    nativeTokenPriceUSD: decimal('native_token_price_usd', { precision: 18, scale: 6 }).notNull(),
    
    // Liquidity
    liquidityIndex: decimal('liquidity_index', { precision: 10, scale: 2 }).default('0'), // 1-100 scale
    
    // Chain health
    rpcHealth: varchar('rpc_health').default('unknown'), // healthy, degraded, down
    isMaintenanceMode: boolean('is_maintenance_mode').default(false),
    
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chainIdx: index('idx_metrics_chain').on(table.chain),
    recordedAtIdx: index('idx_metrics_recorded_at').on(table.recordedAt),
    congestionIdx: index('idx_congestion_level').on(table.congestionLevel),
  })
);

// Transfer between accounts schema
export const transferSchema = z.object({
  fromAccountId: z.string().uuid('Invalid from account ID'),
  toAccountId: z.string().uuid('Invalid to account ID'),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  reason: z.string().optional(),
});

// Query schema
export const accountQuerySchema = z.object({
  userId: z.string(),
  accountType: z.enum(['wallet', 'trading', 'vault', 'escrow']).optional(),
  currency: z.string().optional().default('USDC'),
});

/**
 * Multi-chain transfer request schema
 */
export const crossChainTransferSchema = z.object({
  withdrawalId: z.string().uuid('Invalid withdrawal ID'),
  sourceChain: z.string().min(1, 'Source chain required'),
  targetChain: z.string().min(1, 'Target chain required'),
  sourceToken: z.string().min(1, 'Source token required'),
  targetToken: z.string().min(1, 'Target token required'),
  sourceAmount: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount'),
  recipientAddress: z.string().min(1, 'Recipient address required'),
  bridgeProtocol: z.enum(['layerzero', 'axelar', 'wormhole', 'stargate', 'direct']).optional().default('direct'),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type AccountQueryInput = z.infer<typeof accountQuerySchema>;

/**
 * Helper types
 */
export interface AccountBalance {
  accountId: string;
  accountType: AccountType;
  balance: string;
  locked: string;
  available: string; // balance - locked
  currency: string;
  status: AccountStatus;
}

export interface NetWorthSummary {
  userId: string;
  totalBalance: string;
  totalLocked: string;
  totalAvailable: string;
  accounts: AccountBalance[];
  currency: string;
}
