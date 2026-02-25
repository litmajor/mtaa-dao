/**
 * DepositTab Component
 * Handle deposits from various sources
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface DepositMethod {
  id: string;
  name: string;
  provider: string;
  type: 'offramp' | 'external_wallet';
  supportedCurrencies: string[];
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

interface DepositTabProps {
  methods: DepositMethod[];
  accounts: WalletAccount[];
}

interface DepositHistory {
  id: string;
  source: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionHash?: string;
  createdAt: string;
}

export default function DepositTab({ methods, accounts }: DepositTabProps) {
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [depositingMethod, setDepositingMethod] = useState<string | null>(null);

  // Fetch deposit history
  const { data: depositHistory, refetch: refetchHistory } = useQuery<DepositHistory[]>({
    queryKey: ['depositHistory'],
    queryFn: async () => {
      const response = await fetch('/api/deposits/user/history', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch deposit history');
      const result = await response.json();
      return result.data;
    },
  });

  // Initiate off-ramp deposit
  const initiateOffRampMutation = useMutation({
    mutationFn: async (data: { methodId: string; amount: string }) => {
      const response = await fetch('/api/deposits/offramp/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate deposit');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to payment provider or show confirmation
      if (data.data?.paymentUrl) {
        window.location.href = data.data.paymentUrl;
      }
      refetchHistory();
      setAmount('');
      setSelectedMethod(null);
    },
  });

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

  return (
    <div className="space-y-6">
      {/* Deposit Methods */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Select Deposit Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method)}
                className={`p-4 border-2 rounded-lg transition ${
                  selectedMethod?.id === method.id
                    ? 'border-blue-500 bg-blue-900 bg-opacity-20'
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
                  <div className="text-xs text-gray-500 mt-1">
                    {method.supportedCurrencies.join(', ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Amount Input */}
      {selectedMethod && (
        <Card className="bg-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Deposit Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount ({selectedMethod.supportedCurrencies[0]})
              </label>
              <input
                type="number"
                step="0.01"
                min={selectedMethod.minAmount}
                max={selectedMethod.maxAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-2 text-xs text-gray-400">
                Min: ${selectedMethod.minAmount} • Max: ${selectedMethod.maxAmount}
              </div>
            </div>

            {/* Fee Estimate */}
            {amount && (
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white">${parseFloat(amount || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Fee ({selectedMethod.fee}):</span>
                  <span className="text-white">
                    ${(parseFloat(amount || '0') * (parseFloat(selectedMethod.fee) / 100)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
                  <span className="text-gray-300 font-semibold">You'll receive:</span>
                  <span className="text-green-400 font-semibold">
                    ${(parseFloat(amount || '0') * (1 - parseFloat(selectedMethod.fee) / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() =>
                initiateOffRampMutation.mutate({
                  methodId: selectedMethod.id,
                  amount,
                })
              }
              disabled={!amount || initiateOffRampMutation.isPending}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition"
            >
              {initiateOffRampMutation.isPending ? 'Processing...' : 'Continue to Payment'}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Deposit History */}
      <Card className="bg-gray-700 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white">Recent Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {depositHistory && depositHistory.length > 0 ? (
            <div className="space-y-2">
              {depositHistory.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getStatusIcon(deposit.status)}
                    <div>
                      <div className="text-white font-medium">{deposit.source}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(deposit.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      +{parseFloat(deposit.amount).toFixed(2)} {deposit.currency}
                    </div>
                    <div className={`text-xs capitalize ${getStatusColor(deposit.status)}`}>
                      {deposit.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No deposits yet. Start by selecting a deposit method above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
