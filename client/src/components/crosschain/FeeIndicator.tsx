import React from 'react';

type Props = { total?: number };

export default function FeeIndicator({ total = 0 }: Props) {
  const t = Number(total || 0);
  const status = t < 5 ? 'low' : t < 20 ? 'normal' : 'high';
  const classes = status === 'low' ? 'text-green-700 bg-green-100' : status === 'normal' ? 'text-yellow-800 bg-yellow-100' : 'text-red-700 bg-red-100';
  const label = status === 'low' ? 'Low fees' : status === 'normal' ? 'Normal fees' : 'High fees';

  return (
    <div className="p-3 rounded flex items-center justify-between">
      <div>
        <div className="text-xs text-muted-foreground">Fee status</div>
        <div className="font-medium">{label}</div>
      </div>
      <div className={`px-2 py-1 rounded text-xs font-semibold ${classes}`}>${t.toFixed(2)}</div>
    </div>
  );
}
