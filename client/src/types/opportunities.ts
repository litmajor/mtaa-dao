/**
 * Opportunity Engine Types
 */

export interface OpportunityData {
  id: string;
  type: 'arbitrage' | 'dex-spread' | 'emerging-token';
  symbol: string;
  chain?: string;
  profitPercent: number;
  profitAmount?: number;
  venue1: string;
  venue2: string;
  price1: number;
  price2: number;
  volume: number;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
  confidence: number; // 0-100
  executionRecommendation?: {
    venue: 'dex' | 'cex';
    dex?: string;
    exchange?: string;
    estimatedOutput: number;
  };
}

export interface ScanResult {
  timestamp: number;
  opportunities: OpportunityData[];
  totalScanned: number;
  profitableFound: number;
}

export interface OpportunityStreamMessage {
  type:
    | 'connected'
    | 'opportunities'
    | 'status'
    | 'error'
    | 'subscribed'
    | 'unsubscribed'
    | 'filter-updated'
    | 'pong';
  data?: OpportunityData[];
  clientId?: string;
  message?: string;
  timestamp: number;
  engine?: {
    isScanning: boolean;
    cacheSize: number;
    listenerCount: number;
  };
  connectedClients?: number;
  subscribedTypes?: string[];
  minProfitPercent?: number;
}
