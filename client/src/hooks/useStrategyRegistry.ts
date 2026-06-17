import { useState, useCallback } from 'react';

type Strategy = { id: string; name: string; description?: string };

export function useStrategyRegistry() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  const loadStrategies = useCallback(async () => {
    // lightweight stub: attempt to fetch from API if available, otherwise keep empty
    try {
      const res = await fetch('/api/v1/strategies').then(r => r.ok ? r.json() : null).catch(() => null);
      if (res && Array.isArray(res)) setStrategies(res as Strategy[]);
    } catch (e) {
      // ignore
    }
  }, []);

  return { strategies, loadStrategies };
}

export default useStrategyRegistry;
