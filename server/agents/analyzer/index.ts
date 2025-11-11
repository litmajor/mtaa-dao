
/**
 * ANALYZER Agent - Financial Intelligence & Threat Detection
 * Integrates with MtaaDAO ecosystem for real-time analysis
 */

import { BaseAgent, AgentConfig, AgentStatus } from '../framework/base-agent';
import { PatternEngine } from './pattern-engine';
import { AnomalyDetector } from './anomaly-detector';
import { 
  AnalysisResult, 
  AnalysisType, 
  ThreatLevel, 
  Finding 
} from './types';
import { Logger } from '../../utils/logger';

const logger = new Logger('analyzer-agent');

export class AnalyzerAgent extends BaseAgent {
  private patternEngine: PatternEngine;
  private anomalyDetector: AnomalyDetector;

  constructor(agentId: string = 'ANL-MTAA-001') {
    super({
      id: agentId,
      name: 'ANALYZER',
      version: '1.0.0',
      capabilities: [
        'fraud_detection',
        'pattern_recognition',
        'anomaly_detection',
        'treasury_analysis',
        'proposal_analysis',
        'user_behavior_analysis'
      ]
    });

    this.patternEngine = new PatternEngine();
    this.anomalyDetector = new AnomalyDetector();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Analyzer Agent', { agentId: this.config.id });
    this.setStatus(AgentStatus.ACTIVE);
    logger.info('Analyzer Agent initialized successfully');
  }

  async process(data: any): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.analyze(data);
      this.updateMetrics(Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);
      logger.error('Analysis failed', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Analyzer Agent');
    this.setStatus(AgentStatus.PAUSED);
  }

  // === Core Analysis Methods ===

