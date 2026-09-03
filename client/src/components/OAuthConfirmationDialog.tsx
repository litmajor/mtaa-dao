/**
 * OAuth Identity Confirmation Dialog
 * 
 * Shown when a user attempts to login with OAuth but has an existing
 * password-protected account. Requires password confirmation before
 * linking the OAuth provider to the existing account.
 * 
 * Security Flow:
 * 1. Detect ?requireConfirmation=true in URL
 * 2. Show password entry dialog with email
 * 3. Send password to /api/auth/oauth/confirm-linking
 * 4. Link identity server-side and return auth tokens
 * 5. Redirect to dashboard
 */

import React, { useState } from 'react';
import { AlertCircle, Lock, Eye, EyeOff, Loader } from 'lucide-react';

interface OAuthConfirmationDialogProps {
  email: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function OAuthConfirmationDialog({
  email,
  onSuccess,
  onCancel,
}: OAuthConfirmationDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!password) {
      setError('Please enter your password');
      setIsLoading(false);
      return;
    }

    try {
      // Get Google profile info from pending identity cookie
      // The server stores this in the oauth_pending_identity cookie
      const response = await fetch('/api/auth/oauth/confirm-linking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies to access pending identity
        body: JSON.stringify({
          email,
          password,
          // Note: googleId and googleProfile are retrieved server-side from the
          // oauth_pending_identity cookie for additional security
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        switch (response.status) {
          case 401:
            setError('Invalid password. Please try again.');
            break;
          case 404:
            setError('Account not found.');
            break;
          case 409:
            setError('This Google account is already linked to another user.');
            break;
          default:
            setError(data.error || 'Failed to confirm identity linking');
        }
        setIsLoading(false);
        return;
      }

      // Success! Tokens are now in secure cookies
      console.log('[OAuth] Identity linking successful');
      
      // Redirect to dashboard
      window.location.href = data.redirectUrl || '/dashboard';
    } catch (err: any) {
      console.error('[OAuth] Confirmation failed:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">Confirm Your Identity</h2>
          </div>
          <p className="text-sm text-gray-600">
            You have an existing account. Please confirm with your password to link Google sign-in.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleConfirm} className="space-y-4">
          {/* Email Display */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Account Email</p>
            <p className="font-medium text-gray-900 break-all">{email}</p>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">🔒 Your account is secure</p>
            <p className="text-xs">We'll link your Google account after you confirm your password.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isLoading && <Loader className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Confirming...' : 'Confirm & Link'}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Need help? <a href="/support" className="text-blue-600 hover:underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}
