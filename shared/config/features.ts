/**
 * MtaaDAO Feature Registry
 * shared/config/features.ts
 *
 * Single source of truth for feature access rules.
 * Drives both backend middleware (featureGate) and frontend rendering.
 *
 * DOCTRINE: Personas are not gates — they are organizational lenses.
 *   - 'hidden'  → not rendered at all for this persona (not relevant)
 *   - 'locked'  → rendered but behind a gate, with an upgrade CTA
 *   - 'visible' → fully accessible, no gate
 *
 * Advanced mode is the only hard gate. It lives on the users table,
 * checked on every request — never cached in JWT.
 */

export type Persona = 'okedi' | 'yuki' | 'amara';
export type FeatureTier = 'basic' | 'intermediate' | 'advanced';
export type PresentationMode = 'visible' | 'locked' | 'hidden';
export type UnlockAction =
  | 'toggle_advanced_mode'
  | 'complete_kyc'
  | 'contact_support';


export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  tier: FeatureTier;
  /** If true: checked against users.advancedMode in DB on every request */
  requiresAdvancedMode: boolean;
  /** How this feature is presented per persona */
  presentation: Record<Persona, PresentationMode>;
  /** How to unlock if locked — shown in UI */
  unlock?: {
    action: UnlockAction;
    label: string;
    href?: string;
  };
  /** Route patterns this feature protects (informational — for documentation) */
  routes?: string[];
  featureServiceKey?: string; // links to featureservice entry (optional)
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURES: Record<string, FeatureDefinition> = {

  // ── BASIC — no advanced mode, all personas ─────────────────────────────────

  'wallet.basic': {
    id: 'wallet.basic',
    label: 'Wallet',
    description: 'Send, receive, and view balances',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'wallet.list',
  },

  'dao.join': {
    id: 'dao.join',
    label: 'Join DAO / Chama',
    description: 'Join existing DAOs and chamaz',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.members',
  },

  'dao.create': {
    id: 'dao.create',
    label: 'Create DAO / Chama',
    description: 'Create a new chama or investment DAO',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.creation',
  },

  'proposal.vote': {
    id: 'proposal.vote',
    label: 'Vote on Proposals',
    description: 'Cast votes in DAO governance',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.governance',
  },

  'proposal.create': {
    id: 'proposal.create',
    label: 'Create Proposals',
    description: 'Draft and submit governance proposals',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.governance',
  },

  'escrow.basic': {
    id: 'escrow.basic',
    label: 'Basic Escrow',
    description: 'Create and manage simple escrow transactions',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'menu.escrow',
  },

  'kyc': {
    id: 'kyc',
    label: 'Identity Verification',
    description: 'KYC for higher transfer limits',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'wallet.kyc',
  },

  'referral': {
    id: 'referral',
    label: 'Referral Program',
    description: 'Refer friends and earn MTAA rewards',
    tier: 'basic',
    requiresAdvancedMode: false,
    // Primary to Okedi — the community persona earns by growing the network.
    // Yuki/Amara can access it but it's not surfaced prominently.
    presentation: { okedi: 'visible', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'referral.dashboard',
    unlock: {
      action: 'toggle_advanced_mode', // not really gated, just navigate
      label: 'View Referral Program',
      href: '/referrals',
    },
  },

  'chama.rotation': {
  id: 'chama.rotation',
  label: 'Rotation Payout',
  description: 'Configure and execute chama merry-go-round payouts',
  tier: 'basic',
  requiresAdvancedMode: false,
  // Core Okedi feature — this IS the chama product
  presentation: { okedi: 'visible', yuki: 'hidden', amara: 'hidden' },
  featureServiceKey: 'chama.rotation',
  routes: ['/api/v1/dao/rotation/*'],
},

'chama.contributions': {
  id: 'chama.contributions',
  label: 'Contribution Tracking',
  description: 'Track member contributions and standing',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'hidden', amara: 'hidden' },
  featureServiceKey: 'chama.contributions',
  routes: ['/api/v1/contributions/*'],
},

'chama.mpesa': {
  id: 'chama.mpesa',
  label: 'M-Pesa Integration',
  description: 'Link M-Pesa for contributions and payouts',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'hidden', amara: 'hidden' },
  featureServiceKey: 'chama.mpesa',
  routes: ['/api/mpesa-status/*'],
},


