/**
 * DepositTab Component
 * Handle deposits from various sources
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { authClient } from '@/utils/authClient';

interface DepositMethod {
  id: string;
  name: string;
  provider: string;
  // allow more explicit lanes
  type: 'offramp' | 'external_wallet' | 'fiat_onramp' | 'crypto_deposit';
  supportedCurrencies: string[];
  minAmount: string;
  maxAmount: string;
  // fee as percent e.g. "2.5"
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
  // Step flow: 0=choose lane,1=choose provider,2=amount,3=review,4=execute
  const [step, setStep] = useState<number>(0);
  const [selectedLane, setSelectedLane] = useState<'fiat' | 'crypto' | 'offramp' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [depositingMethod, setDepositingMethod] = useState<string | null>(null);

  // Recommendation computed from available methods
  const recommendation = useMemo(() => {
    if (!methods || methods.length === 0) return null;
    // prefer lowest fee
    const parsed = methods.map((m) => ({ m, fee: parseFloat(m.fee || '0') || 0 }));
    const lowest = parsed.sort((a, b) => a.fee - b.fee)[0];
    // prefer crypto if present
    const crypto = methods.find((m) => m.type === 'external_wallet' || m.type === 'crypto_deposit');
    if (crypto) return { reason: 'Lowest cost, instant', method: crypto };
    return { reason: 'Lowest fee today', method: lowest?.m };
  }, [methods]);

  // Fetch deposit history
  const { data: depositHistory, refetch: refetchHistory } = useQuery<DepositHistory[]>({
    queryKey: ['depositHistory'],
    queryFn: async () => {
      return authClient.get<DepositHistory[]>('/api/v1/wallets/deposits/user/history');
    },
  });

  // Initiate deposit (fiat/onramp/offramp)
  const initiateOffRampMutation = useMutation({
    mutationFn: async (data: { provider: string; amount: string; currency?: string; metadata?: any }) => {
      return authClient.post<{ data?: { paymentUrl?: string; id?: string } }>(
        '/api/v1/wallets/deposits/initiate',
        data
      );
    },
    onSuccess: (res: any) => {
      const data = res?.data || {};
      // Redirect to provider URL if backend returned one
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      // Otherwise refresh history and reset state
      refetchHistory();
      setAmount('');
      setSelectedMethod(null);
    },
  });

  // Helper: compute fee dollars and net receive
  const computeFeeAndNet = (amt: number, feePercent: number) => {
    const fee = +(amt * (feePercent / 100));
    const net = +(amt - fee);
    return { fee, net };
  };

  const isFiatProvider = (m: DepositMethod) => {
    const p = m.provider.toLowerCase();
    if (/m-?pesa|mpesa|visa|mastercard|card|bank/.test(p)) return true;
    return m.type === 'fiat_onramp';
  };

  const fiatProviders = methods.filter((m) => isFiatProvider(m));
  const cryptoProviders = methods.filter((m) => m.type === 'external_wallet' || m.type === 'crypto_deposit');
  const offRampProviders = methods.filter((m) => !isFiatProvider(m) && m.type === 'offramp');

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
      {/* Deposit Router - Step 1: Choose lane */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit Router</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                role="button"
                onClick={() => { setSelectedLane('fiat'); setStep(1); }}
                className={`p-4 border rounded-lg cursor-pointer ${selectedLane === 'fiat' ? 'border-blue-500' : 'border-gray-200'}`}>
                <div className="font-semibold">💳 Fiat On-Ramp</div>
                <div className="text-sm text-muted-foreground mt-1">Visa, Mastercard, M-Pesa, Bank</div>
                <div className="text-xs mt-2">Fee: medium · Speed: instant–10 min · Best for: beginners</div>
                <div className="mt-3 text-sm text-muted-foreground">Recommended when you need to buy crypto with card or local mobile money.</div>
              </div>

              <div
                role="button"
                onClick={() => { setSelectedLane('crypto'); setStep(1); }}
                className={`p-4 border rounded-lg cursor-pointer ${selectedLane === 'crypto' ? 'border-blue-500' : 'border-gray-200'}`}>
                <div className="font-semibold">🪙 Crypto Deposit</div>
                <div className="text-sm text-muted-foreground mt-1">Wallet-to-wallet — BTC, ETH, USDT</div>
                <div className="text-xs mt-2">Fee: near zero · Speed: instant · Best for: existing users</div>
                <div className="mt-3 text-sm text-muted-foreground">Use when you already control an external wallet.</div>
              </div>

              <div
                role="button"
                onClick={() => { setSelectedLane('offramp'); setStep(1); }}
                className={`p-4 border rounded-lg cursor-pointer ${selectedLane === 'offramp' ? 'border-blue-500' : 'border-gray-200'}`}>
                <div className="font-semibold">🌍 Off-ramp Providers</div>
                <div className="text-sm text-muted-foreground mt-1">MoonPay, Ramp, Wyre</div>
                <div className="text-xs mt-2">Fee: higher · Speed: instant–minutes · Best for: regulated purchases</div>
                <div className="mt-3 text-sm text-muted-foreground">For fiat onramps handled by regulated third-parties.</div>
              </div>
            </div>

            {recommendation && (
              <div className="p-3 border rounded mt-4">
                <div className="text-sm">Recommended: <strong>{recommendation.method?.name || recommendation.method?.provider}</strong></div>
                <div className="text-xs text-muted-foreground">{recommendation.reason}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose provider */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedLane === 'fiat' ? fiatProviders : selectedLane === 'crypto' ? cryptoProviders : offRampProviders).map((m) => (
                <button key={m.id} onClick={() => { setSelectedMethod(m); setStep(2); }} className={`p-4 border rounded ${selectedMethod?.id === m.id ? 'border-blue-500' : 'border-gray-200'}`}>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.provider} · Fee: {m.fee}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Min ${m.minAmount} • Max ${m.maxAmount}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(0)} className="px-4 py-2 border rounded">Back</button>
              <button onClick={() => setStep(2)} className="px-4 py-2 bg-blue-600 text-white rounded">Continue</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Enter amount */}
      {step === 2 && selectedMethod && (
        <Card>
          <CardHeader>
            <CardTitle>Enter Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Amount ({selectedMethod.supportedCurrencies[0]})</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border rounded" />
              <div className="text-xs mt-2 text-muted-foreground">Min ${selectedMethod.minAmount} • Max ${selectedMethod.maxAmount}</div>
            </div>

            {/* Validation + fee preview */}
            {amount && (
              (() => {
                const a = parseFloat(amount || '0');
                const min = parseFloat(selectedMethod.minAmount || '0');
                const max = parseFloat(selectedMethod.maxAmount || '0');
                const feePercent = parseFloat(selectedMethod.fee || '0') || 0;
                const { fee: feeDollar, net } = computeFeeAndNet(a, feePercent);
                return (
                  <div className="p-3 border rounded mt-4">
                    {a < min && <div className="text-xs text-red-500">Amount below provider minimum</div>}
                    {max > 0 && a > max && <div className="text-xs text-red-500">Amount exceeds provider maximum</div>}
                    <div className="flex justify-between mt-2"><div className="text-sm text-muted-foreground">Amount</div><div className="font-semibold">${a.toFixed(2)}</div></div>
                    <div className="flex justify-between mt-1"><div className="text-sm text-muted-foreground">Fee ({feePercent}%)</div><div className="font-semibold">${feeDollar.toFixed(2)}</div></div>
                    <div className="flex justify-between mt-1 border-t pt-2"><div className="text-sm">Net receive</div><div className="font-semibold text-green-600">${net.toFixed(2)}</div></div>
                    <div className="text-xs mt-2 text-muted-foreground">Comparison: {feePercent > 1 ? `~${feePercent}% higher than lowest option` : 'Competitive'}</div>
                  </div>
                );
              })()
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(1)} className="px-4 py-2 border rounded">Back</button>
              <button onClick={() => setStep(3)} disabled={!amount} className="px-4 py-2 bg-blue-600 text-white rounded">Review</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 3 && selectedMethod && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Confirm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between"><div>Provider</div><div className="font-semibold">{selectedMethod.name}</div></div>
              <div className="flex justify-between"><div>Amount</div><div className="font-semibold">${parseFloat(amount || '0').toFixed(2)}</div></div>
              <div className="flex justify-between"><div>Estimated Fee</div><div className="font-semibold">${computeFeeAndNet(parseFloat(amount || '0'), parseFloat(selectedMethod.fee || '0')).fee.toFixed(2)}</div></div>
              <div className="flex justify-between"><div>You'll receive</div><div className="font-semibold text-green-600">${computeFeeAndNet(parseFloat(amount || '0'), parseFloat(selectedMethod.fee || '0')).net.toFixed(2)}</div></div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(2)} className="px-4 py-2 border rounded">Back</button>
              {selectedMethod.type === 'offramp' || selectedMethod.type === 'fiat_onramp' ? (
                <button onClick={() => initiateOffRampMutation.mutate({ methodId: selectedMethod.id, amount })} disabled={initiateOffRampMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded">{initiateOffRampMutation.isPending ? 'Processing...' : 'Proceed to Payment'}</button>
              ) : (
                // crypto deposit: show deposit instructions (simulate)
                <button onClick={() => { setDepositingMethod(selectedMethod.id); setStep(4); }} className="px-4 py-2 bg-blue-600 text-white rounded">Show Deposit Address</button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Execute / Deposit instructions */}
      {step === 4 && selectedMethod && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMethod.type === 'external_wallet' || selectedMethod.type === 'crypto_deposit' ? (
              <div>
                <div className="text-sm">Send {selectedMethod.supportedCurrencies[0]} to this address:</div>
                <div className="mt-3 p-4 bg-gray-100 rounded font-mono">0xDEADBEEF...FAKEADDRESS</div>
                <div className="text-xs text-muted-foreground mt-2">Transaction will be credited after required confirmations.</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setStep(0); setSelectedMethod(null); setAmount(''); }} className="px-4 py-2 border rounded">Done</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm">You'll be redirected to the payment provider to complete the purchase.</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setStep(0); setSelectedMethod(null); setAmount(''); }} className="px-4 py-2 border rounded">Cancel</button>
                </div>
              </div>
            )}
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
