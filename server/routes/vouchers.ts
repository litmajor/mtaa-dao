
import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';
import crypto from 'crypto';

const router = Router();

// Create voucher
router.post('/', authenticate, async (req, res) => {
  try {
    const { amount, token, message, expiryDays } = req.body;
    const userId = req.user!.id;

    const code = crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));

    const voucher = {
      id: crypto.randomUUID(),
      code,
      userId,
      amount,
      token,
      message,
      expiryDate: expiryDate.toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // TODO: Store in database and deduct from wallet
    res.json({ success: true, voucher });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Redeem voucher
router.post('/redeem', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user!.id;

    // TODO: Verify code, check expiry, credit wallet
    res.json({ success: true, amount: '100', token: 'cUSD' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
