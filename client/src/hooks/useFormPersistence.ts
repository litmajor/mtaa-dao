
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mtaa_dao_creation_draft';
const AUTO_SAVE_DELAY = 2000; // 2 seconds

export function useFormPersistence<T>(initialData: T) {
  const [data, setData] = useState<T>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialData;
      }
    }
    return initialData;
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastSaved(new Date());
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [data]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setData(initialData);
    setLastSaved(null);
  };

  return { data, setData, lastSaved, clearDraft };
}
