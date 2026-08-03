import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionRows: any[] = [];
const mockDbInsert = vi.fn();
const mockDbExecute = vi.fn();
const mockGetResult = vi.fn();
const mockRecordResult = vi.fn();
const mockCreateNotification = vi.fn();
const mockAnalyzeRootCause = vi.fn();
const mockRecordError = vi.fn();

process.env.MPESA_PUBLIC_KEY = 'test-public';
process.env.MPESA_SECRET_KEY = 'test-secret';
process.env.MPESA_ENV = 'test';

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../services/retryService', () => ({
  RetryService: {
    executeWithRetryAndTimeout: vi.fn(async (fn: any) => fn()),
    executeWithRetry: vi.fn(async (fn: any) => fn()),
  },
  DEFAULT_RETRY_POLICIES: {
    provider: { maxRetries: 0 },
    database: { maxRetries: 0 },
    webhook: { maxRetries: 0 }
  }
}));

const concurrencyControls = vi.hoisted(() => ({
  distributedLockManager: {
    acquire: vi.fn(),
    release: vi.fn(),
    executeWithLock: vi.fn()
  },
  idempotencyManager: {
    getResult: mockGetResult,
    recordResult: mockRecordResult,
  }
}));

vi.mock('../services/concurrencyControl', () => concurrencyControls);

const storageMocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (row: any) => {
        mockDbInsert(row);
        return [row];
      })
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => transactionRows)
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn(async () => ({ rows: [] }))
        }))
      }))
    }))
  }
}));

vi.mock('../storage', () => storageMocks);

const dbMocks = vi.hoisted(() => ({
  db: {
    execute: mockDbExecute
  }
}));

vi.mock('../db', () => dbMocks);

const analyticsMocks = vi.hoisted(() => ({
  PaymentErrorAnalyticsService: {
    analyzeRootCause: mockAnalyzeRootCause
  }
}));

vi.mock('../services/paymentErrorAnalyticsService', () => analyticsMocks);

const monitoringMocks = vi.hoisted(() => ({
  PaymentErrorMonitoringService: {
    recordError: mockRecordError
  }
}));

vi.mock('../services/paymentErrorMonitoringService', () => monitoringMocks);

const notificationMocks = vi.hoisted(() => ({
  notificationService: {
    createNotification: mockCreateNotification
  }
}));

vi.mock('../notificationService', () => notificationMocks);

import { paymentGatewayService, PaymentResponse } from '../services/paymentGatewayService';
import { PaymentRecoveryWorkflowService, CircuitBreakerState, RecoveryStrategy } from '../services/paymentRecoveryWorkflowService';
import { PaymentErrorCode } from '../services/paymentErrorHandler';

type PaymentErrorResponse = {
  success: false;
  error: {
    code: PaymentErrorCode;
    message: any;
    statusCode: number;
    retryable: boolean;
    metadata?: Record<string, any>;
  };
};

function isPaymentResponse(result: PaymentResponse | PaymentErrorResponse): result is PaymentResponse {
  return (result as PaymentResponse).reference !== undefined && !(result as PaymentErrorResponse).error;
}

