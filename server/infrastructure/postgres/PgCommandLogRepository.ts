import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { commandLog } from '../../db/schema/eda';
import type { Command } from '../../domain/commands/Command';
import type { CommandLogRepository, CommandLogRecord, CommandStatus } from '../../domain/commands/middlewares/IdempotencyMiddleware';
import { assertTransition } from '../../domain/commands/middlewares/IdempotencyMiddleware';
import type { CommandResult } from '../../domain/commands/CommandBus';

export class PgCommandLogRepository implements CommandLogRepository {
  async tryInsert(command: Command): Promise<boolean> {
    try {
      const inserted = await db.insert(commandLog)
        .values({
          commandId: command.id,
          commandType: command.type,
          actor: command.actor,
          correlationId: command.correlationId,
          payload: command.payload,
          status: 'RECEIVED',
          createdAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ commandId: commandLog.commandId });

      return inserted.length > 0;
    } catch (error: any) {
      // In case of any other error, log it
      console.error('Error inserting command log:', error);
      return false;
    }
  }

  async transition(commandId: string, to: CommandStatus, result?: CommandResult): Promise<void> {
    const record = await this.getCommand(commandId);
    if (!record) {
      throw new Error(`Command log not found for ID: ${commandId}`);
    }

    assertTransition(record.status, to);

    const updateData: any = { status: to };
    if (result) {
      updateData.result = result;
      if (to === 'FAILED') {
        updateData.error = result.error;
      }
      if (to === 'COMPLETED' || to === 'FAILED') {
        updateData.completedAt = new Date();
      }
    }

    await db.update(commandLog)
      .set(updateData)
      .where(eq(commandLog.commandId, commandId));
  }

  async getCommand(commandId: string): Promise<CommandLogRecord | null> {
    const results = await db.select()
      .from(commandLog)
      .where(eq(commandLog.commandId, commandId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      commandId: row.commandId,
      status: row.status as CommandStatus,
      result: row.result as CommandResult | undefined,
    };
  }
}
