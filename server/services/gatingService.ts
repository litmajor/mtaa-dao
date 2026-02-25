import { User } from '../../shared/schema';
import { create } from 'zustand';
import { exchangeRateService } from './exchangeRateService';

export interface GatingRule {
  type: 'age' | 'balance' | 'reputation' | 'manual' | 'none';
  value?: Record<string, any>;
  explanation: string;
}

export interface GatingStatus {
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
  currency?: string; // Currency of amountNeeded (user's preferred currency)
}

// Define rules for each feature
export const GATING_RULES: Record<string, GatingRule> = {
  'trading.dex': {
    type: 'manual',
    explanation: 'Enable Advanced Mode to access trading',
  },
  'vault.yield': {
    type: 'none',
    explanation: 'Available immediately to all users - start earning with any amount',
  },
  'proposal.create': {
    type: 'age',
    value: { minDays: 7 },
    explanation: 'Available after 7 days of account age ',
  },
  'ai.assistant': {
    type: 'reputation',
    value: { minReputation: 1 },
    explanation: 'Morio is accessible to all users with reputation level 1 or higher',
  },
  'dao.join': {
    type: 'none',
    explanation: 'Available immediately',
  },
  'governance.vote': {
    type: 'none',
    explanation: 'Available immediately',
  },
  'dao.create': {
    type: 'none',
    explanation: 'Click Create DAO to create DAOs',
  },
  'dao.create.cooldown': {
    type: 'age',
    value: { minDays: 5 },
    explanation: 'You can create a new DAO every 5 days',
  },
  'maonovault.access': {
    type: 'none',
    explanation: 'Available immediately to all users - explore investment opportunities',
  },
  'nft.minting': {
    type: 'reputation',
    value: { minReputation: 5 },
    explanation: 'NFT Minting is available to users with reputation level 5 or higher',
  },
    'beta.features': {
    type: 'manual',
    explanation: 'Enable Advanced Mode to access beta features',
  },

};


export function checkFeatureGating(
  feature: string,
  user: User
): GatingStatus {
  const rule = GATING_RULES[feature];

  if (!rule) {
    return { isAvailable: true };
  }

  switch (rule.type) {
    case 'none':
      return { isAvailable: true };

    case 'age': {
      const createdAt = new Date(user.createdAt).getTime();
      const nowMs = Date.now();
      const daysOld = Math.floor((nowMs - createdAt) / (1000 * 60 * 60 * 24));
      const minDays = rule.value?.minDays || 0;

      if (daysOld < minDays) {
        return {
          isAvailable: false,
          reason: rule.explanation,
          daysUntilAvailable: minDays - daysOld,
        };
      }
      return { isAvailable: true };
    }

    case 'balance': {
      // Balance amounts in GATING_RULES are in KSH (base currency)
      const minAmountKSH = rule.value?.minAmount || 0;
      const userBalanceKSH = parseFloat(user.balance?.toString() || '0');
      
      // Get user's preferred currency (default: KES/KSH)
      const preferredCurrency = (user.preferredCurrency || 'KES').toUpperCase();
      
      if (userBalanceKSH < minAmountKSH) {
        const shortfallKSH = minAmountKSH - userBalanceKSH;
        
        // Convert shortfall to user's preferred currency for display
        let amountNeeded = shortfallKSH;
        let displayCurrency = 'KES';
        
        if (preferredCurrency !== 'KES') {
          // Currency conversion logic (simplified for common currencies)
          const conversionRates: Record<string, number> = {
            'USD': 1 / 129, // KES to USD (default rate)
            'EUR': 1 / 140, // KES to EUR (approximate)
            'GBP': 1 / 160, // KES to GBP (approximate)
            'GHS': 1 / 7,   // KES to GHS (approximate)
            'ZAR': 1 / 7,   // KES to ZAR (approximate)
            'UGX': 1 / 0.03, // KES to UGX (approximate)
            'NGN': 1 / 0.35, // KES to NGN (approximate)
          };
          
          const rate = conversionRates[preferredCurrency] || 1;
          amountNeeded = Math.ceil(shortfallKSH * rate);
          displayCurrency = preferredCurrency;
        }
        
        return {
          isAvailable: false,
          reason: rule.explanation,
          amountNeeded: amountNeeded,
          currency: displayCurrency,
        };
      }
      return { isAvailable: true };
    }

    case 'reputation': {
      const minReputation = rule.value?.minReputation || 0;
      if ((user.reputation || 0) < minReputation) {
        return {
          isAvailable: false,
          reason: rule.explanation,
        };
      }
      return { isAvailable: true };
    }

    case 'manual': {
      if (!(user.advancedMode || false)) {
        return {
          isAvailable: false,
          reason: rule.explanation,
        };
      }
      return { isAvailable: true };
    }

    default:
      return { isAvailable: true };
  }
}
