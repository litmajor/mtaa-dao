/**
 * ELD-LUMEN (Ethics Elder)
 * 
 * Moral guidance and ethical oversight for DAO decisions and agent behaviors
 * Evaluates actions for ethical compliance before execution
 */

import type { AgentMessage } from '../../agent-framework/message-bus';

/**
 * Core ethical principles for DAO governance
 */
export enum EthicalPrinciple {
  MINIMIZE_HARM = 'minimize_harm',
  RESPECT_AUTONOMY = 'respect_autonomy',
  ENSURE_JUSTICE = 'ensure_justice',
  PROMOTE_BENEFICENCE = 'promote_beneficence',
  TRANSPARENCY = 'transparency',
  PROPORTIONALITY = 'proportionality',
  FAIRNESS = 'fairness',
  ACCOUNTABILITY = 'accountability'
}

/**
 * Severity of ethical concerns
 */
export enum EthicalConcernLevel {
  GREEN = 'green',      // No concerns
  YELLOW = 'yellow',    // Minor concerns
  ORANGE = 'orange',    // Moderate concerns
  RED = 'red'           // Severe ethical issues
}

/**
 * Types of decisions requiring ethical review
 */
export enum DecisionType {
  TREASURY_MOVEMENT = 'treasury_movement',
  GOVERNANCE_CHANGE = 'governance_change',
  MEMBER_REMOVAL = 'member_removal',
  POLICY_CHANGE = 'policy_change',
  SYSTEM_MODIFICATION = 'system_modification',
  DATA_ACCESS = 'data_access',
  EMERGENCY_ACTION = 'emergency_action',
  RESOURCE_ALLOCATION = 'resource_allocation'
}

/**
 * Ethical review result
 */
export interface EthicalReviewResult {
  approved: boolean;
  concernLevel: EthicalConcernLevel;
  principlesAffected: EthicalPrinciple[];
  concerns: string[];
  recommendations: string[];
  reviewedAt: Date;
  reviewerId: string;
  confidenceScore: number;
}

/**
 * Ethical framework configuration
 */
export interface EthicalFramework {
  corePrinciples: Map<EthicalPrinciple, number>; // Principle -> importance weight
  forbiddenActions: string[];
  reviewCriteria: Map<string, number>;
  decisionThresholds: Map<EthicalConcernLevel, number>;
}

/**
 * Decision request for ethical review
 */
export interface EthicalDecisionRequest {
  id: string;
  decisionType: DecisionType;
  proposedAction: string;
  affectedParties: string[];
  potentialHarms: string[];
  potentialBenefits: string[];
  justification: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Ethical audit record
 */
export interface EthicalAuditRecord {
  timestamp: Date;
  decisionId: string;
  decisionType: DecisionType;
  result: EthicalReviewResult;
  actionTaken: string;
  outcome: 'approved' | 'rejected' | 'conditional';
}

/**
 * ELD-LUMEN Configuration
 */
export interface EldLumenConfig {
  updateInterval: number;
  strictMode: boolean; // If true, err on side of caution
  auditRetention: number; // Days to keep audit records
  enableAutonomousReview: boolean;
}

/**
 * ELD-LUMEN - The Ethics Elder
 * 
 * Provides moral guidance and ethical oversight for DAO operations
 * Evaluates decisions against established ethical principles
 */
export class EldLumenElder {
  private ethicalFramework: EthicalFramework;
  private config: EldLumenConfig;
  private auditLog: EthicalAuditRecord[] = [];
  private pendingReviews: Map<string, EthicalDecisionRequest> = new Map();
  private reviewInterval: NodeJS.Timeout | null = null;
  private logger: any;

