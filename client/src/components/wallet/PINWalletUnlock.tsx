/**
 * PINWalletUnlock Component
 * Allows users to access their wallet with PIN instead of seedphrase
 * Creates a wallet session for the duration of the user's login
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock, LoaderCircle } from 'lucide-react';

interface PINWalletUnlockProps {
  walletId: string;
  onUnlocked?: (sessionToken: string) => void;
  onError?: (error: string) => void;
}

export default function PINWalletUnlock({ walletId, onUnlocked, onError }: PINWalletUnlockProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const { toast } = useToast();

  const maxAttempts = 3;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
  };

  const unlockWallet = async () => {
    if (pin.length !== 4) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be 4 digits',
        variant: 'destructive',
      });
      return;
    }

    if (locked) {
      toast({
        title: 'Account Locked',
        description: `Too many failed attempts. Try again in 15 minutes.`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/wallets/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletId,
          pin,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Wallet unlocked successfully',
        });

        // Store session token in memory or localStorage
        if (data.data.sessionToken) {
          sessionStorage.setItem('walletSessionToken', data.data.sessionToken);
          sessionStorage.setItem('walletSessionExpires', data.data.expiresAt);
        }

        setPin('');
        setAttempts(0);
        onUnlocked?.(data.data.sessionToken);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= maxAttempts) {
          setLocked(true);
          onError?.('Account locked due to too many failed attempts');
          toast({
            title: 'Account Locked',
            description: 'Too many failed attempts. Try again in 15 minutes.',
            variant: 'destructive',
          });
        } else {
          const remaining = maxAttempts - newAttempts;
          onError?.(data.error || 'Invalid PIN');
          toast({
            title: 'Invalid PIN',
            description: `${remaining} attempt(s) remaining`,
            variant: 'destructive',
          });
        }
        setPin('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlock wallet';
      onError?.(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (locked) {
    return (
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-500" />
            Account Locked
          </CardTitle>
          <CardDescription>
            Too many failed PIN attempts. Please try again in 15 minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Unlock className="h-5 w-5 text-green-500" />
          Unlock Wallet with PIN
        </CardTitle>
        <CardDescription>
          Enter your 4-digit PIN to access your wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attempts > 0 && (
          <Alert variant="default">
            <AlertDescription>
              {maxAttempts - attempts} attempt{maxAttempts - attempts !== 1 ? 's' : ''} remaining
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label htmlFor="pin" className="text-sm font-medium">
            4-Digit PIN
          </label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={handlePinChange}
            placeholder="••••"
            maxLength={4}
            className="text-center text-lg tracking-widest"
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            Enter the PIN you set up during wallet creation
          </p>
        </div>

        <Button
          onClick={unlockWallet}
          disabled={pin.length !== 4 || loading}
          className="w-full"
          size="lg"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? 'Unlocking...' : 'Unlock Wallet'}
        </Button>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-900 text-sm">
            💡 Tip: Your wallet stays unlocked for 24 hours. You can use it without entering PIN again during this time.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
