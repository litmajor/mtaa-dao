import { Command } from '../Command';
import { CommandResult } from '../CommandBus';
import { CommandMiddleware, NextFn } from './AuthorizationMiddleware';
import { z } from 'zod';

import { CommandContext } from '../CommandBus';

export interface CommandValidatorRegistry {
  getSchema(commandType: string): z.ZodType<any> | undefined;
}

export class ValidationMiddleware implements CommandMiddleware {
  constructor(private registry: CommandValidatorRegistry) {}

  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    const schema = this.registry.getSchema(command.type);
    
    if (schema) {
      const result = schema.safeParse(command.payload);
      
      if (!result.success) {
        return { 
          success: false, 
          commandId: command.id, 
          events: [], 
          error: `VALIDATION_FAILED: ${result.error.message}` 
        };
      }
      
      // Override payload with sanitized/parsed data if necessary
      command.payload = result.data;
    }
    
    return next();
  }
}
