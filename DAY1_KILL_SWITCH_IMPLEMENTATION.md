# Day 1 Implementation Guide: Agent Kill-Switch + Power Checklist Compliance

**Date:** Monday, February 13, 2026  
**Hours:** 19 hours (4 tasks, 2 engineers)  
**Goal:** Kill-switch framework + circuit breaker, 100% power checklist compliant  
**Power Checklist Alignment:** Items #1-4, 7-11 (Authority transparency, reversibility, emotional safety, naming, state clarity)

---

## Power Checklist Mapping for Day 1

| Checklist Item | Day 1 Implementation | UI Component |
|---|---|---|
| 1. **Power Classification** | "Agent Kill-Switch" = HIGH power action | Label on button + docs |
| 2. **Power Gradient Enforcement** | Red/orange coloring, prominent display | CSS + visual hierarchy |
| 3. **State Clarity** | Show agent status (active/inactive/paused) BEFORE + AFTER | Status badge + confirmation |
| 4. **Authority Transparency** | Who can activate? Superuser OR approval board. Scope: which treasuries? | Tooltip + permission check |
| 7. **Reversibility** | Can reactivate agents within X days | "Undo" button + timeline |
| 8. **Post-Action Narrative** | Show: what changed, who did it, why, timestamp | Activity log with full context |
| 9. **Emotional Safety** | Calm language, "paused" not "destroyed", clear recovery path | Copy review + colors |
| 10. **Consistency** | Same UX patterns for all agent actions | Design system component |
| 11. **Final Dev Gate** | Code review checklist before merge | QA sign-off template |

---

## Part 1: Database Schema (Foundation)

### Task 1.1a: Agent Status Table Migration

**File:** `server/db/migrations/[TIMESTAMP]_add_agent_kill_switch_support.ts`

```typescript
export async function up(db: Database) {
  // Alter agents table to track kill-switch state
  await db.schema.alterTable('agents', (table) => {
    // Kill-switch fields
    table.boolean('is_active').defaultTo(true).comment('Agent can execute actions');
    table.dateTime('activated_at').nullable().comment('When agent was last activated');
    table.dateTime('deactivated_at').nullable().comment('When agent was last deactivated');
    table.text('deactivation_reason').nullable().comment('Why agent was deactivated');
    table.uuid('deactivated_by').nullable().references('id').inTable('users');
    
    // Circuit breaker fields
    table.integer('execution_count_1h').defaultTo(0).comment('Actions in last hour');
    table.integer('circuit_breaker_threshold').defaultTo(20).comment('Max actions/hour before auto-pause');
    table.boolean('circuit_breaker_triggered').defaultTo(false);
    table.dateTime('circuit_breaker_triggered_at').nullable();
    table.text('circuit_breaker_trigger_reason').nullable();
    
    // Indexes for performance
    table.index('is_active');
    table.index('deactivated_at');
    table.index('circuit_breaker_triggered');
  });
  
  // Create agent_state_history table for full audit trail
  await db.schema.createTable('agent_state_history', (table) => {
    table.uuid('id').primary();
    table.uuid('agent_id').references('id').inTable('agents').onDelete('CASCADE');
    table.uuid('dao_id').references('id').inTable('daos').onDelete('CASCADE');
    
    // Before/after state
    table.json('state_before').comment('Full agent state before action');
    table.json('state_after').comment('Full agent state after action');
    
    // Action metadata
    table.enum('action_type', [
      'activate',
      'deactivate',
      'execution',
      'circuit_breaker_trigger',
      'reactivate',
      'permission_change',
      'scope_change'
    ]);
    table.json('action_metadata').comment('Additional context for this action');
    
    // Authority trail
    table.uuid('initiated_by').references('id').inTable('users');
    table.enum('authority_type', ['superuser', 'approval_board', 'automated', 'emergency']);
    table.json('approvals').comment('If approval_board: who approved, when');
    
    // Reversibility info
    table.boolean('is_reversible').defaultTo(true);
    table.dateTime('reversal_deadline').nullable().comment('Until when can this be undone');
    table.uuid('reversal_action_id').nullable().comment('If reversed, link to reversal action');
    
    // Timestamps & audit
    table.uuid('actor_ip_address').nullable();
    table.text('actor_user_agent').nullable();
    table.dateTime('timestamp').defaultTo(db.fn.now());
    table.timestamp('created_at').defaultTo(db.fn.now());
    
    // Indexes
    table.index(['agent_id', 'timestamp']);
    table.index(['action_type']);
    table.index(['initiated_by']);
    table.index(['is_reversible']);
  });
  
  console.log('✅ Agent kill-switch schema created');
}

export async function down(db: Database) {
  await db.schema.dropTable('agent_state_history');
  await db.schema.alterTable('agents', (table) => {
    table.dropColumn('is_active');
    table.dropColumn('activated_at');
    table.dropColumn('deactivated_at');
    table.dropColumn('deactivation_reason');
    table.dropColumn('deactivated_by');
    table.dropColumn('execution_count_1h');
    table.dropColumn('circuit_breaker_threshold');
    table.dropColumn('circuit_breaker_triggered');
    table.dropColumn('circuit_breaker_triggered_at');
    table.dropColumn('circuit_breaker_trigger_reason');
  });
  console.log('⬇️  Rollback complete');
}
```

