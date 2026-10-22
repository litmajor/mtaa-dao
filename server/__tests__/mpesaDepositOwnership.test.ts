import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { PaymentErrorCode } from '../services/paymentErrorHandler';
import { sharedIdempotencyManager } from '../services/sharedIdempotencyManager';
import { commandBus } from '../domain/setup';

vi.mock('../storage', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('PaymentGatewayService - mpesaDeposit Phone Ownership', () => {
  let gateway: PaymentGatewayService;
  let mockedUser: { id: string; phone: string | null } | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser = undefined;
    process.env.MPESA_SHORTCODE = '123456';
    process.env.MPESA_PASSKEY = 'test_passkey';
    process.env.APP_URL = 'http://localhost:3000';

    vi.spyOn(sharedIdempotencyManager, 'startProcessing').mockResolvedValue(true);
    vi.spyOn(sharedIdempotencyManager, 'getResult').mockResolvedValue(null);
    vi.spyOn(sharedIdempotencyManager, 'recordResult').mockResolvedValue();
    vi.spyOn(commandBus, 'dispatch').mockResolvedValue({
      success: true,
      commandId: 'cmd-test',
      events: [],
    });

    vi.spyOn(db, 'select').mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockResolvedValue(mockedUser ? [mockedUser] : []),
        })),
      })),
    } as any));

    gateway = new PaymentGatewayService();
    (gateway as any).configs.set('mpesa', {
      provider: 'mpesa',
      apiKey: 'test-api-key',
      secretKey: 'test-secret',
      environment: 'test',
    });

    vi.spyOn(gateway as any, 'getMpesaToken').mockResolvedValue('test_token');
    vi.spyOn(gateway as any, 'requestWithTimeout').mockResolvedValue({
      ok: true,
      json: async () => ({ ResponseCode: '0', CheckoutRequestID: 'ws_123', MerchantRequestID: 'ws_456' }),
    } as Response);
    vi.spyOn(gateway as any, 'recordTransaction').mockResolvedValue(undefined);
    vi.spyOn(gateway as any, 'triggerRecoveryWorkflow').mockResolvedValue(undefined);
  });

  it('succeeds when request phone matches verified user phone', async () => {
    mockedUser = { id: 'user_1', phone: '+254712345678' };

    const request = {
      userId: 'user_1',
      amount: '100',
      currency: 'KES',
      method: 'mobile_money' as const,
      metadata: { phone: '0712345678' },
    };

    const response = await gateway.initiateDeposit('mpesa', request);
    expect(response.success).toBe(true);
    expect((response as any).status).toBe('pending');
    expect((gateway as any).requestWithTimeout).toHaveBeenCalled();

    const [stkUrl, stkRequest] = (gateway as any).requestWithTimeout.mock.calls[0] as [string, RequestInit];
    const stkPayload = JSON.parse(String(stkRequest.body)) as Record<string, unknown>;
    const callbackToken = new URL(String(stkPayload.CallBackURL)).searchParams.get('token');
    expect(stkUrl).toContain('/mpesa/stkpush/v1/processrequest');
    expect(stkPayload).toMatchObject({ Amount: 100, PhoneNumber: '254712345678' });
    expect(callbackToken).toMatch(/^[a-f0-9]{64}$/);

    const transactionMetadata =
      (gateway as any).recordTransaction.mock.calls[0][7] as Record<string, unknown>;
    expect(transactionMetadata).toMatchObject({
      callbackToken,
      phone: '254712345678',
      checkoutRequestID: 'ws_123',
    });
  });

  it('fails before STK push when phone does not match', async () => {
    mockedUser = { id: 'user_1', phone: '+254712345678' };

    const request = {
      userId: 'user_1',
      amount: '100',
      currency: 'KES',
      method: 'mobile_money' as const,
      metadata: { phone: '0799999999' },
    };

    const response = await gateway.initiateDeposit('mpesa', request);

    expect((gateway as any).requestWithTimeout).not.toHaveBeenCalled();
    expect(response.success).toBe(false);
    expect((response as any).status).toBe('failed');
    expect((response as any).message).toContain('phone number does not match verified account');
    expect(PaymentErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('fails before STK push when user has no verified phone', async () => {
    mockedUser = { id: 'user_1', phone: null };

    const request = {
      userId: 'user_1',
      amount: '100',
      currency: 'KES',
      method: 'mobile_money' as const,
      metadata: { phone: '0712345678' },
    };

    const response = await gateway.initiateDeposit('mpesa', request);

    expect((gateway as any).requestWithTimeout).not.toHaveBeenCalled();
    expect(response.success).toBe(false);
    expect((response as any).status).toBe('failed');
    expect((response as any).message).toContain('phone number does not match verified account');
    expect(PaymentErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });
});
