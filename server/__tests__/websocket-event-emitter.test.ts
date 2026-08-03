import { describe, expect, it, vi } from 'vitest';

const emitToRoom = vi.fn();
const emitToUser = vi.fn();

vi.mock('../websocket/websocket', () => ({
  default: class MockWebSocketManager {
    public emitToRoom = emitToRoom;
    public emitToUser = emitToUser;
  },
}));

import { getEventEmitter } from '../middleware/websocket-event-emitter';

describe('websocket event emitter fallback', () => {
  it('returns a safe emitter before initialization', () => {
    expect(() => getEventEmitter()).not.toThrow();
    const emitter = getEventEmitter();
    expect(() => emitter.emit('test:event', 'room:demo', 'user-1', { ok: true })).not.toThrow();
    expect(emitToRoom).not.toHaveBeenCalled();
  });
});
