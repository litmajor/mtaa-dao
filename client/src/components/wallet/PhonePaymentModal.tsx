
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useToast } from '../ui/use-toast';
import { Phone, Send } from 'lucide-react';

interface PhonePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export default function PhonePaymentModal({ isOpen, onClose, userAddress }: PhonePaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('cUSD');
  const [countryCode, setCountryCode] = useState('+254'); // Kenya default
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendToPhone = async () => {
    if (!phoneNumber || !amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'Please enter valid phone number and amount', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const response = await fetch('/api/wallet/send-to-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: userAddress,
          phoneNumber: fullPhone,
          amount,
          currency
        })
      });

      if (!response.ok) throw new Error('Payment failed');

      toast({
        title: 'Payment Sent',
        description: `Successfully sent ${amount} ${currency} to ${fullPhone}`
      });

      setPhoneNumber('');
      setAmount('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send payment',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Send to Phone Number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="countryCode">Country Code</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+254">🇰🇪 Kenya (+254)</SelectItem>
                <SelectItem value="+256">🇺🇬 Uganda (+256)</SelectItem>
                <SelectItem value="+255">🇹🇿 Tanzania (+255)</SelectItem>
                <SelectItem value="+234">🇳🇬 Nigeria (+234)</SelectItem>
                <SelectItem value="+233">🇬🇭 Ghana (+233)</SelectItem>
                <SelectItem value="+27">🇿🇦 South Africa (+27)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="712345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cUSD">cUSD</SelectItem>
                  <SelectItem value="CELO">CELO</SelectItem>
                  <SelectItem value="cEUR">cEUR</SelectItem>
                  <SelectItem value="cREAL">cREAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSendToPhone} disabled={isLoading} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            {isLoading ? 'Sending...' : 'Send Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
