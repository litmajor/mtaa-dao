import React from 'react';
import styles from '../Settings.module.css';

interface SettingsTabsProps {
  activeTab: 'profile' | 'security' | 'devices' | 'sessions' | 'preferences' | 'persona';
  onTabChange: (tab: 'profile' | 'security' | 'devices' | 'sessions' | 'preferences' | 'persona') => void;
}

const tabs = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'devices', label: 'Devices', icon: '📱' },
  { id: 'sessions', label: 'Sessions', icon: '🔑' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'persona', label: 'Persona & Progress', icon: '🎯' },
] as const;

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsList} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => onTabChange(tab.id as any)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
