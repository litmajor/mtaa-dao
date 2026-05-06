import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFAVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (verificationToken: string) => void;
  otpId?: string;
  method?: 'SMS' | 'EMAIL' | 'AUTHENTICATOR';
  loading?: boolean;
}

/**
 * Reusable 2FA Verification Modal
 * Handles OTP code input and verification
 * Can be used for any operation requiring 2FA
 */
export function TwoFAVerificationModal({
  open,
  onClose,
  onVerified,
  otpId,
  method = 'EMAIL',
  loading = false,
}: TwoFAVerificationModalProps) {
  const [otpCode, setOtpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  const handleVerify = async () => {
    if (!otpCode.trim()) {
      setError('Please enter a code');
      return;
    }

    if (otpCode.length < 6 && !useBackupCode) {
      setError('Code must be at least 6 digits');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/v1/wallets/security/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpId,
          code: otpCode,
          useBackupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Verification failed');
        setAttemptCount(prev => prev + 1);
        toast.error('Invalid code');
        return;
      }

      toast.success('2FA verified successfully!');
      onVerified(data.verificationToken);
      setOtpCode('');
      setAttemptCount(0);
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      toast.error('Verification error');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    setVerifying(true);
    try {
      const response = await fetch('/api/v1/wallets/security/2fa/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success) {
        // In a real app, update otpId state in parent
        toast.success('New OTP sent to your ' + method.toLowerCase());
        setOtpCode('');
        setError('');
      } else {
        setError(data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setVerifying(false);
    }
  };

  const getMethodIcon = () => {
    switch (method) {
      case 'SMS':
        return '📱';
      case 'EMAIL':
        return '📧';
      case 'AUTHENTICATOR':
        return '🔐';
      default:
        return '✉️';
    }
  };

  const getMethodText = () => {
    switch (method) {
      case 'SMS':
        return 'Check your text messages';
      case 'EMAIL':
        return 'Check your email';
      case 'AUTHENTICATOR':
        return 'Open your authenticator app';
      default:
        return 'Check your 2FA method';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify with 2FA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Message */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-xl">{getMethodIcon()}</span>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {method === 'AUTHENTICATOR' ? 'Authenticator Required' : 'Code Sent'}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {getMethodText()}
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* OTP Input */}
          {!useBackupCode ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {method === 'AUTHENTICATOR' ? 'Authenticator Code' : 'Enter Code'}
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(val);
                  }}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  disabled={verifying}
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  {method === 'AUTHENTICATOR' ? 'Enter the 6-digit code from your authenticator app' : 'Enter the code sent to your ' + method.toLowerCase()}
                </p>
              </div>

              {/* Resend Button */}
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={verifying || loading}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    "Didn't receive? Resend"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseBackupCode(true)}
                >
                  Use backup code
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Backup Code</label>
                <Input
                  type="password"
                  placeholder="ABC123DEF456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                  disabled={verifying}
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  Enter one of your backup codes saved when you set up 2FA
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUseBackupCode(false);
                  setOtpCode('');
                  setError('');
                }}
                disabled={verifying}
              >
                Back to verification code
              </Button>
            </>
          )}

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
                Too many failed attempts. Please request a new code.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={verifying || loading}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={verifying || loading || !otpCode.trim() || attemptCount >= 3}
          >
            {verifying || loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Verify
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
