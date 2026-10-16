
import { db } from '../storage';
import { walletTransactions, contributions, daos, vaultTokenHoldings, vaults, users } from '../../shared/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import BigNumber from 'bignumber.js';

export interface TreasuryHealthThresholds {
  balance: { critical: number; attention: number; low: number; healthy: number };
  netFlow: { positive: number; stable: number; declining: number };
  transactionCount: { high: number; medium: number; low: number };
}

export interface TreasuryHealthOptions {
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  activityWindowDays?: number;
}

const DEFAULT_TREASURY_THRESHOLDS: TreasuryHealthThresholds = {
  // Thresholds are in the selected token's units; configure per deployment/currency as needed.
  balance: { critical: 100, attention: 1_000, low: 5_000, healthy: 10_000 },
  netFlow: { positive: 0, stable: -500, declining: -1_000 },
  transactionCount: { high: 50, medium: 20, low: 5 }
};

type TreasuryRecommendation = { severity: 'critical' | 'warning' | 'info'; code: string; message: string };

export class FinancialAnalyticsService {
  private readonly platformMetricsCache = new Map<string, { expiresAt: number; value: any }>();

  constructor(
    private readonly treasuryThresholds?: TreasuryHealthThresholds,
    private readonly thresholdsByCurrency: Record<string, TreasuryHealthThresholds> = {}
  ) {
    if (treasuryThresholds) return;
    for (const currency of ['USD', 'USDC', 'USDT', 'cUSD']) {
      this.thresholdsByCurrency[currency] ??= DEFAULT_TREASURY_THRESHOLDS;
    }
  }
  
