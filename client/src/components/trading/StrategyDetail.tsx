import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MiniGraph from './MiniGraph';
import * as yukiApi from '../../api/yukiApi';

function computeHealthScoreFromData(s: any) {
  const score = Math.round(Math.max(0, Math.min(100, 50 + ((s?.stats?.return1y || 0) * 0.6) - ((s?.stats?.maxDrawdown || 0) * 1.2))));
  return score;
}

function generateExplanationFromGraph(graph: any) {
  if (!graph) return ['No graph available.'];
  const lines: string[] = [];
  // schedule
  const exec = (graph.nodes || []).find((n: any) => n.type === 'execution' || (n.config && n.config.when));
  if (exec && exec.config) {
    if (exec.config.when === 'scheduled' && exec.config.schedule) lines.push(`Runs on schedule: ${exec.config.schedule}`);
    else if (exec.config.when === 'manual') lines.push('Runs when manually triggered.');
    else lines.push('Runs on trigger/price events.');
  } else {
    lines.push('Runs based on detected execution triggers in the graph.');
  }

  // conditions
  const conds = (graph.nodes || []).filter((n: any) => n.type === 'condition' || (n.label || '').toLowerCase().includes('condition'));
  conds.slice(0,3).forEach((c: any) => {
    if (c.config && c.config.metric) lines.push(`Checks ${c.config.metric} ${c.config.operator || ''} ${c.config.value || c.config.percentile || ''}`);
    else lines.push(`Condition: ${c.label || c.type}`);
  });

  // actions
  const acts = (graph.nodes || []).filter((n: any) => n.type === 'action' || (n.label || '').toLowerCase().includes('buy') || (n.label || '').toLowerCase().includes('sell'));
  acts.slice(0,3).forEach((a: any) => {
    if (a.config && a.config.action) lines.push(`Action: ${a.config.action} ${a.config.amount ? `(${a.config.amount}${a.config.amountType ? ' ' + a.config.amountType : ''})` : ''}`);
    else lines.push(`Action: ${a.label || a.type}`);
  });

  // risk controls
  const risk = (graph.nodes || []).find((n: any) => n.type === 'risk' || n.config && (n.config.stopLoss || n.config.takeProfit));
  if (risk && risk.config) {
    if (risk.config.stopLoss) lines.push(`Protects downside with a stop loss of ${risk.config.stopLoss}${risk.config.type === 'percent' ? '%' : ''}.`);
    if (risk.config.takeProfit) lines.push(`Has a take profit target of ${risk.config.takeProfit}${risk.config.type === 'percent' ? '%' : ''}.`);
  }

  if (lines.length === 0) return ['This strategy contains blocks that produce automated trading behavior.'];
  return lines;
}

export default function StrategyDetail() {
  const { id } = useParams() as { id?: string };
  const navigate = useNavigate();
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const simulateLocal = () => {
    try {
      const stats = strategy?.stats || {};
      const return1y = stats?.return1y != null ? `${stats.return1y}%` : 'N/A';
      const winRate = stats?.winRate != null ? `${stats.winRate}%` : 'N/A';
      const drawdown = stats?.maxDrawdown != null ? `${stats.maxDrawdown}%` : 'N/A';
      alert(`Simulation summary:\nExpected Return (1y): ${return1y}\nWin Rate: ${winRate}\nMax Drawdown: ${drawdown}`);
    } catch (e) {
      console.error('simulateLocal failed', e);
      alert('Simulation unavailable');
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await yukiApi.getMarketplaceStrategy(id);
        const data = res?.data || res;
        setStrategy(data);
      } catch (err) {
        console.error('Failed to load strategy detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="p-6 text-slate-300">Loading strategy...</div>;
  if (!strategy) return <div className="p-6 text-red-400">Strategy not found.</div>;

  const health = computeHealthScoreFromData(strategy);
  const explanation = generateExplanationFromGraph(strategy.graph || {});

  return (
    <div className="p-6 min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 rounded p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{strategy.name}</h1>
                <div className="text-sm text-slate-400">by {strategy.creator} • {strategy.followers} followers</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Performance</div>
                <div className="text-2xl font-bold text-green-400">+{strategy.stats?.return1y}%</div>
                <div className="text-xs text-slate-400">Risk: {strategy.risk || 'Medium'}</div>
                <div className="text-sm font-bold mt-2">Health: {health}/100</div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded ${strategy.state === 'verified' ? 'bg-green-600/20 text-green-300' : strategy.state === 'featured' ? 'bg-yellow-600/20 text-yellow-300' : 'bg-slate-700 text-slate-300'}`}>{(strategy.state || 'published').toUpperCase()}</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <MiniGraph size={600} graph={strategy.graph} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigate(`/builder/${strategy.id}`)} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded">Inspect</button>
              <button onClick={() => { const res = yukiApi.copyMarketplaceStrategy(strategy.id); alert('Fork requested'); }} className="bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded">Fork</button>
              <button onClick={() => { simulateLocal(); }} className="bg-indigo-600/80 hover:bg-indigo-700 px-3 py-2 rounded">Simulate</button>
              <button onClick={async () => { await yukiApi.deployStrategy(strategy.id); alert('Deploy requested'); }} className="bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded">Deploy</button>
              <button onClick={() => { alert('Followed'); }} className="bg-pink-600 hover:bg-pink-700 px-3 py-2 rounded">Follow</button>
            </div>
            <div className="mt-6">
              <h3 className="font-bold">How it works</h3>
              <div className="mt-2 space-y-2 text-sm text-slate-300">
                {explanation.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded p-6 mt-4">
            <h3 className="font-bold mb-2">Detailed Description</h3>
            <p className="text-sm text-slate-300">{strategy.description}</p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-slate-800 rounded p-4">
            <h4 className="font-semibold">Creator</h4>
            <div className="mt-2">
              <div className="font-bold">{strategy.creator}</div>
              <div className="text-sm text-slate-400">Published: {strategy.createdAt}</div>
              <div className="text-sm mt-2">Published strategies: {strategy.creatorStats?.published || '—'}</div>
              <div className="text-sm">Followers: {strategy.followers}</div>
              <div className="text-sm">Total capital following: {strategy.creatorStats?.capitalFollowing ? `$${strategy.creatorStats.capitalFollowing.toLocaleString()}` : '—'}</div>
            </div>
            <div className="mt-4">
              <button onClick={() => navigate(`/builder/${strategy.id}`)} className="w-full bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded">Inspect in Builder</button>
            </div>
          </div>

          <div className="bg-slate-800 rounded p-4">
            <h4 className="font-semibold">Performance</h4>
            <div className="mt-2 text-sm">
              <div>Return (1y): <span className="font-semibold">+{strategy.stats?.return1y}%</span></div>
              <div>Sharpe: <span className="font-semibold">{strategy.stats?.sharpeRatio}</span></div>
              <div>Max Drawdown: <span className="font-semibold">{strategy.stats?.maxDrawdown}%</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
