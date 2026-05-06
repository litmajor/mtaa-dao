/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Abuse Prevention Router
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DAO-scoped abuse prevention and verification:
 * - Social verification (member invites)
 * - DAO creation eligibility checks
 * - DAO identity NFT minting
 * - Verification status tracking
 * - DAO creation history
 *
 * Base Path: /api/v1/daos/:daoId/abuse
 * Parent ensures: isAuthenticated, validateDaoId
 *
 * Migration Source: /api/dao-abuse-prevention/*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, Router } from 'express';
import { daoAbusePreventionService } from '../../../../services/daoAbusePreventionService';
import { logger } from '../../../../utils/logger';

const router: Router = express.Router({ mergeParams: true });

// Helper to get daoId from params
function getDaoId(req: Request): string {
  return (req as any).params?.daoId || '';
}

// Helper to get userId from request
function getUserId(req: Request): string | null {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
}

// ════════════════════════════════════════════════════════════════════════════════
// ELIGIBILITY & STATUS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/daos/:daoId/abuse/eligibility
 * Check if user can create a DAO
 */
router.get('/eligibility', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await daoAbusePreventionService.canUserCreateDao(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error checking DAO creation eligibility:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/abuse/status
 * Get DAO verification status
 */
router.get('/status', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  try {
    const status = await daoAbusePreventionService.getDaoVerificationStatus(daoId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error(`Error fetching DAO verification status for ${daoId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/daos/:daoId/abuse/history
 * Get user's DAO creation history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const history = await daoAbusePreventionService.getUserDaoCreationHistory(userId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error('Error fetching DAO creation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// VERIFICATION & NFT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/daos/:daoId/abuse/verify
 * Add social verification to a DAO
 */
router.post('/verify', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  try {
    const verifierUserId = getUserId(req);
    
    if (!verifierUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { verificationType = 'member_invite' } = req.body;

    const result = await daoAbusePreventionService.addSocialVerification({
      daoId,
      verifierUserId,
      verificationType
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error verifying DAO ${daoId}:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/daos/:daoId/abuse/mint-nft
 * Mint DAO Identity NFT
 */
router.post('/mint-nft', async (req: Request, res: Response) => {
  const daoId = getDaoId(req);
  const userId = getUserId(req);
  
  try {
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await daoAbusePreventionService.mintDaoIdentityNft(daoId, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error minting DAO identity NFT for ${daoId}:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
