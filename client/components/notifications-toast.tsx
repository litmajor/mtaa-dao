'use client';

import React, { useEffect, useState } from 'react';
import styles from './notifications-toast.module.css';
import { useRealtimeNotifications } from '@/hooks/useWebSocket';

interface Toast {
  id: string;
  type: 'alert' | 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  closedAt?: Date;
}

/**
 * Real-time Notifications Toast
 * Displays WebSocket notifications as toasts
 */
export default function NotificationsToast() {
  const { notifications } = useRealtimeNotifications();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];

      const toast: Toast = {
        id: `${Date.now()}-${Math.random()}`,
        type: latestNotification.severity === 'critical' ? 'error' : latestNotification.severity || 'info',
        title: latestNotification.message?.split('\n')[0] || 'Notification',
        message: latestNotification.message || '',
        timestamp: new Date(latestNotification.timestamp),
        autoClose: true
      };

      setToasts(prev => [toast, ...prev].slice(0, 5)); // Keep max 5 toasts

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        closeToast(toast.id);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const closeToast = (id: string) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, closedAt: new Date() } : t
    ));

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]} ${toast.closedAt ? styles.closing : ''}`}
        >
          <div className={styles.toastContent}>
            <span className={styles.icon}>
              {toast.type === 'error' && '❌'}
              {toast.type === 'warning' && '⚠️'}
              {toast.type === 'success' && '✅'}
              {toast.type === 'alert' && '🔔'}
              {toast.type === 'info' && 'ℹ️'}
            </span>
            <div className={styles.textContent}>
              <span className={styles.title}>{toast.title}</span>
              {toast.message && (
                <span className={styles.message}>{toast.message}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => closeToast(toast.id)}
            className={styles.closeButton}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
