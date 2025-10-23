// Enhanced Financial Schema - Additional Tables for Complete Financial System
// High-Priority: user_balances, dao_treasuries, transaction_fees, currency_swaps
// Medium-Priority: mpesa_transactions, gas_price_history, referral_payouts

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { users, daos, vaults, walletTransactions, referralRewards } from "./schema";
import { createInsertSchema } from "drizzle-zod";

/**
 * 1. USER BALANCES TABLE (HIGH PRIORITY) ⭐⭐⭐⭐⭐
 * Purpose: Fast balance lookups without complex transaction queries
 * Benefits: 
 * - Real-time balance display
 * - Fast transaction validation
 * - Reduced database load
 * - Support for multiple currencies per user
 */
export const userBalances = pgTable("user_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id), // null for personal balance
  currency: varchar("currency").notNull(), // cUSD, CELO, KES, MTAA
  
  // Balance breakdown
  availableBalance: decimal("available_balance", { precision: 18, scale: 8 }).default("0"),
  pendingBalance: decimal("pending_balance", { precision: 18, scale: 8 }).default("0"), // pending transactions
  lockedBalance: decimal("locked_balance", { precision: 18, scale: 8 }).default("0"), // in escrow, locked savings
  totalBalance: decimal("total_balance", { precision: 18, scale: 8 }).default("0"),
  
  // Tracking
  lastTransactionId: uuid("last_transaction_id"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  
  // Note: Add UNIQUE constraint on (userId, daoId, currency) in migration
});

/**
 * 2. DAO TREASURIES TABLE (HIGH PRIORITY) ⭐⭐⭐⭐⭐
 * Purpose: Dedicated DAO treasury management separate from vaults
 * Benefits:
 * - Multi-sig controls
 * - Spending limits and governance
 * - Emergency reserves
 * - Treasury auditing
 */
export const daoTreasuries = pgTable("dao_treasuries", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id).notNull().unique(),
  vaultId: uuid("vault_id").references(() => vaults.id), // underlying vault
  
  // Balances by category
  totalBalance: decimal("total_balance", { precision: 18, scale: 8 }).default("0"),
  availableBalance: decimal("available_balance", { precision: 18, scale: 8 }).default("0"),
  allocatedBalance: decimal("allocated_balance", { precision: 18, scale: 8 }).default("0"), // allocated to proposals/budgets
  reserveBalance: decimal("reserve_balance", { precision: 18, scale: 8 }).default("0"), // emergency reserve
  
  // Treasury rules
  minimumReserve: decimal("minimum_reserve", { precision: 18, scale: 8 }).default("0"), // min balance required
  dailySpendingLimit: decimal("daily_spending_limit", { precision: 18, scale: 8 }),
  proposalThreshold: decimal("proposal_threshold", { precision: 18, scale: 8 }), // amount requiring proposal
  
  // Multi-sig settings
  requiredSignatures: integer("required_signatures").default(1),
  signers: jsonb("signers").default([]), // array of user IDs
  
  // Audit trail
  lastAuditDate: timestamp("last_audit_date"),
  auditedBy: varchar("audited_by").references(() => users.id),
  auditReport: jsonb("audit_report"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 3. TRANSACTION FEES TABLE (HIGH PRIORITY) ⭐⭐⭐⭐⭐
 * Purpose: Track all platform fees and revenue
 * Benefits:
 * - Revenue analytics
 * - Fee reconciliation
 * - User fee history
 * - Platform monetization tracking
 */
export const transactionFees = pgTable("transaction_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id"), // references walletTransactions or vaultTransactions
  transactionType: varchar("transaction_type").notNull(), // wallet, vault, escrow, payment
  
  // Fee details
  feeType: varchar("fee_type").notNull(), // platform_fee, gas_fee, network_fee, service_fee, performance_fee
  feeCategory: varchar("fee_category").notNull(), // mpesa_deposit, crypto_withdrawal, vault_management, currency_swap
  baseAmount: decimal("base_amount", { precision: 18, scale: 8 }).notNull(), // original transaction amount
  feeAmount: decimal("fee_amount", { precision: 18, scale: 8 }).notNull(), // fee charged
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 4 }), // e.g., 0.0250 = 2.5%
  currency: varchar("currency").notNull(),
  
  // Parties
  paidBy: varchar("paid_by").references(() => users.id),
  daoId: uuid("dao_id").references(() => daos.id),
  collectedBy: varchar("collected_by").default("platform"), // platform, dao, protocol
  
  // Revenue allocation
  platformRevenue: decimal("platform_revenue", { precision: 18, scale: 8 }).default("0"),
  daoRevenue: decimal("dao_revenue", { precision: 18, scale: 8 }).default("0"),
  protocolRevenue: decimal("protocol_revenue", { precision: 18, scale: 8 }).default("0"),
  
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * 4. CURRENCY SWAPS TABLE (HIGH PRIORITY) ⭐⭐⭐⭐⭐
 * Purpose: Track all currency conversions (KES ↔ cUSD ↔ CELO ↔ MTAA)
 * Benefits:
 * - Exchange rate history
 * - Slippage tracking
 * - Multi-currency support
 * - M-Pesa integration
 */
