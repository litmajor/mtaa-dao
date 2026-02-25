
import express from 'express';
import { z } from 'zod';
import { notificationService } from '../notificationService';

const router = express.Router();

interface PaymentReconciliationReport {
  provider: string;
  totalPayments: number;
  completed: number;
  failed: number;
  pending: number;
  cancelled: number;
  totalAmount: number;
  successRate: string;
  avgProcessingTime: number;
  failureReasons: { reason: string; count: number; percentage: string }[];
  inRetryQueue: number;
  reconciliationErrors: number;
}

// Cross-provider payment reconciliation service
class PaymentReconciliationService {
  private providers = ['mpesa', 'kotanipay', 'stripe', 'paystack', 'flutterwave', 'coinbase', 'minipay'];

  async generateComprehensiveReport(startDate?: string, endDate?: string): Promise<PaymentReconciliationReport[]> {
    const reports: PaymentReconciliationReport[] = [];

    for (const provider of this.providers) {
      try {
        const report = await this.getProviderReport(provider, startDate, endDate);
        reports.push(report);
      } catch (error) {
        console.error(`Failed to get report for ${provider}:`, error);
        reports.push(this.getEmptyReport(provider));
      }
    }

    return reports;
  }

  private async getProviderReport(provider: string, startDate?: string, endDate?: string): Promise<PaymentReconciliationReport> {
    // This would typically fetch from your database
    // For now, we'll return mock data that would come from the actual provider stores
    
    switch (provider) {
      case 'mpesa':
        return {
          provider: 'M-Pesa',
          totalPayments: 150,
          completed: 142,
          failed: 6,
          pending: 2,
          cancelled: 0,
          totalAmount: 50000,
          successRate: '94.7%',
          avgProcessingTime: 45, // seconds
          failureReasons: [
            { reason: 'Insufficient funds', count: 3, percentage: '50%' },
            { reason: 'Invalid phone number', count: 2, percentage: '33%' },
            { reason: 'Network timeout', count: 1, percentage: '17%' }
          ],
          inRetryQueue: 1,
          reconciliationErrors: 0
        };

      case 'kotanipay':
        return {
          provider: 'KotaniPay',
          totalPayments: 75,
          completed: 68,
          failed: 5,
          pending: 2,
          cancelled: 0,
          totalAmount: 25000,
          successRate: '90.7%',
          avgProcessingTime: 60,
          failureReasons: [
            { reason: 'Bank account not found', count: 2, percentage: '40%' },
            { reason: 'Insufficient balance', count: 2, percentage: '40%' },
            { reason: 'Service unavailable', count: 1, percentage: '20%' }
          ],
          inRetryQueue: 2,
          reconciliationErrors: 1
        };

      case 'stripe':
        return {
          provider: 'Stripe',
          totalPayments: 200,
          completed: 185,
          failed: 12,
          pending: 3,
          cancelled: 0,
          totalAmount: 75000,
          successRate: '92.5%',
          avgProcessingTime: 15,
          failureReasons: [
            { reason: 'card_declined', count: 5, percentage: '42%' },
            { reason: 'insufficient_funds', count: 4, percentage: '33%' },
            { reason: 'processing_error', count: 3, percentage: '25%' }
          ],
          inRetryQueue: 0,
          reconciliationErrors: 0
        };

      default:
        return this.getEmptyReport(provider);
    }
  }

  private getEmptyReport(provider: string): PaymentReconciliationReport {
    return {
      provider,
      totalPayments: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      cancelled: 0,
      totalAmount: 0,
      successRate: '0%',
      avgProcessingTime: 0,
      failureReasons: [],
      inRetryQueue: 0,
      reconciliationErrors: 0
    };
  }

  async detectAnomalies(reports: PaymentReconciliationReport[]): Promise<string[]> {
    const anomalies: string[] = [];

    for (const report of reports) {
      // Check for low success rates
      const successRate = parseFloat(report.successRate.replace('%', ''));
      if (successRate < 85 && report.totalPayments > 10) {
        anomalies.push(`${report.provider}: Low success rate (${report.successRate})`);
      }

      // Check for high reconciliation errors
      if (report.reconciliationErrors > 0) {
        anomalies.push(`${report.provider}: ${report.reconciliationErrors} reconciliation errors detected`);
      }

      // Check for high retry queue
      if (report.inRetryQueue > 5) {
        anomalies.push(`${report.provider}: High retry queue (${report.inRetryQueue} payments)`);
      }

      // Check for slow processing times
      if (report.avgProcessingTime > 120) {
        anomalies.push(`${report.provider}: Slow processing (${report.avgProcessingTime}s average)`);
      }
    }

    return anomalies;
  }

  async autoResolveIssues(provider: string): Promise<{ resolved: number; errors: string[] }> {
    const errors: string[] = [];
    let resolved = 0;

    try {
      // Auto-retry failed payments in retry queue
      const retryResponse = await fetch(`/api/payments/${provider}/retry-all`, {
        method: 'POST'
      });
      
      if (retryResponse.ok) {
        const result = await retryResponse.json();
        resolved += result.retriedCount || 0;
      } else {
        errors.push(`Failed to retry ${provider} payments`);
      }

      // Clear stuck pending payments older than 1 hour
      const clearResponse = await fetch(`/api/payments/${provider}/clear-stuck`, {
        method: 'POST'
      });
      
      if (clearResponse.ok) {
        const result = await clearResponse.json();
        resolved += result.clearedCount || 0;
      } else {
        errors.push(`Failed to clear stuck ${provider} payments`);
      }

    } catch (error) {
      errors.push(`Auto-resolve failed for ${provider}: ${error}`);
    }

    return { resolved, errors };
  }
}

