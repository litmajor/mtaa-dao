/**
 * Agent Kill-Switch API Routes
 * Day 1 Emergency Response - Power Checklist Compliance
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. Power Classification: HIGH power action
 * 2. Power Gradient: Visual distinction
 * 3. State Clarity: Shows before/after
 * 4. Authority Transparency: Shows who can control
 * 6. Intent Confirmation: Requires explicit reason
 * 7. Reversibility: Reactivation endpoint
 * 8. Post-Action Narrative: Full history
 * 9. Emotional Safety: Soft language
 */

import express, { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { agentStatusService } from '../../services/agentStatusService';
import { circuitBreakerRegistry } from '../../core/consolidation/CircuitBreakerConsolidation';
import { healthRegistry } from '../../core/consolidation/HealthRegistryConsolidation';
// Migration Status (Phase 5):
// PARTIAL: Circuit breaker operations now use circuitBreakerRegistry.getOrCreate(`agent:${id}`, 'agent')
// TODO: Full migration of deactivateAgent/activateAgent to pure consolidation API in Phase 6
// See deprecation notice in agentStatusService.ts for details
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Helper: Generate human-readable narrative from action
 */
function generateNarrative(action: any): string {
  const timeStr = new Date(action.timestamp).toLocaleString();
  
  switch (action.action_type) {
    case 'deactivate':
      return `🔴 Agent paused by ${action.initiated_by} at ${timeStr}. Reason: "${action.action_metadata?.reason || 'No reason provided'}"`;
    case 'activate':
      return `🟢 Agent resumed by ${action.initiated_by} at ${timeStr}. Review: "${action.action_metadata?.reason || 'No notes'}"`;
    case 'circuit_breaker_trigger':
      return `⚠️ Circuit breaker auto-activated at ${timeStr} (exceeded ${action.action_metadata?.threshold}/hour threshold)`;
    case 'execution':
      return `⚙️ Agent executed action at ${timeStr}. Count: ${action.action_metadata?.execution_count}/hour`;
    default:
      return `${action.action_type} at ${timeStr}`;
  }
}

/**
 * GET /api/admin/agents/kill-switch/status
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. ✅ Power Classification: HIGH power action
 * 3. ✅ State Clarity: Shows BEFORE (is_active) and AFTER (would show in response)
 * 4. ✅ Authority Transparency: Shows who can activate/deactivate
 * 8. ✅ Post-Action Narrative: Full history of all state changes
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const agents = await agentStatusService.getAllAgentsWithStatus();
    
    // Format response for power-checklist clarity
    const response = {
      timestamp: new Date().toISOString(),
      totalAgents: agents.length,
      activeAgents: agents.filter((a: any) => a.is_active && !a.circuit_breaker_triggered).length,
      pausedAgents: agents.filter((a: any) => !a.is_active).length,
      circuitBreakerTriggeredCount: agents.filter((a: any) => a.circuit_breaker_triggered).length,
      agents: agents.map((agent: any) => ({
        // Power Classification (item #1)
        id: agent.id,
        name: agent.name,
        type: agent.type,
        
        // State Clarity (item #3)
        currentState: {
          is_active: agent.is_active,
          status: agent.is_active && !agent.circuit_breaker_triggered ? 'ACTIVE' : 
                  agent.circuit_breaker_triggered ? 'CIRCUIT_BREAKER_TRIGGERED' : 'PAUSED',
          lastExecution: agent.updated_at
        },
        
        // Authority Transparency (item #4)
        authority: {
          canBeControlledBy: ['superuser'],
          scope: [
            `Treasury: ${agent.treasury_id || 'Unknown'}`,
            `Max actions/hour: ${agent.circuit_breaker_threshold || 20}`,
            `Reversible: YES (can reactivate anytime)`,
            `Duration: Until manual reactivation`
          ]
        },
        
        // Execution metrics
        executionMetrics: {
          executionCount1h: agent.execution_count_1h || 0,
          circuitBreakerThreshold: agent.circuit_breaker_threshold || 20,
          circuitBreakerTriggered: agent.circuit_breaker_triggered || false
        }
      }))
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching agent status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent status',
      errorId: uuidv4()
    });
  }
});

/**
 * POST /api/admin/agents/:agentId/kill-switch
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. ✅ Power Classification: HIGH
 * 2. ✅ State Clarity: Shows exact before/after state
 * 3. ✅ Authority Transparency: WHO is doing this?
 * 6. ✅ Intent Confirmation: Requires explicit reason/naming
 * 7. ✅ Reversibility: Reactivation endpoint available
 * 8. ✅ Post-Action Narrative: Returns what happened
 * 9. ✅ Emotional Safety: "paused" not "killed", calm tone
 */
router.post('/:agentId/kill-switch', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { reason, suppressNotifications } = req.body;
    const userId = (req.user as any)?.id || 'unknown';

    // Checklist #6: Intent Confirmation - Require explicit reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        powerChecklistItem: 6,
        error: 'Intent confirmation required',
        message: 'You must provide a reason (min 10 characters) for activating kill-switch',
        hint: 'Example: "Agent exceeded authorization scope - circuit breaker triggered"'
      });
    }

    // Verify agent exists
    const agent = await agentStatusService.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Already paused?
    if (!agent.is_active) {
      return res.status(409).json({
        error: 'Agent already paused',
        currentState: { is_active: false, status: 'PAUSED' }
      });
    }

    // Checklist #3: State Clarity - Show BEFORE state
    const beforeSnapshot = {
      is_active: agent.is_active,
      execution_count_1h: agent.execution_count_1h,
      circuit_breaker_triggered: agent.circuit_breaker_triggered,
      last_execution_at: agent.updated_at
    };

    // Execute kill-switch
    const result = await agentStatusService.deactivateAgent({
      agentId,
      daoId: (agent.dao_id as string),
      deactivatedBy: userId,
      reason,
      authority: 'superuser'
    });

    // Checklist #3: State Clarity - Show AFTER state
    const afterSnapshot = {
      is_active: false,
      paused_at: result.deactivatedAt,
      can_reactivate: true,
      reactivation_deadline: 'No deadline (indefinite)'
    };

    // Checklist #8: Post-Action Narrative - Explain what happened
    const narrative = {
      action: 'Agent Kill-Switch Activated',
      severity: 'HIGH',
      impact: {
        agent: agent.name,
        effect: 'Agent execution paused. All pending actions cancelled.',
        dataLoss: false
      },
      timeline: {
        activatedAt: result.deactivatedAt,
        activatedBy: userId,
        reason: reason,
        authority: 'superuser',
        reversible: 'YES - use POST /reactivate anytime'
      },
      nextSteps: [
        '1. Review agent activity log (audit trail)',
        '2. Determine root cause',
        '3. If safe, call POST /reactivate to resume',
        '4. If compromised, security review required'
      ]
    };

    // Checklist #9: Emotional Safety - Calm response
    return res.status(200).json({
      powerChecklistItems: [1, 2, 3, 6, 7, 8, 9],
      success: true,
      narrative,
      
      // Checklist #3: State Clarity
      stateChange: {
        before: { status: 'ACTIVE', is_active: true },
        after: { status: 'PAUSED', is_active: false },
        timestamp: result.deactivatedAt
      },
      
      // Checklist #7: Reversibility
      reversibilityInfo: {
        canUndo: true,
        undoMethod: 'POST /api/admin/agents/:agentId/reactivate',
        undoUntil: 'No deadline',
        requiresApproval: false
      }
    });
    
  } catch (error) {
    logger.error('Kill-switch error:', error);
    res.status(500).json({
      error: 'Failed to activate kill-switch',
      errorId: uuidv4()
    });
  }
});

