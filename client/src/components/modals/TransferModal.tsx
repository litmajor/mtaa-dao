/**
 * Transfer Modal
 * Allows users to transfer funds between their own accounts (profiles/subprofiles)
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';

interface Account {
  id: string;
  type: string;
  name: string;
  balance?: string;
  address?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: Account[];
  userAddress?: string;
}

export default function TransferModal({
  isOpen,
  onClose,
  accounts = [],
  userAddress = '',
}: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [transferData, setTransferData] = useState<any>(null);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!fromAccountId || !toAccountId || !amount) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (fromAccountId === toAccountId) {
      setError('Cannot transfer to the same account');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      setSuccess(true);
      setTransferData(data.data);
      
      // Reset form
      setTimeout(() => {
        setFromAccountId('');
        setToAccountId('');
        setAmount('');
        setReason('manual');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to transfer funds');
    } finally {
      setLoading(false);
    }
  };

  const selectedFromAccount = accounts.find(a => a.id === fromAccountId);
  const selectedToAccount = accounts.find(a => a.id === toAccountId);
  const maxAmount = selectedFromAccount?.balance ? parseFloat(selectedFromAccount.balance) : 0;
  const isAmountValid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= maxAmount;

  const availableToAccounts = accounts.filter(a => a.id !== fromAccountId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-md w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Transfer Between Accounts</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="bg-green-600/20 p-3 rounded-full">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <h3 className="text-green-500 font-semibold mb-2">Transfer Successful!</h3>
              <p className="text-slate-400 text-sm">
                {amount} transferred from {selectedFromAccount?.name} to {selectedToAccount?.name}
              </p>
            </div>
          ) : (
            <>
              {/* From Account */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  From Account
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => {
                    setFromAccountId(e.target.value);
                    setToAccountId('');
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select account</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} {acc.balance ? `(${acc.balance})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* To Account */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  To Account
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  disabled={!fromAccountId || availableToAccounts.length === 0}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select account</option>
                  {availableToAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Amount
                  {maxAmount > 0 && (
                    <span className="text-slate-400 text-xs ml-2">
                      (Max: {maxAmount.toFixed(8)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.00000001"
                  min="0"
                  disabled={!fromAccountId}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="manual">Manual Transfer</option>
                  <option value="trading">Trading</option>
                  <option value="savings">Savings</option>
                  <option value="profit_lock">Profit Lock</option>
                  <option value="rebalance">Rebalance</option>
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex gap-2 p-3 bg-red-600/10 border border-red-600/20 rounded text-sm text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex gap-3 p-6 border-t border-slate-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || !isAmountValid || !toAccountId}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
            >
              {loading ? 'Processing...' : 'Transfer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
