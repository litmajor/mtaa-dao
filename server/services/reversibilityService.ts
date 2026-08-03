import { sql } from 'drizzle-orm';
import {
  ReversibilityStatus,
  ActionSeverity,
  ActorType,
  ReversalReason,
} from '../types/reversibility';
import type {ReversibleAction,  CreateReversibleActionDTO,ReverseActionDTO,ConfirmActionDTO,ExecuteActionDTO,ReversibilityReport,} from '../types/reversibility';
import { v4 as uuidv4 } from 'uuid';

/**
 * ReversibilityService
 *
 
  * This service manages reversible actions, including creation, confirmation
  * grace period handling, execution, reversal, and reporting. It interacts with the database to persist action states
  * and approvals.**/

export class ReversibilityService {
  private db: { execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> };

  constructor(database: { execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }) {
    this.db = database;
  }

  async createReversibleAction(dto: CreateReversibleActionDTO): Promise<ReversibleAction> {
    const id = uuidv4();
    const now = new Date();

    const confirmationTimeout = dto.confirmationRequirement.confirmationTimeoutMinutes;
    const gracePeriodStart = new Date(now.getTime() + confirmationTimeout * 60000);
    const gracePeriodEnd = new Date(
      gracePeriodStart.getTime() + dto.gracePeriodConfig.durationHours * 3600000
    );

    const approverRoles = dto.confirmationRequirement.approverRoles ?? [];
    const gracePeriodReminderHours = dto.gracePeriodConfig.reminderHoursBefore ?? [];
    const reversibleFields = dto.reversibilityScope.fields ?? [];
    const emergencyStopAllowedActors = dto.emergencyStopConfig?.allowedActors ?? ['SUPER_ADMIN', 'GOVERNANCE', 'SYSTEM'];

    const approverRolesSql = approverRoles.length > 0
      ? sql`ARRAY[${sql.join(approverRoles.map((role) => sql`${role}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;

    const gracePeriodReminderHoursSql = gracePeriodReminderHours.length > 0
      ? sql`ARRAY[${sql.join(gracePeriodReminderHours.map((hour) => sql`${hour}`), sql`, `)}]::integer[]`
      : sql`ARRAY[]::integer[]`;

    const reversibleFieldsSql = reversibleFields.length > 0
      ? sql`ARRAY[${sql.join(reversibleFields.map((field) => sql`${field}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;

    const emergencyStopAllowedActorsSql = emergencyStopAllowedActors.length > 0
      ? sql`ARRAY[${sql.join(emergencyStopAllowedActors.map((actor) => sql`${actor}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;

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
          ${dto.confirmationRequirement.type}, ${dto.confirmationRequirement.requiredApprovals ?? null},
          ${approverRolesSql},
          ${dto.confirmationRequirement.confirmationTimeoutMinutes},
          ${dto.gracePeriodConfig.durationHours},
          ${gracePeriodReminderHoursSql},
          ${dto.gracePeriodConfig.userCanAccelerate},
          ${dto.gracePeriodConfig.autoExecuteAtDeadline},
          ${reversibleFieldsSql},
          ${dto.reversibilityScope.initiatorCanReverse},
          ${dto.reversibilityScope.adminCanReverse},
          ${dto.reversibilityScope.governanceCanReverse},
          ${dto.reversibilityScope.minimumRoleToReverse || null},
          ${dto.reversibilityScope.reversalDeadlineHours ?? null},
          ${dto.reversibilityScope.partialReversalAllowed},
          ${dto.emergencyStopConfig?.enabled ?? true},
          ${emergencyStopAllowedActorsSql},
          ${dto.emergencyStopConfig?.requiresApproval ?? false},
          ${dto.emergencyStopConfig?.activeDurationHours ?? 24},
          ${dto.emergencyStopConfig?.stopAction ?? 'PAUSE'},
          ${dto.emergencyStopConfig?.appealable ?? true},
          ${JSON.stringify(dto.metadata ?? {})},
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

  async confirmAction(dto: ConfirmActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    if (action.status !== ReversibilityStatus.INITIATED) {
      throw new Error(`Action must be in INITIATED status to confirm, current: ${action.status}`);
    }

    const now = new Date();
    const gracePeriodStart = new Date(now.getTime() + action.confirmationRequirement.confirmationTimeoutMinutes * 60000);

    try {
      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${ReversibilityStatus.PENDING_CONFIRMATION},
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
          status = ${ReversibilityStatus.GRACE_PERIOD},
          updated_at = ${now}
        WHERE id = ${actionId}
      `);

      return this.getActionById(actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to enter grace period:', error);
      throw new Error(`Failed to enter grace period: ${error}`);
    }
  }

  async reverseAction(dto: ReverseActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    const now = new Date();
    if (action.reversalDetails) {
      throw new Error('Action has already been reversed');
    }

    const isReversalAllowed = this.checkReversalPermission(action, dto.reversedBy);
    if (!isReversalAllowed) {
      throw new Error(`User role ${dto.reversedBy.role} cannot reverse this action`);
    }

    if (action.status === ReversibilityStatus.GRACE_PERIOD ||
        action.status === ReversibilityStatus.REVERSIBLE_UNTIL) {
      // Valid for reversal
    } else if (action.status === ReversibilityStatus.EXECUTED && action.executedAt) {
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
      const now2 = new Date();

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${ReversibilityStatus.REVERSED},
          reversed_at = ${now2},
          reversed_by_id = ${dto.reversedBy.id},
          reversed_by_type = ${dto.reversedBy.type},
          reversed_by_role = ${dto.reversedBy.role || null},
          reversal_reason = ${dto.reason},
          reversal_reason_text = ${dto.reversalReason || null},
          reversal_payload = ${JSON.stringify(dto.reversalPayload ?? {})},
          updated_at = ${now2}
        WHERE id = ${dto.actionId}
      `);

      return this.getActionById(dto.actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to reverse action:', error);
      throw new Error(`Failed to reverse action: ${error}`);
    }
  }

  /**
   * Executes the action after the grace period has ended. This method should be called by the system or an authorized actor to finalize the action.
   */
  async executeAction(dto: ExecuteActionDTO): Promise<ReversibleAction> {
    const action = await this.getActionById(dto.actionId);
    if (!action) throw new Error('Action not found');

    if (action.status === ReversibilityStatus.EXECUTED) {
      return action;
    }

    if (action.status === ReversibilityStatus.INITIATED || action.status === ReversibilityStatus.PENDING_CONFIRMATION) {
      throw new Error(`Action must complete confirmation and grace period before execution, current: ${action.status}`);
    }

    if (!dto.skipGracePeriod && action.gracePeriodEndsAt && new Date() < action.gracePeriodEndsAt) {
      throw new Error('Grace period has not ended yet');
    }

    try {
      const now = new Date();
      const irreversibleAt = action.reversibilityScope.reversalDeadlineHours
        ? new Date(now.getTime() + action.reversibilityScope.reversalDeadlineHours * 3600000)
        : null;

      const result = dto.executionResult;

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${ReversibilityStatus.EXECUTED},
          executed_at = ${now},
          irreversible_at = ${irreversibleAt},
          execution_success = ${result?.success ?? null},
          execution_error = ${result?.error ?? null},
          execution_transaction_hash = ${result?.transactionHash ?? null},
          execution_block_number = ${result?.blockNumber ?? null},
          updated_at = ${now}
        WHERE id = ${dto.actionId}
      `);

      return this.getActionById(dto.actionId) as Promise<ReversibleAction>;
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw new Error(`Failed to execute action: ${error}`);
    }
  }

  async markIrreversible(actionId: string, reason?: string): Promise<ReversibleAction> {
    const action = await this.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    try {
      const now = new Date();

      await this.db.execute(sql`
        UPDATE action_reversals
        SET 
          status = ${ReversibilityStatus.IRREVERSIBLE},
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

  async checkAndAutoConfirmIfApprovalsMet(actionId: string): Promise<ReversibleAction | null> {
    const action = await this.getActionById(actionId);
    if (!action) {
      throw new Error('Action not found');
    }

    if (action.confirmationRequirement.type !== 'MULTI_SIG') {
      return null;
    }

    const requiredApprovals = action.confirmationRequirement.requiredApprovals ?? 1;
    const approvals = await this.getApprovals(actionId);

    if (approvals.length < requiredApprovals) {
      return null;
    }

    if (action.status === ReversibilityStatus.INITIATED) {
      await this.confirmAction({ actionId });
    }

    if (action.status === ReversibilityStatus.PENDING_CONFIRMATION || action.status === ReversibilityStatus.INITIATED) {
      return this.enterGracePeriod(actionId);
    }

    return action;
  }

  async getApprovals(actionId: string): Promise<Array<{ approverId: string; approverRole: string; approvedAt: Date; comment?: string }>> {
    try {
      const result = await this.db.execute(sql`
        SELECT approver_id, approver_role, approved_at, comment
        FROM action_approvals
        WHERE action_reversal_id = ${actionId}
        ORDER BY approved_at ASC
      `);

      return result.rows.map((row: Record<string, unknown>) => ({
        approverId: row.approver_id as string,
        approverRole: row.approver_role as string,
        approvedAt: row.approved_at as Date,
        comment: row.comment as string | undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      throw new Error(`Failed to fetch approvals: ${error}`);
    }
  }

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
   * Fetches actions filtered by action type and optionally by status. Supports pagination through limit and offset parameters.
   */
  async getActionsByType(
    actionType: string,
    status?: ReversibilityStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReversibleAction[]> {
    try {
      const result = status
        ? await this.db.execute(sql`
            SELECT * FROM action_reversals
            WHERE action_type = ${actionType} AND status = ${status}
            ORDER BY initiated_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `)
        : await this.db.execute(sql`
            SELECT * FROM action_reversals
            WHERE action_type = ${actionType}
            ORDER BY initiated_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `);

      return result.rows.map((row: any) => this.parseActionRow(row));
    } catch (error) {
      console.error('Failed to fetch actions by type:', error);
      throw new Error(`Failed to fetch actions by type: ${error}`);
    }
  }

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

  async generateReversibilityReport(actionId: string): Promise<ReversibilityReport> {
    const action = await this.getActionById(actionId);
    if (!action) throw new Error('Action not found');

    const approvals = await this.getApprovals(actionId);

    let statusTimeline: Array<{ status: ReversibilityStatus; timestamp: Date; actor?: { id: string; role?: string } }> = [];
    try {
      const result = await this.db.execute(sql`
        SELECT previous_status, new_status, changed_by_id, changed_by_role, changed_at
        FROM action_status_timeline
        WHERE action_reversal_id = ${actionId}
        ORDER BY changed_at ASC
      `);

      statusTimeline = result.rows.map((row: Record<string, unknown>) => ({
        status: row.new_status as ReversibilityStatus,
        timestamp: row.changed_at as Date,
        actor: row.changed_by_id ? { id: row.changed_by_id as string, role: row.changed_by_role as string | undefined } : undefined,
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

  private parseActionRow(row: Record<string, unknown>): ReversibleAction {
    const status = row.status as ReversibilityStatus;
    const irreversibleAt = row.irreversible_at ? new Date(row.irreversible_at as Date | string) : undefined;
    const isCurrentlyCancelable = [
      ReversibilityStatus.GRACE_PERIOD,
      ReversibilityStatus.REVERSIBLE_UNTIL,
      ReversibilityStatus.PENDING_CONFIRMATION,
    ].includes(status) ||
      (status === ReversibilityStatus.EXECUTED && irreversibleAt !== undefined && new Date() < irreversibleAt);

    const executionSuccess = row.execution_success as boolean | null | undefined;
    const reversalTimestamp = row.reversed_at as Date | undefined;

    return {
      id: row.id as string,
      actionType: row.action_type as string,
      description: row.description as string,
      status,
      severity: row.severity as ActionSeverity,
      initiator: {
        id: row.initiator_id as string,
        type: row.initiator_type as ActorType,
        role: row.initiator_role as string | undefined,
        email: row.initiator_email as string | undefined,
      },
      affectedEntity: {
        type: row.affected_entity_type as string,
        id: row.affected_entity_id as string,
        name: row.affected_entity_name as string | undefined,
      },
      actionPayload: row.action_payload as Record<string, unknown>,
      beforeState: row.before_state as Record<string, unknown>,
      afterState: row.after_state as Record<string, unknown>,
      confirmationRequirement: {
        type: row.confirmation_type as ReversibleAction['confirmationRequirement']['type'],
        requiredApprovals: row.required_approvals as number | undefined,
        approverRoles: row.approver_roles as string[] | undefined,
        confirmationTimeoutMinutes: row.confirmation_timeout_minutes as number,
      },
      gracePeriodConfig: {
        durationHours: row.grace_period_duration_hours as number,
        reminderHoursBefore: row.grace_period_reminder_hours as number[],
        userCanAccelerate: row.user_can_accelerate as boolean,
        autoExecuteAtDeadline: row.auto_execute_at_deadline as boolean,
      },
      reversibilityScope: {
        fields: row.reversible_fields as string[],
        initiatorCanReverse: row.initiator_can_reverse as boolean,
        adminCanReverse: row.admin_can_reverse as boolean,
        governanceCanReverse: row.governance_can_reverse as boolean,
        minimumRoleToReverse: row.minimum_role_to_reverse as string | undefined,
        reversalDeadlineHours: row.reversal_deadline_hours as number | undefined,
        partialReversalAllowed: row.partial_reversal_allowed as boolean,
      },
      initiatedAt: row.initiated_at as Date,
      confirmedAt: row.confirmed_at as Date | undefined,
      gracePeriodStartsAt: row.grace_period_starts_at as Date | undefined,
      gracePeriodEndsAt: row.grace_period_ends_at as Date | undefined,
      executedAt: row.executed_at as Date | undefined,
      reversedAt: reversalTimestamp,
      irreversibleAt: row.irreversible_at as Date | undefined,
      executionResult: executionSuccess !== null && executionSuccess !== undefined
        ? {
            success: executionSuccess,
            error: row.execution_error as string | undefined,
            transactionHash: row.execution_transaction_hash as string | undefined,
            blockNumber: row.execution_block_number as number | undefined,
          }
        : undefined,
      reversalDetails: reversalTimestamp
        ? {
            reason: row.reversal_reason as ReversalReason,
            reversedBy: {
              id: row.reversed_by_id as string,
              type: row.reversed_by_type as ActorType,
              role: row.reversed_by_role as string | undefined,
            },
            reversalReason: row.reversal_reason_text as string,
            reversalPayload: row.reversal_payload as Record<string, unknown> | undefined,
            reversalTransactionHash: row.reversal_transaction_hash as string | undefined,
          }
        : undefined,
      metadata: row.metadata as ReversibleAction['metadata'],
      isCurrentlyCancelable,
    };
  }
}

export default ReversibilityService;