
import express from 'express';
import { authenticate } from '../auth';
import { daoAbusePreventionService } from '../services/daoAbusePreventionService';

const router = express.Router();

// Check if user can create a DAO
router.get('/check-eligibility', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await daoAbusePreventionService.canUserCreateDao(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add social verification to a DAO
router.post('/verify/:daoId', authenticate, async (req, res) => {
  try {
    const { daoId } = req.params;
    const verifierUserId = req.user!.id;
    const { verificationType } = req.body;

    const result = await daoAbusePreventionService.addSocialVerification({
      daoId,
      verifierUserId,
      verificationType: verificationType || 'member_invite'
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Mint DAO Identity NFT
router.post('/mint-nft/:daoId', authenticate, async (req, res) => {
  try {
    const { daoId } = req.params;
    const userId = req.user!.id;

    const result = await daoAbusePreventionService.mintDaoIdentityNft(daoId, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get DAO verification status
router.get('/status/:daoId', async (req, res) => {
  try {
    const { daoId } = req.params;
    const status = await daoAbusePreventionService.getDaoVerificationStatus(daoId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's DAO creation history
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const history = await daoAbusePreventionService.getUserDaoCreationHistory(userId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
