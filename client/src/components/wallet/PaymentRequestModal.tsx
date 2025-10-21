
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useToast } from '../ui/use-toast';
import { QrCode, Copy, Download, Mail, Clock, Check } from 'lucide-react';
import QRCode from 'qrcode';

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

const SUPPORTED_CURRENCIES = ['CELO', 'cUSD', 'cEUR', 'cREAL', 'USDC', 'ETH', 'BTC', 'USDT'];

export default function PaymentRequestModal({ isOpen, onClose, userAddress }: PaymentRequestModalProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('cUSD');
  const [description, setDescription] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [expiryHours, setExpiryHours] = useState('24');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [celoUri, setCeloUri] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePaymentRequest = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      // Generate Celo payment URI
      const uri = `celo://pay?address=${userAddress}&amount=${amount}&token=${currency}&memo=${encodeURIComponent(description || 'Payment Request')}`;
      setCeloUri(uri);

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(uri, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);

      // Save to backend
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiryHours));

      const response = await fetch('/api/wallet/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: userAddress,
          amount,
          currency,
          description,
          qrCode: qrDataUrl,
          celoUri: uri,
          expiresAt,
          recipientEmail
        })
      });

      if (!response.ok) throw new Error('Failed to create payment request');

      const data = await response.json();
      
      toast({
        title: 'Payment Request Created',
        description: 'QR code and payment link generated successfully'
      });

      // Send email if recipient provided
      if (recipientEmail) {
        await fetch('/api/wallet/payment-requests/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: data.id })
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate payment request',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied', description: 'Payment link copied to clipboard' });
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = `payment-request-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Create Payment Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this payment for?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Recipient Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <Label htmlFor="expiry">Expires In (Hours)</Label>
              <Input
                id="expiry"
                type="number"
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                placeholder="24"
              />
            </div>
          </div>

          {!qrCodeUrl ? (
            <Button onClick={generatePaymentRequest} disabled={isGenerating} className="w-full">
              {isGenerating ? 'Generating...' : 'Generate Payment Request'}
            </Button>
          ) : (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex justify-center">
                <img src={qrCodeUrl} alt="Payment QR Code" className="w-64 h-64" />
              </div>

              <div className="space-y-2">
                <Label>Payment Link</Label>
                <div className="flex gap-2">
                  <Input value={celoUri} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(celoUri)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadQRCode} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download QR
                </Button>
                {recipientEmail && (
                  <Button variant="outline" className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Sent
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