  async analyzeTransaction(transaction: any): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Anomaly detection
    const anomaly = this.anomalyDetector.detectTransactionAnomaly(transaction);
    if (anomaly.isAnomaly) {
      findings.push({
        type: 'anomaly',
        severity: anomaly.score > 0.8 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
        description: `Transaction amount is unusual: ${anomaly.reasons.join(', ')}`,
        evidence: [anomaly.context],
        confidence: anomaly.score
      });
      maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, findings[findings.length - 1].severity);
    }

    // Pattern detection
    const patterns = this.patternEngine.detectPatterns({ transactions: [transaction] });
    patterns.forEach(match => {
      if (match.confidence > 0.6) {
        findings.push({
          type: 'pattern',
          severity: match.pattern.severity,
          description: `Detected pattern: ${match.pattern.name}`,
          evidence: match.matches,
          confidence: match.confidence
        });
        maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, match.pattern.severity);
      }
    });

    return {
      id: `analysis-${Date.now()}`,
      type: AnalysisType.TRANSACTION,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateOverallConfidence(findings),
      findings,
      recommendations: this.generateRecommendations(findings),
      metadata: { transactionId: transaction.id }
    };
  }

  async analyzeProposal(proposal: any, votes: any[]): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Voting anomaly detection
    const votingAnomaly = this.anomalyDetector.detectVotingAnomaly(votes);
    if (votingAnomaly.isAnomaly) {
      findings.push({
        type: 'voting_anomaly',
        severity: ThreatLevel.MEDIUM,
        description: `Unusual voting pattern detected`,
        evidence: [votingAnomaly.context],
        confidence: votingAnomaly.score
      });
      maxThreatLevel = ThreatLevel.MEDIUM;
    }

    // Pattern detection for vote manipulation
    const patterns = this.patternEngine.detectPatterns({ votes, proposal });
    patterns.forEach(match => {
      if (match.confidence > 0.6) {
        findings.push({
          type: 'manipulation_pattern',
          severity: match.pattern.severity,
          description: match.pattern.description,
          evidence: match.matches,
          confidence: match.confidence
        });
        maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, match.pattern.severity);
      }
    });

    return {
      id: `analysis-${Date.now()}`,
      type: AnalysisType.PROPOSAL,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateOverallConfidence(findings),
      findings,
      recommendations: this.generateRecommendations(findings),
      metadata: { proposalId: proposal.id }
    };
  }

  async analyzeVault(vaultId: string, transactions: any[]): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Check for suspicious withdrawal patterns
    const patterns = this.patternEngine.detectPatterns({ transactions });
    patterns.forEach(match => {
      findings.push({
        type: 'vault_pattern',
        severity: match.pattern.severity,
        description: match.pattern.description,
        evidence: match.matches,
        confidence: match.confidence
      });
      maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, match.pattern.severity);
    });

    return {
      id: `analysis-${Date.now()}`,
      type: AnalysisType.VAULT,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateOverallConfidence(findings),
      findings,
      recommendations: this.generateRecommendations(findings),
      metadata: { vaultId }
    };
  }

  // === Private Helper Methods ===

  private async analyze(data: any): Promise<AnalysisResult> {
    // Generic analysis entry point
    if (data.transaction) {
      return this.analyzeTransaction(data.transaction);
    } else if (data.proposal && data.votes) {
      return this.analyzeProposal(data.proposal, data.votes);
    } else if (data.vaultId && data.transactions) {
      return this.analyzeVault(data.vaultId, data.transactions);
    }

    throw new Error('Invalid analysis data provided');
  }

  private getHigherThreatLevel(current: ThreatLevel, new_: ThreatLevel): ThreatLevel {
    const levels = [
      ThreatLevel.MINIMAL,
      ThreatLevel.LOW,
      ThreatLevel.MEDIUM,
      ThreatLevel.HIGH,
      ThreatLevel.CRITICAL
    ];
    const currentIndex = levels.indexOf(current);
    const newIndex = levels.indexOf(new_);
    return levels[Math.max(currentIndex, newIndex)];
  }

  private calculateOverallConfidence(findings: Finding[]): number {
    if (findings.length === 0) return 1.0;
    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
    return avgConfidence;
  }

  private generateRecommendations(findings: Finding[]): string[] {
    const recommendations: string[] = [];

    const hasCritical = findings.some(f => f.severity === ThreatLevel.CRITICAL);
    const hasHigh = findings.some(f => f.severity === ThreatLevel.HIGH);

    if (hasCritical) {
      recommendations.push('IMMEDIATE ACTION REQUIRED: Critical threat detected');
      recommendations.push('Freeze affected accounts/transactions pending investigation');
      recommendations.push('Notify DAO administrators immediately');
    } else if (hasHigh) {
      recommendations.push('Enhanced monitoring recommended');
      recommendations.push('Manual review suggested before approval');
    }

    if (findings.some(f => f.type === 'anomaly')) {
      recommendations.push('Monitor for continued unusual behavior');
    }

    if (findings.some(f => f.type === 'pattern')) {
      recommendations.push('Review historical patterns for similar activity');
    }

    return recommendations;
  }
}

// Export singleton instance
export const analyzerAgent = new AnalyzerAgent();
/**
 * ANALYZER AGENT (ANL-ORACLE)
 * 
 * Advanced data analysis, threat pattern recognition, node profiling,
 * anomaly detection, and intelligence extraction system for MtaaDAO.
 */

import { db } from '../../db';
import { 
  walletTransactions, 
  proposals, 
  votes, 
  daos, 
  daoMemberships,
  users,
  vaults,
  auditLogs
} from '../../../shared/schema';
import { eq, and, desc, sql, gte, or } from 'drizzle-orm';
import { subDays, subHours } from 'date-fns';

export enum ThreatLevel {
  MINIMAL = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  CRITICAL = 5
}

export enum NodeStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  SUSPICIOUS = 'suspicious',
  COMPROMISED = 'compromised',
  OFFLINE = 'offline'
}

export interface AnalysisResult {
  reportId: string;
  timestamp: Date;
  threatLevel: ThreatLevel;
  confidence: number;
  findings: Finding[];
  recommendations: string[];
  affectedEntities: string[];
}

export interface Finding {
  type: string;
  severity: ThreatLevel;
  description: string;
  evidence: any;
  timestamp: Date;
}

export interface NodeProfile {
  nodeId: string;
  status: NodeStatus;
  trustScore: number;
  anomalyCount: number;
  lastActivity: Date;
  metrics: Record<string, number>;
}

export class AnalyzerAgent {
  private id: string;
  private observationWindow: number = 30; // days

  constructor(agentId: string = '001') {
    this.id = `ANL-ORACLE-${agentId}`;
    console.log(`Analyzer Agent ${this.id} initialized`);
  }