describe('Payment services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionRows.length = 0;
    mockGetResult.mockResolvedValue(null);
    mockRecordResult.mockResolvedValue(undefined);
    mockDbExecute.mockResolvedValue({ rows: [] });
  });

  describe('PaymentGatewayService', () => {
    it('initiates a withdrawal and records the transaction', async () => {
      const result = await paymentGatewayService.initiateWithdrawal('mpesa', {
        userId: 'user-123',
        amount: '150',
        currency: 'KES',
        method: 'mobile_money',
        metadata: { phone: '+254700000001' }
      });

      expect(result.success).toBe(true);
      expect(isPaymentResponse(result)).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.reference).toMatch(/^WD-/);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(mockRecordResult).toHaveBeenCalledWith(expect.any(String), result, 3600);
    });

    it('returns a validation error for unsupported provider', async () => {
      const result = await paymentGatewayService.initiateWithdrawal('invalid-provider', {
        userId: 'user-123',
        amount: '50',
        currency: 'USD',
        method: 'card',
      });

      expect(result.success).toBe(false);
      expect((result as PaymentErrorResponse).error.code).toBe(PaymentErrorCode.INVALID_PROVIDER);
      expect((result as PaymentErrorResponse).error.statusCode).toBe(400);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('verifies an existing transaction successfully', async () => {
      transactionRows.push({
        id: 'txn-1',
        reference: 'ref-123',
        provider: 'mpesa',
        status: 'completed'
      });

      const result = await paymentGatewayService.verifyTransaction('mpesa', 'ref-123');

      expect(result.success).toBe(true);
      expect(isPaymentResponse(result)).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.reference).toBe('ref-123');
    });

    it('returns not found for missing transaction reference', async () => {
      const result = await paymentGatewayService.verifyTransaction('mpesa', 'missing-ref');

      expect(result.success).toBe(false);
      expect((result as PaymentErrorResponse).error.code).toBe(PaymentErrorCode.TRANSACTION_NOT_FOUND);
      expect((result as PaymentErrorResponse).error.statusCode).toBe(404);
    });
  });

  describe('PaymentRecoveryWorkflowService', () => {
    it('initializes circuit breakers and updates state', () => {
      const breaker = PaymentRecoveryWorkflowService.getCircuitBreaker('mpesa');
      expect(breaker).toBeDefined();
      expect(breaker?.state).toBe(CircuitBreakerState.CLOSED);

      PaymentRecoveryWorkflowService.updateCircuitBreakerState('mpesa', CircuitBreakerState.OPEN);
      expect(PaymentRecoveryWorkflowService.getCircuitBreaker('mpesa')?.state).toBe(CircuitBreakerState.OPEN);
    });

    it('returns deposit provider fallbacks', () => {
      const fallbacks = PaymentRecoveryWorkflowService.getProviderFallbacks('deposit');
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks[0]).toHaveProperty('provider');
    });

    it('maps database workflow rows to a workflow instance', async () => {
      mockDbExecute.mockResolvedValueOnce({
        rows: [{
          id: 'wf-1',
          transaction_id: 'txn-1',
          user_id: 'user-123',
          original_error: 'PROVIDER_TIMEOUT',
          original_amount: 100,
          current_amount: 100,
          original_provider: 'mpesa',
          current_provider: 'mpesa',
          state: 'pending',
          strategy: RecoveryStrategy.AUTOMATIC_RETRY,
          attempt_count: 0,
          max_attempts: 3,
          last_attempt: null,
          last_error: null,
          completed_at: null,
          cancelled_at: null,
          cancel_reason: null,
          recovery_data: JSON.stringify({ strategies_tried: [], providers_tried: ['mpesa'], errors: [], notes: [] }),
          created_at: new Date(),
          updated_at: new Date()
        }] 
      });

      const workflow = await PaymentRecoveryWorkflowService.getWorkflow('wf-1');

      expect(workflow).not.toBeNull();
      expect(workflow?.id).toBe('wf-1');
      expect(workflow?.recoveryData.providers_tried).toContain('mpesa');
    });

    it('calculates recovery metrics from database results', async () => {
      mockDbExecute
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ state: 'succeeded', count: '3' }, { state: 'failed', count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ strategy: RecoveryStrategy.AUTOMATIC_RETRY, count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ avg: '2.5' }] });

      const metrics = await PaymentRecoveryWorkflowService.getRecoveryMetrics(24);

      expect(metrics.summary.totalAttempts).toBe(5);
      expect(metrics.summary.successfulRecoveries).toBe(3);
      expect(metrics.summary.failedRecoveries).toBe(2);
      expect(metrics.summary.successRate).toBeCloseTo(60);
      expect(metrics.summary.averageAttempts).toBe(3);
      expect(metrics.circuitBreakers.length).toBeGreaterThan(0);
      expect(metrics.byStrategy[RecoveryStrategy.AUTOMATIC_RETRY].count).toBe(4);
    });
  });
});
