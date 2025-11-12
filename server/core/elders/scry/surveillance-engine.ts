/**
 * Surveillance Engine for ELD-SCRY
 * 
 * Continuous monitoring of DAO activities, member behaviors, and fund flows
 * Detects suspicious patterns and anomalies in real-time
 */

import { PerformanceMetrics } from '../kaizen/performance-tracker';

export interface Activity {
  activityId: string;
  daoId: string;
  userId: string;
  type: 'proposal' | 'vote' | 'transfer' | 'delegate' | 'join' | 'leave' | 'other';
  timestamp: Date;
  details: Record<string, any>;
  riskScore?: number;
  anomalous?: boolean;
}

export interface ThreatPattern {
  patternId: string;
  name: string;
  description: string;
  indicators: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  categories: string[];
}

export interface DetectedPattern {
  patternId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affectedEntities: string[];
  activities: string[];
  timestamp: Date;
}

export interface ThreatSignature {
  signature: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activities: Activity[];
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
  learnedTraits: Map<string, number>;
}

export class SurveillanceEngine {
  private knownPatterns: Map<string, ThreatPattern>;
  private detectedPatterns: Map<string, DetectedPattern[]>;
  private activityHistory: Map<string, Activity[]>;
  private threatSignatures: Map<string, ThreatSignature>;
  private learnedThreatTraits: Map<string, number>;
  private readonly maxHistorySize = 10000;

  constructor() {
    this.knownPatterns = new Map();
    this.detectedPatterns = new Map();
    this.activityHistory = new Map();
    this.threatSignatures = new Map();
    this.learnedThreatTraits = new Map();
    this.initializeKnownPatterns();
  }

  /**
   * Initialize known threat patterns
   */
  private initializeKnownPatterns(): void {
    // Treasury drain patterns
    this.registerPattern({
      patternId: 'treasury-drain',
      name: 'Treasury Drain Attack',
      description: 'Multiple large transfers out of DAO treasury',
      indicators: [
        'multiple_transfers',
        'large_amounts',
        'short_timeframe',
        'suspicious_recipients'
      ],
      severity: 'critical',
      confidence: 0.85,
      categories: ['treasury', 'attack', 'financial']
    });

    // Governance takeover patterns
    this.registerPattern({
      patternId: 'governance-takeover',
      name: 'Governance Takeover Attempt',
      description: 'Coordinated voting to seize DAO control',
      indicators: [
        'sudden_voting_surge',
        'coordinated_delegates',
        'voting_bloc_formation',
        'proposal_spam'
      ],
      severity: 'critical',
      confidence: 0.80,
      categories: ['governance', 'attack', 'voting']
    });

    // Sybil attack patterns
    this.registerPattern({
      patternId: 'sybil-attack',
      name: 'Sybil Attack',
      description: 'Many fake accounts voting identically',
      indicators: [
        'similar_voting_behavior',
        'identical_timestamps',
        'similar_profiles',
        'coordinated_actions'
      ],
      severity: 'high',
      confidence: 0.75,
      categories: ['governance', 'attack', 'identity']
    });

    // Flash loan attack patterns
    this.registerPattern({
      patternId: 'flash-loan-attack',
      name: 'Flash Loan Attack',
      description: 'Sudden large balance changes followed by immediate reversal',
      indicators: ['sudden_balance_spike', 'immediate_transfer', 'same_block', 'voting_with_borrowed'],
      severity: 'high',
      confidence: 0.70,
      categories: ['treasury', 'attack', 'financial']
    });

    // Insider trading patterns
    this.registerPattern({
      patternId: 'insider-trading',
      name: 'Insider Trading',
      description: 'Trades before major governance announcements',
      indicators: ['trades_before_announcement', 'large_volumes', 'abnormal_timing'],
      severity: 'medium',
      confidence: 0.65,
      categories: ['governance', 'fraud', 'timing']
    });

    // Member exodus pattern
    this.registerPattern({
      patternId: 'member-exodus',
      name: 'Member Mass Exodus',
      description: 'Unusual number of members leaving DAO',
      indicators: ['sudden_exits', 'low_engagement', 'delegate_changes', 'delegation_removals'],
      severity: 'medium',
      confidence: 0.60,
      categories: ['community', 'health', 'retention']
    });

    // Proposal spam pattern
    this.registerPattern({
      patternId: 'proposal-spam',
      name: 'Proposal Spam',
      description: 'Excessive proposals in short timeframe',
      indicators: ['proposal_volume_spike', 'low_quality', 'rapid_submission', 'rejection_rate'],
      severity: 'low',
      confidence: 0.55,
      categories: ['governance', 'spam', 'quality']
    });
  }

