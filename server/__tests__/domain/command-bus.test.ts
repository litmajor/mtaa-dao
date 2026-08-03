import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Command } from '../../domain/commands/Command';
import { CommandResult } from '../../domain/commands/CommandBus';
import { CommandBusImpl } from '../../domain/commands/CommandBusImpl';
import { CommandHandlerRegistry } from '../../domain/commands/handlers/CommandHandlerRegistry';
import {
  AuthorizationMiddleware,
  AuthorizationService,
  CommandCapabilityMap,
} from '../../domain/commands/middlewares/AuthorizationMiddleware';
import {
  ValidationMiddleware,
  CommandValidatorRegistry,
} from '../../domain/commands/middlewares/ValidationMiddleware';
import {
  IdempotencyMiddleware,
  CommandLogRepository,
  CommandLogRecord,
  CommandStatus,
  assertTransition,
} from '../../domain/commands/middlewares/IdempotencyMiddleware';
import { AuditMiddleware } from '../../domain/commands/middlewares/AuditMiddleware';

// ---------------------------------------------------------------------------
// In-Memory CommandLogRepository with State Machine Guards
// ---------------------------------------------------------------------------

class InMemoryCommandLogRepo implements CommandLogRepository {
  private store = new Map<string, CommandLogRecord>();

  async tryInsert(command: Command): Promise<boolean> {
    if (this.store.has(command.id)) return false;
    this.store.set(command.id, { commandId: command.id, status: 'RECEIVED' });
    return true;
  }

  async transition(commandId: string, to: CommandStatus, result?: CommandResult): Promise<void> {
    const record = this.store.get(commandId);
    if (!record) throw new Error('COMMAND_NOT_FOUND');
    assertTransition(record.status, to);
    record.status = to;
    if (result) record.result = result;
  }

  async getCommand(commandId: string): Promise<CommandLogRecord | null> {
    return this.store.get(commandId) || null;
  }
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

describe('Phase 1: Command Bus Middleware Pipeline (Hardened)', () => {
  const createMockCommand = (id: string, actor = 'agent_mirrorcore', payload: any = {}): Command => ({
    id,
    type: 'TestCommand',
    actor,
    correlationId: 'corr-123',
    timestamp: new Date(),
    payload,
  });

  const setupBus = () => {
    // Capability-based auth
    const authService: AuthorizationService = {
      getCapabilities: async (actor) => {
        const caps: Record<string, string[]> = {
          'agent_mirrorcore': ['trade.execute', 'vault.read'],
          'dao_admin':        ['vault.*'],
          'system':           ['*'],
          'readonly_user':    ['vault.read'],
        };
        return caps[actor] || [];
      },
    };

    const capabilityMap: CommandCapabilityMap = {
      getRequiredCapability: (cmdType) => {
        const map: Record<string, string> = {
          'TestCommand': 'trade.execute',
          'UpdateVault': 'vault.write',
        };
        return map[cmdType];
      },
    };

    const validatorRegistry: CommandValidatorRegistry = {
      getSchema: () => z.object({ value: z.string() }),
    };

    const idempotencyRepo = new InMemoryCommandLogRepo();

    const registry = new CommandHandlerRegistry();
    registry.register({
      commandType: 'TestCommand',
      execute: async (cmd, context) => ({ 
        success: true, 
        commandId: cmd.id, 
        events: [{ 
          id: 'evt_1', 
          type: 'TestEvent',
          version: 1,
          aggregateType: 'Test',
          aggregateId: 'agg-1',
          payload: {},
          timestamp: new Date(),
          actor: 'system'
        }] 
      }),
    });

    const middlewares = [
      new AuthorizationMiddleware(authService, capabilityMap),
      new ValidationMiddleware(validatorRegistry),
      new IdempotencyMiddleware(idempotencyRepo),
      new AuditMiddleware(),
    ];

    return { bus: new CommandBusImpl(middlewares, registry), idempotencyRepo };
  };

  // -------------------------------------------------------------------------
  // Authorization (Capability-Based)
  // -------------------------------------------------------------------------

  it('Auth: actor with exact capability succeeds', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-1', 'agent_mirrorcore', { value: 'ok' });
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(true);
  });

  it('Auth: actor with wildcard capability succeeds', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-2', 'dao_admin', { value: 'ok' });
    cmd.type = 'UpdateVault'; // requires vault.write, dao_admin has vault.*
    const result = await bus.dispatch(cmd);
    // Will fail on handler-not-found (no handler registered for UpdateVault),
    // but it MUST pass auth — confirm it is NOT UNAUTHORIZED
    expect(result.error).not.toContain('UNAUTHORIZED');
  });

