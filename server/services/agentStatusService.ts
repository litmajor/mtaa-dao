/**
 * ⚠️ DEPRECATED - Agent Status Service
 * 
 * This service has been consolidated into HealthRegistry (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (agent-specific status):
 *   import { agentStatusService } from './agentStatusService'
 *   const status = await agentStatusService.getAgentStatus(agentId)
 *   await agentStatusService.deactivateAgent({ agentId, ... })
 * 
 * New pattern (unified health registry):
 *   import { healthRegistry } from '../core/consolidation/HealthRegistryConsolidation'
 *   const snapshot = healthRegistry.getSnapshot()
 *   const agentStatus = snapshot.agents[agentId]
 *   
 *   // For deactivation, use circuit breaker:
 *   import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation'
 *   const breaker = circuitBreakerRegistry.getOrCreate(`agent:${agentId}`)
 *   breaker.open() // Pause execution (reversible)
 * 
 * Key migration items:
 *   - [ ] Replace getAgentStatus() calls with healthRegistry.getSnapshot().agents
 *   - [ ] Replace deactivateAgent() with circuit breaker open/close
 *   - [ ] Update state history queries to use audit service
 *   - [ ] Migrate approval workflows to use new status model
 * 
 * Benefits of consolidation:
 *   - Agent status integrated with overall system health
 *   - Better correlation with payment/trading failures
 *   - Cross-module status visibility
 *   - Unified monitoring and alerting
 * 
 * This service will be removed in v2.0. Please migrate to HealthRegistry + CircuitBreakerRegistry.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Agent Status Service
 * Day 1 Emergency Response - Power Checklist Compliance
 * 
 * POWER CHECKLIST ITEMS ADDRESSED:
 * 1. Power Classification: Kill-switch is HIGH power
 * 3. State Clarity: Tracks before/after state
 * 4. Authority Transparency: Logs who did what
 * 7. Reversibility: Can reactivate any time
 * 8. Post-Action Narrative: Full state history
 */

import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';

export interface DeactivateAgentParams {
  agentId: string;
  daoId?: string;
  deactivatedBy: string;
  reason: string;
  authority: 'superuser' | 'approval_board' | 'automated' | 'emergency';
}

export interface ActivateAgentParams {
  agentId: string;
  daoId?: string;
  activatedBy: string;
  reason: string;
}

export class AgentStatusService {
  /**
   * Get all agents with their current status
   */
  async getAllAgentsWithStatus() {
    try {
      const agents = await db.execute(sql`
        SELECT 
          a.*,
          COUNT(DISTINCT ash.id) as history_count,
          MAX(ash.timestamp) as last_state_change
        FROM agents a
        LEFT JOIN agent_state_history ash ON a.id = ash.agent_id
        GROUP BY a.id
        ORDER BY a.name ASC
      `);

      return agents.rows || [];
    } catch (error) {
      console.error('Error fetching agents with status:', error);
      throw error;
    }
  }

  /**
   * Get a single agent with full details
   */
  async getAgent(agentId: string) {
    try {
      const result = await db.execute(sql`
        SELECT * FROM agents WHERE id = ${agentId}
      `);

      return result.rows?.[0] || null;
    } catch (error) {
      console.error('Error fetching agent:', error);
      throw error;
    }
  }

  /**
   * Get recent state history for an agent (for UI display)
   */
  async getAgentWithHistory(agentId: string, limit: number = 5) {
    try {
      const agent = await this.getAgent(agentId);
      
      if (!agent) return null;

      const history = await db.execute(sql`
        SELECT * FROM agent_state_history 
        WHERE agent_id = ${agentId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `);

      return {
        ...agent,
        recentStateHistory: history.rows || []
      };
    } catch (error) {
      console.error('Error fetching agent with history:', error);
      throw error;
    }
  }

