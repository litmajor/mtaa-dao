import express from 'express';
import { authenticate } from '../../auth';
import { db } from '../../db';
import { users, userKyc } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get advanced mode status and basic security flags
router.get('/advanced-mode', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const row = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row || !row[0]) return res.status(404).json({ success: false, error: 'User not found' });
    const user = row[0];

    // KYC status lookup (if exists)
    const kycRow = await db.select().from(userKyc).where(eq(userKyc.userId, userId)).limit(1);
    const kycStatus = kycRow && kycRow[0] ? (kycRow[0] as any).verificationStatus : 'not-started';

    res.json({
      success: true,
      data: {
        advancedMode: !!user.advancedMode,
        twoFactorEnabled: !!user.twoFactorEnabled,
        twoFactorVerifiedAt: user.twoFactorVerifiedAt || null,
        kycStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Toggle advanced mode (persist)
router.post('/advanced-mode', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const enabled = Boolean(req.body?.enabled);

    const [updated] = await db.update(users).set({ advancedMode: enabled, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    res.json({ success: true, data: { advancedMode: !!updated.advancedMode } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// 2FA quick-check endpoint: returns whether user can proceed with sensitive ops
router.post('/2fa/check', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const row = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row || !row[0]) return res.status(404).json({ success: false, error: 'User not found' });
    const user = row[0];

    if (!user.twoFactorEnabled) return res.status(403).json({ success: false, error: '2FA not enabled' });

    // For now, require twoFactorVerifiedAt to be present and recent (60 minutes)
    const verifiedAt = user.twoFactorVerifiedAt ? new Date(user.twoFactorVerifiedAt) : null;
    const now = new Date();
    const recent = verifiedAt && now.getTime() - verifiedAt.getTime() < 60 * 60 * 1000;

    if (!recent) return res.status(403).json({ success: false, error: '2FA verification required' });

    res.json({ success: true, data: { verified: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
