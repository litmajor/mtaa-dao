import React from 'react';
import { ConditionNode } from '../../../models/StrategyNode';

export default function ConditionInspector({ node, onChange }: { node: ConditionNode; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Condition Expression</div>
      <input
        value={node.config?.expression || ''}
        onChange={(e) => onChange({ expression: e.target.value })}
        data-field="expression"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
