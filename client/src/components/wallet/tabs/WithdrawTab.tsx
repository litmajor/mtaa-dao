/**
 * WithdrawTab Component
 * Handle withdrawals to various destinations
 */

import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface WithdrawalMethod {
  id: string;
  name: string;
  provider: string; // e.g. 'stripe', 'mpesa', 'paystack', 'flutterwave'
  // lanes: 'bank' | 'external_wallet' | 'micro' | 'offramp'
  type: 'bank' | 'external_wallet' | 'micro' | 'offramp' | string;
  destination: string;
  minAmount: string;
  maxAmount: string;
  fee: string; // percent as string
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
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(accounts.length > 0 ? accounts[0] : null);
  // Step router
  const [step, setStep] = useState<number>(0);
  const [selectedLane, setSelectedLane] = useState<'bank' | 'crypto' | 'micro' | 'offramp' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<any>(null);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);

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

  // Initiate withdrawal -> wire to payment gateway withdraw endpoint which handles providers & redirects
  const initiateWithdrawalMutation = useMutation({
    mutationFn: async (data: { provider: string; amount: string; currency: string; method?: string; metadata?: any }) => {
      // Use rails gateway withdraw endpoint
      return authClient.post('/api/v1/wallets/rails/gateway/withdraw', data);
    },
    onSuccess: (res) => {
      // If provider returned a paymentUrl (redirect/checkout), open it
      const data = res?.data || res;
      if (data?.data?.paymentUrl || data?.paymentUrl) {
        const url = data.data?.paymentUrl || data.paymentUrl;
        try {
          window.open(url, '_blank');
        } catch (e) {
          // fallback: navigate
          window.location.href = url;
        }
      }

      // Reset form & refresh history
      refetchHistory();
      setAmount('');
      setDestinationAddress('');
      setSelectedMethod(null);
      setFeeEstimate(null);
      setStep(0);
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

  // Simple address intelligence
  const detectAddressType = (addr: string) => {
    if (!addr) return 'unknown';
    const eth = /^0x[a-fA-F0-9]{40}$/;
    const btc = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    if (eth.test(addr)) return 'eth';
    if (btc.test(addr)) return 'btc';
    return 'unknown';
  };

  const checkRisk = (addr: string, amt: number) => {
    if (!addr) return null;
    // Very naive heuristics: new address + large amount -> warn
    if (amt > 1000) return 'Large withdrawal to a new address — consider a small test transfer first.';
    return null;
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

  // Recommendation engine: pick lowest fee + speed heuristics
  const recommendation = useMemo(() => {
    if (!methods || methods.length === 0) return null;
    // Map speed score (higher is better)
    const speedMap: Record<string, number> = { mpesa: 9, stripe: 7, paystack: 8, flutterwave: 8, bank_transfer: 4 };
    const scored = methods.map((m) => {
      const fee = parseFloat(m.fee || '0') || 0;
      const speed = speedMap[m.provider] || 5;
      const score = (100 - fee) * 0.6 + speed * 4; // composite
      return { m, fee, speed, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }, [methods]);

  return (
    <div className="space-y-6">
      {/* Step 0: Choose lane (destination type) */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Withdraw — Choose Destination Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div onClick={() => { setSelectedLane('bank'); setStep(1); }} role="button" className="p-4 border rounded cursor-pointer">
                <div className="font-semibold">🏦 Bank / Fiat</div>
                <div className="text-sm text-muted-foreground mt-1">Bank transfer, ACH</div>
                <div className="text-xs mt-2 text-muted-foreground">Best for large withdrawals</div>
              </div>

              <div onClick={() => { setSelectedLane('crypto'); setStep(1); }} role="button" className="p-4 border rounded cursor-pointer">
                <div className="font-semibold">🪙 Crypto Wallet</div>
                <div className="text-sm text-muted-foreground mt-1">External wallet transfers</div>
                <div className="text-xs mt-2 text-muted-foreground">Fastest and cheapest</div>
              </div>

              <div onClick={() => { setSelectedLane('micro'); setStep(1); }} role="button" className="p-4 border rounded cursor-pointer">
                <div className="font-semibold">⚡ Micro Withdrawals</div>
                <div className="text-sm text-muted-foreground mt-1">Instant small payouts</div>
                <div className="text-xs mt-2 text-muted-foreground">Low minimums</div>
              </div>

              <div onClick={() => { setSelectedLane('offramp'); setStep(1); }} role="button" className="p-4 border rounded cursor-pointer">
                <div className="font-semibold">🌍 Off-ramp Provider</div>
                <div className="text-sm text-muted-foreground mt-1">Ramp, MoonPay integrations</div>
                <div className="text-xs mt-2 text-muted-foreground">Regulated partners</div>
              </div>
            </div>

            {recommendation && (
              <div className="mt-4 p-3 border rounded">
                <div className="text-sm">Recommended: <strong>{recommendation.m.name}</strong> • Fee: {recommendation.fee}%</div>
                <div className="text-xs text-muted-foreground">Reason: composite cost & speed</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Provider selection */}
      {step === 1 && selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {methods
                .filter((m) => (
                  selectedLane === 'bank' ? m.type === 'bank' :
                  selectedLane === 'crypto' ? m.type === 'external_wallet' :
                  selectedLane === 'micro' ? m.type === 'micro' :
                  selectedLane === 'offramp' ? m.type === 'offramp' : false
                ))
                .map((m) => (
                  <button key={m.id} onClick={() => { setSelectedMethod(m); setStep(2); }} className="p-4 border rounded text-left">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-sm text-muted-foreground">{m.provider} • Fee: {m.fee}%</div>
                    <div className="text-xs mt-1 text-muted-foreground">Min ${m.minAmount} • Max ${m.maxAmount}</div>
                  </button>
                ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(0)} className="px-3 py-2 border rounded">Back</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Amount & Destination */}
      {step === 2 && selectedMethod && selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Amount & Destination</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Amount ({selectedAccount.currency})</label>
              <input type="number" step="0.01" min={selectedMethod.minAmount} max={Math.min(parseFloat(selectedAccount.balance), parseFloat(selectedMethod.maxAmount))} value={amount} onChange={(e) => { handleAmountChange(e.target.value); if (destinationAddress) setRiskWarning(checkRisk(destinationAddress, parseFloat(e.target.value || '0'))); }} placeholder="0.00" className="w-full px-3 py-2 border rounded" />
            </div>

            {(selectedMethod.type === 'external_wallet' || selectedMethod.type === 'bank') && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Destination</label>
                <input type="text" value={destinationAddress} onChange={(e) => { setDestinationAddress(e.target.value); setRiskWarning(checkRisk(e.target.value, parseFloat(amount || '0'))); }} placeholder={selectedMethod.type === 'external_wallet' ? 'Wallet address' : 'Bank account / IBAN'} className="w-full px-3 py-2 border rounded" />
                <div className="text-xs mt-2 text-muted-foreground">Detected: {detectAddressType(destinationAddress)}</div>
                {riskWarning && <div className="mt-2 text-sm text-yellow-600">⚠️ {riskWarning}</div>}
              </div>
            )}

            {feeEstimate && (
              <div className="p-3 mt-4 border rounded">
                <div className="flex justify-between"><div className="text-sm text-muted-foreground">Amount</div><div className="font-semibold">${parseFloat(feeEstimate.withdrawalAmount || '0').toFixed(2)}</div></div>
                <div className="flex justify-between mt-1"><div className="text-sm text-muted-foreground">Fee ({selectedMethod.fee}%)</div><div className="font-semibold text-orange-500">${parseFloat(feeEstimate.fee || '0').toFixed(2)}</div></div>
                <div className="flex justify-between mt-1 border-t pt-2"><div className="text-sm">You'll receive</div><div className="font-semibold text-green-600">${parseFloat(feeEstimate.netAmount || '0').toFixed(2)}</div></div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(1)} className="px-3 py-2 border rounded">Back</button>
              <button onClick={() => setStep(3)} disabled={!amount || (selectedMethod.type === 'external_wallet' && !destinationAddress)} className="px-3 py-2 bg-blue-600 text-white rounded">Review</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 3 && selectedMethod && selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Confirm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between"><div>Provider</div><div className="font-semibold">{selectedMethod.name}</div></div>
              <div className="flex justify-between"><div>Amount</div><div className="font-semibold">${parseFloat(amount || '0').toFixed(2)}</div></div>
              <div className="flex justify-between"><div>Fee</div><div className="font-semibold">{selectedMethod.fee}%</div></div>
              <div className="flex justify-between"><div>Destination</div><div className="font-semibold">{destinationAddress || selectedMethod.name}</div></div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(2)} className="px-3 py-2 border rounded">Back</button>
              <button onClick={() => initiateWithdrawalMutation.mutate({ provider: selectedMethod.provider, amount, currency: selectedAccount.currency, method: selectedMethod.type, metadata: { destinationAddress } })} disabled={initiateWithdrawalMutation.isPending} className="px-3 py-2 bg-blue-600 text-white rounded">{initiateWithdrawalMutation.isPending ? 'Processing...' : 'Confirm Withdrawal'}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Withdrawals (always visible) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalHistory && withdrawalHistory.length > 0 ? (
            <div className="space-y-2">
              {withdrawalHistory.map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3 flex-1">
                    {getStatusIcon(withdrawal.status)}
                    <div>
                      <div className="font-medium">{withdrawal.destination}</div>
                      <div className="text-xs text-muted-foreground">{new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">-{parseFloat(withdrawal.amount).toFixed(2)} {withdrawal.currency}</div>
                    <div className={`text-xs capitalize ${getStatusColor(withdrawal.status)}`}>{withdrawal.status}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No withdrawals yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
