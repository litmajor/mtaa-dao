/**
 * Feature Visibility Service
 * Manages feature flags and visibility controls
 * Supports environment variable overrides and database persistence
 */

import { db } from '../db';

export interface FeatureConfig {
  name: string;
  enabled: boolean;
  releaseDate: string;
  phase: number;
  description: string;
  category?: string;
  dependencies?: string[];
}

export interface FeatureVisibilityMap {
  [key: string]: FeatureConfig;
}

/**
 * Master feature configuration
 * Uses environment variables for override capability
 */
export const DEFAULT_FEATURES: FeatureVisibilityMap = {
  // ========== CORE NAVIGATION (6 Features) ==========
  'core.dashboard': {
    name: 'Main Dashboard',
    enabled: getEnvBoolean('FEATURE_CORE_DASHBOARD', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'Main dashboard with 6 tabs',
    category: 'core',
  },
  'core.daos': {
    name: 'DAOs Management',
    enabled: getEnvBoolean('FEATURE_CORE_DAOS', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'DAO creation and management',
    category: 'core',
  },
  'core.wallet': {
    name: 'Wallet Management',
    enabled: getEnvBoolean('FEATURE_CORE_WALLET', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'Connected wallets and balances',
    category: 'core',
  },
  'core.profile': {
    name: 'User Profile',
    enabled: getEnvBoolean('FEATURE_CORE_PROFILE', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'User information and settings',
    category: 'core',
  },
  'core.referrals': {
    name: 'Referral System',
    enabled: getEnvBoolean('FEATURE_CORE_REFERRALS', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'Referral tracking and rewards',
    category: 'core',
  },
  'core.vaults': {
    name: 'Vault Management',
    enabled: getEnvBoolean('FEATURE_CORE_VAULTS', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'Investment vault management',
    category: 'core',
  },
  'core.analytics': {
    name: 'Analytics Dashboard',
    enabled: getEnvBoolean('FEATURE_CORE_ANALYTICS', true),
    releaseDate: '2025-11-22',
    phase: 1,
    description: 'Analytics and reporting',
    category: 'core',
  },

  // ========== DAO FEATURES (14 Features) ==========
  'dao.creation': {
    name: 'Create DAO',
    enabled: getEnvBoolean('FEATURE_DAO_CREATION', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Create new DAO',
    category: 'dao',
  },
  'dao.overview': {
    name: 'DAO Overview',
    enabled: getEnvBoolean('FEATURE_DAO_OVERVIEW', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'DAO details and stats',
    category: 'dao',
  },
  'dao.governance': {
    name: 'DAO Governance',
    enabled: getEnvBoolean('FEATURE_DAO_GOVERNANCE', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Proposals and voting',
    category: 'dao',
  },
  'dao.treasury': {
    name: 'DAO Treasury',
    enabled: getEnvBoolean('FEATURE_DAO_TREASURY', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Treasury management',
    category: 'dao',
  },
  'dao.members': {
    name: 'DAO Members',
    enabled: getEnvBoolean('FEATURE_DAO_MEMBERS', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Member management',
    category: 'dao',
  },
  'dao.settings': {
    name: 'DAO Settings',
    enabled: getEnvBoolean('FEATURE_DAO_SETTINGS', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'DAO configuration',
    category: 'dao',
  },
  'dao.chat': {
    name: 'DAO Chat',
    enabled: getEnvBoolean('FEATURE_DAO_CHAT', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Internal DAO messaging',
    category: 'dao',
  },
  'dao.subscription': {
    name: 'DAO Subscription',
    enabled: getEnvBoolean('FEATURE_DAO_SUBSCRIPTION', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Subscription management',
    category: 'dao',
  },
  'dao.checkout': {
    name: 'DAO Checkout',
    enabled: getEnvBoolean('FEATURE_DAO_CHECKOUT', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Payment and checkout',
    category: 'dao',
  },
  'dao.treasury_overview': {
    name: 'Treasury Overview',
    enabled: getEnvBoolean('FEATURE_DAO_TREASURY_OVERVIEW', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Detailed treasury view',
    category: 'dao',
  },
  'dao.disbursements': {
    name: 'Disbursements',
    enabled: getEnvBoolean('FEATURE_DAO_DISBURSEMENTS', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Payment disbursements',
    category: 'dao',
  },
  'dao.contributor_list': {
    name: 'Contributors',
    enabled: getEnvBoolean('FEATURE_DAO_CONTRIBUTORS', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Contributor tracking',
    category: 'dao',
  },
  'dao.moderation': {
    name: 'DAO Moderation',
    enabled: getEnvBoolean('FEATURE_DAO_MODERATION', true),
    releaseDate: '2025-11-23',
    phase: 2,
    description: 'Moderation tools',
    category: 'dao',
  },

  // ========== WALLET FEATURES (9 Features) ==========
  'wallet.list': {
    name: 'Wallet List',
    enabled: getEnvBoolean('FEATURE_WALLET_LIST', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Connected wallets',
    category: 'wallet',
  },
  'wallet.setup': {
    name: 'Wallet Setup',
    enabled: getEnvBoolean('FEATURE_WALLET_SETUP', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Initial wallet setup',
    category: 'wallet',
  },
  'wallet.connect': {
    name: 'Connect Wallet',
    enabled: getEnvBoolean('FEATURE_WALLET_CONNECT', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Add new wallet',
    category: 'wallet',
  },
  'wallet.history': {
    name: 'Transaction History',
    enabled: getEnvBoolean('FEATURE_WALLET_HISTORY', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'View transactions',
    category: 'wallet',
  },
  'wallet.kyc': {
    name: 'KYC Verification',
    enabled: getEnvBoolean('FEATURE_WALLET_KYC', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Basic verification',
    category: 'wallet',
  },
  'wallet.kyc_advanced': {
    name: 'Advanced KYC',
    enabled: getEnvBoolean('FEATURE_WALLET_KYC_ADVANCED', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Enhanced verification',
    category: 'wallet',
  },
  'wallet.transaction_limits': {
    name: 'Transaction Limits',
    enabled: getEnvBoolean('FEATURE_WALLET_TRANSACTION_LIMITS', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Set transaction limits',
    category: 'wallet',
  },
  'wallet.transaction_tracking': {
    name: 'Transaction Tracking',
    enabled: getEnvBoolean('FEATURE_WALLET_TRANSACTION_TRACKING', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Monitor transactions',
    category: 'wallet',
  },
  'wallet.payment_methods': {
    name: 'Payment Methods',
    enabled: getEnvBoolean('FEATURE_WALLET_PAYMENT_METHODS', true),
    releaseDate: '2025-11-24',
    phase: 3,
    description: 'Manage payment methods',
    category: 'wallet',
  },

  // ========== PROFILE FEATURES (5 Features) ==========
  'profile.info': {
    name: 'Profile Information',
    enabled: getEnvBoolean('FEATURE_PROFILE_INFO', true),
    releaseDate: '2025-11-25',
    phase: 2,
    description: 'User profile info',
    category: 'profile',
  },
  'profile.settings': {
    name: 'Account Settings',
    enabled: getEnvBoolean('FEATURE_PROFILE_SETTINGS', true),
    releaseDate: '2025-11-25',
    phase: 2,
    description: 'General settings',
    category: 'profile',
  },
  'profile.security': {
    name: 'Security Settings',
    enabled: getEnvBoolean('FEATURE_PROFILE_SECURITY', true),
    releaseDate: '2025-11-25',
    phase: 2,
    description: 'Security options',
    category: 'profile',
  },
  'profile.notifications': {
    name: 'Notification Preferences',
    enabled: getEnvBoolean('FEATURE_PROFILE_NOTIFICATIONS', true),
    releaseDate: '2025-11-25',
    phase: 2,
    description: 'Alert settings',
    category: 'profile',
  },
  'profile.privacy': {
    name: 'Privacy Settings',
    enabled: getEnvBoolean('FEATURE_PROFILE_PRIVACY', true),
    releaseDate: '2025-11-25',
    phase: 2,
    description: 'Privacy controls',
    category: 'profile',
  },

  // ========== REFERRAL FEATURES (5 Features) ==========
  'referral.dashboard': {
    name: 'Referral Dashboard',
    enabled: getEnvBoolean('FEATURE_REFERRAL_DASHBOARD', true),
    releaseDate: '2025-11-26',
    phase: 4,
    description: 'Referral stats',
    category: 'referral',
  },
  'referral.tracking': {
    name: 'Referral Tracking',
    enabled: getEnvBoolean('FEATURE_REFERRAL_TRACKING', true),
    releaseDate: '2025-11-26',
    phase: 4,
    description: 'Track referrals',
    category: 'referral',
  },
  'referral.leaderboard': {
    name: 'Referral Leaderboard',
    enabled: getEnvBoolean('FEATURE_REFERRAL_LEADERBOARD', true),
    releaseDate: '2025-11-26',
    phase: 4,
    description: 'Top referrers',
    category: 'referral',
  },
  'referral.rewards': {
    name: 'Referral Rewards',
    enabled: getEnvBoolean('FEATURE_REFERRAL_REWARDS', true),
    releaseDate: '2025-11-26',
    phase: 4,
    description: 'Earned rewards',
    category: 'referral',
  },
  'referral.history': {
    name: 'Referral History',
    enabled: getEnvBoolean('FEATURE_REFERRAL_HISTORY', true),
    releaseDate: '2025-11-26',
    phase: 4,
    description: 'Historical data',
    category: 'referral',
  },

  // ========== VAULT FEATURES (8 Features) ==========
  'vault.list': {
    name: 'Vault List',
    enabled: getEnvBoolean('FEATURE_VAULT_LIST', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'View vaults',
    category: 'vault',
  },
  'vault.creation': {
    name: 'Create Vault',
    enabled: getEnvBoolean('FEATURE_VAULT_CREATION', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Create new vault',
    category: 'vault',
  },
  'vault.overview': {
    name: 'Vault Overview',
    enabled: getEnvBoolean('FEATURE_VAULT_OVERVIEW', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Vault details',
    category: 'vault',
  },
  'vault.success': {
    name: 'Vault Success',
    enabled: getEnvBoolean('FEATURE_VAULT_SUCCESS', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Success confirmation',
    category: 'vault',
  },
  'vault.dashboard': {
    name: 'Vault Dashboard',
    enabled: getEnvBoolean('FEATURE_VAULT_DASHBOARD', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Vault management',
    category: 'vault',
  },
  'vault.analytics': {
    name: 'Vault Analytics',
    enabled: getEnvBoolean('FEATURE_VAULT_ANALYTICS', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Performance metrics',
    category: 'vault',
  },
  'vault.performance': {
    name: 'Vault Performance',
    enabled: getEnvBoolean('FEATURE_VAULT_PERFORMANCE', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Performance tracking',
    category: 'vault',
  },
  'vault.settings': {
    name: 'Vault Settings',
    enabled: getEnvBoolean('FEATURE_VAULT_SETTINGS', true),
    releaseDate: '2025-11-27',
    phase: 5,
    description: 'Vault configuration',
    category: 'vault',
  },

  // ========== ANALYTICS FEATURES (8 Features) ==========
  'analytics.dashboard': {
    name: 'Analytics Dashboard',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_DASHBOARD', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Main analytics',
    category: 'analytics',
  },
  'analytics.performance': {
    name: 'Performance Analytics',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_PERFORMANCE', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Performance data',
    category: 'analytics',
  },
  'analytics.vault': {
    name: 'Vault Analytics',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_VAULT', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Vault metrics',
    category: 'analytics',
  },
  'analytics.treasury': {
    name: 'Treasury Intelligence',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_TREASURY', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Treasury data',
    category: 'analytics',
  },
  'analytics.revenue': {
    name: 'Revenue Dashboard',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_REVENUE', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Revenue tracking',
    category: 'analytics',
  },
  'analytics.analyzer': {
    name: 'Analyzer Dashboard',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_ANALYZER', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'AI analysis',
    category: 'analytics',
  },
  'analytics.reports': {
    name: 'Advanced Reports',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_REPORTS', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Detailed reports',
    category: 'analytics',
  },
  'analytics.export': {
    name: 'Data Export',
    enabled: getEnvBoolean('FEATURE_ANALYTICS_EXPORT', true),
    releaseDate: '2025-11-28',
    phase: 5,
    description: 'Export data',
    category: 'analytics',
  },
  'analytics.proportionalSelection': {
    name: 'Proportional Member Selection',
    enabled: getEnvBoolean('FEATURE_PROPORTIONAL_SELECTION', true),
    releaseDate: '2025-11-30',
    phase: 3,
    description: 'Weighted member selection based on 90-day contributions',
    category: 'analytics',
    dependencies: ['analytics.analyzer'],
  },
  'analytics.contributionWeights': {
    name: 'Contribution Weights',
    enabled: getEnvBoolean('FEATURE_ANALYZER_CONTRIBUTIONS', true),
    releaseDate: '2025-11-30',
    phase: 3,
    description: 'Retrieve and display member contribution metrics',
    category: 'analytics',
    dependencies: ['analytics.analyzer'],
  },
  'analytics.rotationManagement': {
    name: 'Rotation Management',
    enabled: getEnvBoolean('FEATURE_ANALYZER_ROTATION', true),
    releaseDate: '2025-11-30',
    phase: 3,
    description: 'DAO rotation cycle management and history tracking',
    category: 'analytics',
    dependencies: ['analytics.proportionalSelection', 'analytics.contributionWeights'],
  },

  // ========== MORE MENU FEATURES (8 Features) ==========
  'menu.support': {
    name: 'Support Center',
    enabled: getEnvBoolean('FEATURE_MENU_SUPPORT', true),
    releaseDate: '2025-11-29',
    phase: 1,
    description: 'Help and support',
    category: 'menu',
  },
  'menu.kyc': {
    name: 'KYC Verification',
    enabled: getEnvBoolean('FEATURE_MENU_KYC', true),
    releaseDate: '2025-11-29',
    phase: 2,
    description: 'Verification service',
    category: 'menu',
  },
  'menu.pools': {
    name: 'Investment Pools',
    enabled: getEnvBoolean('FEATURE_MENU_POOLS', true),
    releaseDate: '2025-11-29',
    phase: 3,
    description: 'Pool investment',
    category: 'menu',
  },
  'menu.achievements': {
    name: 'Achievements',
    enabled: getEnvBoolean('FEATURE_MENU_ACHIEVEMENTS', true),
    releaseDate: '2025-11-29',
    phase: 3,
    description: 'Achievement badges',
    category: 'menu',
  },
  'menu.events': {
    name: 'Events',
    enabled: getEnvBoolean('FEATURE_MENU_EVENTS', true),
    releaseDate: '2025-11-29',
    phase: 4,
    description: 'Event calendar',
    category: 'menu',
  },
  'menu.nft': {
    name: 'NFT Marketplace',
    enabled: getEnvBoolean('FEATURE_MENU_NFT', true),
    releaseDate: '2025-11-29',
    phase: 4,
    description: 'NFT trading',
    category: 'menu',
  },
  'menu.escrow': {
    name: 'Escrow Services',
    enabled: getEnvBoolean('FEATURE_MENU_ESCROW', true),
    releaseDate: '2025-11-29',
    phase: 4,
    description: 'Escrow management',
    category: 'menu',
  },
  'menu.rewards': {
    name: 'Rewards Hub',
    enabled: getEnvBoolean('FEATURE_MENU_REWARDS', true),
    releaseDate: '2025-11-29',
    phase: 4,
    description: 'Reward tracking',
    category: 'menu',
  },

  // ========== PAYMENT/CHECKOUT FEATURES (6 Features) ==========
  'payment.checkout': {
    name: 'Checkout',
    enabled: getEnvBoolean('FEATURE_PAYMENT_CHECKOUT', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Payment checkout',
    category: 'payment',
  },
  'payment.methods': {
    name: 'Payment Methods',
    enabled: getEnvBoolean('FEATURE_PAYMENT_METHODS', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Payment options',
    category: 'payment',
  },
  'payment.reconciliation': {
    name: 'Payment Reconciliation',
    enabled: getEnvBoolean('FEATURE_PAYMENT_RECONCILIATION', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Payment tracking',
    category: 'payment',
  },
  'payment.subscription': {
    name: 'Subscription Management',
    enabled: getEnvBoolean('FEATURE_PAYMENT_SUBSCRIPTION', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Manage subscriptions',
    category: 'payment',
  },
  'payment.plans': {
    name: 'Subscription Plans',
    enabled: getEnvBoolean('FEATURE_PAYMENT_PLANS', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Plan selection',
    category: 'payment',
  },
  'payment.revenue': {
    name: 'Revenue Dashboard',
    enabled: getEnvBoolean('FEATURE_PAYMENT_REVENUE', true),
    releaseDate: '2025-11-30',
    phase: 6,
    description: 'Revenue tracking',
    category: 'payment',
  },

  // ========== ADMIN FEATURES (12 Features) ==========
  'admin.dashboard': {
    name: 'Admin Dashboard',
    enabled: getEnvBoolean('FEATURE_ADMIN_DASHBOARD', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Admin panel',
    category: 'admin',
  },
  'admin.health': {
    name: 'Health Monitor',
    enabled: getEnvBoolean('FEATURE_ADMIN_HEALTH', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'System health',
    category: 'admin',
  },
  'admin.daos': {
    name: 'DAO Management',
    enabled: getEnvBoolean('FEATURE_ADMIN_DAOS', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Admin DAO control',
    category: 'admin',
  },
  'admin.moderation': {
    name: 'Moderation',
    enabled: getEnvBoolean('FEATURE_ADMIN_MODERATION', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Content moderation',
    category: 'admin',
  },
  'admin.beta': {
    name: 'Beta Access',
    enabled: getEnvBoolean('FEATURE_ADMIN_BETA', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Beta program control',
    category: 'admin',
  },
  'admin.announcements': {
    name: 'Announcements',
    enabled: getEnvBoolean('FEATURE_ADMIN_ANNOUNCEMENTS', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'System announcements',
    category: 'admin',
  },
  'admin.ai': {
    name: 'AI Monitoring',
    enabled: getEnvBoolean('FEATURE_ADMIN_AI', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'AI system monitoring',
    category: 'admin',
  },
  'admin.pools': {
    name: 'Pool Management',
    enabled: getEnvBoolean('FEATURE_ADMIN_POOLS', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Admin pool control',
    category: 'admin',
  },
  'admin.security': {
    name: 'Security Audit',
    enabled: getEnvBoolean('FEATURE_ADMIN_SECURITY', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Security audits',
    category: 'admin',
  },
  'admin.settings': {
    name: 'Admin Settings',
    enabled: getEnvBoolean('FEATURE_ADMIN_SETTINGS', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Admin configuration',
    category: 'admin',
  },
  'admin.users': {
    name: 'User Management',
    enabled: getEnvBoolean('FEATURE_ADMIN_USERS', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'Admin user control',
    category: 'admin',
  },
  'admin.system': {
    name: 'System Settings',
    enabled: getEnvBoolean('FEATURE_ADMIN_SYSTEM', false),
    releaseDate: '2025-12-01',
    phase: 7,
    description: 'System configuration',
    category: 'admin',
  },

  // ========== SPECIAL FEATURES (10 Features) ==========
  'special.proposals': {
    name: 'Proposals',
    enabled: getEnvBoolean('FEATURE_SPECIAL_PROPOSALS', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Governance proposals',
    category: 'special',
  },
  'special.bridge': {
    name: 'Cross-Chain Bridge',
    enabled: getEnvBoolean('FEATURE_SPECIAL_BRIDGE', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Cross-chain transfers',
    category: 'special',
  },
  'special.reputation': {
    name: 'Reputation Dashboard',
    enabled: getEnvBoolean('FEATURE_SPECIAL_REPUTATION', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'User reputation',
    category: 'special',
  },
  'special.leaderboard': {
    name: 'Reputation Leaderboard',
    enabled: getEnvBoolean('FEATURE_SPECIAL_LEADERBOARD', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Top users',
    category: 'special',
  },
  'special.bounty': {
    name: 'Task & Bounty Board',
    enabled: getEnvBoolean('FEATURE_SPECIAL_BOUNTY', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Bounty tasks',
    category: 'special',
  },
  'special.synchronizer': {
    name: 'Synchronizer Monitor',
    enabled: getEnvBoolean('FEATURE_SPECIAL_SYNCHRONIZER', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Data synchronization',
    category: 'special',
  },
  'special.defender': {
    name: 'Defender Monitor',
    enabled: getEnvBoolean('FEATURE_SPECIAL_DEFENDER', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Security monitoring',
    category: 'special',
  },
  'special.achievements': {
    name: 'Achievement System',
    enabled: getEnvBoolean('FEATURE_SPECIAL_ACHIEVEMENTS', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'User achievements',
    category: 'special',
  },
  'special.billing': {
    name: 'Billing Dashboard',
    enabled: getEnvBoolean('FEATURE_SPECIAL_BILLING', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'Billing management',
    category: 'special',
  },
  'special.success_stories': {
    name: 'Success Stories',
    enabled: getEnvBoolean('FEATURE_SPECIAL_SUCCESS_STORIES', true),
    releaseDate: '2025-12-02',
    phase: 6,
    description: 'User success stories',
    category: 'special',
  },

  // ========== STANDALONE PAGES (13 Features) ==========
  'page.landing': {
    name: 'Landing Page',
    enabled: getEnvBoolean('FEATURE_PAGE_LANDING', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Homepage',
    category: 'page',
  },
  'page.login': {
    name: 'Login',
    enabled: getEnvBoolean('FEATURE_PAGE_LOGIN', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'User login',
    category: 'page',
  },
  'page.register': {
    name: 'Register',
    enabled: getEnvBoolean('FEATURE_PAGE_REGISTER', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'User registration',
    category: 'page',
  },
  'page.forgot_password': {
    name: 'Forgot Password',
    enabled: getEnvBoolean('FEATURE_PAGE_FORGOT_PASSWORD', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Password recovery',
    category: 'page',
  },
  'page.reset_password': {
    name: 'Reset Password',
    enabled: getEnvBoolean('FEATURE_PAGE_RESET_PASSWORD', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Password reset',
    category: 'page',
  },
  'page.pricing': {
    name: 'Pricing Page',
    enabled: getEnvBoolean('FEATURE_PAGE_PRICING', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Pricing information',
    category: 'page',
  },
  'page.blog': {
    name: 'Blog',
    enabled: getEnvBoolean('FEATURE_PAGE_BLOG', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Blog posts',
    category: 'page',
  },
  'page.faq': {
    name: 'FAQ Center',
    enabled: getEnvBoolean('FEATURE_PAGE_FAQ', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Frequently asked questions',
    category: 'page',
  },
  'page.support': {
    name: 'Support',
    enabled: getEnvBoolean('FEATURE_PAGE_SUPPORT', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Support page',
    category: 'page',
  },
  'page.contact': {
    name: 'Contact',
    enabled: getEnvBoolean('FEATURE_PAGE_CONTACT', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Contact form',
    category: 'page',
  },
  'page.terms': {
    name: 'Terms of Service',
    enabled: getEnvBoolean('FEATURE_PAGE_TERMS', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Terms',
    category: 'page',
  },
  'page.privacy': {
    name: 'Privacy Policy',
    enabled: getEnvBoolean('FEATURE_PAGE_PRIVACY', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Privacy policy',
    category: 'page',
  },
  'page.invite': {
    name: 'Invite Handler',
    enabled: getEnvBoolean('FEATURE_PAGE_INVITE', true),
    releaseDate: '2025-11-22',
    phase: 0,
    description: 'Invite token handler',
    category: 'page',
  },

  // ========== MARKETPLACE (5 Features) ==========
  'marketplace.nft': {
    name: 'NFT Marketplace',
    enabled: getEnvBoolean('FEATURE_MARKETPLACE_NFT', true),
    releaseDate: '2025-12-03',
    phase: 7,
    description: 'NFT trading',
    category: 'marketplace',
  },
  'marketplace.pools': {
    name: 'Investment Pools',
    enabled: getEnvBoolean('FEATURE_MARKETPLACE_POOLS', true),
    releaseDate: '2025-12-03',
    phase: 7,
    description: 'Pool discovery',
    category: 'marketplace',
  },
  'marketplace.pool_detail': {
    name: 'Pool Details',
    enabled: getEnvBoolean('FEATURE_MARKETPLACE_POOL_DETAIL', true),
    releaseDate: '2025-12-03',
    phase: 7,
    description: 'Pool information',
    category: 'marketplace',
  },
  'marketplace.pool_search': {
    name: 'Pool Search',
    enabled: getEnvBoolean('FEATURE_MARKETPLACE_POOL_SEARCH', true),
    releaseDate: '2025-12-03',
    phase: 7,
    description: 'Pool discovery',
    category: 'marketplace',
  },
  'marketplace.community': {
    name: 'Community',
    enabled: getEnvBoolean('FEATURE_MARKETPLACE_COMMUNITY', true),
    releaseDate: '2025-12-03',
    phase: 7,
    description: 'Community features',
    category: 'marketplace',
  },

  // ========== INTEGRATION DEMOS (4 Features) ==========
  'demo.morio': {
    name: 'Morio Demo',
    enabled: getEnvBoolean('FEATURE_DEMO_MORIO', false),
    releaseDate: '2025-12-04',
    phase: 8,
    description: 'Morio integration demo',
    category: 'demo',
  },
  'demo.minipay': {
    name: 'MiniPay Demo',
    enabled: getEnvBoolean('FEATURE_DEMO_MINIPAY', false),
    releaseDate: '2025-12-04',
    phase: 8,
    description: 'MiniPay integration demo',
    category: 'demo',
  },
  'demo.maonovault_dash': {
    name: 'Maonovault Dashboard',
    enabled: getEnvBoolean('FEATURE_DEMO_MAONOVAULT_DASH', false),
    releaseDate: '2025-12-04',
    phase: 8,
    description: 'Maonovault dashboard',
    category: 'demo',
  },
  'demo.maonovault_web3': {
    name: 'Maonovault Web3',
    enabled: getEnvBoolean('FEATURE_DEMO_MAONOVAULT_WEB3', false),
    releaseDate: '2025-12-04',
    phase: 8,
    description: 'Maonovault web3',
    category: 'demo',
  },
};

/**
 * Helper function to parse environment variables as booleans
 */
function getEnvBoolean(envVarName: string, defaultValue: boolean): boolean {
  const value = process.env[envVarName];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get all features
 */
export function getAllFeatures(): FeatureVisibilityMap {
  return DEFAULT_FEATURES;
}

/**
 * Get only enabled features
 */
export function getEnabledFeatures(): FeatureVisibilityMap {
  const enabled: FeatureVisibilityMap = {};
  Object.entries(DEFAULT_FEATURES).forEach(([key, feature]) => {
    if (feature.enabled) {
      enabled[key] = feature;
    }
  });
  return enabled;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureKey: string): boolean {
  const feature = DEFAULT_FEATURES[featureKey];
  return feature?.enabled ?? false;
}

/**
 * Get feature by key
 */
export function getFeature(featureKey: string): FeatureConfig | undefined {
  return DEFAULT_FEATURES[featureKey];
}

/**
 * Get features by phase
 */
export function getFeaturesByPhase(phase: number): FeatureVisibilityMap {
  const features: FeatureVisibilityMap = {};
  Object.entries(DEFAULT_FEATURES).forEach(([key, feature]) => {
    if (feature.phase <= phase) {
      features[key] = feature;
    }
  });
  return features;
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: string): FeatureVisibilityMap {
  const features: FeatureVisibilityMap = {};
  Object.entries(DEFAULT_FEATURES).forEach(([key, feature]) => {
    if (feature.category === category) {
      features[key] = feature;
    }
  });
  return features;
}

/**
 * Enable feature flag
 */
export function enableFeature(featureKey: string): void {
  if (DEFAULT_FEATURES[featureKey]) {
    DEFAULT_FEATURES[featureKey].enabled = true;
    // cache.clear(`feature:${featureKey}`); // cache module not available
  }
}

/**
 * Disable feature flag
 */
export function disableFeature(featureKey: string): void {
  if (DEFAULT_FEATURES[featureKey]) {
    DEFAULT_FEATURES[featureKey].enabled = false;
    // cache.clear(`feature:${featureKey}`); // cache module not available
  }
}

/**
 * Release all features of a specific phase
 */
export function releasePhase(phase: number): void {
  Object.entries(DEFAULT_FEATURES).forEach(([, feature]) => {
    if (feature.phase <= phase) {
      feature.enabled = true;
    }
  });
  // cache.clear('features:*'); // cache module not available
}

/**
 * Release all features immediately
 */
export function releaseAllFeatures(): void {
  Object.entries(DEFAULT_FEATURES).forEach(([, feature]) => {
    feature.enabled = true;
  });
  // cache.clear('features:*'); // cache module not available
}

/**
 * Get feature statistics
 */
export function getFeatureStats() {
  const total = Object.keys(DEFAULT_FEATURES).length;
  const enabled = Object.values(DEFAULT_FEATURES).filter(f => f.enabled).length;
  const disabled = total - enabled;
  const byPhase: Record<number, number> = {};
  const byCategory: Record<string, number> = {};

  Object.values(DEFAULT_FEATURES).forEach(feature => {
    byPhase[feature.phase] = (byPhase[feature.phase] || 0) + 1;
    if (feature.category) {
      byCategory[feature.category] = (byCategory[feature.category] || 0) + 1;
    }
  });

  return {
    total,
    enabled,
    disabled,
    enabledPercentage: Math.round((enabled / total) * 100),
    byPhase,
    byCategory,
  };
}

export default {
  getAllFeatures,
  getEnabledFeatures,
  isFeatureEnabled,
  getFeature,
  getFeaturesByPhase,
  getFeaturesByCategory,
  enableFeature,
  disableFeature,
  releasePhase,
  releaseAllFeatures,
  getFeatureStats,
};
