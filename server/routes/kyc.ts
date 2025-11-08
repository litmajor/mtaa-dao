
import express from 'express';
import { kycService } from '../services/kycService';
import { db } from '../storage';
import { kycVerifications, complianceAuditLogs, suspiciousActivities } from '../../shared/kycSchema';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

// Middleware to require authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Middleware to require admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.id || req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/kyc/status - Get user's KYC status
router.get('/status', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const kyc = await kycService.getUserKYC(userId);
    const tier = await kycService.getCurrentTier(userId);

    res.json({
      success: true,
      data: {
        kyc,
        currentTier: tier,
        nextTier: getNextTier(tier.tier)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/kyc/tiers - Get available KYC tiers
router.get('/tiers', async (req, res) => {
  try {
    const { KYC_TIERS } = await import('../services/kycService');
    res.json({
      success: true,
      data: KYC_TIERS
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/basic - Submit basic KYC
router.post('/basic', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and phone are required' });
    }

    const kyc = await kycService.submitBasicKYC(userId, { email, phone });

    res.json({
      success: true,
      message: 'Basic KYC submitted. Please verify your email and phone.',
      data: kyc
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/intermediate - Submit intermediate KYC
router.post('/intermediate', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const {
      firstName,
      lastName,
      dateOfBirth,
      nationality,
      idDocumentType,
      idDocumentNumber,
      idDocumentFrontUrl,
      idDocumentBackUrl
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !nationality || !idDocumentType || !idDocumentNumber || !idDocumentFrontUrl) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const kyc = await kycService.submitIntermediateKYC(userId, {
      firstName,
      lastName,
      dateOfBirth,
      nationality,
      idDocumentType,
      idDocumentNumber,
      idDocumentFrontUrl,
      idDocumentBackUrl
    });

    res.json({
      success: true,
      message: 'Intermediate KYC submitted. Your documents are being verified.',
      data: kyc
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/advanced - Submit advanced KYC
router.post('/advanced', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const {
      address,
      city,
      state,
      postalCode,
      country,
      proofOfAddressType,
      proofOfAddressUrl
    } = req.body;

    if (!address || !city || !country || !proofOfAddressType || !proofOfAddressUrl) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const kyc = await kycService.submitAdvancedKYC(userId, {
      address,
      city,
      state,
      postalCode,
      country,
      proofOfAddressType,
      proofOfAddressUrl
    });

    res.json({
      success: true,
      message: 'Advanced KYC submitted. Your proof of address is being verified.',
      data: kyc
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/aml-screening - Perform AML screening
router.post('/aml-screening', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const result = await kycService.performAMLScreening(userId, walletAddress);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/check-limit - Check transaction limit
router.post('/check-limit', requireAuth, async (req, res) => {
  try {
  const userId = (req.user as any).id;
    const { amount, currency } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'Amount and currency are required' });
    }

    const result = await kycService.checkTransactionLimit(userId, parseFloat(amount), currency);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin routes

// GET /api/kyc/admin/pending - Get pending KYC submissions
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const pending = await db.select()
      .from(kycVerifications)
      .where(eq(kycVerifications.status, 'pending'))
      .orderBy(desc(kycVerifications.submittedAt));

    res.json({
      success: true,
      data: pending
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/admin/approve/:userId - Approve KYC
router.post('/admin/approve/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;
  const reviewerId = (req.user as any).id;

    const kyc = await kycService.approveKYC(userId, reviewerId, notes);

    res.json({
      success: true,
      message: 'KYC approved successfully',
      data: kyc
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/kyc/admin/reject/:userId - Reject KYC
router.post('/admin/reject/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
  const reviewerId = (req.user as any).id;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const kyc = await kycService.rejectKYC(userId, reviewerId, reason);

    res.json({
      success: true,
      message: 'KYC rejected',
      data: kyc
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/kyc/admin/audit-logs - Get compliance audit logs
router.get('/admin/audit-logs', requireAdmin, async (req, res) => {
  try {
    const { userId, limit = '50' } = req.query;


    const query = userId
      ? db.select().from(complianceAuditLogs).where(eq(complianceAuditLogs.userId, userId as string))
      : db.select().from(complianceAuditLogs);
    const logs = await query
      .orderBy(desc(complianceAuditLogs.createdAt))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/kyc/admin/suspicious-activities - Get suspicious activities
router.get('/admin/suspicious-activities', requireAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const activities = await db.select()
      .from(suspiciousActivities)
      .where(eq(suspiciousActivities.status, status as string))
      .orderBy(desc(suspiciousActivities.createdAt));

    res.json({
      success: true,
      data: activities
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook handlers

// POST /api/kyc/jumio/callback - Jumio verification callback
router.post('/jumio/callback', async (req, res) => {
  try {
    const { scanReference, verificationStatus, identityVerification } = req.body;

    // Find KYC by verification reference
    const [kyc] = await db.select()
      .from(kycVerifications)
      .where(eq(kycVerifications.verificationReference, scanReference))
      .limit(1);

    if (!kyc) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Update verification status
    await db.update(kycVerifications)
      .set({
        idVerificationStatus: verificationStatus,
        verificationData: req.body,
        updatedAt: new Date()
      })
      .where(eq(kycVerifications.verificationReference, scanReference));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function
function getNextTier(currentTier: string) {
  const tiers = ['none', 'basic', 'intermediate', 'advanced'];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}

export default router;
