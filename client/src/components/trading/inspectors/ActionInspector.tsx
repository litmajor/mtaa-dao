import React from 'react';
import { ActionNode } from '../../../models/StrategyNode';

export default function ActionInspector({ node, onChange }: { node: ActionNode; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Action Type</div>
      <input
        value={node.config?.actionType || ''}
        onChange={(e) => onChange({ actionType: e.target.value })}
        data-field="actionType"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Params (JSON)</div>
      <textarea
        value={JSON.stringify(node.config?.params || {}, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value || '{}');
            onChange({ params: parsed });
          } catch (err) {
            // ignore parse errors for now
          }
        }}
        data-field="params"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
        rows={4}
      />
    </div>
  );
}
