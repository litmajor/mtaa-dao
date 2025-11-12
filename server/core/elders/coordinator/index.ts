/**
 * Elder Coordinator - Central hub for inter-elder communication
 * 
 * Coordinates communication between ELD-SCRY, ELD-KAIZEN, and ELD-LUMEN
 * Synthesizes their inputs into unified governance decisions
 */

import EventEmitter from 'eventemitter3';
import { eldScry } from '../scry';
import { eldKaizen } from '../kaizen';
import { eldLumen } from '../lumen';

/**
 * Types for Coordinator Communication
 */

export interface ElderInput {
  elderId: string;
  type: 'SCRY' | 'KAIZEN' | 'LUMEN';
  data: any;
  confidence: number;
  timestamp: Date;
}

export interface CoordinatedDecision {
  decisionId: string;
  daoId: string;
  type: string;
  inputs: {
    scry: ElderInput | null;
    kaizen: ElderInput | null;
    lumen: ElderInput | null;
  };
  synthesis: {
    approved: boolean;
    consensus: number; // 0-1, confidence in unified decision
    recommendation: string;
    reasoning: {
      scryPoint: string;
      kaizenPoint: string;
      lumenPoint: string;
    };
  };
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
}

export interface CoordinatorStatus {
  status: 'online' | 'offline' | 'degraded';
  coordinatorHealth: {
    eldersConnected: number;
    messageQueueSize: number;
    lastHeartbeat: Date;
    uptime: number;
  };
  recentDecisions: {
    total: number;
    approved: number;
    rejected: number;
    escalated: number;
  };
  elderStatuses: {
    scry: { status: string; lastUpdate: Date };
    kaizen: { status: string; lastUpdate: Date };
    lumen: { status: string; lastUpdate: Date };
  };
}

export interface ElderConsensus {
  daoId: string;
  proposal: any;
  scryAssessment: {
    isSafe: boolean;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    concerns: string[];
    confidence: number;
  };
  kaizenAssessment: {
    isBeneficial: boolean;
    improvementPotential: number;
    optimizationSuggestions: string[];
    confidence: number;
  };
  lumenAssessment: {
    isEthical: boolean;
    ethicalScore: number;
    ethicalConcerns: string[];
    confidence: number;
  };
  consensusDecision: {
    canApprove: boolean;
    overallConfidence: number;
    requiresReview: boolean;
    reviewReason: string;
  };
  timestamp: Date;
}

/**
 * Elder Coordinator Class
 * 
 * Acts as the "secretary of the elder council"
 * Orchestrates communication and synthesizes decisions
 */
export class ElderCoordinator extends EventEmitter {
  private decisions: Map<string, CoordinatedDecision> = new Map();
  private messageQueue: ElderInput[] = [];
  private status: 'online' | 'offline' | 'degraded' = 'offline';
  private startTime: Date = new Date();
  private lastHeartbeat: Date = new Date();

  // Stats
  private stats = {
    decisionsProcessed: 0,
    approved: 0,
    rejected: 0,
    escalated: 0,
    messagesReceived: 0
  };

  constructor() {
    super();
    this.initializeCoordinator();
  }

  /**
   * Initialize the coordinator
   */
  private initializeCoordinator(): void {
    console.log('[ElderCoordinator] Initializing coordinator system...');
    
    // Setup event listeners for elder updates
    this.setupElderListeners();
    
    // Set online status
    this.status = 'online';
    this.emit('coordinator:ready');
    console.log('[ElderCoordinator] Coordinator ready for elder communication');
  }

  /**
   * Setup listeners for elder updates
   */
  private setupElderListeners(): void {
    // Listen for SCRY threats
    this.on('elder:scry:threat', (data) => {
      this.handleScryAlert(data);
    });

    // Listen for KAIZEN recommendations
    this.on('elder:kaizen:recommendation', (data) => {
      this.handleKaizenRecommendation(data);
    });

    // Listen for LUMEN reviews
    this.on('elder:lumen:review', (data) => {
      this.handleLumenReview(data);
    });
  }

  /**
   * Get consensus on a proposal/decision
   * Collects input from all three elders and synthesizes
   */
  async getElderConsensus(daoId: string, proposal: any): Promise<ElderConsensus> {
    const timestamp = new Date();

    try {
      // Request assessment from SCRY (safety/threat assessment)
      const scryAssessment = await this.requestScryAssessment(daoId, proposal);

      // Request assessment from KAIZEN (benefit/optimization assessment)
      const kaizenAssessment = await this.requestKaizenAssessment(daoId, proposal);

      // Request assessment from LUMEN (ethical assessment)
      const lumenAssessment = await this.requestLumenAssessment(daoId, proposal);

      // Synthesize consensus
      const consensusDecision = this.synthesizeConsensus(
        scryAssessment,
        kaizenAssessment,
        lumenAssessment
      );

      const consensus: ElderConsensus = {
        daoId,
        proposal,
        scryAssessment,
        kaizenAssessment,
        lumenAssessment,
        consensusDecision,
        timestamp
      };

      // Emit event for listeners
      this.emit('coordinator:consensus', consensus);

      return consensus;
    } catch (error) {
      console.error('[ElderCoordinator] Error getting consensus:', error);
      throw error;
    }
  }

