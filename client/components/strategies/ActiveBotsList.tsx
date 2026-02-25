import React from 'react';
import { ActiveBot } from '../../hooks/useStrategyDeployment';
import { BotCard } from './BotCard';

interface ActiveBotsListProps {
  bots: ActiveBot[];
  isLoading?: boolean;
  onPause?: (botId: string) => void;
  onResume?: (botId: string) => void;
  onStop?: (botId: string) => void;
  onEdit?: (botId: string) => void;
}

export const ActiveBotsList: React.FC<ActiveBotsListProps> = ({
  bots,
  isLoading,
  onPause,
  onResume,
  onStop,
  onEdit
}) => {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2 animate-spin">⚙️</div>
        <p className="text-slate-400">Loading bots...</p>
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
        <div className="text-4xl mb-2">🤖</div>
        <p className="text-slate-400">No active bots</p>
        <p className="text-sm text-slate-500 mt-1">
          Deploy your first strategy to get started
        </p>
      </div>
    );
  }

  // Summary statistics
  const totalBots = bots.length;
  const runningBots = bots.filter(b => b.status === 'running').length;
  const totalTrades = bots.reduce((sum, b) => sum + b.performance.trades, 0);
  const totalProfit = bots.reduce((sum, b) => sum + b.performance.profit, 0);
  const totalWins = bots.reduce((sum, b) => sum + b.performance.wins, 0);
  const overallWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-900 rounded-lg border border-blue-700">
          <div className="text-sm text-blue-300">Active Bots</div>
          <div className="text-3xl font-bold text-blue-100">
            {runningBots}/{totalBots}
          </div>
        </div>

        <div className="p-4 bg-green-900 rounded-lg border border-green-700">
          <div className="text-sm text-green-300">Total Profit</div>
          <div className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-100' : 'text-red-100'}`}>
            ${totalProfit.toFixed(2)}
          </div>
        </div>

        <div className="p-4 bg-purple-900 rounded-lg border border-purple-700">
          <div className="text-sm text-purple-300">Total Trades</div>
          <div className="text-3xl font-bold text-purple-100">{totalTrades}</div>
        </div>

        <div className="p-4 bg-orange-900 rounded-lg border border-orange-700">
          <div className="text-sm text-orange-300">Win Rate</div>
          <div className="text-3xl font-bold text-orange-100">{overallWinRate}%</div>
        </div>
      </div>

      {/* Bot Status Filters */}
      <div className="flex flex-wrap gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
        <span className="px-3 py-1 bg-green-900 text-green-100 rounded-full text-sm">
          🟢 {bots.filter(b => b.status === 'running').length} Running
        </span>
        <span className="px-3 py-1 bg-yellow-900 text-yellow-100 rounded-full text-sm">
          🟡 {bots.filter(b => b.status === 'paused').length} Paused
        </span>
        <span className="px-3 py-1 bg-slate-900 text-slate-100 rounded-full text-sm">
          ⚫ {bots.filter(b => b.status === 'stopped').length} Stopped
        </span>
        {bots.filter(b => b.status === 'error').length > 0 && (
          <span className="px-3 py-1 bg-red-900 text-red-100 rounded-full text-sm">
            🔴 {bots.filter(b => b.status === 'error').length} Error
          </span>
        )}
      </div>

      {/* Bot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bots.map(bot => (
          <BotCard
            key={bot.id}
            bot={bot}
            onPause={onPause}
            onResume={onResume}
            onStop={onStop}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
};
