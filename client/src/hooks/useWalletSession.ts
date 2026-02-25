/**
 * useWalletSession Hook
 * Manages wallet session state and provides access to wallet functions
 * Handles PIN-based wallet unlocking and session management
 */

import { useState, useEffect, useCallback } from 'react';

interface WalletSessionState {
  isConnected: boolean;
  sessionToken: string | null;
  walletId: string | null;
  expiresAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useWalletSession() {
  const [state, setState] = useState<WalletSessionState>({
    isConnected: false,
    sessionToken: null,
    walletId: null,
    expiresAt: null,
    isLoading: false,
    error: null,
  });

  // Load session from storage on mount
  useEffect(() => {
    const sessionToken = sessionStorage.getItem('walletSessionToken');
    const expiresAtStr = sessionStorage.getItem('walletSessionExpires');
    const walletId = sessionStorage.getItem('walletId');

    if (sessionToken && expiresAtStr) {
      const expiresAt = new Date(expiresAtStr);
      if (expiresAt > new Date()) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          sessionToken,
          walletId,
          expiresAt,
        }));
      } else {
        // Session expired
        sessionStorage.removeItem('walletSessionToken');
        sessionStorage.removeItem('walletSessionExpires');
        sessionStorage.removeItem('walletId');
      }
    }
  }, []);

  // Connect wallet with PIN
  const connectWallet = useCallback(async (walletId: string, pin: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch('/api/wallet-sessions/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walletId, pin }),
      });

      const data = await response.json();

      if (data.success) {
        const sessionToken = data.data.sessionToken;
        const expiresAt = new Date(data.data.expiresAt);

        // Store in session storage
        sessionStorage.setItem('walletSessionToken', sessionToken);
        sessionStorage.setItem('walletSessionExpires', expiresAt.toISOString());
        sessionStorage.setItem('walletId', walletId);

        setState(prev => ({
          ...prev,
          isConnected: true,
          sessionToken,
          walletId,
          expiresAt,
          isLoading: false,
        }));

        return { success: true, sessionToken };
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Failed to connect wallet',
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return { success: false, error: message };
    }
  }, []);

  // Verify current session
  const verifySession = useCallback(async () => {
    const sessionToken = sessionStorage.getItem('walletSessionToken');
    if (!sessionToken) {
      return { valid: false };
    }

    try {
      const response = await fetch('/api/wallet-sessions/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });

      const data = await response.json();

      if (data.success && data.data.valid) {
        return { valid: true, ...data.data };
      } else {
        // Session invalid, clear storage
        sessionStorage.removeItem('walletSessionToken');
        sessionStorage.removeItem('walletSessionExpires');
        sessionStorage.removeItem('walletId');

        setState(prev => ({
          ...prev,
          isConnected: false,
          sessionToken: null,
          walletId: null,
          expiresAt: null,
        }));

        return { valid: false };
      }
    } catch (error) {
      return { valid: false };
    }
  }, []);

  // Extend session
  const extendSession = useCallback(async (hours: number = 24) => {
    const sessionToken = sessionStorage.getItem('walletSessionToken');
    if (!sessionToken) {
      return { success: false, error: 'No active session' };
    }

    try {
      const response = await fetch('/api/wallet-sessions/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-session': sessionToken,
        },
        credentials: 'include',
        body: JSON.stringify({ hours }),
      });

      const data = await response.json();

      if (data.success) {
        const newExpiresAt = new Date(data.data.newExpiresAt);
        sessionStorage.setItem('walletSessionExpires', newExpiresAt.toISOString());

        setState(prev => ({
          ...prev,
          expiresAt: newExpiresAt,
        }));

        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extend session';
      return { success: false, error: message };
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    const sessionToken = sessionStorage.getItem('walletSessionToken');
    
    try {
      if (sessionToken) {
        await fetch('/api/wallet-sessions/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-session': sessionToken,
          },
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    } finally {
      // Clear session storage regardless of API response
      sessionStorage.removeItem('walletSessionToken');
      sessionStorage.removeItem('walletSessionExpires');
      sessionStorage.removeItem('walletId');

      setState({
        isConnected: false,
        sessionToken: null,
        walletId: null,
        expiresAt: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  // Disconnect all wallets
  const disconnectAll = useCallback(async () => {
    try {
      await fetch('/api/wallet-sessions/disconnect-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error disconnecting all wallets:', error);
    } finally {
      sessionStorage.removeItem('walletSessionToken');
      sessionStorage.removeItem('walletSessionExpires');
      sessionStorage.removeItem('walletId');

      setState({
        isConnected: false,
        sessionToken: null,
        walletId: null,
        expiresAt: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  // Check if session is expiring soon (within 1 hour)
  const isExpiringSoon = useCallback(() => {
    if (!state.expiresAt) return false;
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    return state.expiresAt.getTime() - now.getTime() < oneHour;
  }, [state.expiresAt]);

  // Get remaining session time in minutes
  const getRemainingMinutes = useCallback(() => {
    if (!state.expiresAt) return 0;
    const now = new Date();
    const remaining = state.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(remaining / (60 * 1000)));
  }, [state.expiresAt]);

  return {
    ...state,
    connectWallet,
    verifySession,
    extendSession,
    disconnectWallet,
    disconnectAll,
    isExpiringsoon: isExpiringSoon(),
    remainingMinutes: getRemainingMinutes(),
  };
}
