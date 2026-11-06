import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainlinkAdapter } from '../core/agents/gateway/adapters/chainlink-adapter';
import { parseChainlinkFeedConfig } from '../services/chainlinkFeedReader';

const CELO_FEED = '0x0568fD19986748cEfF3301e55c0eb1E729E0Ab7e';

describe('Chainlink feed configuration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a direct shadow feed and normalizes its symbol', () => {
    const parsed = parseChainlinkFeedConfig(
      JSON.stringify({
        celo: {
          chainId: 42220,
          address: CELO_FEED,
          heartbeatSeconds: 240,
          expectedDescription: 'CELO / USD',
          mode: 'shadow',
        },
      })
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.invalidSymbols.size).toBe(0);
    expect(parsed.feeds.get('CELO')).toMatchObject({
      symbol: 'CELO',
      chainId: 42220,
      heartbeatSeconds: 240,
      expectedDescription: 'CELO / USD',
      mode: 'shadow',
      kind: 'direct',
      onMissing: 'degrade',
    });
  });

  it('requires a deviation threshold for anchor feeds', () => {
    const parsed = parseChainlinkFeedConfig(
      JSON.stringify({
        CELO: {
          chainId: 42220,
          address: CELO_FEED,
          heartbeatSeconds: 240,
          expectedDescription: 'CELO / USD',
          mode: 'anchor',
        },
      })
    );

    expect(parsed.feeds.has('CELO')).toBe(false);
    expect(parsed.invalidSymbols.has('CELO')).toBe(true);
    expect(parsed.errors[0]).toContain('anchorMaxDeviationPct');
  });

  it('marks duplicate symbols after case normalization invalid', () => {
    const parsed = parseChainlinkFeedConfig(
      `{"CELO":{"chainId":42220,"address":"${CELO_FEED}","heartbeatSeconds":240,"expectedDescription":"CELO / USD","mode":"shadow"},"celo":{"chainId":42220,"address":"${CELO_FEED}","heartbeatSeconds":240,"expectedDescription":"CELO / USD","mode":"shadow"}}`
    );

    expect(parsed.feeds.has('CELO')).toBe(false);
    expect(parsed.invalidSymbols.has('CELO')).toBe(true);
    expect(parsed.errors[0]).toContain('duplicate symbol');
  });

  it('reports malformed JSON explicitly', () => {
    const parsed = parseChainlinkFeedConfig('{not-json');

    expect(parsed.feeds.size).toBe(0);
    expect(parsed.errors[0]).toContain('not valid JSON');
  });
});

describe('Chainlink Gateway adapter request compatibility', () => {
  it('accepts the Gateway single-symbol request shape without throwing a parameter error', async () => {
    const adapter = new ChainlinkAdapter({
      name: 'chainlink',
      rpcUrl: 'http://localhost:8545',
      feedMap: {
        CELO: { address: CELO_FEED, heartbeatSeconds: 240 },
      },
    });

    const response = await adapter.fetch('price', { symbol: 'missing' });

    expect(response.success).toBe(false);
    expect(response.error).toContain('No Chainlink feed configured for MISSING');
  });

  it('rejects empty or malformed symbol requests with an explicit error', async () => {
    const adapter = new ChainlinkAdapter({
      name: 'chainlink',
      rpcUrl: 'http://localhost:8545',
      feedMap: {
        CELO: { address: CELO_FEED, heartbeatSeconds: 240 },
      },
    });

    const response = await adapter.fetch('price', { symbols: [] });

    expect(response.success).toBe(false);
    expect(response.error).toContain('needs `symbol` or a non-empty `symbols` array');
  });
});