---

## Part 2: Backend API Endpoints (Power Checklist Compliant)

### Task 1.2a: Agent Status Endpoint

**File:** `server/routes/admin/admin-agents-kill-switch.ts`

```typescript
import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireSuperAdminWithAudit } from '../middleware/superadmin-auth';
import { AgentStatusService } from '../services/agentStatusService';
import { AuditLoggingService } from '../services/auditLoggingService';

const router = Router();
const agentStatusService = new AgentStatusService();
const auditService = new AuditLoggingService();

/**
 * GET /api/admin/agents/status
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. ✅ Power Classification: HIGH power action (affects autonomous execution)
 * 2. ✅ State Clarity: Shows BEFORE (is_active) and AFTER (would show in response)
 * 3. ✅ Authority Transparency: Shows who can activate/deactivate
 * 4. ✅ Post-Action Narrative: Full history of all state changes
 * 8. ✅ Emotional Safety: "paused" language, not "destroyed"
 * 
 * RESPONSE: All agents with current status + kill-switch history
 */
router.get('/status', requireSuperAdminWithAudit, async (req, res) => {
  try {
    const agents = await agentStatusService.getAllAgentsWithStatus();
    
    // Format response for power-checklist clarity
    const response = {
      timestamp: new Date().toISOString(),
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.is_active && !a.circuit_breaker_triggered).length,
      pausedAgents: agents.filter(a => !a.is_active).length,
      circuitBreakerTriggered: agents.filter(a => a.circuit_breaker_triggered).length,
      agents: agents.map(agent => ({
        // Power Classification (item #1)
        id: agent.id,
        name: agent.name,
        type: agent.type, // KAIZEN, SCRY, LUMEN, etc.
        
        // State Clarity (item #3) ✨ BEFORE STATE
        currentState: {
          is_active: agent.is_active,
          status: agent.is_active ? 'ACTIVE' : 'PAUSED', // Soft language
          circulation_breaker_triggered: agent.circuit_breaker_triggered,
          last_execution: agent.updated_at
        },
        
        // Authority Transparency (item #4)
        authority: {
          can_be_controlled_by: ['superuser', 'approval_board_2of3'],
          scope: [
            `Treasury: ${agent.treasury_id}`,
            `Max actions/hour: ${agent.circuit_breaker_threshold}`,
            `Reversible: YES (can reactivate anytime)`,
            `Duration: Indefinite until reactivation`
          ],
          emergencyStop: {
            available: agent.is_active,
            description: 'Kill-switch can be activated immediately'
          }
        },
        
        // Post-Action Narrative (item #8)
        recentActions: agent.recentStateHistory.map(action => ({
          type: action.action_type, // 'deactivate', 'activate', 'circuit_breaker_trigger'
          timestamp: action.timestamp,
          initiatedBy: action.initiated_by, // User ID
          reason: action.action_metadata?.reason || 'No reason provided',
          authority: action.authority_type, // 'superuser', 'approval_board', 'automated'
          reversible: action.is_reversible ? `until ${action.reversal_deadline}` : 'permanent',
          narrative: generateNarrative(action) // Human-readable explanation
        })).slice(0, 5) // Last 5 actions
      }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching agent status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent status',
      supportEmail: 'security@mtaa.dao'
    });
  }
});

/**
 * POST /api/admin/agents/:agentId/kill-switch
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 1. ✅ Power Classification: HIGH (stops all agent actions)
 * 2. ✅ State Clarity: Shows exact before/after state
 * 3. ✅ Authority Transparency: WHO is doing this? WHY?
 * 6. ✅ Intent Confirmation: Requires explicit reason/naming
 * 7. ✅ Reversibility: Reactivation endpoint available
 * 8. ✅ Post-Action Narrative: Returns what happened
 * 9. ✅ Emotional Safety: "paused" not "killed", calm tone
 * 10. ✅ Consistency: Mirrors proposal cancellation UX pattern
 */
router.post('/:agentId/kill-switch', requireSuperAdminWithAudit, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { reason, suppressNotifications } = req.body;
    
    // Checklist #6: Intent Confirmation - Require explicit reason
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Intent confirmation required',
        message: 'You must provide a reason (min 10 characters) for activating kill-switch',
        powerChecklistItem: 6, // Intent Confirmation
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
        message: 'This agent is already paused. Use POST /reactivate to resume.',
        currentState: agent.is_active ? 'ACTIVE' : 'PAUSED'
      });
    }
    
    // Checklist #2: State Clarity - Show BEFORE state
    const beforeSnapshot = {
      is_active: agent.is_active,
      execution_count_1h: agent.execution_count_1h,
      circuit_breaker_triggered: agent.circuit_breaker_triggered,
      last_execution_at: agent.updated_at,
      pending_actions: agent.pending_execution_count || 0
    };
    
    // Execute kill-switch
    const result = await agentStatusService.deactivateAgent({
      agentId,
      deactivatedBy: req.user.id, // From auth middleware
      reason,
      authority: 'superuser' // Determined by which endpoint called
    });
    
    // Checklist #2: State Clarity - Show AFTER state
    const afterSnapshot = {
      is_active: false,
      paused_at: result.deactivated_at,
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
        affectedTreauries: [agent.treasury_id],
        affectedUsers: agent.users_count,
        dataLoss: false // Reassure: no data destroyed
      },
      timeline: {
        activatedAt: result.deactivated_at,
        activatedBy: req.user.username,
        reason: reason,
        authority: 'superuser',
        reversible: 'YES - use POST /reactivate anytime'
      },
      nextSteps: [
        '1. Review agent activity log (audit trail)',
        '2. Determine root cause',
        '3. If safe, call POST /reactivate to resume',
        '4. If compromised, engineer review required'
      ]
    };
    
    // Log to audit trail with full context
    await auditService.logAdminAction({
      actor: req.user.id,
      action: 'agent_kill_switch_activated',
      target: { type: 'agent', id: agentId },
      beforeSnapshot,
      afterSnapshot,
      reasoning: reason,
      authority: 'superuser',
      reversible: 'YES',
      reversalAction: 'POST /reactivate'
    });
    
    // Notify team (unless suppressed for testing)
    if (!suppressNotifications) {
      await notifySecurityTeam({
        eventType: 'agent_kill_switch_activated',
        agent: agent.name,
        actor: req.user.username,
        reason
      });
    }
    
    // Checklist #9: Emotional Safety - Calm response
    return res.status(200).json({
      powerChecklistItem: [1, 2, 3, 6, 7, 8, 9],
      success: true,
      narrative,
      
      // Checklist #3: State Clarity
      stateChange: {
        before: { status: 'ACTIVE', is_active: true },
        after: { status: 'PAUSED', is_active: false },
        timestamp: result.deactivated_at
      },
      
      // Checklist #7: Reversibility
      reversibilityInfo: {
        canUndo: true,
        undoMethod: 'POST /api/admin/agents/:agentId/reactivate',
        undoUntil: 'No deadline',
        requiresApproval: false // Reactivation requires no extra approval
      },
      
      // Reference to detailed history
      fullHistoryUrl: `/api/admin/agents/${agentId}/history`
    });
    
  } catch (error) {
    console.error('Kill-switch error:', error);
    res.status(500).json({
      error: 'Failed to activate kill-switch',
      errorId: uuidv4(),
      supportEmail: 'security@mtaa.dao'
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
 * 9. ✅ Emotional Safety: Reassure that agent is safe after review
 */
router.post('/:agentId/reactivate', requireSuperAdminWithAudit, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { reason } = req.body;
    
    // Checklist #6: Intent Confirmation
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
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
    
    // Checklist #2: State Clarity - Show BEFORE
    const beforeSnapshot = {
      is_active: agent.is_active,
      circuit_breaker_triggered: agent.circuit_breaker_triggered,
      paused_since: agent.deactivated_at
    };
    
    // Reactivate
    const result = await agentStatusService.activateAgent({
      agentId,
      activatedBy: req.user.id,
      reason
    });
    
    // Checklist #2: State Clarity - Show AFTER
    const afterSnapshot = {
      is_active: true,
      circuit_breaker_triggered: false,
      activated_at: result.activated_at,
      execution_count_reset: true
    };
    
    // Checklist #8: Post-Action Narrative
    const narrative = {
      action: 'Agent Reactivated',
      severity: 'MEDIUM',
      agent: agent.name,
      reactivatedAt: result.activated_at,
      reactivatedBy: req.user.username,
      reviewNotes: reason,
      nextSteps: [
        `Monitor execution rate in next 24 hours`,
        `Review circuit breaker threshold: ${agent.circuit_breaker_threshold}/hour`,
        `Check for pending actions that were cancelled`
      ]
    };
    
    // Log to audit
    await auditService.logAdminAction({
      actor: req.user.id,
      action: 'agent_reactivated',
      target: { type: 'agent', id: agentId },
      beforeSnapshot,
      afterSnapshot,
      reasoning: reason,
      reversible: 'YES (can kill-switch again)'
    });
    
    return res.status(200).json({
      success: true,
      narrative,
      stateChange: {
        before: { status: 'PAUSED', is_active: false },
        after: { status: 'ACTIVE', is_active: true },
        timestamp: result.activated_at
      },
      statusUrl: `/api/admin/agents/${agentId}/status`
    });
    
  } catch (error) {
    console.error('Reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate agent' });
  }
});

/**
 * GET /api/admin/agents/:agentId/history
 * 
 * POWER CHECKLIST COMPLIANCE:
 * 8. ✅ Post-Action Narrative: Full activity log with before/after
 * 4. ✅ Authority Transparency: Shows who did what, with what authority
 * 
 * Returns full state history for audit trail + debugging
 */
router.get('/:agentId/history', requireSuperAdminWithAudit, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    
    const history = await agentStatusService.getAgentStateHistory(
      agentId,
      parseInt(limit as string),
      parseInt(skip as string)
    );
    
    return res.json({
      agent_id: agentId,
      total_entries: history.total,
      entries: history.items.map(entry => ({
        // Checklist #1: Power Classification
        powerClass: 'HIGH' as const,
        
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
          deadline: entry.reversal_deadline,
          reversalId: entry.reversal_action_id
        }
      }))
    });
    
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * Helper: Generate human-readable narrative from action
 */
function generateNarrative(action: any): string {
  const timeStr = new Date(action.timestamp).toLocaleString();
  
  switch (action.action_type) {
    case 'deactivate':
      return `🔴 Agent paused by ${action.initiated_by} at ${timeStr}. Reason: "${action.action_metadata?.reason}"`;
    case 'activate':
      return `🟢 Agent resumed by ${action.initiated_by} at ${timeStr}. Review: "${action.action_metadata?.reason}"`;
    case 'circuit_breaker_trigger':
      return `⚠️ Circuit breaker auto-activated at ${timeStr} (exceeded ${action.action_metadata?.threshold}/hour threshold)`;
    case 'execution':
      return `⚙️ Agent executed action at ${timeStr}. Count: ${action.action_metadata?.execution_count}/hour`;
    default:
      return `${action.action_type} at ${timeStr}`;
  }
}

export default router;
```

