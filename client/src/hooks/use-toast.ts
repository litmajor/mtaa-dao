/**
 * use-toast — unified toast hook backed by Sonner.
 *
 * All callers that previously relied on the custom ToastProvider context or
 * the stub `toast()` function now use Sonner, which is already mounted in
 * App.tsx as <Toaster richColors position="top-right" />.
 *
 * Supported call signatures (backward-compatible):
 *   useToast().toast("message")
 *   useToast().toast("message", "success" | "error" | "info")
 *   useToast().toast({ title, description, variant, duration })
 *   toast("message")
 *   toast({ title, description, variant })
 */
import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

function fireToast(messageOrOptions: string | ToastOptions, type?: ToastType): void {
  if (typeof messageOrOptions === 'string') {
    const fn = type === 'error' ? sonnerToast.error
              : type === 'success' ? sonnerToast.success
              : type === 'warning' ? sonnerToast.warning
              : sonnerToast;
    fn(messageOrOptions);
  } else {
    const { title, description, variant, duration } = messageOrOptions;
    const resolvedType: ToastType =
      variant === 'destructive' ? 'error'
      : variant === 'success' ? 'success'
      : variant === 'warning' ? 'warning'
      : 'info';
    const fn = resolvedType === 'error' ? sonnerToast.error
              : resolvedType === 'success' ? sonnerToast.success
              : resolvedType === 'warning' ? sonnerToast.warning
              : sonnerToast;
    fn(title ?? description ?? 'Notification', {
      description: title ? description : undefined,
      duration,
    });
  }
}

/** React hook — drop-in replacement for the old context-based useToast(). */
export function useToast() {
  return {
    toast: (messageOrOptions: string | ToastOptions, type?: ToastType) =>
      fireToast(messageOrOptions, type),
  };
}

/** Standalone function — drop-in replacement for the old stub toast(). */
export function toast(message: string, type?: ToastType): void;
export function toast(options: ToastOptions): void;
export function toast(messageOrOptions: string | ToastOptions, type?: ToastType): void {
  fireToast(messageOrOptions, type);
}

export default toast;