'reputation.poc': {
  id: 'reputation.poc',
  label: 'Proof of Contribution',
  description: 'On-chain proof of chama contribution history',
  tier: 'basic',
  requiresAdvancedMode: false,
  // Core Okedi feature — establishes creditworthiness
  presentation: { okedi: 'visible', yuki: 'hidden', amara: 'visible' },
  featureServiceKey: 'chama.poc',
  routes: ['/api/v1/proof-of-contribution/*'],
},

'reputation.score': {
  id: 'reputation.score',
  label: 'Reputation Score',
  description: 'DAO reputation and governance weight',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'special.reputation',
  routes: ['/api/v1/reputation/*', '/api/reputation/*'],
},

  'treasury.view': {
    id: 'treasury.view',
    label: 'Treasury View',
    description: 'View DAO treasury balances and history',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.treasury_overview',
  },

  'treasury.withdraw': {
    id: 'treasury.withdraw',
    label: 'Treasury Withdrawal',
    description: 'Initiate a governed withdrawal from DAO treasury',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'dao.disbursements',
  },

  'payment.record': {
    id: 'payment.record',
    label: 'Record M-Pesa Payment',
    description: 'Log M-Pesa or cash contributions to the chama',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'locked', amara: 'hidden' },
    featureServiceKey: 'payment.reconciliation',
  },

  'payment.batch': {
    id: 'payment.batch',
    label: 'Batch Transfer',
    description: 'Send to multiple members in one operation',
    tier: 'basic',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'payment.reconciliation',
  },

  // ── INTERMEDIATE — Yuki primary, visible to Amara, locked/hidden for Okedi ─

  'dex.swap': {
    id: 'dex.swap',
    label: 'DEX Swap',
    description: 'Swap tokens on Uniswap, Curve, Ubeswap',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'trading.dex_swap',
  },

  'trading.cex': {
    id: 'trading.cex',
    label: 'CEX Trading',
    description: 'Trade on centralised exchanges via CCXT',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'trading.cex',
  },

  'yield.farming': {
    id: 'yield.farming',
    label: 'Yield Farming',
    description: 'Provide liquidity and earn protocol fees',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'defi.yield_farming',
  },

  'staking': {
    id: 'staking',
    label: 'Staking',
    description: 'Stake MTAA and CELO for protocol rewards',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'locked', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'defi.staking',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Switch to Yuki to stake',
      href: '/settings/persona',
    },
  },

  'strategies': {
    id: 'strategies',
    label: 'Strategy Marketplace',
    description: 'Browse and deploy automated trading strategies',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'trading.algo',
  },

  'market.intelligence': {
    id: 'market.intelligence',
    label: 'Market Intelligence',
    description: 'Signals, regime state, opportunity scanner',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'trading.market_intelligence',
  },

  'vault.deposit': {
    id: 'vault.deposit',
    label: 'Vault Deposit',
    description: 'Deposit into MaonoVault (Chama, Savings, Escrow, Rotating)',
    tier: 'intermediate',
    requiresAdvancedMode: false,
    presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
    featureServiceKey: 'vault.dashboard',
  },

  // ── ADVANCED — requiresAdvancedMode: true ─────────────────────────────────
  // Checked in DB on every request. Never cached.

  'treasury.multisig': {
    id: 'treasury.multisig',
    label: 'Treasury Multisig',
    description: 'Set up multi-signature control for chama treasury',
    tier: 'advanced',
    requiresAdvancedMode: true,
    // Okedi: show it locked — chama operators want this, it's a growth path.
    // Yuki:  show it locked — may need for DAO ops.
    // Amara: visible — investors expect multisig as standard.
    presentation: { okedi: 'locked', yuki: 'locked', amara: 'visible' },
    featureServiceKey: 'defi.multisig',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
    routes: ['/api/v1/treasury/multisig/*'],
  },

  'bridge.swap': {
    id: 'bridge.swap',
    label: 'Cross-Chain Bridge',
    description: 'Bridge assets across blockchains',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'special.bridge',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
    routes: ['/api/v1/yuki/bridge/*'],
  },

  'bridge.transfer': {
    id: 'bridge.transfer',
    label: 'Cross-Chain Transfer',
    description: 'Transfer assets to another chain',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'special.bridge',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
    routes: ['/api/v1/yuki/bridge/transfer'],
  },

  'algo.trading': {
    id: 'algo.trading',
    label: 'Algorithmic Trading',
    description: 'Deploy automated trading bots and strategies',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'trading.algo',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
    routes: ['/api/v1/yuki/algo/*'],
  },

  'trading.leverage': {
    id: 'trading.leverage',
    label: 'Leverage Trading',
    description: 'Trade with leverage on supported DEXes',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'trading.leverage',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
  },

  'rebalancing.auto': {
    id: 'rebalancing.auto',
    label: 'Auto-Rebalancing',
    description: 'Automatically rebalance portfolio allocations',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'defi.rebalancing',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
    routes: ['/api/v1/yuki/rebalancing/*'],
  },

  'dhf.template': {
    id: 'dhf.template',
    label: 'DHF Template (HODL Alpha)',
    description: 'Deploy a Decentralised Hedge Fund vault',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
    featureServiceKey: 'defi.dhf',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
  },

  'multisig.election': {
    id: 'multisig.election',
    label: 'Signer Election',
    description: 'Quadratic-vote election for multisig signers',
    tier: 'advanced',
    requiresAdvancedMode: true,
    presentation: { okedi: 'locked', yuki: 'hidden', amara: 'visible' },
    featureServiceKey: 'defi.multisig',
    unlock: {
      action: 'toggle_advanced_mode',
      label: 'Enable Advanced Mode',
      href: '/api/v1/settings/advanced-mode',
    },
  },

  'arbitrage.cex': {
  id: 'arbitrage.cex',
  label: 'CEX Arbitrage',
  description: 'Scan and execute CEX-CEX price spread opportunities',
  tier: 'advanced',
  requiresAdvancedMode: true,
  presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
  featureServiceKey: 'trading.arbitrage_cex',
  unlock: { action: 'toggle_advanced_mode', label: 'Enable Advanced Mode' },
  routes: ['/api/v1/yuki/opportunities/*'],
},

