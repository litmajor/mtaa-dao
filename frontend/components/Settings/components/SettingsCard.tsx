import React from 'react';
import styles from '../Settings.module.css';

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'warning' | 'success' | 'danger';
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon,
  children,
  action,
  variant = 'default',
}) => {
  return (
    <div className={`${styles.settingsCard} ${styles[`card${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          {icon && <span className={styles.cardIcon}>{icon}</span>}
          <div>
            <h3 className={styles.cardHeading}>{title}</h3>
            {description && <p className={styles.cardDescription}>{description}</p>}
          </div>
        </div>
        {action && <div className={styles.cardAction}>{action}</div>}
      </div>
      {children && <div className={styles.cardContent}>{children}</div>}
    </div>
  );
};
