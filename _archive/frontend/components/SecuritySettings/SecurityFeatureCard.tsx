import React from 'react';
import styles from './Security.module.css';

interface SecurityFeatureCardProps {
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  benefits: string[];
  implementation: string;
  onEnable?: () => void;
  onDisable?: () => void;
  onConfigure?: () => void;
  loading?: boolean;
}

export const SecurityFeatureCard: React.FC<SecurityFeatureCardProps> = ({
  title,
  description,
  icon,
  enabled,
  riskLevel,
  benefits,
  implementation,
  onEnable,
  onDisable,
  onConfigure,
  loading = false
}) => {
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
        return 'Low Risk';
      case 'medium':
        return 'Moderate Risk';
      case 'high':
        return 'High Risk if Disabled';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`${styles.featureCard} ${enabled ? styles.featureCardActive : ''}`}>
      <div className={styles.featureCardHeader}>
        <div className={styles.featureCardIcon}>{icon}</div>
        <div className={styles.featureCardMeta}>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className={styles.riskIndicator}>
        <div
          className={styles.riskColor}
          style={{ background: getRiskColor(riskLevel) }}
        />
        <span>{getRiskLabel(riskLevel)}</span>
      </div>

      <div className={styles.implementation}>
        <h4>How it works</h4>
        <p>{implementation}</p>
      </div>

      <div className={styles.benefits}>
        <h4>Benefits</h4>
        <ul>
          {benefits.map((benefit, idx) => (
            <li key={idx}>✓ {benefit}</li>
          ))}
        </ul>
      </div>

      <div className={styles.featureCardActions}>
        {!enabled ? (
          <>
            {onEnable && (
              <button
                className={styles.buttonEnable}
                onClick={onEnable}
                disabled={loading}
              >
                {loading ? 'Enabling...' : 'Enable Feature'}
              </button>
            )}
            {onConfigure && (
              <button
                className={styles.buttonSecondary}
                onClick={onConfigure}
                disabled={loading}
              >
                Learn More
              </button>
            )}
          </>
        ) : (
          <>
            {onConfigure && (
              <button
                className={styles.buttonSecondary}
                onClick={onConfigure}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Configure'}
              </button>
            )}
            {onDisable && (
              <button
                className={styles.buttonDisable}
                onClick={onDisable}
                disabled={loading}
              >
                {loading ? 'Disabling...' : 'Disable'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
