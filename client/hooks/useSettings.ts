/**
 * useSettings Hook
 * User preferences and application settings
 * Integrated with backend API for persistence
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { settingsApi } from '@/client/lib/apiClient';

export interface UserSettings {
  profile: {
    name: string;
    email: string;
    timezone: string;
  };
  trading: {
    autoStopLoss: boolean;
    autoTakeProfit: boolean;
    useSmartRouting: boolean;
    riskLimitAlerts: boolean;
    defaultPositionSize: number;
    maxRiskPerTrade: number;
  };
  notifications: {
    emailOrderFilled: boolean;
    emailStopLossTriggered: boolean;
    emailHighRisk: boolean;
    pushOrderUpdates: boolean;
    smsCriticalAlerts: boolean;
  };
  display: {
    theme: 'dark' | 'light' | 'auto';
    chartType: 'candlestick' | 'line' | 'area';
    showGrid: boolean;
    animateCharts: boolean;
    showVolume: boolean;
  };
}

/**
 * Hook: Get all user settings
 */
export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await settingsApi.getSettings();
      if (response.success && response.data) {
        setSettings(response.data as UserSettings);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refetch: fetchSettings };
}

/**
 * Hook: Update user profile settings
 */
export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useCallback(async (profileData: any) => {
    try {
      setLoading(true);
      const response = await settingsApi.updateSettings({
        profile: profileData,
      });
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to update profile');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateProfile, loading, error };
}

/**
 * Hook: Update trading preferences
 */
export function useUpdateTradingPreferences() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePreferences = useCallback(async (preferences: any) => {
    try {
      setLoading(true);
      const response = await settingsApi.updateTradingPreferences(preferences);
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to update preferences');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updatePreferences, loading, error };
}

/**
 * Hook: Update notification settings
 */
export function useUpdateNotifications() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateNotifications = useCallback(async (settings: any) => {
    try {
      setLoading(true);
      const response = await settingsApi.updateNotificationSettings(settings);
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to update notifications');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateNotifications, loading, error };
}

/**
 * Hook: Update display settings
 */
export function useUpdateDisplay() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDisplay = useCallback(async (settings: any) => {
    try {
      setLoading(true);
      const response = await settingsApi.updateDisplaySettings(settings);
      if (response.success) {
        setError(null);
        return { success: true };
      } else {
        setError(response.error || 'Failed to update display');
        return { success: false, error: response.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateDisplay, loading, error };
}
