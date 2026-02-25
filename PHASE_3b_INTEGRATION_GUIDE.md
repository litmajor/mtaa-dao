# Phase 3b: Integrating Error Handling into Payment Gateway Service

**Status**: READY FOR IMPLEMENTATION  
**Date**: January 23, 2026  
**Estimated Duration**: 2-3 hours  
**Priority**: HIGH - Foundational for all payment operations

---

## Overview

This guide shows how to integrate the advanced error handling from Phase 3a into the existing `paymentGatewayService.ts` and webhook handlers.

---

## Step 1: Update Payment Gateway Service Imports

**File**: `server/services/paymentGatewayService.ts` (lines 1-10)

```typescript
// Add these imports after existing imports

import {
  PaymentError,
  PaymentErrorHandler,
  PaymentErrorCode,
  PaymentValidator
} from './paymentErrorHandler';

import {
  RetryService,
  DEFAULT_RETRY_POLICIES
} from './retryService';
```

---

## Step 2: Update initiateDeposit Method

**Current Code** (lines 100-130):
```typescript
async initiateDeposit(provider: string, request: PaymentRequest): Promise<PaymentResponse> {
  const config = this.configs.get(provider);
  if (!config) {
    throw new Error(`Payment provider ${provider} not configured`);
  }

  // Check user verification level and apply limits
  const limits = await this.getTransactionLimits(request.userId);
  const amount = parseFloat(request.amount);

  if (amount > limits.dailyLimit) {
    throw new Error(`Transaction exceeds daily limit of ${limits.dailyLimit} ${request.currency}`);
  }

  switch (provider) {
    case 'flutterwave':
      return this.flutterwaveDeposit(config, request);
    // ... rest of cases
  }
}
```

**Updated Code**:
```typescript
async initiateDeposit(provider: string, request: PaymentRequest): Promise<PaymentResponse> {
  try {
    // Validate all inputs first
    const validProvider = PaymentValidator.validateProvider(provider);
    const validAmount = PaymentValidator.validateAmount(request.amount);
    const validUserId = PaymentValidator.validateUserId(request.userId);
    const validCurrency = PaymentValidator.validateCurrency(request.currency);

    const config = this.configs.get(validProvider);
    if (!config) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_NOT_CONFIGURED,
        `Payment provider ${validProvider} not configured`,
        { provider: validProvider }
      );
    }

    // Check user verification level and apply limits
    const limits = await this.getTransactionLimits(validUserId);
    
    if (validAmount > limits.dailyLimit) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.DAILY_LIMIT_EXCEEDED,
        `Transaction exceeds daily limit of ${limits.dailyLimit} ${validCurrency}`,
        { 
          amount: validAmount,
          limit: limits.dailyLimit,
          currency: validCurrency,
          tier: limits.tier
        }
      );
    }

    // Prepare request with validated data
    const validatedRequest = {
      ...request,
      userId: validUserId,
      amount: validAmount.toString(),
      currency: validCurrency
    };

    // Execute with retry and timeout
    return await RetryService.executeWithRetryAndTimeout(
      () => this.executeDeposit(validProvider, config, validatedRequest),
      DEFAULT_RETRY_POLICIES.provider,
      30000, // 30 second timeout
      { provider: validProvider, userId: validUserId }
    );

  } catch (error) {
    // Return properly formatted error response
    if (error instanceof PaymentError) {
      return PaymentErrorHandler.toResponse(error);
    }

    // Handle unexpected errors
    const paymentError = PaymentErrorHandler.handleProviderError(
      provider,
      error,
      { operation: 'initiateDeposit' }
    );
    return PaymentErrorHandler.toResponse(paymentError);
  }
}

private async executeDeposit(
  provider: string,
  config: PaymentGatewayConfig,
  request: PaymentRequest
): Promise<PaymentResponse> {
  switch (provider) {
    case 'flutterwave':
      return this.flutterwaveDeposit(config, request);
    case 'paystack':
      return this.paystackDeposit(config, request);
    case 'mpesa':
      return this.mpesaDeposit(config, request);
    case 'mtn':
      return this.mtnDeposit(config, request);
    case 'airtel':
      return this.airtelDeposit(config, request);
    case 'stripe':
      return this.stripeDeposit(config, request);
    default:
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_PROVIDER,
        `Unsupported provider: ${provider}`
      );
  }
}
```

---

## Step 3: Update initiateWithdrawal Method

**Similar to Step 2**, apply same pattern:

```typescript
async initiateWithdrawal(provider: string, request: PaymentRequest): Promise<PaymentResponse> {
  try {
    // Validate inputs
    const validProvider = PaymentValidator.validateProvider(provider);
    const validAmount = PaymentValidator.validateAmount(request.amount);
    const validUserId = PaymentValidator.validateUserId(request.userId);
    const validCurrency = PaymentValidator.validateCurrency(request.currency);

    const config = this.configs.get(validProvider);
    if (!config) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_NOT_CONFIGURED,
        `Payment provider ${validProvider} not configured`
      );
    }

    const limits = await this.getTransactionLimits(validUserId);
    
    if (validAmount > limits.dailyLimit) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.DAILY_LIMIT_EXCEEDED,
        `Withdrawal exceeds daily limit of ${limits.dailyLimit}`
      );
    }

    const validatedRequest = {
      ...request,
      userId: validUserId,
      amount: validAmount.toString(),
      currency: validCurrency
    };

    return await RetryService.executeWithRetryAndTimeout(
      () => this.executeWithdrawal(validProvider, config, validatedRequest),
      DEFAULT_RETRY_POLICIES.provider,
      30000,
      { provider: validProvider, userId: validUserId }
    );

  } catch (error) {
    if (error instanceof PaymentError) {
      return PaymentErrorHandler.toResponse(error);
    }
    const paymentError = PaymentErrorHandler.handleProviderError(provider, error);
    return PaymentErrorHandler.toResponse(paymentError);
  }
}

private async executeWithdrawal(
  provider: string,
  config: PaymentGatewayConfig,
  request: PaymentRequest
): Promise<PaymentResponse> {
  switch (provider) {
    case 'flutterwave':
      return this.flutterwaveWithdrawal(config, request);
    case 'paystack':
      return this.paystackWithdrawal(config, request);
    case 'mpesa':
      return this.mpesaWithdrawal(config, request);
    case 'mtn':
      return this.mtnWithdrawal(config, request);
    case 'airtel':
      return this.airtelWithdrawal(config, request);
    case 'stripe':
      return this.stripeWithdrawal(config, request);
    default:
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_PROVIDER,
        `Unsupported provider: ${provider}`
      );
  }
}
```

---

## Step 4: Update Provider-Specific Methods

**Example: flutterwaveDeposit**

