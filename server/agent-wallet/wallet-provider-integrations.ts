/**
 * Wallet Provider Integrations
 * 
 * Comprehensive support for multiple wallet providers with their specific
 * connection methods, features, and security considerations.
 */

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  website: string;
  documentation: string;
  
  // Support levels
  isSupported: boolean;
  implementationStatus: 'active' | 'beta' | 'planned' | 'deprecated';
  
  // Features
  supportedChains: number[];
  supportsHardwareWallet: boolean;
  supportsMultisig: boolean;
  supportsWalletConnect: boolean;
  supportsBiometric: boolean;
  supportsDeepLink: boolean;
  
  // Requirements
  requiresExtension: boolean;
  requiresApp: boolean;
  minVersion?: string;
  
  // Connection method
  connectionMethod: 'injected' | 'wallet-connect' | 'web3modal' | 'custom';
  
  // Features list
  features: string[];
  
  // Security
  securityLevel: 'high' | 'medium' | 'low';
  auditedBy?: string[];
  
  // Integration difficulty
  integrationDifficulty: 'easy' | 'medium' | 'hard';
  estimatedImplementationHours: number;
}

/**
 * Current Supported Providers
 */
export const WALLET_PROVIDERS: Record<string, WalletProvider> = {
  // ============= CURRENTLY SUPPORTED =============
  
  metamask: {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Browser extension wallet (most popular)',
    website: 'https://metamask.io',
    documentation: 'https://docs.metamask.io',
    isSupported: true,
    implementationStatus: 'active',
    supportedChains: [1, 5, 11155111, 42220, 44787, 137, 80001, 42161, 421613, 8453, 84531, 10, 420],
    supportsHardwareWallet: true,
    supportsMultisig: false,
    supportsWalletConnect: false,
    supportsBiometric: false,
    supportsDeepLink: false,
    requiresExtension: true,
    requiresApp: false,
    minVersion: '10.0',
    connectionMethod: 'injected',
    features: [
      'Token transfers',
      'Smart contract interaction',
      'Hardware wallet support (Ledger, Trezor)',
      'EIP-1559 support',
      'Custom RPC',
      'Multi-chain',
      'Token swaps (built-in)',
      'NFT support',
      'Gas estimation',
      'Transaction history'
    ],
    securityLevel: 'high',
    auditedBy: ['OpenZeppelin', 'ConsenSys'],
    integrationDifficulty: 'easy',
    estimatedImplementationHours: 2,
  },

  walletconnect: {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '📱',
    description: 'Connect any mobile wallet via QR code (300+ wallets supported)',
    website: 'https://walletconnect.com',
    documentation: 'https://docs.walletconnect.com',
    isSupported: true,
    implementationStatus: 'active',
    supportedChains: [1, 5, 11155111, 42220, 44787, 137, 80001, 42161, 421613, 8453, 84531, 10, 420],
    supportsHardwareWallet: false,
    supportsMultisig: true,
    supportsWalletConnect: true,
    supportsBiometric: true,
    supportsDeepLink: true,
    requiresExtension: false,
    requiresApp: true,
    connectionMethod: 'wallet-connect',
    features: [
      'QR code scanning',
      'Mobile wallet support (300+ wallets)',
      'Multi-wallet compatibility',
      'Session persistence',
      'Push notifications',
      'Deep linking',
      'Multisig support',
      'Enterprise wallets',
      'WalletConnect v2 protocol',
      'Cross-chain support'
    ],
    securityLevel: 'high',
    auditedBy: ['OpenZeppelin', 'Trail of Bits'],
    integrationDifficulty: 'medium',
    estimatedImplementationHours: 4,
  },

  coinbase: {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🏦',
    description: 'Coinbase official extension wallet',
    website: 'https://www.coinbase.com/wallet',
    documentation: 'https://docs.cloud.coinbase.com/wallet-sdk',
    isSupported: true,
    implementationStatus: 'active',
    supportedChains: [1, 5, 11155111, 42220, 44787, 137, 80001, 42161, 421613, 8453, 84531, 10, 420],
    supportsHardwareWallet: false,
    supportsMultisig: false,
    supportsWalletConnect: true,
    supportsBiometric: true,
    supportsDeepLink: true,
    requiresExtension: true,
    requiresApp: true,
    connectionMethod: 'injected',
    features: [
      'Browser extension',
      'Mobile app',
      'Hardware wallet support',
      'Built-in DEX',
      'NFT gallery',
      'Staking',
      'DApp browser',
      'Coinbase account integration'
    ],
    securityLevel: 'high',
    auditedBy: ['Coinbase'],
    integrationDifficulty: 'easy',
    estimatedImplementationHours: 2,
  },

  ledger: {
    id: 'ledger',
    name: 'Ledger',
    icon: '🔐',
    description: 'Hardware wallet (USB/Bluetooth)',
    website: 'https://www.ledger.com',
    documentation: 'https://developers.ledger.com',
    isSupported: true,
    implementationStatus: 'active',
    supportedChains: [1, 5, 11155111, 42220, 44787, 137, 80001, 42161, 421613, 8453, 84531, 10, 420],
    supportsHardwareWallet: true,
    supportsMultisig: false,
    supportsWalletConnect: false,
    supportsBiometric: true,
    supportsDeepLink: false,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Hardware security',
      'USB connection',
      'Bluetooth support',
      'Multi-account',
      'HD wallet standard',
      'Large transaction support',
      'Ethereum support',
      'Multiple chains'
    ],
    securityLevel: 'high',
    auditedBy: ['Ledger', 'Security firms'],
    integrationDifficulty: 'hard',
    estimatedImplementationHours: 8,
  },

  // ============= PLANNED/COMING SOON =============

  magiclink: {
    id: 'magic',
    name: 'Magic Link',
    icon: '✨',
    description: 'Email-based wallet (passwordless)',
    website: 'https://magic.link',
    documentation: 'https://magic.link/docs',
    isSupported: false,
    implementationStatus: 'planned',
    supportedChains: [1, 5, 11155111, 137, 80001, 42161, 8453, 10],
    supportsHardwareWallet: false,
    supportsMultisig: false,
    supportsWalletConnect: false,
    supportsBiometric: true,
    supportsDeepLink: true,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Email login',
      'No passwords',
      'Social login',
      'Passwordless auth',
      'SDK integration',
      'Custom branding',
      'User-friendly',
      'Non-custodial'
    ],
    securityLevel: 'medium',
    auditedBy: [],
    integrationDifficulty: 'medium',
    estimatedImplementationHours: 6,
  },

  gnosissafe: {
    id: 'gnosissafe',
    name: 'Gnosis Safe',
    icon: '🔒',
    description: 'Multisig smart contract wallet',
    website: 'https://gnosis-safe.io',
    documentation: 'https://docs.gnosis-safe.io',
    isSupported: false,
    implementationStatus: 'planned',
    supportedChains: [1, 5, 11155111, 42220, 137, 80001, 42161, 8453, 10],
    supportsHardwareWallet: true,
    supportsMultisig: true,
    supportsWalletConnect: true,
    supportsBiometric: false,
    supportsDeepLink: false,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Multi-signature',
      'DAO governance',
      'Large fund management',
      'Batch transactions',
      'Advanced permissions',
      'Module ecosystem',
      'Gas optimization',
      'Delegation'
    ],
    securityLevel: 'high',
    auditedBy: ['OpenZeppelin', 'ConsenSys Diligence'],
    integrationDifficulty: 'hard',
    estimatedImplementationHours: 10,
  },

  walletlink: {
    id: 'walletlink',
    name: 'WalletLink',
    icon: '🔗',
    description: 'Coinbase Cloud wallet integration',
    website: 'https://cloud.coinbase.com/wallet-link',
    documentation: 'https://docs.cloud.coinbase.com/wallet-link',
    isSupported: false,
    implementationStatus: 'planned',
    supportedChains: [1, 5, 11155111, 137, 80001, 42161, 8453, 10],
    supportsHardwareWallet: false,
    supportsMultisig: false,
    supportsWalletConnect: true,
    supportsBiometric: false,
    supportsDeepLink: false,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Web wallet',
      'Coinbase integration',
      'REST API',
      'Testnet support',
      'Staking',
      'Multi-chain'
    ],
    securityLevel: 'high',
    auditedBy: ['Coinbase'],
    integrationDifficulty: 'medium',
    estimatedImplementationHours: 5,
  },

  minipay: {
    id: 'minipay',
    name: 'Minipay',
    icon: '📱',
    description: 'Celo mobile wallet (Minipay)',
    website: 'https://minipay.im',
    documentation: 'https://docs.minipay.im',
    isSupported: true,
    implementationStatus: 'active',
    supportedChains: [42220, 44787], // Celo only
    supportsHardwareWallet: false,
    supportsMultisig: false,
    supportsWalletConnect: true,
    supportsBiometric: true,
    supportsDeepLink: true,
    requiresExtension: false,
    requiresApp: true,
    connectionMethod: 'wallet-connect',
    features: [
      'Mobile app',
      'Celo native',
      'Phone number login',
      'Biometric security',
      'Direct USD transfers',
      'Low fees',
      'Payments focused'
    ],
    securityLevel: 'high',
    auditedBy: ['Celo team'],
    integrationDifficulty: 'easy',
    estimatedImplementationHours: 2,
  },

  argent: {
    id: 'argent',
    name: 'Argent',
    icon: '🛡️',
    description: 'Mobile DeFi wallet with guards',
    website: 'https://www.argent.xyz',
    documentation: 'https://docs.argent.xyz',
    isSupported: false,
    implementationStatus: 'planned',
    supportedChains: [1, 5, 11155111, 42220, 137],
    supportsHardwareWallet: false,
    supportsMultisig: false,
    supportsWalletConnect: true,
    supportsBiometric: true,
    supportsDeepLink: true,
    requiresExtension: false,
    requiresApp: true,
    connectionMethod: 'wallet-connect',
    features: [
      'Mobile app',
      'DeFi integration',
      'Gas-less transactions',
      'Account recovery',
      'Daily limits',
      'Biometric security',
      'Social recovery',
      'Multi-chain'
    ],
    securityLevel: 'high',
    auditedBy: ['Argent'],
    integrationDifficulty: 'medium',
    estimatedImplementationHours: 6,
  },

  trezor: {
    id: 'trezor',
    name: 'Trezor',
    icon: '🔑',
    description: 'Hardware wallet (USB only)',
    website: 'https://trezor.io',
    documentation: 'https://docs.trezor.io',
    isSupported: false,
    implementationStatus: 'beta',
    supportedChains: [1, 5, 11155111, 42220, 137, 80001, 42161, 8453, 10],
    supportsHardwareWallet: true,
    supportsMultisig: false,
    supportsWalletConnect: false,
    supportsBiometric: false,
    supportsDeepLink: false,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Hardware security',
      'USB connection',
      'HD wallet',
      'Multiple chains',
      'Firmware updates',
      'Recovery seed',
      'EIP-1559 support'
    ],
    securityLevel: 'high',
    auditedBy: ['Trezor team'],
    integrationDifficulty: 'hard',
    estimatedImplementationHours: 8,
  },

  keystone: {
    id: 'keystone',
    name: 'Keystone',
    icon: '📲',
    description: 'Air-gap hardware wallet',
    website: 'https://keyst.one',
    documentation: 'https://docs.keyst.one',
    isSupported: false,
    implementationStatus: 'planned',
    supportedChains: [1, 137, 42161],
    supportsHardwareWallet: true,
    supportsMultisig: false,
    supportsWalletConnect: false,
    supportsBiometric: true,
    supportsDeepLink: false,
    requiresExtension: false,
    requiresApp: false,
    connectionMethod: 'custom',
    features: [
      'Air-gap security',
      'QR code signing',
      'Offline transaction',
      'HD wallet',
      'EVM support',
      'Bitcoin support',
      'Solana support'
    ],
    securityLevel: 'high',
    auditedBy: ['Keystone team'],
    integrationDifficulty: 'hard',
    estimatedImplementationHours: 10,
  },
};

