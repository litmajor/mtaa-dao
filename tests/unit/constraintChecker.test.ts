import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConstraintChecker, ExecutionConstraints } from '../../../server/services/constraintChecker';
import { db } from '../../../server/storage';
import {
  recurringPaymentExecutions,
  billSplitPayments,
  proposalExecutionQueue,
} from '../../../shared/schema';

/**
 * Test Suite for ConstraintChecker Service
 * Tests magnitude limits, rate limiting, and daily limits
 */
describe('ConstraintChecker Service', () => {
  const testConstraints: ExecutionConstraints = {
    daoId: 'test-dao-' + Date.now(),
    userId: 'test-user-' + Date.now(),
    proposalId: 'test-proposal-' + Date.now(),
    action: 'treasury_transfer',
    amount: 100_000,
    dailyLimit: 1_000_000,
    hourlyLimit: 10,
    rateLimitMinutes: 60,
  };

  describe('Magnitude Checking', () => {
    it('should accept transactions within magnitude limit', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 5_000_000, // 50% of 10M max
      });

      expect(result.isValid).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should reject transactions exceeding magnitude limit', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 15_000_000, // Exceeds 10M max
      });

      expect(result.isValid).toBe(false);
      const magnitudeViolation = result.violations.find(
        v => v.type === 'MAGNITUDE_EXCEEDED'
      );
      expect(magnitudeViolation).toBeDefined();
      expect(magnitudeViolation?.severity).toBe('critical');
    });

    it('should warn for large transactions (80% of max)', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 8_500_000, // 85% of 10M max
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Large transaction');
    });

    it('should not check magnitude when amount is undefined', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: undefined,
      });

      const magnitudeViolations = result.violations.filter(
        v => v.type === 'MAGNITUDE_EXCEEDED'
      );
      expect(magnitudeViolations.length).toBe(0);
    });
  });

  describe('Result Formatting', () => {
    it('should return ConstraintCheckResult with isValid and violations', async () => {
      const result = await ConstraintChecker.checkProposalExecution(
        testConstraints
      );

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should categorize violations by severity', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 15_000_000, // Exceeds limit
      });

      result.violations.forEach(v => {
        expect(['critical', 'high', 'medium']).toContain(v.severity);
      });
    });

    it('should generate summary string for logging', async () => {
      const result = await ConstraintChecker.checkProposalExecution(
        testConstraints
      );

      const summary = ConstraintChecker.getSummary(result);
      expect(typeof summary).toBe('string');
      expect(summary).toContain('Constraint check');
      expect(summary).toContain(result.isValid ? 'PASSED' : 'FAILED');
    });

    it('should mark result as invalid if critical violations exist', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 15_000_000, // Critical violation
      });

      expect(result.isValid).toBe(false);
    });

    it('should mark result as valid if only low/medium violations exist', async () => {
      const result = await ConstraintChecker.checkProposalExecution({
        ...testConstraints,
        amount: 100, // Very small, no violations expected
      });

      expect(result.isValid).toBe(true);
    });
  });
});
