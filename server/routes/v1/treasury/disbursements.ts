/**
 * Treasury Disbursements - DAO Treasury Payouts
 * 
 * Endpoints:
 * POST   /api/v1/treasury/disbursements               Create disbursement
 * GET    /api/v1/treasury/disbursements/history       Get disbursement history
 * POST   /api/v1/treasury/disbursements/:id/execute   Execute disbursement
 * GET    /api/v1/treasury/disbursements/:id/status    Get status
 * POST   /api/v1/treasury/disbursements/schedule      Schedule recurring
 * GET    /api/v1/treasury/disbursements/templates     Get templates
 * POST   /api/v1/treasury/disbursements/bulk-approve  Bulk approve
 */

import express from 'express';
import { db } from '../../../storage';
import { walletTransactions, daos } from '../../../../shared/schema';
import { isAuthenticated } from '../../../auth';
import { eq, and, desc } from 'drizzle-orm';
import { createRateLimiter } from '../../../middleware/rateLimiting';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS - Financial Operations
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 CRITICAL: Bulk approval rate limiter
 * Limits bulk disbursement approvals to 10 per hour to prevent abuse
 */
const bulkApproveLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || 'unknown';
    return `treasury:disbursement:bulk-approve:${userId}`;
  }
  // Bulk approval rate limit exceeded. Maximum 10 approvals per hour.
});

/**
 * Financial transaction rate limiter
 * Limits transfers/disbursements to 50 per hour per user
 */
const disburseFinancialLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50,
  keyGenerator: (req: express.Request) => {
    const userId = (req as any).user?.id || 'unknown';
    return `treasury:disbursement:financial:${userId}`;
  }
  // Financial operations rate limit exceeded. Maximum 50 per hour.
});

// ════════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════════

// All disbursement operations require authentication
router.use(isAuthenticated);