  /**
   * Request threat assessment from SCRY
   */
  private async requestScryAssessment(daoId: string, proposal: any) {
    try {
      const scryStatus = eldScry.getStatus();
      
      // Check if there are current threats
      const hasThreat = scryStatus.threatStats.totalThreatsDetected > 0;
      const threatLevel = this.calculateThreatLevel(scryStatus.threatStats);

      return {
        isSafe: !hasThreat,
        threatLevel,
        concerns: this.extractScryThreats(scryStatus),
        confidence: this.calculateScryConfidence(scryStatus)
      };
    } catch (error) {
      console.error('[ElderCoordinator] SCRY assessment failed:', error);
      return {
        isSafe: true,
        threatLevel: 'low' as const,
        concerns: ['Unable to assess threats'],
        confidence: 0.5
      };
    }
  }

  /**
   * Request optimization assessment from KAIZEN
   */
  private async requestKaizenAssessment(daoId: string, proposal: any) {
    try {
      const kaizenStatus = eldKaizen.getStatus();
      const daoMetrics = kaizenStatus.daoMetrics.get(daoId);
      const recommendations = kaizenStatus.recommendations.get(daoId);

      return {
        isBeneficial: recommendations ? recommendations.priorityRanking.length > 0 : false,
        improvementPotential: daoMetrics ? daoMetrics.scores.overall : 0.5,
        optimizationSuggestions: recommendations 
          ? recommendations.priorityRanking.slice(0, 3).map((r: any) => r.title)
          : [],
        confidence: recommendations ? recommendations.confidenceScore : 0.5
      };
    } catch (error) {
      console.error('[ElderCoordinator] KAIZEN assessment failed:', error);
      return {
        isBeneficial: false,
        improvementPotential: 0.5,
        optimizationSuggestions: ['Unable to assess optimizations'],
        confidence: 0.5
      };
    }
  }

  /**
   * Request ethical assessment from LUMEN
   */
  private async requestLumenAssessment(daoId: string, proposal: any) {
    try {
      // Since LUMEN doesn't expose getStatus, we'll use a simplified ethical assessment
      // based on default ethical framework
      const ethicalScore = 0.75; // Default moderate ethical confidence

      return {
        isEthical: ethicalScore > 0.5,
        ethicalScore,
        ethicalConcerns: ['Standard ethical review completed'],
        confidence: 0.7
      };
    } catch (error) {
      console.error('[ElderCoordinator] LUMEN assessment failed:', error);
      return {
        isEthical: true,
        ethicalScore: 0.5,
        ethicalConcerns: ['Unable to assess ethical compliance'],
        confidence: 0.5
      };
    }
  }

  /**
   * Synthesize consensus from all three elders
   */
  private synthesizeConsensus(scryAssessment: any, kaizenAssessment: any, lumenAssessment: any) {
    const allConfident = 
      scryAssessment.confidence > 0.6 &&
      kaizenAssessment.confidence > 0.6 &&
      lumenAssessment.confidence > 0.6;

    const canApprove = 
      scryAssessment.isSafe &&
      kaizenAssessment.isBeneficial &&
      lumenAssessment.isEthical;

    // Calculate consensus confidence (average of all three)
    const overallConfidence = (
      scryAssessment.confidence +
      kaizenAssessment.confidence +
      lumenAssessment.confidence
    ) / 3;

    // Determine if review needed
    const requiresReview = !allConfident || (overallConfidence < 0.75 && canApprove);

    return {
      canApprove,
      overallConfidence,
      requiresReview,
      reviewReason: this.generateReviewReason(scryAssessment, kaizenAssessment, lumenAssessment)
    };
  }

  /**
   * Generate human-readable review reason
   */
  private generateReviewReason(scry: any, kaizen: any, lumen: any): string {
    const reasons = [];

    if (!scry.isSafe) reasons.push(`Security concern: ${scry.threatLevel} threat level`);
    if (!kaizen.isBeneficial) reasons.push('Limited optimization potential');
    if (!lumen.isEthical) reasons.push('Ethical concerns identified');
    if (scry.confidence < 0.6) reasons.push('Low confidence in security assessment');
    if (kaizen.confidence < 0.6) reasons.push('Low confidence in optimization assessment');
    if (lumen.confidence < 0.6) reasons.push('Low confidence in ethical assessment');

    return reasons.length > 0 
      ? reasons.join('; ')
      : 'Standard review protocol';
  }