  /**
   * Analyze treasury health and detect anomalies
   */
  async analyzeTreasuryHealth(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Get recent transactions
    const since = subDays(new Date(), this.observationWindow);
    const transactions = await db.select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.daoId, daoId),
        gte(walletTransactions.createdAt, since)
      ))
      .orderBy(desc(walletTransactions.createdAt));

    // Analyze transaction patterns
    const anomalies = this.detectTransactionAnomalies(transactions);
    
    for (const anomaly of anomalies) {
      findings.push({
        type: 'transaction_anomaly',
        severity: anomaly.severity,
        description: anomaly.description,
        evidence: anomaly.evidence,
        timestamp: new Date()
      });
      
      if (anomaly.severity > maxThreatLevel) {
        maxThreatLevel = anomaly.severity;
      }
    }

    // Check for suspicious withdrawal patterns
    const withdrawals = transactions.filter(tx => 
      tx.type === 'withdrawal' || tx.type === 'disbursement'
    );
    
    if (withdrawals.length > 0) {
      const suspiciousWithdrawals = this.detectSuspiciousWithdrawals(withdrawals);
      
      if (suspiciousWithdrawals.length > 0) {
        findings.push({
          type: 'suspicious_withdrawals',
          severity: ThreatLevel.HIGH,
          description: `Detected ${suspiciousWithdrawals.length} suspicious withdrawal patterns`,
          evidence: suspiciousWithdrawals,
          timestamp: new Date()
        });
        maxThreatLevel = ThreatLevel.HIGH;
        recommendations.push('Review recent large withdrawals for authorization');
      }
    }

    // Analyze vault health
    const vaultHealth = await this.analyzeVaultHealth(daoId);
    if (vaultHealth.threatLevel > ThreatLevel.LOW) {
      findings.push({
        type: 'vault_health',
        severity: vaultHealth.threatLevel,
        description: vaultHealth.description,
        evidence: vaultHealth.data,
        timestamp: new Date()
      });
      
      if (vaultHealth.threatLevel > maxThreatLevel) {
        maxThreatLevel = vaultHealth.threatLevel;
      }
      recommendations.push(...vaultHealth.recommendations);
    }

    return {
      reportId: `RPT-${Date.now()}-${daoId}`,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      affectedEntities: [daoId]
    };
  }

  /**
   * Analyze governance patterns and detect manipulation
   */
  async analyzeGovernance(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    const since = subDays(new Date(), this.observationWindow);

    // Get recent proposals and votes
    const recentProposals = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        gte(proposals.createdAt, since)
      ));

    // Detect voting anomalies
    for (const proposal of recentProposals) {
      const proposalVotes = await db.select()
        .from(votes)
        .where(eq(votes.proposalId, proposal.id));

      const votingAnomalies = this.detectVotingAnomalies(proposalVotes, proposal);
      
      if (votingAnomalies.length > 0) {
        findings.push({
          type: 'voting_manipulation',
          severity: ThreatLevel.HIGH,
          description: `Suspicious voting patterns detected in proposal ${proposal.id}`,
          evidence: votingAnomalies,
          timestamp: new Date()
        });
        maxThreatLevel = ThreatLevel.HIGH;
        recommendations.push(`Review voting patterns for proposal: ${proposal.title}`);
      }
    }

    // Check for proposal spam
    const proposalsByUser: Record<string, number> = {};
    recentProposals.forEach(p => {
      if (p.userId) {
        proposalsByUser[p.userId] = (proposalsByUser[p.userId] || 0) + 1;
      }
    });

    const spammers = Object.entries(proposalsByUser).filter(([_, count]) => count > 5);
    if (spammers.length > 0) {
      findings.push({
        type: 'proposal_spam',
        severity: ThreatLevel.MEDIUM,
        description: `Detected ${spammers.length} users creating excessive proposals`,
        evidence: spammers,
        timestamp: new Date()
      });
      maxThreatLevel = Math.max(maxThreatLevel, ThreatLevel.MEDIUM);
      recommendations.push('Consider implementing proposal rate limits');
    }

    return {
      reportId: `RPT-GOV-${Date.now()}-${daoId}`,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      affectedEntities: [daoId]
    };
  }

  /**
   * Profile a user/member node
   */
  async profileNode(userId: string, daoId?: string): Promise<NodeProfile> {
    const metrics: Record<string, number> = {};
    let anomalyCount = 0;

    // Get user activity
    const since = subDays(new Date(), 30);
    
    const userTransactions = await db.select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.fromUserId, userId),
        gte(walletTransactions.createdAt, since)
      ));

    metrics.transactionCount = userTransactions.length;
    metrics.transactionVolume = userTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount || '0'), 0
    );

    // Check for suspicious transaction patterns
    const suspiciousTx = userTransactions.filter(tx => {
      const amount = parseFloat(tx.amount || '0');
      return amount > 10000 || tx.status === 'failed';
    });

    anomalyCount += suspiciousTx.length;

    // Get voting activity
    const userVotes = await db.select()
      .from(votes)
      .where(and(
        eq(votes.userId, userId),
        daoId ? eq(votes.daoId, daoId) : sql`1=1`
      ));

    metrics.voteCount = userVotes.length;

    // Calculate trust score (0-100)
    let trustScore = 100;
    
    // Penalize for anomalies
    trustScore -= (anomalyCount * 10);
    
    // Reward for consistent activity
    if (metrics.transactionCount > 10) trustScore += 5;
    if (metrics.voteCount > 5) trustScore += 5;
    
    trustScore = Math.max(0, Math.min(100, trustScore));

    // Determine status
    let status = NodeStatus.HEALTHY;
    if (trustScore < 30) status = NodeStatus.COMPROMISED;
    else if (trustScore < 50) status = NodeStatus.SUSPICIOUS;
    else if (trustScore < 70) status = NodeStatus.DEGRADED;

    return {
      nodeId: userId,
      status,
      trustScore,
      anomalyCount,
      lastActivity: userTransactions[0]?.createdAt || new Date(),
      metrics
    };
  }

  /**
   * Comprehensive fraud detection
   */
  async detectFraud(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Analyze member behavior
    const members = await db.select()
      .from(daoMemberships)
      .where(eq(daoMemberships.daoId, daoId));

    for (const member of members) {
      const profile = await this.profileNode(member.userId, daoId);
      
      if (profile.status === NodeStatus.COMPROMISED || profile.status === NodeStatus.SUSPICIOUS) {
        findings.push({
          type: 'suspicious_member',
          severity: profile.status === NodeStatus.COMPROMISED ? ThreatLevel.CRITICAL : ThreatLevel.HIGH,
          description: `Member ${member.userId} flagged as ${profile.status}`,
          evidence: profile,
          timestamp: new Date()
        });
        maxThreatLevel = ThreatLevel.HIGH;
        recommendations.push(`Review member activity: ${member.userId}`);
      }
    }

    // Check for coordinated voting
    const recentProposals = await db.select()
      .from(proposals)
      .where(eq(proposals.daoId, daoId))
      .limit(10);

    for (const proposal of recentProposals) {
      const proposalVotes = await db.select()
        .from(votes)
        .where(eq(votes.proposalId, proposal.id));

      const coordinationScore = this.detectCoordinatedVoting(proposalVotes);
      
      if (coordinationScore > 0.7) {
        findings.push({
          type: 'coordinated_voting',
          severity: ThreatLevel.HIGH,
          description: `Possible vote coordination detected (score: ${coordinationScore.toFixed(2)})`,
          evidence: { proposalId: proposal.id, score: coordinationScore },
          timestamp: new Date()
        });
        maxThreatLevel = ThreatLevel.HIGH;
      }
    }

    return {
      reportId: `RPT-FRAUD-${Date.now()}-${daoId}`,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      affectedEntities: [daoId]
    };
  }

  /**
   * Real-time monitoring of system health
   */
  async monitorSystemHealth(): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    // Check recent audit logs for errors
    const recentLogs = await db.select()
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, subHours(new Date(), 1)))
      .limit(100);

    const errorLogs = recentLogs.filter(log => log.severity === 'error' || log.severity === 'critical');
    
    if (errorLogs.length > 10) {
      findings.push({
        type: 'system_errors',
        severity: ThreatLevel.MEDIUM,
        description: `High error rate detected: ${errorLogs.length} errors in last hour`,
        evidence: errorLogs.slice(0, 5),
        timestamp: new Date()
      });
      maxThreatLevel = ThreatLevel.MEDIUM;
      recommendations.push('Investigate system errors and performance issues');
    }

    // Check database health
    const dbHealth = await this.checkDatabaseHealth();
    if (!dbHealth.healthy) {
      findings.push({
        type: 'database_health',
        severity: ThreatLevel.HIGH,
        description: 'Database performance degradation detected',
        evidence: dbHealth,
        timestamp: new Date()
      });
      maxThreatLevel = ThreatLevel.HIGH;
    }

    return {
      reportId: `RPT-SYS-${Date.now()}`,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      affectedEntities: ['system']
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private detectTransactionAnomalies(transactions: any[]): any[] {
    const anomalies: any[] = [];
    
    if (transactions.length === 0) return anomalies;

    const amounts = transactions.map(tx => parseFloat(tx.amount || '0'));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount || '0');
      const zScore = Math.abs((amount - mean) / (stdDev || 1));

      if (zScore > 3) {
        anomalies.push({
          severity: zScore > 4 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
          description: `Unusual transaction amount: ${amount} (${zScore.toFixed(2)}σ from mean)`,
          evidence: tx
        });
      }
    });

    return anomalies;
  }

  private detectSuspiciousWithdrawals(withdrawals: any[]): any[] {
    return withdrawals.filter(tx => {
      const amount = parseFloat(tx.amount || '0');
      // Flag large withdrawals or multiple rapid withdrawals
      return amount > 5000 || tx.status === 'failed';
    });
  }

  private async analyzeVaultHealth(daoId: string): Promise<any> {
    const daoVaults = await db.select()
      .from(vaults)
      .where(eq(vaults.daoId, daoId));

    const totalBalance = daoVaults.reduce((sum, v) => 
      sum + parseFloat(v.balance || '0'), 0
    );

    let threatLevel = ThreatLevel.MINIMAL;
    let description = 'Vault health normal';
    const recommendations: string[] = [];

    if (totalBalance < 100) {
      threatLevel = ThreatLevel.MEDIUM;
      description = 'Low vault balance detected';
      recommendations.push('Consider fundraising to maintain healthy treasury');
    }

    return {
      threatLevel,
      description,
      data: { totalBalance, vaultCount: daoVaults.length },
      recommendations
    };
  }

  private detectVotingAnomalies(votes: any[], proposal: any): any[] {
    const anomalies: any[] = [];
    
    // Check for vote timing patterns (all votes within short period)
    if (votes.length > 0) {
      const voteTimes = votes.map(v => new Date(v.createdAt).getTime());
      const timeSpread = Math.max(...voteTimes) - Math.min(...voteTimes);
      
      if (votes.length > 10 && timeSpread < 60000) { // Less than 1 minute
        anomalies.push({
          type: 'rapid_voting',
          description: 'Suspicious rapid voting pattern detected'
        });
      }
    }

    return anomalies;
  }

  private detectCoordinatedVoting(votes: any[]): number {
    if (votes.length < 5) return 0;

    const voteTimes = votes.map(v => new Date(v.createdAt).getTime());
    const timeSpread = Math.max(...voteTimes) - Math.min(...voteTimes);
    
    // Calculate coordination score (0-1)
    // Lower time spread with more votes = higher coordination
    const normalizedSpread = Math.min(timeSpread / (1000 * 60 * 60), 1); // Normalize to hours
    const coordinationScore = (1 - normalizedSpread) * (Math.min(votes.length, 20) / 20);
    
    return coordinationScore;
  }

  private async checkDatabaseHealth(): Promise<any> {
    try {
      const startTime = Date.now();
      await db.select().from(users).limit(1);
      const queryTime = Date.now() - startTime;

      return {
        healthy: queryTime < 1000,
        queryTime,
        threshold: 1000
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private calculateConfidence(findings: Finding[]): number {
    if (findings.length === 0) return 1.0;
    
    const severityWeights = findings.map(f => f.severity / ThreatLevel.CRITICAL);
    const avgWeight = severityWeights.reduce((a, b) => a + b, 0) / severityWeights.length;
    
    return Math.min(0.5 + avgWeight * 0.5, 1.0);
  }
}

// Export singleton instance
export const analyzer = new AnalyzerAgent();
