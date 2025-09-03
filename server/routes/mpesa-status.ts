
import express from 'express';
import { z } from 'zod';
import { notificationService } from '../notificationService';

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

interface MpesaPayment {
  id: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  phone: string;
  daoId?: string;
  receipt?: string;
  resultCode?: number;
  resultDesc?: string;
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
}

// In-memory store for payment status (replace with your database)
const paymentStatus = new Map<string, MpesaPayment>();
const mpesaRetryQueue = new Map<string, MpesaPayment>();

// M-Pesa specific reconciliation service
class MpesaReconciliationService {
  static async reconcilePayment(checkoutRequestId: string, callbackData: any) {
    const payment = paymentStatus.get(checkoutRequestId);
    if (!payment) {
      console.warn(`M-Pesa reconciliation: Transaction ${checkoutRequestId} not found`);
      return false;
    }

    // Extract payment details from callback metadata
    let amount, receipt, phoneNumber;
    if (callbackData.CallbackMetadata?.Item) {
      for (const item of callbackData.CallbackMetadata.Item) {
        if (item.Name === 'Amount') amount = Number(item.Value);
        if (item.Name === 'MpesaReceiptNumber') receipt = String(item.Value);
        if (item.Name === 'PhoneNumber') phoneNumber = String(item.Value);
      }
    }

    // Verify amount matches
    if (amount && payment.amount !== amount) {
      console.error(`M-Pesa reconciliation failed: Amount mismatch for ${checkoutRequestId}`);
      return false;
    }

    // Update payment with reconciled data
    payment.receipt = receipt;
    payment.resultCode = callbackData.ResultCode;
    payment.resultDesc = callbackData.ResultDesc;
    payment.status = callbackData.ResultCode === 0 ? 'completed' : 'failed';
    payment.updatedAt = new Date().toISOString();

    paymentStatus.set(checkoutRequestId, payment);
    return true;
  }

  static async processCompletedPayment(payment: MpesaPayment) {
    try {
      // Credit user account or update DAO premium status
      if (payment.daoId) {
        console.log(`Crediting DAO ${payment.daoId} with ${payment.amount} KES`);
        // TODO: Update DAO premium status in database
      }

      // Send success notification
      await notificationService.sendPaymentNotification(payment.phone, {
        type: 'payment_success',
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transactionId
      });

      // Update real-time status
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: 'completed',
        receipt: payment.receipt,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error processing completed M-Pesa payment:', error);
      return false;
    }
  }

  static async processFailedPayment(payment: MpesaPayment) {
    try {
      // Check if payment can be retried based on error code
      const retryableErrors = [1, 1032, 1037]; // Common retryable M-Pesa errors
      
      if (retryableErrors.includes(payment.resultCode || 0) && (payment.retryCount || 0) < 3) {
        payment.retryCount = (payment.retryCount || 0) + 1;
        mpesaRetryQueue.set(payment.transactionId, payment);
        
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.retryFailedPayment(payment.transactionId);
        }, 60000 * payment.retryCount); // 1, 2, 3 minutes
        
        // Send retry notification
        await notificationService.sendPaymentNotification(payment.phone, {
          type: 'payment_retry',
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId
        });
      } else {
        // Send failure notification
        await notificationService.sendPaymentNotification(payment.phone, {
          type: 'payment_failed',
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          errorMessage: payment.resultDesc
        });
      }

      // Update real-time status
      notificationService.updatePaymentStatus(payment.transactionId, {
        status: 'failed',
        error: payment.resultDesc,
        retryCount: payment.retryCount,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error processing failed M-Pesa payment:', error);
      return false;
    }
  }

