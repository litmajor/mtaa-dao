import React, { useState } from 'react';
import styles from './Security.module.css';

interface SecurityContextModalProps {
  title: string;
  action: 'enable-2fa' | 'change-pin' | 'export-keys' | 'enable-social-recovery' | 'disable-2fa';
  whatsAtRisk: string;
  whyHelps: string;
  whatsTheCost: string;
  learnMoreUrl?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

export const SecurityContextModal: React.FC<SecurityContextModalProps> = ({
  title,
  action,
  whatsAtRisk,
  whyHelps,
  whatsTheCost,
  learnMoreUrl,
  onConfirm,
  onCancel,
  isOpen
}) => {
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!understood) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'enable-2fa':
        return '🔐';
      case 'disable-2fa':
        return '🔓';
      case 'change-pin':
        return '🔑';
      case 'export-keys':
        return '💾';
      case 'enable-social-recovery':
        return '👥';
      default:
        return '⚙️';
    }
  };

  return (
    <div className={styles.contextModalOverlay}>
      <div className={styles.contextModalContent}>
        <button className={styles.contextModalClose} onClick={onCancel}>
          ✕
        </button>

        <div className={styles.contextModalIcon}>
          {getActionIcon()}
        </div>

        <h2 className={styles.contextModalTitle}>{title}</h2>

        <div className={styles.contextSection}>
          <h3>⚠️ What's at risk?</h3>
          <p>{whatsAtRisk}</p>
        </div>

        <div className={styles.contextSection}>
          <h3>✓ Why this helps</h3>
          <p>{whyHelps}</p>
        </div>

        <div className={styles.contextSection}>
          <h3>⏱️ What's the cost?</h3>
          <p>{whatsTheCost}</p>
        </div>

        {learnMoreUrl && (
          <div className={styles.contextLearnMore}>
            <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer">
              Learn more about {title.toLowerCase()} →
            </a>
          </div>
        )}

        <div className={styles.contextCheckbox}>
          <label>
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              disabled={isSubmitting}
            />
            <span>I understand the risks and benefits</span>
          </label>
        </div>

        <div className={styles.contextActions}>
          <button
            className={styles.buttonSecondary}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className={styles.buttonPrimary}
            onClick={handleConfirm}
            disabled={!understood || isSubmitting}
          >
            {isSubmitting ? '⏳ Confirming...' : 'Confirm & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