/**
 * Get all supported providers
 */
export function getSupportedProviders(): WalletProvider[] {
  return Object.values(WALLET_PROVIDERS).filter(p => p.isSupported);
}

/**
 * Get planned/coming soon providers
 */
export function getPlannedProviders(): WalletProvider[] {
  return Object.values(WALLET_PROVIDERS).filter(
    p => !p.isSupported && p.implementationStatus !== 'deprecated'
  );
}

/**
 * Get providers by status
 */
export function getProvidersByStatus(
  status: 'active' | 'beta' | 'planned' | 'deprecated'
): WalletProvider[] {
  return Object.values(WALLET_PROVIDERS).filter(p => p.implementationStatus === status);
}

/**
 * Get providers that support a specific chain
 */
export function getProvidersForChain(chainId: number): WalletProvider[] {
  return Object.values(WALLET_PROVIDERS).filter(
    p => p.supportedChains.includes(chainId) && p.isSupported
  );
}

/**
 * Get providers by connection method
 */
export function getProvidersByConnectionMethod(
  method: 'injected' | 'wallet-connect' | 'web3modal' | 'custom'
): WalletProvider[] {
  return Object.values(WALLET_PROVIDERS).filter(
    p => p.connectionMethod === method && p.isSupported
  );
}

/**
 * Integration Roadmap
 */
