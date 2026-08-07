import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
  process.env.FLUTTERWAVE_SECRET_KEY = 'flutterwave-secret';
  process.env.PAYSTACK_SECRET_KEY = 'paystack-secret';
});

describe('webhook signature verification', () => {
  it('rejects signatures that do not match the computed HMAC', async () => {
    const { verifyWebhookSignature } = await import('../routes/v1/wallets/rails/webhooks');

    expect(verifyWebhookSignature('flutterwave', Buffer.from('payload'), 'deadbeef')).toBe(false);
  });
});

describe('shared auth middleware', () => {
  it('uses the secure authentication middleware implementation for the v1 wallet router', async () => {
    const { isAuthenticated: secureAuth } = await import('../auth');
    const { isAuthenticated: nextAuthMiddleware } = await import('../nextAuthMiddleware');

    expect(nextAuthMiddleware).toBe(secureAuth);
  });
});

describe('withdrawal 2FA verification state', () => {
  it('rejects a missing or expired verification token for completion', async () => {
    const { validateWithdrawalCompletionState } = await import('../routes/v1/wallets/withdrawals');

    const missingResult = validateWithdrawalCompletionState({
      metadata: {},
      status: 'pending',
    } as any, 'token-1');
    expect(missingResult.valid).toBe(false);

    const expiredResult = validateWithdrawalCompletionState({
      metadata: {
        withdrawalIntent: {
          twoFactorVerified: true,
          verificationToken: 'token-2',
          verificationExpiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      },
      status: 'pending',
    } as any, 'token-2');
    expect(expiredResult.valid).toBe(false);
  });
});
