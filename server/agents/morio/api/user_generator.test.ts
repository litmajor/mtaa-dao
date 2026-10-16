import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({ Logger: class { info = vi.fn(); debug = vi.fn(); warn = vi.fn(); error = vi.fn(); } }));

import { UserGenerator } from './user_generator';

describe('UserGenerator', () => {
  it('requires a valid DAO ID instead of inventing or using an empty one', () => {
    expect(() => new UserGenerator().generateUser()).toThrow(/valid DAO ID is required/i);
    expect(new UserGenerator({ defaultDaoId: 'dao-configured' }).generateUser().daoId).toBe('dao-configured');
    expect(new UserGenerator().generateUser('dao-explicit').daoId).toBe('dao-explicit');
  });
});
