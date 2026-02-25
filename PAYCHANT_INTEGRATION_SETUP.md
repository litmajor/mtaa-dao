# Paychant Integration - Quick Setup Guide
**Status**: Ready to Activate  
**Estimated Time**: 30-45 minutes  
**Difficulty**: Medium

---

## Overview

Paychant is ready to integrate into the payment gateway. The backend framework is complete; you just need to:
1. Add API credentials to `.env`
2. Implement Paychant-specific deposit/withdrawal logic
3. Add webhook signature verification
4. Test with Paychant sandbox credentials

---

## Step 1: Get Paychant Credentials (5 minutes)

### From Paychant Dashboard

1. Sign in to [Paychant Developer Console](https://paychant.dev)
2. Navigate to **API Keys** section
3. Copy the following:
   - **Public Key** (for frontend)
   - **Secret Key** (for backend)
   - **Webhook Secret** (for webhook verification)

---

## Step 2: Add to Environment Variables (2 minutes)

### Add to `.env` file

```env
# ========================================
# PAYCHANT CONFIGURATION
# ========================================
PAYCHANT_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYCHANT_SECRET_KEY=sk_test_xxxxxxxxxxxxx
PAYCHANT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
PAYCHANT_ENV=test  # or 'production'
PAYCHANT_API_URL=https://sandbox-api.paychant.io  # or https://api.paychant.io
```

### Verification
```bash
# Verify variables are loaded
grep -i paychant .env
```

---

## Step 3: Implement Paychant Deposit Logic (10 minutes)

### Add to `server/services/paymentGatewayService.ts`

Find the section around line 275 and add:

```typescript
private async paychantDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
  const reference = `PCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const payload = {
    reference: reference,
    amount: request.amount,
    currency: request.currency,
    description: 'MtaaDAO Deposit',
    customer: {
      email: request.metadata?.email,
      phone: request.metadata?.phone,
      name: request.metadata?.name
    },
    redirect_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`,
    metadata: {
      userId: request.userId,
      type: 'deposit'
    }
  };

  try {
    const response = await fetch(`${process.env.PAYCHANT_API_URL}/transactions/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === 'success' || data.data?.authorization_url) {
      await this.recordTransaction(
        request.userId,
        reference,
        'deposit',
        request.amount,
        request.currency,
        'paychant',
        'pending'
      );

      return {
        success: true,
        transactionId: data.data?.reference || data.data?.id,
        paymentUrl: data.data?.authorization_url,
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

---

## Step 4: Implement Paychant Withdrawal Logic (10 minutes)

### Add to `server/services/paymentGatewayService.ts`

Find the withdrawal methods section (around line 480) and add:

```typescript
private async paychantWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
  const reference = `PCH-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const payload = {
    reference: reference,
    amount: request.amount,
    currency: request.currency,
    customer: {
      email: request.metadata?.email,
      phone: request.metadata?.phone,
      account_name: request.metadata?.accountName
    },
    bank_details: {
      bank_code: request.metadata?.bankCode,
      account_number: request.metadata?.accountNumber,
      account_name: request.metadata?.accountName
    },
    description: 'MtaaDAO Withdrawal',
    narration: 'MtaaDAO Withdrawal'
  };

  try {
    const response = await fetch(`${process.env.PAYCHANT_API_URL}/transfers/initiate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === 'success' || data.data?.id) {
      await this.recordTransaction(
        request.userId,
        reference,
        'withdrawal',
        request.amount,
        request.currency,
        'paychant',
        'processing'
      );

      return {
        success: true,
        transactionId: data.data?.id || data.data?.reference,
        reference,
        status: 'processing',
        message: 'Withdrawal initiated successfully'
      };
    }

    throw new Error(data.message || 'Withdrawal failed');
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

---

## Step 5: Update Switch Statements (5 minutes)

### In `initiateDeposit()` method

Find around line 115 and add to the switch statement:

```typescript
case 'paychant':
  return this.paychantDeposit(config, request);
```

### In `initiateWithdrawal()` method

Find around line 140 and add to the switch statement:

```typescript
case 'paychant':
  return this.paychantWithdrawal(config, request);
```

---

## Step 6: Add Webhook Handler (8 minutes)

### Add to `server/routes/payment-gateway.ts`

Find after the Paystack webhook handler (around line 100) and add:

```typescript
// POST /api/payment-gateway/paychant/webhook
router.post('/paychant/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-paychant-signature'];
    const payload = req.body;
    
    // Generate HMAC SHA256
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', process.env.PAYCHANT_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== hash) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook
    const { reference, status, amount, currency } = payload;
    
    console.log('Paychant webhook received:', {
      reference,
      status,
      amount,
      currency
    });

    // Update transaction status in database
    if (status === 'success' || status === 'completed') {
      // Mark transaction as completed
      console.log(`Transaction ${reference} completed`);
    } else if (status === 'failed') {
      // Mark transaction as failed
      console.log(`Transaction ${reference} failed`);
    }

    res.json({ status: 'success' });
  } catch (error: any) {
    console.error('Paychant webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## Step 7: Add Verification Method (5 minutes)

### Add to `verifyTransaction()` method

Find the switch statement around line 570 and add:

```typescript
case 'paychant':
  return this.verifyPaychant(config, reference);
```

### Add verification helper method

```typescript
private async verifyPaychant(config: PaymentGatewayConfig, reference: string): Promise<any> {
  const response = await fetch(
    `${process.env.PAYCHANT_API_URL}/transactions/${reference}`,
    {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`
      }
    }
  );

  const data = await response.json();
  
  return {
    status: data.data?.status,
    amount: data.data?.amount,
    currency: data.data?.currency,
    transactionId: data.data?.id,
    timestamp: data.data?.created_at
  };
}
```

---

## Step 8: Add Paychant to Frontend (3 minutes)

### Update `client/src/components/PaymentModal.tsx`

The component already includes Paychant! Just verify line 18:

```typescript
{ key: 'paychant', label: 'Paychant', icon: CreditCard, color: 'from-green-500 to-green-600', description: 'Payment platform' },
```

✅ **Already configured in frontend!**

---

## Step 9: Update Provider Configuration (2 minutes)

### Add to `initializeProviders()` method

Find around line 58 and add:

```typescript
if (process.env.PAYCHANT_PUBLIC_KEY && process.env.PAYCHANT_SECRET_KEY) {
  this.configs.set('paychant', {
    provider: 'paychant',
    apiKey: process.env.PAYCHANT_PUBLIC_KEY,
    secretKey: process.env.PAYCHANT_SECRET_KEY,
    webhookSecret: process.env.PAYCHANT_WEBHOOK_SECRET,
    environment: (process.env.PAYCHANT_ENV as any) || 'test'
  });
}
```

---

## Step 10: Testing (15 minutes)

### 1. Verify Environment Variables
```bash
npm run dev
# Check logs for:
# "Paychant provider initialized" or similar
```

### 2. Test Deposit Flow
```bash
curl -X POST http://localhost:5000/api/payment-gateway/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "paychant",
    "amount": "1000",
    "currency": "KES",
    "method": "card",
    "metadata": {
      "email": "test@example.com",
      "phone": "+254700000000",
      "name": "Test User"
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "transactionId": "xxxxx",
  "paymentUrl": "https://checkout.paychant.io/xxxxx",
  "reference": "PCH-1674923400000-abc123",
  "status": "pending"
}
```

### 3. Test Withdrawal Flow
```bash
curl -X POST http://localhost:5000/api/payment-gateway/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "paychant",
    "amount": "500",
    "currency": "KES",
    "method": "bank_transfer",
    "metadata": {
      "bankCode": "63",
      "accountNumber": "1234567890",
      "accountName": "Test User"
    }
  }'
```

### 4. Verify Webhook Endpoint
```bash
curl -X POST http://localhost:5000/api/payment-gateway/paychant/webhook \
  -H "Content-Type: application/json" \
  -H "x-paychant-signature: YOUR_SIGNATURE" \
  -d '{
    "reference": "PCH-1674923400000-abc123",
    "status": "success",
    "amount": "1000",
    "currency": "KES"
  }'
