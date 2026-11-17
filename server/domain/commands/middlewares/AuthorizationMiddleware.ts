import { type Command } from '../Command';
import { type CommandResult, type CommandContext } from '../CommandBus';
import { getRequiredCommandCapability, isCommandAuthorized } from '../CommandAuthorization';

export type NextFn = (context?: CommandContext) => Promise<CommandResult>;

export interface CommandMiddleware {
  handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult>;
}

export interface CommandCapabilityMap {
  getRequiredCapability(commandType: string): string | undefined;
}

export interface AuthorizationService {
  isAuthorized(command: Command, requiredCapability: string): Promise<boolean>;
}

export class AuthorizationMiddleware implements CommandMiddleware {
  constructor(
    private authService: AuthorizationService,
    private capabilityMap: CommandCapabilityMap,
  ) {}

  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    const requiredCapability = this.capabilityMap.getRequiredCapability(command.type);
    if (!requiredCapability) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `UNAUTHORIZED: command '${command.type}' has no authorization policy`,
      };
    }

    const isAllowed = await this.authService.isAuthorized(command, requiredCapability);
    if (!isAllowed) {
      return {
        success: false,
        commandId: command.id,
        events: [],
        error: `UNAUTHORIZED: actor '${command.actor}' lacks capability '${requiredCapability}'`,
      };
    }

    return next();
  }
}

export class DatabaseAuthorizationService implements AuthorizationService {
  async isAuthorized(command: Command, requiredCapability: string): Promise<boolean> {
    return isCommandAuthorized(command, requiredCapability);
  }
}

export class ExplicitCommandCapabilityMap implements CommandCapabilityMap {
  getRequiredCapability(commandType: string): string | undefined {
    return getRequiredCommandCapability(commandType);
  }
}