**Current Code**:
```typescript
private async flutterwaveDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
  const reference = `FLW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const payload = {
    tx_ref: reference,
    amount: request.amount,
    currency: request.currency,
    // ... rest of payload
  };

  try {
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === 'success') {
      await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'flutterwave', 'pending');

      return {
        success: true,
        transactionId: data.data.id,
        paymentUrl: data.data.link,
        reference,
        status: 'pending',
        message: 'Payment initialized successfully'
      };
    }

    throw new Error(data.message || 'Payment initialization failed');
  } catch (error: any) {
    return {
      success: false,
      transactionId: '',
      reference,
      status: 'failed',
      message: error.message
    };
  }
}
```

**Updated Code**:
```typescript
private async flutterwaveDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
  const reference = `FLW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const payload = {
    tx_ref: reference,
    amount: request.amount,
    currency: request.currency,
    redirect_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`,
    customer: {
      email: request.metadata?.email,
      phonenumber: request.metadata?.phone,
      name: request.metadata?.name
    },
    customizations: {
      title: 'MtaaDAO Deposit',
      description: 'Add funds to your wallet',
      logo: 'https://mtaadao.com/logo.png'
    }
  };

  try {
    // Validate metadata
    if (request.metadata?.email) {
      PaymentValidator.validateEmail(request.metadata.email);
    }
    if (request.metadata?.phone) {
      PaymentValidator.validatePhoneNumber(request.metadata.phone);
    }

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    if (!response.ok) {
      throw PaymentErrorHandler.handleProviderError(
        'flutterwave',
        { status: response.status, message: response.statusText },
        { reference, payload }
      );
    }

    const data = await response.json();

    if (data.status === 'success') {
      // Record transaction with retry
      await RetryService.executeWithRetry(
        () => this.recordTransaction(
          request.userId,
          reference,
          'deposit',
          request.amount,
          request.currency,
          'flutterwave',
          'pending'
        ),
        DEFAULT_RETRY_POLICIES.database,
        { reference }
      );

      return {
        success: true,
        transactionId: data.data.id,
        paymentUrl: data.data.link,
        reference,
        status: 'pending',
        message: 'Payment initialized successfully'
      };
    }

    throw PaymentErrorHandler.createError(
      PaymentErrorCode.PROVIDER_API_ERROR,
      data.message || 'Payment initialization failed',
      { provider: 'flutterwave', responseStatus: data.status }
    );

  } catch (error: any) {
    // Properly handle different error types
    let paymentError: PaymentError;

    if (error instanceof PaymentError) {
      paymentError = error;
    } else if (error.code?.includes('E')) {
      paymentError = PaymentErrorHandler.handleNetworkError(error, { reference });
    } else {
      paymentError = PaymentErrorHandler.handleProviderError(
        'flutterwave',
        error,
        { reference, payload }
      );
    }

    logger.error('Flutterwave deposit failed', {
      code: paymentError.code,
      message: paymentError.message,
      reference,
      retryable: paymentError.retryable
    });

    throw paymentError;
  }
}
```

---

## Step 5: Update recordTransaction Method

**Current Code**:
```typescript
private async recordTransaction(
  userId: string,
  reference: string,
  type: 'deposit' | 'withdrawal',
  amount: string,
  currency: string,
  provider: string,
  status: string
): Promise<void> {
  try {
    await db.insert(paymentTransactions).values({
      id: uuid(),
      userId,
      reference,
      type,
      amount,
      currency,
      provider,
      status,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }).execute();
  } catch (error: any) {
    logger.error('Failed to record transaction', error);
  }
}
```

**Updated Code**:
```typescript
private async recordTransaction(
  userId: string,
  reference: string,
  type: 'deposit' | 'withdrawal',
  amount: string,
  currency: string,
  provider: string,
  status: string
): Promise<void> {
  try {
    await db.insert(paymentTransactions).values({
      id: uuid(),
      userId,
      reference,
      type,
      amount,
      currency,
      provider,
      status,
      metadata: {
        recordedAt: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).execute();

  } catch (error: any) {
    // Handle database-specific errors
    if (error.code === '23505') {
      // Unique constraint violation - transaction already recorded
      const dbError = PaymentErrorHandler.handleDatabaseError(
        error,
        'recordTransaction',
        { reference, userId }
      );
      logger.warn('Transaction already recorded', {
        reference,
        code: dbError.code
      });
      // Don't throw - transaction already recorded
      return;
    }

    // Other database errors are retryable
    const dbError = PaymentErrorHandler.handleDatabaseError(
      error,
      'recordTransaction',
      { reference, userId }
    );

    logger.error('Failed to record transaction', {
      code: dbError.code,
      message: dbError.message,
      reference,
      retryable: dbError.retryable
    });

    throw dbError;
  }
}
```

---

## Step 6: Update Webhook Handlers

**File**: `server/routes/payment-gateway.ts`

**Current Code** (Flutterwave webhook):
```typescript
router.post('/flutterwave/webhook', async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  // ... process webhook
});
```

**Updated Code**:
```typescript
router.post('/flutterwave/webhook', async (req, res) => {
  try {
    // Verify signature
    const signature = req.headers['verif-hash'];
    if (signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Invalid webhook signature',
        { provider: 'flutterwave' }
      );
      logger.warn('Invalid webhook signature', {
        provider: 'flutterwave',
        signature: signature?.substring(0, 10) + '...'
      });
      return res.status(401).json(PaymentErrorHandler.toResponse(error));
    }

    const payload = req.body;

    // Validate webhook payload
    if (!payload.data?.id || !payload.data?.tx_ref) {
      const error = PaymentErrorHandler.createError(
        PaymentErrorCode.PROVIDER_API_ERROR,
        'Invalid webhook payload',
        { provider: 'flutterwave' }
      );
      return res.status(400).json(PaymentErrorHandler.toResponse(error));
    }

    // Process webhook with retry (in case of temporary database issues)
    await RetryService.executeWithRetry(
      () => this.processFlutterwaveWebhook(payload),
      DEFAULT_RETRY_POLICIES.webhook,
      { provider: 'flutterwave', reference: payload.data.tx_ref }
    );

    res.json({ success: true, message: 'Webhook processed' });

  } catch (error: any) {
    if (error instanceof PaymentError) {
      logger.error('Webhook processing failed', {
        provider: 'flutterwave',
        code: error.code,
        message: error.message
      });
      return res.status(error.statusCode).json(PaymentErrorHandler.toResponse(error));
    }

    logger.error('Unexpected webhook error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: {
        code: PaymentErrorCode.UNKNOWN_ERROR,
        message: 'Webhook processing failed'
      }
    });
  }
});

