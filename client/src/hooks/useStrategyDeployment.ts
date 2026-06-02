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
      const res = await deployService.deployCompiledStrategy(compiled);
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

  return { deploy, status, error, executionId, signalsUrl, logs, setLogs };
}
