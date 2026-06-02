import React, { useEffect, useState } from 'react';
import { X } from '../../lib/icons';
import { io, Socket } from 'socket.io-client';

interface Props {
  open: boolean;
  onClose: () => void;
  signalsUrl?: string | null;
  executionId?: string | null;
}

function prefixApi(url: string) {
  if (!url) return url;
  // if backend returned a v1 path like /v1/..., prefix with /api
  if (url.startsWith('/v1/')) return `/api${url}`;
  // already absolute or starts with /api
  return url;
}

export default function DeployProgressModal({ open, onClose, signalsUrl, executionId }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!open) return;
    setLogs([]);

    // First try Socket.IO with room subscription when executionId is present
    let es: EventSource | null = null;
    let s: Socket | null = null;

    const trySocket = async () => {
      if (!executionId) return false;
      try {
        const endpoint = (process.env.REACT_APP_WS_URL || '') || undefined;
        // default to same origin
        const socketUrl = endpoint || window.location.origin;
        s = io(socketUrl, { withCredentials: true });
        setSocket(s);

        s.on('connect', () => {
          setConnected(true);
          // subscribe to execution room on server; room name matches Redis channel
          const room = `execution:${executionId}`;
          s!.emit('subscribe:room', { room });
          setLogs((l) => [...l, `Connected to WS room ${room}`]);
        });

        s.on('execution:log', (payload: any) => {
          try {
            const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
            setLogs((l) => [...l, text]);
          } catch (err) {
            setLogs((l) => [...l, `Malformed WS payload: ${String(err)}`]);
          }
        });

        s.on('disconnect', () => setConnected(false));

        s.on('connect_error', (err: any) => {
          setLogs((l) => [...l, `WS connect error: ${err?.message || String(err)}`]);
        });

          return true;
      } catch (err) {
        console.warn('Socket.IO connect failed', err);
        return false;
      }
    };

      (async () => {
        const startedSocket = await trySocket();
        if (!startedSocket) {
      if (!signalsUrl) {
        setLogs((l) => [...l, `Deployment started${executionId ? ` (execution ${executionId})` : ''}. No progress channel available.`]);
        return;
      }

      const url = prefixApi(signalsUrl as string);
      try {
        es = new EventSource(url, { withCredentials: true } as any);
      } catch (e) {
        setLogs((l) => [...l, `Failed to open EventSource: ${String(e)}`]);
        return;
      }

      es.onopen = () => {
        setConnected(true);
        setLogs((l) => [...l, 'Connected to progress stream']);
      };

      es.onmessage = (ev) => {
        try {
          const data = ev.data;
          setLogs((l) => [...l, data]);
        } catch (err) {
          setLogs((l) => [...l, `Malformed message: ${String(err)}`]);
        }
      };

      es.onerror = (err) => {
        setLogs((l) => [...l, 'Stream error or closed']);
        setConnected(false);
        try {
          es?.close();
        } catch (_) {}
      };
      }
    })();

    return () => {
      if (es) {
        try { es.close(); } catch (_) {}
      }
      if (s) {
        try { s.disconnect(); } catch (_) {}
        setSocket(null);
      }
    };
  }, [open, signalsUrl, executionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-lg p-4 z-60 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Deployment Progress</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded" aria-label="Close deployment progress">
            <X className="h-4 w-4"/>
          </button>
        </div>
        <div className="mb-2 text-xs text-slate-400">{connected ? 'Streaming logs' : 'Not streaming'}</div>
        <div className="h-64 overflow-y-auto bg-slate-900 p-3 rounded text-sm border border-slate-700">
          {logs.length === 0 ? (
            <div className="text-slate-400">Waiting for logs...</div>
          ) : (
            logs.map((l, i) => <div key={i} className="text-xs text-slate-200 whitespace-pre-wrap">{l}</div>)
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <a href={signalsUrl ? prefixApi(signalsUrl) : '#'} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:underline">Open stream</a>
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
