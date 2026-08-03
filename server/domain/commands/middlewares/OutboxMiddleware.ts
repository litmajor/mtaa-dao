import { Command } from '../Command';
import { CommandResult, CommandContext } from '../CommandBus';
import { CommandMiddleware, NextFn } from './AuthorizationMiddleware';
import { EventPublisher } from '../../events/EventPublisher';

/**
 * Executes the downstream handler, takes any Domain Events returned in the result,
 * and publishes them durably using the active transaction context.
 */
export class OutboxMiddleware implements CommandMiddleware {
  constructor(private publisher: EventPublisher) {}

  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    // We pass context down to the handler (which will execute the business logic)
    const result = await next();

    // If the handler succeeded and produced events, we persist them.
    if (result.success && result.events && result.events.length > 0) {
      if (!context.tx) {
        throw new Error('OutboxMiddleware requires a transaction context (tx)');
      }
      for (const event of result.events) {
        await this.publisher.publishDurable(event, context.tx);
      }
    }

    return result;
  }
}
