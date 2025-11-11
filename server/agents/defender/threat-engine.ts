
/**
 * Threat Detection Engine
 * Advanced behavioral analysis and pattern matching
 */

import { ThreatSignature, ThreatLevel, AgentBehavior } from './types';

export class ThreatDetectionEngine {
  private signatures: Record<string, ThreatSignature> = {};
  private behavioralBaselines: Record<string, {
    cpuAvg: number;
    memoryAvg: number;
    networkAvg: number;
  }> = {};
  private readonly anomalyThreshold = 0.7;

  constructor() {
    this.initializeSignatures();
  }

  private initializeSignatures(): void {
    this.signatures = {
      data_exfiltration: {
        signatureId: 'data_exfil_001',
        pattern: {
          highNetworkOutput: (x) => (x.network_output || 0) > 1000,
          unusualDataAccess: (x) => (x.data_access_rate || 0) > 50,
          encryptionActivity: (x) => (x.crypto_operations || 0) > 100
        },
        severity: ThreatLevel.HIGH,
        confidence: 0.85,
        createdAt: new Date()
      },
      system_infiltration: {
        signatureId: 'sys_infil_001',
        pattern: {
          privilegeEscalation: (x) => (x.privilege_requests || 0) > 5,
          systemFileAccess: (x) => (x.system_access || 0) > 10,
          processInjection: (x) => (x.process_creation || 0) > 20
        },
        severity: ThreatLevel.CRITICAL,
        confidence: 0.9,
        createdAt: new Date()
      },
      resource_abuse: {
        signatureId: 'resource_abuse_001',
        pattern: {
          cpuSpike: (x) => (x.cpu_usage || 0) > 0.8,
          memoryLeak: (x) => (x.memory_growth || 0) > 0.5,
          networkFlood: (x) => (x.connection_count || 0) > 1000
        },
        severity: ThreatLevel.MODERATE,
        confidence: 0.75,
        createdAt: new Date()
      }
    };
  }

  analyzeBehavior(behavior: AgentBehavior): {
    threatLevel: ThreatLevel;
    confidence: number;
    matchedSignatures: string[];
  } {
    let maxThreat = ThreatLevel.BENIGN;
    let maxConfidence = 0.0;
    const matchedSignatures: string[] = [];

    // Check against known signatures
    for (const [sigName, signature] of Object.entries(this.signatures)) {
      let matches = 0;
      const totalPatterns = Object.keys(signature.pattern).length;

      for (const patternFunc of Object.values(signature.pattern)) {
        if (patternFunc(behavior.anomalyIndicators)) {
          matches++;
        }
      }

      const matchRatio = totalPatterns > 0 ? matches / totalPatterns : 0;

      if (matchRatio >= 0.6) { // 60% pattern match threshold
        if (signature.severity > maxThreat) {
          maxThreat = signature.severity;
          maxConfidence = signature.confidence * matchRatio;
        }
        matchedSignatures.push(sigName);
      }
    }

    // Behavioral baseline analysis
    const baselineScore = this.checkBehavioralBaseline(behavior);
    if (baselineScore > this.anomalyThreshold) {
      if (maxThreat < ThreatLevel.SUSPICIOUS) {
        maxThreat = ThreatLevel.SUSPICIOUS;
        maxConfidence = Math.max(maxConfidence, baselineScore);
      }
    }

    return { threatLevel: maxThreat, confidence: maxConfidence, matchedSignatures };
  }

  private checkBehavioralBaseline(behavior: AgentBehavior): number {
    const agentId = behavior.agentId;

    if (!this.behavioralBaselines[agentId]) {
      // Initialize baseline for new agent
      this.behavioralBaselines[agentId] = {
        cpuAvg: 0.1,
        memoryAvg: 0.1,
        networkAvg: 10.0
      };
      return 0.0;
    }

    const baseline = this.behavioralBaselines[agentId];
    
    // Compare current behavior to baseline
    const cpuDeviation = Math.abs(
      (behavior.anomalyIndicators.cpu_usage || 0) - baseline.cpuAvg
    );
    const memoryDeviation = Math.abs(
      (behavior.anomalyIndicators.memory_usage || 0) - baseline.memoryAvg
    );
    const networkDeviation = Math.abs(
      (behavior.anomalyIndicators.network_activity || 0) - baseline.networkAvg
    );

    const anomalyScore = Math.min(1.0, (cpuDeviation + memoryDeviation + networkDeviation) / 3);

    return anomalyScore;
  }

  updateBaseline(agentId: string, behavior: AgentBehavior): void {
    if (!this.behavioralBaselines[agentId]) {
      this.behavioralBaselines[agentId] = {
        cpuAvg: 0.1,
        memoryAvg: 0.1,
        networkAvg: 10.0
      };
    }

    const baseline = this.behavioralBaselines[agentId];
    const alpha = 0.1; // Learning rate

    baseline.cpuAvg = baseline.cpuAvg * (1 - alpha) + (behavior.anomalyIndicators.cpu_usage || 0) * alpha;
    baseline.memoryAvg = baseline.memoryAvg * (1 - alpha) + (behavior.anomalyIndicators.memory_usage || 0) * alpha;
    baseline.networkAvg = baseline.networkAvg * (1 - alpha) + (behavior.anomalyIndicators.network_activity || 0) * alpha;
  }
}
