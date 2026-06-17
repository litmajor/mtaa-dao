import React, { useState } from 'react';

export function StrategyDeploymentWizard({ strategies = [], onDeploy, isLoading }: any) {
  const [selected, setSelected] = useState<string>(strategies?.[0]?.id || '');
  const [botName, setBotName] = useState<string>('New Bot');
  const [initialCapital, setInitialCapital] = useState<number>(100);
  const [requireLiveConfirm, setRequireLiveConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const startDeploy = (dryRun = true) => {
    if (!onDeploy) return;
    if (!dryRun && !requireLiveConfirm) {
      // show confirmation
      setRequireLiveConfirm(true);
      return;
    }

    if (!dryRun && requireLiveConfirm) {
      // require explicit typed consent
      if (confirmText.trim() !== 'I UNDERSTAND') return;
    }

    onDeploy(selected, {}, {}, [], botName, initialCapital, { dry_run: dryRun });
  };

  return (
    <div className="w-full max-w-3xl bg-slate-800 rounded p-6">
      <h2 className="text-xl font-bold mb-4">Deploy Strategy</h2>
      <p className="text-sm text-slate-400 mb-4">Select a strategy and configure deployment. Live trading requires advanced mode and verification.</p>
      <div className="space-y-3">
        <div>
          <label htmlFor="strategySelect" className="sr-only">Select strategy</label>
          <select id="strategySelect" aria-label="Select strategy" value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full p-2 bg-slate-700 rounded">
            {strategies.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="botNameInput" className="sr-only">Bot name</label>
          <input id="botNameInput" placeholder="Bot name" value={botName} onChange={(e) => setBotName(e.target.value)} className="w-full p-2 bg-slate-700 rounded" />
        </div>

        <div>
          <label htmlFor="initialCapitalInput" className="sr-only">Initial capital (USD)</label>
          <input id="initialCapitalInput" type="number" placeholder="100" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="w-full p-2 bg-slate-700 rounded" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => startDeploy(true)} className="px-4 py-2 bg-slate-600 rounded">Deploy (Dry Run)</button>
          <button onClick={() => startDeploy(false)} className="px-4 py-2 bg-green-600 rounded">Deploy Live</button>
        </div>

        {/* Non-dismissible confirmation for live deploy */}
        {requireLiveConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90">
            <div className="bg-slate-800 p-6 rounded max-w-xl w-full">
              <h3 className="text-lg font-bold">Confirm Live Trading</h3>
              <p className="text-sm text-slate-300 my-3">Live trading connects to real accounts and may result in real financial loss. To proceed, type "I UNDERSTAND" below and press Confirm. This dialog cannot be dismissed without explicit confirmation.</p>
              <label htmlFor="liveConfirmInput" className="sr-only">Type I UNDERSTAND to confirm live trading</label>
              <input id="liveConfirmInput" placeholder="Type I UNDERSTAND" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-full p-2 bg-slate-700 rounded" />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { if (confirmText.trim() === 'I UNDERSTAND') { setRequireLiveConfirm(false); setConfirmText(''); onDeploy && onDeploy(selected, {}, {}, [], botName, initialCapital, { dry_run: false }); } }} className="px-4 py-2 bg-red-600 rounded">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StrategyDeploymentWizard;
