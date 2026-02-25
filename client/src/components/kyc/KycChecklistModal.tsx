import React from 'react';

type Props = {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
};

export default function KycChecklistModal({ visible, onClose, onProceed }: Props) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-w-xl w-full bg-slate-900 border border-slate-700 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Complete KYC to increase limits</h3>
            <p className="text-slate-300 text-sm mt-1">A quick identity check raises your daily and monthly transfer limits and reduces holds.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">1</div>
            <div>
              <div className="font-medium text-white">Provide ID</div>
              <div className="text-slate-400 text-xs">Upload a government ID or passport</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">2</div>
            <div>
              <div className="font-medium text-white">Selfie / Liveness</div>
              <div className="text-slate-400 text-xs">Take a quick selfie to verify identity</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">3</div>
            <div>
              <div className="font-medium text-white">Address proof</div>
              <div className="text-slate-400 text-xs">Optional for higher tiers: upload address proof</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">Maybe later</button>
          <button onClick={onProceed} className="px-4 py-2 rounded-md bg-amber-500 text-slate-900 font-semibold hover:brightness-95">Start KYC</button>
        </div>
      </div>
    </div>
  );
}
