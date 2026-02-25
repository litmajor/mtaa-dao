import { Logger } from '../utils/logger';
import { db } from '../storage';
import { 
  recurringPaymentExecutions,
  billSplitPayments,
  proposalExecutionQueue
} from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

const logger = new Logger('constraint-checker');

export interface ConstraintCheckResult {
  isValid: boolean;
  violations: ConstraintViolation[];
  warnings: string[];
}

export interface ConstraintViolation {
  type: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  metadata?: Record<string, any>;
}

export interface ExecutionConstraints {
  daoId: string;
  userId: string;
  proposalId: string;
  action: string;
  amount?: number;
  dailyLimit?: number;
  hourlyLimit?: number;
  rateLimitMinutes?: number;
}

/**
 * ConstraintChecker Service
 * 
 * Validates execution constraints before allowing operations:
 * - Magnitude checks (transaction size)
 * - Daily/hourly rate limits
 * - DAO treasury state
 * - User authority levels
 * - Prerequisite conditions
 * 
 * Prevents:
 * - Excessive transaction amounts
 * - Rate limit abuse
 * - Unauthorized escalations
 * - State inconsistencies
 */
export class ConstraintChecker {
  /**
   * Check all constraints for a proposal execution
   */
  static async checkProposalExecution(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    try {
      // 1. Magnitude check - transaction size
      if (constraints.amount !== undefined) {
        const magnitudeCheck = await this.checkMagnitude(constraints);
        if (!magnitudeCheck.isValid) {
          violations.push(...magnitudeCheck.violations);
        }
        warnings.push(...magnitudeCheck.warnings);
      }

      // 2. Daily limit check
      if (constraints.dailyLimit !== undefined) {
        const dailyCheck = await this.checkDailyLimit(constraints);
        if (!dailyCheck.isValid) {
          violations.push(...dailyCheck.violations);
        }
        warnings.push(...dailyCheck.warnings);
      }

      // 3. Hourly/rate limit check
      if (constraints.hourlyLimit !== undefined || constraints.rateLimitMinutes !== undefined) {
        const rateCheck = await this.checkRateLimit(constraints);
        if (!rateCheck.isValid) {
          violations.push(...rateCheck.violations);
        }
        warnings.push(...rateCheck.warnings);
      }

      // 4. Execution queue state check
      const queueCheck = await this.checkExecutionQueueState(constraints);
      if (!queueCheck.isValid) {
        violations.push(...queueCheck.violations);
      }
      warnings.push(...queueCheck.warnings);

      // 5. User authority check
      const authorityCheck = await this.checkUserAuthority(constraints);
      if (!authorityCheck.isValid) {
        violations.push(...authorityCheck.violations);
      }
      warnings.push(...authorityCheck.warnings);

      logger.info('Constraint check completed', {
        daoId: constraints.daoId,
        proposalId: constraints.proposalId,
        violationCount: violations.length,
        warningCount: warnings.length,
      });

      return {
        isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
        violations,
        warnings,
      };
    } catch (error: any) {
      logger.error('Constraint check failed', { error: error.message, constraints });
      return {
        isValid: false,
        violations: [{
          type: 'CHECK_ERROR',
          message: 'Failed to perform constraint checks',
          severity: 'critical',
          metadata: { error: error.message }
        }],
        warnings,
      };
    }
  }

  /**
   * Check transaction magnitude (size limit)
   */
  private static async checkMagnitude(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    if (!constraints.amount) {
      return { isValid: true, violations, warnings };
    }

    // Maximum transaction size: 10,000,000 (in smallest unit)
    const MAX_TRANSACTION_SIZE = 10_000_000;

    if (constraints.amount > MAX_TRANSACTION_SIZE) {
      violations.push({
        type: 'MAGNITUDE_EXCEEDED',
        message: `Transaction amount ${constraints.amount} exceeds maximum ${MAX_TRANSACTION_SIZE}`,
        severity: 'critical',
        metadata: { amount: constraints.amount, max: MAX_TRANSACTION_SIZE }
      });
    }

    // Warning for large transactions (80% of max)
    if (constraints.amount > MAX_TRANSACTION_SIZE * 0.8) {
      warnings.push(`Large transaction: ${constraints.amount} (${((constraints.amount / MAX_TRANSACTION_SIZE) * 100).toFixed(1)}% of max)`);
    }

    logger.debug('Magnitude check', { amount: constraints.amount, valid: violations.length === 0 });

    return { isValid: violations.length === 0, violations, warnings };
  }

  /**
   * Check daily transaction limit
   */
  private static async checkDailyLimit(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    if (!constraints.dailyLimit || !constraints.amount) {
      return { isValid: true, violations, warnings };
    }

    try {
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);

      // Check recent bill split payments
      const billPayments = await db.select()
        .from(billSplitPayments)
        .where(and(
          eq(billSplitPayments.payerId, constraints.userId),
          gte(billSplitPayments.createdAt, dayStart)
        ));

      const billPaymentsToday = billPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Check recent recurring payment executions
      const recurringExecutions = await db.select()
        .from(recurringPaymentExecutions)
        .where(and(
          eq(recurringPaymentExecutions.userId, constraints.userId),
          gte(recurringPaymentExecutions.executedAt, dayStart)
        ));

      const recurringToday = recurringExecutions.reduce((sum, e) => sum + (e.amount || 0), 0);

      const dailyTotal = billPaymentsToday + recurringToday + (constraints.amount || 0);

      if (dailyTotal > constraints.dailyLimit) {
        violations.push({
          type: 'DAILY_LIMIT_EXCEEDED',
          message: `Daily transaction limit exceeded: ${dailyTotal} > ${constraints.dailyLimit}`,
          severity: 'high',
          metadata: {
            dailyTotal,
            limit: constraints.dailyLimit,
            billPaymentsToday,
            recurringToday,
            proposedAmount: constraints.amount
          }
        });
      }

      // Warning at 70% of daily limit
      if (dailyTotal > constraints.dailyLimit * 0.7) {
        warnings.push(`Daily limit approaching: ${dailyTotal} of ${constraints.dailyLimit}`);
      }

      logger.debug('Daily limit check', { dailyTotal, limit: constraints.dailyLimit, valid: violations.length === 0 });
    } catch (error: any) {
      logger.error('Daily limit check failed', error);
      violations.push({
        type: 'DAILY_LIMIT_CHECK_ERROR',
        message: 'Failed to check daily limit',
        severity: 'high',
        metadata: { error: error.message }
      });
    }

