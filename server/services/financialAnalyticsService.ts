
import { db } from '../storage';
import { walletTransactions, contributions, daos, vaults, users } from '../../shared/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';

export class FinancialAnalyticsService {
  
  // Get DAO financial overview
  async getDaoFinancialOverview(daoId: string, startDate?: Date, endDate?: Date) {
    try {
      const dateFilter = [];
      if (startDate) dateFilter.push(gte(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte(contributions.createdAt, endDate));

      // Total contributions by DAO
      const totalContributions = await db
        .select({
          totalAmount: sql<number>`COALESCE(SUM(CAST(${contributions.amount} AS DECIMAL)), 0)`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ));

      // Top contributors
      const topContributors = await db
        .select({
          userId: contributions.userId,
          username: users.username,
          totalContributed: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalContributed'),
          contributionCount: sql<number>`COUNT(*)`.as('contributionCount')
        })
        .from(contributions)
        .innerJoin(users, eq(contributions.userId, users.id))
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(contributions.userId, users.username)
        .orderBy(desc(sql`SUM(CAST(${contributions.amount} AS DECIMAL))`))
        .limit(10);

      // Monthly contribution trends
      const monthlyTrends = await db
        .select({
          month: sql<string>`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`.as('month'),
          totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(sql`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${contributions.createdAt}, 'YYYY-MM')`);

      // Transaction volume by payment method
      const paymentMethodStats = await db
        .select({
          currency: contributions.currency,
          totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalAmount'),
          count: sql<number>`COUNT(*)`.as('count'),
          avgAmount: sql<number>`AVG(CAST(${contributions.amount} AS DECIMAL))`.as('avgAmount')
        })
        .from(contributions)
        .where(and(
          eq(contributions.daoId, daoId),
          ...dateFilter
        ))
        .groupBy(contributions.currency);

      return {
        overview: {
          totalContributions: totalContributions[0]?.totalAmount || 0,
          totalTransactions: totalContributions[0]?.count || 0,
          averageContribution: totalContributions[0]?.count > 0 
            ? totalContributions[0].totalAmount / totalContributions[0].count 
            : 0
        },
        topContributors,
        monthlyTrends,
        paymentMethodStats,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating DAO financial overview:', error);
      throw new Error('Failed to generate financial analytics');
    }
  }

  // Get platform-wide financial metrics
  async getPlatformFinancialMetrics(startDate?: Date, endDate?: Date) {
    try {
      const dateFilter = [];
      if (startDate) dateFilter.push(gte(contributions.createdAt, startDate));
      if (endDate) dateFilter.push(lte(contributions.createdAt, endDate));

      // Platform revenue (2% fees)
      const platformRevenue = await db
        .select({
          totalRevenue: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL) * 0.02)`.as('totalRevenue'),
          totalVolume: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalVolume'),
          transactionCount: sql<number>`COUNT(*)`.as('transactionCount')
        })
        .from(contributions)
        .where(and(...dateFilter));

      // DAO performance rankings
      const daoRankings = await db
        .select({
          daoId: contributions.daoId,
          daoName: daos.name,
          totalContributions: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalContributions'),
          contributorCount: sql<number>`COUNT(DISTINCT ${contributions.userId})`.as('contributorCount'),
          transactionCount: sql<number>`COUNT(*)`.as('transactionCount')
        })
        .from(contributions)
        .innerJoin(daos, eq(contributions.daoId, daos.id))
        .where(and(...dateFilter))
        .groupBy(contributions.daoId, daos.name)
        .orderBy(desc(sql`SUM(CAST(${contributions.amount} AS DECIMAL))`))
        .limit(20);

      // Currency distribution
      const currencyDistribution = await db
        .select({
          currency: contributions.currency,
          totalAmount: sql<number>`SUM(CAST(${contributions.amount} AS DECIMAL))`.as('totalAmount'),
          percentage: sql<number>`ROUND(SUM(CAST(${contributions.amount} AS DECIMAL)) * 100.0 / SUM(SUM(CAST(${contributions.amount} AS DECIMAL))) OVER(), 2)`.as('percentage')
        })
        .from(contributions)
        .where(and(...dateFilter))
        .groupBy(contributions.currency);

      return {
        platformMetrics: {
          totalRevenue: platformRevenue[0]?.totalRevenue || 0,
          totalVolume: platformRevenue[0]?.totalVolume || 0,
          transactionCount: platformRevenue[0]?.transactionCount || 0,
          averageTransactionSize: platformRevenue[0]?.transactionCount > 0 
            ? platformRevenue[0].totalVolume / platformRevenue[0].transactionCount 
            : 0
        },
        daoRankings,
        currencyDistribution,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating platform financial metrics:', error);
      throw new Error('Failed to generate platform analytics');
    }
  }

  // Get treasury health metrics
  async getTreasuryHealthMetrics(daoId: string) {
    try {
      // Get all vaults for the DAO
      const daoVaults = await db
        .select()
        .from(vaults)
        .where(eq(vaults.daoId, daoId));

      // Calculate total treasury balance
      const totalBalance = daoVaults.reduce((sum, vault) => {
        return sum + parseFloat(vault.balance);
      }, 0);

      // Get recent transaction volume (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentActivity = await db
        .select({
          totalInflow: sql<number>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'deposit' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`.as('totalInflow'),
          totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'withdrawal' THEN CAST(${walletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`.as('totalOutflow'),
          transactionCount: sql<number>`COUNT(*)`.as('transactionCount')
        })
        .from(walletTransactions)
        .where(and(
          eq(walletTransactions.daoId, daoId),
          gte(walletTransactions.createdAt, thirtyDaysAgo)
        ));

      const activity = recentActivity[0];
      const netFlow = activity.totalInflow - activity.totalOutflow;
      const healthScore = this.calculateTreasuryHealthScore(totalBalance, netFlow, activity.transactionCount);

      return {
        treasuryBalance: totalBalance,
        vaultCount: daoVaults.length,
        recentActivity: {
          inflow: activity.totalInflow,
          outflow: activity.totalOutflow,
          netFlow,
          transactionCount: activity.transactionCount
        },
        healthScore,
        recommendations: this.generateTreasuryRecommendations(healthScore, netFlow, totalBalance)
      };

    } catch (error) {
      console.error('Error calculating treasury health:', error);
      throw new Error('Failed to calculate treasury health metrics');
    }
  }

  private calculateTreasuryHealthScore(balance: number, netFlow: number, transactionCount: number): number {
    let score = 50; // Base score

    // Balance component (0-40 points)
    if (balance > 10000) score += 40;
    else if (balance > 5000) score += 30;
    else if (balance > 1000) score += 20;
    else if (balance > 100) score += 10;

    // Net flow component (0-30 points)
    if (netFlow > 0) score += 30;
    else if (netFlow > -500) score += 20;
    else if (netFlow > -1000) score += 10;

    // Activity component (0-30 points)
    if (transactionCount > 50) score += 30;
    else if (transactionCount > 20) score += 20;
    else if (transactionCount > 5) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  private generateTreasuryRecommendations(healthScore: number, netFlow: number, balance: number): string[] {
    const recommendations = [];

    if (healthScore < 30) {
      recommendations.push('Treasury health is critical - consider emergency fundraising');
    } else if (healthScore < 50) {
      recommendations.push('Treasury needs attention - implement cost reduction measures');
    }

    if (netFlow < 0) {
      recommendations.push('Negative cash flow detected - review spending and increase contributions');
    }

    if (balance < 500) {
      recommendations.push('Low treasury balance - urgent funding required');
    }

    if (recommendations.length === 0) {
      recommendations.push('Treasury is healthy - consider diversification opportunities');
    }

    return recommendations;
  }
}

export const financialAnalyticsService = new FinancialAnalyticsService();
