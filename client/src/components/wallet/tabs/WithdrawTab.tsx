/**
 * WithdrawTab Component
 * Handle withdrawals to various destinations
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface WithdrawalMethod {
  id: string;
  name: string;
  provider: string;
  type: string;
  destination: string;
  minAmount: string;
  maxAmount: string;
  fee: string;
}

interface WalletAccount {
  id: string;
  accountType: string;
  balance: string;
  currency: string;
}

interface WithdrawTabProps {
  methods: WithdrawalMethod[];
  accounts: WalletAccount[];
}

interface WithdrawalHistory {
  id: string;
  destination: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionHash?: string;
  createdAt: string;
}

export default function WithdrawTab({ methods, accounts }: WithdrawTabProps) {
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(
    accounts.length > 0 ? accounts[0] : null
  );
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<any>(null);

  // Fetch withdrawal history
  const { data: withdrawalHistory, refetch: refetchHistory } = useQuery<WithdrawalHistory[]>({
    queryKey: ['withdrawalHistory'],
    queryFn: async () => {
      const data = await authClient.get('/api/v1/wallets/withdrawals/user/history');
      return data.data;
    },
  });

  // Preview fees
  const previewFeesMutation = useMutation({
    mutationFn: async (data: {
      destination: string;
      amount: string;
      currency: string;
    }) => {
      return authClient.post('/api/v1/wallets/withdrawals/preview', data);
    },
    onSuccess: (data) => {
      setFeeEstimate(data.data);
    },
  });

  // Initiate withdrawal
  const initiateWithdrawalMutation = useMutation({
    mutationFn: async (data: {
      fromAccountId: string;
      destination: string;
      destinationAddress?: string;
      amount: string;
    }) => {
      const endpoint =
        selectedMethod?.destination === 'external_wallet'
          ? '/api/v1/wallets/withdrawals/external'
          : selectedMethod?.destination === 'micro_withdrawal'
            ? '/api/v1/wallets/withdrawals/micro'
            : '/api/v1/wallets/withdrawals/offramp';

      return authClient.post(endpoint, data);
    },
    onSuccess: () => {
      refetchHistory();
      setAmount('');
      setDestinationAddress('');
      setSelectedMethod(null);
      setFeeEstimate(null);
    },
  });

  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount);

    if (selectedMethod && newAmount && selectedAccount) {
      previewFeesMutation.mutate({
        destination: selectedMethod.destination,
        amount: newAmount,
        currency: selectedAccount.currency,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      case 'cancelled':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const canWithdraw = selectedAccount && parseFloat(selectedAccount.balance) > 0;

  return (
    <div className="space-y-6">
      {/* Source Account */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Select Source Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account)}
                disabled={parseFloat(account.balance) === 0}
                className={`p-4 border-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedAccount?.id === account.id
                    ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-white capitalize">{account.accountType}</div>
                  <div className="text-lg text-green-400 mt-1">
                    {parseFloat(account.balance).toFixed(2)} {account.currency}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Methods */}
      {selectedAccount && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Select Withdrawal Destination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {methods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    handleAmountChange(amount);
                  }}
                  className={`p-4 border-2 rounded-lg transition ${
                    selectedMethod?.id === method.id
                      ? 'border-green-500 bg-green-900 bg-opacity-20'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-semibold text-white">{method.name}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {method.provider} • Fee: {method.fee}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Min: ${method.minAmount} • Max: ${method.maxAmount}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal Details */}
      {selectedMethod && selectedAccount && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Withdrawal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Withdraw
              </label>
              <input
                type="number"
                step="0.01"
                min={selectedMethod.minAmount}
                max={Math.min(
                  parseFloat(selectedAccount.balance),
                  parseFloat(selectedMethod.maxAmount)
                )}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            {/* Destination Address (if external wallet) */}
            {selectedMethod.destination === 'external_wallet' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Destination Address
                </label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
              </div>
            )}

            {/* Fee Estimate */}
            {feeEstimate && (
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Withdrawal Amount:</span>
                  <span className="text-white">
                    ${parseFloat(feeEstimate.withdrawalAmount || '0').toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Fee ({selectedMethod.fee}):</span>
                  <span className="text-orange-400">${parseFloat(feeEstimate.fee || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
                  <span className="text-gray-300 font-semibold">You'll receive:</span>
                  <span className="text-green-400 font-semibold">
                    ${parseFloat(feeEstimate.netAmount || '0').toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() =>
                initiateWithdrawalMutation.mutate({
                  fromAccountId: selectedAccount.id,
                  destination: selectedMethod.destination,
                  destinationAddress: destinationAddress || undefined,
                  amount,
                })
              }
              disabled={
                !amount ||
                !feeEstimate ||
                initiateWithdrawalMutation.isPending ||
                (selectedMethod.destination === 'external_wallet' && !destinationAddress)
              }
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
            >
              {initiateWithdrawalMutation.isPending
                ? 'Processing...'
                : `Confirm Withdrawal`}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal History */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Recent Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalHistory && withdrawalHistory.length > 0 ? (
            <div className="space-y-2">
              {withdrawalHistory.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getStatusIcon(withdrawal.status)}
                    <div>
                      <div className="text-white font-medium">{withdrawal.destination}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      -{parseFloat(withdrawal.amount).toFixed(2)} {withdrawal.currency}
                    </div>
                    <div className={`text-xs capitalize ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No withdrawals yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
