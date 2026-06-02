// Wallet provider integration shim
export type ProviderInfo = {
  id: string;
  name: string;
  description?: string;
  isInjected?: boolean;
  raw?: unknown;
  chains?: number[];
};

export const WALLET_PROVIDERS: Record<string, ProviderInfo> = {
  metamask: { id: 'metamask', name: 'MetaMask', isInjected: true, chains: [1, 3, 4, 5, 42, 137] },
  coinbase: { id: 'coinbase', name: 'Coinbase Wallet', isInjected: true, chains: [1, 3, 4, 5] },
  walletconnect: { id: 'walletconnect', name: 'WalletConnect', isInjected: false },
  ledger: { id: 'ledger', name: 'Ledger', isInjected: false },
  valora: { id: 'valora', name: 'Valora', isInjected: true },
  MiniPay: { id: 'MiniPay', name: 'MiniPay', isInjected: false },
};

export function getSupportedProviders(): ProviderInfo[] {
  return Object.values(WALLET_PROVIDERS);
}

export function getProvidersForChain(chainId?: number): ProviderInfo[] {
  if (!chainId) return getSupportedProviders();
  return Object.values(WALLET_PROVIDERS).filter((p) => !p.chains || p.chains.includes(chainId));
}

export default {
  WALLET_PROVIDERS,
  getSupportedProviders,
  getProvidersForChain,
};