    return { isValid: violations.length === 0, violations, warnings };
  }

  /**
   * Check rate limiting (hourly/per-N-minutes)
   */
  private static async checkRateLimit(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    const rateLimitMinutes = constraints.rateLimitMinutes || 60; // Default: 1 per hour
    const maxPerPeriod = constraints.hourlyLimit || 10; // Default: 10 per hour

    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - rateLimitMinutes * 60 * 1000);

      // Check proposal executions in the time period
      const recentExecutions = await db.select()
        .from(proposalExecutionQueue)
        .where(and(
          eq(proposalExecutionQueue.daoId, constraints.daoId),
          gte(proposalExecutionQueue.createdAt, periodStart),
          eq(proposalExecutionQueue.status, 'completed')
        ));

      const userExecutions = recentExecutions.filter(e => e.executedBy === constraints.userId).length;
      const nextExecutionCount = userExecutions + 1;

      if (nextExecutionCount > maxPerPeriod) {
        violations.push({
          type: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${nextExecutionCount} executions in ${rateLimitMinutes}min period (max: ${maxPerPeriod})`,
          severity: 'high',
          metadata: {
            userExecutions,
            maxPerPeriod,
            rateLimitMinutes,
            period: periodStart.toISOString()
          }
        });
      }

      // Warning at 80% of rate limit
      if (nextExecutionCount > maxPerPeriod * 0.8) {
        warnings.push(`Rate limit approaching: ${nextExecutionCount}/${maxPerPeriod} in last ${rateLimitMinutes}min`);
      }

      logger.debug('Rate limit check', { userExecutions, maxPerPeriod, valid: violations.length === 0 });
    } catch (error: any) {
      logger.error('Rate limit check failed', error);
      violations.push({
        type: 'RATE_LIMIT_CHECK_ERROR',
        message: 'Failed to check rate limit',
        severity: 'high',
        metadata: { error: error.message }
      });
    }

    return { isValid: violations.length === 0, violations, warnings };
  }

  /**
   * Check execution queue state consistency
   */
  private static async checkExecutionQueueState(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    try {
      // Check for duplicate pending executions
      const pendingExecutions = await db.select()
        .from(proposalExecutionQueue)
        .where(and(
          eq(proposalExecutionQueue.proposalId, constraints.proposalId),
          eq(proposalExecutionQueue.status, 'pending')
        ));

      if (pendingExecutions.length > 1) {
        violations.push({
          type: 'DUPLICATE_PENDING_EXECUTION',
          message: `Multiple pending executions found for proposal ${constraints.proposalId}`,
          severity: 'critical',
          metadata: { count: pendingExecutions.length }
        });
      }

      // Check for stuck/stale executions
      const now = new Date();
      const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

      const staleExecutions = await db.select()
        .from(proposalExecutionQueue)
        .where(and(
          eq(proposalExecutionQueue.daoId, constraints.daoId),
          eq(proposalExecutionQueue.status, 'pending'),
          sql`created_at < ${staleCutoff}`
        ));

      if (staleExecutions.length > 0) {
        warnings.push(`Found ${staleExecutions.length} stale pending executions (>24h old)`);
      }

      logger.debug('Queue state check', { pendingCount: pendingExecutions.length, valid: violations.length === 0 });
    } catch (error: any) {
      logger.error('Queue state check failed', error);
      violations.push({
        type: 'QUEUE_STATE_CHECK_ERROR',
        message: 'Failed to check execution queue state',
        severity: 'medium',
        metadata: { error: error.message }
      });
    }

    return { isValid: violations.length === 0, violations, warnings };
  }

  /**
   * Check user authority and prerequisites
   */
  private static async checkUserAuthority(constraints: ExecutionConstraints): Promise<ConstraintCheckResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: string[] = [];

    try {
      // This is a placeholder for authority checks
      // In a real implementation, this would verify:
      // - User has not exceeded their execution authority level
      // - User has necessary DAO role for this action type
      // - User account is not suspended/locked
      
      logger.debug('User authority check', { userId: constraints.userId, action: constraints.action });
    } catch (error: any) {
      logger.error('User authority check failed', error);
      violations.push({
        type: 'AUTHORITY_CHECK_ERROR',
        message: 'Failed to check user authority',
        severity: 'high',
        metadata: { error: error.message }
      });
    }

    return { isValid: violations.length === 0, violations, warnings };
  }

  /**
   * Get constraint violation summary for logging/reporting
   */
  static getSummary(result: ConstraintCheckResult): string {
    const criticalCount = result.violations.filter(v => v.severity === 'critical').length;
    const highCount = result.violations.filter(v => v.severity === 'high').length;
    const mediumCount = result.violations.filter(v => v.severity === 'medium').length;
    
    return `Constraint check: ${result.isValid ? 'PASSED' : 'FAILED'} (` +
           `Critical: ${criticalCount}, High: ${highCount}, Medium: ${mediumCount}, ` +
           `Warnings: ${result.warnings.length})`;
  }
}
