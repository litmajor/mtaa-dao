import { useState, useCallback } from 'react';
import { validateGraph } from '../engine/strategy-validator';
import { compileGraph } from '../engine/strategy-compiler';
import * as deployService from '../services/deploy';

type Status = 'idle' | 'validating' | 'compiling' | 'deploying' | 'done' | 'error';

export default function useStrategyDeployment() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [signalsUrl, setSignalsUrl] = useState<string | null>(null);

  const deploy = useCallback(async (graph: any, opts?: any, onProgress?: (msg: string) => void) => {
    setStatus('validating');
    setError(null);
    setExecutionId(null);
    setLogs([]);

    const validation = validateGraph(graph);
    if (!validation.valid) {
      const msg = 'Validation failed: ' + (validation.errors || []).join('\n');
      setStatus('error');
      setError(msg);
      if (onProgress) onProgress(msg);
      return { success: false, error: msg, details: validation };
    }

    setStatus('compiling');
    if (onProgress) onProgress('Compiling strategy...');
    const compiled = compileGraph(graph);

    setStatus('deploying');
    if (onProgress) onProgress('Deploying strategy...');
    try {
      const res = await deployService.deployCompiledStrategy(compiled, opts?.deploymentConfig);
      // backend may return different shapes; try common fields
      const id = res?.executionId || res?.id || res?.data?.executionId || res?.data?.id || null;
      const sUrl = res?.signalsUrl || res?.data?.signalsUrl || res?.signals_url || res?.data?.signals_url || null;
      setExecutionId(id);
      setSignalsUrl(sUrl);
      setStatus('done');
      if (onProgress) onProgress('Deployment completed');
      return { success: true, executionId: id, signalsUrl: sUrl, data: res };
    } catch (e: any) {
      const msg = e?.message || String(e);
      setStatus('error');
      setError(msg);
      if (onProgress) onProgress('Deployment failed: ' + msg);
      return { success: false, error: msg };
    }
  }, []);

  // ----- Bot management compatibility layer (lightweight stubs) -----
  const [bots, setBots] = useState<any[]>([]);

  const loadBots = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/bots').then(r => r.ok ? r.json() : null).catch(() => null);
      if (res && Array.isArray(res.data)) setBots(res.data);
    } catch (e) {
      // ignore
    }
  }, []);

  const deployBot = useCallback(async (strategy: any, inputs: any, riskControl: any, exchanges: string[], botName: string, initialCapital: number, options?: { dry_run?: boolean }) => {
    // simple wrapper around deploy for compatibility with older callers
    const graph = strategy?.graph || strategy;
    const deploymentConfig = {
      tradingPair: undefined,
      exchangeConnections: exchanges || [],
      enableRealTrading: options?.dry_run === false,
    };
    const r = await deploy(graph, { deploymentConfig }, undefined as any);
    // attempt to refresh bots
    await loadBots();
    return r;
  }, [deploy, loadBots]);

  const pauseBot = useCallback(async (botId: string) => {
    try { await fetch(`/api/v1/bots/${botId}/pause`, { method: 'POST' }); await loadBots(); } catch (e) {}
  }, [loadBots]);

  const resumeBot = useCallback(async (botId: string) => {
    try { await fetch(`/api/v1/bots/${botId}/resume`, { method: 'POST' }); await loadBots(); } catch (e) {}
  }, [loadBots]);

  const stopBot = useCallback(async (botId: string) => {
    try { await fetch(`/api/v1/bots/${botId}/stop`, { method: 'POST' }); await loadBots(); } catch (e) {}
  }, [loadBots]);

  const getTotalPerformance = useCallback(() => {
    // compute a simple aggregate for UI
    const profit = bots.reduce((s, b) => s + (b.pnl || 0), 0);
    const trades = bots.reduce((s, b) => s + (b.trades || 0), 0);
    const wins = bots.reduce((s, b) => s + (b.wins || 0), 0);
    const winRate = trades > 0 ? (wins / trades) * 100 : 0;
    const profitFactor = Math.max(0.01, profit / Math.max(1, bots.reduce((s, b) => s + (b.loss || 0), 0)));
    const openPositions = bots.reduce((s, b) => s + (b.openPositions || 0), 0);
    return { profit, trades, winRate, profitFactor, openPositions };
  }, [bots]);

  // expose original deploy API plus compatibility helpers
  return { deploy, status, error, executionId, signalsUrl, logs, setLogs, bots, loadBots, deployBot, pauseBot, resumeBot, stopBot, getTotalPerformance };
}
