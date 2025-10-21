/**
 * KWETU - The Body (Community & Economic Infrastructure)
 * 
 * Purpose: Wraps existing DAO services (treasury, governance, community)
 * with a clean interface for the Morio AI system.
 */

import type { KwetuOperation } from '../../../shared/morio-types';
import { TreasuryService } from './services/treasury_service';
import { GovernanceService } from './services/governance_service';
import { CommunityService } from './services/community_service';

export class KwetuCore {
  private treasuryService: TreasuryService;
  private governanceService: GovernanceService;
  private communityService: CommunityService;

  constructor() {
    this.treasuryService = new TreasuryService();
    this.governanceService = new GovernanceService();
    this.communityService = new CommunityService();
  }

  /**
   * Execute a Kwetu operation
   */
  async execute(operation: KwetuOperation): Promise<any> {
    const { service, method, params } = operation;

    switch (service) {
      case 'treasury':
        return await this.executeTreasuryOperation(method, params);
      case 'governance':
        return await this.executeGovernanceOperation(method, params);
      case 'community':
        return await this.executeCommunityOperation(method, params);
      default:
        throw new Error(`Unknown Kwetu service: ${service}`);
    }
  }

  private async executeTreasuryOperation(method: string, params: Record<string, any>) {
    switch (method) {
      case 'getBalance':
        return await this.treasuryService.getBalance(params.daoId);
      case 'getTransactions':
        return await this.treasuryService.getTransactions(params.daoId, params.limit);
      case 'getTreasuryMetrics':
        return await this.treasuryService.getMetrics(params.daoId);
      default:
        throw new Error(`Unknown treasury method: ${method}`);
    }
  }

  private async executeGovernanceOperation(method: string, params: Record<string, any>) {
    switch (method) {
      case 'getProposals':
        return await this.governanceService.getProposals(params.daoId, params.status);
      case 'getProposalById':
        return await this.governanceService.getProposalById(params.proposalId);
      case 'getVotingPower':
        return await this.governanceService.getVotingPower(params.userId, params.daoId);
      default:
        throw new Error(`Unknown governance method: ${method}`);
    }
  }

  private async executeCommunityOperation(method: string, params: Record<string, any>) {
    switch (method) {
      case 'getMemberCount':
        return await this.communityService.getMemberCount(params.daoId);
      case 'getMemberStats':
        return await this.communityService.getMemberStats(params.userId, params.daoId);
      case 'getEngagementMetrics':
        return await this.communityService.getEngagementMetrics(params.daoId);
      default:
        throw new Error(`Unknown community method: ${method}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: 'healthy',
      services: {
        treasury: 'active',
        governance: 'active',
        community: 'active'
      },
      timestamp: new Date().toISOString()
    };
  }
}

export const kwetu = new KwetuCore();
export * from './services/treasury_service';
export * from './services/governance_service';
export * from './services/community_service';
