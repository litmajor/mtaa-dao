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
    <div style={{ padding: 24 }}>
      <h2>Batch Transfer</h2>
      {transfers.map((t, idx) => (
        <div key={idx} style={{ marginBottom: 8 }}>
          <input placeholder="To Address" value={t.toAddress} onChange={e => handleChange(idx, 'toAddress', e.target.value)} />
          <input placeholder="Amount" value={t.amount} onChange={e => handleChange(idx, 'amount', e.target.value)} />
          <input placeholder="Token Address (optional)" value={t.tokenAddress} onChange={e => handleChange(idx, 'tokenAddress', e.target.value)} />
        </div>
      ))}
      <button onClick={handleAdd}>Add Transfer</button>
      <button onClick={handleSubmit} disabled={loading}>Submit Batch</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
