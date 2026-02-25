/**
 * Morio Notification Toast Component
 * 
 * Displays notifications in a toast format
 */

import { useEffect, useState } from 'react';
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';
import type { MorioNotification } from '@/hooks/useMorioNotifications';

interface NotificationToastProps {
  notification: MorioNotification;
  onDismiss: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function NotificationToast({
  notification,
  onDismiss,
  autoClose = true,
  duration = 5000
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoClose) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [autoClose, duration, onDismiss]);

  if (!isVisible) return null;

  // Determine icon and colors based on priority
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-200 dark:border-red-700',
          text: 'text-red-900 dark:text-red-200',
          icon: <AlertCircle className="w-5 h-5 text-red-500" />
        };
      case 'medium':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-700',
          text: 'text-blue-900 dark:text-blue-200',
          icon: <Info className="w-5 h-5 text-blue-500" />
        };
      default:
        return {
          bg: 'bg-green-50 dark:bg-green-900/30',
          border: 'border-green-200 dark:border-green-700',
          text: 'text-green-900 dark:text-green-200',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />
        };
    }
  };

  const styles = getPriorityStyles(notification.priority);

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} ${styles.text}
        border rounded-lg p-4 shadow-lg flex items-start gap-3
        animate-in fade-in slide-in-from-top-2 duration-200
      `}
    >
      <div className="flex-shrink-0">{styles.icon}</div>

      <div className="flex-1">
        <h3 className="font-semibold text-sm">{notification.title}</h3>
        <p className="text-sm mt-1 opacity-90">{notification.message}</p>
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: MorioNotification[];
  onDismiss: (index: number) => void;
}

/**
 * Container for displaying multiple notification toasts
 */
export function NotificationContainer({
  notifications,
  onDismiss
}: NotificationContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2 pointer-events-auto">
      {notifications.map((notification, index) => (
        <NotificationToast
          key={`${notification.type}_${notification.timestamp}`}
          notification={notification}
          onDismiss={() => onDismiss(index)}
          autoClose={true}
          duration={5000}
        />
      ))}
    </div>
  );
}
