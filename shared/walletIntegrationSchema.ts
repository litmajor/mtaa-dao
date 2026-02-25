/**
 * Wallet Integration Schema - Phase 2
 * Blockchain wallet connectivity, multi-chain support, and transaction management
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, decimal, integer, index, numeric, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ===== WALLET INFRASTRUCTURE =====

/**
 * Supported blockchain networks
 */
export const blockchainNetworks = pgTable("blockchain_networks", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull().unique(), // Network ID (1=Ethereum, 42220=Celo, etc)
  chainName: varchar("chain_name", { length: 100 }).notNull().unique(), // 'ethereum', 'celo', 'polygon', 'solana'
  displayName: varchar("display_name", { length: 100 }).notNull(), // Human-readable name
  nativeToken: varchar("native_token", { length: 20 }).notNull(), // ETH, CELO, MATIC, SOL
  rpcUrl: text("rpc_url").notNull(), // Primary RPC endpoint
  rpcBackupUrl: text("rpc_backup_url"), // Backup RPC endpoint
  blockExplorerUrl: text("block_explorer_url"), // Block explorer URL
  
  // Network Configuration
  currency: varchar("currency", { length: 10 }).default("USD"), // Native currency
  decimals: integer("decimals").default(18), // Decimal places for native token
  gasEstimate: numeric("gas_estimate", { precision: 20, scale: 8 }), // Estimated gas price
  blockTime: integer("block_time"), // Average block time in seconds
  finality: integer("finality"), // Number of blocks for finality
  
  // Status
  isActive: boolean("is_active").default(true),
  isTestnet: boolean("is_testnet").default(false),
  maintenanceMode: boolean("maintenance_mode").default(false),
  
  // Metadata
  logoUrl: varchar("logo_url", { length: 500 }),
  metadata: jsonb("metadata").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainIdIdx: index("blockchain_networks_chain_id_idx").on(table.chainId),
  nameIdx: index("blockchain_networks_name_idx").on(table.chainName),
}));

/**
 * Supported blockchain tokens (across all networks)
 */
export const blockchainTokens = pgTable("blockchain_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(), // Which network
  tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(), // USDC, DAI, CELO, WETH
  tokenName: varchar("token_name", { length: 100 }).notNull(), // Full name
  contractAddress: varchar("contract_address", { length: 255 }).notNull(), // 0x... address
  decimals: integer("decimals").default(18),
  
  // Token Info
  isNativeToken: boolean("is_native_token").default(false), // True if it's the network's native token
  isPrimary: boolean("is_primary").default(false), // Primary currency for the network
  isStablecoin: boolean("is_stablecoin").default(false),
  
  // Price & Market Data
  currentPrice: numeric("current_price", { precision: 20, scale: 8 }), // Current price in USD
  marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }),
  percentChange24h: numeric("percent_change_24h", { precision: 10, scale: 4 }),
  priceUpdatedAt: timestamp("price_updated_at"),
  
  // Metadata
  logoUrl: varchar("logo_url", { length: 500 }),
  coingeckoId: varchar("coingecko_id", { length: 100 }), // For price feeds
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainTokenIdx: index("blockchain_tokens_chain_token").on(table.chainId, table.tokenSymbol),
  contractIdx: index("blockchain_tokens_contract_idx").on(table.contractAddress),
  symbolIdx: index("blockchain_tokens_symbol_idx").on(table.tokenSymbol),
}));

/**
 * User wallet accounts (one per network)
 */
