import React from 'react';
import { StrategyNode } from '../../../models/StrategyNode';

export default function CrosschainInspector({ node, onChange }: { node: StrategyNode & any; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Provider</div>
      <input
        value={node.config?.provider || ''}
        onChange={(e) => onChange({ provider: e.target.value })}
        data-field="provider"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">From Chain</div>
      <input
        value={node.config?.fromChain || ''}
        onChange={(e) => onChange({ fromChain: e.target.value })}
        data-field="fromChain"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">To Chain</div>
      <input
        value={node.config?.toChain || ''}
        onChange={(e) => onChange({ toChain: e.target.value })}
        data-field="toChain"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Token</div>
      <input
        value={node.config?.token || ''}
        onChange={(e) => onChange({ token: e.target.value })}
        data-field="token"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />

      <div className="text-xs text-slate-300 mt-3 mb-1">Amount</div>
      <input
        type="number"
        value={node.config?.amount ?? ''}
        onChange={(e) => onChange({ amount: Number(e.target.value) })}
        data-field="amount"
        className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
