import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { Icon } from './icon-design';
import { Button } from './button-design';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return {
    toast: (message: string, options?: Partial<Toast>) => {
      return context.addToast({
        message,
        type: 'info',
        duration: 4000,
        ...options,
      });
    },
    success: (message: string, options?: Partial<Toast>) => {
      return context.addToast({
        message,
        type: 'success',
        duration: 4000,
        ...options,
      });
    },
    error: (message: string, options?: Partial<Toast>) => {
      return context.addToast({
        message,
        type: 'error',
        duration: 6000,
        ...options,
      });
    },
    warning: (message: string, options?: Partial<Toast>) => {
      return context.addToast({
        message,
        type: 'warning',
        duration: 5000,
        ...options,
      });
    },
    info: (message: string, options?: Partial<Toast>) => {
      return context.addToast({
        message,
        type: 'info',
        duration: 4000,
        ...options,
      });
    },
    dismiss: context.removeToast,
  };
}

export interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const ToastProvider = ({ children, maxToasts = 3, position = 'top-right' }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { ...toast, id };

    setToasts(prev => {
      const updated = [...prev, newToast];
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    // Auto-dismiss if duration is set
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, dismissAll }}>
      {children}

      {/* Toast Container */}
      <div
        className={`fixed z-50 flex flex-col gap-3 pointer-events-none ${positionClasses[position]}`}
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const typeConfig = {
  info: {
    icon: 'info',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600',
  },
  success: {
    icon: 'check-circle',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600',
  },
  warning: {
    icon: 'alert-circle',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600',
  },
  error: {
    icon: 'x-circle',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    iconColor: 'text-red-600',
  },
};

export const ToastItem = React.forwardRef<HTMLDivElement, ToastItemProps>(
  ({ toast, onDismiss }, ref) => {
    const config = typeConfig[toast.type];
    const [isExiting, setIsExiting] = useState(false);

    const handleDismiss = () => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    };

    return (
      <div
        ref={ref}
        className={`${config.bgColor} ${config.borderColor} ${config.textColor} border rounded-lg shadow-lg p-4 pointer-events-auto transition-all duration-300 ${
          isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
        } max-w-sm`}
        role="status"
        aria-live="assertive"
      >
        <div className="flex gap-3">
          {/* Icon */}
          <Icon name={config.icon} size="md" className={`${config.iconColor} flex-shrink-0 mt-0.5`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {toast.title && <div className="font-semibold text-sm">{toast.title}</div>}
            <div className="text-sm">{toast.message}</div>
          </div>

          {/* Action / Close */}
          <div className="flex gap-2 flex-shrink-0">
            {toast.action && (
              <Button
                size="sm"
                variant="ghost"
                onClick={toast.action.onClick}
                className={`${config.textColor} hover:${config.bgColor}`}
              >
                {toast.action.label}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              aria-label="Dismiss notification"
              className={`${config.textColor} hover:${config.bgColor}`}
            >
              <Icon name="x" size="sm" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ToastItem.displayName = 'ToastItem';
