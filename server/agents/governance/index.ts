/**
 * GOVERNANCE ANALYTICS AGENT
 * DAO health insights and governance analytics
 * 
 * Features:
 * - Real-time DAO health monitoring
 * - Governance proposal analysis
 * - Voting participation tracking
 * - Treasury management oversight
 * - Member engagement metrics
 * - Risk assessment for proposals
 */

import { BaseAgent, AgentConfig, AgentStatus } from '../framework/base-agent';
import { Logger } from '../../utils/logger';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { cacheManager } from '../../core/consolidation/DataCacheConsolidation';
import { AgentCommunicator } from '../../core/agent-framework/agent-communicator';
import { MessageType } from '../../core/agent-framework/message-bus';

const logger = new Logger('governance-analytics-agent');

export enum ProposalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PASSED = 'passed',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  CANCELLED = 'cancelled'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DAOMember {
  address: string;
  joinedAt: Date;
  shares: string; // Voting power
  delegatedShares: string;
  contributionScore: number;
  activityLastSeen: Date;
  proposalsCreated: number;
  proposalsVotedOn: number;
  trustScore: number; // 0-100
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  createdAt: Date;
  votingStartsAt: Date;
  votingEndsAt: Date;
  status: ProposalStatus;
  
  // Voting data
  votesFor: string; // Total shares voting yes
  votesAgainst: string;
  votesAbstain: string;
  participationRate: number; // percentage
  quorumMet: boolean;
  
  // Details
  proposalType: 'technical' | 'parameter' | 'treasury' | 'social';
  budget?: {
    amount: string;
    currency: string;
    recipient: string;
  };
  
  // Analysis
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  riskFactors: string[];
  estimatedImpact: {
    technical: number;
    financial: number;
    social: number;
  };
}

export interface DAOHealthMetrics {
  timestamp: Date;
  governanceHealth: {
    activeMembersCount: number;
    proposalsActive: number;
    averageParticipation: number;
    votingPowerConcentration: number; // Nakamoto coefficient
  };
  treasuryHealth: {
    totalAssets: string;
    unrealizedGains: string;
    liquidityRatio: number;
    runwayMonths: number;
  };
  engagementMetrics: {
    avgMembersPerProposal: number;
    discussionQuality: number; // 0-100
    consensusLevel: number; // 0-100
    delegationRate: number; // percentage
  };
  riskAssessment: {
    systemic: number;
    governance: number;
    financial: number;
    operational: number;
    overall: number;
  };
  recommendations: string[];
}

export interface MemberEngagement {
  memberId: string;
  period: { start: Date; end: Date };
  metrics: {
    proposalsCreated: number;
    votesParticipated: number;
    commentsMade: number;
    consensusReached: number;
    timesOverruled: number;
  };
  engagementScore: number; // 0-100
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
  recommendations: string[];
}

const MIN_QUORUM_PERCENTAGE = 0.1; // 10% participation

export class GovernanceAnalyticsAgent extends BaseAgent {
  private communicator: AgentCommunicator;
  private members: Map<string, DAOMember> = new Map();
  private proposals: GovernanceProposal[] = [];
  private healthSnapshots: DAOHealthMetrics[] = [];
  private engagementHistory: MemberEngagement[] = [];
  private isInitialized: boolean = false;
  private refreshInterval: NodeJS.Timer | null = null;
  private circuitBreaker = circuitBreakerRegistry.getOrCreate('governance-analytics', 'governance', {
    failureThreshold: 15,
    resetTimeout: 120000
  });

