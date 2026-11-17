// frontend/src/components/dashboard/ProSidebar.tsx
import React from 'react';

interface ProSidebarProps {
  onJump: (section: string) => void;
}

const ProSidebar: React.FC<ProSidebarProps> = ({ onJump }) => {
  const buttons = [
    { key: '1', label: 'Opps', icon: '⚡' },
    { key: '2', label: 'Watch', icon: '⭐' },
    { key: '3', label: 'CEX', icon: '🏦' },
    { key: '4', label: 'DEX', icon: '🔄' },
    { key: '5', label: 'Strat', icon: '🤖' },
    { key: '6', label: 'Chart', icon: '📊' },
    { key: '7', label: 'Port', icon: '💼' },
    { key: '8', label: 'Market', icon: '🏆' },
  ];

  const sectionMap: { [key: string]: string } = {
    '1': 'opportunities',
    '2': 'watchlist',
    '3': 'cex',
    '4': 'dex',
    '5': 'strategies',
    '6': 'charts',
    '7': 'portfolio',
    '8': 'marketplace',
  };

  return (
    <div className="hidden lg:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[140px] bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-gray-700 overflow-y-auto z-30">
      <div className="p-3 space-y-2">
        {buttons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => onJump(sectionMap[btn.key])}
            className="w-full px-2 py-2 text-xs font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-dark-bg rounded hover:bg-brand-blue hover:text-white transition-colors duration-200 flex items-center justify-center space-x-1"
            title={`Ctrl+${btn.key}`}
          >
            <span>{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProSidebar;
