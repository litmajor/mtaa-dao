import { useState, useEffect } from 'react';

export interface StrategyInput {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array' | 'enum';
  value: any;
  default: any;
  min?: number;
  max?: number;
  options?: string[];
  description: string;
  unit?: string;
}

export interface StrategyCondition {
  type: 'technical' | 'fundamental' | 'custom' | 'time' | 'manual';
  indicator?: string;
  operator: '>' | '<' | '==' | '!=';
  value: number | string;
  duration?: string;
  description: string;
}

export interface StrategyAction {
  type: 'market_order' | 'limit_order' | 'grid' | 'dca' | 'webhook';
  side: 'BUY' | 'SELL' | 'CLOSE';
  pair: string;
  amount: number | 'dynamic';
  price?: number;
  exchanges: string[];
  route?: 'smart-routing' | 'single' | 'grid';
  metadata?: Record<string, any>;
}

export interface RiskControl {
  maxOpenTrades: number;
  maxLossPerTrade: number;
  maxDailyLoss: number;
  maxLossStreak: number;
  takeProfit: number;
  stopLoss: number;
  maxLeverage: number;
  paused: boolean;
  maxDrawdown: number;
}

export interface StrategyMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  currentDrawdown: number;
  totalProfit: number;
  sharpeRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeTime: string;
  lastUpdated: Date;
}

export interface Strategy {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'technical' | 'dca' | 'grid' | 'arbitrage' | 'ml' | 'community' | 'custom';
  inputs: StrategyInput[];
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  riskControl: RiskControl;
  metrics?: StrategyMetrics;
  backtestResults?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  popularity: number; // 0-100
  verified: boolean;
  tags: string[];
}

export const useStrategyRegistry = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockStrategies = getMockStrategies();
      setStrategies(mockStrategies);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const getStrategyById = (id: string): Strategy | undefined => {
    return strategies.find(s => s.id === id);
  };

  const getStrategiesByCategory = (category: string): Strategy[] => {
    return strategies.filter(s => s.category === category);
  };

  const searchStrategies = (query: string): Strategy[] => {
    const q = query.toLowerCase();
    return strategies.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(tag => tag.toLowerCase().includes(q))
    );
  };

  const deployStrategy = async (strategyId: string, config: any): Promise<string> => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/strategies/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, config })
      });

      if (!response.ok) throw new Error('Deployment failed');
      const data = await response.json();
      return data.botId;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Deployment failed');
    }
  };

  return {
    strategies,
    loading,
    error,
    loadStrategies,
    getStrategyById,
    getStrategiesByCategory,
    searchStrategies,
    deployStrategy
  };
};

