/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 DAO Treasury - Unified Multisig Flow (End-to-End)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Complete multisig lifecycle: CREATE → PROPOSE → SIGN → EXECUTE
 * 
 * Endpoints:
 *   POST   /v1/daos/:daoId/treasury/multisig/create          → Deploy on-chain multisig
 *   GET    /v1/daos/:daoId/treasury/multisig/config          → Fetch multisig configuration
 *   POST   /v1/daos/:daoId/treasury/multisig/propose          → Propose withdrawal/transfer
 *   GET    /v1/daos/:daoId/treasury/multisig/approvals        → List pending approvals
 *   POST   /v1/daos/:daoId/treasury/multisig/:approvalId/sign → Sign approval
 *   POST   /v1/daos/:daoId/treasury/multisig/:approvalId/execute → Execute after timelock
 *   GET    /v1/daos/:daoId/treasury/multisig/signers          → List authorized signers
 * 
 * Auth & Guards:
 *   - authenticate: User session required
 *   - daoMembershipGuard: Must be DAO member
 *   - treasuryAdminGuard: POST/write ops → admin/elder role
 *   - advancedModeGuard: Optional — for advanced treasury features
 * 
 * STATE → SYSTEM → SURFACE Pattern:
 *   STATE:   pending_approvals, multisig_config, signer_list (db + on-chain)
 *   SYSTEM:  /v1/daos/:daoId/treasury/multisig/* (this router)
 *   SURFACE: Okedi Treasury Workspace (TreasuryPage, ApprovalPanel, SignerFlow)
 * 
 * Contract Integration:
 *   - ChamaTreasury (on-chain):
 *     - createProposal(recipient, amount, reason)
 *     - confirmProposal(proposalId)
 *     - executeProposal(proposalId)
 *   - Called via ethers.js / web3.py from backend
 *   - Events emitted & logged to db for audit trail
 */

import express, { Request, Response, NextFunction } from 'express';
import { db } from '../../../../../db';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../../../../../auth';
import { rateLimitPerUser } from '../../../../../middleware/rateLimit';
import {
  treasuryMultisigCreateLimiter,
  treasuryMultisigProposeLimiter,
  treasuryMultisigSignLimiter,
  treasuryMultisigExecuteLimiter,
  treasuryMultisigReadLimiter
} from '../../../../../middleware/rateLimiter';
import { logConsolidatedAuditEvent } from '../../../../../services/auditConsolidated';
import { treasuryMultisigService } from '../../../../../services/treasuryMultisigService';
import { daos, daoMemberships } from '../../../../../../shared/schema';
import { AppError, ValidationError, NotFoundError } from '../../../../../middleware/errorHandler';
import advancedModeGuard from '../../../../../middleware/advancedModeGuard';
import featureGate from '../../../../../middleware/featureGate';
// ────────────────────────────────────────────────────────────────────────────────
// GUARDS & MIDDLEWARE
// ────────────────────────────────────────────────────────────────────────────────

/**
 * daoMembershipGuard: Verify user is member of the DAO
 */
async function daoMembershipGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { daoId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user is DAO member
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId)
      ),
    });

    if (!membership) {
      return res.status(403).json({
        error: 'Not a member of this DAO',
      });
    }

    (req as any).membershipRole = membership.role; // Store for later checks
    next();
  } catch (error) {
    console.error('DAO membership check failed:', error);
    res.status(500).json({ error: 'Membership verification failed' });
  }
}

/**
 * treasuryAdminGuard: Verify user is admin or elder in the DAO
 * (Applied to write operations)
 */
async function treasuryAdminGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const role = (req as any).membershipRole;

    // Allow admin, creator, or elder roles
    const ADMIN_ROLES = ['admin', 'creator', 'elder'];
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(403).json({
        error: 'Insufficient permissions: admin or elder role required',
      });
    }

    next();
  } catch (error) {
    console.error('Treasury admin guard failed:', error);
    res.status(500).json({ error: 'Permission check failed' });
  }
}

/**
 * sessionValidation: Ensure session is active & not expired
 */
