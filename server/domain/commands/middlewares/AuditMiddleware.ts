import { Command } from '../Command';
import { CommandResult } from '../CommandBus';
import { CommandMiddleware, NextFn } from './AuthorizationMiddleware';
import { logger } from '../../../observability/logger';

import { CommandContext } from '../CommandBus';

export class AuditMiddleware implements CommandMiddleware {
  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    // We assume CorrelationContext is already set by Express/Worker wrapper,
    // but we log explicit command execution checkpoints for the audit trail.
    
    logger.info({
      message: 'command.executing',
      commandId: command.id,
      commandType: command.type,
      actor: command.actor,
      correlationId: command.correlationId,
      timestamp: command.timestamp,
    });
    
    const result = await next();
    
    if (result.success) {
      logger.info({
        message: 'command.completed',
        commandId: command.id,
        commandType: command.type,
        actor: command.actor,
        correlationId: command.correlationId,
        events: result.events?.map(e => e.id),
        timestamp: new Date(),
      });
    } else {
      logger.error({
        message: 'command.failed',
        commandId: command.id,
        commandType: command.type,
        actor: command.actor,
        correlationId: command.correlationId,
        error: result.error,
        timestamp: new Date(),
      });
    }
    
    return result;
  }
}
