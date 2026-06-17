import { useState } from 'react';
import { Strategy, StrategyInput, RiskControl } from './useStrategyRegistry';

export interface DeploymentConfig {
  strategyId: string;
  name: string;
  inputs: Record<string, any>;
  riskControl: RiskControl;
  exchanges: string[];
  pairs: string[];
  initialCapital: number;
  notes?: string;
}

export interface ActiveBot {
  id: string;
  strategyId: string;
  strategyName: string;
  name: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  deployedAt: Date;
  config: DeploymentConfig;
  performance: {
    trades: number;
    wins: number;
    losses: number;
    profit: number;
    profitPercent: number;
    openPositions: number;
  };
  lastTrade?: Date;
  nextTrade?: Date;
  errorMessage?: string;
}

export const useStrategyDeployment = () => {
  const [bots, setBots] = useState<ActiveBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deployBot = async (
    strategy: Strategy,
    inputValues: Record<string, any>,
    riskControl: RiskControl,
    exchanges: string[],
    pairs: string[],
    initialCapital: number,
    botName: string
  , options?: { dry_run?: boolean }
  ): Promise<ActiveBot> => {
    try {
      setLoading(true);
      setError(null);

      const config: DeploymentConfig = {
        strategyId: strategy.id,
        name: botName,
        inputs: inputValues,
        riskControl,
        exchanges,
        pairs,
        initialCapital
      };

      // If this is a live deploy, quick client-side 2FA check to improve UX
      if (options?.dry_run === false) {
        const check = await fetch('/api/v1/settings/2fa/check', { method: 'POST' });
        if (check.status === 403) throw new Error('2FA verification required');
      }

      // API call to deploy (v1 route)
      const response = await fetch('/api/v1/bots/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, enableRealTrading: options?.dry_run === false })
      });

      if (!response.ok) {
        throw new Error('Failed to deploy bot');
      }

      const botData = await response.json();
      const newBot: ActiveBot = {
        id: botData.id,
        strategyId: strategy.id,
        strategyName: strategy.name,
        name: botName,
        status: 'running',
        deployedAt: new Date(),
        config,
        performance: {
          trades: 0,
          wins: 0,
          losses: 0,
          profit: 0,
          profitPercent: 0,
          openPositions: 0
        }
      };

      setBots([...bots, newBot]);
      return newBot;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deployment failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const pauseBot = async (botId: string): Promise<void> => {
    try {
      await fetch(`/api/bots/${botId}/pause`, { method: 'POST' });
      setBots(bots.map(b => (b.id === botId ? { ...b, status: 'paused' } : b)));
    } catch (err) {
      throw new Error('Failed to pause bot');
    }
  };

  const resumeBot = async (botId: string): Promise<void> => {
    try {
      await fetch(`/api/bots/${botId}/resume`, { method: 'POST' });
      setBots(bots.map(b => (b.id === botId ? { ...b, status: 'running' } : b)));
    } catch (err) {
      throw new Error('Failed to resume bot');
    }
  };

  const stopBot = async (botId: string): Promise<void> => {
    try {
      await fetch(`/api/bots/${botId}/stop`, { method: 'POST' });
      setBots(bots.map(b => (b.id === botId ? { ...b, status: 'stopped' } : b)));
    } catch (err) {
      throw new Error('Failed to stop bot');
    }
  };

  const updateBotConfig = async (
    botId: string,
    updates: Partial<DeploymentConfig>
  ): Promise<void> => {
    try {
      await fetch(`/api/bots/${botId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      setBots(
        bots.map(b =>
          b.id === botId
            ? { ...b, config: { ...b.config, ...updates } }
            : b
        )
      );
    } catch (err) {
      throw new Error('Failed to update bot configuration');
    }
  };

  const deleteBot = async (botId: string): Promise<void> => {
    try {
      await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      setBots(bots.filter(b => b.id !== botId));
    } catch (err) {
      throw new Error('Failed to delete bot');
    }
  };

  const getBot = (botId: string): ActiveBot | undefined => {
    return bots.find(b => b.id === botId);
  };

  const getBotsByStrategy = (strategyId: string): ActiveBot[] => {
    return bots.filter(b => b.strategyId === strategyId);
  };

  const getRunningBots = (): ActiveBot[] => {
    return bots.filter(b => b.status === 'running');
  };

  const getTotalPerformance = () => {
    const totals = bots.reduce(
      (acc, bot) => ({
        trades: acc.trades + bot.performance.trades,
        wins: acc.wins + bot.performance.wins,
        losses: acc.losses + bot.performance.losses,
        profit: acc.profit + bot.performance.profit,
        openPositions: acc.openPositions + bot.performance.openPositions
      }),
      { trades: 0, wins: 0, losses: 0, profit: 0, openPositions: 0 }
    );

    return {
      ...totals,
      winRate: totals.trades > 0 ? (totals.wins / totals.trades) * 100 : 0,
      profitFactor:
        totals.losses > 0
          ? totals.wins / totals.losses
          : totals.wins > 0
            ? totals.wins
            : 0
    };
  };

  return {
    bots,
    loading,
    error,
    deployBot,
    pauseBot,
    resumeBot,
    stopBot,
    updateBotConfig,
    deleteBot,
    getBot,
    getBotsByStrategy,
    getRunningBots,
    getTotalPerformance,
    loadBots: async () => {
      try {
        const response = await fetch('/api/bots');
        const data = await response.json();
        setBots(data);
      } catch (err) {
        setError('Failed to load bots');
      }
    }
  };
};
