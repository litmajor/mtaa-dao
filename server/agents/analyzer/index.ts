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
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';
import { db } from '../../db';
import { 
  walletTransactions, 
  proposals, 
  votes, 
  daoMemberships,
  users,
  vaults,
  auditLogs
} from '../../../shared/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { subDays, subHours } from 'date-fns';

const logger = new Logger('analyzer-agent');

export enum NodeStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  SUSPICIOUS = 'suspicious',
  COMPROMISED = 'compromised',
  OFFLINE = 'offline'
}

export interface NodeProfile {
  nodeId: string;
  status: NodeStatus;
  trustScore: number;
  anomalyCount: number;
  lastActivity: Date;
  metrics: Record<string, number>;
}

export class AnalyzerAgent extends BaseAgent {
  private patternEngine: PatternEngine;
  private anomalyDetector: AnomalyDetector;
  private communicator: AgentCommunicator;
  private observationWindow: number = 30; // days

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
    this.communicator = new AgentCommunicator(agentId);

    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.ANALYSIS_REQUEST,
      MessageType.HEALTH_CHECK
    ], this.handleMessage.bind(this));
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.ANALYSIS_REQUEST:
          const result = await this.process(message.payload);
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, result);
          }
          break;
        case MessageType.HEALTH_CHECK:
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, {
              status: this.getStatus(),
              metrics: this.getMetrics()
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Error handling message', error);
    }
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

      if (anomaly.score > 0.7) {
        await this.communicator.reportThreat({
          type: 'transaction_anomaly',
          severity: anomaly.score,
          transaction,
          reasons: anomaly.reasons
        });
      }
      }
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

    const votingAnomaly = this.anomalyDetector.detectVotingAnomaly(votes);
    if (votingAnomaly.isAnomaly) {
      findings.push({
        type: 'voting_anomaly',
        severity: ThreatLevel.MEDIUM,
        description: `Unusual voting pattern detected`,
        evidence: Array.isArray(votingAnomaly.context) ? votingAnomaly.context : [votingAnomaly.context],
        confidence: votingAnomaly.score
      });
      maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, ThreatLevel.MEDIUM);
    }

    const patterns = this.patternEngine.detectPatterns({ votes, proposal });
    patterns.forEach(match => {
      if (match.confidence > 0.6) {
        findings.push({
          type: 'manipulation_pattern',
          severity: match.pattern.severity,
          description: match.pattern.description,
          evidence: Array.isArray(match.matches) ? match.matches : [match.matches],
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
      metadata: { proposalId: proposal.id, userId: proposal.userId }
    };
  }

  async analyzeVault(vaultId: string, transactions: any[]): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

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

  async analyzeTreasuryHealth(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    const since = subDays(new Date(), this.observationWindow);
    const transactions = await db.select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.daoId, daoId),
        gte(walletTransactions.createdAt, since)
      ))
      .orderBy(desc(walletTransactions.createdAt));

    const anomalies = this.detectTransactionAnomalies(transactions);

    for (const anomaly of anomalies) {
      findings.push({
        type: 'transaction_anomaly',
        severity: anomaly.severity,
        description: anomaly.description,
        evidence: anomaly.evidence,
        confidence: 0.8
      });

      if (anomaly.severity > maxThreatLevel) {
        maxThreatLevel = anomaly.severity;
      }
    }

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
          confidence: 0.85
        });
        maxThreatLevel = ThreatLevel.HIGH;
        recommendations.push('Review recent large withdrawals for authorization');
      }
    }

    const vaultHealth = await this.analyzeVaultHealth(daoId);
    if (vaultHealth.threatLevel > ThreatLevel.LOW) {
      findings.push({
        type: 'vault_health',
        severity: vaultHealth.threatLevel,
        description: vaultHealth.description,
        evidence: vaultHealth.data,
        confidence: 0.9
      });

      if (vaultHealth.threatLevel > maxThreatLevel) {
        maxThreatLevel = vaultHealth.threatLevel;
      }
      recommendations.push(...vaultHealth.recommendations);
    }

    return {
      id: `RPT-${Date.now()}-${daoId}`,
      type: AnalysisType.TRANSACTION,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      metadata: { daoId, affectedEntities: [daoId] }
    };
  }

  async analyzeGovernance(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

    const since = subDays(new Date(), this.observationWindow);

    const recentProposals = await db.select()
      .from(proposals)
      .where(and(
        eq(proposals.daoId, daoId),
        gte(proposals.createdAt, since)
      ));

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
          evidence: Array.isArray(votingAnomalies) ? votingAnomalies : [votingAnomalies],
          confidence: 0.8
        });
        maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, ThreatLevel.HIGH);
        recommendations.push(`Review voting patterns for proposal: ${proposal.title}`);
      }
    }

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
        evidence: Array.isArray(spammers) ? spammers : [spammers],
        confidence: 0.75
      });
      maxThreatLevel = this.getHigherThreatLevel(maxThreatLevel, ThreatLevel.MEDIUM);
      recommendations.push('Consider implementing proposal rate limits');
    }

    return {
      id: `RPT-GOV-${Date.now()}-${daoId}`,
      type: AnalysisType.PROPOSAL,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      metadata: { daoId, affectedEntities: [daoId], userIds: Object.keys(proposalsByUser) }
    };
  }

  async profileNode(userId: string, daoId?: string): Promise<NodeProfile> {
    const metrics: Record<string, number> = {};
    let anomalyCount = 0;

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

    const suspiciousTx = userTransactions.filter(tx => {
      const amount = parseFloat(tx.amount || '0');
      return amount > 10000 || tx.status === 'failed';
    });

    anomalyCount += suspiciousTx.length;

    const userVotes = await db.select()
      .from(votes)
      .where(and(
        eq(votes.userId, userId),
        daoId ? eq(votes.daoId, daoId) : sql`1=1`
      ));

    metrics.voteCount = userVotes.length;

    let trustScore = 100;
    trustScore -= (anomalyCount * 10);
    if (metrics.transactionCount > 10) trustScore += 5;
    if (metrics.voteCount > 5) trustScore += 5;
    trustScore = Math.max(0, Math.min(100, trustScore));

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

  async detectFraud(daoId: string): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

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
          evidence: [profile],
          confidence: 0.85
        });
        maxThreatLevel = ThreatLevel.HIGH;
        recommendations.push(`Review member activity: ${member.userId}`);
      }
    }

    return {
      id: `RPT-FRAUD-${Date.now()}-${daoId}`,
      type: AnalysisType.USER_BEHAVIOR,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      metadata: { daoId, affectedEntities: [daoId], userIds: members.map(m => m.userId) }
    };
  }

  async monitorSystemHealth(): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    let maxThreatLevel = ThreatLevel.MINIMAL;

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
        confidence: 0.9
      });
      maxThreatLevel = ThreatLevel.MEDIUM;
      recommendations.push('Investigate system errors and performance issues');
    }

    return {
      id: `RPT-SYS-${Date.now()}`,
      type: AnalysisType.PATTERN,
      timestamp: new Date(),
      threatLevel: maxThreatLevel,
      confidence: this.calculateConfidence(findings),
      findings,
      recommendations,
      metadata: { affectedEntities: ['system'] }
    };
  }

  // === Private Helper Methods ===

  private async analyze(data: any): Promise<AnalysisResult> {
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

  private calculateConfidence(findings: any[]): number {
    if (findings.length === 0) return 1.0;
    return 0.85;
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

    if (votes.length > 0) {
      const voteTimes = votes.map(v => new Date(v.createdAt).getTime());
      const timeSpread = Math.max(...voteTimes) - Math.min(...voteTimes);

      if (votes.length > 10 && timeSpread < 60000) {
        anomalies.push({
          type: 'rapid_voting',
          description: 'Suspicious rapid voting pattern detected'
        });
      }
    }

    return anomalies;
  }
}

export const analyzerAgent = new AnalyzerAgent();