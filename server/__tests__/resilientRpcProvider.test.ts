import { describe, expect, it } from 'vitest';
import { ResilientRpcProvider } from '../services/resilientRpcProvider';

describe('ResilientRpcProvider', () => {
  it('fails over to the configured fallback when the primary returns a provider-level 429', async () => {
    const primaryProvider = {
      getBalance: async () => {
        throw Object.assign(new Error('rate limited'), { status: 429 });
      },
    };

    const fallbackProvider = {
      getBalance: async () => 42n,
    };

    const resilient = new ResilientRpcProvider({
      primary: { name: 'primary', httpUrl: 'https://primary.example' },
      fallback: { name: 'fallback', httpUrl: 'https://fallback.example' },
      createProvider: (url: string) => {
        if (url === 'https://primary.example') return primaryProvider as any;
        return fallbackProvider as any;
      },
    });

    const result = await resilient.call(async (provider: any) => provider.getBalance('0x1234'));

    expect(result).toBe(42n);
  });

  it('does not fail over for application-level errors that are not provider failures', async () => {
    const primaryProvider = {
      getBalance: async () => {
        throw Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' });
      },
    };

    const fallbackProvider = {
      getBalance: async () => 42n,
    };

    const resilient = new ResilientRpcProvider({
      primary: { name: 'primary', httpUrl: 'https://primary.example' },
      fallback: { name: 'fallback', httpUrl: 'https://fallback.example' },
      createProvider: (url: string) => {
        if (url === 'https://primary.example') return primaryProvider as any;
        return fallbackProvider as any;
      },
    });

    await expect(resilient.call(async (provider: any) => provider.getBalance('0x1234'))).rejects.toThrow('execution reverted');
  });

  it('fails over when ethers reports a network-detection startup failure', async () => {
    const primaryProvider = {
      getCode: async () => {
        throw new Error('JsonRpcProvider failed to detect network and cannot start up');
      },
    };

    const fallbackProvider = {
      getCode: async () => '0x6000',
    };

    const resilient = new ResilientRpcProvider({
      primary: { name: 'primary', httpUrl: 'https://primary.example' },
      fallback: { name: 'fallback', httpUrl: 'https://fallback.example' },
      createProvider: (url: string) => {
        if (url === 'https://primary.example') return primaryProvider as any;
        return fallbackProvider as any;
      },
    });

    await expect(resilient.call(async (provider: any) => provider.getCode('0x1234'))).resolves.toBe('0x6000');
  });
});
