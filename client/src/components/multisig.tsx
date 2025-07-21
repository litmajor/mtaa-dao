import React, { useState } from 'react';
import { getMultisigInfo } from '../api/walletApi';

export default function Multisig() {
  const [multisigAddress, setMultisigAddress] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [destination, setDestination] = useState('');
  const [value, setValue] = useState('');
  const [data, setData] = useState('');
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleInfo = async () => {
    setLoading(true);
    try {
      const res = await getMultisigInfo(multisigAddress);
      setInfo(res);
    } catch (e: any) {
      setInfo({ error: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  // TODO: Implement handleSubmit or import submitMultisigTransaction if available
  const handleSubmit = async () => {
    setSubmitResult({ error: 'submitMultisigTransaction is not implemented or exported.' });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Multisig</h2>
      <input placeholder="Multisig Address" value={multisigAddress} onChange={e => setMultisigAddress(e.target.value)} />
      <button onClick={handleInfo} disabled={loading}>Get Info</button>
      {info && <pre>{JSON.stringify(info, null, 2)}</pre>}
      <h3>Submit Transaction</h3>
      <input placeholder="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
      <input placeholder="Value" value={value} onChange={e => setValue(e.target.value)} />
      <input placeholder="Data (hex)" value={data} onChange={e => setData(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading}>Submit</button>
      {submitResult && <pre>{JSON.stringify(submitResult, null, 2)}</pre>}
    </div>
  );
}