```

---

## Verification Checklist

- [ ] Added all three Paychant environment variables to `.env`
- [ ] Restarted server (`npm run dev`)
- [ ] Deposit method implemented
- [ ] Withdrawal method implemented
- [ ] Switch statements updated in both methods
- [ ] Webhook handler added
- [ ] Verification method implemented
- [ ] Provider initialized in `initializeProviders()`
- [ ] Tested deposit flow
- [ ] Tested withdrawal flow
- [ ] Tested webhook endpoint
- [ ] Checked database for transaction records

---

## Common Issues & Solutions

### Issue: "Paychant provider not configured"
**Solution**: Verify all three env variables are set and server was restarted

### Issue: Webhook signature verification fails
**Solution**: Ensure PAYCHANT_WEBHOOK_SECRET matches exactly in Paychant dashboard

### Issue: Payment URL returns error
**Solution**: 
- Check API URL is correct for environment (sandbox vs production)
- Verify API keys are for correct environment
- Check request payload format against Paychant API docs

### Issue: Transaction not recording in database
**Solution**: Verify webhook is being called and status is 'success'

---

## Production Deployment

### Before Going Live

1. ✅ Get production API keys from Paychant
2. ✅ Update `.env` with production keys
3. ✅ Update `PAYCHANT_ENV=production`
4. ✅ Update `PAYCHANT_API_URL` to production endpoint
5. ✅ Configure webhook URL in Paychant dashboard (production)
6. ✅ Test full flow in production environment
7. ✅ Enable monitoring and alerting

---

## Total Implementation Time

| Step | Time |
|------|------|
| Add credentials | 5 min |
| Deposit logic | 10 min |
| Withdrawal logic | 10 min |
| Switch statements | 5 min |
| Webhook handler | 8 min |
| Verification | 5 min |
| Frontend (already done) | - |
| Testing | 15 min |
| **Total** | **58 min** |

---

## After Integration

Once Paychant is fully integrated:

✅ Users can deposit via Paychant
✅ Users can withdraw to Paychant-connected accounts
✅ Real-time payment status updates
✅ Webhook-based transaction confirmation
✅ Complete transaction history
✅ Transaction limit enforcement

---

**Status**: Ready to implement - All framework is in place!

Need help? Reference the working Flutterwave or Paystack implementations as examples.
