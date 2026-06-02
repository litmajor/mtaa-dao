import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemState } from '@/context/systemState';
import PinResetFlow from './PinResetFlow';

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
  type VerificationPhase =
    | 'idle'
    | 'typing'
    | 'validating'
    | 'verifying'
    | 'success'
    | 'failed'
    | 'locked'
    | 'cooldown';

  const [phase, setPhase] = useState<VerificationPhase>('idle');
  const [error, setError] = useState('');

  const [securityState, setSecurityState] = useState(() => ({
    threatLevel: 'normal' as 'normal' | 'elevated' | 'critical',
    anomalyScore: 0,
    attemptsRemaining: 3,
    cooldownRemaining: 0, // seconds
    trustScore: 1.0,
  }));

  const verificationStartedAt = useRef<number | null>(null);
  const [showResetFlow, setShowResetFlow] = useState(false);

  const handleVerify = async () => {
    // Basic validation
    if (!pin.trim()) {
      setError('Please enter your PIN');
      setPhase('failed');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      setPhase('failed');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only digits');
      setPhase('failed');
      return;
    }

    // Enter validation/verifying phases
    setPhase('validating');
    setError('');
    verificationStartedAt.current = Date.now();

    try {
      const response = await fetch('/api/v1/wallets/security/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        // System-style feedback
        setPhase('failed');
        setSecurityState(prev => ({
          ...prev,
          attemptsRemaining: Math.max(0, prev.attemptsRemaining - 1),
          anomalyScore: Math.min(1, prev.anomalyScore + 0.15),
          trustScore: Math.max(0, prev.trustScore - 0.12),
        }));

        const attemptsLeft = Math.max(0, securityState.attemptsRemaining - 1);
        const systemMsg = `Verification mismatch detected. Trust score reduced. ${attemptsLeft} attempts remaining`;
        setError(systemMsg);
        toast.error(systemMsg);

        // If locked
        if (securityState.attemptsRemaining - 1 <= 0) {
          // enter cooldown
          setSecurityState(prev => ({ ...prev, cooldownRemaining: 60 }));
          setPhase('locked');
        }
        return;
      }

      // Success path
      setPhase('success');
      setSecurityState(prev => ({ ...prev, attemptsRemaining: 3, anomalyScore: Math.max(0, prev.anomalyScore - 0.1), trustScore: Math.min(1, prev.trustScore + 0.05) }));
      toast.success('PIN verified — session authorized');
      onVerified(data.verificationToken);
      setPin('');
    } catch (err) {
      setError('Failed to verify PIN. Please try again.');
      toast.error('Verification error');
    } finally {
        setPhase(prev => (prev === 'validating' || prev === 'verifying' ? 'idle' : prev));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    const blocked = ['validating', 'verifying', 'locked', 'cooldown'].includes(phase) || loading;
    if (e.key === 'Enter' && pin.length >= 4 && !blocked) {
      handleVerify();
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (securityState.cooldownRemaining <= 0) return;
    const id = setInterval(() => {
      setSecurityState(prev => {
        const next = Math.max(0, prev.cooldownRemaining - 1);
        if (next === 0) {
          // restore attempts
          return { ...prev, cooldownRemaining: 0, attemptsRemaining: 3 };
        }
        return { ...prev, cooldownRemaining: next };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [securityState.cooldownRemaining]);

  // React to PIN typing
  useEffect(() => {
    if (pin.length > 0 && phase === 'idle') setPhase('typing');
    if (pin.length === 0 && phase === 'typing') setPhase('idle');
    if (pin.length > 0) setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Read global system state (best-effort)
  let globalState: any = { threatLevel: 'normal', sessionTrust: 1, networkHealth: 1, activeWallet: null, authState: {} };
  try {
    const ctx = useSystemState();
    if (ctx && ctx.state) {
      globalState = {
        threatLevel: ctx.state.threatLevel || ctx.state.flags?.threatLevel || 'normal',
        sessionTrust: ctx.state.sessionTrust ?? 1,
        networkHealth: ctx.state.networkHealth ?? 1,
        activeWallet: ctx.state.activeWallet,
        authState: ctx.state.authState,
      };
    }
  } catch (e) {
    // ignore when provider missing
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* System Presence */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>Secure verification channel established</div>
            <div className="flex gap-3">
              <div>Trust: {(globalState.sessionTrust * 100).toFixed(0)}%</div>
              <div>Network: {(globalState.networkHealth * 100).toFixed(0)}%</div>
            </div>
          </div>

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

          {/* System Feedback */}
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
                disabled={['validating', 'verifying', 'locked', 'cooldown'].includes(phase) || loading || securityState.cooldownRemaining > 0}
                onKeyPress={handleKeyPress}
              className="text-center text-xl"
              inputMode="numeric"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              4-8 digits only. Your PIN is never stored or shared.
            </p>
          </div>

          {/* Attempt Counter / Lock */}
          {securityState.attemptsRemaining < 3 && securityState.attemptsRemaining > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {securityState.attemptsRemaining} attempts remaining
            </p>
          )}

          {securityState.attemptsRemaining <= 0 && securityState.cooldownRemaining <= 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Verification locked. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          {securityState.cooldownRemaining > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Too many failed attempts. Cooldown: {securityState.cooldownRemaining}s
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
            disabled={['validating', 'verifying', 'locked', 'cooldown'].includes(phase) || loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={
              ['validating', 'verifying', 'locked', 'cooldown'].includes(phase) ||
              loading ||
              pin.length < 4 ||
              securityState.attemptsRemaining <= 0 ||
              securityState.cooldownRemaining > 0
            }
          >
            {['validating', 'verifying'].includes(phase) || loading ? (
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
                // Open the PIN reset flow modal
                setShowResetFlow(true);
              }}
            >
              Reset it here
            </button>
          </p>
        </div>
        <PinResetFlow
          isOpen={showResetFlow}
          onClose={() => setShowResetFlow(false)}
          onSuccess={() => {
            setShowResetFlow(false);
            toast.success('PIN reset completed');
          }}
          walletId={globalState.activeWallet?.id || ''}
        />
      </DialogContent>
    </Dialog>
  );
}
