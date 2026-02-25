import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PINVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (verificationToken: string) => void;
  loading?: boolean;
  title?: string;
  description?: string;
}

/**
 * Reusable PIN Verification Modal
 * Handles PIN input and verification
 * Can be used for any operation requiring PIN confirmation
 */
export function PINVerificationModal({
  open,
  onClose,
  onVerified,
  loading = false,
  title = 'PIN Verification',
  description = 'Enter your PIN to confirm this action',
}: PINVerificationModalProps) {
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  const handleVerify = async () => {
    if (!pin.trim()) {
      setError('Please enter your PIN');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only digits');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'PIN verification failed');
        setAttemptCount(prev => prev + 1);
        toast.error('Incorrect PIN');
        return;
      }

      toast.success('PIN verified successfully!');
      onVerified(data.verificationToken);
      setPin('');
      setAttemptCount(0);
    } catch (err) {
      setError('Failed to verify PIN. Please try again.');
      toast.error('Verification error');
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length >= 4 && !verifying && !loading) {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>

          {/* PIN Dots Display */}
          <div className="flex justify-center gap-2 py-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <div
                key={index}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                  index < pin.length
                    ? 'bg-blue-500 border-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                }`}
              >
                {index < pin.length ? '●' : '○'}
              </div>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* PIN Input (Hidden) */}
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter 4-8 digit PIN"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setPin(val);
              }}
              maxLength={8}
              disabled={verifying || loading}
              onKeyPress={handleKeyPress}
              className="text-center text-xl"
              inputMode="numeric"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              4-8 digits only. Your PIN is never stored or shared.
            </p>
          </div>

          {/* Attempt Counter */}
          {attemptCount > 0 && attemptCount < 3 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {3 - attemptCount} attempts remaining
            </p>
          )}

          {attemptCount >= 3 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Too many failed attempts. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          {/* PIN Strength Indicator */}
          {pin.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                PIN Strength
              </p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    pin.length >= 8
                      ? 'bg-green-500 w-full'
                      : pin.length >= 6
                      ? 'bg-yellow-500 w-3/4'
                      : 'bg-amber-500 w-1/2'
                  }`}
                />
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {pin.length < 4
                  ? `${4 - pin.length} more digits`
                  : pin.length < 6
                  ? 'Good'
                  : pin.length < 8
                  ? 'Very Good'
                  : 'Excellent'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={verifying || loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={
              verifying ||
              loading ||
              pin.length < 4 ||
              attemptCount >= 3
            }
          >
            {verifying || loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Verify PIN
              </>
            )}
          </Button>
        </div>

        {/* Help Text */}
        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 Forgot your PIN?{' '}
            <button
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                // In a real app, navigate to PIN reset
                toast.info('PIN reset functionality coming soon');
              }}
            >
              Reset it here
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
