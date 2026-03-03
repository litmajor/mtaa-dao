/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 2FA SETUP & VERIFICATION COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Handles TOTP setup and verification for admin accounts
 * 
 * Flow:
 * 1. User clicks "Setup 2FA"
 * 2. Request QR code from /api/admin/2fa/setup
 * 3. User scans QR code with authenticator app
 * 4. User enters TOTP code to verify
 * 5. User saves backup codes to secure location
 * 6. 2FA is enabled on account
 * 
 * Features:
 * - QR code display for authenticator app
 * - TOTP code verification
 * - Backup codes generation and display
 * - Copy-to-clipboard functionality
 * - Progressive disclosure of backup codes
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/modals/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Copy, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';

interface TwoFASetupProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userEmail: string;
}

interface SetupData {
  secret: string;
  iv: string;
  authTag: string;
  qrCode: string;
  backupCodes: string[];
}

export function TwoFASetup({ isOpen, onClose, onComplete, userEmail }: TwoFASetupProps) {
  const [step, setStep] = useState<'start' | 'scan' | 'verify' | 'backup' | 'complete'>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  /**
   * Step 1: Initiate 2FA setup
   * Fetch QR code and backup codes from server
   */
  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/2fa/setup', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to initiate 2FA setup');
      }

      const data = await response.json();
      setSetupData(data.data);
      setStep('scan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2: Verify TOTP code
   * User scans QR code and enters 6-digit code from authenticator
   */
  const handleVerifyTOTP = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/2fa/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          totpCode,
          secret: setupData?.secret,
          iv: setupData?.iv,
          authTag: setupData?.authTag,
          backupCodes: setupData?.backupCodes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy backup code to clipboard
   */
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  /**
   * Complete 2FA setup
   */
  const handleComplete = () => {
    setStep('complete');
    setTimeout(() => {
      onComplete();
      onClose();
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Set Up Two-Factor Authentication</h2>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {step === 'start' && (
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Two-factor authentication adds an extra layer of security to your admin account using an authenticator app.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">What you'll need:</h3>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200 text-sm">
                <li>An authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)</li>
                <li>Your email address</li>
                <li>A safe place to save backup codes</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartSetup}
                disabled={loading}
              >
                {loading ? 'Setting up...' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {step === 'scan' && setupData && (
          <div className="space-y-6">
            <Tabs defaultValue="qrcode" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qrcode">QR Code</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>

              <TabsContent value="qrcode" className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  Scan this QR code with your authenticator app:
                </p>
                <div className="flex justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <img src={setupData.qrCode} alt="2FA QR Code" className="w-64 h-64" />
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  If you can't scan the QR code, enter this secret manually:
                </p>
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm break-all">
                  {setupData.secret}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Account: {userEmail}
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Enter the 6-digit code from your authenticator app:
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setStep('start')}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleVerifyTOTP}
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
            </div>
          </div>
        )}

        {step === 'backup' && setupData && (
          <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                ⚠️ Save Your Backup Codes
              </h3>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Keep these codes in a safe place. Each code can be used once if you lose access to your authenticator app.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Backup Codes ({setupData.backupCodes.length})</span>
                <button
                  onClick={() => setShowBackupCodes(!showBackupCodes)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                >
                  {showBackupCodes ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Show
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {setupData.backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="relative p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono">
                        {showBackupCodes ? code : '●●●●-●●●●-●●●●'}
                      </code>
                      <button
                        onClick={() => handleCopyCode(code)}
                        className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:ease-gray-400 dark:hover:text-gray-200 p-1"
                        title="Copy code"
                      >
                        {copiedCode === code ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              I have saved my backup codes in a secure location.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setStep('scan')}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={loading}
              >
                {loading ? 'Completing...' : 'Complete Setup'}
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
            <h3 className="text-xl font-semibold">2FA Setup Complete!</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Your account is now protected with two-factor authentication.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You'll be prompted to enter a TOTP code on your next login.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default TwoFASetup;
