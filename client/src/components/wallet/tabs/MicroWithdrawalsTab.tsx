/**
 * MicroWithdrawalsTab Component
 * Manage micro-withdrawals (< $10, batched for efficiency)
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface MicroWithdrawal {
  id: string;
  amount: string;
  currency: string;
  destinationAddress: string;
  status: 'pending' | 'batched' | 'processing' | 'completed' | 'failed';
  batchId?: string;
  batchStatus?: string;
  createdAt: string;
}

interface WalletAccount {
  id: string;
  accountType: string;
  balance: string;
  currency: string;
}

interface MicroWithdrawalsTabProps {
  accounts?: WalletAccount[];
}

export default function MicroWithdrawalsTab({ accounts = [] }: MicroWithdrawalsTabProps) {
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(
    accounts.length > 0 ? accounts[0] : null
  );
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  // Fetch pending micro-withdrawals
  const { data: pendingMicroWithdrawals = [], refetch: refetchPending } = useQuery<MicroWithdrawal[]>({
    queryKey: ['pendingMicroWithdrawals'],
    queryFn: async () => {
      const result = await authClient.get('/api/v1/wallets/withdrawals/micro/pending');
      return result.data;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Fetch completed micro-withdrawals history
  const { data: microWithdrawalHistory = [] } = useQuery<MicroWithdrawal[]>({
    queryKey: ['microWithdrawalHistory'],
    queryFn: async () => {
      const result = await authClient.get('/api/v1/wallets/withdrawals/user/history?type=micro');
      return result.data?.filter((w: any) => w.destination === 'micro_withdrawal') || [];
    },
  });

  // Create micro-withdrawal
  const createMicroWithdrawalMutation = useMutation({
    mutationFn: async (data: {
      fromAccountId: string;
      destinationAddress: string;
      amount: string;
    }) => {
      return authClient.post('/api/v1/wallets/withdrawals/micro', data);
    },
    onSuccess: () => {
      refetchPending();
      setAmount('');
      setDestinationAddress('');
    },
  });

  const handleCreateMicroWithdrawal = () => {
    if (!selectedAccount || !amount || !destinationAddress) {
      return;
    }

    createMicroWithdrawalMutation.mutate({
      fromAccountId: selectedAccount.id,
      destinationAddress,
      amount,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'batched':
        return 'text-blue-400';
      case 'processing':
        return 'text-blue-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending':
      case 'batched':
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const totalPending = pendingMicroWithdrawals.reduce(
    (sum, mw) => sum + parseFloat(mw.amount || '0'),
    0
  );

  const minAmount = 0.5;
  const maxAmount = 9.99;

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <Card className="bg-blue-900 bg-opacity-20 border-blue-700">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-blue-300 mb-1">Micro-Withdrawals Explained</div>
              <div className="text-sm text-blue-200">
                Micro-withdrawals are amounts less than $10 that are batched together to save on
                gas fees. Your requests are held until a batch reaches a threshold, then processed
                together. This typically takes 24-48 hours.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Micro-Withdrawal Form */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Create Micro-Withdrawal Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Source Account
            </label>
            <select
              value={selectedAccount?.id || ''}
              onChange={(e) => {
                const account = accounts.find((a) => a.id === e.target.value);
                setSelectedAccount(account || null);
              }}
              aria-label="Select source account for micro-withdrawal"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountType} - {account.balance} {account.currency}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount ({minAmount} - {maxAmount} USD)
            </label>
            <input
              type="number"
              step="0.01"
              min={minAmount}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-2 text-xs text-gray-400">
              Valid range: ${minAmount} - ${maxAmount}
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Destination Address
            </label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="Enter wallet address"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleCreateMicroWithdrawal}
            disabled={
              !selectedAccount ||
              !amount ||
              !destinationAddress ||
              parseFloat(amount) < minAmount ||
              parseFloat(amount) > maxAmount ||
              createMicroWithdrawalMutation.isPending
            }
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
          >
            {createMicroWithdrawalMutation.isPending
              ? 'Creating Request...'
              : 'Create Micro-Withdrawal Request'}
          </button>
        </CardContent>
      </Card>

      {/* Pending Batch Summary */}
      {pendingMicroWithdrawals.length > 0 && (
        <Card className="bg-yellow-900 bg-opacity-20 border-yellow-700">
          <CardHeader>
            <CardTitle className="text-yellow-300">Pending Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-yellow-200 mb-1">Total Pending</div>
                <div className="text-2xl font-bold text-yellow-300">
                  ${totalPending.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-yellow-200 mb-1">Requests</div>
                <div className="text-2xl font-bold text-yellow-300">
                  {pendingMicroWithdrawals.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-yellow-200 mb-1">Expected Time</div>
                <div className="text-sm font-semibold text-yellow-300 mt-1">24-48 hours</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Micro-Withdrawals List */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">
            Pending Requests ({pendingMicroWithdrawals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingMicroWithdrawals.length > 0 ? (
            <div className="space-y-3">
              {pendingMicroWithdrawals.map((mw) => (
                <div
                  key={mw.id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded border border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getStatusIcon(mw.status)}
                    <div>
                      <div className="text-white font-medium">
                        ${parseFloat(mw.amount).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        to {mw.destinationAddress.substring(0, 10)}...
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(mw.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs capitalize font-semibold ${getStatusColor(mw.status)}`}>
                      {mw.status}
                    </div>
                    {mw.batchId && (
                      <div className="text-xs text-gray-400 mt-1">
                        Batch: {mw.batchId.substring(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No pending micro-withdrawal requests.
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Completed Micro-Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          {microWithdrawalHistory.length > 0 ? (
            <div className="space-y-3">
              {microWithdrawalHistory.map((mw) => (
                <div
                  key={mw.id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded border border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <div>
                      <div className="text-white font-medium">
                        ${parseFloat(mw.amount).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(mw.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No completed micro-withdrawals yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
