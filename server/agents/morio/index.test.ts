import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/nuru', () => ({
  nuru: { understand: vi.fn(async (_text: string, context: unknown) => ({ intent: 'help', confidence: 1, context })) }
}));
vi.mock('../../utils/logger', () => ({
  Logger: class { info = vi.fn(); debug = vi.fn(); warn = vi.fn(); error = vi.fn(); },
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('./api/session_manager', () => ({ SessionManager: class {} }));
vi.mock('./api/response_generator', () => ({ ResponseGenerator: class {} }));
vi.mock('./api/user_generator', () => ({ UserGenerator: class {} }));
vi.mock('../../core/agent-framework/agent-communicator', () => ({
  AgentCommunicator: class {
    subscribe = vi.fn();
    unsubscribe = vi.fn();
    respond = vi.fn();
  }
}));

import { MorioAgent } from './index';
import type { Session } from './types';

function makeSession(): Session {
  return {
    id: 'session-test',
    userId: 'user-1',
    daoId: 'dao-1',
    context: {
      userId: 'user-1', daoId: 'dao-1', role: 'member', contributionScore: 0, recentActions: [],
      preferences: { language: 'en', notifications: true, theme: 'light' },
      sessionData: { conversationHistory: [], lastInteraction: new Date() }
    },
    createdAt: new Date(), lastActivity: new Date(), metadata: {}
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MorioAgent', () => {
  it('enforces responseTimeout and returns session correlation and elapsed time', async () => {
    const session = makeSession();
    let responseSignal: AbortSignal | undefined;
    const sessionManager = {
      getOrCreateSession: vi.fn(async () => ({ session, created: true })),
      updateSession: vi.fn(async () => undefined),
      clearSession: vi.fn(async () => undefined),
      getSession: vi.fn(async () => session),
      shutdown: vi.fn()
    };
    const communicator = { subscribe: vi.fn(), unsubscribe: vi.fn(), respond: vi.fn() };
    const agent = new MorioAgent(
      { responseTimeout: 5, metricsUpdateIntervalMs: 60_000 },
      undefined,
      {
        sessionManager: sessionManager as any,
        responseGenerator: { generate: vi.fn((_understanding, _context, signal: AbortSignal) => {
          responseSignal = signal;
          return new Promise(() => undefined);
        }) } as any,
        userGenerator: {} as any,
        communicator: communicator as any,
        nuru: { understand: vi.fn(async (_text: string, context: any) => ({ intent: 'help', confidence: 1, context })) } as any
      }
    );

    const response = await agent.handleMessage({ userId: 'user-1', daoId: 'dao-1', content: 'help' });
    expect(response.intent).toBe('error');
    expect(response.metadata.sessionId).toBe('session-test');
    expect(response.metadata.processingTime).toBeGreaterThanOrEqual(5);
    expect(response.metadata.error).toMatch(/timed out/);
    expect(responseSignal?.aborted).toBe(true);
    expect(agent.getMetrics().totalSessions).toBe(1);

    await agent.shutdown();
    expect(communicator.unsubscribe).toHaveBeenCalled();
    expect(sessionManager.shutdown).toHaveBeenCalled();
  });

  it('counts newly created sessions cumulatively, not as peak concurrent sessions', async () => {
    const sessionA = makeSession();
    const sessionB = { ...makeSession(), id: 'session-test-2', userId: 'user-2' };
    const sessionManager = {
      getOrCreateSession: vi.fn(async (userId: string) => ({
        session: userId === 'user-1' ? sessionA : sessionB,
        created: true
      })),
      updateSession: vi.fn(async () => undefined),
      getSession: vi.fn(async () => sessionA),
      clearSession: vi.fn(async () => undefined),
      shutdown: vi.fn()
    };
    const agent = new MorioAgent({}, undefined, {
      sessionManager: sessionManager as any,
      responseGenerator: { generate: vi.fn(async () => ({ text: 'ok', suggestions: [], actions: [] })) } as any,
      userGenerator: {} as any,
      communicator: { subscribe: vi.fn(), unsubscribe: vi.fn(), respond: vi.fn() } as any,
      nuru: { understand: vi.fn(async (_text: string, context: any) => ({ intent: 'help', confidence: 1, context })) } as any
    });

    await agent.handleMessage({ userId: 'user-1', daoId: 'dao-1', content: 'first' });
    await agent.handleMessage({ userId: 'user-2', daoId: 'dao-1', content: 'second' });
    expect(agent.getMetrics().totalSessions).toBe(2);
    await agent.shutdown();
  });

  it('serializes messages per user and DAO and provides the latest turn in context', async () => {
    const session = makeSession();
    let releaseFirst!: (value: { text: string; suggestions: string[]; actions: [] }) => void;
    const receivedHistories: Array<Array<{ role: string; content: string }>> = [];
    const responseGenerator = {
      generate: vi.fn((_understanding: unknown, context: any) => {
        receivedHistories.push([...context.sessionData.conversationHistory]);
        if (receivedHistories.length === 1) return new Promise(resolve => { releaseFirst = resolve; });
        return Promise.resolve({ text: 'second response', suggestions: [], actions: [] });
      })
    };
    const sessionManager = {
      getOrCreateSession: vi.fn(async () => ({ session, created: true })),
      updateSession: vi.fn(async () => undefined),
      findSession: vi.fn(async () => session),
      clearSession: vi.fn(async () => undefined),
      shutdown: vi.fn()
    };
    const nuru = {
      understand: vi.fn(async (_text: string, context: any) => ({ intent: 'help', confidence: 1, context }))
    };
    const agent = new MorioAgent({ responseTimeout: 5000 }, undefined, {
      sessionManager: sessionManager as any,
      responseGenerator: responseGenerator as any,
      userGenerator: {} as any,
      communicator: { subscribe: vi.fn(), unsubscribe: vi.fn(), respond: vi.fn() } as any,
      nuru: nuru as any
    });

    const first = agent.handleMessage({ userId: 'user-1', daoId: 'dao-1', content: 'first' });
    await vi.waitFor(() => expect(responseGenerator.generate).toHaveBeenCalledTimes(1));
    const second = agent.handleMessage({ userId: 'user-1', daoId: 'dao-1', content: 'second' });
    await Promise.resolve();
    expect(responseGenerator.generate).toHaveBeenCalledTimes(1);

    releaseFirst({ text: 'first response', suggestions: [], actions: [] });
    await Promise.all([first, second]);
    expect(responseGenerator.generate).toHaveBeenCalledTimes(2);
    expect(receivedHistories[1]).toEqual([
      expect.objectContaining({ role: 'user', content: 'first' }),
      expect.objectContaining({ role: 'assistant', content: 'first response' }),
      expect.objectContaining({ role: 'user', content: 'second' })
    ]);
    await agent.shutdown();
  });

  it('expires idle activity from metrics using a sliding timestamp without per-message timers', async () => {
    vi.useFakeTimers();
    const session = makeSession();
    const agent = new MorioAgent({ activeSessionTimeoutMs: 100, metricsUpdateIntervalMs: 60_000 }, undefined, {
      sessionManager: {
        getOrCreateSession: vi.fn(async () => ({ session, created: true })),
        updateSession: vi.fn(async () => undefined),
        findSession: vi.fn(async () => session),
        clearSession: vi.fn(async () => undefined),
        shutdown: vi.fn()
      } as any,
      responseGenerator: { generate: vi.fn(async () => ({ text: 'ok', suggestions: [], actions: [] })) } as any,
      userGenerator: {} as any,
      communicator: { subscribe: vi.fn(), unsubscribe: vi.fn(), respond: vi.fn() } as any,
      nuru: { understand: vi.fn(async (_text: string, context: any) => ({ intent: 'help', confidence: 1, context })) } as any
    });

    await agent.handleMessage({ userId: 'user-1', daoId: 'dao-1', content: 'hello' });
    expect(agent.getMetrics().activeSessions).toBe(1);
    await vi.advanceTimersByTimeAsync(101);
    expect(agent.getMetrics().activeSessions).toBe(0);
    await agent.shutdown();
  });
});
