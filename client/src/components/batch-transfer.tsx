import React, { useState, useEffect } from 'react';
import { batchTransfer, getBalance } from '../api/walletApi';

// Simple toast (replace with real toast lib if available)
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if ((window as any).toast) {
    (window as any).toast(message, { type });
  } else {
    alert(message);
  }
}

// Simple analytics event tracker (replace with real analytics as needed)
function trackBatchTransferEvent(event: string, data?: any) {
  if (window && (window as any).gtag) {
    (window as any).gtag('event', event, data || {});
  } else {
    // Fallback: log to console
    console.log('[Analytics]', event, data);
  }
}

// Accept address as prop for fetching real balance
export default function BatchTransfer({ address }: { address?: string }) {
  const MAX_RECIPIENTS = 20;
  const MAX_TOTAL_AMOUNT = 10000; // Example: 10,000 tokens/cUSD
  const MAX_PER_RECIPIENT = 1000; // Example: 1,000 tokens/cUSD
  const FEE_PER_BATCH = 5; // Example: 5 MTAA fee per batch
  const [transfers, setTransfers] = useState([
    { toAddress: '', amount: '', tokenAddress: '' }
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<any[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Basic address validation (ETH/Celo format)
  const isValidAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

  // Fetch real MTAA balance for the user
  useEffect(() => {
    async function fetchBalances() {
      if (!address) return;
      setBalanceLoading(true);
      try {
        const res = await getBalance(address);
        let mtaa = 0;
        let tokens: any[] = [];
        if (Array.isArray(res.tokens)) {
          tokens = res.tokens;
          const mtaaToken = res.tokens.find((t: any) => t.symbol?.toUpperCase() === 'MTAA');
          if (mtaaToken) mtaa = Number(mtaaToken.balance || 0);
        } else if (res.symbol) {
          tokens = [res];
          if (res.symbol?.toUpperCase() === 'MTAA') mtaa = Number(res.balance || 0);
        }
        setUserBalance(mtaa);
        setTokenBalances(tokens);
      } catch (e) {
        setUserBalance(null);
        setTokenBalances([]);
      } finally {
        setBalanceLoading(false);
      }
    }
    fetchBalances();
  }, [address]);

  const handleChange = (idx: number, field: string, value: string) => {
    setTransfers(txs => txs.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleAdd = () => {
    if (transfers.length >= MAX_RECIPIENTS) {
      setError(`Maximum ${MAX_RECIPIENTS} recipients per batch.`);
      return;
    }
    setError(null);
    setTransfers([...transfers, { toAddress: '', amount: '', tokenAddress: '' }]);
  };

  const handleRemove = (idx: number) => {
    setTransfers(txs => txs.filter((_, i) => i !== idx));
  };

  const totalAmount = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const validate = () => {
    if (transfers.length === 0) return 'At least one transfer required.';
    const addresses = new Set();
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      if (!isValidAddress(t.toAddress)) return `Row ${i + 1}: Invalid address.`;
      if (addresses.has(t.toAddress)) return `Row ${i + 1}: Duplicate address.`;
      addresses.add(t.toAddress);
      if (!t.amount || isNaN(Number(t.amount)) || Number(t.amount) <= 0) return `Row ${i + 1}: Invalid amount.`;
      if (Number(t.amount) > MAX_PER_RECIPIENT) return `Row ${i + 1}: Amount exceeds per-recipient limit (${MAX_PER_RECIPIENT}).`;
    }
    if (totalAmount > MAX_TOTAL_AMOUNT) return `Total amount exceeds batch limit (${MAX_TOTAL_AMOUNT}).`;
    if (userBalance !== null && userBalance < FEE_PER_BATCH) return `Insufficient MTAA for batch fee (${FEE_PER_BATCH} MTAA required).`;
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      showToast(validationError, 'error');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    showToast('Submitting batch transfer...', 'info');
    // Track analytics event for batch submission
    trackBatchTransferEvent('batch_transfer_submitted', {
      count: transfers.length,
      totalAmount,
      tokens: Array.from(new Set(transfers.map(t => t.tokenAddress || 'native'))),
    });
    try {
      const formatted = transfers.map(t => ({ ...t, amount: Number(t.amount) }));
      const res = await batchTransfer(formatted);
      setResult(res);
      if (!res.error) {
        showToast('Batch transfer submitted successfully!', 'success');
      } else {
        showToast('Batch transfer failed: ' + res.error, 'error');
      }
      // Track analytics event for result
      trackBatchTransferEvent('batch_transfer_result', {
        success: !res.error,
        error: res.error,
        count: transfers.length,
        totalAmount,
      });
    } catch (e: any) {
      setResult({ error: e.message || String(e) });
      showToast('Batch transfer failed: ' + (e.message || String(e)), 'error');
      trackBatchTransferEvent('batch_transfer_result', {
        success: false,
        error: e.message || String(e),
        count: transfers.length,
        totalAmount,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-neutral-900 rounded-lg shadow space-y-8">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Batch Transfer</h2>
      <div className="text-xs text-gray-500 mb-2">
        <span>
          <b>Note:</b> For FOA (fee-on-action) or premium batch actions, a small fee in MTAA may be required.<br />
          <b>Fee:</b> {FEE_PER_BATCH} MTAA per batch. <b>Max per recipient:</b> {MAX_PER_RECIPIENT}. <b>Max total:</b> {MAX_TOTAL_AMOUNT}.
        </span>
        {balanceLoading ? (
          <span className="ml-2 text-blue-500 animate-pulse">Loading balances...</span>
        ) : null}
      </div>
      <div className="mb-2">
        <b>Your Balances:</b>
        {balanceLoading ? (
          <span className="ml-2 text-blue-500 animate-pulse">Loading...</span>
        ) : tokenBalances.length === 0 ? (
          <span className="ml-2 text-gray-400">No tokens found</span>
        ) : (
          <ul className="ml-2 inline">
            {tokenBalances.map((t, i) => (
              <li key={i} className="inline-block mr-4 text-xs text-gray-700 dark:text-gray-200">
                <b>{t.symbol}:</b> {t.balance}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-4">
        {transfers.map((t, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center relative">
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
            {transfers.length > 1 && (
              <button
                className="absolute -right-8 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 font-bold text-lg"
                onClick={() => handleRemove(idx)}
                title="Remove row"
                type="button"
              >×</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700"
          onClick={handleAdd}
          disabled={transfers.length >= MAX_RECIPIENTS}
        >Add Transfer</button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          onClick={handleSubmit}
          disabled={loading}
        >Submit Batch</button>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
        <b>Total Amount:</b> {totalAmount}
        {userBalance !== null && (
          <span> | <b>Your MTAA:</b> {userBalance}</span>
        )}
      </div>
      {error && <div className="text-red-600 font-medium text-sm mt-2">{error}</div>}
      {result && <pre className="bg-gray-100 dark:bg-neutral-800 rounded p-2 text-xs overflow-x-auto text-gray-900 dark:text-gray-100 mt-2">{JSON.stringify(result, null, 2)}</pre>}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-8 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Confirm Batch Transfer</h3>
            <div className="mb-2 text-sm text-gray-700 dark:text-gray-300">
              <b>Recipients:</b> {transfers.length}<br />
              <b>Total Amount:</b> {totalAmount}<br />
              <b>Fee:</b> {FEE_PER_BATCH} MTAA<br />
              <b>Are you sure you want to proceed?</b>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                onClick={handleConfirm}
                disabled={loading}
              >Confirm</button>
              <button
                className="px-4 py-2 rounded bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
