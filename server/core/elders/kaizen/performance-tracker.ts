/**
 * Performance Tracker for ELD-KAIZEN
 * 
 * Collects and aggregates performance metrics from all major systems
 */

import { db } from '../../../db';
import { FinancialAnalyzer } from '../../nuru/analytics/financial_analyzer';
import { GovernanceAnalyzer } from '../../nuru/analytics/governance_analyzer';
import { CommunityAnalyzer } from '../../nuru/analytics/community_analyzer';
import { WalletAnalyzer } from '../../nuru/analytics/wallet_analyzer';
import { DaoAnalyzer } from '../../nuru/analytics/dao_analyzer';
import type { AnalysisResponse } from '../../nuru/types';

export interface PerformanceMetrics {
  timestamp: Date;
  treasury: TreasuryMetrics;
  governance: GovernanceMetrics;
  community: CommunityMetrics;
  wallet: WalletMetrics;
  dao: DaoMetrics;
  system: SystemMetrics;
  scores: PerformanceScores;
}

export interface TreasuryMetrics {
  balance: number;
  burnRate: number;
  runway: number;
  growthRate: number;
  healthScore: number;
}

export interface GovernanceMetrics {
  participationRate: number;
  proposalSuccessRate: number;
  quorumMet: number;
  delegationRate: number;
  governanceHealth: number;
}

export interface CommunityMetrics {
  activeMembers: number;
  engagementScore: number;
  retentionRate: number;
  growthRate: number;
  communityHealth: number;
}

export interface WalletMetrics {
  walletCount: number;
  activeWallets: number;
  totalBalance: number;
  transactionCount: number;
  securityScore: number;
  concentrationRisk: number;
  walletHealth: number;
}

export interface DaoMetrics {
  memberCount: number;
  activeMemberCount: number;
  walletCount: number;
  vaultCount: number;
  treasuryBalance: number;
  maturityScore: number;
  governanceHealth: number;
  daoHealth: number;
}

export interface SystemMetrics {
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  uptime: number; // percentage
  resourceUtilization: number; // percentage
}

export interface PerformanceScores {
  overall: number; // 0-100
  treasury: number;
  governance: number;
  community: number;
  system: number;
}

export class PerformanceTracker {
  private financialAnalyzer: FinancialAnalyzer;
  private governanceAnalyzer: GovernanceAnalyzer;
  private communityAnalyzer: CommunityAnalyzer;
  private walletAnalyzer: WalletAnalyzer;
  private daoAnalyzer: DaoAnalyzer;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 168; // 7 days of hourly metrics

  constructor() {
    this.financialAnalyzer = new FinancialAnalyzer();
    this.governanceAnalyzer = new GovernanceAnalyzer();
    this.communityAnalyzer = new CommunityAnalyzer();
    this.walletAnalyzer = new WalletAnalyzer();
    this.daoAnalyzer = new DaoAnalyzer();
  }