  /**
   * Register a new threat pattern
   */
  registerPattern(pattern: ThreatPattern): void {
    this.knownPatterns.set(pattern.patternId, pattern);
  }

  /**
   * Monitor a DAO for suspicious activities
   */
  async monitorDAO(daoId: string, recentActivities: Activity[]): Promise<DetectedPattern[]> {
    const detectedPatterns: DetectedPattern[] = [];

    // Store activities
    this.storeActivities(daoId, recentActivities);

    // Check each pattern
    for (const [patternId, pattern] of this.knownPatterns) {
      const matches = await this.detectPattern(daoId, pattern, recentActivities);
      if (matches.length > 0) {
        const detected: DetectedPattern = {
          patternId,
          type: pattern.name,
          severity: pattern.severity,
          confidence: this.calculatePatternConfidence(matches, pattern),
          affectedEntities: this.extractAffectedEntities(matches),
          activities: matches.map(m => m.activityId),
          timestamp: new Date()
        };

        detectedPatterns.push(detected);
        this.storeDetectedPattern(daoId, detected);
      }
    }

    // Learn from detected patterns
    for (const pattern of detectedPatterns) {
      this.learnFromPattern(pattern);
    }

    return detectedPatterns;
  }

  /**
   * Detect if activities match a threat pattern
   */
  private async detectPattern(
    daoId: string,
    pattern: ThreatPattern,
    activities: Activity[]
  ): Promise<Activity[]> {
    const matchedActivities: Activity[] = [];

    for (const activity of activities) {
      const score = this.calculateActivityRiskScore(activity, pattern);
      if (score > 0.6) {
        activity.riskScore = score;
        activity.anomalous = true;
        matchedActivities.push(activity);
      }
    }

    // Check for temporal clustering (multiple activities in short window)
    if (matchedActivities.length >= 3) {
      const timeWindow = 3600000; // 1 hour
      const firstTime = matchedActivities[0].timestamp.getTime();
      const lastTime = matchedActivities[matchedActivities.length - 1].timestamp.getTime();

      if (lastTime - firstTime > timeWindow) {
        return [];
      }
    }

    return matchedActivities;
  }

  /**
   * Calculate risk score for an activity against a pattern
   */
  private calculateActivityRiskScore(activity: Activity, pattern: ThreatPattern): number {
    let score = 0;

    // Check indicators
    for (const indicator of pattern.indicators) {
      if (this.matchesIndicator(activity, indicator)) {
        score += 0.15;
      }
    }

    // Boost score if has learned threat traits
    const activitySignature = `${activity.type}:${activity.userId}`;
    const traitScore = this.learnedThreatTraits.get(activitySignature) || 0;
    score = Math.min(1.0, score + traitScore * 0.1);

    return score;
  }

  /**
   * Check if activity matches an indicator
   */
  private matchesIndicator(activity: Activity, indicator: string): boolean {
    const details = activity.details;

    switch (indicator) {
      case 'multiple_transfers':
        return activity.type === 'transfer' && (details.count || 1) > 1;
      case 'large_amounts':
        return details.amount && details.amount > 100000;
      case 'short_timeframe':
        return (details.timeframeHours || 0) < 24;
      case 'sudden_voting_surge':
        return activity.type === 'vote' && (details.voteCount || 1) > 50;
      case 'sudden_balance_spike':
        return details.balanceChange && Math.abs(details.balanceChange) > 1000000;
      case 'proposal_volume_spike':
        return (details.proposalCount || 0) > 10 && (details.periodHours || 0) < 24;
      case 'sudden_exits':
        return activity.type === 'leave' && (details.exitCount || 1) > 20;
      default:
        return false;
    }
  }