export const walletConnections = pgTable("wallet_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(), // Links to accounts table
  userId: varchar("user_id").notNull(), // Links to users table
  chainId: integer("chain_id").notNull(), // Which blockchain network
  
  // Wallet Details
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(), // 0x... or other format
  walletType: varchar("wallet_type", { length: 50 }).default("eoa"), // 'eoa', 'contract', 'multisig', 'hardware'
  walletLabel: varchar("wallet_label", { length: 100 }), // User-friendly name
  
  // Connection Status
  isConnected: boolean("is_connected").default(true),
  isPrimary: boolean("is_primary").default(false), // Primary wallet for this chain
  isVerified: boolean("is_verified").default(false), // Address ownership verified
  verificationSignature: text("verification_signature"), // Signed message
  
  // Balance & Activity
  nativeBalance: numeric("native_balance", { precision: 20, scale: 8 }).default("0"), // Balance of native token
  lastSyncedAt: timestamp("last_synced_at"),
  lastActivityAt: timestamp("last_activity_at"),
  
  // Security
  allowAutoTransactions: boolean("allow_auto_transactions").default(false),
  dailyLimit: numeric("daily_limit", { precision: 20, scale: 8 }), // Transaction limit
  monthlyLimit: numeric("monthly_limit", { precision: 20, scale: 8 }),
  
  metadata: jsonb("metadata").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  accountChainIdx: index("wallet_connections_account_chain").on(table.accountId, table.chainId),
  addressIdx: index("wallet_connections_address_idx").on(table.walletAddress),
  userIdx: index("wallet_connections_user_idx").on(table.userId),
}));

/**
 * Token balances per wallet
 */
export const walletTokenBalances = pgTable("wallet_token_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(), // Link to wallet
  tokenId: uuid("token_id").notNull(), // Which token
  chainId: integer("chain_id").notNull(), // Redundant but for queries
  
  balance: numeric("balance", { precision: 20, scale: 8 }).default("0"), // Token balance
  balanceUsd: numeric("balance_usd", { precision: 20, scale: 2 }).default("0"), // USD value
  
  // Historical tracking
  previousBalance: numeric("previous_balance", { precision: 20, scale: 8 }),
  balanceChangedAt: timestamp("balance_changed_at"),
  
  // Status
  isStaked: boolean("is_staked").default(false),
  stakedAmount: numeric("staked_amount", { precision: 20, scale: 8 }),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletTokenIdx: index("wallet_token_balances_wallet_token").on(table.walletConnectionId, table.tokenId),
  chainIdx: index("wallet_token_balances_chain_idx").on(table.chainId),
}));

/**
 * On-chain transactions
 */
export const blockchainTransactions = pgTable("blockchain_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Transaction Details
  txHash: varchar("tx_hash", { length: 255 }).notNull().unique(), // Transaction hash
  chainId: integer("chain_id").notNull(),
  
  // Related Entities
  accountId: uuid("account_id"),
  walletConnectionId: uuid("wallet_connection_id"),
  userId: varchar("user_id"), // Who initiated
  
  // Transaction Info
  fromAddress: varchar("from_address", { length: 255 }).notNull(),
  toAddress: varchar("to_address", { length: 255 }).notNull(),
  tokenId: uuid("token_id"), // Which token (null for native)
  tokenSymbol: varchar("token_symbol", { length: 20 }),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 20, scale: 2 }),
  
  // Gas & Fees
  gasLimit: numeric("gas_limit", { precision: 20, scale: 0 }),
  gasUsed: numeric("gas_used", { precision: 20, scale: 0 }),
  gasPrice: numeric("gas_price", { precision: 20, scale: 8 }),
  txFee: numeric("tx_fee", { precision: 20, scale: 8 }), // Total fee in native token
  txFeeUsd: numeric("tx_fee_usd", { precision: 20, scale: 2 }),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'completed', 'failed', 'confirmed'
  blockNumber: integer("block_number"),
  confirmations: integer("confirmations").default(0),
  blockTimestamp: timestamp("block_timestamp"),
  
  // Metadata
  description: text("description"),
  transactionType: varchar("transaction_type", { length: 50 }), // 'transfer', 'swap', 'stake', 'mint', 'burn'
  metadata: jsonb("metadata").default("{}"),
  
  // Error handling
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  txHashIdx: index("blockchain_transactions_tx_hash_idx").on(table.txHash),
  chainIdx: index("blockchain_transactions_chain_idx").on(table.chainId),
  accountIdx: index("blockchain_transactions_account_idx").on(table.accountId),
  walletIdx: index("blockchain_transactions_wallet_idx").on(table.walletConnectionId),
  userIdx: index("blockchain_transactions_user_idx").on(table.userId),
  statusIdx: index("blockchain_transactions_status_idx").on(table.status),
  dateIdx: index("blockchain_transactions_date_idx").on(table.createdAt),
}));

