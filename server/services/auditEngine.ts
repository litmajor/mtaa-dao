import { db } from '../db';
import { users } from '../../shared/schema';
import { userBalances } from '../../shared/financialEnhancedSchema';
import { eq, sql, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface AuditReport {
  userId: string;
  cachedBalance: string;
  calculatedBalance: string;
  drift: number;
  isConsistent: boolean;
}

export class WalletAuditEngine {
  /**
   * Performs a comprehensive balance reconciliation for a single user account.
   * By default reconciles the `total_balance` entry for `currency` on `user_balances`.
   */
  static async auditUserWallet(userId: string, currency = 'cUSD'): Promise<AuditReport> {
    return await db.transaction(async (tx) => {
      // 1. Fetch current cached profile balance from user_balances
      const [balanceRow] = await tx
        .select({ id: userBalances.userId, total: userBalances.totalBalance })
        .from(userBalances)
        .where(
          and(
            eq(userBalances.userId, userId),
            eq(userBalances.currency, currency)
          )
        )
        .limit(1);

      if (!balanceRow) {
        throw new Error(`Audit aborted: No balance row for user ${userId} and currency ${currency}`);
      }

      // 2. Compute true balance by aggregating immutable ledger logs (wallet_ledger table)
      const ledgerRes = await tx.execute(sql`
        SELECT COALESCE(
          SUM(CASE WHEN type = 'credit' THEN amount::numeric ELSE 0 END) -
          SUM(CASE WHEN type = 'debit' THEN amount::numeric ELSE 0 END),
          0
        ) AS true_balance
        FROM wallet_ledger
        WHERE user_id = ${userId}
      `);

      const calculatedBalanceNum = Number(ledgerRes.rows?.[0]?.true_balance || 0);
      const cachedBalanceNum = Number(balanceRow.total || 0);

      const drift = Number((cachedBalanceNum - calculatedBalanceNum).toFixed(8));
      const isConsistent = Math.abs(drift) === 0;

      const report: AuditReport = {
        userId,
        cachedBalance: String(balanceRow.total),
        calculatedBalance: calculatedBalanceNum.toFixed(8),
        drift,
        isConsistent,
      };

      if (!isConsistent) {
        logger.error('[LEDGER AUDIT CRITICAL FAILURE] Financial drift detected!', { ...report, timestamp: new Date().toISOString() });
        await this.flagAccountForReview(userId, report);
      } else {
        logger.info(`[LEDGER AUDIT PASSED] Wallet balance verified for user: ${userId}`);
      }

      return report;
    });
  }

  /**
   * System-wide audit routine designed to be triggered via a nightly Cron job
   */
  static async runGlobalAudit(): Promise<{ totalAudited: number; violations: string[] }> {
    logger.info('[AUDIT START] Initiating system-wide financial ledger verification...');

    // Get distinct user ids that have balances
    const usersRes = await db.execute(sql`SELECT DISTINCT user_id FROM user_balances`);
    const userIds: string[] = usersRes.rows?.map((r: any) => r.user_id) || [];

    const violations: string[] = [];

    for (const uid of userIds) {
      try {
        const report = await this.auditUserWallet(uid);
        if (!report.isConsistent) violations.push(uid);
      } catch (error: any) {
        logger.error(`[AUDIT ERROR] Failed running reconciliation on account ${uid}`, { message: error.message });
      }
    }

    logger.info('[AUDIT COMPLETE] System reconciliation sequence concluded.', { totalAudited: userIds.length, totalViolations: violations.length });

    return { totalAudited: userIds.length, violations };
  }

  /**
   * Locks the user profile down immediately if balances are compromised
   */
  private static async flagAccountForReview(userId: string, report: AuditReport) {
    try {
      await db
        .update(users)
        .set({ isBanned: true, banReason: 'suspended_audit_failed (audit)', updatedAt: new Date() })
        .where(eq(users.id, userId));
      logger.warn(`[AUDIT SEIZURE CAPTURE] Account ${userId} has been suspended (isBanned=true) pending manual compliance review.`);
    } catch (dbError: any) {
      logger.error(`[AUDIT FREEZE FAILURE] Failed updating security state on compromised user index: ${userId}`, { error: dbError.message });
    }
  }
}

export default WalletAuditEngine;
