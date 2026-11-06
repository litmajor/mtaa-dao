import { db } from '../db';
import { users } from '../../shared/schema';
import { accounts } from '@shared/accountSchema';
import { eq, sql, and } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { Decimal } from 'decimal.js';

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
   * Audits the account balance projection against the canonical platform journal.
   */
  static async auditUserWallet(userId: string, currency = 'cUSD'): Promise<AuditReport> {
    return await db.transaction(async (tx) => {
      const accountRows = await tx
        .select({ id: accounts.id, balance: accounts.balance })
        .from(accounts)
        .where(and(
          eq(accounts.userId, userId),
          eq(accounts.currency, currency),
          eq(accounts.status, 'active'),
        ));

      if (accountRows.length === 0) {
        throw new Error(`Audit aborted: No account for user ${userId} and currency ${currency}`);
      }

      // Only customer-owned account entries count; platform balancing accounts do not.
      const ledgerRes = await tx.execute(sql`
        SELECT COALESCE(
          SUM(CASE WHEN entry.side = 'credit' THEN entry.amount ELSE -entry.amount END),
          0
        ) AS true_balance
        FROM platform_ledger_accounts ledger_account
        JOIN platform_ledger_entries entry
          ON entry.ledger_account_id = ledger_account.id
        JOIN accounts account
          ON account.id = ledger_account.account_id
        WHERE account.user_id = ${userId}
          AND account.currency = ${currency}
          AND account.status = 'active'
      `);

      const calculatedBalance = new Decimal(String(ledgerRes.rows?.[0]?.true_balance ?? 0));
      const cachedBalance = accountRows.reduce(
        (total, account) => total.plus(account.balance ?? 0),
        new Decimal(0),
      );
      const driftDecimal = cachedBalance.minus(calculatedBalance);
      const drift = driftDecimal.toNumber();
      const isConsistent = driftDecimal.isZero();

      const report: AuditReport = {
        userId,
        cachedBalance: cachedBalance.toFixed(8),
        calculatedBalance: calculatedBalance.toFixed(8),
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
    const usersRes = await db.execute(sql`
      SELECT DISTINCT user_id
      FROM accounts
      WHERE currency = 'cUSD' AND status = 'active'
    `);
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
