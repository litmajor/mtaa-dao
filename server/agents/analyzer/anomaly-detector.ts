
/**
 * Anomaly Detector
 * Uses statistical methods to detect unusual behavior
 */

import { AnomalyDetectionResult } from './types';

export class AnomalyDetector {
  private historicalData: Map<string, number[]>;

  constructor() {
    this.historicalData = new Map();
  }

  detectAnomaly(value: number, category: string, context?: any): AnomalyDetectionResult {
    const history = this.historicalData.get(category) || [];
    
    if (history.length < 10) {
      // Not enough data for statistical analysis
      history.push(value);
      this.historicalData.set(category, history);
      return {
        isAnomaly: false,
        score: 0,
        reasons: ['Insufficient historical data'],
        context: context || {}
      };
    }

    const stats = this.calculateStatistics(history);
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);
    const isAnomaly = zScore > 2.5; // 2.5 standard deviations

    const reasons: string[] = [];
    if (isAnomaly) {
      if (value > stats.mean) {
        reasons.push(`Value is ${zScore.toFixed(2)} standard deviations above average`);
      } else {
        reasons.push(`Value is ${zScore.toFixed(2)} standard deviations below average`);
      }
    }

    // Update historical data
    history.push(value);
    if (history.length > 100) history.shift();
    this.historicalData.set(category, history);

    return {
      isAnomaly,
      score: Math.min(zScore / 5, 1), // Normalize to 0-1
      reasons,
      context: {
        value,
        mean: stats.mean,
        stdDev: stats.stdDev,
        zScore,
        ...context
      }
    };
  }

  private calculateStatistics(data: number[]): { mean: number; stdDev: number } {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    return { mean, stdDev };
  }

  detectTransactionAnomaly(transaction: any): AnomalyDetectionResult {
    const amount = parseFloat(transaction.amount);
    return this.detectAnomaly(amount, `transaction_${transaction.type}`, {
      transactionId: transaction.id,
      type: transaction.type
    });
  }

  detectVotingAnomaly(votes: any[]): AnomalyDetectionResult {
    const voteCount = votes.length;
    return this.detectAnomaly(voteCount, 'voting_activity', {
      proposalId: votes[0]?.proposalId,
      voteCount
    });
  }
}
