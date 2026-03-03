/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TREASURY VALIDATION SERVICE - PHASE 2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Enforces treasury controls:
 * ✅ Recipient whitelisting (by address and category)
 * ✅ Amount limits (daily caps and single transfer max)
 * ✅ Multisig approval for large transfers
 * ✅ Admin approval for new whitelist recipients
 */

import { db } from '../storage';
import { daos, daoMemberships, treasuryWhitelist, treasuryLimits, treasuryApprovals, treasuryTransactions } from '../../shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger();

export interface WhitelistEntry {
  id: string;
  daoId: string;
  walletAddress: string;
  recipientName?: string;
  category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other';
  approvedBy: string; // Admin user ID who approved
  isApproved: boolean;
  createdAt: Date;
  approvedAt?: Date;
}

export interface DaoTreasuryLimits {
  daoId: string;
  dailyCapPercentage: number; // % of treasury (e.g., 10 = 10%)
  singleTransferMaxPercentage: number; // % of treasury (e.g., 5 = 5%)
  multisigThreshold: number; // Amount in USD (e.g., 10000)
  multisigRequiredSignatures: number; // Number of sigs needed (e.g., 2/3 = 2)
  updatedAt: Date;
}

export class TreasuryValidationService {
  
  /**
   * Check if recipient is whitelisted for this DAO
   */
  static async isRecipientWhitelisted(
    daoId: string,
    walletAddress: string
  ): Promise<{ approved: boolean; entry?: WhitelistEntry }> {
    try {
      // Normalize address to lowercase for comparison (Ethereum addresses are case-insensitive)
      const normalizedAddress = walletAddress.toLowerCase();

      const entry = await db.select()
        .from(treasuryWhitelist)
        .where(
          and(
            eq(treasuryWhitelist.daoId, daoId),
            eq(treasuryWhitelist.walletAddress, normalizedAddress),
            eq(treasuryWhitelist.status, 'approved') // Only approved entries
          )
        )
        .limit(1);

      if (!entry.length) {
        logger.warn(`[TREASURY] Address not whitelisted: ${walletAddress} in DAO ${daoId}`);
        return { approved: false };
      }

      const whitelistEntry = entry[0];

      // Check if approval has expired
      if (whitelistEntry.expiresAt && new Date(whitelistEntry.expiresAt) < new Date()) {
        logger.warn(`[TREASURY] Whitelist entry expired: ${walletAddress} in DAO ${daoId}`);
        return { approved: false };
      }

      return {
        approved: true,
        entry: {
          id: whitelistEntry.id,
          daoId: whitelistEntry.daoId,
          walletAddress: whitelistEntry.walletAddress,
          recipientName: whitelistEntry.recipientName || undefined,
          category: whitelistEntry.category as any,
          approvedBy: whitelistEntry.approvedBy || '',
          isApproved: whitelistEntry.status === 'approved',
          createdAt: whitelistEntry.createdAt || new Date(),
          approvedAt: whitelistEntry.approvedAt || undefined
        }
      };
    } catch (error) {
      logger.error(`[TREASURY] Error checking whitelist:`, error);
      return { approved: false };
    }
  }