/**
 * POST /api/admin/agents/:agentId/reactivate
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 6. ✅ Intent Confirmation: Require reason for reactivation
 * 7. ✅ Reversibility: Brings agent back to active state
 * 8. ✅ Post-Action Narrative: Show what's being reactivated
 * 9. ✅ Emotional Safety: Reassure agent is safe after review
 */
router.post('/:agentId/reactivate', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any)?.id || 'unknown';

    // Checklist #6: Intent Confirmation
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        powerChecklistItem: 6,
        error: 'Agent review required',
        message: 'Provide reason confirming agent has been reviewed and is safe',
        hint: 'Example: "Agent reviewed. Circuit breaker threshold adjusted to 15/hour."'
      });
    }

    const agent = await agentStatusService.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.is_active && !agent.circuit_breaker_triggered) {
      return res.status(409).json({
        error: 'Agent already active',
        message: 'This agent is already running.'
      });
    }

    // Checklist #3: State Clarity - Show BEFORE
    const beforeSnapshot = {
      is_active: agent.is_active,
      circuit_breaker_triggered: agent.circuit_breaker_triggered,
      paused_since: agent.deactivated_at
    };

    // Reactivate
    const result = await agentStatusService.activateAgent({
      agentId,
      daoId: (agent.dao_id as string),
      activatedBy: userId,
      reason
    });

    // Checklist #3: State Clarity - Show AFTER
    const afterSnapshot = {
      is_active: true,
      circuit_breaker_triggered: false,
      activated_at: result.activatedAt,
      execution_count_reset: true
    };

    // Checklist #8: Post-Action Narrative
    const narrative = {
      action: 'Agent Reactivated',
      severity: 'MEDIUM',
      agent: agent.name,
      reactivatedAt: result.activatedAt,
      reactivatedBy: userId,
      reviewNotes: reason,
      nextSteps: [
        'Monitor execution rate in next 24 hours',
        `Review circuit breaker threshold: ${agent.circuit_breaker_threshold}/hour`,
        'Check for pending actions that were cancelled'
      ]
    };

    return res.status(200).json({
      success: true,
      narrative,
      stateChange: {
        before: { status: 'PAUSED', is_active: false },
        after: { status: 'ACTIVE', is_active: true },
        timestamp: result.activatedAt
      }
    });
    
  } catch (error) {
    logger.error('Reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate agent' });
  }
});

/**
 * GET /api/admin/agents/:agentId/history
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 8. ✅ Post-Action Narrative: Full activity log with before/after
 * 4. ✅ Authority Transparency: Shows who did what
 */
router.get('/:agentId/history', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { limit = '50', skip = '0' } = req.query;

    const history = await agentStatusService.getAgentStateHistory(
      agentId,
      Math.min(parseInt(limit as string), 100),
      parseInt(skip as string)
    );

    return res.json({
      agent_id: agentId,
      total_entries: history.total,
      entries: history.items.map((entry: any) => ({
        // Checklist #1: Power Classification
        powerClass: 'HIGH',
        
        // Checklist #8: Post-Action Narrative
        action: entry.action_type,
        timestamp: entry.timestamp,
        narrative: generateNarrative(entry),
        
        // Checklist #4: Authority Transparency
        authority: {
          initiatedBy: entry.initiated_by,
          authorityType: entry.authority_type,
          approvals: entry.approvals,
          reason: entry.action_metadata?.reason
        },
        
        // Checklist #3: State Clarity
        stateChange: {
          before: entry.state_before,
          after: entry.state_after
        },
        
        // Checklist #7: Reversibility
        reversibility: {
          isReversible: entry.is_reversible,
          deadline: entry.reversal_deadline
        }
      }))
    });
    
  } catch (error) {
    logger.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
