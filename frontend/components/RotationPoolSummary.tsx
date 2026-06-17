import React from 'react';

export interface RotationPoolSummaryProps {
  expectedPool: number; // total expected payout size (e.g., N * contribution)
  collectedSoFar: number; // current collected amount in same units
  currency?: string;
}

export default function RotationPoolSummary({ expectedPool, collectedSoFar, currency = 'cUSD' }: RotationPoolSummaryProps) {
  const percent = expectedPool > 0 ? Math.min(100, Math.round((collectedSoFar / expectedPool) * 100)) : 0;

  return (
    <div className="rotation-pool-summary p-4 bg-white rounded shadow-sm">
      <h3 className="text-lg font-semibold">Rotation Pool</h3>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Expected pool</div>
          <div className="text-xl font-medium">{expectedPool.toLocaleString()} {currency}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Collected so far</div>
          <div className="text-xl font-medium">{collectedSoFar.toLocaleString()} {currency}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
          <div className="h-3 bg-green-500" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 text-sm text-gray-600">{percent}% collected</div>
      </div>

      <div className="mt-3 text-sm text-gray-700">
        Payouts are proportional to collected contributions: if only part of the expected
        pool is collected, each recipient receives a share proportional to the amount collected
        for their rotation. If the module is paused or oracle data is unavailable, payouts
        will be delayed until operators resume the module and oracle feeds recover.
      </div>
    </div>
  );
}
