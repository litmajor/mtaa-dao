/**
 * Vault Service - Governance Module
 * 
 * Handles governance proposals, risk assessments, and DAOs
 */

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  vaultRiskAssessments,
  proposals,
  type Vault
} from '../../../shared/schema';
import { Logger } from "../../utils/logger";
import { getErrorMessage } from '../../utils/errorUtils';
import { AppError, ValidationError } from "../../middleware/errorHandler";
import { vaultHelperService } from './vault-helpers';

/**
 * VaultGovernanceService - Handles governance and risk management
 */
export class VaultGovernanceService {
  /**
   * Get governance proposals related to a vault
   */
  async getVaultGovernanceProposals(vaultId: string, userId?: string): Promise<any[]> {
    try {
      if (userId) {
        const hasPermission = await vaultHelperService.checkVaultPermissions(vaultId, userId, 'view');
        if (!hasPermission) {
          throw new AppError('Unauthorized: You do not have permission to view governance proposals for this vault', 403);
        }
      }

      // Get real proposals from database
      const proposalRows = await db.query.proposals.findMany({
        where: sql`${proposals.metadata}->>'vaultId' = ${vaultId}`,
        orderBy: [desc(proposals.createdAt)],
        limit: 10
      });

      return proposalRows.map(p => ({
        id: p.id,
        vaultId: vaultId,
        title: p.title,
        description: p.description,
        status: p.status,
        votesFor: parseInt(String(p.yesVotes || '0')),
        votesAgainst: parseInt(String(p.noVotes || '0')),
        quorumReached: (parseInt(String(p.yesVotes || '0')) + parseInt(String(p.noVotes || '0'))) >= parseInt(String((p as any).quorum || '100')),
        createdAt: p.createdAt?.toISOString(),
        endsAt: (p as any).votingDeadline?.toISOString()
      }));
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to get governance proposals for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Perform comprehensive risk assessment for a vault
   */
  async performRiskAssessment(vaultId: string): Promise<void> {
    try {
      const vault = await vaultHelperService.getVaultById(vaultId);
      if (!vault) {
        throw new ValidationError(`Vault ${vaultId} not found`);
      }

      // Get vault holdings for calculation
      const holdings = await vaultHelperService.getVaultHoldings(vaultId);
      const totalValueUSD = holdings.reduce((sum, h) => sum + parseFloat(h.valueUSD || '0'), 0);

      // Calculate risk scores
      const { liquidityRisk, smartContractRisk, marketRisk, concentrationRisk, protocolRisk } =
        this.calculateRiskScores(vault, holdings, totalValueUSD);

      const overallRiskScore = this.calculateOverallRiskScore(
        liquidityRisk,
        smartContractRisk,
        marketRisk,
        concentrationRisk,
        protocolRisk
      );

      // Generate risk factors and recommendations
      const riskFactors = this.identifyRiskFactors(vault, holdings, totalValueUSD);
      const recommendations = this.generateRecommendations(vault, riskFactors);

      // Save risk assessment to database
      await db.insert(vaultRiskAssessments).values({
        vaultId: vaultId,
        overallRiskScore,
        liquidityRisk,
        smartContractRisk,
        marketRisk,
        concentrationRisk,
        protocolRisk,
        riskFactors: JSON.stringify(riskFactors),
        recommendations: JSON.stringify(recommendations),
        nextAssessmentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assessedBy: vault.userId || vault.daoId || 'system'
      });

      Logger.getLogger().info(`Risk assessment completed for vault ${vaultId}, score: ${overallRiskScore}`);
    } catch (error) {
      const msg = getErrorMessage(error);
      Logger.getLogger().error(`Failed to perform risk assessment for vault ${vaultId}: ${msg}`, error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(msg, 500);
    }
  }

  /**
   * Calculate individual risk score components
   */
  private calculateRiskScores(vault: Vault, holdings: any[], totalValueUSD: number): {
    liquidityRisk: number;
    smartContractRisk: number;
    marketRisk: number;
    concentrationRisk: number;
    protocolRisk: number;
  } {
    // Liquidity Risk (0-30 points)
    // Lower for stablecoins, higher for illiquid tokens
    let liquidityRisk = 10;
    const stableCount = holdings.filter(h => ['cUSD', 'USDT', 'USDC', 'cEUR'].includes(h.tokenSymbol)).length;
    liquidityRisk += (holdings.length - stableCount) * 5;
    liquidityRisk = Math.min(liquidityRisk, 30);

    // Smart Contract Risk (0-25 points)
    // Based on vault type and strategy
    let smartContractRisk = 5;
    if (vault.yieldStrategy) {
      smartContractRisk += 10; // Strategy contract risk
    }
    if (vault.daoId) {
      smartContractRisk += 5; // Multi-signature overhead
    }
    smartContractRisk = Math.min(smartContractRisk, 25);

    // Market Risk (0-25 points)
    // Higher for volatile assets
    let marketRisk = 5;
    const volatileCount = holdings.filter(h => !['cUSD', 'USDT', 'USDC', 'cEUR'].includes(h.tokenSymbol)).length;
    marketRisk += volatileCount * 4;
    marketRisk = Math.min(marketRisk, 25);

    // Concentration Risk (0-15 points)
    // Based on how concentrated holdings are
    let concentrationRisk = 0;
    if (holdings.length === 1) {
      concentrationRisk = 15; // All in one token
    } else if (holdings.length === 2) {
      concentrationRisk = 10;
    } else if (holdings.length === 3) {
      concentrationRisk = 5;
    }

    // Protocol Risk (0-10 points)
    // Based on DAO tier or vault type
    let protocolRisk = 2;
    if (vault.vaultType === 'dao_treasury') {
      protocolRisk = 5;
    } else if (vault.vaultType === 'locked_savings') {
      protocolRisk = 3;
    }

    return {
      liquidityRisk,
      smartContractRisk,
      marketRisk,
      concentrationRisk,
      protocolRisk
    };
  }

  /**
   * Calculate overall risk score from components
   */
  private calculateOverallRiskScore(
    liquidityRisk: number,
    smartContractRisk: number,
    marketRisk: number,
    concentrationRisk: number,
    protocolRisk: number
  ): number {
    // Weighted average (total max = 100)
    const weights = {
      liquidity: 0.25,
      smartContract: 0.25,
      market: 0.25,
      concentration: 0.15,
      protocol: 0.10
    };

    const totalMax = 30 + 25 + 25 + 15 + 10; // = 105

    const weighted =
      (liquidityRisk * weights.liquidity) +
      (smartContractRisk * weights.smartContract) +
      (marketRisk * weights.market) +
      (concentrationRisk * weights.concentration) +
      (protocolRisk * weights.protocol);

    // Normalize to 0-100 scale
    return Math.round((weighted / totalMax) * 100);
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(vault: Vault, holdings: any[], totalValueUSD: number): any {
    const factors: any = {};

    // Token concentration
    if (holdings.length === 1) {
      factors.singleToken = true;
    } else if (holdings.length === 2) {
      factors.lowDiversification = true;
    }

    // Stablecoin exposure
    const stableCount = holdings.filter(h => ['cUSD', 'USDT', 'USDC', 'cEUR'].includes(h.tokenSymbol)).length;
    if (stableCount === 0) {
      factors.noStableExposure = true;
    }

    // Vault type specific
    if (vault.vaultType === 'locked_savings' && vault.lockedUntil) {
      const daysLocked = Math.ceil((vault.lockedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLocked > 30) {
        factors.longLockPeriod = true;
      }
    }

    // Value size
    if (totalValueUSD < 100) {
      factors.lowValue = true;
    } else if (totalValueUSD > 100000) {
      factors.highValue = true;
    }

    // Strategy
    if (!vault.yieldStrategy) {
      factors.noYieldStrategy = true;
    }

    return factors;
  }

  /**
   * Generate recommendations based on risk assessment
   */
  private generateRecommendations(vault: Vault, riskFactors: any): string[] {
    const recommendations: string[] = [];

    // General recommendations
    recommendations.push('Monitor vault performance regularly');

    // Based on risk factors
    if (riskFactors.singleToken) {
      recommendations.push('Consider diversifying into additional tokens for better risk management');
    }

    if (riskFactors.lowDiversification) {
      recommendations.push('Add more tokens to improve portfolio diversification');
    }

    if (riskFactors.noStableExposure) {
      recommendations.push('Consider allocating some funds to stablecoins (cUSD/USDT) for stability');
    }

    if (riskFactors.noYieldStrategy) {
      recommendations.push('Enable a yield strategy to earn returns on your holdings');
    }

    if (riskFactors.longLockPeriod) {
      recommendations.push('Vault is locked - consider when lock period expires for withdrawal planning');
    }

    if (riskFactors.lowValue) {
      recommendations.push('Build vault value with additional deposits to improve risk metrics');
    }

    if (riskFactors.highValue) {
      recommendations.push('Consider allocating across multiple vaults to manage risk');
    }

    // DAO-specific recommendations
    if (vault.daoId) {
      recommendations.push('Review DAO governance settings and member roles quarterly');
      recommendations.push('Ensure multi-signature approvers are secure and accessible');
    }

    // Add quarterly review reminder
    recommendations.push('Review risk level quarterly and adjust allocations as needed');

    return recommendations;
  }
}

// Export singleton instance
export const vaultGovernanceService = new VaultGovernanceService();