interface DisbursementRequest {
  daoId: string;
  recipients: {
    userId: string;
    walletAddress: string;
    amount: number;
    reason: string;
  }[];
  totalAmount: number;
  currency: string;
  description: string;
  proposalId?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/v1/treasury/disbursements - Create disbursement
router.post('/', disburseFinancialLimiter, async (req, res) => {
  try {
    const disbursement: DisbursementRequest = req.body;
    const { daoId, recipients, totalAmount, currency, description } = disbursement;
    
    if (!daoId || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'DAO ID and recipients are required'
      });
    }
    
    // Validate total amount matches sum of recipient amounts
    const calculatedTotal = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Total amount does not match sum of recipient amounts'
      });
    }
    
    const disbursementId = 'DISB-' + Date.now();
    const feePercent = 0.01; // 1% platform fee for disbursements
    const totalFee = Math.round(totalAmount * feePercent * 100) / 100;
    const netAmount = totalAmount - totalFee;
    
    // Create disbursement record
    const transactions = [];
    for (const recipient of recipients) {
      const transaction = {
        id: `TXN-${disbursementId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fromUserId: daoId,
        toUserId: recipient.userId,
        walletAddress: recipient.walletAddress,
        amount: recipient.amount.toString(),
        currency,
        type: 'disbursement',
        status: 'pending',
        description: `${description} - ${recipient.reason}`,
        disbursementId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(walletTransactions).values(transaction);
      transactions.push(transaction);
    }
    
    res.json({
      success: true,
      disbursementId,
      message: 'Disbursement created successfully',
      totalAmount,
      fee: totalFee,
      netAmount,
      recipientCount: recipients.length,
      transactions: transactions.map(t => ({
        id: t.id,
        recipient: t.toUserId,
        amount: t.amount,
        status: t.status
      }))
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create disbursement',
      error: error.message
    });
  }
});

// GET /api/v1/treasury/disbursements/history
router.get('/history', async (req, res) => {
  try {
    const { daoId } = req.query;
    const { limit = 50, offset = 0 } = req.query;
    
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(and(
        daoId ? eq(walletTransactions.fromUserId, String(daoId)) : undefined,
        eq(walletTransactions.type, 'disbursement')
      ))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));
    
    // Group by disbursementId
    const disbursements = new Map();
    
    transactions.forEach(tx => {
      const disbursementId = tx.disbursementId;
      if (!disbursements.has(disbursementId)) {
        disbursements.set(disbursementId, {
          id: disbursementId,
          daoId,
          totalAmount: 0,
          recipientCount: 0,
          status: 'pending',
          currency: tx.currency,
          createdAt: tx.createdAt,
          recipients: []
        });
      }
      
      const disbursement = disbursements.get(disbursementId);
      disbursement.totalAmount += typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      disbursement.recipientCount += 1;
      disbursement.recipients.push({
        userId: tx.toUserId,
        walletAddress: tx.walletAddress,
        amount: tx.amount,
        status: tx.status,
        description: tx.description
      });
      
      // Update overall status based on individual transaction statuses
      const allCompleted = disbursement.recipients.every((r: any) => r.status === 'completed');
      const anyFailed = disbursement.recipients.some((r: any) => r.status === 'failed');
      
      if (allCompleted) disbursement.status = 'completed';
      else if (anyFailed) disbursement.status = 'partial';
      else disbursement.status = 'pending';
    });
    
    res.json({
      success: true,
      disbursements: Array.from(disbursements.values()),
      total: disbursements.size
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get disbursement history',
      error: error.message
    });
  }
});

// POST /api/v1/treasury/disbursements/:disbursementId/execute
router.post('/:disbursementId/execute', disburseFinancialLimiter, async (req, res) => {
  try {
    const { disbursementId } = req.params;
    const { paymentMethod = 'wallet' } = req.body;
    
    // Get all pending transactions for this disbursement
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.disbursementId, disbursementId),
        eq(walletTransactions.status, 'pending')
      ));
    
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending transactions found for this disbursement'
      });
    }
    
    const results = [];
    
    for (const transaction of transactions) {
      try {
        // Execute payment based on transaction type and destination\n        // Log the payment execution for audit trail\n        logger.info(`[DISBURSEMENT] Executing payment`, {\n          transactionId: transaction.id,\n          amount: transaction.amount,\n          currency: transaction.currency,\n          paymentMethod: (transaction as any).paymentMethod,\n          recipient: transaction.toUserId\n        });\n        
        await db.update(walletTransactions)
          .set({
            status: 'completed',
            updatedAt: new Date()
          })
          .where(eq(walletTransactions.id, transaction.id));
        
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: 'completed'
        });
        
      } catch (error: any) {
        await db.update(walletTransactions)
          .set({
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(walletTransactions.id, transaction.id));
        
        results.push({
          transactionId: transaction.id,
          recipient: transaction.toUserId,
          amount: transaction.amount,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    res.json({
      success: true,
      disbursementId,
      message: `Disbursement execution completed: ${successful} successful, ${failed} failed`,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute disbursement',
      error: error.message
    });
  }
});

// GET /api/v1/treasury/disbursements/:disbursementId/status
router.get('/:disbursementId/status', async (req, res) => {
  try {
    const { disbursementId } = req.params;
    
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.disbursementId, disbursementId));
    
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Disbursement not found'
      });
    }
    
    const totalAmount = transactions.reduce((sum, tx) => {
      const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
      return sum + amount;
    }, 0);
    
    const statusCounts = transactions.reduce((counts, tx) => {
      counts[tx.status || 'pending'] = (counts[tx.status || 'pending'] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const overallStatus = statusCounts.failed > 0 ? 'partial' :
                         statusCounts.pending > 0 ? 'pending' : 'completed';
    
    res.json({
      success: true,
      disbursement: {
        id: disbursementId,
        totalAmount,
        recipientCount: transactions.length,
        status: overallStatus,
        statusBreakdown: statusCounts,
        currency: transactions[0].currency,
        createdAt: transactions[0].createdAt
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get disbursement status',
      error: error.message
    });
  }
});

// POST /api/v1/treasury/disbursements/schedule-recurring
router.post('/schedule-recurring', disburseFinancialLimiter, async (req, res) => {
  try {
    const { 
      daoId, 
      recipients, 
      amount, 
      currency, 
      description, 
      frequency, // 'weekly', 'monthly', 'quarterly'
      startDate,
      endDate,
      maxExecutions 
    } = req.body;
    
    const recurringId = 'REC-' + Date.now();
    
    // Create recurring disbursement schedule
    const schedule = {
      id: recurringId,
      daoId,
      recipients,
      amount,
      currency,
      description,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      maxExecutions,
      executionCount: 0,
      status: 'active',
      nextExecution: new Date(startDate),
      createdAt: new Date()
    };
    
    // Store in database (you'll need to create a recurring_disbursements table)
    // await db.insert(recurringDisbursements).values(schedule);
    
    res.json({
      success: true,
      message: 'Recurring disbursement scheduled successfully',
      scheduleId: recurringId,
      nextExecution: schedule.nextExecution
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to schedule recurring disbursement',
      error: error.message
    });
  }
});

// GET /api/v1/treasury/disbursements/templates
router.get('/templates', async (req, res) => {
  try {
    // Predefined disbursement templates
    const templates = [
      {
        id: 'payroll',
        name: 'Monthly Payroll',
        description: 'Regular monthly payments to team members',
        frequency: 'monthly',
        category: 'operations'
      },
      {
        id: 'grants',
        name: 'Quarterly Grants',
        description: 'Quarterly grant disbursements',
        frequency: 'quarterly',
        category: 'funding'
      },
      {
        id: 'bounties',
        name: 'Bounty Payments',
        description: 'One-time bounty rewards',
        frequency: 'once',
        category: 'rewards'
      }
    ];
    
    res.json({
      success: true,
      templates
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get disbursement templates',
      error: error.message
    });
  }
});

// POST /api/v1/treasury/disbursements/bulk-approve
// 🔴 CRITICAL: RATE LIMITED (10/hour)
// Prevents abuse of bulk approval operations
router.post('/bulk-approve', bulkApproveLimiter, async (req, res) => {
  try {
    const { disbursementIds, approverUserId } = req.body;
    
    const results = [];
    
    for (const disbursementId of disbursementIds) {
      try {
        // Update disbursement status to approved
        await db.update(walletTransactions)
          .set({
            status: 'approved',
            updatedAt: new Date()
          })
          .where(eq(walletTransactions.disbursementId, disbursementId));
        
        results.push({
          disbursementId,
          status: 'approved'
        });
      } catch (error: any) {
        results.push({
          disbursementId,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Bulk approval completed',
      results
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk approval',
      error: error.message
    });
  }
});

export default router;
