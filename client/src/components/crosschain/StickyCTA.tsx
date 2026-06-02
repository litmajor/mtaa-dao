import React from 'react';

type Props = {
  receive?: string;
  priceImpact?: number;
  disabled?: boolean;
  onConfirm: () => void;
  label?: string;
};

export default function StickyCTA({ receive, priceImpact, disabled, onConfirm, label = 'Execute Swap' }: Props) {
  return (
    <div className="fixed left-0 right-0 bottom-4 px-4 sm:px-6 md:px-10 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded flex items-center justify-between gap-4 p-4 pointer-events-auto">
        <div>
          <div className="text-xs text-muted-foreground">You receive</div>
          <div className="font-semibold">{receive ?? '—'}</div>
          <div className="text-xs text-muted-foreground">Impact: {priceImpact?.toFixed(2) ?? '—'}%</div>
        </div>
        <div>
          <button onClick={onConfirm} disabled={disabled} className="bg-blue-600 text-white px-4 py-2 rounded font-medium disabled:opacity-60">
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
