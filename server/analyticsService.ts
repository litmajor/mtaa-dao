
import { db } from './db';
import { daos, proposals, votes, tasks, vaults, users, transactions } from '../shared/schema';
import { eq, gte, lte, desc, asc, count, sum, avg, sql } from 'drizzle-orm';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';

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
  
  // Real-time metrics collection
  async getRealTimeMetrics(daoId?: string): Promise<AnalyticsMetrics> {
    const whereClause = daoId ? eq(daos.id, daoId) : undefined;
    
    const [
      totalDaos,
      totalProposals,
      totalVotes,
      totalUsers,
      totalTasks,
      transactionData,
      proposalData
    ] = await Promise.all([
      // Total DAOs
      db.select({ count: count() }).from(daos).where(whereClause),
      
      // Total Proposals
      daoId 
        ? db.select({ count: count() }).from(proposals).where(eq(proposals.daoId, daoId))
        : db.select({ count: count() }).from(proposals),
      
      // Total Votes
      daoId
        ? db.select({ count: count() }).from(votes)
            .innerJoin(proposals, eq(votes.proposalId, proposals.id))
            .where(eq(proposals.daoId, daoId))
        : db.select({ count: count() }).from(votes),
      
      // Total Users
      db.select({ count: count() }).from(users),
      
      // Total Tasks
      daoId
        ? db.select({ count: count() }).from(tasks).where(eq(tasks.daoId, daoId))
        : db.select({ count: count() }).from(tasks),
      
      // Transaction Volume
      daoId
        ? db.select({ 
            total: sum(sql`CAST(${transactions.amount} AS DECIMAL)`),
            count: count()
          }).from(transactions).where(eq(transactions.daoId, daoId))
        : db.select({ 
            total: sum(sql`CAST(${transactions.amount} AS DECIMAL)`),
            count: count()
          }).from(transactions),
      
      // Proposal Success Rate Data
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

    const totalProposalCount = proposalData.reduce((sum, item) => sum + item.count, 0);
    const successfulProposals = proposalData.find(item => item.status === 'executed')?.count || 0;
    const avgProposalSuccessRate = totalProposalCount > 0 ? (successfulProposals / totalProposalCount) * 100 : 0;

    // Get top performing DAOs
    const topPerformingDaos = await this.getTopPerformingDaos(5);

    return {
      totalDaos: totalDaos[0]?.count || 0,
      totalProposals: totalProposals[0]?.count || 0,
      totalVotes: totalVotes[0]?.count || 0,
      totalUsers: totalUsers[0]?.count || 0,
      totalTasks: totalTasks[0]?.count || 0,
      totalTransactionVolume: Number(transactionData[0]?.total) || 0,
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

      const [daoCount, userCount, proposalCount, transactionData, proposalSuccess] = await Promise.all([
        daoId 
          ? Promise.resolve([{ count: 1 }])
          : db.select({ count: count() }).from(daos)
              .where(lte(daos.createdAt, dayEnd)),
        
        db.select({ count: count() }).from(users)
          .where(lte(users.createdAt, dayEnd)),
        
        daoId
          ? db.select({ count: count() }).from(proposals)
              .where(eq(proposals.daoId, daoId))
              .where(gte(proposals.createdAt, dayStart))
              .where(lte(proposals.createdAt, dayEnd))
          : db.select({ count: count() }).from(proposals)
              .where(gte(proposals.createdAt, dayStart))
              .where(lte(proposals.createdAt, dayEnd)),
        
        daoId
          ? db.select({ 
              total: sum(sql`CAST(${transactions.amount} AS DECIMAL)`)
            }).from(transactions)
              .where(eq(transactions.daoId, daoId))
              .where(gte(transactions.createdAt, dayStart))
              .where(lte(transactions.createdAt, dayEnd))
          : db.select({ 
              total: sum(sql`CAST(${transactions.amount} AS DECIMAL)`)
            }).from(transactions)
              .where(gte(transactions.createdAt, dayStart))
              .where(lte(transactions.createdAt, dayEnd)),
        
        this.getSuccessRateForPeriod(dayStart, dayEnd, daoId)
      ]);

      historicalData.push({
        timestamp: format(current, 'yyyy-MM-dd'),
        daoCount: daoCount[0]?.count || 0,
        userCount: userCount[0]?.count || 0,
        proposalCount: proposalCount[0]?.count || 0,
        transactionVolume: Number(transactionData[0]?.total) || 0,
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
      memberCount: daos.memberCount,
      treasuryAddress: daos.treasuryAddress
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

  private async calculateUserEngagement(daoId?: string): Promise<number> {
    const thirtyDaysAgo = subDays(new Date(), 30);
    
    const [totalUsers, activeUsers] = await Promise.all([
      daoId 
        ? db.select({ count: count() }).from(users) // Would need DAO membership table
        : db.select({ count: count() }).from(users),
      
      daoId
        ? db.select({ count: count() }).from(votes)
            .innerJoin(proposals, eq(votes.proposalId, proposals.id))
            .where(eq(proposals.daoId, daoId))
            .where(gte(votes.createdAt, thirtyDaysAgo))
        : db.select({ count: count() }).from(votes)
            .where(gte(votes.createdAt, thirtyDaysAgo))
    ]);

    const total = totalUsers[0]?.count || 0;
    const active = activeUsers[0]?.count || 0;

    return total > 0 ? (active / total) * 100 : 0;
  }

  private async getSuccessRateForPeriod(start: Date, end: Date, daoId?: string): Promise<number> {
    const proposalsData = daoId
      ? await db.select({ 
          status: proposals.status,
          count: count()
        }).from(proposals)
          .where(eq(proposals.daoId, daoId))
          .where(gte(proposals.createdAt, start))
          .where(lte(proposals.createdAt, end))
          .groupBy(proposals.status)
      : await db.select({ 
          status: proposals.status,
          count: count()
        }).from(proposals)
          .where(gte(proposals.createdAt, start))
          .where(lte(proposals.createdAt, end))
          .groupBy(proposals.status);

    const total = proposalsData.reduce((sum, item) => sum + item.count, 0);
    const successful = proposalsData.find(item => item.status === 'executed')?.count || 0;

    return total > 0 ? (successful / total) * 100 : 0;
  }

  private async getSuccessRateForDao(daoId: string): Promise<number> {
    const proposalsData = await db.select({ 
      status: proposals.status,
      count: count()
    }).from(proposals)
      .where(eq(proposals.daoId, daoId))
      .groupBy(proposals.status);

    const total = proposalsData.reduce((sum, item) => sum + item.count, 0);
    const successful = proposalsData.find(item => item.status === 'executed')?.count || 0;

    return total > 0 ? (successful / total) * 100 : 0;
  }
}

export const analyticsService = new AnalyticsService();
