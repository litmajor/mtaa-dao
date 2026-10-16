import { Router } from 'express';
import type { Request, Response } from 'express';
import os from 'node:os';
import { db, pool } from '../../db';
import { logger } from '../../utils/logger';
import {
  daos,
  daoMemberships,
  vaults,
  vaultTransactions,
  users,
  tasks,
} from '../../../shared/schema';
import {
  defiProtocolMetrics,
  cefiExchangeMetrics,
  blockchainHealthMetrics,
  liquidityPoolMetrics,
  revenueMetrics,
  paymentProviderMetrics,
  agentPerformanceMetrics,
  apiUsageMetrics,
  supportTicketMetrics,
} from '../../../shared/monitoringMetricsSchema';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { referralPayouts } from '../../../shared/financialEnhancedSchema';
import { getPayoutWorkerStatus } from '../../workers/payout-worker';
import { requireRole } from '../../middleware/rbac';
import { cacheManager } from '../../core/consolidation/DataCacheConsolidation';
import { SystemMetricsCollector } from '../../utils/systemMetrics';

const router = Router();
const requireSuperAdmin = requireRole('super_admin');
const monitoringCache = cacheManager.registerCache({
  name: 'admin_monitoring',
  level: 'both',
  ttl: 5 * 60 * 1000,
  invalidationStrategy: 'ttl',
});

