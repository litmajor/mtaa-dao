import { describe, expect, it } from 'vitest';
import { resolveProviderUrls } from '../services/providerBootstrap';

describe('resolveProviderUrls', () => {
  it('prefers explicit fallback and websocket URLs while preserving defaults', () => {
    const urls = resolveProviderUrls({
      CELO_RPC_URL: 'https://primary.example',
      CELO_RPC_FALLBACK_URL: 'https://fallback.example',
      CELO_WS_URL: 'wss://primary-ws.example',
      CELO_WS_FALLBACK_URL: 'wss://fallback-ws.example',
    });

    expect(urls).toEqual({
      rpcUrl: 'https://primary.example',
      fallbackRpcUrl: 'https://fallback.example',
      wsUrl: 'wss://primary-ws.example',
      fallbackWsUrl: 'wss://fallback-ws.example',
      isFallbackConfigured: true,
      fallbackMode: 'explicit',
    });
  });

  it('does not inject an implicit public fallback when no explicit fallback is configured', () => {
    const urls = resolveProviderUrls({
      CELO_RPC_URL: 'https://primary.example',
      CELO_WS_URL: 'wss://primary-ws.example',
    });

    expect(urls.rpcUrl).toBe('https://primary.example');
    expect(urls.fallbackRpcUrl).toBeNull();
    expect(urls.fallbackWsUrl).toBeNull();
    expect(urls.isFallbackConfigured).toBe(false);
    expect(urls.fallbackMode).toBe('none');
  });
});
