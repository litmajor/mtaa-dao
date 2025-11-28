import { Request, Response } from 'express';
import { db } from '../db';
import { walletTransactions, users } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

/**
 * GET /api/payments
 * List all payments for the authenticated user
 * Supports filtering by status, type, and date range
 */
export async function paymentsIndexHandler(req: Request, res: Response) {
  try {
    // Get user from session
    const session = (req as any).session;
    if (!session?.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to view payments'
      });
    }

    const userId = session.user.id;
    const {
      status = 'all', // all, pending, completed, failed
      type = 'all', // all, sent, received
      startDate,
      endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    // Build filter conditions
    const conditions = [eq(walletTransactions.toUserId, userId)];

    // Filter by status
    if (status && status !== 'all') {
      conditions.push(eq(walletTransactions.status, status as string));
    }

    // Filter by type
    if (type && type !== 'all') {
      conditions.push(eq(walletTransactions.type, type as string));
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      conditions.push(eq(walletTransactions.createdAt, start) as any);
    }

    if (endDate) {
      const end = new Date(endDate as string);
      conditions.push(eq(walletTransactions.createdAt, end) as any);
    }

    // Get total count
    const totalResult = await db
      .select({ count: walletTransactions.id })
      .from(walletTransactions)
      .where(and(...conditions));

    const total = totalResult.length;

    // Get paginated payments
    const payments = await db
      .select()
      .from(walletTransactions)
      .where(and(...conditions))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Enrich with user details
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        let recipientDetails = null;

        if (payment.toUserId) {
          const recipient = await db.query.users.findFirst({
            where: eq(users.id, payment.toUserId),
            columns: {
              id: true,
              name: true,
              email: true,
              walletAddress: true
            }
          });
          recipientDetails = recipient;
        }

        return {
          ...payment,
          recipientDetails,
          metadata: typeof payment.metadata === 'string'
            ? JSON.parse(payment.metadata)
            : payment.metadata
        };
      })
    );

    // Return successful response
    return res.status(200).json({
      success: true,
      data: {
        payments: enrichedPayments,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + parseInt(limit as string) < total
        },
        filters: {
          status,
          type,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching payments: ${errorMsg}`, error);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payments',
      message: errorMsg
    });
  }
}
