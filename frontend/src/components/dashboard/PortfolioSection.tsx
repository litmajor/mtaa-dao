// frontend/src/components/dashboard/PortfolioSection.tsx
import React from 'react';

const PortfolioSection: React.FC<{ holdings: any[]; totalValue: number }> = ({ holdings, totalValue }) => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Holdings: {holdings.length || 3} assets
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Total portfolio value: ${totalValue.toFixed(2)}
      </p>
    </div>
  );
};

export default PortfolioSection;
