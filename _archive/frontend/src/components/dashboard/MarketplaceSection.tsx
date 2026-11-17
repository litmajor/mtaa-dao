// frontend/src/components/dashboard/MarketplaceSection.tsx
import React from 'react';

const MarketplaceSection: React.FC<{ strategies: any[]; onCopyStrategy: (s: any) => void }> = () => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Copy Marketplace
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Browse and copy strategies from top traders • Profit sharing: 80/20
      </p>
    </div>
  );
};

export default MarketplaceSection;
