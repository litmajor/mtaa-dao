import { useState, useEffect } from 'react';

export interface UnifiedTrade {
  id: string;
  type: 'manual' | 'bot' | 'strategy';
  source?: string;
  pair: string;
  side: 'BUY' | 'SELL' | 'CLOSE';
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  quantity: number;
  price: number;
  filledQuantity: number;
  totalValue: number;
  fee: number;
  exchange: string;
  pnl?: number;
  createdAt: Date;
}

export const useTradeHistory = () => {
  const [trades, setTrades] = useState<UnifiedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrades = async (filters?: {
    status?: string;
    type?: 'manual' | 'bot' | 'strategy';
    limit?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (filters?.status) query.append('status', filters.status);
      if (filters?.type) query.append('type', filters.type);
      if (filters?.limit) query.append('limit', String(filters.limit));

      const response = await fetch(`/api/trades/history?${query.toString()}`);
      if (!response.ok) throw new Error('Failed to load trades');

      const data = await response.json();
      setTrades(data.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt)
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const getSummary = () => {
    const totalTrades = trades.length;
    const filledTrades = trades.filter(t => t.status === 'filled').length;
    const totalVolume = trades.reduce((sum, t) => sum + t.totalValue, 0);
    const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    const wins = trades.filter(t => t.pnl && t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl && t.pnl < 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return {
      totalTrades,
      filledTrades,
      totalVolume,
      totalFees,
      totalPnL,
      wins,
      losses,
      winRate
    };
  };

  const getTradesByType = () => {
    return {
      manual: trades.filter(t => t.type === 'manual'),
      bot: trades.filter(t => t.type === 'bot'),
      strategy: trades.filter(t => t.type === 'strategy')
    };
  };

  const getTradesByStatus = () => {
    return {
      pending: trades.filter(t => t.status === 'pending'),
      partial: trades.filter(t => t.status === 'partial'),
      filled: trades.filter(t => t.status === 'filled'),
      cancelled: trades.filter(t => t.status === 'cancelled')
    };
  };

  useEffect(() => {
    loadTrades({ limit: 100 });
  }, []);

  return {
    trades,
    loading,
    error,
    loadTrades,
    getSummary,
    getTradesByType,
    getTradesByStatus,
    totalTrades: trades.length
  };
};
