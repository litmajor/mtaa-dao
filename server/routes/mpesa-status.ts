// components/vault/VaultCard.tsx
import express from 'express';
import { z } from 'zod';
const router = express.Router();

// Validation schema for Mpesa callback
const mpesaCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({
        Item: z.array(z.object({
          Name: z.string(),
          Value: z.union([z.string(), z.number()])
        }))
      }).optional()
    })
  })
});

// In-memory store for payment status (replace with your database)
const paymentStatus = new Map<string, any>();

// GET /api/payments/mpesa/status/:transactionId
router.get('/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    // Get status from your storage
    const status = paymentStatus.get(transactionId);
    
    if (!status) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      code: 'STATUS_CHECK_FAILED',
      message: 'Failed to check payment status',
      details: error.message
    });
  }
});

// POST /api/payments/mpesa/callback
router.post('/callback', async (req, res) => {
  try {
    const callback = mpesaCallbackSchema.parse(req.body);
    const { ResultCode, CheckoutRequestID, ResultDesc } = callback.Body.stkCallback;
    
    // Extract payment details from callback metadata
    let amount, receipt, phoneNumber;
    if (callback.Body.stkCallback.CallbackMetadata?.Item) {
      for (const item of callback.Body.stkCallback.CallbackMetadata.Item) {
        if (item.Name === 'Amount') amount = item.Value;
        if (item.Name === 'MpesaReceiptNumber') receipt = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
      }
    }

    // Update payment status
    paymentStatus.set(CheckoutRequestID, {
      status: ResultCode === 0 ? 'completed' : 'failed',
      transactionId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      amount,
      receipt,
      phoneNumber,
      timestamp: new Date().toISOString()
    });

    // TODO: Update your database with payment status
    // TODO: If payment successful, update DAO premium status if it's a billing payment

    res.json({ success: true });
  } catch (error: any) {
    console.error('Mpesa callback error:', error);
    res.status(400).json({
      code: 'INVALID_CALLBACK',
      message: 'Invalid callback data',
      details: error.message
    });
  }
});

// ...existing code...

