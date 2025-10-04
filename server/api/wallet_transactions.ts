import { Request, Response } from 'express';
import { db } from '../db';
import { walletTransactions } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export async function getWalletTransactions(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userTransactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.fromUserId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    res.status(200).json(userTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

export async function createWalletTransaction(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, type, description, transactionHash, currency = 'cUSD', walletAddress } = req.body;

    const newTransaction = await db.insert(walletTransactions).values({
      fromUserId: userId,
      amount,
      type,
      description,
      transactionHash,
      currency,
      walletAddress: walletAddress || '',
      status: 'completed',
    }).returning();

    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
}