// frontend/src/components/dashboard/CollapsibleSection.tsx
/**
 * Reusable Collapsible Section Component
 * Used for all 8 dashboard sections
 */

import React from 'react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  expanded,
  onToggle,
  children,
  headerAction,
}) => {
  return (
    <div
      id={`section-${id}`}
      className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-dark-surface transition-all duration-300"
    >
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors duration-200"
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {expanded ? '▼' : '▶'} {title}
          </span>
        </div>
        {headerAction && <div className="flex items-center space-x-2">{headerAction}</div>}
      </button>

      {/* Section Content (with animation) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-bg">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
