import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  icon: React.ComponentType<any>;
  label?: string;
  title?: string;
  value: number | string;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  title,
  value,
  trend,
  onClick,
}) => {
  const displayLabel = title ?? label ?? '';
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.iconContainer}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className={`${styles.trend} ${styles[trend.direction]}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
          </span>
        )}
      </div>
      <h3 className={styles.label}>{displayLabel}</h3>
      <p className={styles.value}>{value}</p>
    </div>
  );
};

export default StatCard;