---

## Part 3: Circuit Breaker Service

### Task 1.2b: Circuit Breaker Logic

**File:** `server/services/agentCircuitBreaker.ts`

```typescript
import { Database } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export class AgentCircuitBreaker {
  constructor(private db: Database) {}
  
  /**
   * Track agent execution and trigger kill-switch if threshold exceeded
   * 
   * POWER CHECKLIST:
   * 7. ✅ Reversibility: Auto-triggered kill-switch can be manually reactivated
   * 8. ✅ Narrative: Full logging of what triggered it
   * 9. ✅ Emotional Safety: Not a permanent deletion, just a pause
   */
  async trackExecution(agentId: string, daoId: string, executionMetadata: any) {
    try {
      // Get agent's circuit breaker config
      const agent = await this.db('agents')
        .where({ id: agentId, dao_id: daoId })
        .first();
      
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      
      // Get execution count in last 60 minutes
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await this.db('agent_state_history')
        .where({
          agent_id: agentId,
          action_type: 'execution'
        })
        .andWhere('timestamp', '>', oneHourAgo)
        .count('* as count')
        .first();
      
      const executionCountThisHour = recentCount?.count || 0;
      const threshold = agent.circuit_breaker_threshold || 20;
      
      // Log this execution
      await this.logExecution(agentId, executionCountThisHour + 1, executionMetadata);
      
      // Check if threshold exceeded
      if (executionCountThisHour + 1 > threshold) {
        // Circuit breaker triggered!
        await this.triggerCircuitBreaker(agentId, daoId, {
          threshold,
          actualCount: executionCountThisHour + 1
        });
        
        return {
          allowed: false,
          reason: 'Circuit breaker activated',
          message: `Agent exceeded ${threshold} actions/hour. Agent paused for safety.`
        };
      }
      
      return {
        allowed: true,
        executionCount: executionCountThisHour + 1,
        remaining: threshold - executionCountThisHour - 1
      };
      
    } catch (error) {
      console.error('Circuit breaker error:', error);
      // Fail safe: pause agent on error
      await this.triggerCircuitBreaker(agentId, daoId, {
        error: error?.message,
        failSafe: true
      });
      
      throw error;
    }
  }
  
  private async triggerCircuitBreaker(
    agentId: string,
    daoId: string,
    metadata: any
  ) {
    // Deactivate agent
    await this.db('agents')
      .where({ id: agentId })
      .update({
        is_active: false,
        deactivated_at: new Date(),
        deactivation_reason: 'Circuit breaker: execution threshold exceeded',
        deactivated_by: 'SYSTEM',
        circuit_breaker_triggered: true,
        circuit_breaker_triggered_at: new Date(),
        circuit_breaker_trigger_reason: JSON.stringify(metadata)
      });
    
    // Log in state history
    await this.db('agent_state_history').insert({
      id: uuidv4(),
      agent_id: agentId,
      dao_id: daoId,
      action_type: 'circuit_breaker_trigger',
      state_before: { is_active: true, circuit_breaker_triggered: false },
      state_after: { is_active: false, circuit_breaker_triggered: true },
      action_metadata: metadata,
      initiated_by: 'SYSTEM',
      authority_type: 'automated',
      is_reversible: true,
      reversal_deadline: null, // No deadline for manual reactivation
      timestamp: new Date()
    });
    
    // Notify security team
    await this.notifySecurityTeam(agentId, 'CIRCUIT_BREAKER_TRIGGERED', metadata);
  }
  
  private async logExecution(agentId: string, count: number, metadata: any) {
    // Log each execution for tracking
    // This is high-volume, so keep it lean
    await this.db('agent_state_history').insert({
      id: uuidv4(),
      agent_id: agentId,
      action_type: 'execution',
      action_metadata: {
        execution_count: count,
        ...metadata
      },
      timestamp: new Date()
    });
  }
  
  private async notifySecurityTeam(agentId: string, eventType: string, metadata: any) {
    // Send alert to security@mtaa.dao
    console.log(`🚨 ALERT: ${eventType} for agent ${agentId}`, metadata);
    // Implement actual email/Slack notification here
  }
}
```

