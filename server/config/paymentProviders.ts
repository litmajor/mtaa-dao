/**
 * Payment Provider Configuration
 * Handles Flutterwave, Paystack, Paychant, Kotani, M-Pesa, Airtel Money, Onramper
 */

export interface PaymentProviderConfig {
  name: string;
  id: string;
  enabled: boolean;
  apiKey: string;
  secretKey?: string;
  publicKey?: string;
  baseUrl: string;
  webhookUrl: string;
  fees: {
    localCards?: number;
    internationalCards?: number;
    mobileMoney?: number | { min: number; max: number; fee: number }[]; // Support tiered fees
    transfers?: string | number;
    ramps?: number; // For crypto ramps
  };
  currencies: string[];
  minAmount: number;
  maxAmount: number;
  setupFee: number;
  monthlyFee: number;
  description: string;
}

const env = process.env;

// Flutterwave Configuration (Matches Jan 2026 Kenyan pricing)
export const flutterwaveConfig: PaymentProviderConfig = {
  name: 'Flutterwave',
  id: 'flutterwave',
  enabled: env.FLUTTERWAVE_ENABLED === 'true',
  apiKey: env.FLUTTERWAVE_API_KEY || '',
  secretKey: env.FLUTTERWAVE_SECRET_KEY,
  publicKey: env.FLUTTERWAVE_PUBLIC_KEY,
  baseUrl: env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3',
  webhookUrl: env.FLUTTERWAVE_WEBHOOK_URL || '',
  fees: {
    localCards: 0.032, // 3.2%
    internationalCards: 0.048, // 4.8%
    mobileMoney: 0.029, // 2.9% for M-Pesa
    transfers: '100', // KES 100 flat
  },
  currencies: ['KES', 'USD', 'EUR', 'GBP', 'ZAR', 'NGN'],
  minAmount: 50,
  maxAmount: 500000,
  setupFee: 0,
  monthlyFee: 0,
  description: 'Primary fiat billing gateway. Kenya-specific with fast approval (1-3 days). Volume discounts available.',
};

// Paystack Configuration (Updated for Kenya-specific rates as of Jan 2026)
export const paystackConfig: PaymentProviderConfig = {
  name: 'Paystack',
  id: 'paystack',
  enabled: env.PAYSTACK_ENABLED === 'true',
  apiKey: env.PAYSTACK_API_KEY || '',
  secretKey: env.PAYSTACK_SECRET_KEY,
  baseUrl: env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  webhookUrl: env.PAYSTACK_WEBHOOK_URL || '',
  fees: {
    localCards: 0.029, // 2.9% for Kenyan cards
    internationalCards: 0.038, // 3.8%
    mobileMoney: 0.015, // 1.5% for M-Pesa/USSD
  },
  currencies: ['KES', 'USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS'],
  minAmount: 10,
  maxAmount: 500000,
  setupFee: 0,
  monthlyFee: 0,
  description: 'Global/recurring payments. Kenya office seamless. Free API sandboxes. Discounts for high volume (>10M KES/mo).',
};

// Paychant Configuration
export const paychantConfig: PaymentProviderConfig = {
  name: 'Paychant',
  id: 'paychant',
  enabled: env.PAYCHANT_ENABLED === 'true',
  apiKey: env.PAYCHANT_API_KEY || '',
  baseUrl: env.PAYCHANT_BASE_URL || 'https://api.paychant.com',
  webhookUrl: env.PAYCHANT_WEBHOOK_URL || '',
  fees: {
    ramps: 0.015, // Avg. 1-2% per ramp (variable by country/action)
  },
  currencies: ['KES', 'USD', 'USDC', 'USDT'],
  minAmount: 50,
  maxAmount: 500000,
  setupFee: 0,
  monthlyFee: 0,
  description: 'Low-friction ramp alternative. No subscription. Processing times under 5 min. Fees vary slightly by ramp type.',
};

