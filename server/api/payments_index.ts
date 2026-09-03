import type { Request, Response } from 'express';
import { db } from '../db';
import { walletTransactions, users } from '../../shared/schema';
import { eq, or, and, desc, gte, lte, count } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/payments
 * List all payments for the authenticated user with filtering and pagination
 */
export async function paymentsIndexHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate user session
    const session = (req as any).session;
    const userId = session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to view payments',
      });
    }

    // 2. Parse & sanitize query parameters
    const {
      status = 'all',
      type = 'all',
      startDate,
      endDate,
      limit: rawLimit = String(DEFAULT_LIMIT),
      offset: rawOffset = '0',
    } = req.query;

    const parsedLimit = Math.min(
      Math.max(1, parseInt(rawLimit as string, 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const parsedOffset = Math.max(0, parseInt(rawOffset as string, 10) || 0);

    // 3. Build filter conditions
    const conditions = [];

    // Filter by type / ownership (Sent vs Received vs All)
    if (type === 'sent') {
      conditions.push(eq(walletTransactions.fromUserId, userId));
    } else if (type === 'received') {
      conditions.push(eq(walletTransactions.toUserId, userId));
    } else {
      // Default 'all': User is either sender or receiver
      conditions.push(
        or(
          eq(walletTransactions.fromUserId, userId),
          eq(walletTransactions.toUserId, userId)
        )
      );
    }

    // Filter by transaction status
    if (status && status !== 'all') {
      conditions.push(eq(walletTransactions.status, status as string));
    }

    // Filter by date range (GTE / LTE)
    if (startDate) {
      const start = new Date(startDate as string);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(walletTransactions.createdAt, start));
      }
    }

    if (endDate) {
      const end = new Date(endDate as string);
      if (!isNaN(end.getTime())) {
        conditions.push(lte(walletTransactions.createdAt, end));
      }
    }

    const whereClause = and(...conditions);

    // 4. Get total count using SQL aggregate count()
    const [countResult] = await db
      .select({ total: count() })
      .from(walletTransactions)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    // 5. Query transactions with LEFT JOIN to solve N+1 issue in a single query
    const rows = await db
      .select({
        payment: walletTransactions,
        recipient: {
          id: users.id,
          name: users.name,
          email: users.email,
          walletAddress: users.walletAddress,
        },
      })
      .from(walletTransactions)
      .leftJoin(users, eq(walletTransactions.toUserId, users.id))
      .where(whereClause)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(parsedLimit)
      .offset(parsedOffset);

    // 6. Format and safely parse metadata
    const enrichedPayments = rows.map(({ payment, recipient }) => {
      let parsedMetadata = payment.metadata;

      if (typeof payment.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(payment.metadata);
        } catch {
          parsedMetadata = {};
        }
      }

      return {
        ...payment,
        recipientDetails: recipient?.id ? recipient : null,
        metadata: parsedMetadata ?? {},
      };
    });

    // 7. Return payload
    return res.status(200).json({
      success: true,
      data: {
        payments: enrichedPayments,
        pagination: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: parsedOffset + parsedLimit < total,
        },
        filters: {
          status,
          type,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching payments for user: ${errorMsg}`, error);

    // Generic error response to prevent schema leaking
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payments',
      message: 'An internal error occurred while retrieving your transactions.',
    });
  }
}