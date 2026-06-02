import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

export function ConfirmMorioActionModal({ open, onClose, token, summary, onConfirmed }: { open: boolean; onClose: () => void; token: string; summary?: string; onConfirmed?: (res: any) => void }) {
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/morio/confirm-action', { token });
      const json = await res.json();
      setLoading(false);
      onConfirmed && onConfirmed(json);
      onClose();
    } catch (e) {
      setLoading(false);
      alert('Failed to execute action: ' + (e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow max-w-lg w-full">
        <h3 className="text-lg font-medium">Confirm Action</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{summary || 'Confirm this action?'}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading}>{loading ? 'Executing…' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  );
}
