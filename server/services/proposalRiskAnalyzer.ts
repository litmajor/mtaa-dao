import { db } from '../db';
import { v4 as uuid } from 'uuid';
import { sql } from 'drizzle-orm';

export interface RiskAnalysisResult {
  score: number; // 0-100
  category: 'LOW' | 'MEDIUM' | 'HIGH';
  breakdown: {
    amountRisk: number;
    frequencyRisk: number;
    typeRisk: number;
    volatilityRisk: number;
    historicalRisk: number;
  };
  reasoning: string;
}

export class ProposalRiskAnalyzer {
  /**
   * Analyze risk of a proposed action
   */
  async analyzeRisk(
    agentId: string,
    actionType: string,
    proposedArgs: Record<string, any>,
    treasuryBalance: number
  ): Promise<RiskAnalysisResult> {
    let totalScore = 0;
    const breakdown = {
      amountRisk: 0,
      frequencyRisk: 0,
      typeRisk: 0,
      volatilityRisk: 0,
      historicalRisk: 0,
    };

    // 1. Amount Risk (0-30 points)
    const amountRisk = this.analyzeAmountRisk(proposedArgs.amount || proposedArgs.amountIn, treasuryBalance);
    breakdown.amountRisk = amountRisk;
    totalScore += amountRisk;

    // 2. Frequency Risk (0-20 points)
    const frequencyRisk = await this.analyzeFrequencyRisk(agentId);
    breakdown.frequencyRisk = frequencyRisk;
    totalScore += frequencyRisk;

    // 3. Action Type Risk (0-25 points)
    const typeRisk = this.analyzeTypeRisk(actionType);
    breakdown.typeRisk = typeRisk;
    totalScore += typeRisk;

    // 4. Volatility Risk (0-15 points)
    const volatilityRisk = await this.analyzeVolatilityRisk(proposedArgs);
    breakdown.volatilityRisk = volatilityRisk;
    totalScore += volatilityRisk;

    // 5. Historical Risk (0-10 points)
    const historicalRisk = await this.analyzeHistoricalRisk(agentId, actionType);
    breakdown.historicalRisk = historicalRisk;
    totalScore += historicalRisk;

    // Cap score at 100
    totalScore = Math.min(totalScore, 100);

    // Determine category
    let category: 'LOW' | 'MEDIUM' | 'HIGH';
    if (totalScore <= 33) {
      category = 'LOW';
    } else if (totalScore <= 66) {
      category = 'MEDIUM';
    } else {
      category = 'HIGH';
    }

    return {
      score: totalScore,
      category,
      breakdown,
      reasoning: this.generateReasoning(totalScore, breakdown, actionType, proposedArgs),
    };
  }

  /**
   * Analyze risk based on amount being transferred
   * > 10% of treasury = high risk
   * 5-10% = medium risk
   * < 5% = low risk
   */
  private analyzeAmountRisk(amount: number, treasuryBalance: number): number {
    if (!amount || !treasuryBalance) return 0;

    const percentage = (amount / treasuryBalance) * 100;

    if (percentage > 10) {
      return 30; // Max risk
    } else if (percentage > 5) {
      return 20; // Medium risk
    } else if (percentage > 2) {
      return 10; // Low-medium risk
    } else {
      return 0; // Minimal risk
    }
  }

  /**
   * Analyze frequency of actions in last hour
   * Multiple actions in short time = higher risk
   */
  private async analyzeFrequencyRisk(agentId: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM agent_proposals
        WHERE agent_id = ${agentId}
          AND created_at >= ${oneHourAgo}
          AND status = 'APPROVED'
      `);

      const count = parseInt((result.rows?.[0]?.count as any) || '0', 10);

      if (count > 5) {
        return 20; // Max frequency risk
      } else if (count > 3) {
        return 15;
      } else if (count > 1) {
        return 10;
      } else {
        return 0;
      }
    } catch (error) {
      // If table doesn't exist yet, return 0
      return 0;
    }
  }

  /**
   * Analyze risk based on action type
   * BRIDGE (untested) = highest risk
   * SWAP = medium risk
   * CLAIM = low risk
   */
  private analyzeTypeRisk(actionType: string): number {
    const typeRisks: Record<string, number> = {
      BRIDGE: 25,
      LIQUIDATE: 20,
      SWAP: 15,
      DEPOSIT: 10,
      WITHDRAW: 10,
      REBALANCE: 15,
      CLAIM: 0,
      STAKE: 10,
      UNSTAKE: 10,
    };

    return typeRisks[actionType] || 15; // Default medium risk for unknown types
  }

  /**
   * Analyze volatility/slippage risk
   * High slippage = sign that market is volatile
   */
  private async analyzeVolatilityRisk(proposedArgs: Record<string, any>): Promise<number> {
    if (!proposedArgs.slippage && !proposedArgs.minAmountOut) {
      return 10; // Unknown slippage = some risk
    }

    const slippage = proposedArgs.slippage ?? 0.05; // Default 5%

    if (slippage > 0.05) {
      return 15; // High slippage = high volatility
    } else if (slippage > 0.02) {
      return 10;
    } else {
      return 0;
    }
  }

  /**
   * Analyze historical failures or issues
   */
  private async analyzeHistoricalRisk(agentId: string, actionType: string): Promise<number> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM agent_proposals
        WHERE agent_id = ${agentId}
          AND action_type = ${actionType}
          AND created_at >= ${oneWeekAgo}
          AND status = 'REJECTED'
      `);

      const failureCount = parseInt((result.rows?.[0]?.count as any) || '0', 10);

      if (failureCount > 3) {
        return 10; // Multiple failures suggest issue with this action
      } else if (failureCount > 0) {
        return 5;
      } else {
        return 0;
      }
    } catch (error) {
      // If table doesn't exist yet, return 0
      return 0;
    }
  }

  /**
   * Generate human-readable explanation of risk score
   */
  private generateReasoning(
    score: number,
    breakdown: Record<string, number>,
    actionType: string,
    proposedArgs: Record<string, any>
  ): string {
    const parts: string[] = [];

    if (breakdown.amountRisk > 0) {
      parts.push(`Large amount at risk (${breakdown.amountRisk} points)`);
    }
    if (breakdown.frequencyRisk > 0) {
      parts.push(`Multiple recent actions (${breakdown.frequencyRisk} points)`);
    }
    if (breakdown.typeRisk > 0) {
      const typeInfo = actionType === 'BRIDGE' ? 'bridge to untested chain' : `${actionType} action`;
      parts.push(`${typeInfo} (${breakdown.typeRisk} points)`);
    }
    if (breakdown.volatilityRisk > 0) {
      parts.push(`Volatile market conditions (${breakdown.volatilityRisk} points)`);
    }
    if (breakdown.historicalRisk > 0) {
      parts.push(`Similar proposal failed recently (${breakdown.historicalRisk} points)`);
    }

    if (parts.length === 0) {
      return 'All risk factors are low. Safe to auto-execute.';
    }

    return `Risk factors: ${parts.join(', ')}`;
  }
}

export default new ProposalRiskAnalyzer();
