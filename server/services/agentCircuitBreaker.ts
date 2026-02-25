/**
 * ⚠️ DEPRECATED - Agent Circuit Breaker Service
 * 
 * This service has been consolidated into CircuitBreakerConsolidation (Phase 4)
 * 
 * MIGRATION GUIDE:
 * Old pattern (agent-specific breaker):
 *   import { AgentCircuitBreaker } from './agentCircuitBreaker'
 *   const breaker = new AgentCircuitBreaker()
 *   const result = await breaker.trackExecution(agentId, daoId)
 * 
 * New pattern (unified registry):
 *   import { circuitBreakerRegistry } from '../core/consolidation/CircuitBreakerConsolidation'
 *   const breaker = circuitBreakerRegistry.getOrCreate(`agent:${agentId}`, config)
 *   const allowed = await breaker.canExecute()
 * 
 * Key differences:
 *   - Old: Single AgentCircuitBreaker class, manual tracking
 *   - New: CircuitBreakerRegistry with domain-scoped breakers
 *   - Old: agent_state_history table tracking
 *   - New: Built-in event emission and metrics
 * 
 * Migration checklist:
 *   - [ ] Replace AgentCircuitBreaker.trackExecution() calls
 *   - [ ] Use circuitBreakerRegistry for consistency
 *   - [ ] Set domain as `agent:${agentId}` for identification
 *   - [ ] Configure thresholds via config parameter
 *   - [ ] Listen to cb:state_changed events for monitoring
 * 
 * This service will be removed in v2.0. Please migrate to CircuitBreakerConsolidation.
 * For questions: See CONSOLIDATION_INTEGRATION_GUIDE.md
 */

/**
 * Agent Circuit Breaker Service
 * Day 1 Emergency Response - Power Checklist Compliance
 * 
 * POWER CHECKLIST ITEMS ADDRESSED:
 * 7. Reversibility: Auto-triggered kill-switch can be manually reactivated
 * 8. Post-Action Narrative: Full logging of what triggered it
 * 9. Emotional Safety: Not a permanent deletion, just a pause
 */

import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import { agentStatusService } from './agentStatusService';
import { logger } from '../utils/logger';

