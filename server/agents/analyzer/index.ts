
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
