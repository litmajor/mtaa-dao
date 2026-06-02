import React from 'react';

export default function RiskSurface({ walletHealth }: any) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-2">Financial Health</h3>
      <div className="text-sm text-gray-600">Liquidity: <strong className="ml-2">{walletHealth.liquidity}</strong></div>
      <div className="text-sm text-gray-600">Diversification: <strong className="ml-2">{walletHealth.diversification}</strong></div>
      <div className="text-sm text-gray-600">Exposure: <strong className="ml-2">{walletHealth.exposure}</strong></div>
    </div>
  );
}
