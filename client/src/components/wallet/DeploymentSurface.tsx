import React from 'react';

export default function DeploymentSurface({ vaults }: any) {
  const items = vaults || [];
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-2">Deployed Capital</h3>
      {items.length ? (
        items.map((v: any) => (
          <div key={v.id} className="flex justify-between py-2 border-b last:border-b-0">
            <div className="text-sm">{v.currency || v.id}</div>
            <div className="font-medium">{v.balance}</div>
          </div>
        ))
      ) : (
        <div className="text-sm text-gray-500">No deployed positions</div>
      )}
    </div>
  );
}
