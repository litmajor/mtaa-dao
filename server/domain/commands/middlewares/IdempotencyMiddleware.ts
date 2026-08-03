import { Command } from '../Command';
import { CommandResult, CommandContext } from '../CommandBus';
import { CommandMiddleware, NextFn } from './AuthorizationMiddleware';

// ---------------------------------------------------------------------------
// Command Status State Machine
// ---------------------------------------------------------------------------

export type CommandStatus = 'RECEIVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

const ALLOWED_TRANSITIONS: Record<CommandStatus, CommandStatus[]> = {
  RECEIVED:  ['EXECUTING'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED:    [],
};

export function assertTransition(from: CommandStatus, to: CommandStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`ILLEGAL_STATE_TRANSITION: ${from} → ${to}`);
  }
}

// ---------------------------------------------------------------------------
// Repository Contract
// ---------------------------------------------------------------------------

export interface CommandLogRecord {
  commandId: string;
  status: CommandStatus;
  result?: CommandResult;
}

export interface CommandLogRepository {
  /**
   * Atomically inserts a RECEIVED record.
   * Returns false if commandId already exists (concurrent lock).
   */
  tryInsert(command: Command): Promise<boolean>;

  /**
   * Transitions the command to a new status with state machine validation.
   * The implementation MUST call assertTransition(currentStatus, newStatus).
   */
  transition(commandId: string, to: CommandStatus, result?: CommandResult): Promise<void>;

  /**
   * Fetches the current state of a command.
   */
  getCommand(commandId: string): Promise<CommandLogRecord | null>;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export class IdempotencyMiddleware implements CommandMiddleware {
  constructor(private repo: CommandLogRepository) {}

  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    // 1. Attempt to acquire the execution slot
    const acquired = await this.repo.tryInsert(command);

    if (!acquired) {
      const existing = await this.repo.getCommand(command.id);

      if (existing?.status === 'COMPLETED' || existing?.status === 'FAILED') {
        // Return the persisted result verbatim — no re-execution
        return existing.result || {
          success: false,
          commandId: command.id,
          events: [],
          error: 'UNKNOWN_PREVIOUS_RESULT',
        };
      }

      // Still RECEIVED or EXECUTING — concurrent duplicate
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: 'COMMAND_ALREADY_PROCESSING',
      };
    }

    // 2. Transition RECEIVED → EXECUTING
    await this.repo.transition(command.id, 'EXECUTING');

    // 3. Execute downstream
    let result: CommandResult;
    try {
      result = await next();
    } catch (error) {
      const failResult: CommandResult = {
        success: false,
        commandId: command.id,
        events: [],
        error: error instanceof Error ? error.message : 'UNEXPECTED_ERROR',
      };
      // EXECUTING → FAILED
      await this.repo.transition(command.id, 'FAILED', failResult);
      return failResult;
    }

    // 4. EXECUTING → COMPLETED or FAILED based on handler outcome
    const finalStatus: CommandStatus = result.success ? 'COMPLETED' : 'FAILED';
    await this.repo.transition(command.id, finalStatus, result);

    return result;
  }
}
