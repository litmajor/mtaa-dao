import React, { useState } from 'react';
import styles from '../Settings.module.css';

export interface SettingsModalConfig {
  title: string;
  whatsAtRisk: string;
  whyHelps: string;
  whatsTheCost: string;
  icon?: string;
  actionLabel: string;
  isDangerous?: boolean;
}

interface SettingsContextModalProps {
  isOpen: boolean;
  config: SettingsModalConfig;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const SettingsContextModal: React.FC<SettingsContextModalProps> = ({
  isOpen,
  config,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const [understood, setUnderstood] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    setUnderstood(false);
  };

  const handleCancel = () => {
    onCancel();
    setUnderstood(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {config.icon && <div className={styles.modalIcon}>{config.icon}</div>}

        <h2 className={styles.modalTitle}>{config.title}</h2>

        <div className={styles.contextSections}>
          <div className={styles.contextSection}>
            <h3 className={styles.contextLabel}>What's at risk?</h3>
            <p className={styles.contextText}>{config.whatsAtRisk}</p>
          </div>

          <div className={styles.contextSection}>
            <h3 className={styles.contextLabel}>Why this helps</h3>
            <p className={styles.contextText}>{config.whyHelps}</p>
          </div>

          <div className={styles.contextSection}>
            <h3 className={styles.contextLabel}>What's the cost?</h3>
            <p className={styles.contextText}>{config.whatsTheCost}</p>
          </div>
        </div>

        <div className={styles.checkboxContainer}>
          <input
            type="checkbox"
            id="understood-checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className={styles.checkbox}
          />
          <label htmlFor="understood-checkbox" className={styles.checkboxLabel}>
            I understand the risks and want to proceed
          </label>
        </div>

        <div className={styles.modalActions}>
          <button onClick={handleCancel} className={styles.secondaryButton} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!understood || isSubmitting}
            className={`${styles.primaryButton} ${config.isDangerous ? styles.dangerButton : ''}`}
          >
            {isSubmitting ? 'Processing...' : config.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
