/**
 * V1 DAO Treasury - Master Router
 *
 * Composes all treasury sub-routers with security middleware:
 * - daoMembershipGuard (applied at /treasury level - all endpoints inherit)
 * - treasuryAdminGuard (applied at individual handler level as needed)
 *
 * ⚠️ CRITICAL: MtaaDAO security audit flagged "unvalidated treasury transfers"
 * All write operations protected by treasuryAdminGuard (role: admin or elder)
 * All fund movements logged with severity: 'critical'
 */

import express, { Request, Response } from 'express';
import { daoMembershipGuard } from './security';
import coreRouter from './core';
import contributionsRouter from './contributions';
import managementRouter from './management';
import intelligenceRouter from './intelligence';
import multisigRouter from './multisig';
import vaultsRouter from './vaults';

const router = express.Router({ mergeParams: true });

/**
 * MIDDLEWARE ORDERING (CRITICAL):
 * 1. daoMembershipGuard - Verify DAO exists, user authenticated, user is DAO member
 * 2. Sub-routers inherit middleware from this level
 * 3. treasuryAdminGuard applied at individual endpoint level as needed
 */
router.use(daoMembershipGuard);

/**
 * Sub-router mounts:
 * - /core: Balance, history, deposits, withdrawals, approvals
 * - /contributions: Contribution type and record management
 * - /management: Whitelist and treasury limits
 * - /intelligence: AI-powered treasury analysis
 * - /multisig: Multi-signature approval workflows
 * - /vaults: Isolated treasury sub-funds
 */
router.use('/core', coreRouter);
router.use('/contributions', contributionsRouter);
router.use('/management', managementRouter);
router.use('/intelligence', intelligenceRouter);
router.use('/multisig', multisigRouter);
router.use('/vaults', vaultsRouter);

/**
 * Health check endpoint (unprotected within DAO context)
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    daoId: (req.params as Record<string, string>).daoId,
    status: 'operational',
  });
});

export default router;