export const currencySwaps = pgTable("currency_swaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id),
  
  // Swap details
  fromCurrency: varchar("from_currency").notNull(), // KES, cUSD, CELO, MTAA
  toCurrency: varchar("to_currency").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 8 }).notNull(),
  
  // Exchange rate & pricing
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }).notNull(),
  marketRate: decimal("market_rate", { precision: 18, scale: 8 }), // reference rate
  spread: decimal("spread", { precision: 5, scale: 4 }), // percentage spread
  slippage: decimal("slippage", { precision: 5, scale: 4 }), // slippage percentage
  priceImpact: decimal("price_impact", { precision: 5, scale: 4 }), // price impact on pool
  
  // Fees
  platformFee: decimal("platform_fee", { precision: 18, scale: 8 }).default("0"),
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }).default("0"),
  liquidityProviderFee: decimal("liquidity_provider_fee", { precision: 18, scale: 8 }).default("0"),
  totalFee: decimal("total_fee", { precision: 18, scale: 8 }).default("0"),
  
  // Execution
  provider: varchar("provider").notNull(), // ubeswap, mento, manual
  protocol: varchar("protocol"), // uniswap_v2, uniswap_v3, mento
  route: jsonb("route"), // swap path for DEX swaps: [{token, pool, amountIn, amountOut}]
  transactionHash: varchar("transaction_hash"),
  blockNumber: integer("block_number"),
  gasUsed: decimal("gas_used", { precision: 18, scale: 8 }),
  
  // Status
  status: varchar("status").default("pending"), // pending, completed, failed, expired
  failureReason: text("failure_reason"),
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

/**
 * 5. MPESA TRANSACTIONS TABLE (MEDIUM PRIORITY) ⭐⭐⭐⭐
 * Purpose: Dedicated M-Pesa transaction tracking
 * Benefits:
 * - M-Pesa reconciliation
 * - STK Push tracking
 * - Callback management
 * - Kenya market support
 */
