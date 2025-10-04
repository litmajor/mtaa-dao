import { db } from './db';
import { daos, proposals, votes, tasks, vaults, users } from '../shared/schema';
import { eq, gte, lte, desc, asc, count, sum, avg, sql, and } from 'drizzle-orm';
// 'and' is now imported for use in query conditions
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { EventEmitter } from 'events';

export interface AnalyticsMetrics {
  totalDaos: number;
  totalProposals: number;
  totalVotes: number;
  totalUsers: number;
  totalTasks: number;
  totalTransactionVolume: number;
  avgProposalSuccessRate: number;
  avgUserEngagement: number;
  topPerformingDaos: Array<{
    id: string;
    name: string;
    memberCount: number;
    proposalCount: number;
    successRate: number;
    treasuryValue: number;
  }>;
}

export interface HistoricalData {
  timestamp: string;
  daoCount: number;
  userCount: number;
  proposalCount: number;
  transactionVolume: number;
  avgSuccessRate: number;
}

export interface PerformanceBenchmarks {
  industry: {
    avgGovernanceParticipation: number;
    avgProposalSuccessRate: number;
    avgTreasuryGrowth: number;
  };
  platform: {
    topQuartile: AnalyticsMetrics;
    median: AnalyticsMetrics;
    bottomQuartile: AnalyticsMetrics;
  };
}

export class AnalyticsService {
  private eventEmitter = new EventEmitter();
  private realTimeMetrics: Map<string, AnalyticsMetrics> = new Map();
  private userActivityCache: Map<string, { timestamp: Date; action: string }[]> = new Map();

  constructor() {
    // Update real-time metrics every 30 seconds
    setInterval(() => this.updateRealTimeMetrics(), 30000);

    // Clean up old activity data every hour
    setInterval(() => this.cleanupUserActivity(), 3600000);
  }

  // Track user activity for analytics
  async trackUserActivity(userId: string, action: string, metadata?: any) {
    const activity = { timestamp: new Date(), action, ...metadata };

    if (!this.userActivityCache.has(userId)) {
      this.userActivityCache.set(userId, []);
    }

    this.userActivityCache.get(userId)!.push(activity);

    // Store in database for persistence
    try {
      await db.insert(sql`
        INSERT INTO user_activities (user_id, action, metadata, created_at)
        VALUES (${userId}, ${action}, ${JSON.stringify(metadata || {})}, NOW())
      `);
    } catch (error) {
      console.warn('Failed to persist user activity:', error);
    }

    // Emit real-time event
    this.eventEmitter.emit('userActivity', { userId, action, metadata });
  }

  // Real-time metrics collection
  async getRealTimeMetrics(daoId?: string): Promise<AnalyticsMetrics> {
    const whereClause = daoId ? eq(daos.id, daoId) : undefined;

    const [
      totalDaos,
      totalProposals,
      totalVotes,
      totalUsers,
      totalTasks,
      proposalData
    ] = await Promise.all([
      db.select({ count: count() }).from(daos).where(whereClause),
      daoId 
        ? db.select({ count: count() }).from(proposals).where(eq(proposals.daoId, daoId))
        : db.select({ count: count() }).from(proposals),
      daoId
        ? db.select({ count: count() }).from(votes)
            .innerJoin(proposals, eq(votes.proposalId, proposals.id))
            .where(eq(proposals.daoId, daoId))
        : db.select({ count: count() }).from(votes),
      db.select({ count: count() }).from(users),
      daoId
        ? db.select({ count: count() }).from(tasks).where(eq(tasks.daoId, daoId))
        : db.select({ count: count() }).from(tasks),
      daoId
        ? db.select({ 
            status: proposals.status,
            count: count()
          }).from(proposals)
            .where(eq(proposals.daoId, daoId))
            .groupBy(proposals.status)
        : db.select({ 
            status: proposals.status,
            count: count()
          }).from(proposals)
            .groupBy(proposals.status)
    ]);

  const totalProposalCount = proposalData.reduce((sum: number, item: { status: string | null; count: number }) => sum + item.count, 0);
  const successfulProposals = proposalData.find((item: { status: string | null; count: number }) => item.status === 'executed')?.count || 0;
    const avgProposalSuccessRate = totalProposalCount > 0 ? (successfulProposals / totalProposalCount) * 100 : 0;

    // Get top performing DAOs
    const topPerformingDaos = await this.getTopPerformingDaos(5);

    return {
      totalDaos: totalDaos[0]?.count || 0,
      totalProposals: totalProposals[0]?.count || 0,
      totalVotes: totalVotes[0]?.count || 0,
      totalUsers: totalUsers[0]?.count || 0,
      totalTasks: totalTasks[0]?.count || 0,
      totalTransactionVolume: 0,
      avgProposalSuccessRate,
      avgUserEngagement: await this.calculateUserEngagement(daoId),
      topPerformingDaos
    };
  }

