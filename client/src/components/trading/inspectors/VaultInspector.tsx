import React from 'react';
import { StrategyNode } from '../../../models/StrategyNode';

export default function VaultInspector({ node, onChange }: { node: StrategyNode & any; onChange: (patch: any) => void }) {
  return (
    <div>
      <div className="text-xs text-slate-300 mb-1">Vault Address</div>
      <input
        value={node.config?.vaultAddress || ''}
        onChange={(e) => onChange({ vaultAddress: e.target.value })}
        data-field="vaultAddress"
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
