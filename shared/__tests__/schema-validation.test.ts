import { describe, expect, it } from 'vitest';
import { insertReferralRewardSchema, insertTaskSchema, insertUserSchema } from '../schema';

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
});
