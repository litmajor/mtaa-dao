
/**
 * LUMEN Ethics Module
 * Evaluates defensive actions for ethical compliance
 */

import { ActionType, ThreatLevel, DefenseAction } from './types';

export class EthicsModule {
  private ethicalRules = {
    minimizeHarm: 0.9,
    preserveSystemIntegrity: 0.8,
    respectAgentAutonomy: 0.6,
    transparency: 0.7,
    proportionalResponse: 0.8
  };

  private actionHistory: DefenseAction[] = [];
  private readonly maxHistorySize = 1000;

  reviewAction(
    actionType: ActionType,
    targetAgent: string,
    justification: string,
    threatLevel: ThreatLevel
  ): { approval: boolean; reasoning: string } {
    let ethicalScore = 0.0;
    const reasoning: string[] = [];

    // Proportionality check
    if (threatLevel === ThreatLevel.CRITICAL && 
        (actionType === ActionType.QUARANTINE || actionType === ActionType.ISOLATE)) {
      ethicalScore += 0.3;
      reasoning.push('High threat justifies containment');
    } else if (threatLevel === ThreatLevel.BENIGN && actionType === ActionType.PURGE) {
      ethicalScore -= 0.5;
      reasoning.push('Excessive response to benign threat');
    } else {
      ethicalScore += 0.2;
      reasoning.push('Proportional response');
    }

    // System integrity preservation
    if (justification.toLowerCase().includes('system_critical')) {
      ethicalScore += 0.3;
      reasoning.push('System integrity at risk');
    }

    // Minimize harm principle
    if (actionType === ActionType.MONITOR || actionType === ActionType.ALERT) {
      ethicalScore += 0.2;
      reasoning.push('Non-destructive action preferred');
    } else if (actionType === ActionType.PURGE) {
      ethicalScore -= 0.1;
      reasoning.push('Destructive action requires high justification');
    }

    // Historical behavior consideration
    const recentActions = this.actionHistory.filter(a => a.targetAgent === targetAgent);
    if (recentActions.length > 3) {
      ethicalScore -= 0.2;
      reasoning.push('Repeated targeting may indicate bias');
    }

    const approval = ethicalScore > 0.5;
    return { approval, reasoning: reasoning.join('; ') };
  }

  logAction(action: DefenseAction): void {
    this.actionHistory.push(action);
    
    // Maintain history size limit
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  getActionHistory(): DefenseAction[] {
    return [...this.actionHistory];
  }
}
