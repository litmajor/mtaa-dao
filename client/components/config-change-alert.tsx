'use client';

import React, { useState, useEffect } from 'react';
import styles from './config-change-alert.module.css';
import { useRealtimeConfig } from '@/hooks/useWebSocket';
import { format } from 'date-fns';

interface ConfigChangeAlertProps {
  entityType: string;
  entityId: string;
  onRefresh?: () => void;
}

/**
 * Configuration Change Alert
 * Notifies when entity configuration is updated elsewhere
 */
export default function ConfigChangeAlert({
  entityType,
  entityId,
  onRefresh
}: ConfigChangeAlertProps) {
  const { configChange, changeTimestamp } = useRealtimeConfig(entityType, entityId);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (configChange && !dismissed) {
      setIsVisible(true);

      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [configChange, dismissed]);

  if (!isVisible || !configChange) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.alert}>
        <div className={styles.icon}>⚠️</div>

        <div className={styles.content}>
          <h3 className={styles.title}>Configuration Changed</h3>
          <p className={styles.message}>
            {configChange.changedBy} updated {configChange.changedFields?.length || 1} field(s)
            {changeTimestamp && (
              <span className={styles.timestamp}>
                at {format(changeTimestamp, 'HH:mm:ss')}
              </span>
            )}
          </p>

          {configChange.changeReason && (
            <p className={styles.reason}>
              Reason: {configChange.changeReason}
            </p>
          )}

          {configChange.changedFields && (
            <div className={styles.changedFields}>
              <span className={styles.fieldsLabel}>Changed fields:</span>
              <div className={styles.fieldTags}>
                {configChange.changedFields.map((field: string) => (
                  <span key={field} className={styles.fieldTag}>
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                setIsVisible(false);
              }}
              className={styles.refreshButton}
            >
              🔄 Refresh
            </button>
          )}

          <button
            onClick={() => {
              setIsVisible(false);
              setDismissed(true);
            }}
            className={styles.closeButton}
          >
            ✕
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