  constructor(config?: Partial<EldLumenConfig>) {
    this.ethicalFramework = this.initializeEthicalFramework();
    this.config = {
      updateInterval: 5000,
      strictMode: true,
      auditRetention: 365,
      enableAutonomousReview: true,
      ...config
    };
    this.logger = {
      info: (msg: string) => console.log(`ℹ️  ${msg}`),
      warn: (msg: string) => console.warn(`⚠️  ${msg}`),
      error: (msg: string, err?: any) => console.error(`❌ ${msg}`, err || '')
    };
  }

  /**
   * Initialize the ethical framework
   */
  private initializeEthicalFramework(): EthicalFramework {
    const principles = new Map<EthicalPrinciple, number>([
      [EthicalPrinciple.MINIMIZE_HARM, 1.0],
      [EthicalPrinciple.RESPECT_AUTONOMY, 0.9],
      [EthicalPrinciple.ENSURE_JUSTICE, 0.95],
      [EthicalPrinciple.PROMOTE_BENEFICENCE, 0.8],
      [EthicalPrinciple.TRANSPARENCY, 0.85],
      [EthicalPrinciple.PROPORTIONALITY, 0.9],
      [EthicalPrinciple.FAIRNESS, 0.95],
      [EthicalPrinciple.ACCOUNTABILITY, 0.9]
    ]);

    const criteria = new Map<string, number>([
      ['harm_assessment', 0.3],
      ['consent_verification', 0.25],
      ['proportionality', 0.2],
      ['transparency', 0.15],
      ['fairness_check', 0.1]
    ]);

    const thresholds = new Map<EthicalConcernLevel, number>([
      [EthicalConcernLevel.GREEN, 0.0],
      [EthicalConcernLevel.YELLOW, 0.3],
      [EthicalConcernLevel.ORANGE, 0.6],
      [EthicalConcernLevel.RED, 0.85]
    ]);

    return {
      corePrinciples: principles,
      forbiddenActions: [
        'cause_unnecessary_harm',
        'violate_privacy_without_cause',
        'discriminate_unfairly',
        'deceive_without_justification',
        'abuse_power',
        'exclude_without_due_process'
      ],
      reviewCriteria: criteria,
      decisionThresholds: thresholds
    };
  }

  /**
   * Start the ethics elder
   */
  async start(): Promise<void> {
    this.logger.info('[ELD-LUMEN] Starting Ethics Elder...');
    
    this.reviewInterval = setInterval(() => this.processEthicalReviews(), this.config.updateInterval);
    
    this.logger.info('[ELD-LUMEN] Ethics Elder started successfully');
  }

  /**
   * Stop the ethics elder
   */
  async stop(): Promise<void> {
    this.logger.info('[ELD-LUMEN] Stopping Ethics Elder...');
    
    if (this.reviewInterval) {
      clearInterval(this.reviewInterval);
    }

    this.logger.info('[ELD-LUMEN] Ethics Elder stopped');
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message: any): Promise<void> {
    // Message handling will be implemented based on actual message types
  }

  /**
   * Conduct ethical review of a proposed decision
   */
  async conductEthicalReview(request: EthicalDecisionRequest): Promise<EthicalReviewResult> {
    this.logger.info(`[ELD-LUMEN] Reviewing decision: ${request.id} (${request.decisionType})`);

    try {
      // Add to pending reviews
      this.pendingReviews.set(request.id, request);

      // Conduct comprehensive ethical review
      const result = this.performEthicalAnalysis(request);

      // Record in audit log
      const auditRecord: EthicalAuditRecord = {
        timestamp: new Date(),
        decisionId: request.id,
        decisionType: request.decisionType,
        result,
        actionTaken: result.approved ? 'approved' : 'rejected',
        outcome: result.approved ? 'approved' : 'rejected'
      };
      
      this.auditLog.push(auditRecord);

      // Log the decision
      if (result.approved) {
        this.logger.info(
          `[ELD-LUMEN] ✓ Approved ${request.decisionType}: ${request.id} ` +
          `(Concern Level: ${result.concernLevel})`
        );
      } else {
        this.logger.warn(
          `[ELD-LUMEN] ✗ REJECTED ${request.decisionType}: ${request.id} ` +
          `(Concern Level: ${result.concernLevel})`
        );
        this.logger.warn(`[ELD-LUMEN] Concerns: ${result.concerns.join(', ')}`);
      }

      // Clean up pending
      this.pendingReviews.delete(request.id);

      return result;
    } catch (error) {
      this.logger.error(`[ELD-LUMEN] Review error for ${request.id}:`, error);
      throw error;
    }
  }