export class AgentCircuitBreaker {
  /**
   * Track agent execution and trigger kill-switch if threshold exceeded
   * 
   * Returns: { allowed: boolean, message: string, ... }
   */
  async trackExecution(agentId: string, daoId: string, executionMetadata: any = {}) {
    try {
      // Get agent's circuit breaker config
      const agent = await agentStatusService.getAgent(agentId);
      
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // If already paused, don't allow execution
      if (!agent.is_active || agent.circuit_breaker_triggered) {
        return {
          allowed: false,
          reason: 'Agent is paused',
          message: agent.circuit_breaker_triggered 
            ? 'Agent paused by circuit breaker. Manual review required before reactivation.'
            : 'Agent is currently paused. Check with admin to reactivate.'
        };
      }

      // Get execution count in last 60 minutes
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM agent_state_history 
        WHERE agent_id = ${agentId}
        AND action_type = 'execution'
        AND timestamp > ${oneHourAgo}
      `);

      const executionCountThisHour = parseInt((countResult.rows?.[0]?.count as any) || '0', 10);
      const threshold = (agent.circuit_breaker_threshold as number) || 20;

      // Check if threshold exceeded
      if (executionCountThisHour >= threshold) {
        // Circuit breaker triggered!
        await this.triggerCircuitBreaker(agentId, daoId, {
          threshold: threshold,
          actualCount: (executionCountThisHour as number) + 1
        });

        return {
          allowed: false,
          reason: 'Circuit breaker activated',
          message: `Agent exceeded ${threshold} actions/hour. Agent paused for safety.`,
          executionCount: executionCountThisHour,
          threshold: threshold
        };
      }

      // Log this execution
      await this.logExecution(agentId, daoId, (executionCountThisHour as number) + 1, executionMetadata);

      return {
        allowed: true,
        executionCount: (executionCountThisHour as number) + 1,
        threshold: threshold,
        remaining: (threshold as number) - (executionCountThisHour as number) - 1,
        safetyMargin: (((threshold as number) - (executionCountThisHour as number) - 1) / (threshold as number) * 100).toFixed(1) + '%'
      };

    } catch (error) {
      logger.error('Circuit breaker error:', error);
      // Fail safe: pause agent on error
      await this.triggerCircuitBreaker(agentId, daoId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        failSafe: true
      });

      throw error;
    }
  }

  /**
   * Manually trigger circuit breaker (admin action or automatic)
   */
  private async triggerCircuitBreaker(
    agentId: string,
    daoId: string,
    metadata: any
  ) {
    try {
      const now = new Date();

      // Update agent status
      await db.execute(sql`
        UPDATE agents
        SET
          is_active = false,
          deactivated_at = ${now},
          deactivation_reason = 'Circuit breaker: execution threshold exceeded',
          circuit_breaker_triggered = true,
          circuit_breaker_triggered_at = ${now},
          circuit_breaker_trigger_reason = ${JSON.stringify(metadata)},
          updated_at = ${now}
        WHERE id = ${agentId}
      `);

      // Log in state history
      await db.execute(sql`
        INSERT INTO agent_state_history (
          id, agent_id, dao_id, action_type, state_before, state_after,
          action_metadata, initiated_by, authority_type, is_reversible,
          reversal_deadline, timestamp, created_at
        ) VALUES (
          ${uuidv4()},
          ${agentId},
          ${daoId},
          'circuit_breaker_trigger',
          ${JSON.stringify({ is_active: true, circuit_breaker_triggered: false })},
          ${JSON.stringify({ is_active: false, circuit_breaker_triggered: true })},
          ${JSON.stringify(metadata)},
          'SYSTEM',
          'automated',
          true,
          null,
          ${now},
          ${now}
        )
      `);

      // Notify security team
      await this.notifySecurityTeam(agentId, 'CIRCUIT_BREAKER_TRIGGERED', metadata);

      logger.warn(`🚨 Circuit breaker triggered for agent ${agentId}`, metadata);

    } catch (error) {
      logger.error('Error triggering circuit breaker:', error);
      throw error;
    }
  }

  /**
   * Log an execution event
   */
  private async logExecution(
    agentId: string,
    daoId: string,
    count: number,
    metadata: any
  ) {
    try {
      const now = new Date();

      // Log execution in state history (keep lean for high volume)
      await db.execute(sql`
        INSERT INTO agent_state_history (
          id, agent_id, dao_id, action_type, action_metadata,
          timestamp, created_at
        ) VALUES (
          ${uuidv4()},
          ${agentId},
          ${daoId},
          'execution',
          ${JSON.stringify({
            execution_count: count,
            ...metadata
          })},
          ${now},
          ${now}
        )
      `);

      // Also update execution counter on agent row
      await agentStatusService.incrementExecutionCounter(agentId);

    } catch (error) {
      logger.error('Error logging execution:', error);
      // Don't throw - execution should continue even if logging fails
    }
  }

  /**
   * Notify security team of circuit breaker trigger
   * Sends alerts via logging, email, and potential Slack integration
   */
  private async notifySecurityTeam(agentId: string, eventType: string, metadata: any) {
    try {
      const timestamp = new Date().toISOString();
      const severity = eventType === 'CIRCUIT_BREAKER_TRIGGERED' ? 'CRITICAL' : 'WARNING';
      
      // Log to security audit log
      logger.warn(`🔔 SECURITY ALERT [${severity}]: ${eventType} for agent ${agentId}`, {
        agentId,
        eventType,
        timestamp,
        metadata
      });

      // Log to database for security team dashboard
      await db.execute(sql`
        INSERT INTO security_alerts (
          id, event_type, agent_id, severity,
          message, metadata, is_acknowledged,
          created_at, updated_at
        ) VALUES (
          ${uuidv4()},
          ${eventType},
          ${agentId},
          ${severity},
          ${'Circuit breaker triggered - agent execution halted for safety'},
          ${JSON.stringify(metadata)},
          false,
          ${new Date()},
          ${new Date()}
        )
      `);

      // TODO: Integrate with email service for critical alerts
      // if (severity === 'CRITICAL') {
      //   await emailService.sendAlert({
      //     to: process.env.SECURITY_TEAM_EMAIL,
      //     subject: `🚨 ${eventType}: ${agentId}`,
      //     template: 'security-alert',
      //     data: { agentId, eventType, metadata, timestamp }
      //   });
      // }

      // TODO: Integrate with Slack for real-time notifications
      // if (process.env.SLACK_SECURITY_WEBHOOK) {
      //   await fetch(process.env.SLACK_SECURITY_WEBHOOK, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       text: `${severity} Alert: ${eventType}`,
      //       attachments: [{
      //         color: severity === 'CRITICAL' ? 'danger' : 'warning',
      //         fields: [
      //           { title: 'Agent ID', value: agentId, short: true },
      //           { title: 'Event Type', value: eventType, short: true },
      //           { title: 'Timestamp', value: timestamp, short: false },
      //           { title: 'Metadata', value: JSON.stringify(metadata, null, 2), short: false }
      //         ]
      //       }]
      //     })
      //   });
      // }

    } catch (error) {
      logger.error('Error notifying security team:', error);
      // Don't throw - notifications are secondary to circuit breaker functionality
    }
  }

  /**
   * Remove execution count for old records (hourly cleanup job)
   */
  async cleanupOldExecutionCounts() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Delete execution log entries older than 24 hours (optional cleanup)
      await db.execute(sql`
        DELETE FROM agent_state_history
        WHERE action_type = 'execution'
        AND timestamp < ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
      `);

      logger.info('Execution history cleanup completed');
    } catch (error) {
      logger.error('Error during execution history cleanup:', error);
    }
  }
}

export const agentCircuitBreaker = new AgentCircuitBreaker();
