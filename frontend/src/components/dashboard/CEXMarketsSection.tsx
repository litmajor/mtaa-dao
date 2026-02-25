// frontend/src/components/dashboard/CEXMarketsSection.tsx
import React from 'react';

interface CEXMarketsSection Props {
  markets: any[];
  onSelectMarket: (market: any) => void;
}

const CEXMarketsSection: React.FC<CEXMarketsSectionProps> = ({ markets, onSelectMarket }) => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Connected Exchanges: Binance • Coinbase • Kraken • Gate.io • OKX
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Multi-exchange price comparison and arbitrage detection
      </p>
    </div>
  );
};

export default CEXMarketsSection;