  /**
   * Calculate confidence score for detected pattern
   */
  private calculatePatternConfidence(activities: Activity[], pattern: ThreatPattern): number {
    let confidence = pattern.confidence;

    // Increase confidence with more matching activities
    confidence = Math.min(0.95, confidence + activities.length * 0.02);

    // Increase if activities are recent
    const recentCount = activities.filter(
      a => Date.now() - a.timestamp.getTime() < 3600000
    ).length;
    confidence = Math.min(0.95, confidence + recentCount * 0.05);

    return confidence;
  }

  /**
   * Store activities in history
   */
  private storeActivities(daoId: string, activities: Activity[]): void {
    if (!this.activityHistory.has(daoId)) {
      this.activityHistory.set(daoId, []);
    }

    const history = this.activityHistory.get(daoId)!;
    history.push(...activities);

    // Maintain size limit
    if (history.length > this.maxHistorySize) {
      const excess = history.length - this.maxHistorySize;
      this.activityHistory.set(daoId, history.slice(excess));
    }
  }

  /**
   * Store detected pattern
   */
  private storeDetectedPattern(daoId: string, pattern: DetectedPattern): void {
    if (!this.detectedPatterns.has(daoId)) {
      this.detectedPatterns.set(daoId, []);
    }

    const patterns = this.detectedPatterns.get(daoId)!;
    patterns.push(pattern);

    // Keep last 1000 patterns
    if (patterns.length > 1000) {
      this.detectedPatterns.set(daoId, patterns.slice(-1000));
    }
  }

  /**
   * Extract entities affected by pattern
   */
  private extractAffectedEntities(activities: Activity[]): string[] {
    const entities = new Set<string>();

    for (const activity of activities) {
      entities.add(activity.userId);
      if (activity.details.recipient) {
        entities.add(activity.details.recipient);
      }
    }

    return Array.from(entities);
  }

  /**
   * Learn from detected patterns to improve future detection
   */
  private learnFromPattern(pattern: DetectedPattern): void {
    // Increase threat trait scores for entities involved
    for (const entityId of pattern.affectedEntities) {
      const traitKey = `threat_actor:${entityId}`;
      const current = this.learnedThreatTraits.get(traitKey) || 0;
      this.learnedThreatTraits.set(traitKey, current + 0.1);
    }

    // Remember pattern signatures
    const signature = JSON.stringify({
      type: pattern.type,
      entities: pattern.affectedEntities.sort()
    });

    if (!this.threatSignatures.has(signature)) {
      this.threatSignatures.set(signature, {
        signature,
        threatLevel: pattern.severity,
        activities: [],
        firstSeen: pattern.timestamp,
        lastSeen: pattern.timestamp,
        occurrenceCount: 1,
        learnedTraits: new Map()
      });
    } else {
      const sig = this.threatSignatures.get(signature)!;
      sig.lastSeen = pattern.timestamp;
      sig.occurrenceCount++;
    }
  }

  /**
   * Get activity history for a DAO
   */
  getActivityHistory(daoId: string, limit: number = 100): Activity[] {
    const history = this.activityHistory.get(daoId) || [];
    return history.slice(-limit);
  }

  /**
   * Get detected patterns for a DAO
   */
  getDetectedPatterns(daoId: string, limit: number = 50): DetectedPattern[] {
    const patterns = this.detectedPatterns.get(daoId) || [];
    return patterns.slice(-limit);
  }

  /**
   * Get threat signatures
   */
  getThreatSignatures(): ThreatSignature[] {
    return Array.from(this.threatSignatures.values());
  }

  /**
   * Calculate preemptive suspicion score based on learned traits
   */
  getPreemptiveSuspicionScore(userId: string): number {
    const traitKey = `threat_actor:${userId}`;
    const score = this.learnedThreatTraits.get(traitKey) || 0;
    return Math.min(1.0, score);
  }

  /**
   * Clear old data
   */
  prune(maxAgeDays: number = 30): void {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    // Clear old activities
    for (const [daoId, activities] of this.activityHistory) {
      const filtered = activities.filter(a => a.timestamp.getTime() > cutoffTime);
      this.activityHistory.set(daoId, filtered);
    }

    // Clear old threat signatures
    for (const [signature, threatSig] of this.threatSignatures) {
      if (threatSig.lastSeen.getTime() < cutoffTime) {
        this.threatSignatures.delete(signature);
      }
    }
  }
}
