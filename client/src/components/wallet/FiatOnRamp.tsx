
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { CreditCard, Smartphone, Building, DollarSign, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface FiatOnRampProps {
  userId: string;
  onSuccess?: (txId: string) => void;
}

export default function FiatOnRamp({ userId, onSuccess }: FiatOnRampProps) {
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [method, setMethod] = useState<'card' | 'mobile_money' | 'bank_transfer'>('mobile_money');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const { toast } = useToast();

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

  const handleDeposit = async () => {
    if (!provider || !amount || !currency) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/payment-gateway/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          amount,
          currency,
          method,
          metadata: {
            phone,
            email,
            name: 'User Name'
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.paymentUrl) {
          setPaymentUrl(data.paymentUrl);
          toast({
            title: 'Payment Initialized',
            description: 'Redirecting to payment page...'
          });
          
          setTimeout(() => {
            window.open(data.paymentUrl, '_blank');
          }, 1000);
        } else {
          toast({
            title: 'Payment Initiated',
            description: data.message || 'Check your phone for payment prompt'
          });
        }

        if (onSuccess) {
          onSuccess(data.transactionId);
        }
      } else {
        throw new Error(data.message || 'Payment failed');
      }
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProvider = providers.find(p => p.id === provider);

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
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Funds will be converted to crypto (cUSD) and added to your wallet
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="provider">Payment Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
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
            <Select value={method} onValueChange={(v: any) => setMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider.methods.includes('card') && (
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Credit/Debit Card
                    </div>
                  </SelectItem>
                )}
                {selectedProvider.methods.includes('mobile_money') && (
                  <SelectItem value="mobile_money">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Mobile Money
                    </div>
                  </SelectItem>
                )}
                {selectedProvider.methods.includes('bank_transfer') && (
                  <SelectItem value="bank_transfer">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Bank Transfer
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {method === 'mobile_money' && (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        )}

        {(method === 'card' || method === 'bank_transfer') && (
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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

        <Button
          onClick={handleDeposit}
          disabled={isLoading || !provider || !amount}
          className="w-full"
        >
          {isLoading ? 'Processing...' : (
            <>
              Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {paymentUrl && (
          <Alert>
            <AlertDescription>
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                Click here if you weren't redirected
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
