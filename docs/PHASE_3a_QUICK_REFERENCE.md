# Phase 3a Quick Reference

**Status**: ✅ Complete and Ready for Integration  
**Updated**: January 23, 2026

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [PHASE_3a_ADVANCED_ERROR_HANDLING.md](PHASE_3a_ADVANCED_ERROR_HANDLING.md) | Complete error handling documentation |
| [PHASE_3b_INTEGRATION_GUIDE.md](PHASE_3b_INTEGRATION_GUIDE.md) | Step-by-step integration instructions |
| [PHASE_3a_COMPLETION_SUMMARY.md](PHASE_3a_COMPLETION_SUMMARY.md) | Implementation summary |

---

## Core Error Handlers

### Create an Error

```typescript
import { PaymentErrorHandler, PaymentErrorCode } from './paymentErrorHandler';

// Simple error
throw PaymentErrorHandler.createError(
  PaymentErrorCode.INVALID_AMOUNT,
  'Amount must be positive'
);

// With metadata
throw PaymentErrorHandler.createError(
  PaymentErrorCode.DAILY_LIMIT_EXCEEDED,
  'Limit exceeded',
  { limit: 1000, requested: 1500, userId: 'user-123' }
);
```

### Validate Input

```typescript
import { PaymentValidator } from './paymentErrorHandler';

PaymentValidator.validateAmount('500');        // throws if invalid
PaymentValidator.validateCurrency('KES');      // must be supported
PaymentValidator.validateProvider('paystack');
PaymentValidator.validateUserId(userId);
PaymentValidator.validateEmail('user@example.com');
PaymentValidator.validatePhoneNumber('+254700000000');
```

### Handle Provider Errors

```typescript
try {
  await fetch('https://api.provider.com/...');
} catch (error) {
  const paymentError = PaymentErrorHandler.handleProviderError(
    'flutterwave',
    error,
    { reference, timestamp: new Date() }
  );
  throw paymentError;
}
```

### Handle Network Errors

```typescript
try {
  await fetch('https://api.provider.com/...');
} catch (error) {
  const paymentError = PaymentErrorHandler.handleNetworkError(error);
  throw paymentError;
}
```

### Handle Database Errors

```typescript
try {
  await db.insert(transactions).values({...});
} catch (error) {
  const paymentError = PaymentErrorHandler.handleDatabaseError(
    error,
    'recordTransaction',
    { transactionId: ref }
  );
  throw paymentError;
}
```

---

## Retry Service

### Basic Retry

```typescript
import { RetryService, DEFAULT_RETRY_POLICIES } from './retryService';

const result = await RetryService.executeWithRetry(
  () => apiCall(),
  DEFAULT_RETRY_POLICIES.provider
);
```

### With Timeout

```typescript
const result = await RetryService.executeWithRetryAndTimeout(
  () => apiCall(),
  DEFAULT_RETRY_POLICIES.provider,
  30000  // 30 second timeout
);
```

### Parallel Operations

```typescript
const results = await RetryService.executeInParallel([
  {
    name: 'provider1',
    fn: () => verifyWithProvider1(),
    policy: DEFAULT_RETRY_POLICIES.provider
  },
  {
    name: 'provider2',
    fn: () => verifyWithProvider2(),
    policy: DEFAULT_RETRY_POLICIES.provider
  }
]);

// Results: [{ name, result or error }]
```

### Circuit Breaker

```typescript
await RetryService.executeWithCircuitBreaker(
  () => unreliableService(),
  {
    failureThreshold: 5,
    recoveryTimeMs: 60000
  }
);
```

### Custom Retry Policy

```typescript
const customPolicy = {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.3
};

await RetryService.executeWithRetry(
  () => operation(),
  customPolicy
);
```

---

## Predefined Policies

```typescript
// Provider API calls
DEFAULT_RETRY_POLICIES.provider
  // maxRetries: 3
  // initialDelayMs: 1000
  // maxDelayMs: 30000

// Network requests
DEFAULT_RETRY_POLICIES.network
  // maxRetries: 5
  // initialDelayMs: 500
  // maxDelayMs: 30000

// Database operations
DEFAULT_RETRY_POLICIES.database
  // maxRetries: 3
  // initialDelayMs: 100
  // maxDelayMs: 5000

// Webhook processing
DEFAULT_RETRY_POLICIES.webhook
  // maxRetries: 2
  // initialDelayMs: 1000
  // maxDelayMs: 10000
```

---

## Error Codes (35 total)

### Validation Errors (don't retry)
- `INVALID_AMOUNT` - Amount invalid
- `INVALID_CURRENCY` - Currency not supported
- `INVALID_PROVIDER` - Provider not found
- `INVALID_USER` - User not found
- `LIMIT_EXCEEDED` - Generic limit
- `DAILY_LIMIT_EXCEEDED` - Daily limit
- `INSUFFICIENT_BALANCE` - Not enough funds

### Provider Errors (retry)
- `PROVIDER_API_ERROR` - Provider API error
- `PROVIDER_TIMEOUT` - Provider timeout (retry)
- `PROVIDER_RATE_LIMITED` - Rate limit 429 (retry 1x)
- `PROVIDER_SERVICE_UNAVAILABLE` - Down 503 (retry)

### Network Errors (retry)
- `NETWORK_ERROR` - Generic network error
- `CONNECTION_TIMEOUT` - Connection timeout
- `DNS_RESOLUTION_FAILED` - DNS lookup failed

