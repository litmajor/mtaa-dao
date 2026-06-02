// Browser shim to provide `process.env` for legacy code that expects Node-style env
// This copies selected `import.meta.env` values into `window.process.env` so older
// client modules using `process.env.FOO` continue to work under Vite.
if (typeof window !== 'undefined') {
  const w: any = window;
  if (!w.process) w.process = { env: {} };
  try {
    w.process.env.NODE_ENV = (import.meta.env.MODE as string) || w.process.env.NODE_ENV || 'development';

    // Copy VITE_ and MODE keys into process.env for compatibility
    for (const k in import.meta.env) {
      try {
        if (k.startsWith('VITE_') || k === 'MODE' || k === 'NODE_ENV') {
          w.process.env[k] = (import.meta.env as any)[k];
        }
      } catch (e) {
        // ignore individual key copy failures
      }
    }

    // Map common legacy names to Vite names when available
    if ((import.meta.env as any).VITE_API_URL) {
      w.process.env.REACT_APP_API_URL = (import.meta.env as any).VITE_API_URL;
      w.process.env.VITE_API_URL = (import.meta.env as any).VITE_API_URL;
    }
    if ((import.meta.env as any).VITE_WS_URL) {
      w.process.env.NEXT_PUBLIC_WS_URL = (import.meta.env as any).VITE_WS_URL;
      w.process.env.REACT_APP_WS_URL = (import.meta.env as any).VITE_WS_URL;
    }
  } catch (e) {
    // no-op
  }
}

export {};
