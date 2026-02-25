import { useState, useCallback } from 'react';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  bio?: string;
  timezone: string;
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  pinSet: boolean;
  socialRecoveryEnabled: boolean;
  keysExported: boolean;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tablet';
  os: string;
  lastActive: string;
  ipAddress: string;
  isCurrentDevice: boolean;
}

export interface ActiveSession {
  id: string;
  device: string;
  location: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
}

export interface UserPreferences {
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  darkMode: boolean;
  language: 'en' | 'es' | 'fr' | 'de';
  advancedMode: boolean;
}

export interface SettingsState {
  activeTab: 'profile' | 'security' | 'devices' | 'sessions' | 'preferences';
  profile: UserProfile;
  security: SecurityPreferences;
  devices: ConnectedDevice[];
  sessions: ActiveSession[];
  preferences: UserPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialSettings: SettingsState = {
  activeTab: 'profile',
  profile: {
    firstName: 'Okedi',
    lastName: 'Amara',
    email: 'okedi.amara@mtaa.io',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=okedi',
    bio: 'Supporting community finance through innovation',
    timezone: 'Africa/Nairobi',
  },
  security: {
    twoFactorEnabled: true,
    pinSet: true,
    socialRecoveryEnabled: false,
    keysExported: true,
  },
  devices: [
    {
      id: 'device-1',
      name: 'iPhone 14 Pro',
      type: 'mobile',
      os: 'iOS 17.2',
      lastActive: 'Just now',
      ipAddress: '102.89.45.230',
      isCurrentDevice: true,
    },
    {
      id: 'device-2',
      name: 'MacBook Pro',
      type: 'desktop',
      os: 'macOS Sonoma 14.1',
      lastActive: '2 hours ago',
      ipAddress: '102.89.45.231',
      isCurrentDevice: false,
    },
    {
      id: 'device-3',
      name: 'iPad Air',
      type: 'tablet',
      os: 'iPadOS 17.2',
      lastActive: '1 week ago',
      ipAddress: '102.89.45.232',
      isCurrentDevice: false,
    },
  ],
  sessions: [
    {
      id: 'session-1',
      device: 'iPhone 14 Pro',
      location: 'Nairobi, Kenya',
      ipAddress: '102.89.45.230',
      lastActivity: 'Just now',
      createdAt: '2026-01-24',
    },
    {
      id: 'session-2',
      device: 'MacBook Pro',
      location: 'Nairobi, Kenya',
      ipAddress: '102.89.45.231',
      lastActivity: '2 hours ago',
      createdAt: '2026-01-26',
    },
    {
      id: 'session-3',
      device: 'iPad Air',
      location: 'Mombasa, Kenya',
      ipAddress: '102.89.45.232',
      lastActivity: '1 week ago',
      createdAt: '2026-01-19',
    },
  ],
  preferences: {
    notificationsEnabled: true,
    emailNotifications: true,
    pushNotifications: true,
    darkMode: false,
    language: 'en',
    advancedMode: false,
  },
  isLoading: false,
  isSaving: false,
  error: null,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);

  const updateTab = useCallback((tab: SettingsState['activeTab']) => {
    setSettings((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const updateProfile = useCallback((profile: Partial<UserProfile>) => {
    setSettings((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...profile },
    }));
  }, []);

  const updateSecurityPreferences = useCallback((security: Partial<SecurityPreferences>) => {
    setSettings((prev) => ({
      ...prev,
      security: { ...prev.security, ...security },
    }));
  }, []);

  const updatePreferences = useCallback((preferences: Partial<UserPreferences>) => {
    setSettings((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...preferences },
    }));
  }, []);

  const removeDevice = useCallback((deviceId: string) => {
    setSettings((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => d.id !== deviceId),
    }));
  }, []);

  const signOutSession = useCallback((sessionId: string) => {
    setSettings((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
    }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setSettings((prev) => ({ ...prev, isLoading }));
  }, []);

  const setSaving = useCallback((isSaving: boolean) => {
    setSettings((prev) => ({ ...prev, isSaving }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setSettings((prev) => ({ ...prev, error }));
  }, []);

  return {
    settings,
    updateTab,
    updateProfile,
    updateSecurityPreferences,
    updatePreferences,
    removeDevice,
    signOutSession,
    setLoading,
    setSaving,
    setError,
  };
};
