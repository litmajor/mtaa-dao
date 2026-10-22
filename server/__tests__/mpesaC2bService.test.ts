import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMpesaC2bCallbackUrls } from '../services/mpesaC2bService';

const configuration = {
  MPESA_C2B_ENABLED: 'true',
  MPESA_ENVIRONMENT: 'sandbox',
  MPESA_CONSUMER_KEY: 'consumer-key',
  MPESA_CONSUMER_SECRET: 'consumer-secret',
  MPESA_C2B_SHORTCODE: '600000',
  MPESA_C2B_CALLBACK_TOKEN: 'c2b-callback-token-that-is-at-least-32-characters-long',
  MPESA_C2B_VALIDATION_URL: 'https://mtaa.example/api/v1/wallets/rails/c2b/validation',
  MPESA_C2B_CONFIRMATION_URL: 'https://mtaa.example/api/v1/wallets/rails/c2b/confirmation',
};

function darajaResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('registerMpesaC2bCallbackUrls', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(configuration)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('registers authenticated HTTPS callback URLs with Daraja', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(darajaResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(darajaResponse({
        ResponseCode: '0',
        ResponseDescription: 'Success',
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(registerMpesaC2bCallbackUrls()).resolves.toBe('Success');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl'
    );
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as Record<string, string>;
    expect(payload).toMatchObject({ ShortCode: '600000', ResponseType: 'Completed' });
    expect(new URL(payload.ValidationURL).searchParams.get('token')).toBe(
      configuration.MPESA_C2B_CALLBACK_TOKEN
    );
    expect(new URL(payload.ConfirmationURL).searchParams.get('token')).toBe(
      configuration.MPESA_C2B_CALLBACK_TOKEN
    );
  });

  it('refuses callback registration when the callback token is too short', async () => {
    vi.stubEnv('MPESA_C2B_CALLBACK_TOKEN', 'short');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(registerMpesaC2bCallbackUrls()).rejects.toThrow(
      'MPESA_C2B_CALLBACK_TOKEN must contain at least 32 characters'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
