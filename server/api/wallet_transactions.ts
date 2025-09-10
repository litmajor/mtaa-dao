
import { Request, Response } from 'express';
import { db } from '../db';
import { transactions } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export async function getWalletTransactions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    res.status(200).json(userTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

export async function createTransaction(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, type, description, hash } = req.body;

    const newTransaction = await db.insert(transactions).values({
      userId,
      amount,
      type,
      description,
      hash,
      createdAt: new Date(),
    }).returning();

    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
}
