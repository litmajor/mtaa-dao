import React from 'react';
import type { FlashLoanState } from './FlashLoanEngine';

interface Props {
  state: FlashLoanState;
}

const colorMap: Record<string, string> = {
  DRAFT: 'gray',
  PROFITABLE: 'green',
  UNPROFITABLE: 'red',
  HIGH_RISK: 'orange',
  READY_TO_EXECUTE: 'teal',
  SIMULATING: 'blue',
  EXECUTING: 'purple',
  COMPLETED: 'green',
  FAILED: 'red',
};

export const StateBadge: React.FC<Props> = ({ state }) => {
  const color = colorMap[state] || 'gray';
  return (
    <span className={`state-badge state-${color}`} style={{ padding: '4px 8px', borderRadius: 6 }}>
      {state}
    </span>
  );
};

export default StateBadge;