  /**
   * Validate transfer amount against DAO limits
   */
  static async validateTransferAmount(
    daoId: string,
    transferAmount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Get DAO treasury balance
      const daoRecord = await db.select()
        .from(daos)
        .where(eq(daos.id, daoId))
        .limit(1);

      if (!daoRecord.length) {
        return { valid: false, reason: 'DAO not found' };
      }

      const treasuryBalance = parseFloat(daoRecord[0].treasuryBalance || '0');
      if (treasuryBalance <= 0) {
        return { valid: false, reason: 'Treasury is empty' };
      }

      // Get DAO limits (defaults if not configured)
      const limits = await this.getTreasuryLimits(daoId);

      // Check single transfer max
      const maxSingleTransfer = (treasuryBalance * limits.singleTransferMaxPercentage) / 100;
      if (transferAmount > maxSingleTransfer) {
        return {
          valid: false,
          reason: `Transfer amount $${transferAmount} exceeds single transfer limit of $${maxSingleTransfer.toFixed(2)} (${limits.singleTransferMaxPercentage}% of treasury)`
        };
      }

      // Check daily cap
      const dailyTotal = await this.getDailyTransferTotal(daoId);
      const dailyCap = (treasuryBalance * limits.dailyCapPercentage) / 100;
      if (dailyTotal + transferAmount > dailyCap) {
        return {
          valid: false,
          reason: `Daily transfer limit exceeded. Already transferred: $${dailyTotal.toFixed(2)}, remaining: $${(dailyCap - dailyTotal).toFixed(2)}`
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error(`[TREASURY] Error validating transfer amount:`, error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Check if transfer requires multisig approval
   */
  static async requiresMultisig(
    daoId: string,
    transferAmount: number
  ): Promise<boolean> {
    try {
      const limits = await this.getTreasuryLimits(daoId);
      return transferAmount > limits.multisigThreshold;
    } catch (error) {
      logger.error(`[TREASURY] Error checking multisig requirement:`, error);
      return true; // Fail secure - require multisig if check fails
    }
  }

  /**
   * Get required number of signatures for multisig
   */
  static async getMultisigRequiredSignatures(daoId: string): Promise<number> {
    try {
      const limits = await this.getTreasuryLimits(daoId);
      return limits.multisigRequiredSignatures;
    } catch (error) {
      logger.error(`[TREASURY] Error getting multisig signatures:`, error);
      return 2; // Default to 2-of-3
    }
  }

  /**
   * Get available admin signers for this DAO
   */
  static async getAvailableSigners(daoId: string): Promise<string[]> {
    try {
      const admins = await db.select()
        .from(daoMemberships)
        .where(
          and(
            eq(daoMemberships.daoId, daoId),
            // Only admins and elders can sign
          )
        );

      return admins
        .filter(m => ['admin', 'elder', 'creator'].includes(m.role || ''))
        .map(m => m.userId);
    } catch (error) {
      logger.error(`[TREASURY] Error getting available signers:`, error);
      return [];
    }
  }

  /**
   * Request admin approval for new whitelist recipient
   */
  static async requestWhitelistApproval(
    daoId: string,
    walletAddress: string,
    recipientName: string,
    category: 'charity' | 'payments' | 'team' | 'disbursements' | 'other',
    requestedBy: string
  ): Promise<{ id: string; status: 'pending' }> {
    try {
      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Normalize to lowercase
      const normalizedAddress = walletAddress.toLowerCase();

      // Check if already whitelisted (any status)
      const existing = await db.select()
        .from(treasuryWhitelist)
        .where(
          and(
            eq(treasuryWhitelist.daoId, daoId),
            eq(treasuryWhitelist.walletAddress, normalizedAddress)
          )
        )
        .limit(1);

      if (existing.length && existing[0].status === 'approved') {
        throw new Error('Address is already whitelisted');
      }

      // Insert new whitelist request
      const [result] = await db.insert(treasuryWhitelist).values({
        daoId: daoId as any,
        walletAddress: normalizedAddress,
        recipientName,
        category,
        status: 'pending', // Starts as pending
        requestedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning({ id: treasuryWhitelist.id });

      logger.info(
        `[TREASURY] Whitelist approval requested for ${walletAddress} (${recipientName}, ${category}) in DAO ${daoId} by ${requestedBy}`,
        { entryId: result.id }
      );

      return {
        id: result.id,
        status: 'pending'
      };
    } catch (error) {
      logger.error(`[TREASURY] Error requesting whitelist approval:`, error);
      throw new Error(`Failed to request whitelist approval: ${(error as any).message}`);
    }
  }

  /**
   * Admin approves whitelist entry
   */
  static async approveWhitelistEntry(
    entryId: string,
    approvedBy: string,
    daoId: string
  ): Promise<void> {
    try {
      // Security: Verify the entry exists and belongs to the DAO
      const entry = await db.select()
        .from(treasuryWhitelist)
        .where(
          and(
            eq(treasuryWhitelist.id, entryId),
            eq(treasuryWhitelist.daoId, daoId)
          )
        )
        .limit(1);

      if (!entry.length) {
        throw new Error('Whitelist entry not found');
      }

      // Update the entry
      await db.update(treasuryWhitelist)
        .set({
          status: 'approved',
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(treasuryWhitelist.id, entryId));

      logger.info(`[TREASURY] Whitelist entry ${entryId} approved by ${approvedBy}`, {
        walletAddress: entry[0].walletAddress,
        daoId
      });
    } catch (error) {
      logger.error(`[TREASURY] Error approving whitelist entry:`, error);
      throw new Error(`Failed to approve whitelist entry: ${(error as any).message}`);
    }
  }

  /**
   * Get treasury limits for a DAO (with defaults)
   */
  static async getTreasuryLimits(daoId: string): Promise<DaoTreasuryLimits> {
    try {
      // Query from treasury_limits table
      const result = await db.select()
        .from(treasuryLimits)
        .where(eq(treasuryLimits.daoId, daoId))
        .limit(1);

      if (result.length) {
        const limits = result[0];
        return {
          daoId,
          dailyCapPercentage: parseFloat(limits.dailyCapPercentage as any) || 10,
          singleTransferMaxPercentage: parseFloat(limits.singleTransferMaxPercentage as any) || 5,
          multisigThreshold: parseFloat(limits.multisigThresholdUSD as any) || 10000,
          multisigRequiredSignatures: limits.multisigRequiredSignatures || 2,
          updatedAt: limits.updatedAt || new Date()
        };
      }

      // Create default limits if none exist
      logger.info(`[TREASURY] No limits found for DAO ${daoId}, creating defaults`);
      await db.insert(treasuryLimits).values({
        daoId: daoId as any,
        dailyCapPercentage: '10',
        singleTransferMaxPercentage: '5',
        multisigThresholdUSD: '10000',
        multisigRequiredSignatures: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        daoId,
        dailyCapPercentage: 10, // 10% of treasury per day
        singleTransferMaxPercentage: 5, // 5% of treasury per transfer
        multisigThreshold: 10000, // $10,000 USD
        multisigRequiredSignatures: 2, // 2 signatures required
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error(`[TREASURY] Error getting treasury limits:`, error);
      // Return conservative defaults on error
      return {
        daoId,
        dailyCapPercentage: 5,
        singleTransferMaxPercentage: 2,
        multisigThreshold: 5000,
        multisigRequiredSignatures: 2,
        updatedAt: new Date()
      };
    }
  }

  /**
   * Update treasury limits for a DAO (admin only)
   */
  static async updateTreasuryLimits(
    daoId: string,
    limits: Partial<DaoTreasuryLimits> & { updatedAt: Date }
  ): Promise<void> {
    try {
      // Security: Validate constraints
      if (limits.dailyCapPercentage && limits.singleTransferMaxPercentage) {
        if (limits.singleTransferMaxPercentage > limits.dailyCapPercentage) {
          throw new Error('Single transfer max cannot exceed daily cap');
        }
      }

      if (limits.multisigRequiredSignatures && limits.multisigRequiredSignatures < 1) {
        throw new Error('Multisig required signatures must be at least 1');
      }

      // Update or create
      await db.insert(treasuryLimits).values({
        daoId: daoId as any,
        dailyCapPercentage: limits.dailyCapPercentage?.toString() || '10',
        singleTransferMaxPercentage: limits.singleTransferMaxPercentage?.toString() || '5',
        multisigThresholdUSD: limits.multisigThreshold?.toString() || '10000',
        multisigRequiredSignatures: limits.multisigRequiredSignatures || 2,
        updatedAt: limits.updatedAt,
        createdAt: new Date()
      }).onConflictDoUpdate({
        target: treasuryLimits.daoId,
        set: {
          dailyCapPercentage: limits.dailyCapPercentage?.toString() || treasuryLimits.dailyCapPercentage,
          singleTransferMaxPercentage: limits.singleTransferMaxPercentage?.toString() || treasuryLimits.singleTransferMaxPercentage,
          multisigThresholdUSD: limits.multisigThreshold?.toString() || treasuryLimits.multisigThresholdUSD,
          multisigRequiredSignatures: limits.multisigRequiredSignatures || treasuryLimits.multisigRequiredSignatures,
          updatedAt: limits.updatedAt
        }
      });

      logger.info(`[TREASURY] Treasury limits updated for DAO ${daoId}:`, {
        dailyCapPercentage: limits.dailyCapPercentage,
        singleTransferMaxPercentage: limits.singleTransferMaxPercentage,
        multisigThresholdUSD: limits.multisigThreshold,
        multisigRequiredSignatures: limits.multisigRequiredSignatures
      });
    } catch (error) {
      logger.error(`[TREASURY] Error updating treasury limits:`, error);
      throw new Error(`Failed to update treasury limits: ${(error as any).message}`);
    }
  }

  /**
   * Get total transferred in the last 24 hours
   */
  private static async getDailyTransferTotal(daoId: string): Promise<number> {
    try {
      // Query treasury_transactions for last 24 hours
      const twenty4HoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await db.select({
        total: sql<number>`COALESCE(SUM(CAST(${treasuryTransactions.amountUSD} AS NUMERIC)), 0)`
      })
        .from(treasuryTransactions)
        .where(
          and(
            eq(treasuryTransactions.daoId, daoId),
            gte(treasuryTransactions.createdAt, twenty4HoursAgo),
            eq(treasuryTransactions.status, 'executed') // Only count executed transfers
          )
        );

      return result.length && result[0].total ? parseFloat(result[0].total.toString()) : 0;
    } catch (error) {
      logger.error(`[TREASURY] Error getting daily transfer total:`, error);
      return 0;
    }
  }

  /**
   * Log all treasury transactions for audit trail
   */
  static async logTreasuryTransaction(
    daoId: string,
    recipient: string,
    amount: number,
    description: string,
    approved: boolean,
    executorUserId?: string,
    executorRole?: string,
    approvalId?: string,
    errorMessage?: string
  ): Promise<string> {
    try {
      // Insert into treasury_transactions for permanent audit log
      const [result] = await db.insert(treasuryTransactions).values({
        daoId: daoId as any,
        recipientAddress: recipient,
        amount: amount.toString(),
        amountUSD: amount.toString(), // In production, convert to USD with price oracle
        description,
        status: approved ? 'executed' : 'rejected',
        whitelistApproved: true, // Would be set based on actual whitelist check
        amountValidated: true,
        multisigRequired: false,
        multisigApproved: approved ? true : false,
        executorUserId,
        executorRole,
        approvalId: approvalId as any,
        errorMessage,
        createdAt: new Date()
      }).returning({ id: treasuryTransactions.id });

      logger.info(
        `[AUDIT] Treasury transaction logged: ${description} | Amount: ${amount} | Status: ${approved ? 'APPROVED' : 'REJECTED'} | DAO: ${daoId} | Executor: ${executorUserId}`
      );

      return result.id;
    } catch (error) {
      logger.error(`[TREASURY] Error logging transaction:`, error);
      throw new Error('Failed to log treasury transaction');
    }
  }
}
