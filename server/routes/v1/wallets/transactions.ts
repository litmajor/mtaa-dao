import { Router, Request, Response } from 'express';
import { db } from '../../../db';
import { walletTransactions, wallets } from '../../../../shared/schema';
import { eq, desc, inArray, or } from 'drizzle-orm';
import { authenticateToken } from '../../../middleware/auth';

const router = Router();

/**
 * GET /api/v1/wallets/transactions
 * Get all transactions for the authenticated user's wallet
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userWallets = await db
      .select({ id: wallets.id, address: wallets.address })
      .from(wallets)
      .where(eq(wallets.userId, userId));

    if (!userWallets.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const walletAddresses = userWallets.map((w: any) => w.address);

    // Get transactions for these wallets
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(
        or(
          eq(walletTransactions.fromUserId, userId),
          eq(walletTransactions.toUserId, userId),
          inArray(walletTransactions.walletAddress, walletAddresses)
        )
      )
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50); // Provide reasonable limit for UI

    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

export default router;
