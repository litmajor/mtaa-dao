
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Gift, Copy, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api';

export default function GiftCardVoucher() {
  const [isOpen, setIsOpen] = useState(false);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    token: 'cUSD',
    message: '',
    expiryDays: '30',
  });

  const handleCreateVoucher = async () => {
    try {
      const result = await apiPost('/api/wallet/vouchers', formData);
      toast({ title: 'Success', description: 'Gift card created!' });
      setVouchers([...vouchers, result.voucher]);
      setIsOpen(false);
      setFormData({ amount: '', token: 'cUSD', message: '', expiryDays: '30' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied!', description: 'Voucher code copied to clipboard' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gift Cards & Vouchers</CardTitle>
          <CardDescription>Create and manage redeemable vouchers</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Gift className="w-4 h-4 mr-2" /> Create Gift Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Gift Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div>
                <Label>Token</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                >
                  <option value="cUSD">cUSD</option>
                  <option value="cEUR">cEUR</option>
                  <option value="CELO">CELO</option>
                </select>
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Input
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Happy Birthday!"
                />
              </div>
              <div>
                <Label>Expiry (days)</Label>
                <Input
                  type="number"
                  value={formData.expiryDays}
                  onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
                />
              </div>
              <Button onClick={handleCreateVoucher} className="w-full">Create Gift Card</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {vouchers.map((voucher) => (
            <div key={voucher.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{voucher.amount} {voucher.token}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => copyCode(voucher.code)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <QrCode className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Code: <code className="bg-muted px-2 py-1 rounded">{voucher.code}</code>
              </div>
              {voucher.message && (
                <div className="text-sm text-muted-foreground mt-2">"{voucher.message}"</div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
