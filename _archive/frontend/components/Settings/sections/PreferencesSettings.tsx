import React from 'react';
import { UserPreferences } from '../useSettings';
import { SettingsCard } from '../components/SettingsCard';
import styles from '../Settings.module.css';

interface PreferencesSettingsProps {
  preferences: UserPreferences;
  onUpdate: (preferences: Partial<UserPreferences>) => void;
  isSaving?: boolean;
}

export const PreferencesSettings: React.FC<PreferencesSettingsProps> = ({
  preferences,
  onUpdate,
  isSaving = false,
}) => {
  const handleToggle = (field: keyof UserPreferences) => {
    onUpdate({ [field]: !preferences[field] });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ language: e.target.value as 'en' | 'es' | 'fr' | 'de' });
  };

  return (
    <div className={styles.settingsSection}>
      <h2 className={styles.sectionTitle}>Preferences</h2>
      <p className={styles.sectionDescription}>Customize your experience to suit your needs.</p>

      <SettingsCard title="All Notifications" icon="🔔" action={
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={preferences.notificationsEnabled}
            onChange={() => handleToggle('notificationsEnabled')}
            disabled={isSaving}
          />
          <span className={styles.toggleSlider}></span>
        </label>
      }>
        <p>Receive updates about your account and transactions.</p>
      </SettingsCard>

      <SettingsCard
        title="Email Notifications"
        description={preferences.emailNotifications ? 'Enabled' : 'Disabled'}
        icon="✉️"
        action={
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={() => handleToggle('emailNotifications')}
              disabled={isSaving}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        }
      >
        <p>Get important alerts sent to your email address.</p>
      </SettingsCard>

      <SettingsCard
        title="Push Notifications"
        description={preferences.pushNotifications ? 'Enabled' : 'Disabled'}
        icon="📲"
        action={
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={preferences.pushNotifications}
              onChange={() => handleToggle('pushNotifications')}
              disabled={isSaving}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        }
      >
        <p>Receive notifications on your mobile device.</p>
      </SettingsCard>

      <SettingsCard title="Dark Mode" icon="🌙" action={
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={preferences.darkMode}
            onChange={() => handleToggle('darkMode')}
            disabled={isSaving}
          />
          <span className={styles.toggleSlider}></span>
        </label>
      }>
        <p>Reduces eye strain in low-light environments.</p>
      </SettingsCard>

      <SettingsCard
        title="Language"
        icon="🌍"
        action={
          <select
            value={preferences.language}
            onChange={handleLanguageChange}
            className={styles.input}
            disabled={isSaving}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        }
      >
        <p>Choose your preferred language for the interface.</p>
      </SettingsCard>

      <SettingsCard
        title="Advanced Mode"
        description={preferences.advancedMode ? '✅ Enabled' : '❌ Disabled'}
        icon="⚡"
        variant={preferences.advancedMode ? 'success' : 'warning'}
        action={
          <button
            onClick={() => {
              if (!preferences.advancedMode) {
                // Show confirmation before enabling
                if (confirm('⚠️ Advanced Mode unlocks all features including trading, advanced governance, and developer tools. Are you sure?')) {
                  onUpdate({ advancedMode: true });
                }
              } else {
                onUpdate({ advancedMode: false });
              }
            }}
            className={styles.primaryButton}
            disabled={isSaving}
          >
            {preferences.advancedMode ? 'Disable' : 'Enable'}
          </button>
        }
      >
        <p>Unlock all features including trading, advanced governance, and developer tools. Advanced Mode is for experienced users.</p>
      </SettingsCard>
    </div>
  );
};
