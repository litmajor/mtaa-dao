// frontend/src/components/dashboard/DEXSwapSection.tsx
import React from 'react';

const DEXSwapSection: React.FC<{ pairs: any[]; onPreviewSwap: (swap: any) => void }> = () => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        DEX Liquidity Pools
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Uniswap V3 • Sushiswap • Curve • Balancer • Ubeswap
      </p>
    </div>
  );
};

export default DEXSwapSection;
