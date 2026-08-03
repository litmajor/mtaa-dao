import { Command } from '../Command';
import { CommandHandler } from '../CommandBus';

export class CommandHandlerRegistry {
  private handlers = new Map<string, CommandHandler<any>>();
  
  register(handler: CommandHandler<any>) {
    this.handlers.set(handler.commandType, handler);
  }
  
  resolve(commandType: string): CommandHandler<any> | undefined {
    return this.handlers.get(commandType);
  }
}
