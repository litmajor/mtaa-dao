import type { RequestHandler } from 'express';
import { kycService } from '../services/kycService';

export const requireApprovedKyc: RequestHandler = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const verification = await kycService.getUserKYC(userId);
    if (verification?.status === 'approved') return next();

    return res.status(403).json({
      success: false,
      error: 'KYC_VERIFICATION_REQUIRED',
      message: 'Approved KYC verification is required to create a peer escrow.'
    });
  } catch (error) {
    return next(error);
  }
};
