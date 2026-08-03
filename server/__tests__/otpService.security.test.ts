import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  },
}));

import { redis } from '../services/redis';
import { otpService } from '../services/otpService';

describe('OTP service security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_TEST_OTP;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ALLOW_TEST_OTP;
  });

  it('does not expose OTP values in logs during failed verification', async () => {
    const storedOtp = '123456';
    vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({
      otp: storedOtp,
      expiresAt: Date.now() + 300000,
      password: 'secret-password',
      attempts: 0,
    }));

    const result = await otpService.verifyOTP('user-1', '000000');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid OTP');

    const logOutput = vi.mocked(console.log).mock.calls.flat().join(' ');
    expect(logOutput).not.toContain(storedOtp);
    expect(logOutput).not.toContain('000000');
  });

  it('does not allow the test OTP bypass in production even when ALLOW_TEST_OTP is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_OTP = 'true';

    vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({
      otp: '123456',
      expiresAt: Date.now() + 300000,
      password: 'secret-password',
      attempts: 0,
    }));

    const result = await otpService.verifyOTP('user-1', '000000');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid OTP');
  });

  it('sends OTP through WhatsApp when requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    vi.stubGlobal('fetch', fetchMock);
    process.env.WHATSAPP_PHONE_ID = '123456';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';

    await otpService.sendWhatsAppOTP('+254712345678', '123456');

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/messages');
    expect(options).toMatchObject({ method: 'POST' });
    const body = JSON.parse(options.body as string);
    expect(body.to).toBe('+254712345678');
    expect(body.text.body).toContain('123456');
  });
});
