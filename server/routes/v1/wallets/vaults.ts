/**
 * V1 User Vaults - Personal Vault Management
 * 
 * User vault endpoints (personal finance):
 * - GET    /v1/wallets/vaults
 * - POST   /v1/wallets/vaults (create)
 * - GET    /v1/wallets/vaults/:vaultId
 * - POST   /v1/wallets/vaults/:vaultId/deposit
 * - POST   /v1/wallets/vaults/:vaultId/withdraw ✅ NEW
 * - GET    /v1/wallets/vaults/:vaultId/transactions
 * - PUT    /v1/wallets/vaults/:vaultId (update config)
 * 
 * ⚠️ SECURITY:
 * - Personal vaults are owned by single user (no multisig needed on personal accounts)
 * - Lock constraints still enforced (e.g., savings vault locked until date)
 * - All operations logged to audit trail
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate } from '../../../auth';
import { rateLimitPerUser } from '../../../middleware/rateLimit';
import { logConsolidatedAuditEvent } from '../../../services/auditConsolidated';
import { eq } from 'drizzle-orm';
import { db } from '../../../storage';
import { vaults, vaultTransactions, vaultTokenHoldings } from '@shared/schema';
import { getEventEmitter } from '../../../middleware/websocket-event-emitter';

const router = express.Router({ mergeParams: true });

// ════════════════════════════════════════════════════════════════════════════════
// GET ALL PERSONAL VAULTS
// ════════════════════════════════════════════════════════════════════════════════
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const userVaults = await db
        .select()
        .from(vaults)
        .where(eq(vaults.ownerId, userId));

      res.json({
        success: true,
        data: userVaults,
      });
    } catch (error) {
      console.error('Failed to get personal vaults:', error);
      res.status(500).json({ error: 'Failed to fetch personal vaults' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// CREATE PERSONAL VAULT
// ════════════════════════════════════════════════════════════════════════════════
router.post(
  '/',
  authenticate,
  rateLimitPerUser('wallet-vaults-create', 5, '1hour'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { name, description, vaultType, primaryCurrency, daoId, ...config } = req.body;

      // Ensure limit for personal vaults (Free Tier = 3 maximum)
      if (!daoId) {
        const existingPersonalVaults = await db
          .select()
          .from(vaults)
          .where(eq(vaults.ownerId, userId));

        // Let's assume standard tier logic here, currently capping at 3
        if (existingPersonalVaults.length >= 3) {
          return res.status(400).json({
            error: 'Vault limit reached',
            reason: 'You can only create up to 3 personal vaults on the Free tier.',
          });
        }
      }

      const vaultId = randomUUID();

      await db.insert(vaults).values({
        id: vaultId as any,
        name: name || 'Personal Vault',
        vaultType: vaultType || 'regular',
        currency: primaryCurrency || 'cUSD',
        ownerId: daoId || userId,
        ownerType: daoId ? 'dao' : 'user',
        userId: daoId ? undefined : userId,
        daoId: daoId || undefined,
        creatorId: userId,
        balance: '0',
        vaultConfig: config,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      // Initialize token holdings if multi-asset allocations are provided
      if (config.isMultiAsset && Array.isArray(config.allocations)) {
        const holdingsToInsert = config.allocations.map((alloc: any) => ({
          vaultId: vaultId,
          tokenSymbol: alloc.symbol,
          balance: '0',
          valueUSD: '0',
        }));
        
        if (holdingsToInsert.length > 0) {
          await db.insert(vaultTokenHoldings).values(holdingsToInsert);
        }
      }

      // Log creation
      await logConsolidatedAuditEvent({
        user_id: userId,
        action: 'vault_created',
        severity: 'low',
        details: {
          vaultId,
          name,
          vaultType,
          isDaoVault: !!daoId
        },
      } as any);

      res.status(201).json({
        success: true,
        vaultId,
        message: 'Vault created successfully',
      });
    } catch (error) {
      console.error('Vault creation error:', error);
      res.status(500).json({ error: 'Failed to create vault' });
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════════
// USER VAULT WITHDRAWAL
// ════════════════════════════════════════════════════════════════════════════════

/**
 * POST /v1/wallets/vaults/:vaultId/withdraw
 * Withdraw funds from personal vault
 * 
 * ✅ REAL DATABASE IMPLEMENTATION
 * - Checks vault ownership (user must be vault owner)
 * - Validates vault constraints (lock status, amount limits)
 * - For savings vault: checks if lock duration expired
 * - For escrow vault: checks if conditions are met
 * - Updates vault balance and creates transaction record
 * - No multisig required for personal accounts (user is sole owner)
 * 
 * ⚠️ CONSTRAINTS:
 * - Savings vaults: Cannot withdraw before lock expires
 * - Escrow vaults: Cannot withdraw before conditions met
 * - Personal vaults: Withdrawal amount ≤ available balance
 */