  it('Auth: superuser (*) bypasses all gates', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-3', 'system', { value: 'ok' });
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(true);
  });

  it('Auth: actor lacking capability is rejected', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-4', 'readonly_user', { value: 'ok' });
    // readonly_user has vault.read, TestCommand requires trade.execute
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED');
    expect(result.error).toContain('trade.execute');
  });

  it('Auth: unknown actor with zero capabilities is rejected', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-5', 'hacker', { value: 'ok' });
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED');
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('Validation: malformed payload rejected', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-10', 'agent_mirrorcore', { wrongField: 123 });
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/VALIDATION_FAILED/);
  });

  // -------------------------------------------------------------------------
  // Idempotency + State Machine
  // -------------------------------------------------------------------------

  it('Idempotency: concurrent duplicate blocked', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-20', 'agent_mirrorcore', { value: 'ok' });

    const [res1, res2] = await Promise.all([bus.dispatch(cmd), bus.dispatch(cmd)]);

    const success = res1.success ? res1 : res2;
    const blocked = res1.success ? res2 : res1;

    expect(success.success).toBe(true);
    expect(success.events?.[0].id).toBe('evt_1');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe('COMMAND_ALREADY_PROCESSING');
  });

  it('Idempotency: sequential duplicate returns persisted result', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-21', 'agent_mirrorcore', { value: 'ok' });

    const res1 = await bus.dispatch(cmd);
    expect(res1.success).toBe(true);

    const res2 = await bus.dispatch(cmd);
    expect(res2.success).toBe(true);
    expect(res2.events?.[0].id).toBe(res1.events?.[0].id);
  });

  // -------------------------------------------------------------------------
  // State Machine Transition Guard
  // -------------------------------------------------------------------------

  it('State Machine: COMPLETED → EXECUTING is forbidden', () => {
    expect(() => assertTransition('COMPLETED', 'EXECUTING')).toThrow('ILLEGAL_STATE_TRANSITION');
  });

  it('State Machine: FAILED → COMPLETED is forbidden', () => {
    expect(() => assertTransition('FAILED', 'COMPLETED')).toThrow('ILLEGAL_STATE_TRANSITION');
  });

  it('State Machine: RECEIVED → EXECUTING is allowed', () => {
    expect(() => assertTransition('RECEIVED', 'EXECUTING')).not.toThrow();
  });

  it('State Machine: EXECUTING → COMPLETED is allowed', () => {
    expect(() => assertTransition('EXECUTING', 'COMPLETED')).not.toThrow();
  });

  it('State Machine: EXECUTING → FAILED is allowed', () => {
    expect(() => assertTransition('EXECUTING', 'FAILED')).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Handler Registry
  // -------------------------------------------------------------------------

  it('Handler Registry: missing handler fails cleanly', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-30', 'agent_mirrorcore', { value: 'ok' });
    cmd.type = 'UnknownCommand';
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toBe('COMMAND_HANDLER_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // Middleware Order
  // -------------------------------------------------------------------------

  it('Middleware Order: Auth rejects before Validation runs', async () => {
    const { bus } = setupBus();
    const cmd = createMockCommand('cmd-40', 'hacker', { wrongField: 123 });
    const result = await bus.dispatch(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED');
  });
});