/**
 * Transaction queue (pending/retry)
 */
export const transactionQueue = pgTable("transaction_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Queue Details
  queueStatus: varchar("queue_status", { length: 20 }).default("pending"), // 'pending', 'processing', 'completed', 'failed', 'cancelled'
  priority: integer("priority").default(0), // 0-10, higher priority processed first
  
  // Transaction Info
  chainId: integer("chain_id").notNull(),
  walletConnectionId: uuid("wallet_connection_id"),
  toAddress: varchar("to_address", { length: 255 }).notNull(),
  tokenSymbol: varchar("token_symbol", { length: 20 }),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  
  // Gas Configuration
  gasLimit: numeric("gas_limit", { precision: 20, scale: 0 }),
  gasPrice: numeric("gas_price", { precision: 20, scale: 8 }), // Custom gas price
  maxFeePerGas: numeric("max_fee_per_gas", { precision: 20, scale: 8 }), // For EIP-1559
  maxPriorityFeePerGas: numeric("max_priority_fee_per_gas", { precision: 20, scale: 8 }),
  
  // Retry Logic
  maxRetries: integer("max_retries").default(3),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  lastRetryError: text("last_retry_error"),
  
  // Result
  txHash: varchar("tx_hash", { length: 255 }), // Hash once broadcast
  estimatedFee: numeric("estimated_fee", { precision: 20, scale: 8 }),
  actualFee: numeric("actual_fee", { precision: 20, scale: 8 }), // Actual fee after completion
  
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata").default("{}"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  scheduledFor: timestamp("scheduled_for"),
}, (table) => ({
  statusIdx: index("transaction_queue_status_idx").on(table.queueStatus),
  walletIdx: index("transaction_queue_wallet_idx").on(table.walletConnectionId),
  chainIdx: index("transaction_queue_chain_idx").on(table.chainId),
  retryIdx: index("transaction_queue_retry_idx").on(table.nextRetryAt),
}));

/**
 * Wallet connection history (audit trail)
 */
export const walletConnectionHistory = pgTable("wallet_connection_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletConnectionId: uuid("wallet_connection_id").notNull(),
  
  // Event
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'connected', 'disconnected', 'synced', 'verified', 'limits_updated'
  eventData: jsonb("event_data").default("{}"), // Event-specific data
  
  // Who & How
  userId: varchar("user_id"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Status
  status: varchar("status", { length: 20 }).default("success"), // 'success', 'failed'
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  walletIdx: index("wallet_connection_history_wallet_idx").on(table.walletConnectionId),
  typeIdx: index("wallet_connection_history_type_idx").on(table.eventType),
}));

/**
 * Network health monitoring
 */
export const networkHealth = pgTable("network_health", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(),
  
  // Health Metrics
  isHealthy: boolean("is_healthy").default(true),
  rpcLatency: numeric("rpc_latency", { precision: 10, scale: 2 }), // Milliseconds
  blockTime: numeric("block_time", { precision: 10, scale: 2 }), // Actual block time
  gasPrice: numeric("gas_price", { precision: 20, scale: 8 }), // Current gas price
  
  // Network Status
  blockNumber: integer("block_number"),
  activeConnections: integer("active_connections").default(0),
  failedRequests: integer("failed_requests").default(0),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default("100"), // Percentage
  
  // Status
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
  lastFailedAt: timestamp("last_failed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  chainIdx: index("network_health_chain_idx").on(table.chainId),
  healthIdx: index("network_health_health_idx").on(table.isHealthy),
}));

// ===== TYPES =====

