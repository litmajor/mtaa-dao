import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initiateDarajaB2cPayout } from '../services/mpesaB2cPayoutService';

const configuration = {
  MPESA_B2C_ENABLED: 'true',
  MPESA_ENVIRONMENT: 'sandbox',
  MPESA_CONSUMER_KEY: 'consumer-key',
  MPESA_CONSUMER_SECRET: 'consumer-secret',
  MPESA_B2C_INITIATOR_NAME: 'initiator',
  MPESA_B2C_SECURITY_CREDENTIAL: 'security-credential',
  MPESA_B2C_SHORTCODE: '600000',
  MPESA_B2C_CALLBACK_TOKEN: 'callback-token',
  MPESA_B2C_RESULT_URL: 'https://example.test/mpesa/result?source=rotation',
  MPESA_B2C_TIMEOUT_URL: 'https://example.test/mpesa/timeout',
};

function darajaResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('initiateDarajaB2cPayout', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(configuration)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends a B2C request with secured callback URLs and returns its correlation IDs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(darajaResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(darajaResponse({
        ResponseCode: '0',
        ResponseDescription: 'Accepted',
        ConversationID: 'conversation-1',
        OriginatorConversationID: 'originator-1',
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(initiateDarajaB2cPayout({
      phone: '254712345678',
      amountKes: 900,
      payoutId: 'payout-identifier',
      cycleNumber: 2,
    })).resolves.toMatchObject({
      accepted: true,
      ambiguous: false,
      conversationId: 'conversation-1',
      originatorConversationId: 'originator-1',
    });

    const [requestUrl, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(requestUrl).toBe('https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest');
    expect(request.headers).toMatchObject({ Authorization: 'Bearer access-token' });
    const payload = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      CommandID: 'BusinessPayment',
      Amount: 900,
      PartyA: '600000',
      PartyB: '254712345678',
      Occasion: 'payout-identifier',
    });
    expect(new URL(String(payload.ResultURL)).searchParams.get('token')).toBe('callback-token');
    expect(new URL(String(payload.ResultURL)).searchParams.get('source')).toBe('rotation');
    expect(new URL(String(payload.QueueTimeOutURL)).searchParams.get('token')).toBe('callback-token');
  });

  it('treats a network failure after OAuth as an ambiguous payout outcome', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(darajaResponse({ access_token: 'access-token' }))
      .mockRejectedValueOnce(new Error('connection reset'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(initiateDarajaB2cPayout({
      phone: '254712345678',
      amountKes: 900,
      payoutId: 'payout-identifier',
      cycleNumber: 2,
    })).resolves.toMatchObject({ accepted: false, ambiguous: true });
  });

  it('rejects an explicitly declined request without treating it as ambiguous', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(darajaResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(darajaResponse({
        ResponseCode: '1',
        ResponseDescription: 'Rejected',
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(initiateDarajaB2cPayout({
      phone: '254712345678',
      amountKes: 900,
      payoutId: 'payout-identifier',
      cycleNumber: 2,
    })).resolves.toMatchObject({ accepted: false, ambiguous: false });
  });
});
