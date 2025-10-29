
export interface EarnOpportunity {
  id: string;
  type: 'task' | 'governance' | 'referral' | 'community';
  description: string;
  reward: string;
  currency: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime?: string;
}

export interface SpendOption {
  merchantId: string;
  merchantName: string;
  category: 'groceries' | 'transport' | 'airtime' | 'utilities' | 'services';
  acceptsMTAA: boolean;
  discountForMTAA?: number;
}

export interface RedemptionRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fee: number;
  minAmount: string;
  maxAmount: string;
}

export interface GDPMetrics {
  totalVolume: number;
  uniqueParticipants: number;
  transactionCount: number;
  velocityScore: number;
  earnVolume: number;
  spendVolume: number;
  redeemVolume: number;
}
