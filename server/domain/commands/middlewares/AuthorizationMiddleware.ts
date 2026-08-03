import { Command } from '../Command';
import { CommandResult, CommandContext } from '../CommandBus';

export type NextFn = (context?: CommandContext) => Promise<CommandResult>;

export interface CommandMiddleware {
  handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult>;
}

// ---------------------------------------------------------------------------
// Capability-Based Authorization
// ---------------------------------------------------------------------------

/**
 * Maps a command type to the capability string required to execute it.
 * Example: { 'ExecuteTrade': 'trade.execute', 'UpdateVault': 'vault.write' }
 */
export interface CommandCapabilityMap {
  getRequiredCapability(commandType: string): string | undefined;
}

/**
 * Resolves the capabilities an actor currently holds.
 * Implementations may query a database, cache, or static config.
 */
export interface AuthorizationService {
  getCapabilities(actor: string): Promise<string[]>;
}

export class AuthorizationMiddleware implements CommandMiddleware {
  constructor(
    private authService: AuthorizationService,
    private capabilityMap: CommandCapabilityMap,
  ) {}

  async handle(command: Command, context: CommandContext, next: NextFn): Promise<CommandResult> {
    const requiredCapability = this.capabilityMap.getRequiredCapability(command.type);

    // If no capability is mapped, the command is unrestricted
    if (!requiredCapability) {
      return next();
    }

    const actorCapabilities = await this.authService.getCapabilities(command.actor);

    // Check for exact match or wildcard (e.g., "trade.*" covers "trade.execute")
    const isAllowed = actorCapabilities.some((cap) => {
      if (cap === '*') return true; // superuser
      if (cap === requiredCapability) return true;
      // Wildcard match: "trade.*" matches "trade.execute"
      if (cap.endsWith('.*')) {
        const prefix = cap.slice(0, -1); // "trade."
        return requiredCapability.startsWith(prefix);
      }
      return false;
    });

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
