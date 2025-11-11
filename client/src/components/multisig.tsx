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
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-neutral-900 rounded-lg shadow space-y-8">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Multisig</h2>

      {/* Tabs for Create/List/View */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded font-semibold border transition-colors ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-neutral-700'}`}
          onClick={() => setActiveTab('create')}
          disabled={activeTab === 'create'}
        >Create</button>
        <button
          className={`px-4 py-2 rounded font-semibold border transition-colors ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-neutral-700'}`}
          onClick={() => setActiveTab('list')}
          disabled={activeTab === 'list'}
        >List</button>
        <button
          className={`px-4 py-2 rounded font-semibold border transition-colors ${activeTab === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-neutral-700'}`}
          onClick={() => setActiveTab('view')}
          disabled={activeTab === 'view'}
        >View</button>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create New Multisig Wallet</h3>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 mb-2"
            placeholder="Wallet Name (optional)"
            value={walletName}
            onChange={e => setWalletName(e.target.value)}
          />
          <div className="space-y-2">
            {owners.map((owner, index) => (
              <input
                key={index}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                placeholder={`Owner Address ${index + 1}`}
                value={owner}
                onChange={e => {
                  const newOwners = [...owners];
                  newOwners[index] = e.target.value;
                  setOwners(newOwners);
                }}
              />
            ))}
          </div>
          <button
            className="mt-2 px-3 py-1 rounded bg-green-600 text-white font-semibold hover:bg-green-700"
            onClick={() => setOwners([...owners, ''])}
          >Add Owner</button>
          <input
            type="number"
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 mt-2"
            placeholder="Threshold"
            value={threshold}
            onChange={e => setThreshold(parseInt(e.target.value, 10))}
            min="1"
            max={owners.length}
          />
          <button
            className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            onClick={createMultisig}
            disabled={isLoading}
          >{isLoading ? 'Creating...' : 'Create Wallet'}</button>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Your Multisig Wallets</h3>
          {multisigWallets.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No multisig wallets created yet.</p>
          ) : (
            <ul className="space-y-2">
              {multisigWallets.map(wallet => (
                <li key={wallet.id} className="flex items-center justify-between bg-gray-100 dark:bg-neutral-800 rounded px-3 py-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{wallet.name}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">({wallet.address})</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Threshold: {wallet.threshold}/{wallet.owners.length}</span>
                  <button
                    className="ml-2 px-2 py-1 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600"
                    onClick={() => { setMultisigAddress(wallet.address); setActiveTab('view'); }}
                  >View</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'view' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Multisig Wallet Details</h3>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 mb-2"
            placeholder="Multisig Address"
            value={multisigAddress}
            onChange={e => setMultisigAddress(e.target.value)}
          />
          <button
            className="mb-2 px-3 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
            onClick={handleInfo}
            disabled={loading}
          >Get Info</button>
          {info && <pre className="bg-gray-100 dark:bg-neutral-800 rounded p-2 text-xs overflow-x-auto text-gray-900 dark:text-gray-100">{JSON.stringify(info, null, 2)}</pre>}
          <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-4">Submit Transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="Destination"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="Value"
              value={value}
              onChange={e => setValue(e.target.value)}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              placeholder="Data (hex)"
              value={data}
              onChange={e => setData(e.target.value)}
            />
          </div>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
            onClick={handleSubmit}
            disabled={loading}
          >Submit</button>
          {submitResult && <pre className="bg-gray-100 dark:bg-neutral-800 rounded p-2 text-xs overflow-x-auto text-gray-900 dark:text-gray-100 mt-2">{JSON.stringify(submitResult, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}