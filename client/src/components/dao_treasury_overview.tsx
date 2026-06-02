// components/DaoTreasuryOverview.tsx


import { useEffect, useState, useRef } from "react";
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Optionally accept daoId as prop for multi-DAO support
export function DaoTreasuryOverview({ daoId = "root-dao" }: { daoId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [treasury, setTreasury] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [signerSummary, setSignerSummary] = useState<any>({ total: 0, active: 0, offline: 0, threshold: 0, score: 0 });
  const [highlightExecution, setHighlightExecution] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // respond to query param to open panels
    try {
      const q = new URLSearchParams(location.search);
      const open = q.get('open');
      if (open === 'execution-queue') {
        const el = document.getElementById('execution-queue');
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
          setHighlightExecution(true);
          setTimeout(() => setHighlightExecution(false), 4000);
        }
      }
    } catch (e) {}

    async function fetchTreasury() {
      setLoading(true);
      setError("");
      try {
        // Expanded API: fetch treasury snapshot, vaults, and recent activity
        const res = await fetch(`/api/v1/daos/${daoId}/treasury/balance`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setTreasury(data);

        // Optionally fetch vaults
        if (data.vaults) {
          setVaults(data.vaults);
        } else {
          // fallback: fetch vaults separately
          try {
            const vaultRes = await fetch(`/api/dao/${daoId}/vaults`);
            if (vaultRes.ok) setVaults(await vaultRes.json());
          } catch {}
        }

        // Optionally fetch recent activity
        if (data.activity) {
          setActivity(data.activity);
        } else {
          // fallback: fetch activity separately
          try {
            const actRes = await fetch(`/api/dao/${daoId}/activity?limit=5`);
            if (actRes.ok) setActivity(await actRes.json());
          } catch {}
        }

        // fetch pending execution queue (lightweight)
        try {
          const p = await fetch(`/api/dao/${daoId}/treasury/pending-actions`);
          if (p.ok) setPendingActions(await p.json());
        } catch {}

        // fetch signer summary (multisig health)
        try {
          const s = await fetch(`/api/dao/${daoId}/treasury/signer-summary`);
          if (s.ok) setSignerSummary(await s.json());
        } catch {}
      } catch (e: any) {
        setError(e.message || "Failed to load treasury");
      } finally {
        setLoading(false);
      }
    }
    fetchTreasury();
  }, [daoId]);

  return (
    <div className="space-y-4">
      {/* Persistent Treasury Context Bar */}
      <TreasuryContextBar treasury={treasury} signerSummary={signerSummary} pendingCount={pendingActions.length} loading={loading} />

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Financial state (larger) */}
        <div className="col-span-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && <p>Loading treasury snapshot…</p>}
              {error && <p className="text-red-500">{error}</p>}
              {treasury && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Net Worth</div>
                      <div className="text-3xl font-semibold">${treasury.totalValueUsd?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Native Balance</div>
                      <div className="font-medium">{treasury.nativeBalance?.toLocaleString()} CELO</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-900 rounded">
                      <h4 className="font-semibold">Vaults</h4>
                      {vaults.length === 0 ? <div className="text-sm text-gray-400 mt-2">No vaults</div> : (
                        <ul className="mt-2 space-y-2">
                          {vaults.map((v: any) => (
                            <li key={v.id} className="flex justify-between text-sm">
                              <div>{v.name || v.currency}</div>
                              <div className="font-semibold">{v.balance?.toLocaleString()}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="p-4 bg-gray-900 rounded">
                      <h4 className="font-semibold">Token Allocation</h4>
                      {treasury.tokenBalances ? (
                        <ul className="mt-2 text-sm space-y-1">
                          {Object.entries(treasury.tokenBalances).slice(0,6).map(([addr, t]: any) => (
                            <li key={addr} className="flex justify-between">
                              <div>{t.symbol}</div>
                              <div className="font-medium">{t.balanceFormatted?.toLocaleString()}</div>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="text-sm text-gray-400 mt-2">No tokens</div>}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mt-2">Recent Activity</h4>
                    {activity.length === 0 ? <div className="text-sm text-gray-400 mt-2">No recent activity</div> : (
                      <ul className="space-y-1 mt-2">
                        {activity.map((act: any, i: number) => (
                          <li key={i} className="flex justify-between text-sm">
                            <div>{act.type || act.event}</div>
                            <div className="text-muted-foreground">{act.timestamp ? new Date(act.timestamp).toLocaleString() : '-'}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations / Runway / Analytics card stub */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics & Runway</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-400">Runway, velocity, allocation breakdown, and forecast charts will appear here.</div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Operational state (smaller) */}
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Treasury Security</CardTitle>
            </CardHeader>
            <CardContent>
              <SecurityPanel summary={signerSummary} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div id="execution-queue" className={`${highlightExecution ? 'ring-4 ring-yellow-400 ring-opacity-40 rounded-md p-2' : ''}`}>
                <ExecutionQueue items={pendingActions} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governance Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-400">Link proposals and approved actions here for quick execution.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TreasuryContextBar({ treasury, signerSummary, pendingCount, loading }: any) {
  return (
    <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-400">DAO Treasury</div>
        <div className="text-xl font-semibold">${treasury?.totalValueUsd?.toLocaleString() ?? '—'}</div>
        <div className="text-sm text-gray-300">Secured by {signerSummary?.active}/{signerSummary?.total} multisig • {pendingCount} pending</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-300">Last movement: {treasury?.lastUpdated ? new Date(treasury.lastUpdated).toLocaleString() : '—'}</div>
        <div className={`px-2 py-1 rounded ${pendingCount > 0 ? 'bg-yellow-600 text-black' : 'bg-green-700 text-white'}`}>{pendingCount} Pending</div>
      </div>
    </div>
  );
}

function SecurityPanel({ summary }: any) {
  const severity = summary.score >= 75 ? 'healthy' : summary.score >= 50 ? 'warning' : 'danger';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Safe Status</div>
          <div className="text-lg font-semibold">{severity === 'healthy' ? 'Healthy' : severity === 'warning' ? 'Degraded' : 'At Risk'}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Security Score</div>
          <div className="font-semibold">{summary.score ?? '—'}/100</div>
        </div>
      </div>

      <div className="text-sm text-gray-300">Signers: {summary.total} • Active: {summary.active} • Offline: {summary.offline}</div>
      <div className="text-sm text-gray-400">Threshold: {summary.threshold}</div>

      <div className="pt-2">
        <button className="px-3 py-2 bg-mtaa-purple text-white rounded">Manage Security</button>
      </div>
    </div>
  );
}

function ExecutionQueue({ items }: { items: any[] }) {
  const { toast } = useToast();
  const [localItems, setLocalItems] = useState<any[]>(items || []);
  const itemsRef = useRef(localItems);

  useEffect(() => {
    setLocalItems(items || []);
  }, [items]);

  useEffect(() => {
    itemsRef.current = localItems;
  }, [localItems]);

  useEffect(() => {
    // Poll job status for items that have a jobId
    const interval = setInterval(async () => {
      const toCheck = (itemsRef.current || []).filter(it => it.jobId && it.jobStatus !== 'completed' && it.jobStatus !== 'failed');
      if (toCheck.length === 0) return;
      await Promise.all(toCheck.map(async (it) => {
        try {
          const res = await fetch(`/api/jobs/${it.jobId}/status`);
          if (!res.ok) return;
          const s = await res.json();
          setLocalItems(prev => prev.map(p => p.jobId === it.jobId ? { ...p, jobStatus: s.status, progress: s.progress, jobError: s.error } : p));
          if (s.status === 'completed') {
            toast({ title: 'Action completed', description: `${it.title || 'Pending action'} completed.`, variant: 'success' });
          } else if (s.status === 'failed') {
            toast({ title: 'Action failed', description: `${it.title || 'Pending action'} failed: ${s.error || 'unknown'}`, variant: 'destructive' });
          }
        } catch (e) {
          // ignore per-item errors
        }
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!localItems || localItems.length === 0) return <div className="text-sm text-gray-400">No pending treasury actions.</div>;

  return (
    <div className="space-y-2">
      {localItems.map((it: any) => (
        <div key={it.id || it.jobId} className="p-2 bg-gray-900 rounded flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">{it.title || it.description || 'Pending Action'}</div>
              {it.jobStatus && <div className={`text-xs px-2 py-0.5 rounded ${it.jobStatus === 'completed' ? 'bg-green-700' : it.jobStatus === 'failed' ? 'bg-red-700' : 'bg-yellow-700'}`}>{it.jobStatus}</div>}
            </div>
            <div className="text-xs text-gray-400">{it.meta || it.amount || ''}</div>
            <div className="text-xs text-muted-foreground">{it.requiredSignatures ? `${it.signaturesCollected || 0}/${it.requiredSignatures} signatures` : ''}</div>
            {typeof it.progress === 'number' && <div className="text-xs text-gray-400 mt-1">Progress: {Math.round(it.progress)}%</div>}
          </div>
          <div className="text-sm text-gray-300">{it.time ? new Date(it.time).toLocaleTimeString() : ''}</div>
        </div>
      ))}
    </div>
  );
}
