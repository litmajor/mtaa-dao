import { authClient } from '../authClient';
import authChannel from '../authChannel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../authChannel', () => ({
  default: {
    postAuthMessage: vi.fn(),
    onAuthMessage: vi.fn(() => () => {}),
  },
}));

function makeResponse(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as any as Response;
}

describe('authClient refresh logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries request after successful refresh', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(async () => makeResponse(401, { success: false })) // initial 401
      .mockImplementationOnce(async () => makeResponse(200, { success: true })) // refresh ok
      .mockImplementationOnce(async () => makeResponse(200, { success: true, data: { hello: 'world' } })); // retried request

    const data = await authClient.get('/test/retry');
    expect(data).toEqual({ hello: 'world' });
  });

  it('limits retries and broadcasts logout when refresh fails', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(async () => makeResponse(401, { success: false })) // initial 401
      .mockImplementationOnce(async () => makeResponse(401, { success: false })) // refresh fails
      .mockImplementation(async () => makeResponse(401, { success: false }));

    await expect(authClient.get('/test/fail')).rejects.toThrow();
    await expect(authClient.get('/test/fail-again')).rejects.toThrow();
    expect(authChannel.postAuthMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'logout' }));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1000);
    await expect(authClient.get('/test/retry-after-backoff')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
