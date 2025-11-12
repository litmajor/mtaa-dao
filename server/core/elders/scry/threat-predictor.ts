/**
 * Threat Predictor for ELD-SCRY
 * 
 * AI-based forecasting of potential threats and DAO health issues
 * Uses historical data and current trends to predict future problems
 */

export interface HealthData {
  timestamp: Date;
  score: number;
  treasury: number;
  governance: number;
  community: number;
  system: number;
}

export interface HealthForecast {
  daoId: string;
  timeframeHours: number;
  predictedScore: number;
  confidence: number;
  riskFactors: RiskFactor[];
  earlyWarnings: EarlyWarning[];
  interventionRecommendations: string[];
  timestamp: Date;
}

export interface RiskFactor {
  category: 'treasury' | 'governance' | 'community' | 'system';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impact: number; // 0-100
  description: string;
}

export interface EarlyWarning {
  id: string;
  severity: 'warning' | 'alert' | 'critical';
  message: string;
  targetScore?: number;
  timeToEvent?: number; // hours
  requiredAction?: string;
}

export interface TrendAnalysis {
  category: string;
  currentValue: number;
  trend: 'improving' | 'stable' | 'declining' | 'volatile';
  trendStrength: number; // 0-1
  projectedValue: number;
  slope: number; // rate of change
  volatility: number; // standard deviation
}

export class ThreatPredictor {
  private historicalData: Map<string, HealthData[]>;
  private readonly maxHistorySize = 8760; // 1 year of hourly data
  private readonly forecastModels = ['linear', 'exponential', 'arima'];

  constructor() {
    this.historicalData = new Map();
  }

  /**
   * Record health data for a DAO
   */
  recordHealthData(daoId: string, data: HealthData): void {
    if (!this.historicalData.has(daoId)) {
      this.historicalData.set(daoId, []);
    }

    const history = this.historicalData.get(daoId)!;
    history.push(data);

    // Maintain size limit
    if (history.length > this.maxHistorySize) {
      const excess = history.length - this.maxHistorySize;
      this.historicalData.set(daoId, history.slice(excess));
    }
  }

  /**
   * Forecast DAO health for next N hours
   */
  async forecastDAOHealth(daoId: string, horizonHours: number = 24): Promise<HealthForecast> {
    const historicalData = this.historicalData.get(daoId) || [];

    if (historicalData.length < 2) {
      return this.createDefaultForecast(daoId, horizonHours);
    }

    // Analyze current trends
    const trendAnalysis = this.analyzeTrends(historicalData);

    // Project each metric
    const projections = {
      score: this.projectMetric(
        historicalData.map(d => d.score),
        horizonHours
      ),
      treasury: this.projectMetric(
        historicalData.map(d => d.treasury),
        horizonHours
      ),
      governance: this.projectMetric(
        historicalData.map(d => d.governance),
        horizonHours
      ),
      community: this.projectMetric(
        historicalData.map(d => d.community),
        horizonHours
      ),
      system: this.projectMetric(
        historicalData.map(d => d.system),
        horizonHours
      )
    };

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(trendAnalysis, projections);

    // Generate early warnings
    const earlyWarnings = this.generateEarlyWarnings(projections, riskFactors);

    // Get intervention recommendations
    const interventions = this.suggestInterventions(riskFactors, earlyWarnings);

    // Calculate confidence
    const confidence = this.calculateForecastConfidence(historicalData, horizonHours);

    return {
      daoId,
      timeframeHours: horizonHours,
      predictedScore: projections.score.value,
      confidence,
      riskFactors,
      earlyWarnings,
      interventionRecommendations: interventions,
      timestamp: new Date()
    };
  }

  /**
   * Analyze trends in health data
   */
  private analyzeTrends(data: HealthData[]): Map<string, TrendAnalysis> {
    const trends = new Map<string, TrendAnalysis>();
    const categories = ['score', 'treasury', 'governance', 'community', 'system'] as const;

    for (const category of categories) {
      const values = data.map(d => d[category]);
      const currentValue = values[values.length - 1];

      // Calculate slope (simple linear regression)
      const slope = this.calculateSlope(values);

      // Calculate volatility
      const volatility = this.calculateVolatility(values);

      // Determine trend direction
      let trend: 'improving' | 'stable' | 'declining' | 'volatile';
      if (volatility > 0.2) {
        trend = 'volatile';
      } else if (slope > 2) {
        trend = 'improving';
      } else if (slope < -2) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      // Project value
      const projectedValue = Math.min(100, Math.max(0, currentValue + slope * 24));

      trends.set(category, {
        category,
        currentValue,
        trend,
        trendStrength: Math.abs(slope) / 10,
        projectedValue,
        slope,
        volatility
      });
    }

    return trends;
  }

