/**
 * Admin Monitoring & Metrics Tables Schema
 * For storing platform metrics, analytics, and monitoring data
 * Last Updated: January 22, 2026
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  decimal,
  boolean,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

/**
 * PHASE 1 & 2: MONITORING METRICS TABLES
 */

// Platform Performance Metrics - Real-time system health tracking
export const platformMetrics = pgTable("platform_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Platform stats
  totalDAOs: integer("total_daos").notNull().default(0),
  activeDAOs: integer("active_daos").notNull().default(0),
  totalMembers: integer("total_members").notNull().default(0),
  totalVaults: integer("total_vaults").notNull().default(0),
  activeVaults: integer("active_vaults").notNull().default(0),
  
  // Financial metrics
  totalTVL: decimal("total_tvl", { precision: 20, scale: 8 }).notNull().default("0"),
  totalTransactions: integer("total_transactions").notNull().default(0),
  totalFees: decimal("total_fees", { precision: 20, scale: 8 }).notNull().default("0"),
  totalRevenue: decimal("total_revenue", { precision: 20, scale: 8 }).notNull().default("0"),
  
  // System health
  cpuUsage: decimal("cpu_usage", { precision: 5, scale: 2 }).default("0"),
  memoryUsage: decimal("memory_usage", { precision: 5, scale: 2 }).default("0"),
  diskUsage: decimal("disk_usage", { precision: 5, scale: 2 }).default("0"),
  networkLatency: integer("network_latency").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DeFi Protocol Metrics - Track protocol health and performance
export const defiProtocolMetrics = pgTable("defi_protocol_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  protocolName: varchar("protocol_name").notNull().unique(),
  
  status: varchar("status").notNull().default("operational"), // operational, maintenance, degraded
  tvl: decimal("tvl", { precision: 20, scale: 8 }).notNull().default("0"),
  apy: decimal("apy", { precision: 8, scale: 4 }).notNull().default("0"),
  poolCount: integer("pool_count").notNull().default(0),
  healthScore: integer("health_score").default(100),
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  
  // Additional metrics
  volume24h: decimal("volume_24h", { precision: 20, scale: 8 }).default("0"),
  uniqueUsers: integer("unique_users").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CeFi Exchange Metrics - Track exchange integrations
export const cefiExchangeMetrics = pgTable("cefi_exchange_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  exchangeName: varchar("exchange_name").notNull().unique(),
  
  status: varchar("status").notNull().default("connected"), // connected, disconnected, error
  tradingVolume: decimal("trading_volume", { precision: 20, scale: 8 }).notNull().default("0"),
  activeAccounts: integer("active_accounts").notNull().default(0),
  feesCollected: decimal("fees_collected", { precision: 20, scale: 8 }).notNull().default("0"),
  healthScore: integer("health_score").default(100),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).default("100.00"),
  
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Blockchain Health Metrics - Monitor chain status
export const blockchainHealthMetrics = pgTable("blockchain_health_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainName: varchar("chain_name").notNull().unique(),
  
  status: varchar("status").notNull().default("operational"), // operational, slow, error
  latency: integer("latency").notNull().default(0), // in milliseconds
  nodeCount: integer("node_count").notNull().default(0),
  alertCount: integer("alert_count").notNull().default(0),
  healthScore: integer("health_score").default(100),
  
  blockHeight: integer("block_height").default(0),
  gasPrice: decimal("gas_price", { precision: 20, scale: 8 }).default("0"),
  
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Liquidity Pool Metrics - Track pool health and performance
export const liquidityPoolMetrics = pgTable("liquidity_pool_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolAddress: varchar("pool_address").notNull().unique(),
  poolName: varchar("pool_name").notNull(),
  
  chainName: varchar("chain_name").notNull(),
  exchangeName: varchar("exchange_name").notNull(),
  
  liquidity: decimal("liquidity", { precision: 20, scale: 8 }).notNull().default("0"),
  spread: decimal("spread", { precision: 8, scale: 4 }).notNull().default("0"),
  slippage: decimal("slippage", { precision: 8, scale: 4 }).notNull().default("0"),
  healthScore: integer("health_score").default(100),
  
  volume24h: decimal("volume_24h", { precision: 20, scale: 8 }).default("0"),
  apy: decimal("apy", { precision: 8, scale: 4 }).default("0"),
  
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Revenue Metrics - Track revenue by source
export const revenueMetrics = pgTable("revenue_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().defaultNow(),
  
  transactionFees: decimal("transaction_fees", { precision: 20, scale: 8 }).notNull().default("0"),
  subscriptionRevenue: decimal("subscription_revenue", { precision: 20, scale: 8 }).notNull().default("0"),
  vaultFees: decimal("vault_fees", { precision: 20, scale: 8 }).notNull().default("0"),
  serviceFees: decimal("service_fees", { precision: 20, scale: 8 }).notNull().default("0"),
  
  totalRevenue: decimal("total_revenue", { precision: 20, scale: 8 }).notNull().default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Provider Metrics - Track payment processor health
export const paymentProviderMetrics = pgTable("payment_provider_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerName: varchar("provider_name").notNull().unique(),
  
  status: varchar("status").notNull().default("active"),
  transactionCount: integer("transaction_count").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  averageSettlementTime: decimal("average_settlement_time", { precision: 8, scale: 2 }).notNull().default("0"),
  totalProcessed: decimal("total_processed", { precision: 20, scale: 8 }).notNull().default("0"),
  
  failureCount: integer("failure_count").notNull().default(0),
  averageResponseTime: integer("average_response_time").default(0), // in ms
  
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Performance Metrics - Track AI agent health
export const agentPerformanceMetrics = pgTable("agent_performance_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: varchar("agent_id").notNull().unique(),
  agentName: varchar("agent_name").notNull(),
  
  status: varchar("status").notNull().default("active"), // active, inactive, error
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksActive: integer("tasks_active").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
  
  cpuUsage: integer("cpu_usage").default(0),
  memoryUsage: integer("memory_usage").default(0), // in MB
  uptime: decimal("uptime", { precision: 5, scale: 2 }).default("100.00"), // percentage
  
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Usage Metrics - Track API endpoint performance
export const apiUsageMetrics = pgTable("api_usage_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().defaultNow(),
  
  totalRequests: integer("total_requests").notNull().default(0),
  requestsThisHour: integer("requests_this_hour").notNull().default(0),
  averageResponseTime: integer("average_response_time").notNull().default(0), // in ms
  errorRate: decimal("error_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  
  activeDevs: integer("active_devs").notNull().default(0),
  rateLimitExceeded: integer("rate_limit_exceeded").notNull().default(0),
  
  topEndpoint: varchar("top_endpoint"),
  topErrorEndpoint: varchar("top_error_endpoint"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Platform Growth Metrics - Track user and DAO growth
export const platformGrowthMetrics = pgTable("platform_growth_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().defaultNow(),
  
  totalUsers: integer("total_users").notNull().default(0),
  newUsersToday: integer("new_users_today").notNull().default(0),
  newUsersThisMonth: integer("new_users_this_month").notNull().default(0),
  userGrowthRate: decimal("user_growth_rate", { precision: 5, scale: 2 }).default("0"),
  
  totalVaults: integer("total_vaults").notNull().default(0),
  newVaultsToday: integer("new_vaults_today").notNull().default(0),
  newVaultsThisMonth: integer("new_vaults_this_month").notNull().default(0),
  vaultGrowthRate: decimal("vault_growth_rate", { precision: 5, scale: 2 }).default("0"),
  
  totalDAOs: integer("total_daos").notNull().default(0),
  newDAOsToday: integer("new_daos_today").notNull().default(0),
  newDAOsThisMonth: integer("new_daos_this_month").notNull().default(0),
  daoGrowthRate: decimal("dao_growth_rate", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * PHASE 3: COMMUNITY & ENGAGEMENT METRICS TABLES
 */

// Referral Metrics - Track referral performance
export const referralMetrics = pgTable("referral_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().defaultNow(),
  
  newReferralsToday: integer("new_referrals_today").notNull().default(0),
  totalReferrals: integer("total_referrals").notNull().default(0),
  activeReferrers: integer("active_referrers").notNull().default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  totalRewardsDistributed: decimal("total_rewards_distributed", { precision: 20, scale: 8 }).notNull().default("0"),
  
  topSource: varchar("top_source"),
  recentTrend: decimal("recent_trend", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leaderboard Rankings - Track member rankings
export const leaderboardRankings = pgTable("leaderboard_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  rankingType: varchar("ranking_type").notNull(), // overall, weekly, monthly, contributors, builders
  rank: integer("rank").notNull(),
  score: integer("score").notNull(),
  
  stars: integer("stars").default(0),
  contributions: integer("contributions").notNull().default(0),
  trend: varchar("trend").default("stable"), // up, down, stable
  
  recordDate: timestamp("record_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reward Distribution Tracking
export const rewardDistribution = pgTable("reward_distribution", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  totalEarned: decimal("total_earned", { precision: 20, scale: 8 }).notNull().default("0"),
  status: varchar("status").notNull().default("pending"), // pending, claimed, locked
  rewardTier: varchar("reward_tier").notNull(), // Bronze, Silver, Gold, Platinum
  
  lastClaimDate: timestamp("last_claim_date"),
  claimCount: integer("claim_count").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Achievement Tier Tracking
export const achievementTiers = pgTable("achievement_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: varchar("tier").notNull().unique(), // Bronze, Silver, Gold, Platinum
  
  minPoints: integer("min_points").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 20, scale: 8 }).notNull(),
  commission: integer("commission").notNull().default(0), // percentage
  
  memberCount: integer("member_count").notNull().default(0),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAO Analytics - Track DAO metrics by segment
export const daoAnalytics = pgTable("dao_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  daoId: uuid("dao_id").references(() => daos.id),
  
  // Segmentation
  daoType: varchar("dao_type"), // Investment, Governance, Social, Charity, etc
  region: varchar("region"), // North America, South America, Europe, Africa, Asia, Oceania
  cause: varchar("cause"), // Environmental, Education, Healthcare, Technology, Community
  
  // Metrics
  memberCount: integer("member_count").notNull().default(0),
  treasuryValue: decimal("treasury_value", { precision: 20, scale: 8 }).notNull().default("0"),
  proposalCount: integer("proposal_count").notNull().default(0),
  healthScore: integer("health_score").default(100),
  growthRate: decimal("growth_rate", { precision: 5, scale: 2 }).default("0"),
  
  recordDate: timestamp("record_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support Ticket Metrics
export const supportTicketMetrics = pgTable("support_ticket_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().defaultNow(),
  
  totalTickets: integer("total_tickets").notNull().default(0),
  openTickets: integer("open_tickets").notNull().default(0),
  inProgressTickets: integer("in_progress_tickets").notNull().default(0),
  resolvedTickets: integer("resolved_tickets").notNull().default(0),
  closedTickets: integer("closed_tickets").notNull().default(0),
  
  avgFirstResponseTime: decimal("avg_first_response_time", { precision: 10, scale: 2 }).default("0"), // hours
  avgResolutionTime: decimal("avg_resolution_time", { precision: 10, scale: 2 }).default("0"), // hours
  resolutionRate: decimal("resolution_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  
  satisfactionScore: decimal("satisfaction_score", { precision: 3, scale: 1 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Import users and daos for references
import { users, daos } from "./schema";

export type PlatformMetrics = typeof platformMetrics.$inferSelect;
export type DefiProtocolMetrics = typeof defiProtocolMetrics.$inferSelect;
export type CefiExchangeMetrics = typeof cefiExchangeMetrics.$inferSelect;
export type BlockchainHealthMetrics = typeof blockchainHealthMetrics.$inferSelect;
export type LiquidityPoolMetrics = typeof liquidityPoolMetrics.$inferSelect;
export type RevenueMetrics = typeof revenueMetrics.$inferSelect;
export type PaymentProviderMetrics = typeof paymentProviderMetrics.$inferSelect;
export type AgentPerformanceMetrics = typeof agentPerformanceMetrics.$inferSelect;
export type ApiUsageMetrics = typeof apiUsageMetrics.$inferSelect;
export type PlatformGrowthMetrics = typeof platformGrowthMetrics.$inferSelect;
export type ReferralMetrics = typeof referralMetrics.$inferSelect;
export type LeaderboardRankings = typeof leaderboardRankings.$inferSelect;
export type RewardDistribution = typeof rewardDistribution.$inferSelect;
export type AchievementTiers = typeof achievementTiers.$inferSelect;
export type DaoAnalytics = typeof daoAnalytics.$inferSelect;
export type SupportTicketMetrics = typeof supportTicketMetrics.$inferSelect;
