
import express, { Request, Response } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { economicIdentity } from '../../shared/reputationSchema';
import { isAuthenticated } from '../auth';
import { ReputationService, REPUTATION_VALUES } from '../reputationService';
import { otpService } from '../services/otpService';

const router = express.Router();

// Request phone verification OTP
router.post('/request-otp', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber || !/^\+254\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Valid Kenyan phone number required (+254...)' });
    }

    // Generate and send OTP via SMS
    const otp = await otpService.storeOTP(phoneNumber, '');
    
    // TODO: Integrate with Africa's Talking or Twilio to send SMS
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    res.json({ 
      message: 'OTP sent to your phone',
      expiresIn: 300 // 5 minutes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify phone with OTP
router.post('/verify-otp', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).claims?.sub || (req.user as any).claims?.id;
    const { phoneNumber, otp } = req.body;

    const result = await otpService.verifyOTP(phoneNumber, otp);
    const isValid = result.valid;

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update economic identity with verified phone
    const existing = await db.select().from(economicIdentity).where(eq(economicIdentity.userId, userId));

    if (existing.length > 0) {
      await db.update(economicIdentity)
        .set({
          phoneNumber,
          phoneVerified: true,
          verificationMetadata: { phoneVerifiedAt: new Date() },
          updatedAt: new Date()
        })
        .where(eq(economicIdentity.userId, userId));
    } else {
      await db.insert(economicIdentity).values({
        userId,
        phoneNumber,
        phoneVerified: true,
        verificationMetadata: { phoneVerifiedAt: new Date() }
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
    res.status(500).json({ error: error.message });
  }
});

export default router;