---

## Part 4: Frontend Components (Power Checklist UI)

### Task 1.3a: Agent Status Card Component

**File:** `client/components/admin/AgentStatusCard.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import styles from './AgentStatusCard.module.css';

/**
 * POWER CHECKLIST COMPLIANCE:
 * 1. ✅ Power Classification: Clearly labeled "HIGH POWER"
 * 2. ✅ Power Gradient: Visual distinction (colors, size, prominence)
 * 3. ✅ State Clarity: Shows before state, after state, timestamp
 * 4. ✅ Authority Transparency: Shows who can control this
 * 9. ✅ Emotional Safety: Calm colors, soft language ("paused" not "killed")
 * 10. ✅ Consistency: Matches other admin components
 */
export interface Agent {
  id: string;
  name: string;
  type: 'KAIZEN' | 'SCRY' | 'LUMEN' | 'Analyzer' | 'Defender' | 'Scout';
  is_active: boolean;
  circuit_breaker_triggered: boolean;
  circuit_breaker_threshold: number;
  execution_count_1h: number;
  deactivated_at?: string;
  deactivated_by?: string;
  deactivation_reason?: string;
}

interface Props {
  agent: Agent;
  onKillSwitch: (agentId: string, reason: string) => Promise<void>;
  onReactivate: (agentId: string, reason: string) => Promise<void>;
  loading?: boolean;
}

export const AgentStatusCard: React.FC<Props> = ({
  agent,
  onKillSwitch,
  onReactivate,
  loading = false
}) => {
  const [showKillSwitchModal, setShowKillSwitchModal] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Determine agent status
  const isActive = agent.is_active && !agent.circuit_breaker_triggered;
  const isPaused = !agent.is_active;
  const isCircuitBreakerTriggered = agent.circuit_breaker_triggered;
  
  // Status badge color (Checklist #2: Power Gradient)
  const getStatusColor = () => {
    if (isPaused) return '#FFA500'; // ORANGE: Paused (recoverable)
    if (isCircuitBreakerTriggered) return '#FF6B6B'; // RED: Auto-paused (unsafe)
    if (agent.execution_count_1h > agent.circuit_breaker_threshold * 0.8) {
      return '#FFD700'; // YELLOW: Near threshold
    }
    return '#10B981'; // GREEN: Healthy
  };
  
  const statusColor = getStatusColor();
  
  return (
    <div className={styles.card}>
      {/* Checklist #1: Power Classification Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.powerBadge}>HIGH POWER</span>
          <h3 className={styles.title}>{agent.name}</h3>
          <span className={styles.type}>({agent.type})</span>
        </div>
      </div>
      
      {/* Checklist #3: State Clarity - CURRENT STATE */}
      <div className={styles.stateClarity}>
        <div className={styles.statusIndicator} style={{ backgroundColor: statusColor }}>
          <span className={styles.statusLabel}>
            {isActive && '🟢 ACTIVE'}
            {isPaused && '🟠 PAUSED'}
            {isCircuitBreakerTriggered && '🔴 CIRCUIT BREAKER'}
          </span>
        </div>
        
        <div className={styles.stateDetails}>
          <div className={styles.metric}>
            <label>Executions (last hour):</label>
            <span className={styles.value}>
              {agent.execution_count_1h} / {agent.circuit_breaker_threshold}
            </span>
            <div className={styles.progressBar}>
              <div 
                className={styles.progress}
                style={{
                  width: `${(agent.execution_count_1h / agent.circuit_breaker_threshold) * 100}%`,
                  backgroundColor: statusColor
                }}
              />
            </div>
          </div>
          
          {isPaused && agent.deactivated_at && (
            <div className={styles.metric}>
              <label>Paused since:</label>
              <span className={styles.value}>
                {new Date(agent.deactivated_at).toLocaleString()}
              </span>
              {agent.deactivation_reason && (
                <span className={styles.reason}>Reason: {agent.deactivation_reason}</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Checklist #4: Authority Transparency */}
      <div className={styles.authoritySection}>
        <details>
          <summary className={styles.authoritySummary}>
            Who can control this? (Authority Transparency)
          </summary>
          <div className={styles.authorityDetails}>
            <p><strong>Can Activate Kill-Switch:</strong> Superuser (any)</p>
            <p><strong>Can Reactivate:</strong> Superuser (verifies agent safety first)</p>
            <p><strong>Scope:</strong> Affects treasury {agent.id.slice(0, 8)}</p>
            <p><strong>Duration:</strong> Until manually reactivated</p>
            <p><strong>Reversible:</strong> YES (can reactivate anytime)</p>
          </div>
        </details>
      </div>
      
      {/* Checklist #6: Intent Confirmation Dialog */}
      {showKillSwitchModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h4>Confirm Kill-Switch Activation</h4>
            <p className={styles.warning}>
              ⚠️ This will pause agent <strong>{agent.name}</strong>
            </p>
            
            {/* Checklist #6: Named Action */}
            <div className={styles.formGroup}>
              <label htmlFor="reason">
                Why are you pausing this agent? (required, min 10 chars)
              </label>
              <textarea
                id="reason"
                className={styles.textarea}
                value={killSwitchReason}
                onChange={(e) => setKillSwitchReason(e.target.value)}
                placeholder="Example: Circuit breaker triggered. Agent exceeded 25 actions/hour."
                minLength={10}
              />
            </div>
            
            {/* Checklist #8: Post-Action Narrative Preview */}
            <div className={styles.preview}>
              <h5>What will happen:</h5>
              <ul>
                <li>✅ Agent execution will stop</li>
                <li>✅ All pending actions will be cancelled</li>
                <li>✅ Action logged to audit trail</li>
                <li>✅ Security team notified</li>
                <li>✅ Can be reactivated anytime (no deadline)</li>
              </ul>
            </div>
            
            {/* Checklist #9: Clear Decline Button */}
            <div className={styles.buttonGroup}>
              <button
                className={styles.declineBtn}
                onClick={() => {
                  setShowKillSwitchModal(false);
                  setKillSwitchReason('');
                }}
              >
                Cancel (Go back)
              </button>
              <button
                className={styles.confirmBtn}
                disabled={killSwitchReason.length < 10 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await onKillSwitch(agent.id, killSwitchReason);
                    setShowKillSwitchModal(false);
                    setKillSwitchReason('');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? 'Pausing...' : 'Confirm: Pause Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Checklist #7: Reversibility - Clear Action Buttons */}
      <div className={styles.actions}>
        {isActive && (
          <button
            className={styles.killSwitchBtn}
            onClick={() => setShowKillSwitchModal(true)}
            disabled={loading}
            title="Immediately pause this agent (reversible)"
          >
            🛑 Pause Agent (Kill-Switch)
          </button>
        )}
        
        {(isPaused || isCircuitBreakerTriggered) && (
          <button
            className={styles.reactivateBtn}
            onClick={async () => {
              const reason = prompt(
                'Confirm agent has been reviewed. Enter notes:'
              );
              if (reason && reason.length >= 10) {
                await onReactivate(agent.id, reason);
              }
            }}
            disabled={loading}
            title="Resume the agent after review"
          >
            ✅ Reactivate Agent
          </button>
        )}
        
        <a 
          href={`/admin/agents/${agent.id}/activity`}
          className={styles.viewActivityBtn}
          title="See all actions by this agent"
        >
          📋 View Activity Log
        </a>
      </div>
    </div>
  );
};
```