// Mock strategies for demo
function getMockStrategies(): Strategy[] {
  return [
    {
      id: 'rsi-oversold',
      name: 'RSI Oversold Hunter',
      version: '1.0.0',
      author: 'DAO Collective',
      description: 'Buy when RSI < 30 (oversold), sell when RSI > 70',
      category: 'technical',
      verified: true,
      popularity: 85,
      tags: ['rsi', 'mean-reversion', 'beginner-friendly'],
      inputs: [
        {
          name: 'buyThreshold',
          type: 'number',
          value: 30,
          default: 30,
          min: 0,
          max: 50,
          unit: 'percent',
          description: 'RSI level to trigger buy signal'
        },
        {
          name: 'sellThreshold',
          type: 'number',
          value: 70,
          default: 70,
          min: 50,
          max: 100,
          unit: 'percent',
          description: 'RSI level to trigger sell signal'
        },
        {
          name: 'period',
          type: 'number',
          value: 14,
          default: 14,
          min: 5,
          max: 30,
          description: 'RSI calculation period'
        },
        {
          name: 'timeframe',
          type: 'enum',
          value: '1h',
          default: '1h',
          options: ['5m', '15m', '1h', '4h', '1d'],
          description: 'Trading timeframe'
        }
      ],
      conditions: [
        {
          type: 'technical',
          indicator: 'RSI',
          operator: '<',
          value: 30,
          duration: '5 minutes',
          description: 'RSI below 30 (oversold)'
        }
      ],
      actions: [
        {
          type: 'market_order',
          side: 'BUY',
          pair: 'BTC/USDT',
          amount: 0.1,
          exchanges: ['binance'],
          route: 'single'
        }
      ],
      riskControl: {
        maxOpenTrades: 3,
        maxLossPerTrade: 2,
        maxDailyLoss: 5,
        maxLossStreak: 3,
        takeProfit: 10,
        stopLoss: 5,
        maxLeverage: 1,
        paused: false,
        maxDrawdown: 15
      },
      metrics: {
        totalTrades: 127,
        winRate: 0.65,
        profitFactor: 2.1,
        averageWin: 125,
        averageLoss: 60,
        largestWin: 450,
        largestLoss: 200,
        currentDrawdown: 3.2,
        totalProfit: 2500,
        sharpeRatio: 1.8,
        maxConsecutiveWins: 7,
        maxConsecutiveLosses: 3,
        avgTradeTime: '2h 30m',
        lastUpdated: new Date()
      },
      backtestResults: {
        totalReturn: 25.5,
        sharpeRatio: 1.8,
        maxDrawdown: 12,
        winRate: 0.65
      }
    },
    {
      id: 'dca-daily',
      name: 'Daily DCA Builder',
      version: '1.0.0',
      author: 'Community',
      description: 'Dollar-cost average daily purchases at fixed times',
      category: 'dca',
      verified: true,
      popularity: 92,
      tags: ['dca', 'long-term', 'passive', 'beginner-friendly'],
      inputs: [
        {
          name: 'frequency',
          type: 'enum',
          value: 'daily',
          default: 'daily',
          options: ['hourly', 'daily', 'weekly'],
          description: 'Purchase frequency'
        },
        {
          name: 'amount',
          type: 'number',
          value: 100,
          default: 100,
          min: 10,
          max: 10000,
          unit: 'USD',
          description: 'Purchase amount per interval'
        },
        {
          name: 'pairs',
          type: 'array',
          value: ['BTC/USDT', 'ETH/USDT'],
          default: ['BTC/USDT'],
          description: 'Trading pairs to DCA'
        },
        {
          name: 'executionTime',
          type: 'string',
          value: '09:00 UTC',
          default: '09:00 UTC',
          description: 'Time to execute purchases'
        }
      ],
      conditions: [
        {
          type: 'time',
          operator: '==',
          value: 'daily 09:00 UTC',
          description: 'Daily at 9:00 AM UTC'
        }
      ],
      actions: [
        {
          type: 'dca',
          side: 'BUY',
          pair: 'BTC/USDT',
          amount: 100,
          exchanges: ['binance', 'kraken'],
          route: 'smart-routing'
        }
      ],
      riskControl: {
        maxOpenTrades: 10,
        maxLossPerTrade: 0,
        maxDailyLoss: 0,
        maxLossStreak: 0,
        takeProfit: 0,
        stopLoss: 0,
        maxLeverage: 1,
        paused: false,
        maxDrawdown: 0
      },
      metrics: {
        totalTrades: 365,
        winRate: 0.68,
        profitFactor: 1.5,
        averageWin: 85,
        averageLoss: 40,
        largestWin: 350,
        largestLoss: 150,
        currentDrawdown: 8.5,
        totalProfit: 3200,
        sharpeRatio: 0.9,
        maxConsecutiveWins: 45,
        maxConsecutiveLosses: 12,
        avgTradeTime: '1d',
        lastUpdated: new Date()
      }
    },
    {
      id: 'grid-btc',
      name: 'Bitcoin Grid Master',
      version: '1.0.0',
      author: 'DAO Collective',
      description: 'Grid trading strategy with auto rebalancing',
      category: 'grid',
      verified: true,
      popularity: 78,
      tags: ['grid', 'btc', 'range-trading', 'intermediate'],
      inputs: [
        {
          name: 'gridSize',
          type: 'number',
          value: 10,
          default: 10,
          min: 3,
          max: 50,
          description: 'Number of grid levels'
        },
        {
          name: 'gridSpacing',
          type: 'number',
          value: 2,
          default: 2,
          min: 0.5,
          max: 10,
          unit: 'percent',
          description: 'Spacing between grid levels'
        },
        {
          name: 'baseAmount',
          type: 'number',
          value: 1,
          default: 1,
          min: 0.01,
          max: 100,
          unit: 'BTC',
          description: 'Total amount to deploy'
        },
        {
          name: 'leverage',
          type: 'number',
          value: 1,
          default: 1,
          min: 1,
          max: 5,
          description: 'Leverage multiplier'
        }
      ],
      conditions: [
        {
          type: 'custom',
          operator: '==',
          value: 'price within grid range',
          description: 'Price movement detected'
        }
      ],
      actions: [
        {
          type: 'grid',
          side: 'BUY',
          pair: 'BTC/USDT',
          amount: 1,
          exchanges: ['binance'],
          route: 'single',
          metadata: { gridSize: 10, gridSpacing: 2 }
        }
      ],
      riskControl: {
        maxOpenTrades: 10,
        maxLossPerTrade: 5,
        maxDailyLoss: 10,
        maxLossStreak: 5,
        takeProfit: 20,
        stopLoss: 3,
        maxLeverage: 5,
        paused: false,
        maxDrawdown: 20
      },
      metrics: {
        totalTrades: 245,
        winRate: 0.72,
        profitFactor: 2.8,
        averageWin: 320,
        averageLoss: 115,
        largestWin: 1200,
        largestLoss: 450,
        currentDrawdown: 5.1,
        totalProfit: 8500,
        sharpeRatio: 2.2,
        maxConsecutiveWins: 12,
        maxConsecutiveLosses: 4,
        avgTradeTime: '4h 15m',
        lastUpdated: new Date()
      }
    },
    {
      id: 'macd-crossover',
      name: 'MACD Momentum',
      version: '1.0.0',
      author: 'Community',
      description: 'MACD crossover momentum strategy',
      category: 'technical',
      verified: true,
      popularity: 72,
      tags: ['macd', 'momentum', 'trending', 'intermediate'],
      inputs: [
        {
          name: 'fastPeriod',
          type: 'number',
          value: 12,
          default: 12,
          min: 5,
          max: 30,
          description: 'Fast EMA period'
        },
        {
          name: 'slowPeriod',
          type: 'number',
          value: 26,
          default: 26,
          min: 10,
          max: 50,
          description: 'Slow EMA period'
        },
        {
          name: 'signalPeriod',
          type: 'number',
          value: 9,
          default: 9,
          min: 3,
          max: 20,
          description: 'Signal line period'
        },
        {
          name: 'timeframe',
          type: 'enum',
          value: '4h',
          default: '4h',
          options: ['1h', '4h', '1d'],
          description: 'Trading timeframe'
        }
      ],
      conditions: [
        {
          type: 'technical',
          indicator: 'MACD',
          operator: '>',
          value: 0,
          duration: '10 minutes',
          description: 'MACD crosses above signal line'
        }
      ],
      actions: [
        {
          type: 'market_order',
          side: 'BUY',
          pair: 'ETH/USDT',
          amount: 1,
          exchanges: ['binance', 'kraken'],
          route: 'smart-routing'
        }
      ],
      riskControl: {
        maxOpenTrades: 2,
        maxLossPerTrade: 3,
        maxDailyLoss: 8,
        maxLossStreak: 2,
        takeProfit: 15,
        stopLoss: 4,
        maxLeverage: 2,
        paused: false,
        maxDrawdown: 18
      }
    }
  ];
}
