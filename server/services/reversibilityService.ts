import { sql, eq, isNull, and, gte, lte } from 'drizzle-orm';
import {
  ReversibleAction,
  ReversibilityStatus,
  ActionSeverity,
  ActorType,
  ReversalReason,
  CreateReversibleActionDTO,
  ReverseActionDTO,
  ConfirmActionDTO,
  ExecuteActionDTO,
  ReversibilityReport,
} from '../types/reversibility';
import { v4 as uuidv4 } from 'uuid';

/**
 * ReversibilityService
 * 
 * Core service for implementing universal reversibility pattern.
 * Manages the complete lifecycle of reversible high-power actions,
 * including grace periods, confirmations, reversals, and audit trails.
 * 
 * This is foundational for all reversible actions across the system:
 * - Proposal executions
 * - Admin destructive actions
 * - Agent deployments
 * - Governance decisions
 * - Escrow releases
 * - etc.
 */
export class ReversibilityService {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  /**
   * Create a new reversible action
   * Initializes action in INITIATED state and validates all requirements
   */
  async createReversibleAction(dto: CreateReversibleActionDTO): Promise<ReversibleAction> {
    const id = uuidv4();
    const now = new Date();

    // Validate severity and derive grace period if not provided
    const confirmationTimeout = dto.confirmationRequirement.confirmationTimeoutMinutes;
    const gracePeriodStart = new Date(now.getTime() + confirmationTimeout * 60000);
    const gracePeriodEnd = new Date(
      gracePeriodStart.getTime() + dto.gracePeriodConfig.durationHours * 3600000
    );

    try {
      const result = await this.db.execute(sql`
        INSERT INTO action_reversals (
          id, action_type, description, severity, status,
          initiator_id, initiator_type, initiator_role, initiator_email,
          affected_entity_type, affected_entity_id, affected_entity_name,
          action_payload, before_state, after_state,
          confirmation_type, required_approvals, approver_roles, confirmation_timeout_minutes,
          grace_period_duration_hours, grace_period_reminder_hours,
          user_can_accelerate, auto_execute_at_deadline,
          reversible_fields, initiator_can_reverse, admin_can_reverse,
          governance_can_reverse, minimum_role_to_reverse, reversal_deadline_hours,
          partial_reversal_allowed,
          emergency_stop_enabled, emergency_stop_allowed_actors,
          emergency_stop_requires_approval, emergency_stop_duration_hours,
          emergency_stop_action, emergency_stop_appealable,
          metadata, initiated_at
        ) VALUES (
          ${id}, ${dto.actionType}, ${dto.description}, ${dto.severity}, ${'INITIATED'},
          ${dto.initiator.id}, ${dto.initiator.type}, ${dto.initiator.role || null}, ${dto.initiator.email || null},
          ${dto.affectedEntity.type}, ${dto.affectedEntity.id}, ${dto.affectedEntity.name || null},
          ${JSON.stringify(dto.actionPayload)}, ${JSON.stringify(dto.beforeState)}, ${JSON.stringify(dto.afterState)},
          ${dto.confirmationRequirement.type}, ${dto.confirmationRequirement.requiredApprovals || null},
          ${dto.confirmationRequirement.approverRoles ? JSON.stringify(dto.confirmationRequirement.approverRoles) : null},
          ${dto.confirmationRequirement.confirmationTimeoutMinutes},
          ${dto.gracePeriodConfig.durationHours},
          ${JSON.stringify(dto.gracePeriodConfig.reminderHoursBefore)},
          ${dto.gracePeriodConfig.userCanAccelerate},
          ${dto.gracePeriodConfig.autoExecuteAtDeadline},
          ${JSON.stringify(dto.reversibilityScope.fields)},
          ${dto.reversibilityScope.initiatorCanReverse},
          ${dto.reversibilityScope.adminCanReverse},
          ${dto.reversibilityScope.governanceCanReverse},
          ${dto.reversibilityScope.minimumRoleToReverse || null},
          ${dto.reversibilityScope.reversalDeadlineHours || null},
          ${dto.reversibilityScope.partialReversalAllowed},
          ${dto.emergencyStopConfig?.enabled ?? true},
          ${JSON.stringify(dto.emergencyStopConfig?.allowedActors || ['SUPERUSER', 'GOVERNANCE'])},
          ${dto.emergencyStopConfig?.requiresApproval ?? false},
          ${dto.emergencyStopConfig?.activeDurationHours ?? 24},
          ${dto.emergencyStopConfig?.stopAction || 'PAUSE'},
          ${dto.emergencyStopConfig?.appealable ?? true},
          ${JSON.stringify(dto.metadata || {})},
          ${now}
        )
        RETURNING *
      `);

      return this.parseActionRow(result.rows[0]);
    } catch (error) {
      console.error('Failed to create reversible action:', error);
      throw new Error(`Failed to create reversible action: ${error}`);
    }
  }