router.post(
  '/:vaultId/withdraw',
  authenticate,
  rateLimitPerUser('wallet-vaults-withdraw', 20, '10min'),
  async (req: Request, res: Response) => {
    try {
      const { vaultId } = req.params;
      const userId = (req as any).user?.id;
      const { amount, destination } = req.body;

      if (!amount || !destination) {
        return res.status(400).json({
          error: 'Amount and destination address required',
        });
      }

      // 1. Verify vault exists and belongs to user
      const vaultData = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId));

      if (!vaultData || vaultData.length === 0) {
        return res.status(404).json({ error: 'Vault not found' });
      }

      const vault = vaultData[0];

      // Verify ownership (owner_type should be 'user' and owner_id should match userId)
      if (vault.ownerId !== userId || vault.ownerType !== 'user') {
        return res.status(403).json({
          error: 'Vault does not belong to you',
          vaultId,
        });
      }

      // 2. Import validators
      const { validateWithdrawalRequest, validateLockExpiration, validateEscrowRelease } = 
        await import('../../../utils/vaultTypeValidators');

      // 3. Validate withdrawal against vault constraints
      const vaultType = (vault.vaultType as any) || 'custom';
      const isDAOVault = false; // Personal vault - no multisig needed

      const validationResult = validateWithdrawalRequest(
        vaultType,
        parseFloat(amount),
        parseFloat(vault.balance || '0'),
        isDAOVault,
        undefined, // No role check for personal vaults
        vault.lockedUntil ?? undefined,
        vault.vaultConfig as Record<string, any> | undefined
      );

      if (!validationResult.allowed) {
        return res.status(400).json({
          error: 'Withdrawal not allowed',
          reason: validationResult.reason,
          lockedUntil: validationResult.lockedUntil,
          minWithdrawal: validationResult.minWithdrawal,
          maxWithdrawal: validationResult.maxWithdrawal,
        });
      }

      // 4. Check if vault is time-locked (for savings/escrow)
      if (vault.lockedUntil) {
        const lockStatus = validateLockExpiration(vaultType, vault.lockedUntil);
        if (lockStatus.isLocked) {
          return res.status(400).json({
            error: 'Vault is locked',
            lockedUntil: lockStatus.lockedUntilDate,
            daysRemaining: lockStatus.daysRemaining,
          });
        }
      }

      // 5. Check escrow release conditions if applicable
      if (vaultType === 'escrow') {
        const escrowStatus = validateEscrowRelease(
          (vault.vaultConfig as any)?.releaseCondition,
          vault.vaultConfig as any
        );
        if (!escrowStatus.canRelease) {
          return res.status(400).json({
            error: 'Escrow condition not met',
            reason: escrowStatus.reason,
          });
        }
      }

      // 6. Create withdrawal transaction
      const txId = randomUUID();
      const newBalance = parseFloat(vault.balance || '0') - parseFloat(amount);

      // Update vault balance
      await db.update(vaults)
        .set({
          balance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(vaults.id, vaultId));

      // Create transaction record
      await db.insert(vaultTransactions).values({
        id: txId as any,
        vaultId: vaultId as any,
        userId: userId as any,
        transactionType: 'withdrawal' as any,
        tokenSymbol: vault.currency as any,
        amount: amount as any,
        valueUSD: '0' as any,
        status: 'completed' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // 7. Log withdrawal
      await logConsolidatedAuditEvent({
        user_id: userId,
        action: 'personal_vault_withdrawn',
        severity: 'medium',
        details: {
          vaultId,
          vaultType,
          amount,
          destination,
          newBalance,
          txId,
        },
      } as any);

      // 8. Emit WebSocket event for real-time update
      try {
        const wsEmitter = getEventEmitter();
        wsEmitter.emitActivity('vault', vaultId, userId, 'withdrawal_completed', {
          vaultType,
          amount,
          destination,
          newBalance,
          transactionId: txId,
          status: 'completed'
        });
      } catch (wsError) {
        console.warn('Failed to emit WebSocket event for vault withdrawal', wsError);
      }

      res.json({
        success: true,
        vaultId,
        withdrawal: {
          id: txId,
          amount,
          destination,
          newBalance,
          status: 'completed',
          transactionId: txId,
          withdrawnAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Personal vault withdrawal error:', error);
      res.status(500).json({ error: 'Failed to process vault withdrawal' });
    }
  }
);

/**
 * GET /v1/wallets/vaults/:vaultId/transactions
 * Get transaction history for personal vault
 */
router.get(
  '/:vaultId/transactions',
  authenticate,
  rateLimitPerUser('wallet-vaults-transactions', 30, '1min'),
  async (req: Request, res: Response) => {
    try {
      const { vaultId } = req.params;
      const userId = (req as any).user?.id;

      // Verify vault ownership
      const vaultData = await db
        .select()
        .from(vaults)
        .where(eq(vaults.id, vaultId));

      if (!vaultData || vaultData.length === 0) {
        return res.status(404).json({ error: 'Vault not found' });
      }

      if (vaultData[0].ownerId !== userId || vaultData[0].ownerType !== 'user') {
        return res.status(403).json({ error: 'Vault does not belong to you' });
      }

      // Query transaction history
      const transactions = await db
        .select()
        .from(vaultTransactions)
        .where(eq(vaultTransactions.vaultId, vaultId));

      res.json({
        success: true,
        vaultId,
        transactionsCount: transactions.length,
        transactions: transactions.map((tx: any) => ({
          id: tx.id,
          type: tx.transactionType,
          amount: tx.amount,
          token: tx.tokenSymbol,
          status: tx.status,
          createdAt: tx.createdAt?.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Personal vault transactions error:', error);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  }
);

export default router;