**Styles File:** `client/components/admin/AgentStatusCard.module.css`

```css
.card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.titleSection {
  display: flex;
  align-items: center;
  gap: 12px;
}

.powerBadge {
  background: #FF6B6B;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.type {
  color: #666;
  font-size: 14px;
}

/* Checklist #2: Power Gradient - Color Coding */
.statusIndicator {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  margin-bottom: 12px;
  text-align: center;
  color: white;
}

.statusLabel {
  font-size: 14px;
  font-weight: 600;
}

.stateDetails {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.metric {
  margin-bottom: 8px;
}

.metric label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  font-weight: 500;
}

.metric .value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.progressBar {
  width: 100%;
  height: 6px;
  background: #ddd;
  border-radius: 3px;
  overflow: hidden;
}

.progress {
  height: 100%;
  transition: width 0.2s ease;
}

.reason {
  display: block;
  font-size: 12px;
  color: #ff6b6b;
  margin-top: 4px;
  font-style: italic;
}

/* Checklist #4: Authority Transparency */
.authoritySection {
  background: #f0f7ff;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  border-left: 3px solid #0066cc;
}

.authoritySummary {
  cursor: pointer;
  font-weight: 600;
  color: #0066cc;
  font-size: 13px;
}

.authoritySummary:hover {
  text-decoration: underline;
}

.authorityDetails {
  margin-top: 8px;
  font-size: 12px;
  color: #333;
  line-height: 1.6;
}

.authorityDetails p {
  margin: 4px 0;
}

/* Checklist #6: Intent Confirmation Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modalContent {
  background: white;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.modalContent h4 {
  margin-top: 0;
  color: #333;
}

.warning {
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  padding: 12px;
  border-radius: 4px;
  margin: 12px 0;
  color: #856404;
  font-size: 14px;
}

.formGroup {
  margin: 16px 0;
}

.formGroup label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  min-height: 80px;
  resize: vertical;
}

.preview {
  background: #f0f7ff;
  padding: 12px;
  border-radius: 4px;
  margin: 12px 0;
  border-left: 3px solid #0066cc;
}

.preview h5 {
  margin-top: 0;
  color: #0066cc;
  font-size: 12px;
}

.preview ul {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
}

.preview li {
  margin: 4px 0;
}

.buttonGroup {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.declineBtn, .confirmBtn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
}

.declineBtn {
  background: #f0f0f0;
  color: #333;
}

.declineBtn:hover {
  background: #e0e0e0;
}

.confirmBtn {
  background: #ff6b6b;
  color: white;
}

.confirmBtn:hover:not(:disabled) {
  background: #ff5252;
}

.confirmBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Checklist #7: Reversibility - Action Buttons */
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.killSwitchBtn, .reactivateBtn, .viewActivityBtn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-size: 13px;
  transition: all 0.2s ease;
}

.killSwitchBtn {
  background: #ff6b6b;
  color: white;
}

.killSwitchBtn:hover:not(:disabled) {
  background: #ff5252;
}

.reactivateBtn {
  background: #10b981;
  color: white;
}

.reactivateBtn:hover:not(:disabled) {
  background: #059669;
}

.viewActivityBtn {
  background: #f0f0f0;
  color: #333;
}

.viewActivityBtn:hover {
  background: #e0e0e0;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Part 5: Testing Scenarios (Day 1)

### Task 1.4a: Local Testing Checklist

**File:** `tests/day1-kill-switch-tests.ts`

```typescript
/**
 * DAY 1 TESTING: Agent Kill-Switch + Circuit Breaker
 * 
 * POWER CHECKLIST VALIDATION:
 * Each test validates specific checklist items
 */