  /**
   * Perform comprehensive ethical analysis
   */
  private performEthicalAnalysis(request: EthicalDecisionRequest): EthicalReviewResult {
    const principlesAffected: EthicalPrinciple[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let overallScore = 0;
    let criteriaScores: number[] = [];

    // 1. Harm Assessment (30%)
    const harmScore = this.assessHarm(request);
    criteriaScores.push(harmScore * 0.3);
    if (harmScore > 0.6) {
      principlesAffected.push(EthicalPrinciple.MINIMIZE_HARM);
      concerns.push(`High potential for harm: ${request.potentialHarms.join(', ')}`);
    }

    // 2. Consent & Autonomy (25%)
    const consentScore = this.verifyConsent(request);
    criteriaScores.push(consentScore * 0.25);
    if (consentScore > 0.5) {
      principlesAffected.push(EthicalPrinciple.RESPECT_AUTONOMY);
      concerns.push('Affected parties may not have given informed consent');
    }

    // 3. Proportionality (20%)
    const proportionalityScore = this.assessProportionality(request);
    criteriaScores.push(proportionalityScore * 0.2);
    if (proportionalityScore > 0.7) {
      principlesAffected.push(EthicalPrinciple.PROPORTIONALITY);
      concerns.push('Response may be disproportionate to the issue');
    }

    // 4. Transparency (15%)
    const transparencyScore = this.assessTransparency(request);
    criteriaScores.push(transparencyScore * 0.15);
    if (transparencyScore > 0.4) {
      principlesAffected.push(EthicalPrinciple.TRANSPARENCY);
      concerns.push('Decision lacks sufficient transparency');
      recommendations.push('Provide detailed explanation to affected parties');
    }

    // 5. Fairness Check (10%)
    const fairnessScore = this.assessFairness(request);
    criteriaScores.push(fairnessScore * 0.1);
    if (fairnessScore > 0.6) {
      principlesAffected.push(EthicalPrinciple.FAIRNESS);
      concerns.push('Decision may disproportionately affect certain groups');
    }

    // Calculate overall concern score
    overallScore = criteriaScores.reduce((a, b) => a + b, 0);

    // Check for forbidden actions
    if (this.violatesForbiddenActions(request)) {
      overallScore = 1.0;
      concerns.unshift('Decision violates fundamental ethical principles');
    }

    // Determine concern level
    let concernLevel: EthicalConcernLevel;
    if (overallScore < 0.3) {
      concernLevel = EthicalConcernLevel.GREEN;
    } else if (overallScore < 0.6) {
      concernLevel = EthicalConcernLevel.YELLOW;
    } else if (overallScore < 0.85) {
      concernLevel = EthicalConcernLevel.ORANGE;
    } else {
      concernLevel = EthicalConcernLevel.RED;
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(request, principlesAffected));

    // Strict mode: Red becomes rejection
    const approved = request.urgency === 'critical' 
      ? concernLevel !== EthicalConcernLevel.RED 
      : (concernLevel === EthicalConcernLevel.GREEN || concernLevel === EthicalConcernLevel.YELLOW);

    return {
      approved: this.config.strictMode ? concernLevel === EthicalConcernLevel.GREEN : approved,
      concernLevel,
      principlesAffected,
      concerns,
      recommendations,
      reviewedAt: new Date(),
      reviewerId: 'ELD-LUMEN',
      confidenceScore: 1 - (Math.abs(overallScore - 0.5) * 0.2)
    };
  }

  /**
   * Assess potential harm
   */
  private assessHarm(request: EthicalDecisionRequest): number {
    let harmScore = 0;

    if (request.potentialHarms.length > 0) {
      harmScore += 0.3 * request.potentialHarms.length;
    }

    if (request.urgency === 'critical') {
      harmScore -= 0.2; // Critical situations may justify some harm
    }

    // Check for vulnerable populations
    if (request.affectedParties.some(p => p.includes('member') || p.includes('new'))) {
      harmScore += 0.2;
    }

    return Math.min(harmScore, 1.0);
  }

  /**
   * Verify informed consent
   */
  private verifyConsent(request: EthicalDecisionRequest): number {
    let consentScore = 0;

    // Lack of affectedParties info suggests no consent
    if (request.affectedParties.length === 0) {
      consentScore += 0.7;
    }

    // Emergency actions have lower consent requirements
    if (request.urgency === 'critical') {
      consentScore -= 0.4;
    }

    // Governance changes require higher consent
    if (request.decisionType === DecisionType.GOVERNANCE_CHANGE) {
      consentScore += 0.3;
    }

    return Math.max(0, Math.min(consentScore, 1.0));
  }

  /**
   * Assess proportionality of response
   */
  private assessProportionality(request: EthicalDecisionRequest): number {
    let proportionalityScore = 0.2; // Start with base score

    // Severe responses to minor issues
    if (request.decisionType === DecisionType.MEMBER_REMOVAL) {
      proportionalityScore += 0.4;
    }

    // Emergency actions are inherently less proportional
    if (request.urgency !== 'critical') {
      proportionalityScore -= 0.2;
    }

    return Math.min(proportionalityScore, 1.0);
  }

  /**
   * Assess transparency
   */
  private assessTransparency(request: EthicalDecisionRequest): number {
    let transparencyScore = 0;

    // Missing justification
    if (!request.justification || request.justification.length < 20) {
      transparencyScore += 0.5;
    }

    // System modifications should be highly transparent
    if (request.decisionType === DecisionType.SYSTEM_MODIFICATION) {
      transparencyScore += 0.3;
    }

    return Math.min(transparencyScore, 1.0);
  }

  /**
   * Assess fairness
   */
  private assessFairness(request: EthicalDecisionRequest): number {
    let fairnessScore = 0.1;

    // Decisions affecting multiple parties need fairness check
    if (request.affectedParties.length > 1) {
      fairnessScore += 0.2;
    }

    // Data access decisions have fairness implications
    if (request.decisionType === DecisionType.DATA_ACCESS) {
      fairnessScore += 0.3;
    }

    return Math.min(fairnessScore, 1.0);
  }

  /**
   * Check if decision violates forbidden actions
   */
  private violatesForbiddenActions(request: EthicalDecisionRequest): boolean {
    const forbiddenPatterns = [
      'harm.*without.*reason',
      'deceive',
      'discriminate',
      'abuse',
      'violate.*privacy'
    ];

    const description = `${request.proposedAction} ${request.justification}`.toLowerCase();
    
    return forbiddenPatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(description);
    });
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    request: EthicalDecisionRequest,
    principlesAffected: EthicalPrinciple[]
  ): string[] {
    const recommendations: string[] = [];

    if (principlesAffected.includes(EthicalPrinciple.TRANSPARENCY)) {
      recommendations.push('Document decision rationale and communicate to affected parties');
    }

    if (principlesAffected.includes(EthicalPrinciple.RESPECT_AUTONOMY)) {
      recommendations.push('Allow affected parties opportunity to respond or appeal');
    }

    if (principlesAffected.includes(EthicalPrinciple.MINIMIZE_HARM)) {
      recommendations.push('Implement safeguards to minimize potential harms');
    }

    if (request.potentialHarms.length > request.potentialBenefits.length) {
      recommendations.push('Re-evaluate if benefits truly justify potential harms');
    }

    return recommendations;
  }

