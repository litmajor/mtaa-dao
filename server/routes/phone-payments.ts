
import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../auth';
import { otpService } from '../services/otpService';
import { tokenService } from '../services/tokenService';
import { users, walletTransactions } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const router = Router();
const logger = Logger.getLogger();

// Phone-to-wallet mapping cache
const phoneWalletCache = new Map<string, { address: string; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Link phone number to wallet
router.post('/link-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user!.claims?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate phone format
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if phone already linked
    const existingUser = await db.query.users.findFirst({
      where: eq(users.phone, normalizedPhone)
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({ error: 'Phone number already linked to another account' });
    }

    // Generate and send OTP
    const otp = await otpService.generateOTP(normalizedPhone);
    
    // Store pending phone verification
    await db.update(users)
      .set({
        phoneVerificationToken: otp,
        phoneVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      })
      .where(eq(users.id, userId));

    logger.info(`OTP sent to ${normalizedPhone} for user ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to phone',
      expiresIn: 600 // seconds
    });
  } catch (error: any) {
    logger.error('Phone linking failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP and complete phone linking
router.post('/verify-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    const userId = req.user!.claims?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    if (
      user.phoneVerificationToken !== otp ||
      !user.phoneVerificationExpiresAt ||
      new Date() > user.phoneVerificationExpiresAt
    ) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update user with verified phone
    await db.update(users)
      .set({
        phone: normalizedPhone,
        phoneVerified: true,
        isPhoneVerified: true,
        phoneVerificationToken: null,
        phoneVerificationExpiresAt: null
      })
      .where(eq(users.id, userId));

    // Cache the mapping
    if (user.walletAddress) {
      phoneWalletCache.set(normalizedPhone, {
        address: user.walletAddress,
        cachedAt: Date.now()
      });
    }

    logger.info(`Phone ${normalizedPhone} verified and linked to wallet ${user.walletAddress}`);

    res.json({ 
      success: true, 
      message: 'Phone number verified and linked',
      walletAddress: user.walletAddress
    });
  } catch (error: any) {
    logger.error('Phone verification failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Look up wallet address by phone number
async function lookupWalletByPhone(phoneNumber: string): Promise<string | null> {
  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  
  // Check cache first
  const cached = phoneWalletCache.get(normalizedPhone);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.address;
  }

  // Query database
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.phone, normalizedPhone),
      eq(users.phoneVerified, true)
    )
  });

  if (user?.walletAddress) {
    phoneWalletCache.set(normalizedPhone, {
      address: user.walletAddress,
      cachedAt: Date.now()
    });
    return user.walletAddress;
  }

  return null;
}

// Send payment via phone number
router.post('/send-to-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber, amount, currency = 'cUSD' } = req.body;
    const userId = req.user!.claims?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate inputs
    if (!phoneNumber || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid payment details' });
    }

    // Get sender wallet
    const sender = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!sender?.walletAddress) {
      return res.status(400).json({ error: 'Sender wallet not found' });
    }

    // Look up recipient wallet address
    const recipientAddress = await lookupWalletByPhone(phoneNumber);
    
    if (!recipientAddress) {
      return res.status(404).json({ 
        error: 'Phone number not registered or not verified',
        hint: 'Ask recipient to link their phone number in the app'
      });
    }

    // Execute token transfer
    const txHash = await tokenService.sendToken(
      currency,
      recipientAddress,
      amount,
      sender.walletAddress
    );

    // Record transaction
    await db.insert(walletTransactions).values({
      fromUserId: userId,
      walletAddress: recipientAddress,
      amount,
      currency,
      type: 'transfer',
      status: 'completed',
      transactionHash: txHash,
      description: `Payment to ${phoneNumber}`,
      metadata: { phonePayment: true, recipientPhone: phoneNumber }
    });

    logger.info(`Phone payment sent: ${amount} ${currency} to ${phoneNumber}`);

    res.json({ 
      success: true, 
      txHash,
      recipient: recipientAddress,
      amount,
      currency
    });
  } catch (error: any) {
    logger.error('Phone payment failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
