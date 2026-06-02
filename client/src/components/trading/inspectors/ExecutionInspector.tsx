import React from 'react';
import { ExecutionNode } from '../../../models/StrategyNode';

export default function ExecutionInspector({ node, onChange }: { node: ExecutionNode; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Schedule / Trigger</div>
      <input
        value={node.config?.schedule || ''}
        onChange={(e) => onChange({ schedule: e.target.value })}
        data-field="schedule"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