  /**
   * Collect comprehensive performance metrics for a DAO
   */
  async collectMetrics(daoId: string): Promise<PerformanceMetrics> {
    const [treasuryData, governanceData, communityData, walletData, daoData] = await Promise.all([
      this.financialAnalyzer.analyze(daoId, '30d'),
      this.governanceAnalyzer.analyze(daoId, '30d'),
      this.communityAnalyzer.analyze(daoId, '30d'),
      this.walletAnalyzer.analyze(daoId, '30d'),
      this.daoAnalyzer.analyze(daoId, '30d')
    ]);

    const treasury = this.extractTreasuryMetrics(treasuryData);
    const governance = this.extractGovernanceMetrics(governanceData);
    const community = this.extractCommunityMetrics(communityData);
    const wallet = this.extractWalletMetrics(walletData);
    const dao = this.extractDaoMetrics(daoData);
    const system = await this.measureSystemMetrics();

    const scores = this.calculateScores(treasury, governance, community, wallet, dao, system);

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      treasury,
      governance,
      community,
      wallet,
      dao,
      system,
      scores
    };

    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    return metrics;
  }

  /**
   * Extract treasury metrics from analysis response
   */
  private extractTreasuryMetrics(analysis: AnalysisResponse): TreasuryMetrics {
    return {
      balance: Number(analysis.metrics.currentBalance || 0),
      burnRate: Number(analysis.metrics.burnRate || 0),
      runway: Number(analysis.metrics.runway || 0),
      growthRate: Number(analysis.metrics.treasuryGrowthRate || 0),
      healthScore: analysis.metrics.runway > 6 ? 100 : (analysis.metrics.runway / 6) * 100
    };
  }

  /**
   * Extract governance metrics from analysis response
   */
  private extractGovernanceMetrics(analysis: AnalysisResponse): GovernanceMetrics {
    return {
      participationRate: Number(analysis.metrics.avgParticipationRate || 0) * 100,
      proposalSuccessRate: Number(analysis.metrics.proposalSuccessRate || 0) * 100,
      quorumMet: Number(analysis.metrics.avgQuorum || 0) * 100,
      delegationRate: analysis.metrics.delegatedVotes / Math.max(analysis.metrics.uniqueVoters, 1) * 100,
      governanceHealth: this.calculateGovernanceHealth(analysis.metrics)
    };
  }

  /**
   * Extract community metrics from analysis response
   */
  private extractCommunityMetrics(analysis: AnalysisResponse): CommunityMetrics {
    return {
      activeMembers: Number(analysis.metrics.activeMembers || 0),
      engagementScore: Number(analysis.metrics.engagementScore || 0) * 100,
      retentionRate: Number(analysis.metrics.retentionRate || 0) * 100,
      growthRate: Number(analysis.metrics.communityGrowthRate || 0) * 100,
      communityHealth: this.calculateCommunityHealth(analysis.metrics)
    };
  }

  /**
   * Extract wallet metrics from analysis response
   */
  private extractWalletMetrics(analysis: AnalysisResponse): WalletMetrics {
    const walletHealth = Math.min(100,
      (Number(analysis.metrics.securityScore || 0) * 0.5) +
      ((1 - Number(analysis.metrics.concentrationRisk || 0)) * 0.5) * 100
    );
    return {
      walletCount: Number(analysis.metrics.walletCount || 0),
      activeWallets: Number(analysis.metrics.activeWallets || 0),
      totalBalance: Number(analysis.metrics.totalBalance || 0),
      transactionCount: Number(analysis.metrics.transactionCount || 0),
      securityScore: Number(analysis.metrics.securityScore || 0),
      concentrationRisk: Number(analysis.metrics.concentrationRisk || 0),
      walletHealth
    };
  }

  /**
   * Extract DAO metrics from analysis response
   */
  private extractDaoMetrics(analysis: AnalysisResponse): DaoMetrics {
    const daoHealth = Math.min(100,
      (Number(analysis.metrics.maturityScore || 0) * 0.4) +
      (Number(analysis.metrics.governanceHealth || 0) * 0.3) +
      ((Number(analysis.metrics.memberCount || 1) / Math.max(Number(analysis.metrics.memberCount || 1), 5)) * 100 * 0.3)
    );
    return {
      memberCount: Number(analysis.metrics.memberCount || 0),
      activeMemberCount: Number(analysis.metrics.activeMemberCount || 0),
      walletCount: Number(analysis.metrics.walletCount || 0),
      vaultCount: Number(analysis.metrics.vaultCount || 0),
      treasuryBalance: Number(analysis.metrics.treasuryBalance || 0),
      maturityScore: Number(analysis.metrics.maturityScore || 0),
      governanceHealth: Number(analysis.metrics.governanceHealth || 0),
      daoHealth
    };
  }

  /**
   * Measure system-level performance metrics
   */
  private async measureSystemMetrics(): Promise<SystemMetrics> {
    const startTime = Date.now();
    
    // Perform a simple health check query
    try {
      await db.execute('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        responseTime,
        errorRate: 0, // No error on health check
        uptime: 99.9, // Assume healthy
        resourceUtilization: 50 // Default estimate
      };
    } catch (error) {
      return {
        responseTime: Date.now() - startTime,
        errorRate: 100,
        uptime: 0,
        resourceUtilization: 0
      };
    }
  }

  /**
   * Calculate overall performance scores
   */
  private calculateScores(
    treasury: TreasuryMetrics,
    governance: GovernanceMetrics,
    community: CommunityMetrics,
    wallet: WalletMetrics,
    dao: DaoMetrics,
    system: SystemMetrics
  ): PerformanceScores {
    const treasuryScore = Math.min(100, treasury.healthScore);
    const governanceScore = Math.min(100, governance.governanceHealth);
    const communityScore = Math.min(100, community.communityHealth);
    const walletScore = Math.min(100, wallet.walletHealth);
    const daoScore = Math.min(100, dao.daoHealth);
    const systemScore = Math.min(100, 100 - (system.errorRate * 0.1 + system.responseTime / 50));

    const overall = (treasuryScore * 0.25 + governanceScore * 0.25 + communityScore * 0.15 + walletScore * 0.15 + daoScore * 0.15 + systemScore * 0.05);

    return {
      overall: Math.round(overall),
      treasury: Math.round(treasuryScore),
      governance: Math.round(governanceScore),
      community: Math.round(communityScore),
      system: Math.round(systemScore)
    };
  }

  /**
   * Calculate governance health score
   */
  private calculateGovernanceHealth(metrics: Record<string, any>): number {
    const participation = (metrics.avgParticipationRate || 0) * 100;
    const successRate = (metrics.proposalSuccessRate || 0) * 100;
    const quorum = (metrics.avgQuorum || 0) * 100;

    return (participation * 0.4 + successRate * 0.35 + quorum * 0.25);
  }

  /**
   * Calculate community health score
   */
  private calculateCommunityHealth(metrics: Record<string, any>): number {
    const engagement = (metrics.engagementScore || 0) * 100;
    const retention = (metrics.retentionRate || 0) * 100;
    const growth = Math.min(100, (metrics.communityGrowthRate || 0) * 100 + 50);

    return (engagement * 0.4 + retention * 0.35 + growth * 0.25);
  }

  /**
   * Get historical trend for a metric
   */
  getMetricTrend(metricPath: string, hours: number = 24): number[] {
    const now = Date.now();
    const cutoff = now - hours * 3600000;

    return this.metricsHistory
      .filter(m => m.timestamp.getTime() >= cutoff)
      .map(m => this.getNestedMetric(m, metricPath));
  }

  /**
   * Get a nested metric by path (e.g., "treasury.burnRate")
   */
  private getNestedMetric(obj: any, path: string): number {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value[key];
    }
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Identify trends and anomalies
   */
  identifyAnomalies(metric: string, threshold: number = 20): Array<{ timestamp: Date; value: number }> {
    if (this.metricsHistory.length < 2) return [];

    const trend = this.getMetricTrend(metric);
    const average = trend.reduce((a, b) => a + b, 0) / trend.length;
    const stdDev = Math.sqrt(
      trend.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / trend.length
    );

    const anomalies: Array<{ timestamp: Date; value: number }> = [];
    const recentMetrics = this.metricsHistory.slice(-trend.length);

    recentMetrics.forEach((m, i) => {
      const value = trend[i];
      const zScore = Math.abs((value - average) / (stdDev || 1));
      if (zScore > 2) {
        anomalies.push({ timestamp: m.timestamp, value });
      }
    });

    return anomalies;
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  /**
   * Get wallet metrics for a DAO
   */
  async getWalletMetrics(daoId: string): Promise<WalletMetrics | null> {
    try {
      const analysis = await this.walletAnalyzer.analyze(daoId);
      return this.extractWalletMetrics(analysis);
    } catch (error) {
      console.error('Error getting wallet metrics:', error);
      return null;
    }
  }

  /**
   * Get DAO metrics for a DAO
   */
  async getDaoMetrics(daoId: string): Promise<DaoMetrics | null> {
    try {
      const analysis = await this.daoAnalyzer.analyze(daoId);
      return this.extractDaoMetrics(analysis);
    } catch (error) {
      console.error('Error getting DAO metrics:', error);
      return null;
    }
  }
}
