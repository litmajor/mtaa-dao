import { sql } from 'drizzle-orm';
import {
  ReversibilityStatus,
  CircuitBreakerState,
  ActorType,
  ReversalReason,
} from '../types/reversibility';
import ReversibilityService from './reversibilityService';

/**
 * Emergency Stop Service
 * 
 * Provides circuit breaker and emergency stop mechanisms for preventing
 * runaway autonomous actions. Implements rate limiting, threshold detection,
 * and emergency stop procedures.
 * 
 * Design Pattern:
 * 1. Track action count in time window
 * 2. When threshold exceeded, circuit breaker opens
 * 3. Circuit breaker blocks new actions and triggers emergency stop
 * 4. Manual override available for authorized actors (SUPERUSER, GOVERNANCE)
 * 5. Automatic reset after cooldown period
 * 
 * Examples:
 * - If 50 agent actions in 1 hour, circuit breaker opens
 * - If admin creates 100+ users in 30 minutes, triggers audit hold
 * - If bot trading exceeds daily loss limit, stops trading
 */
export class EmergencyStopService {
  private db: any;
  private reversibilityService: ReversibilityService;

  // Circuit breaker thresholds by action type
  private readonly DEFAULT_THRESHOLDS: Record<string, { count: number; windowMinutes: number }> = {
    AGENT_ACTION: { count: 20, windowMinutes: 60 }, // Max 20 agent actions per hour
    ADMIN_USER_OPERATION: { count: 50, windowMinutes: 30 }, // Max 50 user ops per 30 min
    GOVERNANCE_PROPOSAL_EXECUTION: { count: 10, windowMinutes: 1440 }, // Max 10 per day
    BOT_TRADE: { count: 100, windowMinutes: 60 }, // Max 100 trades per hour
    ESCROW_RELEASE: { count: 25, windowMinutes: 60 }, // Max 25 per hour
  };

  // Circuit breaker states (in-memory, could move to Redis for distributed systems)
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(database: any, reversibilityService: ReversibilityService) {
    this.db = database;
    this.reversibilityService = reversibilityService;
  }

  /**
   * Check circuit breaker for action type
   * Returns true if action should be allowed, false if circuit breaker is open
   */
  async checkCircuitBreaker(actionType: string): Promise<boolean> {
    const breaker = this.getOrCreateBreaker(actionType);

    // If breaker is open, check if it's time to reset
    if (breaker.isOpen) {
      if (breaker.resetsAt && new Date() > breaker.resetsAt) {
        // Reset the breaker
        breaker.isOpen = false;
        breaker.actionCount = 0;
        breaker.resetsAt = undefined;
        breaker.reason = undefined;
      } else {
        // Still open, block the action
        return false;
      }
    }

    // Increment action count
    breaker.actionCount++;

    // Check if threshold exceeded
    if (breaker.actionCount > breaker.threshold) {
      this.openCircuitBreaker(actionType, `Threshold exceeded: ${breaker.actionCount} > ${breaker.threshold}`);
      return false;
    }

    return true;
  }

  /**
   * Force open circuit breaker (emergency stop)
   */
  async triggerEmergencyStop(
    actionType: string,
    triggerActor: { id: string; type: ActorType; role?: string },
    reason: string,
    targetActionIds?: string[]
  ): Promise<{ stoppedCount: number; message: string }> {
    // Verify actor has permission to trigger emergency stop
    const isAuthorized = await this.checkEmergencyStopPermission(triggerActor);
    if (!isAuthorized) {
      throw new Error(`Actor ${triggerActor.id} with role ${triggerActor.role} cannot trigger emergency stop`);
    }

    // Open circuit breaker
    this.openCircuitBreaker(actionType, `Emergency stop triggered by ${triggerActor.id}: ${reason}`);

    // If specific action IDs provided, reverse them
    let stoppedCount = 0;
    if (targetActionIds && targetActionIds.length > 0) {
      for (const actionId of targetActionIds) {
        try {
          await this.reversibilityService.reverseAction({
            actionId,
            reason: ReversalReason.EMERGENCY_STOP,
            reversedBy: triggerActor,
            reversalReason: reason,
          });
          stoppedCount++;
        } catch (error) {
          console.error(`Failed to reverse action ${actionId}:`, error);
        }
      }
    }

    // Log emergency stop event
    await this.logEmergencyStop(actionType, triggerActor, reason, stoppedCount);

    return {
      stoppedCount,
      message: `Emergency stop triggered: Circuit breaker open for ${actionType}, reversed ${stoppedCount} actions`,
    };
  }

  /**
   * Reset circuit breaker manually
   */
  async resetCircuitBreaker(
    actionType: string,
    resetActor: { id: string; type: ActorType; role?: string },
    reason: string
  ): Promise<void> {
    // Verify actor has permission
    const isAuthorized = ['SUPERUSER', 'GOVERNANCE'].includes(resetActor.role || '');
    if (!isAuthorized) {
      throw new Error(`Actor ${resetActor.id} with role ${resetActor.role} cannot reset circuit breaker`);
    }

    const breaker = this.getOrCreateBreaker(actionType);
    breaker.isOpen = false;
    breaker.actionCount = 0;
    breaker.resetsAt = undefined;
    breaker.reason = undefined;

    // Log reset
    await this.db.execute(sql`
      INSERT INTO emergency_stop_logs (action_type, event_type, actor_id, actor_role, reason, metadata)
      VALUES (${actionType}, 'CIRCUIT_BREAKER_RESET', ${resetActor.id}, ${resetActor.role || 'UNKNOWN'}, ${reason}, json_build_object('reset_by', ${resetActor.id}))
    `);
  }

