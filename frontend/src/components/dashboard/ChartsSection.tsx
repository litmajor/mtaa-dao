// frontend/src/components/dashboard/ChartsSection.tsx
import React from 'react';

const ChartsSection: React.FC<{ selectedPair: string; timeframe: string; onTimeframeChange: (tf: string) => void }> = ({
  selectedPair,
  timeframe,
  onTimeframeChange,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {selectedPair} • {timeframe}
        </h4>
        <div className="flex space-x-1">
          {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2 py-1 text-xs rounded ${
                tf === timeframe
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 bg-gray-100 dark:bg-dark-bg rounded flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Candlestick Chart</p>
      </div>
    </div>
  );
};

export default ChartsSection;
