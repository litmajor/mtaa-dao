// frontend/src/components/dashboard/StrategiesSection.tsx
import React from 'react';

const StrategiesSection: React.FC<{ strategies: any[]; onDeployStrategy: (s: any) => void }> = () => {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Active Trading Strategies
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No-code builder • Custom Freqtrade strategies • ML agents
      </p>
    </div>
  );
};

export default StrategiesSection;
