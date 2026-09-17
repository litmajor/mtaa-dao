import { type Command } from './Command';
import { type CommandBus, type CommandResult, type CommandContext } from './CommandBus';
import { type CommandMiddleware } from './middlewares/AuthorizationMiddleware';
import { type CommandHandlerRegistry } from './handlers/CommandHandlerRegistry';

export class CommandBusImpl implements CommandBus {
  constructor(
    private middlewares: CommandMiddleware[],
    private registry: CommandHandlerRegistry
  ) {}

  async dispatch<T extends Command>(command: T): Promise<CommandResult> {
    let index = -1;

    const dispatchNext = async (i: number, context: CommandContext = {}): Promise<CommandResult> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      if (i < this.middlewares.length) {
        const mw = this.middlewares[i];
        return mw.handle(command, context, (ctxExtension) => dispatchNext(i + 1, { ...context, ...ctxExtension }));
      } else {
        // Pipeline complete, route to handler
        const handler = this.registry.resolve(command.type);
        if (!handler) {
          return {
            success: false,
            commandId: command.id,
            events: [],
            error: 'COMMAND_HANDLER_NOT_FOUND',
          };
        }
        return handler.execute(command, context);
      }
    };

    try {
      return await dispatchNext(0);
    } catch (error) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: error instanceof Error ? error.message : 'PIPELINE_ERROR',
      };
    }
  }
}
