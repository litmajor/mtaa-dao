import type { Request, Response } from 'express';
import { db } from '../db';
import { walletTransactions } from '../../shared/schema';
import { eq, or, desc } from 'drizzle-orm';
import { z } from 'zod';

const createTransactionSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number string',
  }),
  type: z.enum(['transfer', 'deposit', 'withdrawal', 'payment']),
  description: z.string().max(255).optional(),
  transactionHash: z.string().min(10),
  currency: z.string().default('cUSD'),
  walletAddress: z.string().min(1, 'Wallet address is required'),
});

const getTransactionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function getWalletTransactions(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit, offset } = getTransactionsQuerySchema.parse(req.query);

    // Query transactions where user is either sender or recipient
    const userTransactions = await db
      .select()
      .from(walletTransactions)
      .where(
        or(
          eq(walletTransactions.fromUserId, userId),
          eq(walletTransactions.toUserId, userId)
        )
      )
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return res.status(200).json({
      success: true,
      data: userTransactions,
      pagination: { limit, offset },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

export async function createWalletTransaction(req: Request, res: Response) {
  try {
    const userId = req.user?.claims?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = createTransactionSchema.parse(req.body);

    const [newTransaction] = await db
      .insert(walletTransactions)
      .values({
        fromUserId: userId,
        amount: validatedData.amount,
        type: validatedData.type,
        description: validatedData.description ?? null,
        transactionHash: validatedData.transactionHash,
        currency: validatedData.currency,
        walletAddress: validatedData.walletAddress,
        status: 'pending', // Default to pending until verified on-chain
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: newTransaction,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to create transaction' });
  }
}