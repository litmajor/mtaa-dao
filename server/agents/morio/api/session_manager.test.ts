import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage', () => ({ storage: { createAuditLog: vi.fn(async () => undefined) } }));

import { SessionManager } from './session_manager';

describe('SessionManager', () => {
  it('keeps sessions isolated per DAO and clears all of a user’s sessions when DAO is omitted', async () => {
    const manager = new SessionManager();
    expect(await manager.findSession('user-a', 'dao-a')).toBeNull();
    expect(manager.getActiveSessions()).toBe(0);
    const first = await manager.getSession('user-a', 'dao-a');
    const second = await manager.getSession('user-a', 'dao-b');
    expect(second.id).not.toBe(first.id);
    expect(await manager.getSession('user-a', 'dao-a')).toBe(first);
    expect(await manager.findSession('user-a', 'dao-a')).toBe(first);

    await manager.clearSession('user-a', 'dao-a');
    expect(await manager.findSession('user-a', 'dao-a')).toBeNull();
    expect((await manager.getSession('user-a', 'dao-a')).id).not.toBe(first.id);
    expect(await manager.getSession('user-a', 'dao-b')).toBe(second);

    await manager.clearSession('user-a');
    expect(manager.getActiveSessions()).toBe(0);
    manager.shutdown();
  });
});
