import React, { useState } from 'react';
import { SecurityPreferences } from '../useSettings';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsContextModal, SettingsModalConfig } from '../components/SettingsContextModal';
import styles from '../Settings.module.css';

interface SecuritySettingsProps {
  security: SecurityPreferences;
  onUpdate: (security: Partial<SecurityPreferences>) => void;
  isSaving?: boolean;
}

export const SecuritySettingsSection: React.FC<SecuritySettingsProps> = ({ security, onUpdate, isSaving = false }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'twoFactor' | 'pin' | 'keys' | 'recovery' | null;
  }>({ isOpen: false, type: null });

  const modalConfigs: Record<string, SettingsModalConfig> = {
    twoFactor: {
      title: 'Two-Factor Authentication',
      whatsAtRisk: 'Without 2FA, anyone with your password can access your account and funds.',
      whyHelps: 'Adds a second verification layer, making unauthorized access extremely difficult.',
      whatsTheCost: 'Takes an extra 15 seconds per login to verify with your phone.',
      icon: '🔐',
      actionLabel: security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA',
      isDangerous: security.twoFactorEnabled,
    },
    pin: {
      title: 'Transaction PIN',
      whatsAtRisk: 'Transactions could be made without your explicit verification.',
      whyHelps: 'Requires a PIN for every transaction, preventing accidental or unauthorized transfers.',
      whatsTheCost: 'You must remember and enter a 4-6 digit PIN for each transaction.',
      icon: '🔑',
      actionLabel: security.pinSet ? 'Change PIN' : 'Set PIN',
    },
    keys: {
      title: 'Export Keys',
      whatsAtRisk: 'Exported keys in wrong hands = permanent loss of funds. Keys are never recoverable.',
      whyHelps: 'A backup lets you recover access even if this device is lost or compromised.',
      whatsTheCost: 'You must securely store the keys (encrypted USB, hardware wallet, etc).',
      icon: '🔓',
      actionLabel: 'Export Private Keys',
      isDangerous: true,
    },
    recovery: {
      title: 'Social Recovery',
      whatsAtRisk: 'If you lose your phone and forgot your password, you could lose access forever.',
      whyHelps: 'Trusted friends can help you regain access without needing the original password.',
      whatsTheCost: 'Recovery takes 24-72 hours and requires trust in your recovery friends.',
      icon: '👥',
      actionLabel: security.socialRecoveryEnabled ? 'Disable Recovery' : 'Enable Recovery',
      isDangerous: security.socialRecoveryEnabled,
    },
  };

  const handleSecurityAction = (type: 'twoFactor' | 'pin' | 'keys' | 'recovery') => {
    setModalState({ isOpen: true, type });
  };

  const handleConfirm = async () => {
    const type = modalState.type;
    if (!type) return;

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    switch (type) {
      case 'twoFactor':
        onUpdate({ twoFactorEnabled: !security.twoFactorEnabled });
        break;
      case 'pin':
        onUpdate({ pinSet: !security.pinSet });
        break;
      case 'keys':
        onUpdate({ keysExported: true });
        break;
      case 'recovery':
        onUpdate({ socialRecoveryEnabled: !security.socialRecoveryEnabled });
        break;
    }

    setModalState({ isOpen: false, type: null });
  };

  const handleCancel = () => {
    setModalState({ isOpen: false, type: null });
  };

  return (
    <div className={styles.settingsSection}>
      <h2 className={styles.sectionTitle}>Security & Privacy</h2>
      <p className={styles.sectionDescription}>
        Protect your account and funds with these security settings. Each action is explained so you understand the risks and benefits.
      </p>

      <SettingsCard
        title="Two-Factor Authentication"
        description={security.twoFactorEnabled ? '✅ Enabled' : '❌ Disabled'}
        icon="🔐"
        action={
          <button
            onClick={() => handleSecurityAction('twoFactor')}
            className={security.twoFactorEnabled ? styles.dangerButton : styles.primaryButton}
            disabled={isSaving}
          >
            {security.twoFactorEnabled ? 'Disable' : 'Enable'}
          </button>
        }
      >
        <p>Require a code from your phone to sign in.</p>
      </SettingsCard>

      <SettingsCard
        title="Transaction PIN"
        description={security.pinSet ? '✅ Set' : '❌ Not set'}
        icon="🔑"
        action={
          <button onClick={() => handleSecurityAction('pin')} className={styles.primaryButton} disabled={isSaving}>
            {security.pinSet ? 'Change' : 'Set'} PIN
          </button>
        }
      >
        <p>Require a PIN before approving any transaction.</p>
      </SettingsCard>

      <SettingsCard
        title="Export Private Keys"
        description="Create a backup of your private keys"
        icon="🔓"
        variant="warning"
        action={
          <button onClick={() => handleSecurityAction('keys')} className={styles.dangerButton} disabled={isSaving}>
            Export Keys
          </button>
        }
      >
        <p className={styles.warningText}>⚠️ Only export if you understand how to safely store them.</p>
      </SettingsCard>

      <SettingsCard
        title="Social Recovery"
        description={security.socialRecoveryEnabled ? '✅ Enabled' : '❌ Disabled'}
        icon="👥"
        action={
          <button
            onClick={() => handleSecurityAction('recovery')}
            className={security.socialRecoveryEnabled ? styles.dangerButton : styles.primaryButton}
            disabled={isSaving}
          >
            {security.socialRecoveryEnabled ? 'Disable' : 'Enable'}
          </button>
        }
      >
        <p>Allow trusted friends to help recover your account.</p>
      </SettingsCard>

      {modalState.type && (
        <SettingsContextModal
          isOpen={modalState.isOpen}
          config={modalConfigs[modalState.type]}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};
