/**
 * Transaction Processing Schema - Drizzle ORM Tables
 * Handles transaction batching, smart contracts, swaps, yield farming, DeFi operations
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, decimal, integer, index, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===== TRANSACTION BATCHING =====

/**
 * Transaction batches for multi-transaction execution
 */
export const transactionBatches = pgTable("transaction_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: varchar("dao_id", { length: 255 }),
  batchName: varchar("batch_name", { length: 255 }),
  batchType: varchar("batch_type", { length: 100 }), // 'swap', 'stake', 'yield', 'rebalance'
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'staged', 'executing', 'completed', 'failed'
  priority: varchar("priority", { length: 20 }).default("normal"), // 'low', 'normal', 'high'
  
  // Batch stats
  totalTransactions: integer("total_transactions").default(0),
  completedTransactions: integer("completed_transactions").default(0),
  failedTransactions: integer("failed_transactions").default(0),
  
  // Gas info
  estimatedGas: numeric("estimated_gas", { precision: 20, scale: 0 }),
  actualGasUsed: varchar("actual_gas_used", { length: 255 }),
  gasOptimizationPercent: varchar("gas_optimization_percent", { length: 100 }),
  
  // Timing
  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("transaction_batches_status_idx").on(table.status),
  daoIdx: index("transaction_batches_dao_idx").on(table.daoId),
}));

/**
 * Individual transactions within a batch
 */
export const batchedTransactions = pgTable("batched_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id"),
  
  // Transaction info
  txIndex: integer("tx_index"),
  txHash: varchar("tx_hash", { length: 255 }),
  
  // Execution details
  targetAddress: varchar("target_address", { length: 255 }),
  functionSignature: varchar("function_signature", { length: 255 }),
  functionParams: jsonb("function_params").default("{}"),
  callValue: varchar("call_value", { length: 100 }).default("0"),
  
  // Gas info
  estimatedGas: varchar("estimated_gas", { length: 255 }).default("21000"),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  
  // Results
  gasUsed: varchar("gas_used", { length: 255 }),
  gasPrice: varchar("gas_price", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  batchIdIdx: index("batched_transactions_batch_idx").on(table.batchId),
  statusIdx: index("batched_transactions_status_idx").on(table.status),
}));

// ===== SMART CONTRACTS =====

/**
 * Smart contract registry
 */
export const smartContracts = pgTable("smart_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(),
  contractAddress: varchar("contract_address", { length: 255 }).notNull(),
  contractName: varchar("contract_name", { length: 255 }).notNull(),
  contractType: varchar("contract_type", { length: 100 }), // 'dex', 'pool', 'token', 'bridge'
  
  // ABI and metadata
  abi: jsonb("abi"),
  deploymentDate: timestamp("deployment_date"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainAddressIdx: index("smart_contracts_chain_address").on(table.chainId, table.contractAddress),
  contractTypeIdx: index("smart_contracts_type_idx").on(table.contractType),
}));

/**
 * Contract interaction history
 */
export const contractInteractions = pgTable("contract_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id"),
  
  // Who called it
  fromAddress: varchar("from_address", { length: 255 }),
  
  // Function info
  functionName: varchar("function_name", { length: 255 }),
  functionType: varchar("function_type", { length: 50 }), // 'read', 'write', 'state_change'
  
  // Call details
  inputParams: jsonb("input_params").default("{}"),
  outputData: jsonb("output_data").default("{}"),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  contractIdIdx: index("contract_interactions_contract_idx").on(table.contractId),
  functionNameIdx: index("contract_interactions_function_idx").on(table.functionName),
}));

// ===== DEX SWAPS =====

/**
 * DEX swap transactions
 */
export const dexSwaps = pgTable("dex_swaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Swap details
  dexId: varchar("dex_id", { length: 100 }), // 'uniswap', 'sushiswap', etc
  fromToken: varchar("from_token", { length: 100 }).notNull(),
  toToken: varchar("to_token", { length: 100 }).notNull(),
  
  // Amounts
  fromAmount: varchar("from_amount", { length: 255 }).notNull(),
  toAmountExpected: varchar("to_amount_expected", { length: 255 }),
  toAmountActual: varchar("to_amount_actual", { length: 255 }),
  
  // Pricing
  slippagePercent: varchar("slippage_percent", { length: 100 }).default("0.5"),
  priceImpactPercent: varchar("price_impact_percent", { length: 100 }),
  
  // Transaction link
  transactionId: varchar("transaction_id", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  statusIdx: index("dex_swaps_status_idx").on(table.status),
  dexIdx: index("dex_swaps_dex_idx").on(table.dexId),
}));

// ===== YIELD FARMING =====

