import React from 'react';

export default function LiquiditySurface({ vaults }: any) {
  const items = vaults || [];
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-2">Liquidity</h3>
      <div className="space-y-2">
        {items.map((v: any) => (
          <div key={v.id} className="flex justify-between">
            <div className="text-sm text-gray-600">{v.currency || v.id}</div>
            <div className="font-medium">{v.balance}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm text-gray-500">No liquid assets</div>}
      </div>
    </div>
  );
}