  // Historical data analysis
  async getHistoricalData(
    period: 'week' | 'month' | 'quarter' | 'year',
    daoId?: string
  ): Promise<HistoricalData[]> {
    const now = new Date();
    let startDate: Date;
    let interval: string;

    switch (period) {
      case 'week':
        startDate = subDays(now, 7);
        interval = 'day';
        break;
      case 'month':
        startDate = subMonths(now, 1);
        interval = 'day';
        break;
      case 'quarter':
        startDate = subMonths(now, 3);
        interval = 'week';
        break;
      case 'year':
        startDate = subYears(now, 1);
        interval = 'month';
        break;
    }

    const historicalData: HistoricalData[] = [];
    const current = new Date(startDate);

    while (current <= now) {
      const dayStart = startOfDay(current);
      const dayEnd = endOfDay(current);

          const [daoCount, userCount, proposalCount, proposalSuccess] = await Promise.all([
        daoId 
          ? Promise.resolve([{ count: 1 }])
          : db.select({ count: count() }).from(daos)
              .where(lte(daos.createdAt, dayEnd)),

        db.select({ count: count() }).from(users)
          .where(lte(users.createdAt, dayEnd)),

    daoId
      ? db.select({ count: count() }).from(proposals)
        .where(and(eq(proposals.daoId, daoId), gte(proposals.createdAt, dayStart), lte(proposals.createdAt, dayEnd)))
      : db.select({ count: count() }).from(proposals)
        .where(and(gte(proposals.createdAt, dayStart), lte(proposals.createdAt, dayEnd))),


        this.getSuccessRateForPeriod(dayStart, dayEnd, daoId)
      ]);

      historicalData.push({
        timestamp: format(current, 'yyyy-MM-dd'),
        daoCount: daoCount[0]?.count || 0,
        userCount: userCount[0]?.count || 0,
        proposalCount: proposalCount[0]?.count || 0,
            transactionVolume: 0,
        avgSuccessRate: proposalSuccess
      });

      // Increment based on interval
      if (interval === 'day') current.setDate(current.getDate() + 1);
      else if (interval === 'week') current.setDate(current.getDate() + 7);
      else if (interval === 'month') current.setMonth(current.getMonth() + 1);
    }

    return historicalData;
  }

  // Performance benchmarks
  async getPerformanceBenchmarks(): Promise<PerformanceBenchmarks> {
    const allDaoMetrics = await Promise.all(
      (await db.select({ id: daos.id }).from(daos)).map(dao => 
        this.getRealTimeMetrics(dao.id)
      )
    );

    // Sort by different metrics to get quartiles
    const sortedByEngagement = [...allDaoMetrics].sort((a, b) => b.avgUserEngagement - a.avgUserEngagement);
    const sortedBySuccess = [...allDaoMetrics].sort((a, b) => b.avgProposalSuccessRate - a.avgProposalSuccessRate);

    const quartileIndex = Math.floor(allDaoMetrics.length / 4);

    return {
      industry: {
        avgGovernanceParticipation: 65, // Industry benchmark
        avgProposalSuccessRate: 72,     // Industry benchmark
        avgTreasuryGrowth: 15           // Industry benchmark
      },
      platform: {
        topQuartile: sortedByEngagement[0] || await this.getRealTimeMetrics(),
        median: sortedByEngagement[Math.floor(allDaoMetrics.length / 2)] || await this.getRealTimeMetrics(),
        bottomQuartile: sortedByEngagement[allDaoMetrics.length - quartileIndex] || await this.getRealTimeMetrics()
      }
    };
  }