// Kotani Pay Configuration
export const kotaniConfig: PaymentProviderConfig = {
  name: 'Kotani',
  id: 'kotani',
  enabled: env.KOTANI_ENABLED === 'true',
  apiKey: env.KOTANI_API_KEY || '',
  secretKey: env.KOTANI_SECRET_KEY,
  baseUrl: env.KOTANI_BASE_URL || 'https://api.kotanipay.com',
  webhookUrl: env.KOTANI_WEBHOOK_URL || '',
  fees: {
    ramps: 0.01, // ~1% interchange per transaction (low fees emphasized in recent investments)
  },
  currencies: ['KES', 'USD', 'USDC', 'cUSD'],
  minAmount: 50,
  maxAmount: 500000,
  setupFee: 0,
  monthlyFee: 0,
  description: 'Strong for cUSD/USDC to M-Pesa/USSD. Recent Tether investment. No monthly fees.',
};

// M-Pesa Configuration (Updated with tiered fees example; direct API often passes fees to user)
export const mpesaConfig: PaymentProviderConfig = {
  name: 'M-Pesa',
  id: 'mpesa',
  enabled: env.MPESA_ENABLED === 'true',
  apiKey: env.MPESA_API_KEY || '',
  secretKey: env.MPESA_SECRET_KEY,
  publicKey: env.MPESA_PUBLIC_KEY,
  baseUrl: env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
  webhookUrl: env.MPESA_WEBHOOK_URL || '',
  fees: {
    mobileMoney: [ // Example tiered withdrawal fees (2026); adjust for send/transfer as needed
      { min: 1, max: 100, fee: 0 },
      { min: 101, max: 500, fee: 7 },
      { min: 501, max: 1000, fee: 13 },
      // ... add more tiers up to max (full table available on Safaricom site)
      { min: 50001, max: 150000, fee: 108 },
    ],
  },
  currencies: ['KES'],
  minAmount: 1,
  maxAmount: 150000, // Updated 2026 limit per transaction
  setupFee: 0,
  monthlyFee: 0,
  description: 'Direct M-Pesa integration. Local Kenya standard. Fees tiered; often passed to users.',
};

// Airtel Money Configuration (Updated limits and tiered fees)
export const airtelConfig: PaymentProviderConfig = {
  name: 'Airtel Money',
  id: 'airtel',
  enabled: env.AIRTEL_ENABLED === 'true',
  apiKey: env.AIRTEL_API_KEY || '',
  secretKey: env.AIRTEL_SECRET_KEY,
  baseUrl: env.AIRTEL_BASE_URL || 'https://api.airtel.africa',
  webhookUrl: env.AIRTEL_WEBHOOK_URL || '',
  fees: {
    mobileMoney: [ // Example tiered off-net transfer fees (free on-net); 2026 updates
      { min: 1, max: 100, fee: 0 },
      { min: 101, max: 500, fee: 6 },
      { min: 501, max: 1000, fee: 11 },
      // ... full tiers up to max
      { min: 50001, max: 250000, fee: 105 },
    ],
  },
  currencies: ['KES', 'UGX', 'TZS', 'RWF', 'BIF', 'CDF'],
  minAmount: 1,
  maxAmount: 250000, // Updated 2026 limit per transaction (daily 500,000)
  setupFee: 0,
  monthlyFee: 0,
  description: 'Pan-African mobile money. Multiple country support. Free on-net transfers.',
};

// Onramper Configuration (Suggested addition for ramp aggregation)
export const onramperConfig: PaymentProviderConfig = {
  name: 'Onramper',
  id: 'onramper',
  enabled: env.ONRAMPER_ENABLED === 'true',
  apiKey: env.ONRAMPER_API_KEY || '',
  baseUrl: env.ONRAMPER_BASE_URL || 'https://api.onramper.com',
  webhookUrl: env.ONRAMPER_WEBHOOK_URL || '',
  fees: {
    ramps: 0.02, // Avg. 1-2.5% (aggregated; no added fees on top of providers)
  },
  currencies: ['KES', 'USD', 'USDC', 'USDT', 'cUSD'],
  minAmount: 100,
  maxAmount: 1000000,
  setupFee: 0,
  monthlyFee: 199, // Essentials plan; annual discount available
  description: 'Ramp aggregator for redundancy (e.g., TransFi/Fonbnk). USSD support via partners. 14-day free trial.',
};

