import React, { useState } from 'react';
import { batchTransfer } from '../api/walletApi';

export default function BatchTransfer() {
  const [transfers, setTransfers] = useState([
    { toAddress: '', amount: '', tokenAddress: '' }
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (idx: number, field: string, value: string) => {
    setTransfers(txs => txs.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleAdd = () => {
    setTransfers([...transfers, { toAddress: '', amount: '', tokenAddress: '' }]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formatted = transfers.map(t => ({ ...t, amount: Number(t.amount) }));
      const res = await batchTransfer(formatted);
      setResult(res);
    } catch (e: any) {
      setResult({ error: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-neutral-900 rounded-lg shadow space-y-8">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Batch Transfer</h2>
      <div className="space-y-4">
        {transfers.map((t, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="To Address"
              value={t.toAddress}
              onChange={e => handleChange(idx, 'toAddress', e.target.value)}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="Amount"
              value={t.amount}
              onChange={e => handleChange(idx, 'amount', e.target.value)}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="Token Address (optional)"
              value={t.tokenAddress}
              onChange={e => handleChange(idx, 'tokenAddress', e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700"
          onClick={handleAdd}
        >Add Transfer</button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          onClick={handleSubmit}
          disabled={loading}
        >Submit Batch</button>
      </div>
      {result && <pre className="bg-gray-100 dark:bg-neutral-800 rounded p-2 text-xs overflow-x-auto text-gray-900 dark:text-gray-100 mt-2">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
