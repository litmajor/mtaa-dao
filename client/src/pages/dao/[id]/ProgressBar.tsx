import React from 'react';
import styles from './settings.module.css';

interface ProgressBarProps {
  current: number;
  max: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, max }) => {
  const percentage = Math.round((current / max) * 100);
  
  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        data-percentage={percentage}
      />
    </div>
  );
};
