import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { authClient } from '@/utils/authClient';
import {
  CreditCard,
  Smartphone,
  Building2,
  DollarSign,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Shield,
  Clock
} from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface FiatOnRampProps {
  userId: string;
  onSuccess?: (txId: string) => void;
}

type PaymentStatus = 'idle' | 'initiating' | 'pending' | 'processing' | 'completed' | 'failed' | 'recovering';

interface PaymentState {
  traceId: string | null;
  reference: string | null;
  transactionId: string | null;
  status: PaymentStatus;
  recoveryStrategy?: string;
  paymentUrl?: string;
  error?: string;
}

export default function FiatOnRamp({ userId, onSuccess }: FiatOnRampProps) {
  // Form state
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [method, setMethod] = useState<'card' | 'mobile_money' | 'bank_transfer'>('mobile_money');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Payment lifecycle state
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: 'idle',
    traceId: null,
    reference: null,
    transactionId: null
  });

  // Polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentTransactionIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Generate client-side idempotency key (persists across retries)
  const [idempotencyKey] = useState(() => 
    `fiat-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const providers = [
    { id: 'flutterwave', name: 'Flutterwave', countries: ['Nigeria', 'Kenya', 'Ghana'], methods: ['card', 'mobile_money', 'bank_transfer'] },
    { id: 'paystack', name: 'Paystack', countries: ['Nigeria', 'Ghana', 'South Africa'], methods: ['card', 'bank_transfer'] },
    { id: 'mpesa', name: 'M-Pesa', countries: ['Kenya', 'Tanzania', 'Uganda'], methods: ['mobile_money'] },
    { id: 'mtn', name: 'MTN Mobile Money', countries: ['Uganda', 'Ghana', 'Nigeria'], methods: ['mobile_money'] },
    { id: 'airtel', name: 'Airtel Money', countries: ['Kenya', 'Tanzania', 'Uganda'], methods: ['mobile_money'] },
    { id: 'stripe', name: 'Stripe', countries: ['Global'], methods: ['card'] }
  ];

  const currencies = [
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
    { code: 'USD', name: 'US Dollar', symbol: '$' }
  ];

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((reference: string, traceId: string) => {
    stopPolling();
    currentTransactionIdRef.current = traceId;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await authClient.get<{ status: string }>(`/api/payments/verify/${provider}/${reference}`);
        const status = data.status;

        if (status === 'completed') {
          stopPolling();
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setPaymentState(prev => ({ ...prev, status: 'completed' }));
          toast({ title: 'Payment Complete', description: 'Funds have been added to your wallet' });
          if (onSuccess && currentTransactionIdRef.current) {
            onSuccess(currentTransactionIdRef.current);
          }
        } else if (status === 'failed') {
          stopPolling();
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setPaymentState(prev => ({
            ...prev,
            status: 'failed',
            error: 'Payment failed. Check recovery options below.'
          }));
        }
        // pending/processing: keep polling
      } catch (err) {
        // Polling errors are non-fatal, keep trying
        console.error('Poll error:', err);
      }
    }, 5000); // Poll every 5 seconds

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setPaymentState(prev => {
        if (prev.status === 'pending' || prev.status === 'processing') {
          return { ...prev, status: 'failed', error: 'Payment timed out. Please check your transaction history.' };
        }
        return prev;
      });
    }, 300000);
  }, [provider, stopPolling, toast, onSuccess]);

  const handleDeposit = async () => {
    if (!provider || !amount || !currency) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Prevent duplicate submission
    if (paymentState.status === 'initiating' || paymentState.status === 'pending') {
      toast({ title: 'Payment in Progress', description: 'Please wait for the current payment to complete.' });
      return;
    }

    setPaymentState({
      status: 'initiating',
      traceId: null,
      reference: null,
      transactionId: null
    });

    try {
      const data = await authClient.post<{
        status?: string;
        traceId?: string;
        reference?: string;
        transactionId?: string;
        paymentUrl?: string;
        message?: string;
      }>('/api/payments/deposit', {
        provider,
        amount,
        currency,
        method,
        metadata: {
          phone: phone || undefined,
          email: email || undefined,
          name: 'User Name' // TODO: Get from auth context
        },
        idempotencyKey // Critical: prevents duplicate charges
      });

      setPaymentState({
        status: data.status === 'pending' ? 'pending' : 'processing',
        traceId: data.traceId || null,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        paymentUrl: data.paymentUrl
      });

      if (data.paymentUrl) {
        toast({
          title: 'Payment Initialized',
          description: 'Complete payment in the new window'
        });
        setTimeout(() => window.open(data.paymentUrl, '_blank'), 500);
      } else {
        toast({
          title: 'Payment Initiated',
          description: data.message || 'Check your phone for the payment prompt'
        });
      }

      if (data.reference) {
        startPolling(data.reference, data.traceId || '');
      }

      if (onSuccess && data.transactionId) {
        currentTransactionIdRef.current = data.transactionId;
      }
    } catch (error: any) {
      setPaymentState({
        status: 'failed',
        traceId: null,
        reference: null,
        transactionId: null,
        error: error.message
      });
      
      toast({
        title: 'Payment Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRetry = async () => {
    // Reset state and retry with same idempotency key
    // Backend will return cached result if already processed
    setPaymentState({ status: 'idle', traceId: null, reference: null, transactionId: null });
    await handleDeposit();
  };

  const selectedProvider = providers.find(p => p.id === provider);

  // Status indicator component
  const StatusIndicator = () => {
    switch (paymentState.status) {
      case 'initiating':
        return <Alert><Loader2 className="h-4 w-4 animate-spin" /><AlertDescription>Initializing payment...</AlertDescription></Alert>;
      case 'pending':
        return <Alert><Clock className="h-4 w-4" /><AlertDescription>Payment pending. Check your phone or email.</AlertDescription></Alert>;
      case 'processing':
        return <Alert><Loader2 className="h-4 w-4 animate-spin" /><AlertDescription>Processing payment...</AlertDescription></Alert>;
      case 'completed':
        return <Alert className="bg-green-50"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-700">Payment completed successfully!</AlertDescription></Alert>;
      case 'failed':
        return (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {paymentState.error}
              {paymentState.traceId && (
                <span className="block text-xs mt-1 opacity-75">Trace ID: {paymentState.traceId}</span>
              )}
            </AlertDescription>
          </Alert>
        );
      case 'recovering':
        return <Alert><Shield className="h-4 w-4" /><AlertDescription>Attempting recovery...</AlertDescription></Alert>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Buy Crypto with Fiat
        </CardTitle>
        <CardDescription>
          Add funds to your wallet using local payment methods
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <StatusIndicator />

        {/* Trace ID for support */}
        {paymentState.traceId && paymentState.status !== 'failed' && (
          <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
            Trace ID: <code className="font-mono">{paymentState.traceId}</code>
            {paymentState.reference && (
              <span className="block mt-1">Ref: <code className="font-mono">{paymentState.reference}</code></span>
            )}
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Funds will be converted to crypto (cUSD) and added to your wallet
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="provider">Payment Provider</Label>
          <Select value={provider} onValueChange={setProvider} disabled={paymentState.status === 'initiating' || paymentState.status === 'pending'}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} - {p.countries.join(', ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="method">Payment Method</Label>
            <Select value={method} onValueChange={(v: any) => setMethod(v)} disabled={paymentState.status === 'initiating'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectedProvider.methods.includes('card') && (
                  <SelectItem value="card"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Credit/Debit Card</div></SelectItem>
                )}
                {selectedProvider.methods.includes('mobile_money') && (
                  <SelectItem value="mobile_money"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Mobile Money</div></SelectItem>
                )}
                {selectedProvider.methods.includes('bank_transfer') && (
                  <SelectItem value="bank_transfer"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" />Bank Transfer</div></SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={paymentState.status === 'initiating'} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={paymentState.status === 'initiating'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {method === 'mobile_money' && (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" placeholder="+254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={paymentState.status === 'initiating'} />
          </div>
        )}

        {(method === 'card' || method === 'bank_transfer') && (
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={paymentState.status === 'initiating'} />
          </div>
        )}

        {amount && currency && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              You will receive approximately <strong>{(parseFloat(amount) * 0.98).toFixed(2)} cUSD</strong> (2% fee)
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        {paymentState.status === 'failed' ? (
          <div className="flex gap-2">
            <Button onClick={handleRetry} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry Payment
            </Button>
            <Button onClick={() => window.open(`/payments/${paymentState.reference}/manual-recovery`, '_blank')} variant="secondary" className="flex-1">
              <Shield className="mr-2 h-4 w-4" /> Manual Recovery
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleDeposit}
            disabled={paymentState.status === 'initiating' || paymentState.status === 'pending' || paymentState.status === 'processing' || !provider || !amount}
            className="w-full"
          >
            {paymentState.status === 'initiating' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              <><ArrowRight className="mr-2 h-4 w-4" /> Continue to Payment</>
            )}
          </Button>
        )}

        {paymentState.paymentUrl && paymentState.status === 'pending' && (
          <Alert>
            <AlertDescription>
              <a href={paymentState.paymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                Click here if you weren't redirected
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}