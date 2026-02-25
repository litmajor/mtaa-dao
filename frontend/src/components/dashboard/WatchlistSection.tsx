// frontend/src/components/dashboard/WatchlistSection.tsx
import React from 'react';

interface WatchlistItem {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  onAddToken: () => void;
  onTradeToken: (token: string) => void;
}

const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  watchlist,
  onAddToken,
  onTradeToken,
}) => {
  const mockData: WatchlistItem[] = [
    { symbol: 'SOL/USDC', price: 20.45, change24h: 3.2, volume24h: 125000 },
    { symbol: 'PUMP/USDC', price: 0.00421, change24h: 25.8, volume24h: 500000 },
    { symbol: 'JUP/USDC', price: 0.95, change24h: -2.1, volume24h: 250000 },
  ];

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 text-gray-600 dark:text-gray-400">Token</th>
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">Price</th>
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">24h Change</th>
            <th className="text-right py-2 text-gray-600 dark:text-gray-400">24h Volume</th>
            <th className="text-right py-2"></th>
          </tr>
        </thead>
        <tbody>
          {mockData.map((item) => (
            <tr key={item.symbol} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-bg">
              <td className="py-3 font-semibold text-gray-900 dark:text-white">{item.symbol}</td>
              <td className="text-right text-gray-900 dark:text-white">${item.price.toFixed(6)}</td>
              <td className={`text-right font-semibold ${item.change24h >= 0 ? 'text-success-green' : 'text-error-red'}`}>
                {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
              </td>
              <td className="text-right text-gray-600 dark:text-gray-400">${(item.volume24h / 1000).toFixed(0)}K</td>
              <td className="text-right">
                <button
                  onClick={() => onTradeToken(item.symbol)}
                  className="px-2 py-1 text-xs bg-brand-blue text-white rounded hover:opacity-90"
                >
                  Trade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={onAddToken}
        className="w-full mt-3 py-2 border border-brand-blue text-brand-blue rounded hover:bg-blue-50 dark:hover:bg-dark-bg transition-colors"
      >
        + Add New Token
      </button>
    </div>
  );
};

export default WatchlistSection;