const reconciliationService = new PaymentReconciliationService();

// GET /api/payments/reconciliation/report
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, provider } = req.query;
    
    let reports;
    if (provider) {
      // Get report for specific provider
      const singleReport = await reconciliationService['getProviderReport'](
        provider as string, 
        startDate as string, 
        endDate as string
      );
      reports = [singleReport];
    } else {
      // Get comprehensive report for all providers
      reports = await reconciliationService.generateComprehensiveReport(
        startDate as string, 
        endDate as string
      );
    }

    // Detect anomalies
    const anomalies = await reconciliationService.detectAnomalies(reports);

    // Calculate overall metrics
    const overall = {
      totalPayments: reports.reduce((sum, r) => sum + r.totalPayments, 0),
      totalCompleted: reports.reduce((sum, r) => sum + r.completed, 0),
      totalFailed: reports.reduce((sum, r) => sum + r.failed, 0),
      totalAmount: reports.reduce((sum, r) => sum + r.totalAmount, 0),
      overallSuccessRate: reports.length > 0 ? 
        ((reports.reduce((sum, r) => sum + r.completed, 0) / 
          reports.reduce((sum, r) => sum + r.totalPayments, 0)) * 100).toFixed(2) + '%' : '0%'
    };

    res.json({
      success: true,
      overall,
      providers: reports,
      anomalies,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate reconciliation report',
      error: error.message
    });
  }
});

// POST /api/payments/reconciliation/auto-resolve
router.post('/auto-resolve', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (provider) {
      // Auto-resolve for specific provider
      const result = await reconciliationService.autoResolveIssues(provider);
      res.json({
        success: true,
        provider,
        ...result
      });
    } else {
      // Auto-resolve for all providers
      const results = [];
      const providers = ['mpesa', 'kotanipay', 'stripe', 'paystack'];
      
      for (const p of providers) {
        const result = await reconciliationService.autoResolveIssues(p);
        results.push({ provider: p, ...result });
      }
      
      res.json({
        success: true,
        results,
        totalResolved: results.reduce((sum, r) => sum + r.resolved, 0)
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Auto-resolve failed',
      error: error.message
    });
  }
});

// GET /api/payments/reconciliation/anomalies
router.get('/anomalies', async (req, res) => {
  try {
    const reports = await reconciliationService.generateComprehensiveReport();
    const anomalies = await reconciliationService.detectAnomalies(reports);
    
    res.json({
      success: true,
      anomalies,
      count: anomalies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to detect anomalies',
      error: error.message
    });
  }
});

// POST /api/payments/reconciliation/notifications/subscribe
router.post('/notifications/subscribe', async (req, res) => {
  try {
    const { recipient, channels, events } = req.body;
    
    // Subscribe to reconciliation notifications
    notificationService.subscribe(recipient, channels);
    
    // Set up event listeners for reconciliation events
    const eventTypes = events || ['anomaly_detected', 'reconciliation_failed', 'high_failure_rate'];
    
    for (const eventType of eventTypes) {
      notificationService.on(eventType, async (data) => {
        await notificationService.sendPaymentNotification(recipient, {
          type: 'payment_failed', // Reuse existing type for now
          amount: 0,
          currency: 'USD',
          transactionId: `RECON-${Date.now()}`,
          errorMessage: `Reconciliation alert: ${data.message}`
        });
      });
    }
    
    res.json({
      success: true,
      message: 'Subscribed to reconciliation notifications',
      recipient,
      events: eventTypes
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to notifications',
      error: error.message
    });
  }
});
import { db } from '../storage';
import { walletTransactions } from '../../shared/schema';
import { eq, and, desc, gte, count, sum } from 'drizzle-orm';


// GET /api/payment-reconciliation/payments
router.get('/payments', async (req, res) => {
  try {
    const {
      status,
      provider,
      reconciled,
      dateRange = '30'
    } = req.query;

    // Build where conditions
    const conditions = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(walletTransactions.status, status as string));
    }
    
    if (reconciled !== 'all') {
      // Add reconciled filter logic here
    }

    // Date filter
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange as string));
    conditions.push(gte(walletTransactions.createdAt, dateFilter));

    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    const payments = await db
      .select()
      .from(walletTransactions)
      .where(whereClause)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100);

    // Calculate stats
    const stats = {
      total: payments.length,
      reconciled: payments.filter(p => p.status === 'completed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      discrepancies: 0, // Calculate discrepancies based on your logic
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toString()
    };

    res.json({ payments, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payment-reconciliation/reconcile/:id
router.post('/reconcile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update transaction status to reconciled
    await db
      .update(walletTransactions)
      .set({ 
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(walletTransactions.id, id));

    res.json({ success: true, message: 'Payment reconciled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Reconciliation failed' });
  }
});

// POST /api/payment-reconciliation/bulk-reconcile
router.post('/bulk-reconcile', async (req, res) => {
  try {
    const { paymentIds } = req.body;
    
    if (!Array.isArray(paymentIds)) {
      return res.status(400).json({ error: 'Invalid payment IDs' });
    }

    // Bulk update transactions
    for (const paymentId of paymentIds) {
      await db
        .update(walletTransactions)
        .set({ 
          status: 'completed',
          updatedAt: new Date()
        })
        .where(eq(walletTransactions.id, paymentId));
    }

    res.json({ 
      success: true, 
      message: `Successfully reconciled ${paymentIds.length} payments` 
    });
  } catch (error) {
    res.status(500).json({ error: 'Bulk reconciliation failed' });
  }
});

export default router;
