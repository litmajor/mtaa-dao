import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  daoContributionApprovals,
  daoContributions,
  daoRotationCycles,
  insertReferralRewardSchema,
  insertTaskSchema,
  insertUserSchema,
} from '../schema';

describe('shared schema validation', () => {
  it('accepts a well-formed user insert and rejects injected extra fields', () => {
    const valid = insertUserSchema.safeParse({
      id: 'user-1',
      password: 'hashed-secret',
      email: 'user@example.com',
    });

    const malicious = insertUserSchema.safeParse({
      id: 'user-1',
      password: 'hashed-secret',
      email: 'user@example.com',
      role: 'admin',
    });

    expect(valid.success).toBe(true);
    expect(malicious.success).toBe(false);
  });

  it('rejects malformed task payloads before they reach persistence logic', () => {
    const invalid = insertTaskSchema.safeParse({
      daoId: 'dao-1',
      creatorId: 'user-1',
      title: 'Ship feature',
      description: 'Needs a real reward',
      reward: 'not-a-number',
      category: 'engineering',
      difficulty: 'hard',
    });

    expect(invalid.success).toBe(false);
  });

  it('rejects malformed referral reward payloads', () => {
    const invalid = insertReferralRewardSchema.safeParse({
      referrerId: 'user-1',
      referredUserId: 'user-2',
      daoId: 'dao-1',
      rewardAmount: -10,
      rewardType: 'signup',
      status: 'pending',
    });

    expect(invalid.success).toBe(false);
  });

  it('declares unique database indexes for reviewer, M-Pesa, and payout references', () => {
    const indexNames = [
      ...getTableConfig(daoContributionApprovals).indexes,
      ...getTableConfig(daoContributions).indexes,
      ...getTableConfig(daoRotationCycles).indexes,
    ].filter((index) => index.config.unique).map((index) => index.config.name);

    expect(indexNames).toContain('dao_contribution_approvals_one_per_approver');
    expect(indexNames).toContain('dao_contributions_mpesa_reference_unique');
    expect(indexNames).toContain('dao_rotation_cycles_payment_reference_unique');
  });
});
