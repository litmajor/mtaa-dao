import React from 'react';

type Props = { value?: number };

export default function PriceImpact({ value = 0 }: Props) {
  const num = Number(value || 0);
  const status = num > 5 ? 'high' : num > 2 ? 'medium' : 'good';
  const classes =
    status === 'high'
      ? 'bg-red-100 text-red-700'
      : status === 'medium'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-green-100 text-green-700';

  const label = status === 'high' ? 'High' : status === 'medium' ? 'Medium' : 'Good';

  return (
    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium ${classes}`}>
      <span className="w-2 h-2 rounded-full" aria-hidden />
      <span>{label} • {num.toFixed(2)}%</span>
    </span>
  );
}
