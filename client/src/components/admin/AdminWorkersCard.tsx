import React, { useEffect, useState } from 'react';

export default function AdminWorkersCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/monitoring/workers', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch worker status');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 15000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="bg-white/6 rounded-2xl p-4">
      <h4 className="text-white font-semibold mb-2">Payout Worker</h4>
      {loading && <div className="text-sm text-white/70">Loading...</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {data && (
        <div className="grid grid-cols-2 gap-2 text-sm text-white/80">
          <div>Pending</div><div className="font-bold">{data.payouts.pending}</div>
          <div>Processing</div><div className="font-bold">{data.payouts.processing}</div>
          <div>Failed</div><div className="font-bold text-red-400">{data.payouts.failed}</div>
          <div>Completed</div><div className="font-bold text-green-400">{data.payouts.completed}</div>
          <div>Worker Running</div><div className="font-bold">{String(data.worker?.isRunning)}</div>
          <div>Last Run</div><div className="font-bold">{data.worker?.lastRunAt ? new Date(data.worker.lastRunAt).toLocaleString() : 'n/a'}</div>
        </div>
      )}
      <div className="mt-3">
        <button onClick={fetchStatus} className="px-3 py-1 bg-purple-600 rounded text-white text-sm">Refresh</button>
      </div>
    </div>
  );
}
