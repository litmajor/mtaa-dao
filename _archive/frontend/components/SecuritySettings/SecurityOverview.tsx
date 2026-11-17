import React, { useState } from 'react';
import styles from './Security.module.css';
import { SecurityContextModal } from './SecurityContextModal';

interface SecurityStatus {
  feature: string;
  enabled: boolean;
  lastUpdated?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface SecurityOverviewProps {
  overallRisk: 'low' | 'medium' | 'high';
  accountAge: string;
  lastLogin: string;
  lastPasswordChange?: string;
  securityFeatures: SecurityStatus[];
  onFeatureClick: (feature: string) => void;
  onSecurityAction?: (action: 'enable-2fa' | 'change-pin' | 'export-keys' | 'enable-social-recovery') => Promise<void>;
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({
  overallRisk,
  accountAge,
  lastLogin,
  lastPasswordChange,
  securityFeatures,
  onFeatureClick,
  onSecurityAction
}) => {
  const [contextModal, setContextModal] = useState<{
    isOpen: boolean;
    action: 'enable-2fa' | 'change-pin' | 'export-keys' | 'enable-social-recovery' | null;
  }>({
    isOpen: false,
    action: null
  });

  const handleSecurityAction = async (
    action: 'enable-2fa' | 'change-pin' | 'export-keys' | 'enable-social-recovery'
  ) => {
    setContextModal({ isOpen: true, action });
  };

  const handleContextModalConfirm = async () => {
    if (contextModal.action && onSecurityAction) {
      try {
        await onSecurityAction(contextModal.action);
        setContextModal({ isOpen: false, action: null });
      } catch (error) {
        console.error('Security action failed:', error);
      }
    }
  };

  const contextModalConfigs = {
    'enable-2fa': {
      title: 'Enable Two-Factor Authentication',
      whatsAtRisk: 'Without 2FA, your account is protected only by your password. If someone guesses or steals your password, they can access your entire account and all your funds.',
      whyHelps: 'Two-factor authentication requires a second code from your phone when logging in. Even if someone has your password, they cannot access your account without this second code.',
      whatsTheCost: 'You\'ll need to enter a 6-digit code when logging in (takes 15 seconds). If you lose your phone, you can use backup codes to regain access.',
      learnMoreUrl: '/help/2fa'
    },
    'change-pin': {
      title: 'Change Your PIN',
      whatsAtRisk: 'If someone discovers your PIN, they could authorize transactions without your knowledge or approval.',
      whyHelps: 'Changing your PIN regularly reduces the chance that someone has guessed or discovered it. A strong, unique PIN is harder to crack.',
      whatsTheCost: 'You\'ll need to remember your new PIN and use it to authorize transactions (takes 10 seconds per transaction).',
      learnMoreUrl: '/help/pin'
    },
    'export-keys': {
      title: 'Export Your Private Keys',
      whatsAtRisk: 'Exporting your keys creates a backup file. If this file is stolen, hackers can access your funds. If you lose this file, you permanently lose access to your account.',
      whyHelps: 'Having a backup of your keys ensures you can recover your account if you lose access. This is your final safety net.',
      whatsTheCost: 'The backup file must be stored securely (not on your computer). Recommended: encrypted hardware wallet or safety deposit box.',
      learnMoreUrl: '/help/backup'
    },
    'enable-social-recovery': {
      title: 'Enable Social Recovery',
      whatsAtRisk: 'Without social recovery, losing your password means permanently losing access to your account. There\'s no way to prove you\'re the owner.',
      whyHelps: 'Social recovery lets trusted friends help you regain access if you lose your password. You need 3 of 5 guardians to approve account recovery.',
      whatsTheCost: 'You need to identify 5 trusted people and contact them. The recovery process takes 24-72 hours for security.',
      learnMoreUrl: '/help/social-recovery'
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'high':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getRiskLabel = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return 'Secure';
      case 'medium':
        return 'Moderate Risk';
      case 'high':
        return 'At Risk';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={styles.overviewContainer}>
      <SecurityContextModal
        isOpen={contextModal.isOpen && contextModal.action !== null}
        title={
          contextModal.action ? contextModalConfigs[contextModal.action]?.title || '' : ''
        }
        action={contextModal.action as any}
        whatsAtRisk={
          contextModal.action ? contextModalConfigs[contextModal.action]?.whatsAtRisk || '' : ''
        }
        whyHelps={
          contextModal.action ? contextModalConfigs[contextModal.action]?.whyHelps || '' : ''
        }
        whatsTheCost={
          contextModal.action ? contextModalConfigs[contextModal.action]?.whatsTheCost || '' : ''
        }
        learnMoreUrl={
          contextModal.action ? contextModalConfigs[contextModal.action]?.learnMoreUrl : undefined
        }
        onConfirm={handleContextModalConfirm}
        onCancel={() => setContextModal({ isOpen: false, action: null })}
      />
      <div className={styles.riskCard}>
        <div className={styles.riskHeader}>
          <h2>Security Status</h2>
          <div
            className={styles.riskBadge}
            style={{
              background: getRiskColor(overallRisk),
              color: 'white'
            }}
          >
            {getRiskLabel(overallRisk)}
          </div>
        </div>

        <div className={styles.riskMeter}>
          <div
            className={styles.riskIndicator}
            style={{ background: getRiskColor(overallRisk) }}
          />
        </div>

        <div className={styles.accountInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Account Created</span>
            <span className={styles.value}>{accountAge}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Last Login</span>
            <span className={styles.value}>{lastLogin}</span>
          </div>
          {lastPasswordChange && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Password Changed</span>
              <span className={styles.value}>{lastPasswordChange}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.featuresSection}>
        <h3>Security Features</h3>
        <div className={styles.featuresList}>
          {securityFeatures.map((feature) => (
            <button
              key={feature.feature}
              className={`${styles.featureItem} ${feature.enabled ? styles.enabled : ''}`}
              onClick={() => onFeatureClick(feature.feature)}
            >
              <div className={styles.featureHeader}>
                <span className={styles.featureName}>{feature.feature}</span>
                <span
                  className={styles.featureStatus}
                  style={{
                    background: feature.enabled ? '#e8f5e9' : '#ffebee',
                    color: feature.enabled ? '#2e7d32' : '#c62828'
                  }}
                >
                  {feature.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              {feature.lastUpdated && (
                <small className={styles.featureUpdated}>
                  Last updated: {feature.lastUpdated}
                </small>
              )}
              <div
                className={styles.featureRisk}
                style={{ color: getRiskColor(feature.riskLevel) }}
              >
                {feature.riskLevel === 'high' && '⚠️ High Risk'}
                {feature.riskLevel === 'medium' && '⚡ Moderate'}
                {feature.riskLevel === 'low' && '✓ Protected'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
