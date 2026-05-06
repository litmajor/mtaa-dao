import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api';

interface RecurringPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userAddress?: string;
}

export default function RecurringPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  userAddress
}: RecurringPaymentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipient: '',
    amount: '',
    token: 'cUSD',
    frequency: 'monthly',
    startDate: '',
    description: ''
  });

  const handleCreateRecurring = async () => {
    try {
      // Validation
      if (!formData.recipient || !formData.amount || !formData.startDate) {
        toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
        return;
      }

      if (parseFloat(formData.amount) <= 0) {
        toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
        return;
      }

      setLoading(true);

      const result = await apiPost('/api/v1/wallets/payments/recurring', {
        recipient: formData.recipient,
        amount: formData.amount,
        token: formData.token,
        frequency: formData.frequency,
        startDate: formData.startDate,
        description: formData.description,
        ...(userAddress && { userAddress })
      });

      toast({
        title: 'Success',
        description: `Recurring payment created! First payment on ${new Date(formData.startDate).toLocaleDateString()}`,
        variant: 'default'
      });

      setFormData({
        recipient: '',
        amount: '',
        token: 'cUSD',
        frequency: 'monthly',
        startDate: '',
        description: ''
      });

      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create recurring payment',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getTomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const getFrequencyDescription = (frequency: string) => {
    const descriptions: Record<string, string> = {
      daily: 'Every 24 hours',
      weekly: 'Every 7 days',
      monthly: 'Same day each month',
      yearly: 'Annual payment'
    };
    return descriptions[frequency] || 'Automatic payment';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Create Recurring Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
          {/* Recipient */}
          <div>
            <Label htmlFor="recipient" className="text-sm font-semibold">Recipient Address*</Label>
            <Input
              id="recipient"
              placeholder="0x... or username"
              value={formData.recipient}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount" className="text-sm font-semibold">Amount*</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="token" className="text-sm font-semibold">Token*</Label>
              <Select value={formData.token} onValueChange={(value) => setFormData({ ...formData, token: value })}>
                <SelectTrigger id="token" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cUSD">cUSD (Stable)</SelectItem>
                  <SelectItem value="cEUR">cEUR (Stable)</SelectItem>
                  <SelectItem value="CELO">CELO (Native)</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <Label htmlFor="frequency" className="text-sm font-semibold">Frequency*</Label>
            <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
              <SelectTrigger id="frequency" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">{getFrequencyDescription(formData.frequency)}</p>
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate" className="text-sm font-semibold">Start Date*</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={getTomorrow()}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">First payment will execute on this date</p>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-semibold">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="e.g., Monthly DAO contribution..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">About Recurring Payments:</p>
                <ul className="space-y-0.5 ml-2">
                  <li>• Automatic execution on schedule</li>
                  <li>• Pause or cancel anytime</li>
                  <li>• Notifications sent before each payment</li>
                  <li>• Failed payments retry automatically</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6 border-t pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateRecurring}
            disabled={loading || !formData.recipient || !formData.amount || !formData.startDate}
            className="flex-1"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Recurring Payment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