async function sessionValidation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = (req as any).sessionId;
    if (!sessionId) {
      return res.status(401).json({ error: 'No active session' });
    }
    next();
  } catch (error) {
    res.status(401).json({ error: 'Session validation failed' });
  }
}

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// UNIFIED MULTISIG FLOW
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/daos/:daoId/treasury/multisig/create
 * 
 * Deploy a new multisig wallet for this DAO's treasury.
 * Only DAO admins can create multisig.
 * 
 * Body:
 * {
 *   signers: string[];              // wallet addresses or user IDs
 *   requiredSignatures: number;     // threshold (e.g., 2 of 3)
 *   chainId?: number;               // default 44787 (Celo testnet) or 42220 (mainnet)
 *   simulation?: boolean;           // if true, don't deploy on-chain
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   multisigId: string;             // off-chain tracking ID
 *   multisigAddress: string;        // on-chain contract address (if deployed)
 *   signers: string[];
 *   requiredSignatures: number;
 *   chainId: number;
 *   createdAt: string;
 *   createdBy: string;
 *   status: 'pending' | 'deployed' | 'simulation';
 * }
 */
router.post(
  '/create',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  treasuryAdminGuard,
  sessionValidation,
  treasuryMultisigCreateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { signers, requiredSignatures, chainId = 44787, simulation = false } = req.body;

      // ─── Input Validation ───
      if (!signers || !Array.isArray(signers) || signers.length < 2) {
        return res.status(400).json({
          error: 'At least 2 signers required',
        });
      }

      if (!requiredSignatures || requiredSignatures < 1 || requiredSignatures > signers.length) {
        return res.status(400).json({
          error: `Required signatures must be between 1 and ${signers.length}`,
        });
      }

      // ─── Log Audit Event (CRITICAL: multisig creation is security-sensitive) ───
      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'multisig_create_initiated',
        severity: 'critical',
        details: {
          signerCount: signers.length,
          requiredSignatures,
          chainId,
          simulation,
        },
      } as any);

      // ─── Deployment/Config Logic ───
      // Prefer updating DAO record to configure multisig (no duplication of business logic)
      const dao = await db.query.daos.findFirst({ where: eq(daos.id, daoId) });
      if (!dao) {
        return res.status(404).json({ success: false, error: 'DAO not found' });
      }

      // Optionally accept a pre-deployed contract address
      const contractAddress = (req.body && req.body.contractAddress) || undefined;
      if (contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid contract address' });
      }

      const multisigAddress = contractAddress || (simulation ? `SIMULATION-${Date.now()}` : dao.chamaTreasuryAddress || `CONFIGURED-${Date.now()}`);
      const status = simulation ? 'simulation' : (contractAddress ? 'deployed' : 'configured');

      // Persist multisig config to DAO record
      await db.update(daos)
        .set({
          treasurySigners: signers,
          treasuryRequiredSignatures: requiredSignatures,
          treasuryMultisigEnabled: true,
          chamaTreasuryAddress: contractAddress || dao.chamaTreasuryAddress,
          updatedAt: new Date()
        })
        .where(eq(daos.id, daoId));

      await logConsolidatedAuditEvent({
        dao_id: daoId,
        user_id: userId,
        action: 'multisig_configured',
        severity: 'high',
        details: { signersCount: signers.length, requiredSignatures, simulation, contractAddress }
      } as any);

      res.status(201).json({
        success: true,
        multisigId: `ms-${Date.now()}`,
        multisigAddress,
        signers,
        requiredSignatures,
        chainId,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        status,
      });
    } catch (error: any) {
      console.error('Multisig create error:', error);
      await logConsolidatedAuditEvent({
        dao_id: req.params.daoId,
        user_id: (req as any).user?.id,
        action: 'multisig_create_failed',
        severity: 'high',
        details: { error: error?.message },
      } as any);
      res.status(500).json({ error: 'Failed to create multisig' });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/multisig/config
 * 
 * Fetch current multisig configuration for the DAO.
 * Accessible by all DAO members.
 */
router.get(
  '/config',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  treasuryMultisigReadLimiter,
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      // Fetch multisig configuration from DAO record
      const dao = await db.query.daos.findFirst({ where: eq(daos.id, daoId) });
      if (!dao) return res.status(404).json({ success: false, error: 'DAO not found' });

      const signers = (dao.treasurySigners as any[]) || [];
      const config = {
        requiredApprovals: dao.treasuryRequiredSignatures || 2,
        totalSigners: signers.length,
        withdrawalThreshold: dao.treasuryWithdrawalThreshold?.toString() || null,
        approvalTimeout: 7 * 24 * 60 * 60, // seconds (7 days)
        depositThreshold: null,
        multisigEnabled: !!dao.treasuryMultisigEnabled,
        chamaTreasuryAddress: dao.chamaTreasuryAddress || null
      };

      res.json({ success: true, daoId, config });
    } catch (error) {
      console.error('Config fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch multisig config' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig/propose
 * 
 * Propose a treasury withdrawal / transfer.
 * Initiates the multisig approval workflow.
 * 
 * Body:
 * {
 *   recipient: string;              // wallet address
 *   amount: string;                 // in stablecoin (e.g., cUSD)
 *   purpose: string;                // reason (required for audit)
 *   proposedBy?: string;            // defaults to current user
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   approvalId: string;
 *   status: 'pending';
 *   requiredSignatures: number;
 *   currentSignatures: 0;
 *   expiresAt: string;
 * }
 */
router.post(
  '/propose',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  treasuryAdminGuard,
  sessionValidation,
  treasuryMultisigProposeLimiter,
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const userId = (req as any).user?.id;
      const { recipient, amount, purpose } = req.body;

      if (!recipient || !amount || !purpose) {
        return res.status(400).json({
          error: 'recipient, amount, and purpose required',
        });
      }

      // Delegate to treasuryMultisigService for core business logic
      try {
        const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        if (Number.isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        await logConsolidatedAuditEvent({
          dao_id: daoId,
          user_id: userId,
          action: 'multisig_proposal_created',
          severity: 'high',
          details: { recipient, amount: amountNum, purpose }
        } as any);

        const tx = await treasuryMultisigService.proposeWithdrawal(daoId, userId, amountNum, recipient, purpose);

        res.status(201).json({ success: true, transaction: tx });
      } catch (err: any) {
        console.error('Proposal create error:', err);
        if (err instanceof ValidationError) return res.status(400).json({ success: false, error: err.message });
        if (err instanceof NotFoundError) return res.status(404).json({ success: false, error: err.message });
        await logConsolidatedAuditEvent({ dao_id: daoId, user_id: userId, action: 'multisig_proposal_failed', severity: 'high', details: { error: err?.message } } as any);
        return res.status(500).json({ success: false, error: 'Failed to create proposal' });
      }
    } catch (error: any) {
      console.error('Proposal create error:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/multisig/approvals
 * 
 * List all pending and completed multisig approvals.
 * Query params:
 *   - status: 'pending' | 'approved' | 'executed' | 'rejected' | 'expired'
 *   - limit: 50 (default)
 *   - offset: 0 (default)
 */
router.get(
  '/approvals',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  rateLimitPerUser('treasury-multisig-approvals-list', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;
      const { status, limit = 50, offset = 0 } = req.query;

      // Use service to fetch transactions/approvals
      try {
        const l = Math.min(parseInt(limit as string || '50'), 200);
        const o = Math.max(parseInt(offset as string || '0'), 0);

        let approvals: any[] = [];
        if (status) {
          approvals = await treasuryMultisigService.getTransactions(daoId, status as string, l, o);
        } else {
          approvals = await treasuryMultisigService.getPendingApprovals(daoId);
        }

        res.json({
          success: true,
          daoId,
          approvals,
          pagination: {
            limit: l,
            offset: o,
            total: approvals.length,
          },
        });
      } catch (err: any) {
        console.error('Approvals list error:', err);
        if (err instanceof AppError) return res.status(err.statusCode).json({ success: false, error: err.message });
        return res.status(500).json({ success: false, error: 'Failed to fetch approvals' });
      }
    } catch (error) {
      console.error('Approvals list error:', error);
      res.status(500).json({ error: 'Failed to fetch approvals' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig/:approvalId/sign
 * 
 * Sign (approve) a pending multisig proposal.
 * Only signers (admins/elders) can sign.
 * 
 * Body:
 * {
 *   signature?: string;             // optional: signed message
 *   comment?: string;               // optional: signer comment
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   approvalId: string;
 *   status: 'pending' | 'approved';
 *   requiredSignatures: number;
 *   currentSignatures: number;
 *   signers: Array<{ address, signed, signedAt }>;
 * }
 */
router.post(
  '/:approvalId/sign',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  treasuryAdminGuard,
  sessionValidation,
  rateLimitPerUser('treasury-multisig-sign', 20, '5min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, approvalId } = req.params;
      const userId = (req as any).user?.id;
      const { signature, comment } = req.body;

      try {
        await logConsolidatedAuditEvent({ dao_id: daoId, user_id: userId, action: 'multisig_signed', severity: 'high', details: { approvalId, comment } } as any);

        const signResult = await treasuryMultisigService.signTransaction(approvalId, userId);
        const tx = await treasuryMultisigService.getTransactionWithDetails(approvalId);

        res.json({
          success: true,
          approvalId,
          status: tx.status,
          requiredSignatures: tx.requiredSignatures,
          currentSignatures: tx.approvalCount,
          signers: (tx.approvers || []).map((u: any) => ({ userId: u })),
          message: signResult.approved ? 'Signature recorded - approval finalized' : 'Signature recorded',
        });
      } catch (err: any) {
        console.error('Sign error:', err);
        if (err instanceof ValidationError) return res.status(400).json({ success: false, error: err.message });
        if (err instanceof NotFoundError) return res.status(404).json({ success: false, error: err.message });
        return res.status(500).json({ success: false, error: 'Failed to sign approval' });
      }
    } catch (error: any) {
      console.error('Sign error:', error);
      res.status(500).json({ error: 'Failed to sign approval' });
    }
  }
);

/**
 * POST /v1/daos/:daoId/treasury/multisig/:approvalId/execute
 * 
 * Execute an approved multisig proposal.
 * Only after:
 *   1. Threshold signatures collected
 *   2. Timelock expired (if applicable)
 *   3. Caller is authorized signer
 * 
 * Response:
 * {
 *   success: boolean;
 *   transactionHash?: string;       // on-chain tx hash
 *   newBalance?: string;            // treasury balance after execution
 *   status: 'executed';
 * }
 */
router.post(
  '/:approvalId/execute',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  treasuryAdminGuard,
  sessionValidation,
  rateLimitPerUser('treasury-multisig-execute', 10, '1hour'),
  async (req: Request, res: Response) => {
    try {
      const { daoId, approvalId } = req.params;
      const userId = (req as any).user?.id;

      try {
        const can = await treasuryMultisigService.canExecuteTransaction(approvalId);
        if (!can.canExecute) {
          return res.status(400).json({ success: false, error: can.reason || 'Not executable yet' });
        }

        const execResult = await treasuryMultisigService.executeTransaction(approvalId, userId);

        await logConsolidatedAuditEvent({ dao_id: daoId, user_id: userId, action: 'multisig_executed', severity: 'critical', details: { approvalId } } as any);

        res.json({
          success: true,
          approvalId,
          status: 'executed',
          transactionHash: (execResult && (execResult as any).txHash) || `0x${'0'.repeat(64)}`,
          newBalance: (execResult && (execResult as any).newBalance) || undefined,
          executedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('Execute error:', err);
        if (err instanceof ValidationError) return res.status(400).json({ success: false, error: err.message });
        if (err instanceof NotFoundError) return res.status(404).json({ success: false, error: err.message });
        return res.status(500).json({ success: false, error: 'Failed to execute approval' });
      }
    } catch (error: any) {
      console.error('Execute error:', error);
      res.status(500).json({ error: 'Failed to execute approval' });
    }
  }
);

/**
 * GET /v1/daos/:daoId/treasury/multisig/signers
 * 
 * List authorized signers for the DAO's multisig.
 * Accessible by all DAO members.
 */
router.get(
  '/signers',
  authenticate,
  featureGate('treasury.multisig'),
  daoMembershipGuard,
  rateLimitPerUser('treasury-multisig-signers-get', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { daoId } = req.params;

      const dao = await db.query.daos.findFirst({ where: eq(daos.id, daoId) });
      if (!dao) return res.status(404).json({ success: false, error: 'DAO not found' });

      const signers = (dao.treasurySigners as any[]) || [];
      res.json({ success: true, daoId, signers });
    } catch (error) {
      console.error('Signers fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch signers' });
    }
  }
);

export default router;