'arbitrage.dex': {
  id: 'arbitrage.dex',
  label: 'DEX Arbitrage',
  description: 'CEX-DEX and cross-chain spread detection',
  tier: 'advanced',
  requiresAdvancedMode: true,
  presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
  featureServiceKey: 'trading.arbitrage_dex',
  unlock: { action: 'toggle_advanced_mode', label: 'Enable Advanced Mode' },
  routes: ['/api/v1/yuki/opportunities/dex/*'],
},


'market.signals': {
  id: 'market.signals',
  label: 'Market Signals',
  description: 'Technical indicator signals across timeframes',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'trading.market_intelligence',
  routes: ['/api/v1/yuki/signals/*'],
},

'market.scanner': {
  id: 'market.scanner',
  label: 'Opportunity Scanner',
  description: 'Real-time CEX/DEX opportunity detection',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'trading.market_intelligence',
  routes: ['/api/v1/yuki/scanner/*'],
},

'market.dexscreener': {
  id: 'market.dexscreener',
  label: 'DEX Screener',
  description: 'Multi-chain DEX pair discovery and trending tokens',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'trading.dex_screener',
  routes: ['/api/v1/dex/trending/*', '/api/v1/dex/search/*'],
},

'trading.limit_orders': {
  id: 'trading.limit_orders',
  label: 'Limit Orders',
  description: 'Place limit orders on CEX via CCXT',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'hidden', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'trading.limit_orders',
  routes: ['/api/v1/yuki/limit-orders/*'],
},

'trading.smart_routing': {
  id: 'trading.smart_routing',
  label: 'Smart Order Routing',
  description: 'AI-optimized order splitting across DEX and CEX venues',
  tier: 'advanced',
  requiresAdvancedMode: true,
  presentation: { okedi: 'hidden', yuki: 'locked', amara: 'locked' },
  featureServiceKey: 'trading.smart_routing',
  unlock: { action: 'toggle_advanced_mode', label: 'Enable Advanced Mode' },
  routes: ['/api/v1/yuki/routing/*'],
},

