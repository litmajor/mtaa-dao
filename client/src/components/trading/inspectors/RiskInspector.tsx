import React from 'react';
import { RiskNode } from '../../../models/StrategyNode';

export default function RiskInspector({ node, onChange }: { node: RiskNode; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Stop Loss %</div>
      <input
        type="number"
        value={node.config?.stopLossPct ?? ''}
        onChange={(e) => onChange({ stopLossPct: Number(e.target.value) })}
        data-field="stopLossPct"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Take Profit %</div>
      <input
        type="number"
        value={node.config?.takeProfitPct ?? ''}
        onChange={(e) => onChange({ takeProfitPct: Number(e.target.value) })}
        data-field="takeProfitPct"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
