/**
 * Arbitrage Detection Hook
 * Fetch and manage arbitrage opportunities across exchanges
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type { ArbitrageOpportunity } from '@/types/exchanges';

interface TradeProfit {
  buyAmount: number;
  buyTotal: number;
  sellTotal: number;
  fees: number;
  netProfit: number;
  roi: number;
}

interface TradeProfitCalculation {
  tradeAmount: number;
  profit: TradeProfit;
}

/**
 * Fetch arbitrage opportunities for a symbol
 */
export function useArbitrageOpportunities(
  symbol?: string,
  exchanges: string[] = ['binance', 'coinbase', 'kraken', 'bybit', 'kucoin', 'okx'],
  minProfitPercent: number = 0.5
): UseQueryResult<{ opportunities: ArbitrageOpportunity[] }, Error> {
  return useQuery({
    queryKey: ['arbitrage:opportunities', symbol || '', exchanges.join(','), minProfitPercent] as const,
    queryFn: async () => {
      const exchangeParam = exchanges.join(',');
      const response = await fetch(
        `/api/exchanges/arbitrage/opportunities?symbol=${symbol}&exchanges=${exchangeParam}&minProfitPercent=${minProfitPercent}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch arbitrage opportunities');
      }

      return response.json();
    },
    enabled: !!symbol,
    gcTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 30 * 1000, // 30 seconds (volatile data)
    refetchInterval: 10 * 1000 // 10 second refresh
  } as any);
}

/**
 * Fetch best arbitrage opportunity for a symbol
 */
export function useBestArbitrage(
  symbol?: string,
  exchanges?: string[]
): UseQueryResult<{ bestOpportunity: ArbitrageOpportunity | null }, Error> {
  const exchangeParam = exchanges ? exchanges.join(',') : '';

  return useQuery({
    queryKey: ['arbitrage:best', symbol || '', exchangeParam] as const,
    queryFn: async () => {
      let url = `/api/exchanges/arbitrage/best?symbol=${symbol}`;
      if (exchangeParam) {
        url += `&exchanges=${exchangeParam}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch best arbitrage opportunity');
      }

      return response.json();
    },
    enabled: !!symbol,
    gcTime: 5 * 60 * 1000,
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000
  } as any);
}

/**
 * Calculate trade profit for an arbitrage opportunity
 */
export async function calculateArbitrageProfit(
  opportunity: ArbitrageOpportunity,
  tradeAmount: number = 1000
): Promise<TradeProfitCalculation> {
  const response = await fetch('/api/exchanges/arbitrage/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ opportunity, tradeAmount })
  });

  if (!response.ok) {
    throw new Error('Failed to calculate trade profit');
  }

  return response.json();
}

/**
 * Get risk level color
 */
export function getRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    low: '#10b981', // Green
    medium: '#f59e0b', // Amber
    high: '#ef4444', // Red
    very_high: '#7f1d1d' // Dark Red
  };
  return colors[risk] || '#6b7280'; // Gray fallback
}

/**
 * Get risk emoji
 */
export function getRiskEmoji(risk: string): string {
  const emojis: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    very_high: '⛔'
  };
  return emojis[risk] || '⚠️';
}

/**
 * Format profit percentage with color
 */
export function formatProfitPercentage(percent: number): {
  formatted: string;
  color: string;
} {
  const formatted = `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;

  let color = '#6b7280'; // Gray
  if (percent >= 2.0) color = '#10b981'; // Green - Excellent
  else if (percent >= 1.0) color = '#3b82f6'; // Blue - Good
  else if (percent >= 0.5) color = '#f59e0b'; // Amber - Fair
  else if (percent < 0) color = '#ef4444'; // Red - Loss

  return { formatted, color };
}

/**
 * Format volume score badge
 */
export function formatVolumeScore(score: string): {
  label: string;
  color: string;
  emoji: string;
} {
  const scores: Record<
    string,
    { label: string; color: string; emoji: string }
  > = {
    excellent: { label: 'Excellent', color: '#10b981', emoji: '⭐⭐⭐' },
    good: { label: 'Good', color: '#3b82f6', emoji: '⭐⭐' },
    fair: { label: 'Fair', color: '#f59e0b', emoji: '⭐' },
    poor: { label: 'Poor', color: '#ef4444', emoji: '❌' }
  };

  return scores[score] || { label: 'Unknown', color: '#6b7280', emoji: '?' };
}

/**
 * Format spread in basis points
 */
export function formatSpread(spreadPercent: number): string {
  const bps = spreadPercent * 100;
  return `${bps.toFixed(1)} bps`;
}

/**
 * Determine arbitrage opportunity quality
 */
export function getOpportunityQuality(
  profitPercent: number,
  volumeScore: string
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (profitPercent >= 2.0 && (volumeScore === 'excellent' || volumeScore === 'good')) {
    return 'excellent';
  }
  if (profitPercent >= 1.0 && volumeScore !== 'poor') {
    return 'good';
  }
  if (profitPercent >= 0.5) {
    return 'fair';
  }
  return 'poor';
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
