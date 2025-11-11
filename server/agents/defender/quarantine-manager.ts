
/**
 * Quarantine Manager
 * Manages quarantined agents and their isolation
 */

import { QuarantinePolicy } from './types';

export class QuarantineManager {
  private quarantinedAgents: Set<string> = new Set();
  private quarantinePolicies: Map<string, {
    timestamp: Date;
    policy: QuarantinePolicy;
    violations: string[];
  }> = new Map();

  quarantineAgent(agentId: string, policy: QuarantinePolicy): boolean {
    try {
      this.quarantinedAgents.add(agentId);
      this.quarantinePolicies.set(agentId, {
        timestamp: new Date(),
        policy,
        violations: policy.violations || []
      });
      
      console.log(`[DEFENDER] Agent ${agentId} quarantined with policy:`, policy);
      return true;
    } catch (error) {
      console.error(`[DEFENDER] Failed to quarantine agent ${agentId}:`, error);
      return false;
    }
  }

  releaseAgent(agentId: string): boolean {
    try {
      this.quarantinedAgents.delete(agentId);
      this.quarantinePolicies.delete(agentId);
      
      console.log(`[DEFENDER] Agent ${agentId} released from quarantine`);
      return true;
    } catch (error) {
      console.error(`[DEFENDER] Failed to release agent ${agentId}:`, error);
      return false;
    }
  }

  isQuarantined(agentId: string): boolean {
    return this.quarantinedAgents.has(agentId);
  }

  getQuarantineStatus() {
    return {
      quarantinedCount: this.quarantinedAgents.size,
      quarantinedAgents: Array.from(this.quarantinedAgents),
      policies: Object.fromEntries(this.quarantinePolicies)
    };
  }

  addViolation(agentId: string, violation: string): void {
    const policy = this.quarantinePolicies.get(agentId);
    if (policy) {
      policy.violations.push(violation);
      this.quarantinePolicies.set(agentId, policy);
    }
  }

  getPolicy(agentId: string): QuarantinePolicy | undefined {
    return this.quarantinePolicies.get(agentId)?.policy;
  }
}