  /**
   * Get action by ID
   */
  async getActionById(actionId: string): Promise<ReversibleAction | null> {
    try {
      const result = await this.db.execute(sql`
        SELECT * FROM action_reversals WHERE id = ${actionId}
      `);

      if (result.rows.length === 0) return null;
      return this.parseActionRow(result.rows[0]);
    } catch (error) {
      console.error('Failed to fetch action:', error);
      throw new Error(`Failed to fetch action: ${error}`);
    }
  }

  /**
   * Confirm an action (move from INITIATED to PENDING_CONFIRMATION)
   * Validates confirmation requirements are met
   */
  async confirmAction(dto: ConfirmActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    if (action.status !== ReversibilityStatus.INITIATED) {
      throw new Error(`Action must be in INITIATED status to confirm, current: ${action.status}`);
    }

    // TODO: Validate confirmation data based on confirmation type
    // - PIN verification
    // - Email token validation
    // - Signature verification
    // - etc.

    const now = new Date();
    const gracePeriodStart = new Date(now.getTime() + action.confirmationRequirement.confirmationTimeoutMinutes * 60000);

    try {
      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${'PENDING_CONFIRMATION'},
          confirmed_at = ${now},
          grace_period_starts_at = ${gracePeriodStart},
          grace_period_ends_at = ${new Date(
            gracePeriodStart.getTime() + action.gracePeriodConfig.durationHours * 3600000
          )},
          updated_at = ${now}
        WHERE id = ${dto.actionId}
      `);

      return this.getActionById(dto.actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to confirm action:', error);
      throw new Error(`Failed to confirm action: ${error}`);
    }
  }

  /**
   * Move action into grace period
   * Called automatically when confirmation timeout expires or manually by admin
   */
  async enterGracePeriod(actionId: string): Promise<ReversibleAction> {
    const action = await this.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    if (action.status !== ReversibilityStatus.PENDING_CONFIRMATION) {
      throw new Error(`Action must be in PENDING_CONFIRMATION to enter grace period, current: ${action.status}`);
    }

    const now = new Date();

    try {
      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${'GRACE_PERIOD'},
          updated_at = ${now}
        WHERE id = ${actionId}
      `);

      return this.getActionById(actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to enter grace period:', error);
      throw new Error(`Failed to enter grace period: ${error}`);
    }
  }