private async processFlutterwaveWebhook(payload: any): Promise<void> {
  const reference = payload.data.tx_ref;
  const status = payload.data.status === 'successful' ? 'completed' : 'failed';

  // Record webhook receipt in database
  await this.recordWebhookEvent('flutterwave', reference, payload);

  // Update transaction status
  await db.update(paymentTransactions)
    .set({ status, updatedAt: new Date() })
    .where(eq(paymentTransactions.reference, reference))
    .execute();
}
```

---

## Step 7: Update getTransactionLimits

**Current Code**:
```typescript
private async getTransactionLimits(userId: string): Promise<{ dailyLimit: number; tier: string }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user.length) {
    throw new Error('User not found');
  }
  // ... rest of code
}
```

**Updated Code**:
```typescript
private async getTransactionLimits(userId: string): Promise<{ dailyLimit: number; tier: string }> {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.INVALID_USER,
        'User not found',
        { userId }
      );
    }

    const verificationLevel = user[0].verificationLevel || 'none';

    const limits = {
      none: { dailyLimit: 100, tier: 'Basic' },
      basic: { dailyLimit: 1000, tier: 'Verified' },
      intermediate: { dailyLimit: 10000, tier: 'Enhanced' },
      advanced: { dailyLimit: 50000, tier: 'Premium' }
    };

    const limit = limits[verificationLevel as keyof typeof limits] || limits.none;
    
    logger.debug('Transaction limits retrieved', {
      userId,
      tier: limit.tier,
      dailyLimit: limit.dailyLimit
    });

    return limit;

  } catch (error: any) {
    if (error instanceof PaymentError) {
      throw error;
    }

    const dbError = PaymentErrorHandler.handleDatabaseError(
      error,
      'getTransactionLimits',
      { userId }
    );
    throw dbError;
  }
}
```

---

## Testing Phase 3b Integration

### Unit Tests

```typescript
describe('PaymentGatewayService with Error Handling', () => {
  describe('initiateDeposit', () => {
    it('should validate amount before processing', async () => {
      const result = await service.initiateDeposit('flutterwave', {
        userId: 'user-123',
        amount: '-100', // Invalid
        currency: 'KES',
        method: 'card'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_AMOUNT');
    });

    it('should retry on provider timeout', async () => {
      // Mock provider to fail once, then succeed
      mockProvider
        .onFirstCall().throws({ code: 'ETIMEDOUT' })
        .onSecondCall().returns({ success: true });

      const result = await service.initiateDeposit('flutterwave', validRequest);
      
      expect(result.success).toBe(true);
    });

    it('should respect daily limits', async () => {
      const result = await service.initiateDeposit('flutterwave', {
        ...validRequest,
        amount: '100000' // Exceeds limit for basic user
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DAILY_LIMIT_EXCEEDED');
    });
  });

  describe('Webhook handling', () => {
    it('should reject invalid signatures', async () => {
      const result = await request(app)
        .post('/api/payment-gateway/flutterwave/webhook')
        .set('verif-hash', 'invalid')
        .send(validPayload);

      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    });

    it('should process webhook with retry', async () => {
      // Mock database to fail once
      mockDb
        .onFirstCall().throws({ code: 'DEADLOCK_DETECTED' })
        .onSecondCall().returns({ success: true });

      const result = await request(app)
        .post('/api/payment-gateway/flutterwave/webhook')
        .set('verif-hash', process.env.FLUTTERWAVE_WEBHOOK_SECRET)
        .send(validPayload);

      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
describe('End-to-end payment flow with errors', () => {
  it('should handle provider timeout and retry successfully', async () => {
    // Simulate provider timeout on first request
    nock('https://api.flutterwave.com')
      .post('/v3/payments')
      .replyWithError({ code: 'ETIMEDOUT' })
      .post('/v3/payments')
      .reply(200, { status: 'success', data: { id: '123', link: 'https://...' } });

    const result = await service.initiateDeposit('flutterwave', validRequest);

    expect(result.success).toBe(true);
    expect(nock.isDone()).toBe(true); // All requests were made
  });
});
```

---

## Checklist for Phase 3b Implementation

- [ ] Add error handler imports to paymentGatewayService.ts
- [ ] Update initiateDeposit method with validation and error handling
- [ ] Update initiateWithdrawal method with validation and error handling
- [ ] Create executeDeposit helper method
- [ ] Create executeWithdrawal helper method
- [ ] Update all provider-specific methods (flutterwave, paystack, etc.)
- [ ] Update recordTransaction method with database error handling
- [ ] Update all webhook handlers with error handling
- [ ] Update getTransactionLimits with error handling
- [ ] Write unit tests for error handling
- [ ] Write integration tests for retry logic
- [ ] Test circuit breaker pattern
- [ ] Document error codes and responses
- [ ] Update error response format documentation
- [ ] Add error monitoring/alerting
- [ ] Update API documentation with error codes

---

## Summary

Phase 3b integration will:
✅ Add comprehensive error handling to all payment operations
✅ Implement automatic retries with exponential backoff
✅ Add input validation at every step
✅ Improve error logging and debugging
✅ Provide consistent error responses
✅ Increase payment system reliability

**Next**: Begin implementation when ready!