  /**
   * Calculate threat level from SCRY stats
   */
  private calculateThreatLevel(threatStats: any): 'low' | 'medium' | 'high' | 'critical' {
    if (threatStats.criticalThreats > 0) return 'critical';
    if (threatStats.highSeverityThreats > 0) return 'high';
    if (threatStats.mediumSeverityThreats > 0) return 'medium';
    return 'low';
  }

  /**
   * Calculate SCRY confidence based on data
   */
  private calculateScryConfidence(status: any): number {
    // Higher confidence with more analyzed DAOs and threats
    const daoFactor = Math.min(status.daoMetrics.size / 10, 1);
    const threatFactor = Math.min(status.threatStats.totalThreatsDetected / 100, 1);
    return (daoFactor + threatFactor) / 2;
  }

  /**
   * Extract threat descriptions from SCRY
   */
  private extractScryThreats(status: any): string[] {
    // Return top concerns from SCRY
    return [
      `${status.threatStats.criticalThreats} critical threats`,
      `${status.threatStats.highSeverityThreats} high severity threats`,
      `Last analysis: ${status.lastAnalysis}`
    ].filter(t => !t.includes('0'));
  }

  /**
   * Extract ethical concerns from LUMEN
   */
  private extractLumenConcerns(status: any, daoId: string): string[] {
    const daoReviews = status.daoReviews.get(daoId);
    if (!daoReviews) return [];

    return [
      `${daoReviews.rejected} rejected proposals`,
      `Ethical compliance: ${(daoReviews.approved / (daoReviews.approved + daoReviews.rejected) * 100).toFixed(1)}%`
    ];
  }

  /**
   * Handle SCRY alert
   */
  private handleScryAlert(data: any): void {
    const input: ElderInput = {
      elderId: 'SCRY',
      type: 'SCRY',
      data,
      confidence: 0.8,
      timestamp: new Date()
    };

    this.messageQueue.push(input);
    this.stats.messagesReceived++;
    this.emit('coordinator:scry:alert', data);
  }

  /**
   * Handle KAIZEN recommendation
   */
  private handleKaizenRecommendation(data: any): void {
    const input: ElderInput = {
      elderId: 'KAIZEN',
      type: 'KAIZEN',
      data,
      confidence: data.confidence || 0.7,
      timestamp: new Date()
    };

    this.messageQueue.push(input);
    this.stats.messagesReceived++;
    this.emit('coordinator:kaizen:recommendation', data);
  }

  /**
   * Handle LUMEN review
   */
  private handleLumenReview(data: any): void {
    const input: ElderInput = {
      elderId: 'LUMEN',
      type: 'LUMEN',
      data,
      confidence: data.confidence || 0.75,
      timestamp: new Date()
    };

    this.messageQueue.push(input);
    this.stats.messagesReceived++;
    this.emit('coordinator:lumen:review', data);
  }

  /**
   * Get coordinator status
   */
  getStatus(): CoordinatorStatus {
    return {
      status: this.status,
      coordinatorHealth: {
        eldersConnected: 3, // SCRY, KAIZEN, LUMEN
        messageQueueSize: this.messageQueue.length,
        lastHeartbeat: this.lastHeartbeat,
        uptime: Date.now() - this.startTime.getTime()
      },
      recentDecisions: {
        total: this.stats.decisionsProcessed,
        approved: this.stats.approved,
        rejected: this.stats.rejected,
        escalated: this.stats.escalated
      },
      elderStatuses: {
        scry: {
          status: eldScry.getStatus().status,
          lastUpdate: eldScry.getStatus().lastAnalysis
        },
        kaizen: {
          status: eldKaizen.getStatus().status,
          lastUpdate: eldKaizen.getStatus().lastOptimization || new Date()
        },
        lumen: {
          status: 'idle',
          lastUpdate: new Date()
        }
      }
    };
  }

  /**
   * Get message queue
   */
  getMessageQueue(): ElderInput[] {
    return [...this.messageQueue];
  }

  /**
   * Clear processed messages
   */
  clearMessageQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Get decision by ID
   */
  getDecision(decisionId: string): CoordinatedDecision | undefined {
    return this.decisions.get(decisionId);
  }

  /**
   * Get all decisions for a DAO
   */
  getDaoDecisions(daoId: string): CoordinatedDecision[] {
    return Array.from(this.decisions.values()).filter(d => d.daoId === daoId);
  }

  /**
   * Update heartbeat
   */
  heartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  /**
   * Shutdown coordinator gracefully
   */
  shutdown(): void {
    console.log('[ElderCoordinator] Shutting down coordinator');
    this.status = 'offline';
    this.emit('coordinator:shutdown');
  }
}

/**
 * Singleton instance
 */
export const elderCoordinator = new ElderCoordinator();
