import React from 'react';

type Props = { step: number };

const STEPS = ['Route', 'Amount', 'Quote', 'Confirm'];

export default function StepProgress({ step }: Props) {
  return (
    <div className="flex items-center gap-4 mb-4">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {i < step ? '✓' : i + 1}
          </div>
          <div className="text-xs">{s}</div>
        </div>
      ))}
    </div>
  );
}