  /**
   * Reverse an action (cancel it entirely)
   * Can only be done during grace period or if reversal deadline not passed
   */
  async reverseAction(dto: ReverseActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    // Check if action is still reversible
    const now = new Date();
    if (action.reversalDetails) {
      throw new Error('Action has already been reversed');
    }

    // Validate reversal is allowed
    const isReversalAllowed = this.checkReversalPermission(action, dto.reversedBy);
    if (!isReversalAllowed) {
      throw new Error(`User role ${dto.reversedBy.role} cannot reverse this action`);
    }

    // Check Grace Period
    if (action.status === ReversibilityStatus.GRACE_PERIOD ||
        action.status === ReversibilityStatus.REVERSIBLE_UNTIL) {
      // Valid for reversal - good
    } else if (action.status === ReversibilityStatus.EXECUTED && action.executedAt) {
      // Check if still within reversal deadline
      const reversalDeadline = action.reversibilityScope.reversalDeadlineHours
        ? new Date(action.executedAt.getTime() + action.reversibilityScope.reversalDeadlineHours * 3600000)
        : null;

      if (reversalDeadline && now > reversalDeadline) {
        throw new Error('Action is past its reversal deadline and cannot be reversed');
      }
    } else if (action.status === ReversibilityStatus.IRREVERSIBLE) {
      throw new Error('Action has become irreversible');
    } else {
      throw new Error(`Action cannot be reversed from status: ${action.status}`);
    }

    try {
      const now = new Date();

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${'REVERSED'},
          reversed_at = ${now},
          reversed_by_id = ${dto.reversedBy.id},
          reversed_by_type = ${dto.reversedBy.type},
          reversed_by_role = ${dto.reversedBy.role || null},
          reversal_reason = ${dto.reason},
          reversal_reason_text = ${dto.reversalReason},
          reversal_payload = ${JSON.stringify(dto.reversalPayload || {})},
          updated_at = ${now}
        WHERE id = ${dto.actionId}
      `);

      return this.getActionById(dto.actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to reverse action:', error);
      throw new Error(`Failed to reverse action: ${error}`);
    }
  }

  /**
   * Execute an action (move to EXECUTED state)
   * Can be called after grace period ends or manually by authorized users
   */
  async executeAction(dto: ExecuteActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    // Validate status allows execution
    if (action.status === ReversibilityStatus.INITIATED || action.status === ReversibilityStatus.PENDING_CONFIRMATION) {
      throw new Error(`Action must complete confirmation and grace period before execution, current: ${action.status}`);
    }

    // Check grace period if skip not allowed
    if (!dto.skipGracePeriod && action.gracePeriodEndsAt && new Date() < action.gracePeriodEndsAt) {
      throw new Error('Grace period has not ended yet');
    }

    try {
      const now = new Date();
      const irreversibleAt = action.reversibilityScope.reversalDeadlineHours
        ? new Date(now.getTime() + action.reversibilityScope.reversalDeadlineHours * 3600000)
        : null;

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${'EXECUTED'},
          executed_at = ${now},
          irreversible_at = ${irreversibleAt},
          updated_at = ${now}
        WHERE id = ${dto.actionId}
      `);

      return this.getActionById(dto.actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw new Error(`Failed to execute action: ${error}`);
    }
  }

