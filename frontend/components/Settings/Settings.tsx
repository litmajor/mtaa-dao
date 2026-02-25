import React from 'react';
import { useSettings } from './useSettings';
import { SettingsTabs } from './components/SettingsTabs';
import { ProfileSettings } from './sections/ProfileSettings';
import { SecuritySettingsSection } from './sections/SecuritySettings';
import { DeviceSettings } from './sections/DeviceSettings';
import { SessionSettings } from './sections/SessionSettings';
import { PreferencesSettings } from './sections/PreferencesSettings';
import PersonaProfile from '../../components/PersonaProfile';
import styles from './Settings.module.css';

/**
 * Unified Settings Component
 *
 * Consolidates all account settings under one unified interface:
 * - Profile: Account info, avatar, bio, timezone
 * - Security: 2FA, PIN, key export, social recovery
 * - Devices: Manage connected devices
 * - Sessions: View and sign out active sessions
 * - Preferences: Notifications, theme, language
 *
 * Each section includes contextual explanations for destructive actions.
 */
export const Settings: React.FC = () => {
  const {
    settings,
    updateTab,
    updateProfile,
    updateSecurityPreferences,
    updatePreferences,
    removeDevice,
    signOutSession,
    setSaving,
  } = useSettings();

  const renderActiveTab = () => {
    switch (settings.activeTab) {
      case 'profile':
        return (
          <ProfileSettings
            profile={settings.profile}
            onUpdate={updateProfile}
            isSaving={settings.isSaving}
          />
        );
      case 'security':
        return (
          <SecuritySettingsSection
            security={settings.security}
            onUpdate={updateSecurityPreferences}
            isSaving={settings.isSaving}
          />
        );
      case 'devices':
        return (
          <DeviceSettings
            devices={settings.devices}
            onRemoveDevice={removeDevice}
            isSaving={settings.isSaving}
          />
        );
      case 'sessions':
        return (
          <SessionSettings
            sessions={settings.sessions}
            onSignOutSession={signOutSession}
            isSaving={settings.isSaving}
          />
        );
      case 'preferences':
        return (
          <PreferencesSettings
            preferences={settings.preferences}
            onUpdate={updatePreferences}
            isSaving={settings.isSaving}
          />
        );
      case 'persona':
        return <PersonaProfile />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        <h1 className={styles.pageTitle}>Account Settings</h1>
        <p className={styles.pageDescription}>Manage your account, security, and preferences in one place.</p>
      </div>

      <div className={styles.settingsContent}>
        <SettingsTabs activeTab={settings.activeTab} onTabChange={updateTab} />
        <div className={styles.tabContent}>{renderActiveTab()}</div>
      </div>
    </div>
  );
};

export default Settings;