export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  paymentTransactionId: text("payment_transaction_id"), // references paymentTransactions.id
  
  // M-Pesa details
  transactionType: varchar("transaction_type").notNull(), // stk_push, b2c, c2b, reversal, balance_query
  phoneNumber: varchar("phone_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  accountReference: varchar("account_reference"), // user's reference
  transactionDesc: varchar("transaction_desc"),
  
  // M-Pesa request IDs
  merchantRequestId: varchar("merchant_request_id"),
  checkoutRequestId: varchar("checkout_request_id"),
  conversationId: varchar("conversation_id"),
  originatorConversationId: varchar("originator_conversation_id"),
  
  // M-Pesa response
  mpesaReceiptNumber: varchar("mpesa_receipt_number").unique(), // e.g., "QGN7MZ61SU"
  transactionDate: timestamp("transaction_date"),
  resultCode: varchar("result_code"),
  resultDesc: varchar("result_desc"),
  
  // Balance info (for B2C)
  balance: decimal("balance", { precision: 10, scale: 2 }),
  
  // Callback data
  callbackData: jsonb("callback_data"),
  callbackReceived: boolean("callback_received").default(false),
  callbackAt: timestamp("callback_at"),
  
  // Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed, reversed, cancelled
  failureReason: text("failure_reason"),
  
  // Retry logic
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  
  // Metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 6. GAS PRICE HISTORY TABLE (MEDIUM PRIORITY) ⭐⭐⭐
 * Purpose: Track Celo gas prices for cost optimization
 * Benefits:
 * - Help users time transactions
 * - Gas cost analytics
 * - Batch transaction optimization
 */
export const gasPriceHistory = pgTable("gas_price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  network: varchar("network").default("celo"), // celo, alfajores
  
  // Gas prices (in Gwei)
  gasPrice: decimal("gas_price", { precision: 18, scale: 8 }).notNull(),
  baseFee: decimal("base_fee", { precision: 18, scale: 8 }),
  priorityFee: decimal("priority_fee", { precision: 18, scale: 8 }),
  maxFee: decimal("max_fee", { precision: 18, scale: 8 }),
  
  // Statistics
  avgGasPrice1h: decimal("avg_gas_price_1h", { precision: 18, scale: 8 }),
  avgGasPrice24h: decimal("avg_gas_price_24h", { precision: 18, scale: 8 }),
  minGasPrice24h: decimal("min_gas_price_24h", { precision: 18, scale: 8 }),
  maxGasPrice24h: decimal("max_gas_price_24h", { precision: 18, scale: 8 }),
  
  // Network metrics
  networkCongestion: varchar("network_congestion"), // low, medium, high
  blockNumber: integer("block_number"),
  blockTime: integer("block_time"), // in seconds
  transactionCount: integer("transaction_count"),
  
  // Recommendations
  recommendedGasPrice: decimal("recommended_gas_price", { precision: 18, scale: 8 }),
  estimatedConfirmationTime: integer("estimated_confirmation_time"), // in seconds
  
  timestamp: timestamp("timestamp").defaultNow(),
});

/**
 * 7. REFERRAL PAYOUTS TABLE (MEDIUM PRIORITY) ⭐⭐⭐
 * Purpose: Track referral commission payouts
 * Benefits:
 * - Payout history
 * - Commission tracking
 * - Payment reconciliation
 */
export const referralPayouts = pgTable("referral_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  referralRewardId: uuid("referral_reward_id").references(() => referralRewards.id).notNull(),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  
  // Payout details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("MTAA"),
  payoutMethod: varchar("payout_method").notNull(), // wallet, mpesa, bank_transfer
  
  // Destination
  destinationAddress: varchar("destination_address"), // wallet address
  destinationPhone: varchar("destination_phone"), // for M-Pesa
  destinationAccount: varchar("destination_account"), // for bank transfer
  
  // Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  transactionId: uuid("transaction_id"),
  transactionHash: varchar("transaction_hash"),
  
  // Timing
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  
  // Error handling
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Metadata
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * 8. RECURRING PAYMENTS TABLE (LOW PRIORITY) ⭐⭐
 * Purpose: Handle recurring DAO contributions and subscriptions
 * Benefits:
 * - Automated contributions
 * - Subscription management
 * - Payment scheduling
 */
export const recurringPayments = pgTable("recurring_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  daoId: uuid("dao_id").references(() => daos.id),
  
  // Payment details
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  description: text("description"),
  
  // Schedule
  frequency: varchar("frequency").notNull(), // daily, weekly, biweekly, monthly, quarterly, yearly
  interval: integer("interval").default(1), // every N periods (e.g., every 2 weeks)
  startDate: timestamp("start_date").notNull(),
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  endDate: timestamp("end_date"),
  maxPayments: integer("max_payments"), // optional limit
  
  // Status
  isActive: boolean("is_active").default(true),
  isPaused: boolean("is_paused").default(false),
  pausedAt: timestamp("paused_at"),
  pausedReason: text("paused_reason"),
  
  // Payment tracking
  totalPayments: integer("total_payments").default(0),
  successfulPayments: integer("successful_payments").default(0),
  failedAttempts: integer("failed_attempts").default(0),
  lastPaymentId: uuid("last_payment_id"),
  lastPaymentDate: timestamp("last_payment_date"),
  lastFailureDate: timestamp("last_failure_date"),
  lastFailureReason: text("last_failure_reason"),
  
  // Payment method
  paymentMethod: varchar("payment_method").notNull(), // wallet, mpesa, card
  paymentMethodDetails: jsonb("payment_method_details"),
  
  // Notifications
  notifyOnSuccess: boolean("notify_on_success").default(true),
  notifyOnFailure: boolean("notify_on_failure").default(true),
  notifyBeforePayment: boolean("notify_before_payment").default(true),
  notifyDaysBefore: integer("notify_days_before").default(3),
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  cancelledReason: text("cancelled_reason"),
});

