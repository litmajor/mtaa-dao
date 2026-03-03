/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 2FA LOGIN VERIFICATION MODAL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Shown after password verification when 2FA is enabled
 * User enters 6-digit TOTP code from authenticator app
 * Also allows using backup codes if user has lost access to authenticator
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Loader2, Lock } from 'lucide-react';

interface TwoFAVerificationProps {
  isOpen: boolean;
  tempToken: string;
  onVerified: (accessToken: string) => void;
  onCancel: () => void;
}

export function TwoFAVerification({
  isOpen,
  tempToken,
  onVerified,
  onCancel
}: TwoFAVerificationProps) {
  const [verificationMethod, setVerificationMethod] = useState<'totp' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code) {
      setError('Please enter a code');
      return;
    }

    if (verificationMethod === 'totp' && code.length !== 6) {
      setError('TOTP code must be 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          totpCode: code,
          method: verificationMethod
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await response.json();

      // Call onVerified with the full access token
      // In a real implementation, the server would return an access token
      // For now, we'll use the temp token indicated verification is complete
      onVerified(tempToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
        </div>

        {/* Info */}
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Enter the 6-digit code from your authenticator app to complete login.
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={verificationMethod} onValueChange={(v) => {
          setVerificationMethod(v as 'totp' | 'backup');
          setCode('');
          setError(null);
        }} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp">TOTP Code</TabsTrigger>
            <TabsTrigger value="backup">Backup Code</TabsTrigger>
          </TabsList>

          <TabsContent value="totp" className="space-y-4 mt-4">
            <Input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-3xl tracking-widest"
              autoFocus
              disabled={loading}
            />
          </TabsContent>

          <TabsContent value="backup" className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If you've lost access to your authenticator app, you can use a backup code.
            </p>
            <Input
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={loading}
              maxLength={14}
            />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={loading || !code}
            className="flex-1"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>

        {/* Recovery Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Don't have your authenticator? Check your backup codes.
        </p>
      </div>
    </div>
  );
}

export default TwoFAVerification;