  static async retryFailedPayment(transactionId: string) {
    const payment = mpesaRetryQueue.get(transactionId);
    if (!payment) return;

    try {
      console.log(`Retrying M-Pesa payment ${transactionId} (attempt ${payment.retryCount})`);
      
      // TODO: Retry payment with M-Pesa API
      // This would involve calling the STK Push API again
      
      // Mock retry logic
      const retrySuccess = Math.random() > 0.3; // 70% chance of success on retry
      
      if (retrySuccess) {
        payment.status = 'completed';
        payment.resultCode = 0;
        payment.resultDesc = 'Success';
        payment.receipt = 'RETRY' + Date.now();
        mpesaRetryQueue.delete(transactionId);
        await this.processCompletedPayment(payment);
      } else {
        await this.processFailedPayment(payment);
      }
    } catch (error) {
      console.error(`M-Pesa retry failed for payment ${transactionId}:`, error);
    }
  }
}

// GET /api/payments/mpesa/status/:transactionId
router.get('/status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const status = paymentStatus.get(transactionId);
    
    if (!status) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      payment: status,
      retryInfo: mpesaRetryQueue.has(transactionId) ? {
        inRetryQueue: true,
        retryCount: status.retryCount || 0
      } : null
    });
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
    
    // Reconcile payment
    const reconciled = await MpesaReconciliationService.reconcilePayment(
      CheckoutRequestID,
      callback.Body.stkCallback
    );

    if (!reconciled) {
      return res.status(400).json({
        code: 'RECONCILIATION_FAILED',
        message: 'Payment reconciliation failed'
      });
    }

    const payment = paymentStatus.get(CheckoutRequestID);
    if (!payment) {
      return res.status(404).json({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found'
      });
    }

    // Process based on result code
    if (ResultCode === 0) {
      await MpesaReconciliationService.processCompletedPayment(payment);
    } else {
      await MpesaReconciliationService.processFailedPayment(payment);
    }

    console.log(`M-Pesa payment ${CheckoutRequestID} processed: ${ResultCode === 0 ? 'Success' : 'Failed'}`);

    res.json({ 
      success: true,
      reconciled: true,
      resultCode: ResultCode
    });
  } catch (error: any) {
    console.error('M-Pesa callback error:', error);
    res.status(400).json({
      code: 'INVALID_CALLBACK',
      message: 'Invalid callback data',
      details: error.message
    });
  }
});

// POST /api/payments/mpesa/retry/:transactionId
router.post('/retry/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const payment = paymentStatus.get(transactionId);
    
    if (!payment) {
      return res.status(404).json({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    if (payment.status !== 'failed') {
      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Can only retry failed payments'
      });
    }

    if ((payment.retryCount || 0) >= 3) {
      return res.status(400).json({
        code: 'RETRY_LIMIT_EXCEEDED',
        message: 'Maximum retry attempts exceeded'
      });
    }

    // Add to retry queue and process immediately
    payment.retryCount = (payment.retryCount || 0) + 1;
    mpesaRetryQueue.set(transactionId, payment);
    await MpesaReconciliationService.retryFailedPayment(transactionId);

    res.json({
      success: true,
      message: 'Payment retry initiated',
      retryCount: payment.retryCount
    });
  } catch (error: any) {
    res.status(500).json({
      code: 'RETRY_FAILED',
      message: 'Failed to retry payment',
      details: error.message
    });
  }
});

// GET /api/payments/mpesa/reconcile
router.get('/reconcile', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all payments in date range
    const payments = Array.from(paymentStatus.values()).filter(payment => {
      if (startDate && payment.createdAt < startDate) return false;
      if (endDate && payment.createdAt > endDate) return false;
      return true;
    });

    const reconciliation = {
      totalPayments: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      failed: payments.filter(p => p.status === 'failed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      inRetryQueue: mpesaRetryQueue.size,
      totalAmount: payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0),
      successRate: payments.length > 0 ? 
        (payments.filter(p => p.status === 'completed').length / payments.length * 100).toFixed(2) + '%' : '0%'
    };

    res.json({
      success: true,
      reconciliation,
      payments: payments.map(p => ({
        ...p,
        inRetryQueue: mpesaRetryQueue.has(p.transactionId)
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      code: 'RECONCILIATION_FAILED',
      message: 'Failed to generate reconciliation report',
      details: error.message
    });
  }
});

export default router;