  /**
   * Get current circuit breaker state
   */
  getBreakerState(actionType: string): CircuitBreakerState {
    return this.getOrCreateBreaker(actionType);
  }

  /**
   * Get all circuit breaker states
   */
  getAllBreakerStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    const seenKeys = new Set(this.circuitBreakers.keys());

    // Add all default thresholds
    for (const actionType of Object.keys(this.DEFAULT_THRESHOLDS)) {
      states[actionType] = this.getOrCreateBreaker(actionType);
    }

    // Add any custom breakers
    for (const actionType of seenKeys) {
      if (!states[actionType]) {
        states[actionType] = this.getOrCreateBreaker(actionType);
      }
    }

    return states;
  }

  /**
   * Record an emergency stop event in database
   */
  private async logEmergencyStop(
    actionType: string,
    triggerActor: { id: string; type: ActorType; role?: string },
    reason: string,
    actionsReversed: number
  ): Promise<void> {
    try {
      await this.db.execute(sql`
        INSERT INTO emergency_stop_logs (action_type, event_type, actor_id, actor_type, actor_role, reason, metadata)
        VALUES (
          ${actionType},
          'EMERGENCY_STOP_TRIGGERED',
          ${triggerActor.id},
          ${triggerActor.type},
          ${triggerActor.role || 'UNKNOWN'},
          ${reason},
          json_build_object('actions_reversed', ${actionsReversed}, 'timestamp', CURRENT_TIMESTAMP)
        )
      `);
    } catch (error) {
      console.error('Failed to log emergency stop:', error);
      // Don't throw - logging failure shouldn't block emergency stop
    }
  }

  /**
   * Get emergency stop history
   */
  async getEmergencyStopHistory(
    actionType?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<{
    id: string;
    actionType: string;
    eventType: string;
    actor: { id: string; type?: string; role?: string };
    reason: string;
    metadata: Record<string, any>;
    timestamp: Date;
  }>> {
    try {
      let query = sql`
        SELECT * FROM emergency_stop_logs
      `;

      if (actionType) {
        query = sql`
          SELECT * FROM emergency_stop_logs
          WHERE action_type = ${actionType}
        `;
      }

      query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const result = await this.db.execute(query);

      return result.rows.map((row: any) => ({
        id: row.id,
        actionType: row.action_type,
        eventType: row.event_type,
        actor: {
          id: row.actor_id,
          type: row.actor_type,
          role: row.actor_role,
        },
        reason: row.reason,
        metadata: row.metadata,
        timestamp: row.created_at,
      }));
    } catch (error) {
      console.error('Failed to fetch emergency stop history:', error);
      throw new Error(`Failed to fetch emergency stop history: ${error}`);
    }
  }

  /**
   * Get actions currently blocked by circuit breaker
   */
  async getBlockedActions(actionType: string): Promise<Array<{ actionId: string; reason: string }>> {
    try {
      const result = await this.db.execute(sql`
        SELECT id, metadata->>'blocked_reason' as reason
        FROM action_reversals
        WHERE action_type = ${actionType}
        AND status = 'INITIATED'
        AND metadata->>'circuit_breaker_blocked' = 'true'
        ORDER BY initiated_at DESC
        LIMIT 100
      `);

      return result.rows.map((row: any) => ({
        actionId: row.id,
        reason: row.reason || 'Circuit breaker open',
      }));
    } catch (error) {
      console.error('Failed to fetch blocked actions:', error);
      throw new Error(`Failed to fetch blocked actions: ${error}`);
    }
  }

  /**
   * Appeal an emergency stop (for specific action)
   * Returns true if appeal was granted, false otherwise
   */
  async appealEmergencyStop(
    actionId: string,
    appellant: { id: string; role?: string },
    appealReason: string
  ): Promise<boolean> {
    // Get the action
    const action = await this.reversibilityService.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    // Check if action is blocked by emergency stop
    if (action.status !== ReversibilityStatus.EMERGENCY_STOPPED) {
      throw new Error('Action is not emergency stopped');
    }

    // TODO: Implement appeal logic
    // - Log appeal to database
    // - Notify admins
    // - Give time for manual review
    // - Return appeal decision

    console.log(`Appeal received for action ${actionId} from ${appellant.id}: ${appealReason}`);
    return false; // Default to rejection pending manual review
  }

  /**
   * Private helper: Check if actor can trigger emergency stop
   */
  private async checkEmergencyStopPermission(actor: { id: string; type: ActorType; role?: string }): Promise<boolean> {
    // Only superusers and governance can trigger emergency stop
    if (actor.role === 'SUPERUSER' || actor.type === ActorType.DAO_GOVERNANCE) {
      return true;
    }

    // Could also check for specific governance vote authorization
    // TODO: Query governance contracts if needed

    return false;
  }

  /**
   * Private helper: Get or create circuit breaker for action type
   */
  private getOrCreateBreaker(actionType: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(actionType)) {
      const threshold = this.DEFAULT_THRESHOLDS[actionType];
      const breaker: CircuitBreakerState = {
        actionCount: 0,
        threshold: threshold?.count ?? 50,
        timeWindowMinutes: threshold?.windowMinutes ?? 60,
        isOpen: false,
      };
      this.circuitBreakers.set(actionType, breaker);
    }

    return this.circuitBreakers.get(actionType)!;
  }

  /**
   * Private helper: Open circuit breaker
   */
  private openCircuitBreaker(actionType: string, reason: string): void {
    const breaker = this.getOrCreateBreaker(actionType);
    breaker.isOpen = true;
    breaker.reason = reason;
    // Reset after 30 minutes (cooldown period)
    breaker.resetsAt = new Date(Date.now() + 30 * 60 * 1000);
  }
}

export default EmergencyStopService;