  constructor(agentId: string = 'GOVERNANCE-ANALYTICS-001') {
    super({
      id: agentId,
      name: 'GOVERNANCE_ANALYTICS',
      version: '1.0.0',
      capabilities: [
        'proposal_analysis',
        'voting_track',
        'member_engagement',
        'treasury_oversight',
        'risk_assessment',
        'health_monitoring',
        'recommendation_generation'
      ]
    });

    this.communicator = new AgentCommunicator(agentId);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.communicator.subscribe([
      MessageType.PROPOSAL_EVENT,
      MessageType.VOTING_EVENT,
      MessageType.HEALTH_CHECK
    ], this.handleMessage.bind(this));
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.PROPOSAL_EVENT:
          await this.recordProposal(message.payload);
          break;
        case MessageType.VOTING_EVENT:
          await this.recordVote(message.payload);
          break;
        case MessageType.HEALTH_CHECK:
          const metrics = await this.computeDAOHealth();
          await this.communicator.respond(message.correlationId, metrics);
          break;
      }
    } catch (error) {
      logger.error('Message handling error:', error);
      this.circuitBreaker.recordFailure(error);
    }
  }

  /**
   * Initialize governance analytics
   */
  async initialize(): Promise<void> {
    try {
      this.setStatus(AgentStatus.INITIALIZING);
      logger.info(`[${this.config.id}] Initializing Governance Analytics Agent`);

      // Load existing proposals and members
      await this.loadGovernanceData();

      // Register with health system
      healthRegistry.registerAgent(this.config.id, 'GOVERNANCE_ANALYTICS');
      healthRegistry.recordAgentHeartbeat(this.config.id, 10, 'healthy');

      // Start periodic health analysis
      this.startAnalytics();

      this.isInitialized = true;
      this.setStatus(AgentStatus.ACTIVE);
      logger.info(`[${this.config.id}] ✅ Governance Analytics Agent initialized`);
    } catch (error) {
      logger.error(`[${this.config.id}] Failed to initialize:`, error);
      this.setStatus(AgentStatus.ERROR);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    }
  }

  /**
   * Main processing: DAO health analysis
   */
  async process(data: any = {}): Promise<DAOHealthMetrics> {
    const startTime = Date.now();
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Compute DAO health
      const metrics = await this.computeDAOHealth();

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      this.circuitBreaker.recordSuccess();
      healthRegistry.recordAgentHeartbeat(this.config.id, processingTime, 'healthy');

      return metrics;
    } catch (error) {
      logger.error(`[${this.config.id}] Processing error:`, error);
      this.circuitBreaker.recordFailure(error);
      healthRegistry.recordAgentFailure(this.config.id, error as Error);
      throw error;
    }
  }

  /**
   * Compute comprehensive DAO health metrics
   */
  async computeDAOHealth(): Promise<DAOHealthMetrics> {
    const timestamp = new Date();

    // Calculate governance health
    const activeMembers = Array.from(this.members.values()).filter(m =>
      Date.now() - m.activityLastSeen.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
    );

    const activeProposals = this.proposals.filter(p => p.status === ProposalStatus.ACTIVE);
    const avgParticipation = this.calculateAverageParticipation();
    const concentration = this.calculateVotingConcentration();

    // Would calculate from on-chain data in real implementation
    const metrics: DAOHealthMetrics = {
      timestamp,
      governanceHealth: {
        activeMembersCount: activeMembers.length,
        proposalsActive: activeProposals.length,
        averageParticipation: avgParticipation,
        votingPowerConcentration: concentration
      },
      treasuryHealth: {
        totalAssets: '0',
        unrealizedGains: '0',
        liquidityRatio: 0,
        runwayMonths: 0
      },
      engagementMetrics: {
        avgMembersPerProposal: this.calculateAvgMembersPerProposal(),
        discussionQuality: this.calculateDiscussionQuality(),
        consensusLevel: this.calculateConsensusLevel(),
        delegationRate: this.calculateDelegationRate()
      },
      riskAssessment: {
        systemic: this.assessSystemicRisk(),
        governance: this.assessGovernanceRisk(),
        financial: this.assessFinancialRisk(),
        operational: this.assessOperationalRisk(),
        overall: 0
      },
      recommendations: []
    };

    // Calculate overall risk
    const riskValues = [
      metrics.riskAssessment.systemic,
      metrics.riskAssessment.governance,
      metrics.riskAssessment.financial,
      metrics.riskAssessment.operational
    ];
    metrics.riskAssessment.overall = riskValues.reduce((a, b) => a + b) / riskValues.length;

    // Generate recommendations
    metrics.recommendations = this.generateRecommendations(metrics);

    // Cache the metrics
    const cache = cacheManager.getCache('governance_metrics');
    if (cache) {
      await cache.set('dao_health', metrics);
    }

    this.healthSnapshots.push(metrics);

    // Keep only last 30 snapshots
    if (this.healthSnapshots.length > 30) {
      this.healthSnapshots.shift();
    }

    return metrics;
  }

  /**
   * Analyze proposal risks
   */
  analyzeProposalRisk(proposal: GovernanceProposal): {
    riskScore: number;
    riskLevel: RiskLevel;
    riskFactors: string[];
  } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check participation rate
    if (proposal.participationRate < 0.15) {
      riskFactors.push('Low voter participation');
      riskScore += 15;
    }

    // Check voting concentration
    if (proposal.votesFor === proposal.votesAgainst) {
      riskFactors.push('Evenly split vote');
      riskScore += 10;
    }

    // Check budget proposal risks
    if (proposal.proposalType === 'treasury' && proposal.budget) {
      const budgetAmount = parseFloat(proposal.budget.amount);
      if (budgetAmount > 1000000) {
        riskFactors.push('Large budget allocation');
        riskScore += 20;
      }
    }

    // Check proposal type risks
    if (proposal.proposalType === 'technical') {
      riskFactors.push('Technical proposal requires careful review');
      riskScore += 10;
    }

    // Check consensus
    const totalVotes = BigInt(proposal.votesFor) + BigInt(proposal.votesAgainst);
    const consensus = totalVotes === 0n ? 0 : Number((BigInt(proposal.votesFor) * 100n) / totalVotes);
    if (consensus < 60) {
      riskFactors.push('Weak consensus (< 60%)');
      riskScore += 15;
    }

    // Determine risk level
    let riskLevel: RiskLevel;
    if (riskScore < 25) riskLevel = RiskLevel.LOW;
    else if (riskScore < 50) riskLevel = RiskLevel.MEDIUM;
    else if (riskScore < 75) riskLevel = RiskLevel.HIGH;
    else riskLevel = RiskLevel.CRITICAL;

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel,
      riskFactors
    };
  }

  /**
   * Get member engagement analysis
   */
  analyzeMemberEngagement(memberId: string, hours: number = 24 * 30): MemberEngagement | null {
    const member = this.members.get(memberId);
    if (!member) return null;

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = {
      memberId,
      period: { start: cutoff, end: new Date() },
      metrics: {
        proposalsCreated: member.proposalsCreated,
        votesParticipated: member.proposalsVotedOn,
        commentsMade: 0, // Would track from proposal discussion
        consensusReached: 0,
        timesOverruled: 0
      },
      engagementScore: 0,
      engagementTrend: 'stable' as const,
      recommendations: []
    };

    // Calculate engagement score
    metrics.engagementScore = Math.min(100, 
      (metrics.metrics.votesParticipated * 10) +
      (metrics.metrics.proposalsCreated * 20) +
      Math.min(50, member.trustScore)
    );

    return metrics;
  }

  /**
   * Get DAO health history
   */
  getHealthHistory(hours: number = 24): DAOHealthMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.healthSnapshots.filter(s => s.timestamp.getTime() > cutoff);
  }

  /**
   * Shutdown agent
   */
  async shutdown(): Promise<void> {
    logger.info(`[${this.config.id}] Shutting down Governance Analytics Agent`);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.communicator.unsubscribe();
  }

  // ===== PRIVATE HELPERS =====

  private async loadGovernanceData(): Promise<void> {
    logger.debug('Loading governance data...');
  }

  private startAnalytics(): void {
    // Analyze governance every 5 minutes
    this.refreshInterval = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        logger.warn('Periodic analysis failed:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async recordProposal(proposal: GovernanceProposal): Promise<void> {
    this.proposals.push(proposal);
  }

  private async recordVote(vote: any): Promise<void> {
    const proposal = this.proposals.find(p => p.id === vote.proposalId);
    if (proposal) {
      if (vote.vote === 'for') {
        proposal.votesFor = (BigInt(proposal.votesFor) + BigInt(vote.shares)).toString();
      } else if (vote.vote === 'against') {
        proposal.votesAgainst = (BigInt(proposal.votesAgainst) + BigInt(vote.shares)).toString();
      }
    }
  }

  private calculateAverageParticipation(): number {
    if (this.proposals.length === 0) return 0;
    const recent = this.proposals.filter(p =>
      p.votingEndsAt.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );
    if (recent.length === 0) return 0;
    return recent.reduce((sum, p) => sum + p.participationRate, 0) / recent.length;
  }

  private calculateVotingConcentration(): number {
    if (this.members.size === 0) return 0;
    const shares = Array.from(this.members.values()).map(m => BigInt(m.shares));
    const totalShares = shares.reduce((sum, s) => sum + s, 0n);
    
    if (totalShares === 0n) return 0;

    // Simplified Nakamoto coefficient approximation
    let topShares = 0n;
    let count = 0;
    for (const share of shares.sort((a, b) => Number(b - a))) {
      topShares += share;
      count++;
      if (topShares * 2n >= totalShares) break;
    }
    return count;
  }

  private calculateAvgMembersPerProposal(): number {
    if (this.proposals.length === 0) return 0;
    // Simplified: would calculate from on-chain voting data
    return this.members.size / Math.max(1, this.proposals.length);
  }

  private calculateDiscussionQuality(): number {
    // Would score based on discussion engagement and sentiment
    return 75;
  }

  private calculateConsensusLevel(): number {
    if (this.proposals.length === 0) return 0;
    const recent = this.proposals.filter(p =>
      p.votingEndsAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    );
    
    if (recent.length === 0) return 0;

    let consensusCount = 0;
    for (const proposal of recent) {
      const forVotes = BigInt(proposal.votesFor);
      const againstVotes = BigInt(proposal.votesAgainst);
      const total = forVotes + againstVotes;
      
      if (total > 0n) {
        const ratio = Number((forVotes * 100n) / total);
        if (ratio > 60 || ratio < 40) {
          consensusCount++;
        }
      }
    }

    return (consensusCount / recent.length) * 100;
  }

  private calculateDelegationRate(): number {
    if (this.members.size === 0) return 0;
    const delegated = Array.from(this.members.values())
      .filter(m => BigInt(m.delegatedShares) > 0n).length;
    return (delegated / this.members.size) * 100;
  }

  private assessSystemicRisk(): number {
    return 25; // Placeholder
  }

  private assessGovernanceRisk(): number {
    return this.calculateVotingConcentration() * 10; // Higher concentration = higher risk
  }

  private assessFinancialRisk(): number {
    return 20; // Placeholder
  }

  private assessOperationalRisk(): number {
    return Math.max(0, 30 - (this.members.size / 100)); // More members = lower risk
  }

  private generateRecommendations(metrics: DAOHealthMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.governanceHealth.activeMembersCount < 10) {
      recommendations.push('Increase member recruitment efforts');
    }

    if (metrics.governanceHealth.averageParticipation < 0.2) {
      recommendations.push('Improve proposal clarity and reduce voter fatigue');
    }

    if (metrics.riskAssessment.overall > 50) {
      recommendations.push('High risk detected - increase governance oversight');
    }

    if (metrics.engagementMetrics.delegationRate > 70) {
      recommendations.push('High delegation rate - encourage more active participation');
    }

    return recommendations;
  }
}