  /**
   * Evaluate an action after it's been taken
   */
  async evaluateAction(action: any): Promise<void> {
    this.logger.info(`[ELD-LUMEN] Evaluating action: ${action.id}`);
    
    // Check if action aligns with ethical framework
    if (this.actionViolatesEthics(action)) {
      this.logger.error(`[ELD-LUMEN] ⚠️ Action violates ethical principles: ${action.id}`);
      
      // Log ethical violation in audit log
      this.auditLog.push({
        timestamp: new Date(),
        decisionId: action.id,
        decisionType: 'GOVERNANCE_ACTION' as any,
        result: {
          approved: false,
          concernLevel: EthicalConcernLevel.RED,
          principlesAffected: [EthicalPrinciple.MINIMIZE_HARM],
          concerns: [`Action ${action.id} violates ethical principles`],
          recommendations: ['Action should be rejected'],
          reviewedAt: new Date(),
          reviewerId: 'ELD-LUMEN',
          confidenceScore: 0.95
        },
        actionTaken: 'BLOCKED',
        outcome: 'rejected'
      });
    }
  }

  /**
   * Check if action violates ethical principles
   */
  private actionViolatesEthics(action: any): boolean {
    // Implement action validation against ethical framework
    return false; // Placeholder
  }

  /**
   * Process pending ethical reviews
   */
  private async processEthicalReviews(): Promise<void> {
    if (this.pendingReviews.size === 0) return;

    this.logger.debug(`[ELD-LUMEN] Processing ${this.pendingReviews.size} pending reviews`);

    for (const [id, request] of this.pendingReviews) {
      if (this.config.enableAutonomousReview) {
        try {
          await this.conductEthicalReview(request);
        } catch (error) {
          this.logger.error(`[ELD-LUMEN] Error processing review ${id}:`, error);
        }
      }
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(days: number = 30): EthicalAuditRecord[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.auditLog.filter(record => record.timestamp >= cutoffDate);
  }

  /**
   * Get ethical statistics
   */
  getEthicalStatistics(days: number = 30) {
    const auditLog = this.getAuditLog(days);

    const stats = {
      totalReviewed: auditLog.length,
      approved: auditLog.filter(r => r.outcome === 'approved').length,
      rejected: auditLog.filter(r => r.outcome === 'rejected').length,
      conditional: auditLog.filter(r => r.outcome === 'conditional').length,
      concernDistribution: {
        green: auditLog.filter(r => r.result.concernLevel === EthicalConcernLevel.GREEN).length,
        yellow: auditLog.filter(r => r.result.concernLevel === EthicalConcernLevel.YELLOW).length,
        orange: auditLog.filter(r => r.result.concernLevel === EthicalConcernLevel.ORANGE).length,
        red: auditLog.filter(r => r.result.concernLevel === EthicalConcernLevel.RED).length
      },
      averageConfidence: auditLog.length > 0
        ? auditLog.reduce((sum, r) => sum + r.result.confidenceScore, 0) / auditLog.length
        : 0
    };

    return stats;
  }

  /**
   * Get statistics - alias for getEthicalStatistics
   */
  getStatistics(daoId?: string) {
    return this.getEthicalStatistics(30);
  }

  /**
   * Report health status
   */
  private async reportHealth(): Promise<void> {
    const stats = this.getEthicalStatistics(7);
    
    this.logger.info('[ELD-LUMEN] Health report:');
    this.logger.info(`  - Reviews this week: ${stats.totalReviewed}`);
    this.logger.info(`  - Approval rate: ${((stats.approved / stats.totalReviewed) * 100).toFixed(1)}%`);
    this.logger.info(`  - Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
  }
}

// Export singleton instance
export const eldLumen = new EldLumenElder({
  updateInterval: 30000,
  strictMode: false,
  auditRetention: 90,
  enableAutonomousReview: true
});
