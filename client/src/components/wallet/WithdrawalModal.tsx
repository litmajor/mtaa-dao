import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawalModalProps {
  amount: number;
  vaultId: string;
  currency: string;
  method: 'mpesa' | 'bank' | 'wallet' | 'crypto';
  onClose: () => void;
}

/**
 * Withdrawal Modal Component
 * Handles withdrawal request processing and confirmation
 */
export default function WithdrawalModal({
  amount,
  vaultId,
  currency,
  method,
  onClose,
}: WithdrawalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleWithdraw = async () => {
    if (!amount || amount <= 0) {
      setError('Invalid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: Integrate with actual withdrawal service
      const response = await fetch('/api/withdrawals/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultId,
          amount: amount.toString(),
          currency,
          method,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Withdrawal failed');
      }

      setSuccess(true);
      toast.success('Withdrawal initiated successfully');
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withdrawal failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Withdrawal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Withdrawal Details */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Amount</span>
              <span className="font-semibold">
                {amount} {currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Method</span>
              <span className="font-semibold capitalize">{method}</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Withdrawal initiated successfully. You'll receive the funds shortly.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={loading || success}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Withdrawal'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
