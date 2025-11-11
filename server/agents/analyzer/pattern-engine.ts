
/**
 * Pattern Detection Engine
 * Detects suspicious patterns in transactions, proposals, and user behavior
 */

import { ThreatPattern, ThreatLevel, PatternMatch } from './types';

export class PatternEngine {
  private patterns: Map<string, ThreatPattern>;

  constructor() {
    this.patterns = new Map();
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Fraud patterns
    this.addPattern({
      id: 'rapid-withdrawal',
      name: 'Rapid Withdrawal Pattern',
      description: 'Multiple large withdrawals in short time period',
      severity: ThreatLevel.HIGH,
      indicators: ['high_frequency', 'large_amounts', 'new_account'],
      confidence: 0.85
    });

    this.addPattern({
      id: 'sybil-attack',
      name: 'Sybil Attack',
      description: 'Multiple accounts controlled by same entity',
      severity: ThreatLevel.CRITICAL,
      indicators: ['similar_behavior', 'linked_wallets', 'coordinated_voting'],
      confidence: 0.75
    });

    this.addPattern({
      id: 'vote-buying',
      name: 'Vote Buying',
      description: 'Suspicious voting patterns suggesting vote manipulation',
      severity: ThreatLevel.HIGH,
      indicators: ['unusual_voting', 'financial_correlation', 'timing_anomaly'],
      confidence: 0.70
    });

    this.addPattern({
      id: 'treasury-drain',
      name: 'Treasury Drain Attempt',
      description: 'Coordinated proposals to drain treasury',
      severity: ThreatLevel.CRITICAL,
      indicators: ['multiple_proposals', 'high_amounts', 'rushed_voting'],
      confidence: 0.80
    });
  }

  addPattern(pattern: ThreatPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  detectPatterns(data: any): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const [id, pattern] of this.patterns) {
      const match = this.matchPattern(pattern, data);
      if (match.confidence > 0.5) {
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  private matchPattern(pattern: ThreatPattern, data: any): PatternMatch {
    const matches: any[] = [];
    let confidence = 0;

    // Pattern matching logic
    if (pattern.id === 'rapid-withdrawal' && data.transactions) {
      const recentWithdrawals = data.transactions.filter(
        (tx: any) => tx.type === 'withdrawal' && 
        new Date(tx.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

      if (recentWithdrawals.length > 5) {
        matches.push(...recentWithdrawals);
        confidence = Math.min(0.95, 0.5 + (recentWithdrawals.length * 0.1));
      }
    }

    if (pattern.id === 'sybil-attack' && data.votes) {
      // Detect coordinated voting
      const votingPatterns = this.analyzeVotingPatterns(data.votes);
      if (votingPatterns.suspiciousCorrelation > 0.7) {
        matches.push(votingPatterns);
        confidence = votingPatterns.suspiciousCorrelation;
      }
    }

    return {
      pattern,
      confidence,
      matches
    };
  }

  private analyzeVotingPatterns(votes: any[]): any {
    // Simplified voting pattern analysis
    const timing: number[] = [];
    const amounts: number[] = [];

    votes.forEach(vote => {
      timing.push(new Date(vote.createdAt).getTime());
      if (vote.tokenAmount) amounts.push(vote.tokenAmount);
    });

    const timingVariance = this.calculateVariance(timing);
    const suspiciousCorrelation = timingVariance < 1000 ? 0.8 : 0.3;

    return { suspiciousCorrelation, timing, amounts };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
}
