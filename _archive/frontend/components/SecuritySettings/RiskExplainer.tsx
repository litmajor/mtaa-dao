import React, { useState } from 'react';
import styles from './Security.module.css';

interface Threat {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  protection: string;
  whatYouCanDo: string[];
}

interface RiskExplainerProps {
  threats: Threat[];
  onLearnMore?: (threatId: string) => void;
}

export const RiskExplainer: React.FC<RiskExplainerProps> = ({
  threats,
  onLearnMore
}) => {
  const [expandedThreat, setExpandedThreat] = useState<string | null>(null);

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
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

  const getSeverityLabel = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low':
        return 'Low Risk';
      case 'medium':
        return 'Medium Risk';
      case 'high':
        return 'High Risk';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={styles.riskExplainerContainer}>
      <div className={styles.riskExplainerHeader}>
        <h2>Common Security Threats</h2>
        <p>Understanding these threats will help you protect your account.</p>
      </div>

      <div className={styles.threatsList}>
        {threats.map((threat) => (
          <div
            key={threat.id}
            className={`${styles.threatCard} ${expandedThreat === threat.id ? styles.expandedThreat : ''}`}
          >
            <button
              className={styles.threatCardHeader}
              onClick={() =>
                setExpandedThreat(
                  expandedThreat === threat.id ? null : threat.id
                )
              }
            >
              <div className={styles.threatTitle}>
                <span
                  className={styles.threatSeverity}
                  style={{ background: getSeverityColor(threat.severity) }}
                >
                  {getSeverityLabel(threat.severity)}
                </span>
                <h3>{threat.name}</h3>
              </div>
              <span className={styles.expandIcon}>
                {expandedThreat === threat.id ? '−' : '+'}
              </span>
            </button>

            {expandedThreat === threat.id && (
              <div className={styles.threatDetails}>
                <div className={styles.detailSection}>
                  <h4>What is it?</h4>
                  <p>{threat.description}</p>
                </div>

                <div className={styles.detailSection}>
                  <h4>How we protect you</h4>
                  <p>{threat.protection}</p>
                </div>

                <div className={styles.detailSection}>
                  <h4>What you can do</h4>
                  <ul>
                    {threat.whatYouCanDo.map((action, idx) => (
                      <li key={idx}>✓ {action}</li>
                    ))}
                  </ul>
                </div>

                {onLearnMore && (
                  <button
                    className={styles.learnMoreButton}
                    onClick={() => onLearnMore(threat.id)}
                  >
                    Learn more →
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.bestPractices}>
        <h3>Security Best Practices</h3>
        <div className={styles.practicesList}>
          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>🔒</span>
            <h4>Use Strong Passwords</h4>
            <p>Use unique, complex passwords with uppercase, numbers, and symbols.</p>
          </div>

          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>🔐</span>
            <h4>Enable 2FA</h4>
            <p>Two-factor authentication adds an extra layer of security to your account.</p>
          </div>

          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>⚠️</span>
            <h4>Verify Links</h4>
            <p>Always verify URLs and email addresses before clicking or responding.</p>
          </div>

          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>🛡️</span>
            <h4>Keep Software Updated</h4>
            <p>Update your device and applications to get the latest security patches.</p>
          </div>

          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>🚀</span>
            <h4>Monitor Activity</h4>
            <p>Review your login history and connected devices regularly.</p>
          </div>

          <div className={styles.practiceItem}>
            <span className={styles.practiceIcon}>📵</span>
            <h4>Use Secure Networks</h4>
            <p>Avoid using public WiFi for sensitive transactions or account access.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