/**
 * Yield farms registry
 */
export const yieldFarms = pgTable("yield_farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id").notNull(),
  farmName: varchar("farm_name", { length: 255 }).notNull(),
  protocol: varchar("protocol", { length: 100 }), // 'aave', 'compound', 'curve'
  
  // Pool info
  poolAddress: varchar("pool_address", { length: 255 }).notNull(),
  tokenAddress: varchar("token_address", { length: 255 }),
  
  // APY and rewards
  currentApy: varchar("current_apy", { length: 100 }),
  rewardToken: varchar("reward_token", { length: 100 }),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  chainPoolIdx: index("yield_farms_chain_pool").on(table.chainId, table.poolAddress),
  protocolIdx: index("yield_farms_protocol_idx").on(table.protocol),
}));

/**
 * Yield farming positions
 */
export const yieldPositions = pgTable("yield_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id"),
  
  // Deposit details
  depositedAmount: varchar("deposited_amount", { length: 255 }).notNull(),
  depositedAmountUsd: numeric("deposited_amount_usd", { precision: 20, scale: 2 }),
  
  // Rewards
  accumulatedRewards: varchar("accumulated_rewards", { length: 255 }),
  accumulatedRewardsUsd: numeric("accumulated_rewards_usd", { precision: 20, scale: 2 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("active"), // 'active', 'withdrawn', 'paused'
  
  // Timing
  depositedAt: timestamp("deposited_at").defaultNow(),
  withdrawnAt: timestamp("withdrawn_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  farmIdIdx: index("yield_positions_farm_idx").on(table.farmId),
  statusIdx: index("yield_positions_status_idx").on(table.status),
}));

/**
 * Yield reward claims
 */
export const yieldClaims = pgTable("yield_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id").notNull(),
  
  // Claim details
  rewardAmount: varchar("reward_amount", { length: 255 }).notNull(),
  rewardAmountUsd: varchar("reward_amount_usd", { length: 255 }),
  rewardToken: varchar("reward_token", { length: 100 }),
  
  // Transaction
  transactionHash: varchar("transaction_hash", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  positionIdIdx: index("yield_claims_position_idx").on(table.positionId),
}));

// ===== REBALANCING =====

/**
 * Portfolio rebalancing rules
 */
export const rebalancingRules = pgTable("rebalancing_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Rule details
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  targetAllocations: jsonb("target_allocations").default("{}"),
  
  // Trigger type
  rebalanceTrigger: varchar("rebalance_trigger", { length: 100 }), // 'deviation', 'schedule', 'manual'
  deviationThreshold: varchar("deviation_threshold", { length: 100 }),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  activeIdx: index("rebalancing_rules_active_idx").on(table.isActive),
}));

/**
 * Rebalancing actions executed
 */
export const rebalancingActions = pgTable("rebalancing_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id"),
  batchId: uuid("batch_id"),
  
  // Action details
  tokensSold: jsonb("tokens_sold").default("[]"),
  tokensBought: jsonb("tokens_bought").default("[]"),
  totalSwapValueUsd: varchar("total_swap_value_usd", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"),
  
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ruleIdIdx: index("rebalancing_actions_rule_idx").on(table.ruleId),
  batchIdIdx: index("rebalancing_actions_batch_idx").on(table.batchId),
}));

// ===== BRIDGES =====

/**
 * Cross-chain bridge transactions
 */
export const bridgeTransactions = pgTable("bridge_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Bridge details
  sourceChainId: integer("source_chain_id").notNull(),
  destinationChainId: integer("destination_chain_id").notNull(),
  bridgeContractId: uuid("bridge_contract_id"),
  
  // Token and amount
  sourceToken: varchar("source_token", { length: 255 }).notNull(),
  sourceAmount: varchar("source_amount", { length: 255 }).notNull(),
  destinationToken: varchar("destination_token", { length: 255 }),
  destinationAmount: varchar("destination_amount", { length: 255 }),
  
  // Transactions
  sourceTxHash: varchar("source_tx_hash", { length: 255 }),
  destinationTxHash: varchar("destination_tx_hash", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 50 }).default("initiated"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("bridge_transactions_status_idx").on(table.status),
  chainsIdx: index("bridge_transactions_chains").on(table.sourceChainId, table.destinationChainId),
}));

// ===== SIMULATIONS =====

/**
 * Transaction simulations before execution
 */