  /**
   * Project metric for N hours ahead
   */
  private projectMetric(values: number[], horizonHours: number) {
    if (values.length < 2) {
      return { value: values[0] || 50, confidence: 0.3 };
    }

    // Simple linear projection
    const recentValues = values.slice(-24); // Last 24 data points
    const slope = this.calculateSlope(recentValues);
    const baseValue = values[values.length - 1];

    const projectedValue = Math.min(100, Math.max(0, baseValue + slope * horizonHours));

    // Calculate confidence based on stability
    const volatility = this.calculateVolatility(recentValues);
    const confidence = Math.max(0.3, 1.0 - volatility * 0.5);

    return { value: projectedValue, confidence };
  }

  /**
   * Calculate slope using simple linear regression
   */
  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const avgX = (n - 1) / 2;

    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumXY += (i - avgX) * values[i];
      sumX2 += (i - avgX) * (i - avgX);
    }

    return sumX2 === 0 ? 0 : sumXY / sumX2;
  }

  /**
   * Calculate volatility (standard deviation)
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / (mean || 1);
  }

  /**
   * Identify risk factors from trends
   */
  private identifyRiskFactors(
    trends: Map<string, TrendAnalysis>,
    projections: Record<string, { value: number; confidence: number }>
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Treasury risks
    const treasuryTrend = trends.get('treasury')!;
    if (treasuryTrend.trend === 'declining' && treasuryTrend.projectedValue < 30) {
      risks.push({
        category: 'treasury',
        riskLevel: 'critical',
        probability: treasuryTrend.trendStrength,
        impact: 90,
        description: 'Projected treasury depletion within forecast period'
      });
    }

    if (treasuryTrend.volatility > 0.3) {
      risks.push({
        category: 'treasury',
        riskLevel: 'high',
        probability: treasuryTrend.volatility,
        impact: 70,
        description: 'High treasury volatility indicating potential fund mismanagement'
      });
    }

    // Governance risks
    const governanceTrend = trends.get('governance')!;
    if (governanceTrend.trend === 'declining' && governanceTrend.projectedValue < 40) {
      risks.push({
        category: 'governance',
        riskLevel: 'high',
        probability: governanceTrend.trendStrength,
        impact: 75,
        description: 'Declining governance health suggests participation crisis'
      });
    }

    // Community risks
    const communityTrend = trends.get('community')!;
    if (communityTrend.trend === 'declining' && communityTrend.trendStrength > 0.5) {
      risks.push({
        category: 'community',
        riskLevel: 'medium',
        probability: communityTrend.trendStrength,
        impact: 60,
        description: 'Community health declining - member retention at risk'
      });
    }

    // System risks
    const systemTrend = trends.get('system')!;
    if (systemTrend.volatility > 0.4) {
      risks.push({
        category: 'system',
        riskLevel: 'high',
        probability: systemTrend.volatility * 0.8,
        impact: 65,
        description: 'System instability detected - operational reliability compromised'
      });
    }

    // Score risks
    const scoreTrend = trends.get('score')!;
    if (scoreTrend.trend === 'declining' && scoreTrend.projectedValue < 50) {
      risks.push({
        category: 'system',
        riskLevel: 'critical',
        probability: scoreTrend.trendStrength,
        impact: 100,
        description: 'Overall DAO health in critical decline'
      });
    }

    return risks;
  }

  /**
   * Generate early warnings
   */
  private generateEarlyWarnings(
    projections: Record<string, { value: number; confidence: number }>,
    riskFactors: RiskFactor[]
  ): EarlyWarning[] {
    const warnings: EarlyWarning[] = [];
    let id = 0;

    // High-probability critical risks
    for (const risk of riskFactors) {
      if (risk.riskLevel === 'critical' && risk.probability > 0.6) {
        warnings.push({
          id: `warning_${++id}`,
          severity: 'critical',
          message: risk.description,
          targetScore: risk.impact,
          timeToEvent: 12,
          requiredAction: this.getActionForRisk(risk)
        });
      }
    }

    // Treasury depletion warning
    if (projections.treasury.value < 50) {
      warnings.push({
        id: `warning_${++id}`,
        severity: 'alert',
        message: 'Treasury reserves projected to drop below 50% capacity',
        targetScore: Math.round(projections.treasury.value),
        requiredAction: 'Review treasury spending and approve new funding sources'
      });
    }

    // Governance participation warning
    if (projections.governance.value < 45) {
      warnings.push({
        id: `warning_${++id}`,
        severity: 'alert',
        message: 'Governance participation declining - democracy at risk',
        targetScore: Math.round(projections.governance.value),
        requiredAction: 'Incentivize member participation, review proposal quality'
      });
    }

    return warnings;
  }

  /**
   * Get recommended action for risk
   */
  private getActionForRisk(risk: RiskFactor): string {
    const actions: Record<string, Record<string, string>> = {
      treasury: {
        critical: 'Immediately audit treasury operations and freeze non-essential spending',
        high: 'Review treasury allocation and implement spending caps',
        medium: 'Monitor treasury health and prepare contingency plans'
      },
      governance: {
        critical: 'Emergency DAO meeting required - governance integrity threatened',
        high: 'Increase proposal quality standards and implement participation incentives',
        medium: 'Monitor governance metrics and adjust voting parameters'
      },
      community: {
        critical: 'Launch community retention initiative immediately',
        high: 'Analyze member departures and implement re-engagement campaign',
        medium: 'Monitor member engagement and provide regular updates'
      },
      system: {
        critical: 'System failure risk - conduct emergency security audit',
        high: 'Investigate system instability and implement stabilization measures',
        medium: 'Monitor system performance and prepare escalation procedures'
      }
    };

    return actions[risk.category]?.[risk.riskLevel] || 'Monitor situation and reassess';
  }

  /**
   * Suggest interventions
   */
  private suggestInterventions(riskFactors: RiskFactor[], warnings: EarlyWarning[]): string[] {
    const interventions: string[] = [];

    // Add action from critical warnings
    for (const warning of warnings) {
      if (warning.requiredAction && warning.severity === 'critical') {
        interventions.push(warning.requiredAction);
      }
    }

    // Add high-impact interventions
    for (const risk of riskFactors) {
      if (risk.impact > 75) {
        interventions.push(this.getActionForRisk(risk));
      }
    }

    // Remove duplicates
    return [...new Set(interventions)];
  }

  /**
   * Calculate forecast confidence based on data quality
   */
  private calculateForecastConfidence(data: HealthData[], horizonHours: number): number {
    let confidence = 0.5; // Base confidence

    // More historical data increases confidence
    confidence += Math.min(0.3, data.length / 1000);

    // Shorter horizons are more confident
    confidence += Math.max(0, 0.2 - horizonHours / 500);

    // Stability increases confidence
    const stability = 1 - this.calculateVolatility(data.map(d => d.score));
    confidence += stability * 0.2;

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  /**
   * Get historical data for a DAO
   */
  getHistoricalData(daoId: string, limit: number = 168): HealthData[] {
    const data = this.historicalData.get(daoId) || [];
    return data.slice(-limit);
  }

  /**
   * Create default forecast when insufficient data
   */
  private createDefaultForecast(daoId: string, horizonHours: number): HealthForecast {
    return {
      daoId,
      timeframeHours: horizonHours,
      predictedScore: 75,
      confidence: 0.3,
      riskFactors: [
        {
          category: 'system',
          riskLevel: 'low',
          probability: 0.3,
          impact: 20,
          description: 'Insufficient historical data for accurate forecast'
        }
      ],
      earlyWarnings: [
        {
          id: 'warning_1',
          severity: 'warning',
          message: 'Forecast accuracy limited - collecting more data',
          requiredAction: 'Continue normal operations, check again in 24 hours'
        }
      ],
      interventionRecommendations: [],
      timestamp: new Date()
    };
  }

  /**
   * Clear old data
   */
  prune(maxAgeDays: number = 365): void {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    for (const [daoId, data] of this.historicalData) {
      const filtered = data.filter(d => d.timestamp.getTime() > cutoffTime);
      this.historicalData.set(daoId, filtered);
    }
  }
}