  // Get DAO financial overview
  async getDaoFinancialOverview(daoId: string, startDate?: Date, endDate?: Date) {
    try {
      const dateFilter = [];
      dateFilter.push(eq(contributions.status, 'completed'));
      if (startDate) dateFilter.push(gte(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte(contributions.createdAt, endDate));

      // Total contributions by DAO
      const totalContributions = await db
        .select({
          totalAmount: sql<string>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)::text`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ));

      // Contributions can be denominated in different currencies; keep all monetary
      // aggregates partitioned by currency instead of adding unlike units.
      const topContributors = await db
        .select({
          userId: contributions.userId,
          username: users.username,
          currency: contributions.currency,
          totalContributed: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalContributed'),
          contributionCount: sql<number>`COUNT(*)`.as('contributionCount')
        })
        .from(contributions)
        .innerJoin(users, eq(contributions.userId, users.id))
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(contributions.userId, users.username, contributions.currency)
        .orderBy(desc(sql`SUM(CAST(${contributions.amount} AS DECIMAL))`))
        .limit(10);

      // Monthly contribution trends
      const monthlyTrends = await db
        .select({
          month: sql<string>`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`.as('month'),
          currency: contributions.currency,
          totalAmount: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(sql`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`, contributions.currency)
        .orderBy(sql`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`, contributions.currency);

      // This is a currency breakdown, not a payment-method breakdown.
      const currencyStats = await db
        .select({
          currency: contributions.currency,
          totalAmount: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count'),
          avgAmount: sql<string>`AVG(CAST(${contributions.amount} AS DECIMAL))::text`.as('avgAmount')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(contributions.currency);

      const transactionStats = await db
        .select({
          currency: walletTransactions.currency,
          inflow: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'deposit' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)::text`.as('inflow'),
          outflow: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'withdrawal' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)::text`.as('outflow'),
          transactionCount: sql<number>`COUNT(*)::int`.as('transactionCount')
        })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.status, 'completed'),
          ...(startDate ? [gte(walletTransactions.createdAt, startDate)] : []),
          ...(endDate ? [lte(walletTransactions.createdAt, endDate)] : [])
        ))
        .groupBy(walletTransactions.currency);

      return {
        overview: {
          // A single scalar would incorrectly combine unlike currencies.
          totalContributions: currencyStats.length <= 1 ? totalContributions[0]?.totalAmount || '0' : null,
          totalTransactions: totalContributions[0]?.count || 0,
          averageContribution: currencyStats.length <= 1 ? currencyStats[0]?.avgAmount ?? '0' : null
        },
        topContributors,
        monthlyTrends,
        currencyStats,
        /** @deprecated Use currencyStats; this field was never grouped by payment method. */
        paymentMethodStats: currencyStats,
        transactionStats,
        dataScope: 'contributions and wallet transactions; date filters apply to each record creation time',
        rankingNote: 'Contribution rankings include currency per row; amounts are only comparable within the same currency.',
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating DAO financial overview:', error);
      throw new Error('Failed to generate financial analytics');
    }
  }

  // Get platform-wide financial metrics
  async getPlatformFinancialMetrics(
    startDate?: Date,
    endDate?: Date,
    options: { page?: number; pageSize?: number; cacheTtlMs?: number } = {}
  ) {
    try {
      const page = Math.max(1, Math.floor(options.page ?? 1));
      const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));
      const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 30_000);
      const cacheKey = `${startDate?.toISOString() ?? ''}:${endDate?.toISOString() ?? ''}:${page}:${pageSize}`;
      const cached = this.platformMetricsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const dateFilter = [];
      dateFilter.push(eq(contributions.status, 'completed'));
      if (startDate) dateFilter.push(gte(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte(contributions.createdAt, endDate));

      // Platform revenue (2% fees)
      const platformRevenue = await db
        .select({
          currency: contributions.currency,
          totalRevenue: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL) * 0.02)::text`.as('totalRevenue'),
          totalVolume: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalVolume'),
          averageTransactionSize: sql<string>`(SUM(CAST(${contributions.amount} AS DECIMAL)) / NULLIF(COUNT(*), 0))::text`.as('averageTransactionSize'),
          transactionCount: sql<number>`COUNT(*)::int`.as('transactionCount')
        })
        .from(contributions)
        .where(and(...dateFilter))
        .groupBy(contributions.currency);

      // DAO performance rankings
      const daoRankings = await db
        .select({
          daoId: contributions.daoId,
          daoName: daos.name,
          currency: contributions.currency,
          totalContributions: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalContributions'),
          contributorCount: sql<number>`COUNT(DISTINCT ${contributions.userId})`.as('contributorCount'),
          transactionCount: sql<number>`COUNT(*)`.as('transactionCount')
        })
        .from(contributions)
        .innerJoin(daos, eq(contributions.daoId, daos.id))
        .where(and(...dateFilter))
        .groupBy(contributions.daoId, daos.name, contributions.currency)
        .orderBy(desc(sql`SUM(CAST(${contributions.amount} AS DECIMAL))`))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      // Currency distribution
      const currencyDistribution = await db
        .select({
          currency: contributions.currency,
          totalAmount: sql<string>`SUM(CAST(${contributions.amount} AS DECIMAL))::text`.as('totalAmount'),
          // Transaction share is comparable across currencies; raw monetary shares are not.
          percentage: sql<number>`ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2)`.as('percentage')
        })
        .from(contributions)
        .where(and(...dateFilter))
        .groupBy(contributions.currency);

      const singleCurrency = platformRevenue.length <= 1;
      const result = {
        platformMetrics: {
          totalRevenue: singleCurrency ? platformRevenue[0]?.totalRevenue || '0' : null,
          totalVolume: singleCurrency ? platformRevenue[0]?.totalVolume || '0' : null,
          transactionCount: platformRevenue.reduce((sum, row) => sum + (row.transactionCount || 0), 0),
          averageTransactionSize: singleCurrency ? platformRevenue[0]?.averageTransactionSize ?? '0' : null,
          byCurrency: platformRevenue
        },
        daoRankings,
        currencyDistribution,
        pagination: { page, pageSize },
        generatedAt: new Date().toISOString()
      };

      if (cacheTtlMs > 0) {
        if (this.platformMetricsCache.size >= 100) {
          const oldestKey = this.platformMetricsCache.keys().next().value;
          if (oldestKey) this.platformMetricsCache.delete(oldestKey);
        }
        this.platformMetricsCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value: result });
      }
      return result;

    } catch (error) {
      console.error('Error generating platform financial metrics:', error);
      throw new Error('Failed to generate platform analytics');
    }
  }

  // Get treasury health metrics
  async getTreasuryHealthMetrics(daoId: string, options: TreasuryHealthOptions | string = {}) {
    try {
      const normalizedOptions = typeof options === 'string' ? { currency: options } : options;
      const requestedWindowDays = normalizedOptions.activityWindowDays ?? 30;
      const activityWindowDays = Number.isFinite(requestedWindowDays) ? Math.max(1, Math.floor(requestedWindowDays)) : 30;
      const startDate = normalizedOptions.startDate ?? new Date(Date.now() - activityWindowDays * 24 * 60 * 60 * 1000);
      const endDate = normalizedOptions.endDate ?? new Date();
      if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) {
        throw new Error('Treasury activity dates must be valid and startDate must not be after endDate');
      }
      const currency = normalizedOptions.currency?.trim() || undefined;
      const dateFilter = [gte(walletTransactions.createdAt, startDate), lte(walletTransactions.createdAt, endDate)];

      // Holdings are the source of truth; vault.balance is explicitly deprecated.
      const holdingsQuery = db
        .select({
          currency: vaultTokenHoldings.tokenSymbol,
          balance: sql<string>`COALESCE(SUM(CAST(${vaultTokenHoldings.balance} AS DECIMAL)), 0)::text`.as('balance'),
          valueUsd: sql<string>`COALESCE(SUM(CAST(${vaultTokenHoldings.valueUSD} AS DECIMAL)), 0)::text`.as('valueUsd'),
          vaultCount: sql<number>`COUNT(DISTINCT ${vaultTokenHoldings.vaultId})`.as('vaultCount')
        })
        .from(vaultTokenHoldings)
        .innerJoin(vaults, eq(vaultTokenHoldings.vaultId, vaults.id))
        .where(eq(vaults.daoId, daoId))
        .groupBy(vaultTokenHoldings.tokenSymbol);
      const holdings = await holdingsQuery;

      const recentActivity = await db
        .select({
          currency: walletTransactions.currency,
          totalInflow: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'deposit' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)::text`.as('totalInflow'),
          totalOutflow: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'withdrawal' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)::text`.as('totalOutflow'),
          netFlow: sql<string>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'deposit' THEN CAST(${walletTransactions.amount} AS DECIMAL) WHEN ${walletTransactions.type} = 'withdrawal' THEN -CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)::text`.as('netFlow'),
          transactionCount: sql<number>`COUNT(*)::int`.as('transactionCount')
        })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.daoId, daoId),
          eq(walletTransactions.status, 'completed'),
          ...dateFilter,
          ...(currency ? [eq(walletTransactions.currency, currency)] : [])
        ))
        .groupBy(walletTransactions.currency);

      const selectedHoldings = currency
        ? holdings.filter(row => row.currency === currency)
        : holdings;
      const selectedActivity = currency
        ? recentActivity.filter(row => row.currency === currency)
        : recentActivity;
      const currencies = new Set([...selectedHoldings, ...selectedActivity].map(row => row.currency).filter((value): value is string => Boolean(value)));
      if (currency) currencies.add(currency);
      const currencyMetrics = Array.from(currencies, currency => {
        const holding = selectedHoldings.find(row => row.currency === currency);
        const activity = selectedActivity.find(row => row.currency === currency);
        const balance = holding?.balance ?? '0';
        const inflow = activity?.totalInflow ?? '0';
        const outflow = activity?.totalOutflow ?? '0';
        const netFlow = activity?.netFlow ?? '0';
        const transactionCount = Number(activity?.transactionCount ?? 0);
        const thresholds = this.thresholdsByCurrency[currency] ?? this.treasuryThresholds;
        const healthScore = thresholds
          ? this.calculateTreasuryHealthScore(balance, netFlow, transactionCount, thresholds)
          : null;
        const recommendationDetails = thresholds
          ? this.generateTreasuryRecommendations(healthScore!, netFlow, balance, thresholds)
          : [{ severity: 'info' as const, code: 'thresholds_unconfigured', message: `Configure health thresholds for ${currency} before interpreting its health score.` }];
        return {
          currency,
          treasuryBalance: holding?.balance ?? '0',
          valueUsd: holding?.valueUsd ?? '0',
          vaultCount: Number(holding?.vaultCount ?? 0),
          recentActivity: { inflow, outflow, netFlow, transactionCount },
          healthScore,
          recommendations: recommendationDetails.map(recommendation => recommendation.message),
          recommendationDetails
        };
      });

      // Legacy scalar fields are populated only when their denomination is unambiguous.
      const summary = currencyMetrics.length === 1 ? currencyMetrics[0] : undefined;
      const recommendationDetails: TreasuryRecommendation[] = summary?.recommendationDetails ?? (currencyMetrics.length > 1
        ? [{ severity: 'info', code: 'select_currency', message: 'Treasury assets use multiple currencies. Select a currency to view a comparable health score.' }]
        : []);
      return {
        currency: summary?.currency ?? currency ?? null,
        treasuryBalance: summary?.treasuryBalance ?? null,
        vaultCount: summary?.vaultCount ?? (currencyMetrics.length === 0 ? 0 : currencyMetrics.length === 1 ? currencyMetrics[0].vaultCount : null),
        recentActivity: summary?.recentActivity ?? null,
        healthScore: summary?.healthScore ?? null,
        recommendations: recommendationDetails.map(recommendation => recommendation.message),
        recommendationDetails,
        currencyMetrics,
        activityWindow: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), days: activityWindowDays }
      };

    } catch (error) {
      console.error('Error calculating treasury health:', error);
      throw new Error('Failed to calculate treasury health metrics');
    }
  }

  private calculateTreasuryHealthScore(
    balance: BigNumber.Value,
    netFlow: BigNumber.Value,
    transactionCount: number,
    thresholds: TreasuryHealthThresholds = this.treasuryThresholds ?? DEFAULT_TREASURY_THRESHOLDS
  ): number {
    let score = 50; // Base score
    const { balance: balanceThresholds, netFlow: flowThresholds, transactionCount: activityThresholds } = thresholds;
    const balanceValue = new BigNumber(balance);
    const netFlowValue = new BigNumber(netFlow);

    // Balance component (0-40 points)
    if (balanceValue.gt(balanceThresholds.healthy)) score += 40;
    else if (balanceValue.gt(balanceThresholds.low)) score += 30;
    else if (balanceValue.gt(balanceThresholds.attention)) score += 20;
    else if (balanceValue.gt(balanceThresholds.critical)) score += 10;

    // Net flow component (0-30 points)
    if (netFlowValue.gt(flowThresholds.positive)) score += 30;
    else if (netFlowValue.gt(flowThresholds.stable)) score += 20;
    else if (netFlowValue.gt(flowThresholds.declining)) score += 10;

    // Activity component (0-30 points)
    if (transactionCount > activityThresholds.high) score += 30;
    else if (transactionCount > activityThresholds.medium) score += 20;
    else if (transactionCount > activityThresholds.low) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private generateTreasuryRecommendations(
    healthScore: number,
    netFlow: BigNumber.Value,
    balance: BigNumber.Value,
    thresholds: TreasuryHealthThresholds = this.treasuryThresholds ?? DEFAULT_TREASURY_THRESHOLDS
  ): TreasuryRecommendation[] {
    const recommendations: TreasuryRecommendation[] = [];
    const netFlowValue = new BigNumber(netFlow);
    const balanceValue = new BigNumber(balance);

    if (healthScore < 30) {
      recommendations.push({ severity: 'critical', code: 'treasury_critical', message: 'Treasury health is critical - consider emergency fundraising' });
    } else if (healthScore < 50) {
      recommendations.push({ severity: 'warning', code: 'treasury_attention', message: 'Treasury needs attention - implement cost reduction measures' });
    }

    if (netFlowValue.isNegative()) {
      recommendations.push({ severity: 'warning', code: 'negative_net_flow', message: 'Negative cash flow detected - review spending and increase contributions' });
    }

    if (balanceValue.lt(thresholds.balance.critical)) {
      recommendations.push({ severity: 'critical', code: 'low_treasury_balance', message: 'Low treasury balance - urgent funding required' });
    }

    if (recommendations.length === 0) {
      recommendations.push({ severity: 'info', code: 'treasury_healthy', message: 'Treasury is healthy - consider diversification opportunities' });
    }

    return recommendations;
  }
}

export const financialAnalyticsService = new FinancialAnalyticsService();