export const transactionSimulations = pgTable("transaction_simulations", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id"),
  
  // Simulation target
  targetContract: varchar("target_contract", { length: 255 }).notNull(),
  functionSignature: varchar("function_signature", { length: 255 }).notNull(),
  inputParams: jsonb("input_params").default("{}"),
  
  // Results
  estimatedGas: varchar("estimated_gas", { length: 255 }),
  estimatedCost: varchar("estimated_cost", { length: 255 }),
  estimatedCostUsd: varchar("estimated_cost_usd", { length: 255 }),
  isValid: boolean("is_valid").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  chainIdx: index("transaction_simulations_chain_idx").on(table.chainId),
}));

// ===== GAS OPTIMIZATION =====

/**
 * Gas optimization history
 */
export const gasOptimizationHistory = pgTable("gas_optimization_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id"),
  
  // Optimization strategy
  optimizationStrategy: varchar("optimization_strategy", { length: 255 }).notNull(),
  
  // Gas metrics
  originalGasEstimate: varchar("original_gas_estimate", { length: 255 }).notNull(),
  optimizedGasEstimate: varchar("optimized_gas_estimate", { length: 255 }).notNull(),
  gasSavings: varchar("gas_savings", { length: 255 }),
  gasSavingsPercent: varchar("gas_savings_percent", { length: 100 }),
  
  // Cost metrics
  originalCost: varchar("original_cost", { length: 255 }).notNull(),
  optimizedCost: varchar("optimized_cost", { length: 255 }).notNull(),
  costSavings: varchar("cost_savings", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  batchIdIdx: index("gas_optimization_history_batch_idx").on(table.batchId),
}));

// ===== PRICE FEEDS =====

/**
 * Oracle price feeds
 */
export const priceOracleFeeds = pgTable("price_oracle_feeds", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: integer("chain_id"),
  
  // Feed details
  feedName: varchar("feed_name", { length: 255 }).notNull(),
  assetSymbol: varchar("asset_symbol", { length: 50 }).notNull(),
  sourceOracle: varchar("source_oracle", { length: 100 }), // 'chainlink', 'uniswap', 'pyth'
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  symbolIdx: index("price_oracle_feeds_symbol_idx").on(table.assetSymbol),
  chainIdx: index("price_oracle_feeds_chain_idx").on(table.chainId),
}));

/**
 * Price history for oracle data
 */
export const priceHistory = pgTable("price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedId: uuid("feed_id"),
  
  // Price data
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  priceUsd: numeric("price_usd", { precision: 20, scale: 2 }),
  
  // Timing
  timestamp: timestamp("timestamp").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  feedIdIdx: index("price_history_feed_idx").on(table.feedId),
  timestampIdx: index("price_history_timestamp_idx").on(table.timestamp),
}));

// ===== RELATIONS =====

export const transactionBatchesRelations = relations(transactionBatches, ({ many }) => ({
  transactions: many(batchedTransactions),
  rebalancingActions: many(rebalancingActions),
  gasOptimization: many(gasOptimizationHistory),
}));

export const batchedTransactionsRelations = relations(batchedTransactions, ({ one }) => ({
  batch: one(transactionBatches, {
    fields: [batchedTransactions.batchId],
    references: [transactionBatches.id],
  }),
}));

export const smartContractsRelations = relations(smartContracts, ({ many }) => ({
  interactions: many(contractInteractions),
}));

export const contractInteractionsRelations = relations(contractInteractions, ({ one }) => ({
  contract: one(smartContracts, {
    fields: [contractInteractions.contractId],
    references: [smartContracts.id],
  }),
}));

export const yieldFarmsRelations = relations(yieldFarms, ({ many }) => ({
  positions: many(yieldPositions),
}));

export const yieldPositionsRelations = relations(yieldPositions, ({ one, many }) => ({
  farm: one(yieldFarms, {
    fields: [yieldPositions.farmId],
    references: [yieldFarms.id],
  }),
  claims: many(yieldClaims),
}));

export const yieldClaimsRelations = relations(yieldClaims, ({ one }) => ({
  position: one(yieldPositions, {
    fields: [yieldClaims.positionId],
    references: [yieldPositions.id],
  }),
}));

export const rebalancingRulesRelations = relations(rebalancingRules, ({ many }) => ({
  actions: many(rebalancingActions),
}));

export const rebalancingActionsRelations = relations(rebalancingActions, ({ one }) => ({
  rule: one(rebalancingRules, {
    fields: [rebalancingActions.ruleId],
    references: [rebalancingRules.id],
  }),
  batch: one(transactionBatches, {
    fields: [rebalancingActions.batchId],
    references: [transactionBatches.id],
  }),
}));

export const priceOracleFeedsRelations = relations(priceOracleFeeds, ({ many }) => ({
  history: many(priceHistory),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  feed: one(priceOracleFeeds, {
    fields: [priceHistory.feedId],
    references: [priceOracleFeeds.id],
  }),
}));
