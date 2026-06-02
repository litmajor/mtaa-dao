import React from 'react';

export default function CapitalHeader({ total, liquidity, deployed, pending, walletHealth, address }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-sm text-gray-500">Net Worth</div>
        <div className="text-2xl font-bold">{total?.toLocaleString?.() ?? total}</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-sm text-gray-500">Liquid</div>
        <div className="text-xl font-semibold">{liquidity?.toLocaleString?.() ?? liquidity}</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-sm text-gray-500">Deployed</div>
        <div className="text-xl font-semibold">{deployed?.toLocaleString?.() ?? deployed}</div>
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-sm text-gray-500">Pending</div>
        <div className="text-xl font-semibold">{pending}</div>
      </div>
    </div>
  );
}