'nft.marketplace': {
  id: 'nft.marketplace',
  label: 'NFT Marketplace',
  description: 'Buy, sell and mint NFTs on Celo',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'locked', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'marketplace.nft',
  unlock: { action: 'toggle_advanced_mode', label: 'View NFT Marketplace' },
  routes: ['/api/v1/nft-marketplace/*'],
},

'economy.mtaa': {
  id: 'economy.mtaa',
  label: 'MTAA Token Economy',
  description: 'MTAA token utilities, rewards, and distribution',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'economy.mtaa',
  routes: ['/api/v1/economy/*'],
},

'gamification.achievements': {
  id: 'gamification.achievements',
  label: 'Achievements',
  description: 'Earn badges and rewards for platform activity',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'special.achievements',
  routes: ['/api/v1/achievements/*'],
},
//telegram can be used advanced features for trade alerts, order updates, etc, telegram is multipurpose, whatsapp is more specialised for okedi(referrals plus social)
'notifications.telegram': {
  id: 'notifications.telegram',
  label: 'Telegram Bot',
  description: 'Receive alerts and manage DAO via Telegram',
  tier: 'basic',
  requiresAdvancedMode: false,
  // Okedi primary — community users prefer messaging apps, will keep visible for tg linking
  presentation: { okedi: 'visible', yuki: 'visible', amara: 'locked' },
  featureServiceKey: 'chama.telegram',
  routes: ['/api/telegram/*', '/api/telegram-bot/*'],
},

'notifications.whatsapp': {
  id: 'notifications.whatsapp',
  label: 'WhatsApp Integration',
  description: 'Receive alerts and manage chama via WhatsApp',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'hidden', amara: 'hidden' },
  featureServiceKey: 'chama.whatsapp',
  routes: ['/api/whatsapp/*'],
},

'payment.p2p': {
  id: 'payment.p2p',
  label: 'P2P Transfer',
  description: 'Direct peer-to-peer transfers between members',
  tier: 'basic',
  requiresAdvancedMode: false,
  presentation: { okedi: 'visible', yuki: 'visible', amara: 'visible' },
  featureServiceKey: 'payment.methods',
  routes: ['/api/v1/p2p-transfers/*'],
},

// Features that should unlock via KYC:
'payment.high_value': {
  id: 'payment.high_value',
  label: 'High-Value Transfers',
  description: 'Send above KES 50,000 in a single transaction',
  tier: 'intermediate',
  requiresAdvancedMode: false,
  presentation: { okedi: 'locked', yuki: 'locked', amara: 'locked' },
  featureServiceKey: 'wallet.transaction_limits',
  unlock: {
    action: 'complete_kyc',
    label: 'Complete Identity Verification',
    href: '/kyc',
  },
},

};



// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — used by both middleware and frontend hook
// ─────────────────────────────────────────────────────────────────────────────

export function isFeatureAccessible(
  featureId: string,
  persona: Persona,
  advancedMode: boolean
): { accessible: boolean; reason?: string } {
  const feature = FEATURES[featureId];
  if (!feature) return { accessible: false, reason: 'unknown_feature' };

  const presentation = feature.presentation[persona];
  if (presentation === 'hidden') {
    return { accessible: false, reason: 'not_available_for_persona' };
  }

  if (feature.requiresAdvancedMode && !advancedMode) {
    return { accessible: false, reason: 'advanced_mode_required' };
  }

  return { accessible: true };
}

/** Build the full feature manifest for a given user state */
export function buildFeatureManifest(persona: Persona, advancedMode: boolean) {
  const manifest: Record<
    string,
    {
      accessible: boolean;
      presentation: PresentationMode;
      reason?: string;
      unlock?: FeatureDefinition['unlock'];
    }
  > = {};

  for (const [id, feature] of Object.entries(FEATURES)) {
    const { accessible, reason } = isFeatureAccessible(id, persona, advancedMode);
    manifest[id] = {
      accessible,
      presentation: feature.presentation[persona],
      ...(accessible ? {} : { reason, unlock: feature.unlock }),
    };
  }

  return { persona, advancedMode, features: manifest };
}
