/**
 * Compatibility layer for monitoring metric tables.
 *
 * The canonical schema lives in shared/schema.ts. This file intentionally re-exports
 * the authoritative table definitions so we do not create duplicate table declarations
 * across modules. When a new monitoring table is required, it should be added once in
 * the source schema and then referenced here.
 */

import {
  platformMetrics,
  defiProtocolMetrics,
  cefiExchangeMetrics,
  blockchainHealthMetrics,
  liquidityPoolMetrics,
  revenueMetrics,
  paymentProviderMetrics,
  agentPerformanceMetrics,
  apiUsageMetrics,
  platformGrowthMetrics,
  referralMetrics,
  leaderboardRankings,
  rewardDistribution,
  daoAnalytics,
  supportTicketMetrics,
} from './schema';

export {
  platformMetrics,
  defiProtocolMetrics,
  cefiExchangeMetrics,
  blockchainHealthMetrics,
  liquidityPoolMetrics,
  revenueMetrics,
  paymentProviderMetrics,
  agentPerformanceMetrics,
  apiUsageMetrics,
  platformGrowthMetrics,
  referralMetrics,
  leaderboardRankings,
  rewardDistribution,
  daoAnalytics,
  supportTicketMetrics,
};

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
export type DaoAnalytics = typeof daoAnalytics.$inferSelect;
export type SupportTicketMetrics = typeof supportTicketMetrics.$inferSelect;
