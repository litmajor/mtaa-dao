import express from 'express';
import type { Request, Response } from 'express';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { economicIdentity } from '../../shared/reputationSchema';
import { isAuthenticated } from '../auth';
import { ReputationService, REPUTATION_VALUES } from '../reputationService';
import { OTPService } from '../services/otpService';

const router = express.Router();

function normalizePhoneNumber(phoneNumber: unknown): string {
  if (typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    throw new Error('Invalid phone number');
  }

  const parsed = parsePhoneNumberWithError(phoneNumber, 'KE');
  if (!parsed.isValid()) {
    throw new Error('Invalid phone number');
  }

  return parsed.number;
}

/**
 * POST /api/phone-verification/request-otp
 * Generates an OTP and dispatches it via the active SMS provider (Africa's Talking / Twilio).
 */
router.post('/request-otp', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.claims?.id || (req.user as any)?.id;
    const { phoneNumber } = req.body;

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Generate and dispatch OTP via Africa's Talking / Twilio
    await OTPService.generateOTP(userId, normalizedPhone);

    res.json({ 
      message: 'OTP sent to your phone',
      expiresIn: 300 // 5 minutes
    });
  } catch (error: any) {
    console.error('[PhoneVerification] Request OTP Error:', error);
    res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
});

/**
 * POST /api/phone-verification/verify-otp
 * Verifies the submitted OTP, updates economic identity status, and awards reputation points.
 */
router.post('/verify-otp', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub || (req.user as any)?.claims?.id || (req.user as any)?.id;
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP are required' });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const isValid = await OTPService.verifyOTP(userId, normalizedPhone, otp);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Fetch existing economic identity record
    const existing = await db
      .select()
      .from(economicIdentity)
      .where(eq(economicIdentity.userId, userId));

    const now = new Date();

    if (existing.length > 0) {
      const currentMetadata = (existing[0].verificationMetadata as Record<string, any>) || {};

      await db
        .update(economicIdentity)
        .set({
          phoneNumber,
          phoneVerified: true,
          verificationMetadata: {
            ...currentMetadata,
            phoneVerifiedAt: now.toISOString()
          },
          updatedAt: now
        })
        .where(eq(economicIdentity.userId, userId));
    } else {
      await db.insert(economicIdentity).values({
        userId,
        phoneNumber,
        phoneVerified: true,
        verificationMetadata: {
          phoneVerifiedAt: now.toISOString()
        }
      });
    }

    // Award reputation points for phone verification
    await ReputationService.awardPoints(
      userId,
      'PHONE_VERIFIED',
      REPUTATION_VALUES.PHONE_VERIFIED,
      undefined,
      `Verified phone number: ${phoneNumber}`
    );

    res.json({ 
      message: 'Phone number verified successfully',
      pointsAwarded: REPUTATION_VALUES.PHONE_VERIFIED
    });
  } catch (error: any) {
    console.error('[PhoneVerification] Verify OTP Error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify OTP' });
  }
});

export default router;