  // Export data to CSV
  async exportToCSV(
    type: 'metrics' | 'historical' | 'benchmarks',
    period?: 'week' | 'month' | 'quarter' | 'year',
    daoId?: string
  ): Promise<string> {
    let data: any[];
    let headers: string[];

    switch (type) {
      case 'metrics':
        const metrics = await this.getRealTimeMetrics(daoId);
        headers = Object.keys(metrics).filter(key => key !== 'topPerformingDaos');
        data = [Object.values(metrics).filter((_, index) => headers[index])];
        break;

      case 'historical':
        const historical = await this.getHistoricalData(period || 'month', daoId);
        headers = Object.keys(historical[0] || {});
        data = historical.map(item => Object.values(item));
        break;

      case 'benchmarks':
        const benchmarks = await this.getPerformanceBenchmarks();
        headers = ['Type', 'AvgGovernanceParticipation', 'AvgProposalSuccessRate', 'AvgTreasuryGrowth'];
        data = [
          ['Industry', benchmarks.industry.avgGovernanceParticipation, benchmarks.industry.avgProposalSuccessRate, benchmarks.industry.avgTreasuryGrowth],
          ['Platform Top', benchmarks.platform.topQuartile.avgUserEngagement, benchmarks.platform.topQuartile.avgProposalSuccessRate, benchmarks.platform.topQuartile.totalTransactionVolume],
          ['Platform Median', benchmarks.platform.median.avgUserEngagement, benchmarks.platform.median.avgProposalSuccessRate, benchmarks.platform.median.totalTransactionVolume]
        ];
        break;
    }

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  // Helper methods
  private async getTopPerformingDaos(limit: number) {
    const daosList = await db.select({
      id: daos.id,
      name: daos.name,
      memberCount: daos.memberCount
    }).from(daos).limit(limit);

    return Promise.all(daosList.map(async dao => {
      const [proposalCount, successRate] = await Promise.all([
        db.select({ count: count() }).from(proposals).where(eq(proposals.daoId, dao.id)),
        this.getSuccessRateForDao(dao.id)
      ]);

      return {
        id: dao.id,
        name: dao.name,
        memberCount: dao.memberCount || 0,
        proposalCount: proposalCount[0]?.count || 0,
        successRate,
        treasuryValue: 0 // Would integrate with treasury service
      };
    }));
  }

  // Update real-time metrics cache
  private async updateRealTimeMetrics() {
    try {
      const globalMetrics = await this.getRealTimeMetrics();
      this.realTimeMetrics.set('global', globalMetrics);

      // Update metrics for active DAOs
      const activeDaos = await db.select({ id: daos.id }).from(daos).limit(10);
      for (const dao of activeDaos) {
        const daoMetrics = await this.getRealTimeMetrics(dao.id);
        this.realTimeMetrics.set(dao.id, daoMetrics);
      }

      // Emit updated metrics
      this.eventEmitter.emit('metricsUpdate', this.realTimeMetrics);
    } catch (error) {
      console.error('Failed to update real-time metrics:', error);
    }
  }

  // Get cached real-time metrics
  getCachedMetrics(daoId?: string): AnalyticsMetrics | null {
    return this.realTimeMetrics.get(daoId || 'global') || null;
  }

  // Subscribe to real-time updates
  onMetricsUpdate(callback: (metrics: Map<string, AnalyticsMetrics>) => void) {
    this.eventEmitter.on('metricsUpdate', callback);
    return () => this.eventEmitter.off('metricsUpdate', callback);
  }

  // Subscribe to user activity
  onUserActivity(callback: (activity: any) => void) {
    this.eventEmitter.on('userActivity', callback);
    return () => this.eventEmitter.off('userActivity', callback);
  }

  private cleanupUserActivity() {
    const oneDayAgo = subDays(new Date(), 1);

    for (const [userId, activities] of this.userActivityCache.entries()) {
      const filtered = activities.filter(a => a.timestamp > oneDayAgo);
      if (filtered.length === 0) {
        this.userActivityCache.delete(userId);
      } else {
        this.userActivityCache.set(userId, filtered);
      }
    }
  }

  // Enhanced user engagement calculation
  private async calculateUserEngagement(daoId?: string): Promise<number> {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const sevenDaysAgo = subDays(new Date(), 7);

    const [totalUsers, activeUsers, weeklyActive] = await Promise.all([
      daoId 
        ? db.select({ count: count() }).from(users) // Would need DAO membership table
        : db.select({ count: count() }).from(users),

      daoId
        ? db.select({ count: count() }).from(votes)
            .innerJoin(proposals, eq(votes.proposalId, proposals.id))
            .where(and(eq(proposals.daoId, daoId), gte(votes.createdAt, thirtyDaysAgo)))
        : db.select({ count: count() }).from(votes)
            .where(gte(votes.createdAt, thirtyDaysAgo)),

      daoId
        ? db.select({ count: count() }).from(votes)
            .innerJoin(proposals, eq(votes.proposalId, proposals.id))
            .where(and(eq(proposals.daoId, daoId), gte(votes.createdAt, sevenDaysAgo)))
        : db.select({ count: count() }).from(votes)
            .where(gte(votes.createdAt, sevenDaysAgo))
    ]);

    const total = totalUsers[0]?.count || 0;
    const monthly = activeUsers[0]?.count || 0;
    const weekly = weeklyActive[0]?.count || 0;

    // Calculate engagement score based on multiple factors
    const monthlyEngagement = total > 0 ? (monthly / total) * 100 : 0;
    const weeklyEngagement = total > 0 ? (weekly / total) * 100 : 0;

    // Weight weekly engagement more heavily
    return (monthlyEngagement * 0.4 + weeklyEngagement * 0.6);
  }

  private async getSuccessRateForPeriod(start: Date, end: Date, daoId?: string): Promise<number> {
    const proposalsData = daoId
      ? await db.select({ 
          status: proposals.status,
          count: count()
        }).from(proposals)
          .where(and(eq(proposals.daoId, daoId), gte(proposals.createdAt, start), lte(proposals.createdAt, end)))
          .groupBy(proposals.status)
      : await db.select({ 
          status: proposals.status,
          count: count()
        }).from(proposals)
          .where(and(gte(proposals.createdAt, start), lte(proposals.createdAt, end)))
          .groupBy(proposals.status);

  const total = proposalsData.reduce((sum: number, item: { status: string | null; count: number }) => sum + item.count, 0);
  const successful = proposalsData.find((item: { status: string | null; count: number }) => item.status !== null && item.status === 'executed')?.count || 0;

    return total > 0 ? (successful / total) * 100 : 0;
  }

  private async getSuccessRateForDao(daoId: string): Promise<number> {
    const proposalsData = await db.select({ 
      status: proposals.status,
      count: count()
    }).from(proposals)
      .where(eq(proposals.daoId, daoId))
      .groupBy(proposals.status);

  const total = proposalsData.reduce((sum: number, item: { status: string | null; count: number }) => sum + item.count, 0);
  const successful = proposalsData.find((item: { status: string | null; count: number }) => item.status !== null && item.status === 'executed')?.count || 0;

    return total > 0 ? (successful / total) * 100 : 0;
  }
}

export const analyticsService = new AnalyticsService();