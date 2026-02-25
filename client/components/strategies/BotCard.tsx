import React, { useState } from 'react';
import { ActiveBot } from '../../hooks/useStrategyDeployment';

interface BotCardProps {
  bot: ActiveBot;
  onPause?: (botId: string) => void;
  onResume?: (botId: string) => void;
  onStop?: (botId: string) => void;
  onEdit?: (botId: string) => void;
}

export const BotCard: React.FC<BotCardProps> = ({
  bot,
  onPause,
  onResume,
  onStop,
  onEdit
}) => {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    running: {
      color: 'bg-green-900 text-green-100',
      label: '🟢 Running',
      indicator: 'text-green-500'
    },
    paused: {
      color: 'bg-yellow-900 text-yellow-100',
      label: '🟡 Paused',
      indicator: 'text-yellow-500'
    },
    stopped: {
      color: 'bg-slate-900 text-slate-100',
      label: '⚫ Stopped',
      indicator: 'text-slate-500'
    },
    error: {
      color: 'bg-red-900 text-red-100',
      label: '🔴 Error',
      indicator: 'text-red-500'
    }
  };

  const config = statusConfig[bot.status];
  const winRate = bot.performance.trades > 0
    ? ((bot.performance.wins / bot.performance.trades) * 100).toFixed(0)
    : 0;

  const profitColor = bot.performance.profit >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-white mb-1">{bot.name}</h3>
          <p className="text-sm text-slate-400">{bot.strategyName}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-1 text-xs font-bold rounded ${config.color}`}>
            {config.label}
          </span>
          {bot.errorMessage && (
            <div className="text-xs text-red-400 text-right">
              {bot.errorMessage.substring(0, 30)}...
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-slate-900 rounded">
        <div>
          <div className="text-xs text-slate-500">Trades</div>
          <div className="font-bold text-white">{bot.performance.trades}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Win Rate</div>
          <div className="font-bold text-blue-400">{winRate}%</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Profit</div>
          <div className={`font-bold ${profitColor}`}>
            ${bot.performance.profit.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Capital</div>
          <div className="font-bold text-white">
            ${bot.config.initialCapital.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Deployment Info */}
      <div className="text-xs text-slate-500 mb-3">
        <div>Deployed: {new Date(bot.deployedAt).toLocaleDateString()}</div>
        <div>
          Exchanges: {bot.config.exchanges.map(e => e.toUpperCase()).join(', ')}
        </div>
        {bot.lastTrade && (
          <div>Last Trade: {new Date(bot.lastTrade).toLocaleString()}</div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="relative">
        <button
          onClick={() => setShowActions(!showActions)}
          className="w-full px-3 py-2 text-sm border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors font-bold"
        >
          {showActions ? '▼' : '▶'} Actions
        </button>

        {showActions && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-slate-700 border border-slate-600 rounded shadow-lg z-10 overflow-hidden">
            {bot.status === 'running' && (
              <button
                onClick={() => {
                  onPause?.(bot.id);
                  setShowActions(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-600 transition-colors border-b border-slate-600"
              >
                ⏸️ Pause Bot
              </button>
            )}

            {bot.status === 'paused' && (
              <button
                onClick={() => {
                  onResume?.(bot.id);
                  setShowActions(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-600 transition-colors border-b border-slate-600"
              >
                ▶️ Resume Bot
              </button>
            )}

            <button
              onClick={() => {
                onEdit?.(bot.id);
                setShowActions(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-600 transition-colors border-b border-slate-600"
            >
              ✏️ Edit Config
            </button>

            <button
              onClick={() => {
                onStop?.(bot.id);
                setShowActions(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-red-900 transition-colors text-red-400"
            >
              🛑 Stop Bot
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
