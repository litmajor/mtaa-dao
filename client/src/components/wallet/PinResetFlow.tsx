/**
 * PIN Reset Flow Component
 * Handle PIN reset via email or SMS
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Loader,
  Mail,
  MessageSquare,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authClient } from '@/utils/authClient';

interface PinResetFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  walletId: string;
}

type PinResetStep = 'method-selection' | 'verification' | 'set-new-pin' | 'complete';

interface ResetState {
  method: 'email' | 'sms' | null;
  resetToken: string | null;
  verificationCode: string;
  newPin: string;
  confirmPin: string;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export const PinResetFlow: React.FC<PinResetFlowProps> = ({
  isOpen,
  onClose,
  onSuccess,
  walletId,
}) => {
  const [step, setStep] = useState<PinResetStep>('method-selection');
  const [state, setState] = useState<ResetState>({
    method: null,
    resetToken: null,
    verificationCode: '',
    newPin: '',
    confirmPin: '',
    loading: false,
    error: null,
    success: false,
  });

  const handleSelectMethod = async (method: 'email' | 'sms') => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await authClient.post('/api/sessions/pin-reset/request', {
        walletId,
        resetMethod: method,
      });

      setState((prev) => ({
        ...prev,
        method,
        resetToken: data.data.resetToken,
        loading: false,
      }));

      setStep('verification');
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to initiate reset',
        loading: false,
      }));
    }
  };

  const handleVerifyCode = async () => {
    if (state.verificationCode.length !== 6) {
      setState((prev) => ({
        ...prev,
        error: 'Verification code must be 6 digits',
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/sessions/pin-reset/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetToken: state.resetToken,
          verificationCode: state.verificationCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid or expired verification code');
      }

      setState((prev) => ({ ...prev, loading: false }));
      setStep('set-new-pin');
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Verification failed',
        loading: false,
      }));
    }
  };

  const handleSetNewPin = async () => {
    // Validation
    if (state.newPin.length !== 4) {
      setState((prev) => ({
        ...prev,
        error: 'PIN must be 4 digits',
      }));
      return;
    }

    if (!/^\d+$/.test(state.newPin)) {
      setState((prev) => ({
        ...prev,
        error: 'PIN must contain only digits',
      }));
      return;
    }

    if (state.newPin !== state.confirmPin) {
      setState((prev) => ({
        ...prev,
        error: 'PINs do not match',
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/sessions/pin-reset/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetToken: state.resetToken,
          newPin: state.newPin,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset PIN');
      }

      setState((prev) => ({
        ...prev,
        success: true,
        loading: false,
      }));

      setStep('complete');
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to reset PIN',
        loading: false,
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Your PIN</DialogTitle>
          <DialogDescription>
            {step === 'method-selection' &&
              'Choose how to verify your identity'}
            {step === 'verification' &&
              `Enter the verification code sent to your ${state.method}`}
            {step === 'set-new-pin' && 'Create a new 4-digit PIN'}
            {step === 'complete' && 'PIN reset successful'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method Selection */}
          {step === 'method-selection' && (
            <div className="space-y-3">
              <Button
                onClick={() => handleSelectMethod('email')}
                disabled={state.loading}
                className="w-full justify-start"
                variant="outline"
              >
                <Mail className="mr-2 h-5 w-5" />
                <span>Reset via Email</span>
                <ArrowRight className="ml-auto h-5 w-5" />
              </Button>

              <Button
                onClick={() => handleSelectMethod('sms')}
                disabled={state.loading}
                className="w-full justify-start"
                variant="outline"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                <span>Reset via SMS</span>
                <ArrowRight className="ml-auto h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Verification */}
          {step === 'verification' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  Verification Code
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={state.verificationCode}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      verificationCode: e.target.value.slice(0, 6),
                    }))
                  }
                  maxLength={6}
                  disabled={state.loading}
                  className="mt-1 text-center text-2xl tracking-widest"
                />
                <p className="mt-1 text-xs text-gray-600">
                  Enter the 6-digit code sent to your {state.method}
                </p>
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={state.loading || state.verificationCode.length !== 6}
                className="w-full"
              >
                {state.loading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </div>
          )}

          {/* Set New PIN */}
          {step === 'set-new-pin' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">New PIN</label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={state.newPin}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      newPin: e.target.value.slice(0, 4),
                    }))
                  }
                  maxLength={4}
                  disabled={state.loading}
                  className="mt-1 text-center text-2xl tracking-widest"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Confirm PIN</label>
                <Input
                  type="password"
                  placeholder="••••"
                  value={state.confirmPin}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      confirmPin: e.target.value.slice(0, 4),
                    }))
                  }
                  maxLength={4}
                  disabled={state.loading}
                  className="mt-1 text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                onClick={handleSetNewPin}
                disabled={
                  state.loading ||
                  state.newPin.length !== 4 ||
                  state.confirmPin.length !== 4
                }
                className="w-full"
              >
                {state.loading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Resetting PIN...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Reset PIN
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <div className="space-y-3 py-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h3 className="font-semibold text-gray-900">
                PIN Reset Successful
              </h3>
              <p className="text-sm text-gray-600">
                Your PIN has been changed. All other sessions have been logged
                out for security. Please log in with your new PIN.
              </p>
              <Button
                onClick={() => {
                  onClose();
                  onSuccess?.();
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Error Alert */}
          {state.error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {state.error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinResetFlow;