/**
 * 9. FINANCIAL REPORTS TABLE (LOW PRIORITY) ⭐⭐
 * Purpose: Store auto-generated financial reports
 * Benefits:
 * - Historical reports
 * - Audit compliance
 * - AI-generated insights
 */
export const financialReports = pgTable("financial_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id),
  userId: varchar("user_id").references(() => users.id), // null for DAO reports
  
  // Report details
  reportType: varchar("report_type").notNull(), // income_statement, balance_sheet, cash_flow, monthly, quarterly, annual, audit, tax
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  fiscalYear: integer("fiscal_year"),
  fiscalQuarter: integer("fiscal_quarter"),
  
  // Report data
  reportData: jsonb("report_data").notNull(),
  reportUrl: text("report_url"), // PDF URL
  reportFormat: varchar("report_format").default("pdf"), // pdf, json, csv, xlsx
  
  // Financial summary (for quick access)
  totalRevenue: decimal("total_revenue", { precision: 18, scale: 8 }),
  totalExpenses: decimal("total_expenses", { precision: 18, scale: 8 }),
  netProfit: decimal("net_profit", { precision: 18, scale: 8 }),
  totalAssets: decimal("total_assets", { precision: 18, scale: 8 }),
  totalLiabilities: decimal("total_liabilities", { precision: 18, scale: 8 }),
  equity: decimal("equity", { precision: 18, scale: 8 }),
  
  // AI insights
  aiSummary: text("ai_summary"),
  aiRecommendations: jsonb("ai_recommendations"),
  anomaliesDetected: jsonb("anomalies_detected"),
  
  // Generated by
  generatedBy: varchar("generated_by"), // ai, manual, system, accountant
  generatedByUserId: varchar("generated_by_user_id").references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow(),
  
  // Status
  status: varchar("status").default("draft"), // draft, pending_review, approved, published, archived
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  publishedAt: timestamp("published_at"),
  
  // Metadata
  notes: text("notes"),
  tags: jsonb("tags"), // for categorization
  version: integer("version").default(1),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Export types
export type UserBalance = typeof userBalances.$inferSelect;
export type DaoTreasury = typeof daoTreasuries.$inferSelect;
export type TransactionFee = typeof transactionFees.$inferSelect;
export type CurrencySwap = typeof currencySwaps.$inferSelect;
export type MpesaTransaction = typeof mpesaTransactions.$inferSelect;
export type GasPriceHistory = typeof gasPriceHistory.$inferSelect;
export type ReferralPayout = typeof referralPayouts.$inferSelect;
export type RecurringPayment = typeof recurringPayments.$inferSelect;
export type FinancialReport = typeof financialReports.$inferSelect;

// Export insert schemas
export const insertUserBalanceSchema = createInsertSchema(userBalances);
export const insertDaoTreasurySchema = createInsertSchema(daoTreasuries);
export const insertTransactionFeeSchema = createInsertSchema(transactionFees);
export const insertCurrencySwapSchema = createInsertSchema(currencySwaps);
export const insertMpesaTransactionSchema = createInsertSchema(mpesaTransactions);
export const insertGasPriceHistorySchema = createInsertSchema(gasPriceHistory);
export const insertReferralPayoutSchema = createInsertSchema(referralPayouts);
export const insertRecurringPaymentSchema = createInsertSchema(recurringPayments);
export const insertFinancialReportSchema = createInsertSchema(financialReports);

