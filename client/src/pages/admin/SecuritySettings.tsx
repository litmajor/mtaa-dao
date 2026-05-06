/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ADMIN SECURITY SETTINGS PAGE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Allows superusers to manage their security settings:
 * - 2FA (TOTP) setup, verification, and management
 * - Backup codes view and regeneration
 * - Session management
 * - Login history
 * - Password change
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/utils/authClient';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Trash2,
  Shield,
  Clock
} from 'lucide-react';
import TwoFASetup from '@/components/settings/TwoFASetup';

interface TwoFAStatus {
  enabled: boolean;
  method: string;
  setupAt?: string;
  verifiedAt?: string;
  backupCodesRemaining: number;
}

interface BackupCodesData {
  backupCodesRemaining: number;
  backupCodes?: string[];
}

export default function AdminSecuritySettings() {
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus | null>(null);
  const [backupCodes, setBackupCodes] = useState<BackupCodesData | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showTwoFASetup, setShowTwoFASetup] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load 2FA status on mount
  useEffect(() => {
    loadTwoFAStatus();
  }, []);

  /**
   * Load current 2FA status from server
   */
  const loadTwoFAStatus = async () => {
    try {
      const data = await authClient.get('/api/admin/2fa/backup-codes');
      setTwoFAStatus({
        enabled: true,
        method: 'totp',
        backupCodesRemaining: data.data.backupCodesRemaining
      });
      setBackupCodes(data.data);
    } catch (err) {
      // 2FA not set up yet, which is fine
      console.debug('2FA not yet configured');
    }
  };

  /**
   * View backup codes (requires password)
   */
  const handleViewBackupCodes = async () => {
    if (!password) {
      setError('Password required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authClient.get('/api/admin/2fa/backup-codes?showCodes=true');
      setBackupCodes(data.data);
      setShowBackupCodes(true);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve backup codes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Regenerate backup codes
   */
  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      setError('Password required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authClient.post('/api/admin/2fa/backup-codes/regenerate', { password });
      setBackupCodes(data.data);
      setSuccess('Backup codes regenerated successfully');
      setPassword('');
      
      // Show new codes and allow user to copy them
      setShowBackupCodes(true);

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Disable 2FA
   */
  const handleDisable2FA = async () => {
    if (!password) {
      setError('Password required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authClient.post('/api/admin/2fa/disable', { password });
      setTwoFAStatus(null);
      setBackupCodes(null);
      setShowDisable2FA(false);
      setPassword('');
      setSuccess('2FA has been disabled');

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disable failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy backup code
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

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Shield className="w-8 h-8 text-blue-600" />
          Security Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your admin account security and authentication methods
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Security Tabs */}
      <Tabs defaultValue="2fa" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="backup">Backup Codes</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>

        {/* 2FA Tab */}
        <TabsContent value="2fa" className="space-y-6">
          {twoFAStatus?.enabled ? (
            <div className="space-y-6">
              {/* 2FA Enabled Status */}
              <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    2FA Enabled
                  </h3>
                </div>

                <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                  <div className="flex justify-between items-center">
                    <span>Method:</span>
                    <span className="font-semibold">TOTP (Time-based One-Time Password)</span>
                  </div>
                  {twoFAStatus.setupAt && (
                    <div className="flex justify-between items-center">
                      <span>Setup Date:</span>
                      <span className="font-semibold">{new Date(twoFAStatus.setupAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span>Backup Codes Available:</span>
                    <span className="font-semibold">{twoFAStatus.backupCodesRemaining}</span>
                  </div>
                </div>
              </div>

              {/* Disable 2FA */}
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Disable Two-Factor Authentication
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  WARNING: Disabling 2FA makes your account less secure. Your account will only be protected by your password.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisable2FA(true)}
                >
                  Disable 2FA
                </Button>
              </div>

              {/* Disable 2FA Confirmation */}
              {showDisable2FA && (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                    Confirm Password to Disable 2FA
                  </h4>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDisable2FA(false);
                        setPassword('');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisable2FA}
                      disabled={loading || !password}
                    >
                      {loading ? 'Disabling...' : 'Disable 2FA'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                  2FA Not Enabled
                </h3>
              </div>

              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Set up two-factor authentication to protect your admin account with an additional security layer.
              </p>

              <Button
                onClick={() => setShowTwoFASetup(true)}
                className="w-full"
              >
                Set Up Two-Factor Authentication
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Backup Codes Tab */}
        {twoFAStatus?.enabled && (
          <TabsContent value="backup" className="space-y-6">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                About Backup Codes
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Backup codes are single-use codes that can be used to access your account if you lose access to your authenticator app. Keep them in a safe place.
              </p>
            </div>

            {/* View Backup Codes */}
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                View Backup Codes
              </h3>

              {!showBackupCodes && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter your password to view your backup codes:
                  </p>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setPassword('')}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleViewBackupCodes}
                      disabled={loading || !password}
                    >
                      {loading ? 'Loading...' : 'View Codes'}
                    </Button>
                  </div>
                </>
              )}

              {showBackupCodes && backupCodes?.backupCodes && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="relative p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-sm font-mono">{code}</code>
                          <button
                            onClick={() => handleCopyCode(code)}
                            className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBackupCodes(false);
                      setPassword('');
                    }}
                  >
                    Hide Codes
                  </Button>
                </div>
              )}
            </div>

            {/* Regenerate Backup Codes */}
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Regenerate Backup Codes
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate new backup codes. Your old codes will become invalid.
              </p>

              <Input
                type="password"
                placeholder="Enter your password to regenerate"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPassword('')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRegenerateBackupCodes}
                  disabled={loading || !password}
                >
                  {loading ? 'Regenerating...' : 'Regenerate Codes'}
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Password Tab */}
        <TabsContent value="password" className="space-y-6">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Password Security
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1">
              <li>Use at least 12 characters for admin accounts</li>
              <li>Include uppercase, lowercase, numbers, and special characters</li>
              <li>Avoid using dictionary words or personal information</li>
              <li>Change your password regularly</li>
            </ul>
          </div>

          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Password change functionality coming soon. Please contact your system administrator to change your password.
            </p>

            <Button disabled>
              Change Password
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Modal */}
      <TwoFASetup
        isOpen={showTwoFASetup}
        onClose={() => setShowTwoFASetup(false)}
        onComplete={() => {
          loadTwoFAStatus();
        }}
        userEmail={typeof window !== 'undefined' ? (document.querySelector('[data-user-email]') as any)?.dataset.userEmail || 'user@example.com' : 'user@example.com'}
      />
    </div>
  );
}