### Transaction Errors (don't retry)
- `TRANSACTION_ALREADY_PROCESSED` - Duplicate
- `TRANSACTION_NOT_FOUND` - Not found
- `PAYMENT_DECLINED` - Declined
- `PAYMENT_CANCELLED` - User cancelled

### Database Errors (some retry)
- `DATABASE_ERROR` - Generic DB error (retry)
- `TRANSACTION_LOCK` - Deadlock/lock (retry)

### Configuration Errors (don't retry)
- `PROVIDER_NOT_CONFIGURED` - Not set up
- `MISSING_CREDENTIALS` - Missing keys

---

## Error Response Format

```typescript
interface PaymentError {
  code: string;           // e.g., 'DAILY_LIMIT_EXCEEDED'
  message: string;        // "Daily limit exceeded"
  statusCode: number;     // 429
  retryable: boolean;     // false
  metadata?: {
    category: string;     // 'validation'
    // additional context
  };
}

// Converted to API response:
{
  success: false,
  error: {
    code: 'DAILY_LIMIT_EXCEEDED',
    message: 'Daily limit exceeded',
    statusCode: 429,
    retryable: false
  }
}
```

---

## Common Patterns

### Validate then Execute

```typescript
async function processPayment(provider, request) {
  // 1. Validate
  const validProvider = PaymentValidator.validateProvider(provider);
  const validAmount = PaymentValidator.validateAmount(request.amount);

  // 2. Execute with retry
  return RetryService.executeWithRetryAndTimeout(
    () => this.executePayment(validProvider, validAmount),
    DEFAULT_RETRY_POLICIES.provider,
    30000
  );
}
```

### Handle All Error Types

```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  if (error instanceof PaymentError) {
    return PaymentErrorHandler.toResponse(error);
  }
  
  if (error.code?.includes('E')) {
    const ne = PaymentErrorHandler.handleNetworkError(error);
    return PaymentErrorHandler.toResponse(ne);
  }
  
  const unknown = PaymentErrorHandler.createError(
    PaymentErrorCode.UNKNOWN_ERROR,
    error.message
  );
  return PaymentErrorHandler.toResponse(unknown);
}
```

### Webhook Processing

```typescript
app.post('/webhook', async (req, res) => {
  try {
    // Verify signature
    if (signature !== WEBHOOK_SECRET) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Invalid signature'
      );
    }

    // Process with retry
    await RetryService.executeWithRetry(
      () => processWebhook(req.body),
      DEFAULT_RETRY_POLICIES.webhook
    );

    res.json({ success: true });
  } catch (error) {
    const pe = error instanceof PaymentError ? error : 
               PaymentErrorHandler.handleProviderError('webhook', error);
    res.status(pe.statusCode).json(PaymentErrorHandler.toResponse(pe));
  }
});
```

---

## HTTP Status Codes

| Code | Meaning | Retryable |
|------|---------|-----------|
| 400 | Bad request (validation) | No |
| 401 | Invalid credentials | No |
| 402 | Payment required | No |
| 404 | Not found | No |
| 408 | Request timeout | Yes |
| 429 | Rate limited | Yes (1x) |
| 500 | Server error | Yes |
| 502 | Bad gateway | Yes |
| 503 | Service unavailable | Yes |
| 504 | Gateway timeout | Yes |

---

## Debugging Tips

### View Retry History

```typescript
try {
  await RetryService.executeWithRetry(() => operation());
} catch (error) {
  if (error instanceof PaymentError) {
    console.log('Error code:', error.code);
    console.log('Retryable:', error.retryable);
    console.log('Context:', error.metadata);
  }
}
```

### Check if Error is Retryable

```typescript
const shouldRetry = PaymentErrorHandler.shouldRetry(
  error,
  attemptCount,
  maxRetries
);

if (shouldRetry) {
  const delayMs = PaymentErrorHandler.getRetryDelay(attemptCount);
  console.log(`Retrying in ${delayMs}ms`);
}
```

### Decode Error Category

```typescript
const error = PaymentErrorHandler.createError(
  PaymentErrorCode.PROVIDER_TIMEOUT,
  'Timeout'
);

switch (error.metadata?.category) {
  case 'validation': // User input issue
  case 'provider':   // Provider API issue
  case 'network':    // Network connectivity
  case 'database':   // Database operation
  case 'authorization': // Auth/permission
}
```

---

## Next Steps

1. **Read** [PHASE_3a_ADVANCED_ERROR_HANDLING.md](PHASE_3a_ADVANCED_ERROR_HANDLING.md)
2. **Review** [PHASE_3b_INTEGRATION_GUIDE.md](PHASE_3b_INTEGRATION_GUIDE.md)
3. **Integrate** error handlers into paymentGatewayService.ts
4. **Test** with unit and integration tests
5. **Deploy** to staging environment

---

## Support

| Need | Reference |
|------|-----------|
| Error codes | See PaymentErrorCode enum in paymentErrorHandler.ts |
| Retry policies | See DEFAULT_RETRY_POLICIES in retryService.ts |
| Usage examples | See PHASE_3a_ADVANCED_ERROR_HANDLING.md |
| Integration steps | See PHASE_3b_INTEGRATION_GUIDE.md |
| Complete info | See PHASE_3a_COMPLETION_SUMMARY.md |
