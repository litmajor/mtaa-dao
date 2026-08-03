export interface ProviderBootstrapUrls {
  rpcUrl: string;
  fallbackRpcUrl: string | null;
  wsUrl: string | null;
  fallbackWsUrl: string | null;
  isFallbackConfigured: boolean;
  fallbackMode: 'none' | 'explicit' | 'implicit';
}

export function resolveProviderUrls(env: Record<string, string | undefined> = process.env): ProviderBootstrapUrls {
  // Allow explicit fork RPC for local Anvil/Foundry forks. Prefer ANVIL_FORK_RPC,
  // then legacy ANVIL_RPC_URL, then TEST_RPC_URL when running tests.
  const testRpc = env.ANVIL_FORK_RPC || env.ANVIL_RPC_URL || (env.NODE_ENV === 'test' ? env.TEST_RPC_URL : undefined);
  if (testRpc) {
    return {
      rpcUrl: testRpc,
      fallbackRpcUrl: null,
      wsUrl: null,
      fallbackWsUrl: null,
      isFallbackConfigured: false,
      fallbackMode: 'none',
    };
  }

  const rpcUrl = env.CELO_RPC_URL || env.RPC_URL || 'https://forno.celo.org';
  const configuredFallback = env.CELO_RPC_FALLBACK_URL || env.RPC_URL_FALLBACK;

  const fallbackRpcUrl: string | null = configuredFallback || null;
  const fallbackMode: 'none' | 'explicit' | 'implicit' = fallbackRpcUrl ? 'explicit' : 'none';

  const wsUrl = env.CELO_WS_URL || env.WS_URL || null;
  let fallbackWsUrl = env.CELO_WS_FALLBACK_URL || env.WS_URL_FALLBACK || null;
  if (wsUrl && wsUrl === fallbackWsUrl) {
    fallbackWsUrl = null;
  }

  return {
    rpcUrl,
    fallbackRpcUrl,
    wsUrl,
    fallbackWsUrl,
    isFallbackConfigured: Boolean(fallbackRpcUrl && fallbackRpcUrl !== rpcUrl),
    fallbackMode,
  };
}
