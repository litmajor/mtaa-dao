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
import { TreasuryExecutionRouter, TreasuryOperationExecutor, TreasuryHealthMonitor } from './execution_bridge';
import { AgentCommunicator } from '../agent-framework/agent-communicator';
import { MessageType } from '../agent-framework/message-bus';

export class KwetuCore {
  private treasuryService: TreasuryService;
  private governanceService: GovernanceService;
  private communityService: CommunityService;
  private executionRouter: TreasuryExecutionRouter;
  private operationExecutor: TreasuryOperationExecutor;
  private healthMonitor: TreasuryHealthMonitor;
  private communicator: AgentCommunicator;

  constructor() {
    this.treasuryService = new TreasuryService();
    this.governanceService = new GovernanceService();
    this.communityService = new CommunityService();
    this.executionRouter = new TreasuryExecutionRouter();
    this.operationExecutor = new TreasuryOperationExecutor();
    this.healthMonitor = new TreasuryHealthMonitor();
    this.communicator = new AgentCommunicator('KWETU');
    
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.ACTION_REQUIRED,
      MessageType.HEALTH_CHECK,
      MessageType.EXECUTION_REQUEST
    ], this.handleMessage.bind(this));
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.ACTION_REQUIRED:
          const result = await this.execute(message.payload);
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, result);
          }
          break;
        case MessageType.HEALTH_CHECK:
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, await this.healthCheck());
          }
          break;
        case MessageType.EXECUTION_REQUEST:
          const executionResult = await this.handleExecutionRequest(message.payload);
          if (message.requiresResponse && message.correlationId) {
            await this.communicator.respond(message.correlationId, executionResult);
          }
          break;
      }
    } catch (error) {
      console.error('KWETU error handling message:', error);
    }
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
      case 'execution':
        return await this.executeExecutionOperation(method, params);
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

  private async executeExecutionOperation(method: string, params: Record<string, any>) {
    switch (method) {
      case 'planExecution':
        return await this.planExecution(params.context);
      case 'executeOperation':
        return await this.executeOperation(params.plan);
      case 'monitorExecution':
        return await this.monitorExecution(params.transactionId, params.expectedOutput, params.tolerancePercent);
      case 'analyzeHealth':
        return await this.analyzeHealth(params.assets, params.riskProfile);
      default:
        throw new Error(`Unknown execution method: ${method}`);
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

  /**
   * Handle execution request from MORIO
   */
  private async handleExecutionRequest(payload: any): Promise<any> {
    const { requestType, context } = payload;

    switch (requestType) {
      case 'planExecution':
        return await this.planExecution(context);
      case 'executeOperation':
        return await this.executeOperation(context.plan);
      case 'monitorExecution':
        return await this.monitorExecution(context.transactionId, context.expectedOutput, context.tolerance);
      case 'analyzeHealth':
        return await this.analyzeHealth(context.assets, context.riskProfile);
      default:
        throw new Error(`Unknown execution request type: ${requestType}`);
    }
  }

  /**
   * Plan optimal execution for a treasury operation
   */
  async planExecution(context: any): Promise<any> {
    try {
      return await this.executionRouter.planExecution(context);
    } catch (error) {
      console.error('Error planning execution:', error);
      return {
        status: 'rejected',
        reason: `Execution planning failed: ${(error as Error).message}`,
        error: true
      };
    }
  }

  /**
   * Execute an approved operation plan
   */
  async executeOperation(plan: any): Promise<any> {
    try {
      return await this.operationExecutor.executeOperation(plan);
    } catch (error) {
      console.error('Error executing operation:', error);
      return {
        success: false,
        error: (error as Error).message,
        transactionId: null
      };
    }
  }

  /**
   * Monitor execution of a transaction
   */
  async monitorExecution(transactionId: string, expectedOutput: string, tolerancePercent?: number): Promise<any> {
    try {
      return await this.operationExecutor.monitorExecution(transactionId, expectedOutput, tolerancePercent);
    } catch (error) {
      console.error('Error monitoring execution:', error);
      return {
        status: 'error',
        message: (error as Error).message,
        transaction_id: transactionId
      };
    }
  }

  /**
   * Analyze treasury health and risk posture
   */
  async analyzeHealth(assets: any[], riskProfile: string): Promise<any> {
    try {
      return await this.healthMonitor.analyzeTreasuryHealth(assets, riskProfile);
    } catch (error) {
      console.error('Error analyzing treasury health:', error);
      return {
        healthScore: 0,
        status: 'error',
        message: (error as Error).message
      };
    }
  }

  /**
   * NEW: Analyze treasury composition using Symbol Universe
   * Returns portfolio breakdown by category and risk metrics
   */
  async analyzeComposition(symbols: string[]): Promise<any> {
    try {
      // Import symbolUniverse for category analysis
      const { symbolUniverse } = await import('../symbol_universe');
      
      const composition = symbolUniverse.analyzeCategoryComposition(symbols);
      
      // Calculate aggregate metrics
      const totalRisk = composition.reduce(
        (sum, cat) => sum + (cat.avgRisk * cat.count),
        0
      ) / (symbols.length || 1);
      
      const highRiskCount = composition.filter(
        c => symbolUniverse.isHighRiskCategory(c.category)
      ).length;
      
      const safeCount = composition.filter(
        c => symbolUniverse.isSafeCategory(c.category)
      ).length;
      
      return {
        composition,
        aggregateMetrics: {
          totalAssets: symbols.length,
          avgRisk: Math.round(totalRisk),
          safeAssets: safeCount,
          highRiskAssets: highRiskCount,
          riskProfile: totalRisk > 50 ? 'aggressive' : totalRisk > 35 ? 'moderate' : 'conservative',
        },
        canExecute: totalRisk <= 70, // Max allowed risk for execution
      };
    } catch (error) {
      console.error('Error analyzing composition:', error);
      return {
        composition: [],
        aggregateMetrics: { totalAssets: 0, avgRisk: 0, safeAssets: 0, highRiskAssets: 0 },
        canExecute: false,
      };
    }
  }

  /**
   * NEW: Score execution risk based on token category
   * Used to validate if an execution meets risk thresholds
   */
  async scoreExecutionRisk(symbol: string, amount: number): Promise<{
    categoricalRisk: number;
    riskLevel: string;
    multiplier: number;
    recommendation: string;
  }> {
    try {
      const { symbolUniverse } = await import('../symbol_universe');
      const asset = symbolUniverse.getAsset(symbol);
      
      if (!asset) {
        return {
          categoricalRisk: 60,
          riskLevel: 'unknown',
          multiplier: 1.6,
          recommendation: `Symbol ${symbol} not found in registry. Treat as high-risk.`,
        };
      }
      
      const categoryRisk = symbolUniverse.getCategoryRiskScore(asset.category);
      const multiplier = symbolUniverse.getCategoryRiskMultiplier(asset.category);
      
      let riskLevel: string;
      if (categoryRisk < 20) riskLevel = 'low';
      else if (categoryRisk < 40) riskLevel = 'moderate';
      else if (categoryRisk < 60) riskLevel = 'high';
      else riskLevel = 'critical';
      
      let recommendation = `${symbol} is ${riskLevel} risk (${categoryRisk}/100). `;
      if (symbolUniverse.isSafeCategory(asset.category)) {
        recommendation += 'Safe for treasury operations.';
      } else if (symbolUniverse.isHighRiskCategory(asset.category)) {
        recommendation += 'Recommend limiting exposure to <5% of treasury.';
      }
      
      return {
        categoricalRisk: categoryRisk,
        riskLevel,
        multiplier,
        recommendation,
      };
    } catch (error) {
      console.error(`Error scoring execution risk for ${symbol}:`, error);
      return {
        categoricalRisk: 60,
        riskLevel: 'error',
        multiplier: 1.6,
        recommendation: 'Unable to assess risk. Treat as high-risk.',
      };
    }
  }

  /**
   * NEW: Get execution recommendations based on symbol universe
   * Suggests safer alternatives if current asset is too risky
   */
  async getExecutionRecommendations(symbol: string): Promise<{
    current: any;
    alternatives: any[];
    recommendation: string;
  }> {
    try {
      const { symbolUniverse } = await import('../symbol_universe');
      const asset = symbolUniverse.getAsset(symbol);
      
      if (!asset) {
        return {
          current: { symbol, found: false },
          alternatives: [],
          recommendation: `${symbol} not recognized. Suggest manual verification before execution.`,
        };
      }
      
      let alternatives: any[] = [];
      let recommendation = `Execute ${symbol} at nominal risk.`;
      
      // If high risk, suggest alternatives in same category or safer category
      if (symbolUniverse.isHighRiskCategory(asset.category)) {
        alternatives = symbolUniverse.findSaferAlternativesInCategory(symbol, asset.category);
        recommendation = `${symbol} is high-risk (${asset.category}). Consider these safer alternatives instead: ${alternatives.slice(0, 3).map(a => a.symbol).join(', ')}`;
      }
      
      return {
        current: {
          symbol,
          category: asset.category,
          tier: asset.tier,
          riskScore: symbolUniverse.getCategoryRiskScore(asset.category),
        },
        alternatives: alternatives.slice(0, 3).map(alt => ({
          symbol: alt.symbol,
          category: alt.category,
          tier: alt.tier,
          riskScore: symbolUniverse.getCategoryRiskScore(alt.category),
        })),
        recommendation,
      };
    } catch (error) {
      console.error(`Error getting recommendations for ${symbol}:`, error);
      return {
        current: { symbol },
        alternatives: [],
        recommendation: 'Unable to get recommendations.',
      };
    }
  }
}

export const kwetu = new KwetuCore();
export * from './services/treasury_service';
export * from './services/governance_service';
export * from './services/community_service';
