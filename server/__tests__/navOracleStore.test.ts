import { describe, expect, it } from 'vitest';
import { InMemoryNavOracleStore } from '../services/navOracleStore';

describe('NAV oracle durable store contract', () => {
  it('allocates unique increasing nonces across concurrent store calls', async () => {
    const store = new InMemoryNavOracleStore();
    const nonces = await Promise.all(
      Array.from({ length: 20 }, () => store.incrementNonce('vault-1'))
    );

    expect(nonces.sort((a, b) => a - b))
      .toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(await store.getNonce('vault-1')).toBe(20);
  });
});