export type BlockchainNetwork = typeof blockchainNetworks.$inferSelect;
export type InsertBlockchainNetwork = typeof blockchainNetworks.$inferInsert;
export type BlockchainToken = typeof blockchainTokens.$inferSelect;
export type InsertBlockchainToken = typeof blockchainTokens.$inferInsert;
export type WalletConnection = typeof walletConnections.$inferSelect;
export type InsertWalletConnection = typeof walletConnections.$inferInsert;
export type WalletTokenBalance = typeof walletTokenBalances.$inferSelect;
export type InsertWalletTokenBalance = typeof walletTokenBalances.$inferInsert;
export type BlockchainTransaction = typeof blockchainTransactions.$inferSelect;
export type InsertBlockchainTransaction = typeof blockchainTransactions.$inferInsert;
export type TransactionQueue = typeof transactionQueue.$inferSelect;
export type InsertTransactionQueue = typeof transactionQueue.$inferInsert;
export type WalletConnectionHistory = typeof walletConnectionHistory.$inferSelect;
export type InsertWalletConnectionHistory = typeof walletConnectionHistory.$inferInsert;
export type NetworkHealth = typeof networkHealth.$inferSelect;
export type InsertNetworkHealth = typeof networkHealth.$inferInsert;

// ===== ZOD SCHEMAS =====

export const insertBlockchainNetworkSchema = createInsertSchema(blockchainNetworks);
export const insertBlockchainTokenSchema = createInsertSchema(blockchainTokens);
export const insertWalletConnectionSchema = createInsertSchema(walletConnections);
export const insertWalletTokenBalanceSchema = createInsertSchema(walletTokenBalances);
export const insertBlockchainTransactionSchema = createInsertSchema(blockchainTransactions);
export const insertTransactionQueueSchema = createInsertSchema(transactionQueue);
export const insertWalletConnectionHistorySchema = createInsertSchema(walletConnectionHistory);
export const insertNetworkHealthSchema = createInsertSchema(networkHealth);

// ===== RELATIONS =====

export const blockchainNetworksRelations = relations(blockchainNetworks, ({ many }) => ({
  tokens: many(blockchainTokens),
  walletConnections: many(walletConnections),
  transactions: many(blockchainTransactions),
  networkHealth: many(networkHealth),
}));

export const blockchainTokensRelations = relations(blockchainTokens, ({ one, many }) => ({
  network: one(blockchainNetworks, {
    fields: [blockchainTokens.chainId],
    references: [blockchainNetworks.chainId],
  }),
  balances: many(walletTokenBalances),
}));

export const walletConnectionsRelations = relations(walletConnections, ({ one, many }) => ({
  network: one(blockchainNetworks, {
    fields: [walletConnections.chainId],
    references: [blockchainNetworks.chainId],
  }),
  tokenBalances: many(walletTokenBalances),
  transactions: many(blockchainTransactions),
  queuedTransactions: many(transactionQueue),
  history: many(walletConnectionHistory),
}));

export const walletTokenBalancesRelations = relations(walletTokenBalances, ({ one }) => ({
  wallet: one(walletConnections, {
    fields: [walletTokenBalances.walletConnectionId],
    references: [walletConnections.id],
  }),
  token: one(blockchainTokens, {
    fields: [walletTokenBalances.tokenId],
    references: [blockchainTokens.id],
  }),
}));

export const blockchainTransactionsRelations = relations(blockchainTransactions, ({ one }) => ({
  network: one(blockchainNetworks, {
    fields: [blockchainTransactions.chainId],
    references: [blockchainNetworks.chainId],
  }),
  wallet: one(walletConnections, {
    fields: [blockchainTransactions.walletConnectionId],
    references: [walletConnections.id],
  }),
  token: one(blockchainTokens, {
    fields: [blockchainTransactions.tokenId],
    references: [blockchainTokens.id],
  }),
}));

export const transactionQueueRelations = relations(transactionQueue, ({ one }) => ({
  wallet: one(walletConnections, {
    fields: [transactionQueue.walletConnectionId],
    references: [walletConnections.id],
  }),
}));

export const walletConnectionHistoryRelations = relations(walletConnectionHistory, ({ one }) => ({
  wallet: one(walletConnections, {
    fields: [walletConnectionHistory.walletConnectionId],
    references: [walletConnections.id],
  }),
}));

export const networkHealthRelations = relations(networkHealth, ({ one }) => ({
  network: one(blockchainNetworks, {
    fields: [networkHealth.chainId],
    references: [blockchainNetworks.chainId],
  }),
}));