describe('Day 1: Agent Kill-Switch Implementation', () => {
  
  describe('Checklist #1: Power Classification', () => {
    test('Kill-switch endpoint labeled as HIGH POWER', async () => {
      const response = await client
        .post('/api/admin/agents/kill-switch')
        .set('Authorization', `Bearer ${superuserToken}`);
      
      expect(response.body.powerChecklistItem).toContain(1);
      expect(response.body.narrative.severity).toBe('HIGH');
    });
  });
  
  describe('Checklist #2: Power Gradient + #3: State Clarity', () => {
    test('Shows BEFORE and AFTER state in response', async () => {
      const agent = await createTestAgent();
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing circuit breaker logic' });
      
      // Checklist #2: Different visual representation
      expect(response.body.stateChange).toEqual({
        before: { status: 'ACTIVE', is_active: true },
        after: { status: 'PAUSED', is_active: false},
        timestamp: expect.any(String)
      });
    });
    
    test('Status badge in UI shows current state', async () => {
      const agent = await createTestAgent({ is_active: true });
      const component = render(<AgentStatusCard agent={agent} />);
      
      expect(component.getByText('🟢 ACTIVE')).toBeInTheDocument();
    });
  });
  
  describe('Checklist #4: Authority Transparency', () => {
    test('Shows who can control agent', async () => {
      const agent = await createTestAgent();
      const response = await client
        .get(`/api/admin/agents/${agent.id}/status`)
        .set('Authorization', `Bearer ${superuserToken}`);
      
      expect(response.body.agents[0].authority).toEqual({
        can_be_controlled_by: ['superuser', 'approval_board_2of3'],
        scope: expect.arrayContaining([
          expect.stringContaining('Treasury:'),
          expect.stringContaining('Max actions/hour'),
          expect.stringContaining('Reversible: YES')
        ]),
        emergencyStop: {
          available: agent.is_active,
          description: expect.any(String)
        }
      });
    });
    
    test('Tooltip explains authority in UI', () => {
      const agent = createMockAgent();
      const component = render(<AgentStatusCard agent={agent} />);
      
      const authoritySection = component.getByText('Who can control this?');
      fireEvent.click(authoritySection);
      
      expect(component.getByText('Can Activate Kill-Switch: Superuser (any)'))
        .toBeInTheDocument();
    });
  });
  
  describe('Checklist #6: Intent Confirmation', () => {
    test('Requires reason before activation', async () => {
      const agent = await createTestAgent();
      
      // Without reason - should fail
      const noReasonResponse = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: '' });
      
      expect(noReasonResponse.status).toBe(400);
      expect(noReasonResponse.body.powerChecklistItem).toBe(6);
      expect(noReasonResponse.body.error).toBe('Intent confirmation required');
    });
    
    test('Requires minimum 10 character reason', async () => {
      const agent = await createTestAgent();
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Short' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('min 10 characters');
    });
    
    test('UI disables button if reason < 10 chars', () => {
      const mockAgent = createMockAgent({ is_active: true });
      const component = render(
        <AgentStatusCard 
          agent={mockAgent}
          onKillSwitch={jest.fn()}
        />
      );
      
      fireEvent.click(component.getByText('Pause Agent (Kill-Switch)'));
      
      const textarea = component.getByPlaceholderText(/why are you/i);
      const confirmBtn = component.getByText('Confirm: Pause Agent');
      
      expect(confirmBtn).toBeDisabled();
      
      fireEvent.change(textarea, { target: { value: 'Testing circuit' } });
      expect(confirmBtn).not.toBeDisabled();
    });
  });
  
  describe('Checklist #7: Reversibility', () => {
    test('Can reactivate paused agent', async () => {
      const agent = await createTestAgent({ is_active: false });
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/reactivate`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Agent reviewed and safe. Circuit breaker threshold adjusted.' });
      
      expect(response.status).toBe(200);
      expect(response.body.stateChange.after.is_active).toBe(true);
    });
    
    test('No deadline for reactivation', async () => {
      const agent = await createTestAgent({ is_active: false });
      
      const response = await client
        .get(`/api/admin/agents/${agent.id}/history`)
        .set('Authorization', `Bearer ${superuserToken}`);
      
      const deactivationEntry = response.body.entries[0];
      expect(deactivationEntry.reversibility.deadline).toBeNull();
    });
    
    test('UI shows reactivate button when paused', () => {
      const pausedAgent = createMockAgent({ is_active: false });
      const component = render(<AgentStatusCard agent={pausedAgent} />);
      
      expect(component.queryByText('Pause Agent')).not.toBeInTheDocument();
      expect(component.getByText('Reactivate Agent')).toBeInTheDocument();
    });
  });
  
  describe('Checklist #8: Post-Action Narrative', () => {
    test('Returns human-readable narrative', async () => {
      const agent = await createTestAgent();
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Circuit breaker threshold exceeded' });
      
      const narrative = response.body.narrative;
      expect(narrative.action).toBe('Agent Kill-Switch Activated');
      expect(narrative.impact).toBeDefined();
      expect(narrative.timeline.reason).toBe('Circuit breaker threshold exceeded');
      expect(narrative.nextSteps).toBeInstanceOf(Array);
    });
    
    test('Audit log shows human-readable description', async () => {
      const agent = await createTestAgent();
      
      await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing' });
      
      const response = await client
        .get(`/api/admin/agents/${agent.id}/history`)
        .set('Authorization', `Bearer ${superuserToken}`);
      
      const entry = response.body.entries[0];
      expect(entry.narrative).toMatch(/paused|deactivate/i);
    });
  });
  
  describe('Checklist #9: Emotional Safety', () => {
    test('Uses soft language ("paused" not "killed")', async () => {
      const agent = await createTestAgent();
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing emotional safety' });
      
      const body = JSON.stringify(response.body);
      expect(body).toContain('PAUSED');
      expect(body).not.toContain('DESTROYED');
      expect(body).not.toContain('KILLED');
    });
    
    test('Reassures data is not deleted', async () => {
      const agent = await createTestAgent();
      
      const response = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing' });
      
      expect(response.body.narrative.impact.dataLoss).toBe(false);
    });
    
    test('Modal shows recovery information', () => {
      const agent = createMockAgent();
      const component = render(<AgentStatusCard agent={agent} />);
      
      fireEvent.click(component.getByText('Pause Agent (Kill-Switch)'));
      
      expect(component.getByText('Can be reactivated anytime (no deadline)')).toBeInTheDocument();
    });
  });
  
  describe('Checklist #10: Consistency', () => {
    test('Kill-switch follows same pattern as proposal cancellation', async () => {
      const agent = await createTestAgent();
      const proposal = await createTestProposal();
      
      const killSwitchRes = await client
        .post(`/api/admin/agents/${agent.id}/kill-switch`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing consistency' });
      
      const cancellationRes = await client
        .post(`/api/governance/proposals/${proposal.id}/cancel`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'Testing consistency' });
      
      // Both should have same structure
      expect(killSwitchRes.body).toHaveProperty('stateChange');
      expect(cancellationRes.body).toHaveProperty('stateChange');
      
      expect(killSwitchRes.body).toHaveProperty('reversibilityInfo');
      expect(cancellationRes.body).toHaveProperty('reversibilityInfo');
    });
  });
  
  describe('Circuit Breaker: Auto-Triggered Kill-Switch', () => {
    test('Pauses agent when >20 actions/hour', async () => {
      const agent = await createTestAgent();
      
      // Simulate 21 executions in 1 hour
      for (let i = 0; i < 21; i++) {
        await agentService.trackExecution(agent.id, agent.dao_id, {});
      }
      
      // Agent should be auto-paused
      const updatedAgent = await getAgent(agent.id);
      expect(updatedAgent.is_active).toBe(false);
      expect(updatedAgent.circuit_breaker_triggered).toBe(true);
    });
    
    test('Logs circuit breaker trigger in state history', async () => {
      const agent = await createTestAgent();
      
      for (let i = 0; i < 21; i++) {
        await agentService.trackExecution(agent.id, agent.dao_id, {});
      }
      
      const history = await getAgentStateHistory(agent.id);
      const triggerEntry = history.find(h => h.action_type === 'circuit_breaker_trigger');
      
      expect(triggerEntry).toBeDefined();
      expect(triggerEntry.is_reversible).toBe(true);
    });
  });
});
```

---

## Day 1 Summary & Success Criteria

✅ **By End of Monday (Day 1):**

- [x] Database schema with kill-switch + circuit breaker support
- [x] 3 API endpoints: status, kill-switch, reactivate (all with power checklist compliance)
- [x] Circuit breaker service (auto-pauses agent on threshold exceed)
- [x] Frontend component (UI with proper power gradient, state clarity, reversibility)
- [x] Agent status dashboard (shows all agents + history)
- [x] 30+ unit/integration tests (validating each checklist item)
- [x] All code reviewed + deployed to dev environment

**Power Checklist Compliance: 10/11** ✅
- ✅ 1. Power Classification (labeled HIGH)
- ✅ 2. Power Gradient (colors: green/yellow/orange/red)
- ✅ 3. State Clarity (before/after snapshots)
- ✅ 4. Authority Transparency (shows WHO can control)
- ❓ 5. Simulation (not needed for kill-switch, defer to bot trading)
- ✅ 6. Intent Confirmation (reason required)
- ✅ 7. Reversibility (reactivation anytime)
- ✅ 8. Post-Action Narrative (full activity log)
- ✅ 9. Emotional Safety (soft language, reassuring)
- ✅ 10. Consistency (same pattern as governance)
- ⏳ 11. Dev Gate (QA review Friday)

---

## Monday 9 AM Kickoff Commands

```bash
# Engineer A: Database setup
$ cd server/db
$ npx knex migrate:make add_agent_kill_switch_support
$ npm run test:migrations

# Engineer B: Backend API
$ cd server
$ npm run generate-types # From schema
$ npm run test:api # Run endpoint tests

# Mid-day: Frontend
$ cd client
$ npm run test:components AgentStatusCard

# EOD: Integration
$ npm run test:integration:day1
$ npm run deploy:dev
```

Ready for Day 1 execution! 🚀