export const INTEGRATION_ROADMAP = {
  phase1: {
    title: 'Core Support (Current)',
    providers: ['metamask', 'walletconnect', 'coinbase', 'ledger'],
    estimatedCompletion: 'Q1 2026',
    status: 'completed'
  },
  phase2: {
    title: 'Extended Support',
    providers: ['magic', 'gnosissafe', 'walletlink', 'argent'],
    estimatedCompletion: 'Q2 2026',
    status: 'in-progress'
  },
  phase3: {
    title: 'Hardware & Advanced',
    providers: ['trezor', 'keystone'],
    estimatedCompletion: 'Q3 2026',
    status: 'planned'
  },
  phase4: {
    title: 'Enterprise & Special',
    providers: ['gnosis-safe-teams', 'custom-multisig'],
    estimatedCompletion: 'Q4 2026',
    status: 'planned'
  }
};

/**
 * Provider Implementation Guide
 */
export const IMPLEMENTATION_GUIDE = {
  metamask: {
    setup: `
// 1. Check if MetaMask is installed
if (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask) {
  // 2. Request accounts
  const accounts = await (window as any).ethereum.request({
    method: 'eth_requestAccounts'
  });
  // 3. Connect
}
    `,
    integration: 'Use ethereum injected object directly',
    complexity: 'Very Easy',
    timeEstimate: '2 hours'
  },

  walletconnect: {
    setup: `
// 1. Install WalletConnect
npm install @walletconnect/web3-provider

// 2. Initialize
const provider = new WalletConnectProvider({
  infuraId: 'YOUR_INFURA_ID',
  rpc: {
    1: 'https://mainnet.infura.io/v3/YOUR_KEY',
    42220: 'https://forno.celo.org'
  }
});

// 3. Connect
await provider.enable();
    `,
    integration: 'Universal connection via QR code',
    complexity: 'Medium',
    timeEstimate: '4 hours'
  },

  ledger: {
    setup: `
// 1. Install LedgerJS
npm install @ledgerhq/hw-transport-webusb @ledgerhq/hw-app-eth

// 2. Connect device
const transport = await TransportWebUSB.create();
const eth = new Eth(transport);

// 3. Get accounts and sign transactions
const account = await eth.getAddress("m/44'/60'/0'/0/0");
const signature = await eth.signTransaction(...);
    `,
    integration: 'Hardware wallet via LedgerJS SDK',
    complexity: 'Hard',
    timeEstimate: '8 hours'
  },

  magic: {
    setup: `
// 1. Install Magic SDK
npm install magic-sdk

// 2. Initialize
const magic = new Magic('YOUR_MAGIC_API_KEY');

// 3. Login with email
await magic.auth.loginWithMagicLink({ email: 'user@example.com' });

// 4. Get provider for Web3
const web3 = new Web3(magic.rpcProvider);
    `,
    integration: 'SDK-based integration',
    complexity: 'Medium',
    timeEstimate: '6 hours'
  }
};

/**
 * Security Best Practices
 */
export const SECURITY_BEST_PRACTICES = [
  '✅ Always use HTTPS in production',
  '✅ Verify provider signatures',
  '✅ Never store private keys in browser',
  '✅ Validate all contract interactions',
  '✅ Use hardware wallets for high-value accounts',
  '✅ Implement request limits and rate limiting',
  '✅ Audit smart contracts before interaction',
  '✅ Use transaction simulation tools',
  '✅ Implement approval limits for spenders',
  '✅ Monitor gas prices to prevent overpaying',
  '✅ Use multisig for treasury management',
  '✅ Implement 2FA when available'
];

/**
 * Get implementation status summary
 */
export function getImplementationSummary() {
  const supported = getSupportedProviders();
  const planned = getPlannedProviders();

  return {
    totalProviders: Object.keys(WALLET_PROVIDERS).length,
    supportedCount: supported.length,
    plannedCount: planned.length,
    supportedProviders: supported.map(p => p.name),
    plannedProviders: planned.map(p => p.name),
    nextPhaseProviders: getProvidersByStatus('beta').map(p => p.name)
  };
}
