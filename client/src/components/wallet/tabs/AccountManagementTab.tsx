/**
 * AccountManagementTab Component
 * Transfer funds between user's own accounts
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface WalletAccount {
  id: string;
  accountType: 'wallet' | 'trading' | 'vault' | 'escrow';
  balance: string;
  currency: string;
  status: string;
}

interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
}

interface AccountManagementTabProps {
  accounts: WalletAccount[];
}

export default function AccountManagementTab({ accounts }: AccountManagementTabProps) {
  const [fromAccount, setFromAccount] = useState<WalletAccount | null>(
    accounts.length > 0 ? accounts[0] : null
  );
  const [toAccount, setToAccount] = useState<WalletAccount | null>(
    accounts.length > 1 ? accounts[1] : null
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<'trading' | 'savings' | 'profit_lock' | 'rebalance' | 'manual'>('manual');

  // Fetch transfer history
  const { data: transferHistory = [], refetch: refetchHistory } = useQuery<Transfer[]>({
    queryKey: ['transferHistory'],
    queryFn: async () => {
      const result = await authClient.get('/api/transfers/history');
      return result.data;
    },
  });

  // Fetch transfer statistics
  const { data: transferStats } = useQuery({
    queryKey: ['transferStatistics'],
    queryFn: async () => {
      const result = await authClient.get('/api/transfers/statistics');
      return result.data;
    },
  });

  // Create transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: async (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: string;
      reason: string;
    }) => {
      return authClient.post('/api/transfers', data);
    },
    onSuccess: () => {
      refetchHistory();
      setAmount('');
      setReason('manual');
    },
  });

  const handleCreateTransfer = () => {
    if (!fromAccount || !toAccount || !amount) {
      return;
    }

    createTransferMutation.mutate({
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount,
      reason,
    });
  };

  const canTransfer =
    fromAccount &&
    toAccount &&
    fromAccount.id !== toAccount.id &&
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(fromAccount.balance);

  const getReasonDescription = (reason: string) => {
    const descriptions: Record<string, string> = {
      trading: 'Prepare funds for trading',
      savings: 'Move to savings vault',
      profit_lock: 'Lock in profits',
      rebalance: 'Rebalance portfolio',
      manual: 'Manual transfer',
    };
    return descriptions[reason] || reason;
  };

  return (
    <div className="space-y-6">
      {/* Transfer Form */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Transfer Between Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From Account */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              From Account
            </label>
            <select
              value={fromAccount?.id || ''}
              onChange={(e) => {
                const account = accounts.find((a) => a.id === e.target.value);
                setFromAccount(account || null);
              }}
              aria-label="Select source account for transfer"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)} -
                  Balance: {parseFloat(account.balance).toFixed(2)} {account.currency}
                </option>
              ))}
            </select>
          </div>

          {/* To Account */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              To Account
            </label>
            <select
              value={toAccount?.id || ''}
              onChange={(e) => {
                const account = accounts.find((a) => a.id === e.target.value);
                setToAccount(account || null);
              }}
              aria-label="Select destination account for transfer"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
            >
              {accounts
                .filter((a) => a.id !== fromAccount?.id)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)}
                  </option>
                ))}
            </select>
          </div>

          {/* Transfer Arrow */}
          {fromAccount && toAccount && fromAccount.id !== toAccount.id && (
            <div className="flex items-center justify-center p-4 bg-gray-800 rounded border border-gray-600">
              <div className="text-right flex-1 pr-3">
                <div className="text-sm text-gray-400 mb-1">From</div>
                <div className="text-lg font-semibold text-white">
                  {fromAccount.accountType}
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-green-400" />
              <div className="text-left flex-1 pl-3">
                <div className="text-sm text-gray-400 mb-1">To</div>
                <div className="text-lg font-semibold text-white">
                  {toAccount.accountType}
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={fromAccount ? parseFloat(fromAccount.balance) : 0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            {fromAccount && (
              <div className="mt-2 text-xs text-gray-400">
                Available: {parseFloat(fromAccount.balance).toFixed(2)} {fromAccount.currency}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as 'trading' | 'savings' | 'profit_lock' | 'rebalance' | 'manual')
              }
              aria-label="Select reason for transfer"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="trading">Prepare for Trading</option>
              <option value="savings">Move to Savings</option>
              <option value="profit_lock">Lock in Profits</option>
              <option value="rebalance">Rebalance Portfolio</option>
              <option value="manual">Manual Transfer</option>
            </select>
            <div className="mt-2 text-xs text-gray-400">
              {getReasonDescription(reason)}
            </div>
          </div>

          {/* Transfer Summary */}
          {amount && canTransfer && (
            <div className="p-4 bg-gray-800 rounded border border-green-600 border-opacity-30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Transfer Amount:</span>
                <span className="text-lg font-semibold text-green-400">
                  {parseFloat(amount).toFixed(2)} {fromAccount?.currency}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-300">Fee:</span>
                <span className="text-green-400">Free (Internal Transfer)</span>
              </div>
            </div>
          )}

          <button
            onClick={handleCreateTransfer}
            disabled={!canTransfer || createTransferMutation.isPending}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
          >
            {createTransferMutation.isPending ? 'Processing...' : 'Confirm Transfer'}
          </button>

          {createTransferMutation.isError && (
            <div className="p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded text-red-300 text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{(createTransferMutation.error as Error).message}</span>
            </div>
          )}

          {createTransferMutation.isSuccess && (
            <div className="p-3 bg-green-900 bg-opacity-20 border border-green-700 rounded text-green-300 text-sm flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Transfer completed successfully!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {transferStats && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Transfer Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Total Transfers</div>
                <div className="text-2xl font-bold text-white">
                  {transferStats.totalTransfers}
                </div>
              </div>

              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Total Amount</div>
                <div className="text-lg font-bold text-white">
                  ${parseFloat(transferStats.totalAmount || '0').toFixed(2)}
                </div>
              </div>

              {transferStats.byReason?.trading && (
                <div className="p-3 bg-gray-800 rounded border border-gray-600">
                  <div className="text-xs text-gray-400 mb-1">Trading Transfers</div>
                  <div className="text-lg font-bold text-white">
                    {transferStats.byReason.trading.count}
                  </div>
                </div>
              )}

              {transferStats.byReason?.savings && (
                <div className="p-3 bg-gray-800 rounded border border-gray-600">
                  <div className="text-xs text-gray-400 mb-1">Savings Transfers</div>
                  <div className="text-lg font-bold text-white">
                    {transferStats.byReason.savings.count}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transfers */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Recent Transfers ({transferHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transferHistory.length > 0 ? (
            <div className="space-y-3">
              {transferHistory.slice(0, 10).map((transfer) => {
                const fromAcc = accounts.find((a) => a.id === transfer.fromAccountId);
                const toAcc = accounts.find((a) => a.id === transfer.toAccountId);

                return (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded border border-gray-600"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="text-white font-medium">
                          {fromAcc?.accountType} → {toAcc?.accountType}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">{transfer.reason}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-400">
                        {parseFloat(transfer.amount).toFixed(2)} {transfer.currency}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No transfers yet. Start by creating a transfer above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
