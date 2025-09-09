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

  // State for multisig creation form
  const [walletName, setWalletName] = useState('');
  const [owners, setOwners] = useState(['', '']);
  const [threshold, setThreshold] = useState(1);
  const [multisigWallets, setMultisigWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create'); // or 'list'

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

  const createMultisig = async () => {
    if (!owners.every(owner => owner.trim()) || threshold < 1 || threshold > owners.length) {
      alert('Please provide valid owners and threshold');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet/multisig/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owners: owners.filter(owner => owner.trim()),
          threshold,
          name: walletName
        })
      });

      const data = await response.json();

      if (response.ok) {
        const newWallet = {
          id: data.address,
          address: data.address,
          name: walletName || `Multisig ${multisigWallets.length + 1}`,
          owners: data.owners,
          threshold: data.threshold,
          balance: '0',
          transactionCount: data.transactionCount || 0,
          createdAt: new Date().toISOString()
        };

        setMultisigWallets([...multisigWallets, newWallet]);

        // Reset form
        setWalletName('');
        setOwners(['', '']);
        setThreshold(1);
        setActiveTab('list');
      } else {
        throw new Error(data.error || 'Failed to create multisig wallet');
      }
    } catch (error) {
      console.error('Multisig creation failed:', error);
      alert(`Multisig creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMultisigInfo = async (address: string) => {
    try {
      const response = await fetch('/api/wallet/multisig/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multisigAddress: address })
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to load multisig info');
      }
    } catch (error) {
      console.error('Error loading multisig info:', error);
      return null;
    }
  };

  const submitTransaction = async (multisigAddress: string, destination: string, value: string, data: string = '0x') => {
    try {
      const response = await fetch('/api/wallet/multisig/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          multisigAddress,
          destination,
          value,
          data
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Transaction submitted successfully! TX: ${result.hash}`);
        return result;
      } else {
        throw new Error(result.error || 'Failed to submit transaction');
      }
    } catch (error) {
      console.error('Transaction submission failed:', error);
      alert(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Replaced the original handleSubmit with the new submitTransaction logic
  const handleSubmit = async () => {
    setLoading(true);
    const result = await submitTransaction(multisigAddress, destination, value, data);
    setSubmitResult(result);
    setLoading(false);
  };


  return (
    <div style={{ padding: 24 }}>
      <h2>Multisig</h2>

      {/* Tabs for Create/List/View */}
      <div>
        <button onClick={() => setActiveTab('create')} disabled={activeTab === 'create'}>Create</button>
        <button onClick={() => setActiveTab('list')} disabled={activeTab === 'list'}>List</button>
        <button onClick={() => setActiveTab('view')} disabled={activeTab === 'view'}>View</button>
      </div>

      {activeTab === 'create' && (
        <div>
          <h3>Create New Multisig Wallet</h3>
          <input placeholder="Wallet Name (optional)" value={walletName} onChange={e => setWalletName(e.target.value)} />
          {owners.map((owner, index) => (
            <input
              key={index}
              placeholder={`Owner Address ${index + 1}`}
              value={owner}
              onChange={e => {
                const newOwners = [...owners];
                newOwners[index] = e.target.value;
                setOwners(newOwners);
              }}
            />
          ))}
          <button onClick={() => setOwners([...owners, ''])}>Add Owner</button>
          <input
            type="number"
            placeholder="Threshold"
            value={threshold}
            onChange={e => setThreshold(parseInt(e.target.value, 10))}
            min="1"
            max={owners.length}
          />
          <button onClick={createMultisig} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Wallet'}
          </button>
        </div>
      )}

      {activeTab === 'list' && (
        <div>
          <h3>Your Multisig Wallets</h3>
          {multisigWallets.length === 0 ? (
            <p>No multisig wallets created yet.</p>
          ) : (
            <ul>
              {multisigWallets.map(wallet => (
                <li key={wallet.id}>
                  {wallet.name} ({wallet.address}) - Threshold: {wallet.threshold}/{wallet.owners.length}
                  <button onClick={() => { setMultisigAddress(wallet.address); setActiveTab('view'); }}>View</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'view' && (
        <div>
          <h3>Multisig Wallet Details</h3>
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
      )}
    </div>
  );
}