  /**
   * Mark action as irreversible (passed all reversal deadlines)
   * Called via scheduled job or manual admin override
   */
  async markIrreversible(actionId: string, reason?: string): Promise<ReversibleAction> {
    const action = await this.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    try {
      const now = new Date();

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${'IRREVERSIBLE'},
          irreversible_at = ${now},
          metadata = metadata || jsonb_build_object('marked_irreversible_reason', ${reason || 'reversal deadline passed'}),
          updated_at = ${now}
        WHERE id = ${actionId}
      `);

      return this.getActionById(actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to mark action as irreversible:', error);
      throw new Error(`Failed to mark action as irreversible: ${error}`);
    }
  }

  /**
   * Record an approval for multi-signature actions
   */
  async recordApproval(
    actionId: string,
    approverId: string,
    approverRole: string,
    comment?: string,
    signature?: string
  ): Promise<void> {
    try {
      await this.db.execute(sql`
        INSERT INTO action_approvals (
          action_reversal_id, approver_id, approver_role, approved_at, comment, signature
        ) VALUES (
          ${actionId}, ${approverId}, ${approverRole}, ${new Date()}, ${comment || null}, ${signature || null}
        )
      `);
    } catch (error) {
      console.error('Failed to record approval:', error);
      throw new Error(`Failed to record approval: ${error}`);
    }
  }

  /**
   * Get all approvals for an action
   */
  async getApprovals(actionId: string): Promise<Array<{ approverId: string; approverRole: string; approvedAt: Date; comment?: string }>> {
    try {
      const result = await this.db.execute(sql`
        SELECT approver_id, approver_role, approved_at, comment
        FROM action_approvals
        WHERE action_reversal_id = ${actionId}
        ORDER BY approved_at ASC
      `);

      return result.rows.map((row: any) => ({
        approverId: row.approver_id,
        approverRole: row.approver_role,
        approvedAt: row.approved_at,
        comment: row.comment,
      }));
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      throw new Error(`Failed to fetch approvals: ${error}`);
    }
  }

  /**
   * Get actions pending in grace period (need attention soon)
   */
  async getActionsInGracePeriod(limit: number = 100, offset: number = 0): Promise<ReversibleAction[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT * FROM action_reversals
        WHERE status = ${'GRACE_PERIOD'}
        ORDER BY grace_period_ends_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map((row: any) => this.parseActionRow(row));
    } catch (error) {
      console.error('Failed to fetch actions in grace period:', error);
      throw new Error(`Failed to fetch actions in grace period: ${error}`);
    }
  }

  /**
   * Get actions by type with filtering
   */
  async getActionsByType(
    actionType: string,
    status?: ReversibilityStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReversibleAction[]> {
    try {
      let whereClause = `action_type = ${actionType}`;
      if (status) {
        whereClause += ` AND status = ${status}`;
      }

      const result = await this.db.execute(sql`
        SELECT * FROM action_reversals
        WHERE ${sql.raw(whereClause)}
        ORDER BY initiated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map((row: any) => this.parseActionRow(row));
    } catch (error) {
      console.error('Failed to fetch actions by type:', error);
      throw new Error(`Failed to fetch actions by type: ${error}`);
    }
  }

  /**
   * Get actions for a specific entity (affected_entity_id)
   */
  async getActionsForEntity(
    entityType: string,
    entityId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReversibleAction[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT * FROM action_reversals
        WHERE affected_entity_type = ${entityType} AND affected_entity_id = ${entityId}
        ORDER BY initiated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map((row: any) => this.parseActionRow(row));
    } catch (error) {
      console.error('Failed to fetch entity actions:', error);
      throw new Error(`Failed to fetch entity actions: ${error}`);
    }
  }

