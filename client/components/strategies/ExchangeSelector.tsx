import React, { useState } from 'react';

interface Exchange {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
  volume24h?: number;
  fees?: number;
  supports?: string[];
}

const AVAILABLE_EXCHANGES: Exchange[] = [
  {
    id: 'binance',
    name: 'Binance',
    logo: '🟡',
    connected: true,
    volume24h: 20000000000,
    fees: 0.1,
    supports: ['spot', 'margin', 'futures', 'swap']
  },
  {
    id: 'kraken',
    name: 'Kraken',
    logo: '🟣',
    connected: true,
    volume24h: 8500000000,
    fees: 0.16,
    supports: ['spot', 'margin', 'futures']
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: '🔵',
    connected: true,
    volume24h: 7200000000,
    fees: 0.5,
    supports: ['spot', 'margin']
  },
  {
    id: 'bybit',
    name: 'Bybit',
    logo: '⚫',
    connected: false,
    volume24h: 6800000000,
    fees: 0.1,
    supports: ['spot', 'futures', 'swap']
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    logo: '🟢',
    connected: false,
    volume24h: 5100000000,
    fees: 0.1,
    supports: ['spot', 'margin', 'futures', 'swap']
  },
  {
    id: 'gate',
    name: 'Gate.io',
    logo: '🟠',
    connected: false,
    volume24h: 4300000000,
    fees: 0.15,
    supports: ['spot', 'margin', 'futures', 'swap']
  }
];

interface ExchangeCardProps {
  exchange: Exchange;
  isSelected: boolean;
  onToggle: () => void;
}

const ExchangeCard: React.FC<ExchangeCardProps> = ({ exchange, isSelected, onToggle }) => {
  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) return `$${(volume / 1000000000).toFixed(1)}B`;
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    return `$${volume}`;
  };

  return (
    <div
      onClick={onToggle}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
      } ${!exchange.connected && 'opacity-60 cursor-not-allowed'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{exchange.logo}</span>
          <div>
            <h3 className="font-bold">{exchange.name}</h3>
            {!exchange.connected && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Not connected - configure in settings
              </p>
            )}
          </div>
        </div>
        {exchange.connected && (
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-xs font-bold text-green-600">Connected</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400">24h Volume</div>
          <div className="font-bold">{formatVolume(exchange.volume24h || 0)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Taker Fee</div>
          <div className="font-bold">{exchange.fees}%</div>
        </div>
      </div>

      {exchange.supports && (
        <div className="flex flex-wrap gap-1 mb-2">
          {exchange.supports.map(type => (
            <span
              key={type}
              className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-blue-300 text-blue-600 font-bold text-sm">
          ✓ Selected
        </div>
      )}
    </div>
  );
};

interface ExchangeSelectorProps {
  onExchangesChange: (exchanges: string[]) => void;
  selectedExchanges: string[];
}

export const ExchangeSelector: React.FC<ExchangeSelectorProps> = ({
  onExchangesChange,
  selectedExchanges
}) => {
  const [selected, setSelected] = useState<string[]>(selectedExchanges);

  const handleToggle = (exchangeId: string) => {
    const exchange = AVAILABLE_EXCHANGES.find(e => e.id === exchangeId);
    if (!exchange || !exchange.connected) return;

    let updated: string[];
    if (selected.includes(exchangeId)) {
      updated = selected.filter(e => e !== exchangeId);
    } else {
      updated = [...selected, exchangeId];
    }

    setSelected(updated);
    onExchangesChange(updated);
  };

  const handleSelectAll = () => {
    const connectedExchanges = AVAILABLE_EXCHANGES.filter(e => e.connected).map(e => e.id);
    setSelected(connectedExchanges);
    onExchangesChange(connectedExchanges);
  };

  const handleClearAll = () => {
    setSelected([]);
    onExchangesChange([]);
  };

  const connectedCount = AVAILABLE_EXCHANGES.filter(e => e.connected).length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Exchanges</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Choose which exchanges to trade on
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectAll}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Select All
        </button>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Connected Exchanges */}
      <div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
          Connected Exchanges ({connectedCount})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_EXCHANGES.filter(e => e.connected).map(exchange => (
            <ExchangeCard
              key={exchange.id}
              exchange={exchange}
              isSelected={selected.includes(exchange.id)}
              onToggle={() => handleToggle(exchange.id)}
            />
          ))}
        </div>
      </div>

      {/* Disconnected Exchanges */}
      <div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
          Available to Connect
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
          {AVAILABLE_EXCHANGES.filter(e => !e.connected).map(exchange => (
            <ExchangeCard
              key={exchange.id}
              exchange={exchange}
              isSelected={false}
              onToggle={() => {}}
            />
          ))}
        </div>
        <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
          📋 Configure additional exchanges in Settings → Exchange Connections
        </p>
      </div>

      {/* Smart Routing Info */}
      <div className="p-4 bg-green-50 dark:bg-green-950 border-l-4 border-green-600 rounded">
        <div className="font-bold text-green-900 dark:text-green-100 mb-2">
          💡 Smart Routing Benefits
        </div>
        <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
          <li>
            ✓ <strong>Multi-Exchange:</strong> Select multiple exchanges to compare prices
          </li>
          <li>✓ <strong>Best Price:</strong> Automatically routes to best execution</li>
          <li>✓ <strong>Lower Fees:</strong> Compares fees across all selected exchanges</li>
          <li>✓ <strong>Liquidity:</strong> Accesses combined liquidity across all exchanges</li>
          <li>✓ <strong>Risk:</strong> Diversifies across multiple venues</li>
        </ul>
      </div>

      {/* Selection Summary */}
      {selected.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-600 rounded">
          <div className="font-bold text-blue-900 dark:text-blue-100 mb-2">
            ✓ {selected.length} Exchange(s) Selected
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map(exchangeId => {
              const exchange = AVAILABLE_EXCHANGES.find(e => e.id === exchangeId);
              return (
                <div
                  key={exchangeId}
                  className="px-3 py-1 bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full text-sm"
                >
                  {exchange?.logo} {exchange?.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-600 rounded">
          <div className="font-bold text-yellow-900 dark:text-yellow-100">
            ⚠️ No exchanges selected
          </div>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
            Select at least one exchange to deploy the strategy
          </p>
        </div>
      )}
    </div>
  );
};
