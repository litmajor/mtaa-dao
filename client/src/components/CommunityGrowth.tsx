import React, { useEffect, useState } from 'react';

interface StatusResp {
  totalStaked: string;
  tvlBps: number;
  tvlPercent: number;
  apyBp: number;
  apyPercent: number;
}

export default function CommunityGrowth() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/protocol/status');
        if (!mounted) return;
        if (!res.ok) {
          const j = await res.json();
          setError(j?.error || 'Failed to fetch status');
          setLoading(false);
          return;
        }
        const json = await res.json();
        setStatus(json as StatusResp);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30_000); // refresh every 30s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (loading) return (
    <div className="p-4 bg-white rounded shadow-sm">
      <h3 className="text-lg font-semibold">Community Growth Progress</h3>
      <div className="mt-3 text-sm text-gray-500">Loading protocol status…</div>
    </div>
  );

  if (error || !status) return (
    <div className="p-4 bg-white rounded shadow-sm">
      <h3 className="text-lg font-semibold">Community Growth Progress</h3>
      <div className="mt-3 text-sm text-red-500">{error || 'Unknown error'}</div>
    </div>
  );

  const { tvlPercent, apyPercent, tvlBps } = status;
  const progressLabel = `${tvlPercent.toFixed(2)}% TVL`;

  return (
    <div className="p-4 bg-white rounded shadow-sm">
      <h3 className="text-lg font-semibold">Community Growth Progress</h3>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Protocol TVL</div>
          <div className="text-xl font-medium">{progressLabel}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Current APY</div>
          <div className="text-xl font-medium">{apyPercent.toFixed(2)}%</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
          <div className="h-3 bg-blue-500" style={{ width: `${Math.min(100, tvlPercent)}%` }} />
        </div>
        <div className="mt-2 text-sm text-gray-600">Progress toward maturity: {tvlBps} bps (for transparency)</div>
      </div>

      <div className="mt-3 text-sm text-gray-700">
        This shows the community growth progress (TVL percentage of the 1B supply) and the current APY determined by the protocol's sustainability engine. Showing the metric helps members understand why rates change over time.
      </div>
    </div>
  );
}