  /**
   * Generate compliance report for an action
   */
  async generateReversibilityReport(actionId: string): Promise<ReversibilityReport> {
    const action = await this.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    const approvals = await this.getApprovals(actionId);

    // Get status timeline
    let statusTimeline: Array<{ status: ReversibilityStatus; timestamp: Date; actor?: { id: string; role?: string } }> = [];
    try {
      const result = await this.db.execute(sql`
        SELECT previous_status, new_status, changed_by_id, changed_by_role, changed_at
        FROM action_status_timeline
        WHERE action_reversal_id = ${actionId}
        ORDER BY changed_at ASC
      `);

      statusTimeline = result.rows.map((row: any) => ({
        status: row.new_status,
        timestamp: row.changed_at,
        actor: row.changed_by_id ? { id: row.changed_by_id, role: row.changed_by_role } : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch status timeline:', error);
    }

    const now = new Date();
    const hoursUntilIrreversible = action.irreversibleAt
      ? Math.max(0, (action.irreversibleAt.getTime() - now.getTime()) / (1000 * 3600))
      : undefined;

    return {
      actionId: action.id,
      actionType: action.actionType,
      severity: action.severity,
      status: action.status,
      statusTimeline,
      isCurrentlyReversible: action.isCurrentlyCancelable,
      reversalDeadline: action.irreversibleAt,
      hoursUntilIrreversible,
      reversalHistory: action.reversalDetails
        ? [
            {
              reversedAt: action.reversedAt!,
              reason: action.reversalDetails.reason,
              reversedBy: {
                id: action.reversalDetails.reversedBy.id,
                role: action.reversalDetails.reversedBy.role,
              },
            },
          ]
        : [],
      approvalChain: approvals.map(a => ({
        approver: { id: a.approverId, role: a.approverRole },
        approvedAt: a.approvedAt,
        comment: a.comment,
      })),
      affectedEntities: [
        {
          type: action.affectedEntity.type,
          id: action.affectedEntity.id,
          estimatedImpact: action.description,
        },
      ],
    };
  }

  /**
   * Private helper: Check if actor has permission to reverse this action
   */
  private checkReversalPermission(action: ReversibleAction, actor: { id: string; type: ActorType; role?: string }): boolean {
    if (action.reversibilityScope.initiatorCanReverse && actor.id === action.initiator.id) {
      return true;
    }

    if (action.reversibilityScope.adminCanReverse && actor.role === 'ADMIN') {
      return true;
    }

    if (action.reversibilityScope.governanceCanReverse && actor.type === ActorType.DAO_GOVERNANCE) {
      return true;
    }

    if (action.reversibilityScope.minimumRoleToReverse === actor.role) {
      return true;
    }

    return false;
  }

  /**
   * Private helper: Parse database row to ReversibleAction object
   */
  private parseActionRow(row: any): ReversibleAction {
    const isCurrentlyCancelable = [
      ReversibilityStatus.GRACE_PERIOD,
      ReversibilityStatus.REVERSIBLE_UNTIL,
      ReversibilityStatus.PENDING_CONFIRMATION,
    ].includes(row.status) ||
      (row.status === ReversibilityStatus.EXECUTED && row.irreversible_at && new Date() < row.irreversible_at);

    return {
      id: row.id,
      actionType: row.action_type,
      description: row.description,
      status: row.status,
      severity: row.severity,
      initiator: {
        id: row.initiator_id,
        type: row.initiator_type,
        role: row.initiator_role,
        email: row.initiator_email,
      },
      affectedEntity: {
        type: row.affected_entity_type,
        id: row.affected_entity_id,
        name: row.affected_entity_name,
      },
      actionPayload: row.action_payload,
      beforeState: row.before_state,
      afterState: row.after_state,
      confirmationRequirement: {
        type: row.confirmation_type,
        requiredApprovals: row.required_approvals,
        approverRoles: row.approver_roles,
        confirmationTimeoutMinutes: row.confirmation_timeout_minutes,
      },
      gracePeriodConfig: {
        durationHours: row.grace_period_duration_hours,
        reminderHoursBefore: row.grace_period_reminder_hours,
        userCanAccelerate: row.user_can_accelerate,
        autoExecuteAtDeadline: row.auto_execute_at_deadline,
      },
      reversibilityScope: {
        fields: row.reversible_fields,
        initiatorCanReverse: row.initiator_can_reverse,
        adminCanReverse: row.admin_can_reverse,
        governanceCanReverse: row.governance_can_reverse,
        minimumRoleToReverse: row.minimum_role_to_reverse,
        reversalDeadlineHours: row.reversal_deadline_hours,
        partialReversalAllowed: row.partial_reversal_allowed,
      },
      initiatedAt: row.initiated_at,
      confirmedAt: row.confirmed_at,
      gracePeriodStartsAt: row.grace_period_starts_at,
      gracePeriodEndsAt: row.grace_period_ends_at,
      executedAt: row.executed_at,
      reversedAt: row.reversed_at,
      irreversibleAt: row.irreversible_at,
      executionResult: row.execution_success !== null
        ? {
            success: row.execution_success,
            error: row.execution_error,
            transactionHash: row.execution_transaction_hash,
            blockNumber: row.execution_block_number,
          }
        : undefined,
      reversalDetails: row.reversed_at
        ? {
            reason: row.reversal_reason,
            reversedBy: {
              id: row.reversed_by_id,
              type: row.reversed_by_type,
              role: row.reversed_by_role,
            },
            reversalReason: row.reversal_reason_text,
            reversalPayload: row.reversal_payload,
            reversalTransactionHash: row.reversal_transaction_hash,
          }
        : undefined,
      metadata: row.metadata,
      isCurrentlyCancelable,
    };
  }
}

export default ReversibilityService;
