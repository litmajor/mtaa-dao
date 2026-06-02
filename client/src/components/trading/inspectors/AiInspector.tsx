import React from 'react';
import { StrategyNode } from '../../../models/StrategyNode';

export default function AiInspector({ node, onChange }: { node: StrategyNode & any; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Model</div>
      <input
        value={node.config?.model || ''}
        onChange={(e) => onChange({ model: e.target.value })}
        data-field="model"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Prompt</div>
      <textarea
        value={node.config?.prompt || ''}
        onChange={(e) => onChange({ prompt: e.target.value })}
        data-field="prompt"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
        rows={4}
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Max Tokens</div>
      <input
        type="number"
        value={node.config?.maxTokens ?? ''}
        onChange={(e) => onChange({ maxTokens: Number(e.target.value) })}
        data-field="maxTokens"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
