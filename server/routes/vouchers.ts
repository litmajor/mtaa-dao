
import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';
import { vouchers } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const router = Router();

// Create voucher
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, token, message, expiryDays } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!amount || !token || !expiryDays) {
      return res.status(400).json({ error: 'Missing required fields: amount, token, expiryDays' });
    }

    const code = crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays as string));

    // Store voucher in database and deduct from wallet
    const user = await db.query(sql`SELECT wallet_balance FROM users WHERE id = ${userId}`);
    if (!user || user[0].wallet_balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    
    const [voucher] = await db
      .insert(vouchers)
      .values({
        code,
        createdBy: userId,
        amount: amount.toString(),
        token,
        message: message || null,
        expiryDate,
        status: 'active',
      })
      .returning();
    
    // Deduct from wallet
    await db.execute(sql`
      UPDATE users
      SET wallet_balance = wallet_balance - ${amount}
      WHERE id = ${userId}
    `);

    logger.info(`Voucher created: ${code} by ${userId} for ${amount} ${token}`);

    res.json({
      success: true,
      message: 'Voucher created successfully',
      voucher: {
        id: voucher.id,
        code: voucher.code,
        amount: voucher.amount,
        token: voucher.token,
        expiryDate: voucher.expiryDate,
        message: voucher.message,
      },
    });
  } catch (error: any) {
    logger.error('Voucher creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create voucher' });
  }
});

// Redeem voucher
router.post('/redeem', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user!.id;

    if (!code) {
      return res.status(400).json({ error: 'Voucher code is required' });
    }

    // Find voucher in database
    const foundVoucher = await db
      .select()
      .from(vouchers)
      .where(
        and(
          eq(vouchers.code, code.toUpperCase()),
          eq(vouchers.status, 'active'),
          gt(vouchers.expiryDate, new Date())
        )
      )
      .limit(1);

    if (!foundVoucher.length) {
      return res.status(400).json({ error: 'Voucher not found, expired, or already redeemed' });
    }

    const voucher = foundVoucher[0];

    // Update voucher status
    await db
      .update(vouchers)
      .set({
        redeemedBy: userId,
        redeemedAt: new Date(),
        status: 'redeemed',
      })
      .where(eq(vouchers.id, voucher.id));

    logger.info(`Voucher redeemed: ${code} by ${userId} for ${voucher.amount} ${voucher.token}`);

    // Credit wallet with voucher amount
    await db.execute(sql`
      UPDATE users
      SET wallet_balance = wallet_balance + ${parseFloat(voucher.amount)}
      WHERE id = ${userId}
    `);
    
    // Add transaction record
    await db.execute(sql`
      INSERT INTO wallet_transactions (user_id, amount, transaction_type, description, status)
      VALUES (${userId}, ${voucher.amount}, 'credit', ${'Voucher redemption: ' + code}, 'completed')
    `);

    res.json({
      success: true,
      message: 'Voucher redeemed successfully!',
      credit: {
        amount: voucher.amount,
        token: voucher.token,
      },
    });
  } catch (error: any) {
    logger.error('Voucher redemption error:', error);
    res.status(500).json({ error: error.message || 'Failed to redeem voucher' });
  }
});

// Get voucher status (public)
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const foundVoucher = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.code, code.toUpperCase()))
      .limit(1);

    if (!foundVoucher.length) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucher = foundVoucher[0];
    const isExpired = new Date() > voucher.expiryDate;
    const isRedeemed = voucher.status === 'redeemed';

    res.json({
      success: true,
      code: voucher.code,
      status: voucher.status,
      isExpired,
      isRedeemed,
      amount: isRedeemed || isExpired ? null : voucher.amount,
      token: isRedeemed || isExpired ? null : voucher.token,
      expiryDate: voucher.expiryDate,
    });
  } catch (error: any) {
    logger.error('Error checking voucher:', error);
    res.status(500).json({ error: error.message || 'Failed to check voucher' });
  }
});

export default router;