// All payment providers
export const paymentProviders = {
  flutterwave: flutterwaveConfig,
  paystack: paystackConfig,
  paychant: paychantConfig,
  kotani: kotaniConfig,
  mpesa: mpesaConfig,
  airtel: airtelConfig,
  onramper: onramperConfig,
};

export type PaymentProviderType = keyof typeof paymentProviders;

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: string): PaymentProviderConfig | null {
  const provider = paymentProviders[providerId as PaymentProviderType];
  return provider || null;
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): PaymentProviderConfig[] {
  return Object.values(paymentProviders).filter((p) => p.enabled);
}

/**
 * Get provider by deposit source
 */
export function getProviderBySource(source: string): PaymentProviderConfig | null {
  const sourceMap: Record<string, string> = {
    offramp_flutterwave: 'flutterwave',
    offramp_paystack: 'paystack',
    offramp_paychant: 'paychant',
    offramp_kotani: 'kotani',
    offramp_mpesa: 'mpesa',
    offramp_airtel: 'airtel',
    offramp_onramper: 'onramper',
  };

  const providerId = sourceMap[source];
  return providerId ? getProviderConfig(providerId) : null;
}

/**
 * Get provider by withdrawal destination
 */
export function getProviderByDestination(destination: string): PaymentProviderConfig | null {
  return getProviderBySource(destination);
}

/**
 * Calculate transaction fee based on provider, amount, and type (handles percentage or tiered)
 */
export function calculateTransactionFee(
  provider: PaymentProviderConfig,
  amount: number,
  type: 'localCard' | 'internationalCard' | 'mobileMoney' | 'transfer' | 'ramp' = 'localCard'
): number {
  const feeKeyMap = {
    localCard: 'localCards',
    internationalCard: 'internationalCards',
    mobileMoney: 'mobileMoney',
    transfer: 'transfers',
    ramp: 'ramps',
  };
  const feeValue = provider.fees[feeKeyMap[type]];

  if (typeof feeValue === 'number') {
    return Math.round(amount * feeValue * 100) / 100;
  } else if (Array.isArray(feeValue)) {
    // Tiered fees (e.g., M-Pesa/Airtel)
    const tier = feeValue.find((t) => amount >= t.min && amount <= t.max);
    return tier ? tier.fee : 0; // Default to 0 if no tier matches
  } else if (typeof feeValue === 'string') {
    // Flat fee (e.g., transfers)
    return parseFloat(feeValue);
  }
  return 0;
}

/**
 * Get fee structure for provider
 */
export function getProviderFeeStructure(providerId: string) {
  const provider = getProviderConfig(providerId);
  if (!provider) return null;

  const formatFee = (fee: number | { min: number; max: number; fee: number }[] | string | undefined) => {
    if (typeof fee === 'number') return `${(fee * 100).toFixed(1)}%`;
    if (Array.isArray(fee)) return 'Tiered (see docs)';
    return fee || 'N/A';
  };

  return {
    provider: provider.name,
    setupFee: provider.setupFee,
    monthlyFee: provider.monthlyFee,
    transactionFees: {
      localCards: formatFee(provider.fees.localCards),
      internationalCards: formatFee(provider.fees.internationalCards),
      mobileMoney: formatFee(provider.fees.mobileMoney),
      transfers: formatFee(provider.fees.transfers),
      ramps: formatFee(provider.fees.ramps),
    },
    minAmount: provider.minAmount,
    maxAmount: provider.maxAmount,
    supportedCurrencies: provider.currencies,
  };
}