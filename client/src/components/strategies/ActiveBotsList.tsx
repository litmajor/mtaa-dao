import React from 'react';

export function ActiveBotsList({ bots = [], isLoading = false, onPause, onResume, onStop }: any) {
  if (isLoading) return <div>Loading bots...</div>;
  if (!bots || bots.length === 0) return <div className="text-slate-400">No active bots</div>;

  return (
    <div className="space-y-3">
      {bots.map((b: any) => (
        <div key={b.id} className="p-3 bg-slate-800 rounded flex items-center justify-between">
          <div>
            <div className="font-semibold">{b.name || b.id}</div>
            <div className="text-sm text-slate-400">Status: {b.status}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onPause && onPause(b.id)} className="px-2 py-1 bg-yellow-600 rounded">Pause</button>
            <button onClick={() => onResume && onResume(b.id)} className="px-2 py-1 bg-blue-600 rounded">Resume</button>
            <button onClick={() => onStop && onStop(b.id)} className="px-2 py-1 bg-red-600 rounded">Stop</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActiveBotsList;