async function getOrComputeMetrics<T>(key: string, computeFn: () => Promise<T>): Promise<T> {
  try {
    return await monitoringCache.getOrSet(key, computeFn);
  } catch (error) {
    logger.warn(`Monitoring cache failed for ${key}; using live query`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return computeFn();
  }
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateGrowthRate(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function getSystemLoadAverage(): number {
  const cpuCount = Math.max(os.cpus().length, 1);
  const load = os.loadavg()[0];
  return Math.min(100, Math.max(0, Math.round((load / cpuCount) * 100)));
}

/**
 * PHASE 1 MONITORING ENDPOINTS
 * Dashboard Overview, DeFi, CeFi, Health, Liquidity, Revenue, Payments, Agents
 */

// GET /api/admin/monitoring/dashboard-overview
router.get('/monitoring/dashboard-overview', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Try to get from cache, otherwise aggregate fresh metrics
    const metrics = await getOrComputeMetrics(
      'dashboard-overview',
      async () => {
        const result = await db.execute(sql`
          WITH dao_stats AS (
            SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active
            FROM ${daos}
          ),
          member_stats AS (
            SELECT COUNT(DISTINCT user_id)::int AS total_members FROM ${daoMemberships}
          ),
          wallet_stats AS (
            SELECT COUNT(DISTINCT wallet_address)::int AS active_wallets
            FROM ${users} WHERE wallet_address IS NOT NULL
          ),
          vault_stats AS (
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE is_active = true)::int AS active,
                   COALESCE(SUM(balance::numeric), 0)::float AS tvl
            FROM ${vaults}
          ),
          tx_stats AS (
            SELECT COUNT(*)::int AS total,
                   COALESCE(SUM(amount::numeric), 0)::float AS total_fees
            FROM ${vaultTransactions}
          ),
          task_stats AS (
            SELECT COUNT(*)::int AS active_agents FROM ${tasks}
          )
          SELECT dao_stats.total AS "totalDaos", dao_stats.active AS "activeDaos",
                 member_stats.total_members AS "totalMembers", wallet_stats.active_wallets AS "activeWallets",
                 vault_stats.total AS "totalVaults", vault_stats.active AS "activeVaults",
                 vault_stats.tvl AS "totalTVL", tx_stats.total AS "totalTransactions",
                 tx_stats.total_fees AS "totalFees", task_stats.active_agents AS "activeAgents"
          FROM dao_stats, member_stats, wallet_stats, vault_stats, tx_stats, task_stats
        `);
        const overview = result.rows[0] as Record<string, string | number | null>;

        return {
          platformHealth: {
            daos: toNumber(overview.totalDaos),
            activeDaos: toNumber(overview.activeDaos),
            totalMembers: toNumber(overview.totalMembers),
            activeWallets: toNumber(overview.activeWallets),
          },
          vaults: {
            total: toNumber(overview.totalVaults),
            active: toNumber(overview.activeVaults),
            totalValue: toNumber(overview.totalTVL),
          },
          transactions: {
            total: toNumber(overview.totalTransactions),
            totalFees: toNumber(overview.totalFees),
          },
          agents: {
            active: toNumber(overview.activeAgents),
          },
        };
      }
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// GET /api/admin/monitoring/defi-protocols
router.get('/monitoring/defi-protocols', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const protocols = await getOrComputeMetrics(
      'defi-protocols',
      async () => {
        return db.select({
          name: defiProtocolMetrics.protocolName,
          status: defiProtocolMetrics.status,
          tvl: defiProtocolMetrics.tvl,
          apy: sql<number>`COALESCE(((${defiProtocolMetrics.metadata} ->> 'apy')::numeric), 0)`,
          pools: sql<number>`COALESCE(((${defiProtocolMetrics.metadata} ->> 'pool_count')::int), 0)`,
          health: sql<number>`CASE WHEN ${defiProtocolMetrics.status} = 'active' THEN 100 ELSE 0 END`,
        })
        .from(defiProtocolMetrics)
        .orderBy(desc(defiProtocolMetrics.tvl));
      }
    );

    const totalTVL = protocols?.reduce((sum, p) => sum + (parseFloat(String(p.tvl || 0))), 0) || 0;
    const avgAPY = protocols && protocols.length > 0 
      ? (protocols.reduce((sum, p) => sum + (parseFloat(String(p.apy || 0))), 0) / protocols.length).toFixed(2) 
      : '0';

    res.json({
      protocols: protocols || [],
      totalTVL,
      averageAPY: avgAPY,
      operationalProtocols: protocols?.filter(p => p.status === 'operational').length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('DeFi protocols error:', error);
    res.status(500).json({ error: 'Failed to fetch DeFi protocols' });
  }
});

// GET /api/admin/monitoring/workers
router.get('/monitoring/workers', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const [pending] = await db.select({ count: sql<number>`count(*)` }).from(referralPayouts).where(eq(referralPayouts.status, 'pending'));
    const [processing] = await db.select({ count: sql<number>`count(*)` }).from(referralPayouts).where(eq(referralPayouts.status, 'processing'));
    const [failed] = await db.select({ count: sql<number>`count(*)` }).from(referralPayouts).where(eq(referralPayouts.status, 'failed'));
    const [completed] = await db.select({ count: sql<number>`count(*)` }).from(referralPayouts).where(eq(referralPayouts.status, 'completed'));

    const workerStatus = getPayoutWorkerStatus ? getPayoutWorkerStatus() : { isRunning: false, lastRunAt: null };

    res.json({
      payouts: {
        pending: pending.count || 0,
        processing: processing.count || 0,
        failed: failed.count || 0,
        completed: completed.count || 0,
      },
      worker: workerStatus,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Workers monitoring error', error);
    res.status(500).json({ error: 'Failed to fetch worker status' });
  }
});

// GET /api/admin/monitoring/cefi-exchanges
router.get('/monitoring/cefi-exchanges', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const exchanges = await getOrComputeMetrics(
      'cefi-exchanges',
      async () => {
        return db.select({
          name: cefiExchangeMetrics.exchangeName,
          status: cefiExchangeMetrics.status,
          tradingVolume: cefiExchangeMetrics.volume24h,
          activeAccounts: cefiExchangeMetrics.users,
          fees: sql<number>`COALESCE(((${cefiExchangeMetrics.metadata} ->> 'fees_collected')::numeric), 0)`,
          health: sql<number>`COALESCE(((${cefiExchangeMetrics.metadata} ->> 'health_score')::numeric), CASE WHEN ${cefiExchangeMetrics.status} = 'active' THEN 100 ELSE 0 END)`,
        })
        .from(cefiExchangeMetrics)
        .orderBy(desc(cefiExchangeMetrics.volume24h));
      }
    );

    const totalVolume = exchanges?.reduce((sum, e) => sum + (parseFloat(String(e.tradingVolume || 0))), 0) || 0;
    const totalAccounts = exchanges?.reduce((sum, e) => sum + toNumber(e.activeAccounts), 0) || 0;
    const totalFees = exchanges?.reduce((sum, e) => sum + (parseFloat(String(e.fees || 0))), 0) || 0;

    res.json({
      exchanges: exchanges || [],
      totalTradingVolume: totalVolume,
      totalActiveAccounts: totalAccounts,
      totalFeesCollected: totalFees,
      connectedExchanges: exchanges?.length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('CeFi exchanges error:', error);
    res.status(500).json({ error: 'Failed to fetch CeFi exchanges' });
  }
});

// GET /api/admin/monitoring/health-status
router.get('/monitoring/health-status', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const chains = await getOrComputeMetrics(
      'blockchain-health',
      async () => {
        return db.select({
          name: blockchainHealthMetrics.chainName,
          status: blockchainHealthMetrics.status,
          latency: blockchainHealthMetrics.averageBlockTime,
          nodeCount: blockchainHealthMetrics.transactionCount,
          alerts: sql<number>`COALESCE(((${blockchainHealthMetrics.metadata} ->> 'alert_count')::int), 0)`,
          health: blockchainHealthMetrics.networkHealthScore,
        })
        .from(blockchainHealthMetrics)
        .orderBy(desc(blockchainHealthMetrics.transactionCount));
      }
    );

    const system = SystemMetricsCollector.getSystemMetrics();
    const systemMetrics = {
      ...system,
      networkLatency: SystemMetricsCollector.getNetworkLatency(),
      databaseConnections: null,
      activeRequests: null,
    };
    const healthScores = chains.map(chain => toNumber(chain.health)).filter(score => score > 0);
    const overallHealth = healthScores.length > 0
      ? Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length)
      : null;
    const criticalAlerts = chains.reduce((sum, chain) => sum + (chain.status === 'error' ? 1 : 0), 0);
    const warningAlerts = chains.reduce((sum, chain) => sum + toNumber(chain.alerts), 0);

    res.json({
      chains: chains || [],
      systemMetrics,
      overallHealth,
      alerts: {
        critical: criticalAlerts,
        warning: warningAlerts,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Health status error:', error);
    res.status(500).json({ error: 'Failed to fetch health status' });
  }
});

// GET /api/admin/monitoring/liquidity-pools
router.get('/monitoring/liquidity-pools', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const pools = await getOrComputeMetrics(
      'liquidity-pools',
      async () => {
        return db.select({
          id: liquidityPoolMetrics.poolAddress,
          name: liquidityPoolMetrics.poolAddress,
          exchange: sql<string>`COALESCE(${liquidityPoolMetrics.chainId}, 'unknown')`,
          liquidity: liquidityPoolMetrics.totalLiquidity,
          spread: sql<number>`COALESCE(((${liquidityPoolMetrics.metadata} ->> 'spread')::numeric), 0)`,
          health: sql<number>`COALESCE(((${liquidityPoolMetrics.metadata} ->> 'health_score')::numeric), 100)`,
          volume24h: liquidityPoolMetrics.volume24h,
        })
        .from(liquidityPoolMetrics)
        .orderBy(desc(liquidityPoolMetrics.totalLiquidity));
      }
    );

    const totalLiquidity = pools?.reduce((sum, p) => sum + (parseFloat(String(p.liquidity || 0))), 0) || 0;
    const avgSpread = pools && pools.length > 0
      ? (pools.reduce((sum, p) => sum + (parseFloat(String(p.spread || 0))), 0) / pools.length).toFixed(4)
      : '0';

    res.json({
      pools: pools || [],
      totalLiquidity,
      averageSpread: avgSpread,
      healthyPools: pools?.filter(p => (p.health || 0) >= 90).length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Liquidity pools error:', error);
    res.status(500).json({ error: 'Failed to fetch liquidity pools' });
  }
});

// GET /api/admin/monitoring/revenue
router.get('/monitoring/revenue', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await getOrComputeMetrics(
      'revenue',
      async () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [revenue] = await db
          .select({
            transactionFees: sql<string>`COALESCE(SUM(${revenueMetrics.transactionFees}), 0)`,
            platformFees: sql<string>`COALESCE(SUM(${revenueMetrics.platformFees}), 0)`,
            otherRevenue: sql<string>`COALESCE(SUM(${revenueMetrics.otherRevenue}), 0)`,
          })
          .from(revenueMetrics)
          .where(gte(revenueMetrics.date, thirtyDaysAgo.toISOString().slice(0, 10)));

        const revenueBreakdown = {
          transactionFees: toNumber(revenue.transactionFees),
          platformFees: toNumber(revenue.platformFees),
          otherRevenue: toNumber(revenue.otherRevenue),
        };

        const totalRevenue = Object.values(revenueBreakdown).reduce((a, b) => a + b, 0);

        return {
          totalRevenue,
          breakdown: revenueBreakdown,
          monthlyAverage: (totalRevenue / 30).toFixed(2),
          growth: null,
        };
      }
    );

    res.json({
      ...metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// GET /api/admin/monitoring/payments
router.get('/monitoring/payments', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const paymentProviders = await getOrComputeMetrics(
      'payment-providers',
      async () => {
        return db.select({
          name: paymentProviderMetrics.providerName,
          status: paymentProviderMetrics.status,
          transactionCount: paymentProviderMetrics.totalTransactions,
          successRate: paymentProviderMetrics.successRate,
          totalProcessed: paymentProviderMetrics.totalVolume,
        })
        .from(paymentProviderMetrics)
        .orderBy(desc(paymentProviderMetrics.totalVolume));
      }
    );

    const totalTransactions = paymentProviders?.reduce((sum, p) => sum + toNumber(p.transactionCount), 0) || 0;
    const totalProcessed = paymentProviders?.reduce((sum, p) => sum + (parseFloat(String(p.totalProcessed || 0))), 0) || 0;
    const avgSuccessRate = paymentProviders && paymentProviders.length > 0
      ? (paymentProviders.reduce((sum, p) => sum + (parseFloat(String(p.successRate || 0))), 0) / paymentProviders.length).toFixed(2)
      : '0';

    res.json({
      providers: paymentProviders || [],
      totalTransactions,
      totalProcessed,
      averageSuccessRate: avgSuccessRate,
      activeProviders: paymentProviders?.filter(p => p.status === 'active').length || 0,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payment data' });
  }
});

// GET /api/admin/monitoring/agents
router.get('/monitoring/agents', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const agents = await getOrComputeMetrics(
      'agent-performance',
      async () => {
        return db.select({
          id: agentPerformanceMetrics.agentId,
          name: agentPerformanceMetrics.agentId,
          status: sql<string>`'active'`,
          tasksCompleted: agentPerformanceMetrics.tasksCompleted,
          tasksActive: sql<number>`0`,
          successRate: agentPerformanceMetrics.successRate,
        })
        .from(agentPerformanceMetrics)
        .orderBy(desc(agentPerformanceMetrics.tasksCompleted));
      }
    );

    res.json({
      agents: agents || [],
      totalAgents: agents?.length || 0,
      activeAgents: agents?.filter(a => a.status === 'active').length || 0,
      systemLoad: getSystemLoadAverage(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agent data' });
  }
});

/**
 * PHASE 2 MONITORING ENDPOINTS
 * Platform Growth, API Usage, Tokenomics, Support Tickets
 */

// GET /api/admin/monitoring/platform-growth
router.get('/monitoring/platform-growth', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const growthData = await getOrComputeMetrics(
      'platform-growth',
      async () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const result = await db.execute(sql`
          SELECT
            (SELECT COUNT(*)::int FROM ${users}) AS "totalUsers",
            (SELECT COUNT(*)::int FROM ${users} WHERE created_at >= ${thirtyDaysAgo}) AS "newUsers",
            (SELECT COUNT(*)::int FROM ${vaults}) AS "totalVaults",
            (SELECT COUNT(*)::int FROM ${vaults} WHERE created_at >= ${thirtyDaysAgo}) AS "newVaults",
            (SELECT COUNT(*)::int FROM ${daos}) AS "totalDaos",
            (SELECT COUNT(*)::int FROM ${daos} WHERE created_at >= ${thirtyDaysAgo}) AS "newDaos",
            (SELECT COALESCE(SUM(balance::numeric), 0)::float FROM ${vaults}) AS "totalTVL"
        `);
        const growth = result.rows[0] as Record<string, string | number | null>;
        const totalUsers = toNumber(growth.totalUsers);
        const newUsers = toNumber(growth.newUsers);
        const totalVaults = toNumber(growth.totalVaults);
        const newVaults = toNumber(growth.newVaults);
        const totalDaos = toNumber(growth.totalDaos);
        const newDaos = toNumber(growth.newDaos);

        return {
          users: {
            total: totalUsers,
            newThisMonth: newUsers,
            growth: calculateGrowthRate(newUsers, totalUsers),
          },
          vaults: {
            total: totalVaults,
            newThisMonth: newVaults,
            growth: calculateGrowthRate(newVaults, totalVaults),
          },
          daos: {
            total: totalDaos,
            newThisMonth: newDaos,
            growth: calculateGrowthRate(newDaos, totalDaos),
          },
          platformMetrics: {
            totalTVL: toNumber(growth.totalTVL),
            monthlyActiveUsers: newUsers,
          },
        };
      }
    );

    res.json({
      ...growthData,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Platform growth error:', error);
    res.status(500).json({ error: 'Failed to fetch platform growth data' });
  }
});

// GET /api/admin/monitoring/api-usage
router.get('/monitoring/api-usage', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const apiMetrics = await getOrComputeMetrics(
      'api-usage',
      async () => {
        const endpointData = await db.select({
          name: sql<string>`${apiUsageMetrics.topEndpoints}::text`,
          calls: apiUsageMetrics.totalRequests,
          avgLatency: apiUsageMetrics.averageResponseTime,
          errorRate: sql<string>`CASE WHEN ${apiUsageMetrics.totalRequests} = 0 THEN 0 ELSE (${apiUsageMetrics.failedRequests}::numeric / ${apiUsageMetrics.totalRequests}) * 100 END`,
        })
        .from(apiUsageMetrics)
        .orderBy(desc(apiUsageMetrics.totalRequests))
        .limit(10);

        const totalRequests = await db.select({
          count: sql<number>`SUM(CAST(${apiUsageMetrics.totalRequests} AS NUMERIC))`,
        }).from(apiUsageMetrics);

        return {
          totalRequests: toNumber(totalRequests[0].count),
          endpoints: endpointData || [],
          developers: 2340,
          errorRate: 0.23,
        };
      }
    );

    res.json({
      ...apiMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('API usage error:', error);
    res.status(500).json({ error: 'Failed to fetch API usage' });
  }
});

// GET /api/admin/monitoring/tokenomics
router.get('/monitoring/tokenomics', requireSuperAdmin, async (req: Request, res: Response) => {
  const chainId = Number(process.env.MTAA_CHAIN_ID || 0);
  const tokenAddress = process.env.MTAA_TOKEN_ADDRESS?.toLowerCase();
  if (!chainId || !tokenAddress) {
    return res.status(503).json({ error: 'MTAA token deployment is not configured', available: false, timestamp: new Date() });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM tokenomics_snapshots
       WHERE chain_id = $1 AND token_address = $2
       ORDER BY created_at DESC LIMIT 1`,
      [chainId, tokenAddress]
    );
    const snapshot = result.rows[0];
    if (!snapshot) {
      return res.status(503).json({ error: 'MTAA tokenomics indexer has not produced a snapshot', available: false, timestamp: new Date() });
    }
    res.json({
      available: true,
      deployment: { chainId, tokenAddress },
      snapshot: {
        blockNumber: Number(snapshot.block_number),
        totalSupply: String(snapshot.total_supply),
        totalBurned: String(snapshot.total_burned),
        totalStaked: String(snapshot.total_staked),
        lockedSupply: String(snapshot.locked_supply),
        circulatingSupply: String(snapshot.circulating_supply),
        holderCount: Number(snapshot.holder_count),
        transferCount: Number(snapshot.transfer_count),
        transferVolume: String(snapshot.transfer_volume),
        rewardsEmitted: String(snapshot.rewards_emitted),
        rewardsClaimed: String(snapshot.rewards_claimed),
        vestedReleased: String(snapshot.vested_released),
        price: snapshot.price,
        priceSource: snapshot.price_source,
        asOf: snapshot.created_at,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Tokenomics metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch tokenomics data' });
  }
});

// GET /api/admin/monitoring/support-tickets
router.get('/monitoring/support-tickets', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await getOrComputeMetrics('support-tickets', async () => {
      const [latest] = await db.select({
        total: supportTicketMetrics.totalTickets,
        open: supportTicketMetrics.openTickets,
        inProgress: sql<number>`0`,
        resolved: supportTicketMetrics.resolvedTickets,
        closed: sql<number>`0`,
        avgFirstResponseTime: sql<number>`0`,
        avgResolutionTime: supportTicketMetrics.averageResolutionTime,
        resolutionRate: sql<string>`CASE WHEN ${supportTicketMetrics.totalTickets} = 0 THEN 0 ELSE (${supportTicketMetrics.resolvedTickets}::numeric / ${supportTicketMetrics.totalTickets}) * 100 END`,
        satisfactionScore: supportTicketMetrics.customerSatisfaction,
        date: supportTicketMetrics.date,
      }).from(supportTicketMetrics).orderBy(desc(supportTicketMetrics.date)).limit(1);
      return latest || null;
    });

    if (!metrics) {
      return res.status(503).json({ error: 'Support metrics are not available', available: false, timestamp: new Date() });
    }
    res.json({
      available: true,
      summary: {
        total: toNumber(metrics.total), open: toNumber(metrics.open), inProgress: toNumber(metrics.inProgress),
        resolved: toNumber(metrics.resolved), closed: toNumber(metrics.closed),
      },
      metrics: {
        avgFirstResponseTime: toNumber(metrics.avgFirstResponseTime),
        avgResolutionTime: toNumber(metrics.avgResolutionTime),
        resolutionRate: toNumber(metrics.resolutionRate),
        satisfactionScore: toNumber(metrics.satisfactionScore),
      },
      asOf: metrics.date,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Support ticket metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch support ticket metrics' });
  }
});

export default router;
