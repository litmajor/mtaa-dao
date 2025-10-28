import { useContext } from "react";
import { ToastContext } from "../components/ui/ToastProvider";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  duration?: number;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    // Provide a fallback instead of throwing
    return {
      toast: (messageOrOptions: string | ToastOptions, type?: 'success' | 'error' | 'info') => {
        if (typeof messageOrOptions === 'string') {
          console.warn('[Toast] ToastProvider not found, logging:', messageOrOptions, type);
        } else {
          console.warn('[Toast] ToastProvider not found, logging:', messageOrOptions.title || messageOrOptions.description);
        }
      }
    };
  }

  // Adapt the context's toast function to support both signatures
  return {
    toast: (messageOrOptions: string | ToastOptions, type?: 'success' | 'error' | 'info') => {
      if (typeof messageOrOptions === 'string') {
        context.toast(messageOrOptions, type);
      } else {
        // Convert ToastOptions to simple message
        const message = messageOrOptions.title || messageOrOptions.description || 'Notification';
        const toastType = messageOrOptions.variant === 'destructive' ? 'error' : 
                         messageOrOptions.variant === 'success' ? 'success' : 'info';
        context.toast(message, toastType);
      }
    }
  };
}

export function toast(message: string, type?: 'success' | 'error' | 'info'): void;
export function toast(options: ToastOptions): void;
export function toast(messageOrOptions: string | ToastOptions, type?: 'success' | 'error' | 'info'): void {
  // Implementation handled by ToastProvider
  if (typeof messageOrOptions === 'string') {
    console.log('Toast:', messageOrOptions, type);
  } else {
    console.log('Toast:', messageOrOptions);
  }
}

// Default export for compatibility
export default toast;