  /**
   * Deactivate an agent (Power Checklist #3, #7, #8)
   */
  async deactivateAgent(params: DeactivateAgentParams) {
    const { agentId, daoId, deactivatedBy, reason, authority } = params;

    try {
      // Get agent before state
      const beforeAgent = await this.getAgent(agentId);
      if (!beforeAgent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const now = new Date();
      const historyId = uuidv4();

      // Update agent status
      await db.execute(sql`
        UPDATE agents 
        SET 
          is_active = false,
          deactivated_at = ${now},
          deactivation_reason = ${reason},
          deactivated_by = ${deactivatedBy},
          updated_at = ${now}
        WHERE id = ${agentId}
      `);

      // Log state change to history (Power Checklist #8: Narrative)
      await db.execute(sql`
        INSERT INTO agent_state_history (
          id, agent_id, dao_id, action_type, state_before, state_after,
          action_metadata, initiated_by, authority_type, is_reversible,
          reversal_deadline, timestamp, created_at
        ) VALUES (
          ${historyId},
          ${agentId},
          ${daoId || beforeAgent.dao_id},
          'deactivate',
          ${JSON.stringify({
            is_active: beforeAgent.is_active,
            circuit_breaker_triggered: beforeAgent.circuit_breaker_triggered,
            execution_count_1h: beforeAgent.execution_count_1h
          })},
          ${JSON.stringify({
            is_active: false,
            deactivated_at: now
          })},
          ${JSON.stringify({ reason })},
          ${deactivatedBy},
          ${authority},
          true,
          null,
          ${now},
          ${now}
        )
      `);

      const afterAgent = await this.getAgent(agentId);
      
      return {
        success: true,
        agent: afterAgent,
        deactivatedAt: now,
        deactivationReason: reason,
        reversible: true,
        historyId
      };
    } catch (error) {
      console.error('Error deactivating agent:', error);
      throw error;
    }
  }

  /**
   * Activate an agent (Power Checklist #7: Reversibility)
   */
  async activateAgent(params: ActivateAgentParams) {
    const { agentId, daoId, activatedBy, reason } = params;

    try {
      // Get agent before state
      const beforeAgent = await this.getAgent(agentId);
      if (!beforeAgent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const now = new Date();
      const historyId = uuidv4();

      // Reset execution counter on activation
      await db.execute(sql`
        UPDATE agents 
        SET 
          is_active = true,
          activated_at = ${now},
          execution_count_1h = 0,
          circuit_breaker_triggered = false,
          circuit_breaker_triggered_at = null,
          updated_at = ${now}
        WHERE id = ${agentId}
      `);

      // Log state change to history
      await db.execute(sql`
        INSERT INTO agent_state_history (
          id, agent_id, dao_id, action_type, state_before, state_after,
          action_metadata, initiated_by, authority_type, is_reversible,
          reversal_deadline, timestamp, created_at
        ) VALUES (
          ${historyId},
          ${agentId},
          ${daoId || beforeAgent.dao_id},
          'activate',
          ${JSON.stringify({
            is_active: beforeAgent.is_active,
            circuit_breaker_triggered: beforeAgent.circuit_breaker_triggered,
            execution_count_1h: beforeAgent.execution_count_1h
          })},
          ${JSON.stringify({
            is_active: true,
            activated_at: now,
            execution_count_reset: true
          })},
          ${JSON.stringify({ reason })},
          ${activatedBy},
          'superuser',
          true,
          null,
          ${now},
          ${now}
        )
      `);

      const afterAgent = await this.getAgent(agentId);

      return {
        success: true,
        agent: afterAgent,
        activatedAt: now,
        reviewNotes: reason,
        reversible: true,
        historyId
      };
    } catch (error) {
      console.error('Error activating agent:', error);
      throw error;
    }
  }

  /**
   * Get full state history for an agent
   */
  async getAgentStateHistory(agentId: string, limit: number = 50, offset: number = 0) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as total FROM agent_state_history WHERE agent_id = ${agentId}
      `);
      
      const total = result.rows?.[0]?.total || 0;

      const historyResult = await db.execute(sql`
        SELECT * FROM agent_state_history 
        WHERE agent_id = ${agentId}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        total,
        items: historyResult.rows || []
      };
    } catch (error) {
      console.error('Error fetching agent state history:', error);
      throw error;
    }
  }

  /**
   * Trigger circuit breaker (auto-deactivate)
   */
  async triggerCircuitBreaker(
    agentId: string,
    daoId: string,
    metadata: { threshold: number; actualCount: number }
  ) {
    return this.deactivateAgent({
      agentId,
      daoId,
      deactivatedBy: 'SYSTEM',
      reason: `Circuit breaker: exceeded ${metadata.threshold} actions/hour (actual: ${metadata.actualCount})`,
      authority: 'automated'
    });
  }

  /**
   * Increment execution counter for circuit breaker tracking
   */
  async incrementExecutionCounter(agentId: string) {
    try {
      await db.execute(sql`
        UPDATE agents 
        SET execution_count_1h = execution_count_1h + 1
        WHERE id = ${agentId}
      `);
    } catch (error) {
      console.error('Error incrementing execution counter:', error);
      throw error;
    }
  }

  /**
   * Reset execution counter (hourly cleanup)
   */
  async resetExecutionCounters() {
    try {
      await db.execute(sql`
        UPDATE agents 
        SET execution_count_1h = 0
        WHERE updated_at < NOW() - INTERVAL '1 hour'
      `);
    } catch (error) {
      console.error('Error resetting execution counters:', error);
      throw error;
    }
  }
}

export const agentStatusService = new AgentStatusService();
