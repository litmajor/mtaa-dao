import { authClient } from '../authClient';
import authChannel from '../authChannel';

jest.mock('../authChannel');

function makeResponse(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as any as Response;
}

describe('authClient refresh logic', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('retries request after successful refresh', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockImplementationOnce(async () => makeResponse(401, { success: false })) // initial 401
      .mockImplementationOnce(async () => makeResponse(200, { success: true })) // refresh ok
      .mockImplementationOnce(async () => makeResponse(200, { success: true, data: { hello: 'world' } })); // retried request

    const data = await authClient.get('/test/retry');
    expect(data).toEqual({ hello: 'world' });
    fetchMock.mockRestore();
  });

  it('invokes logout broadcast when refresh fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockImplementationOnce(async () => makeResponse(401, { success: false })) // initial 401
      .mockImplementationOnce(async () => makeResponse(401, { success: false })); // refresh fails

    await expect(authClient.get('/test/fail')).rejects.toThrow();
    expect((authChannel.postAuthMessage as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    fetchMock.mockRestore();
  });
});
