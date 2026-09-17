import { type Command } from './Command';
import { type DomainEvent } from '../events/DomainEvent';

/**
 * Context passed down the middleware pipeline to the handler.
 */
export interface CommandContext {
  tx?: any; // The database transaction, injected by TransactionMiddleware
  [key: string]: any;
}

/**
 * Result returned by the Command Bus after execution.
 */
export interface CommandResult {
  success: boolean;
  commandId: string;
  events?: DomainEvent[]; // List of Domain Events emitted as a result
  error?: string;
}

export interface CommandHandler<T extends Command> {
  readonly commandType: string;
  execute(command: T, context: CommandContext): Promise<CommandResult>;
}

export interface CommandBus {
  /**
   * Dispatches a command through the middleware pipeline
   */
  dispatch<T extends Command>(command: T): Promise<CommandResult>;
}
