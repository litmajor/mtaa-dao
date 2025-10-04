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
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}

export function toast(message: string, type?: 'success' | 'error' | 'info'): void;
export function toast(options: ToastOptions): void;
export function toast(messageOrOptions: string | ToastOptions, type?: 'success' | 'error' | 'info'): void {
  // Implementation handled by ToastProvider
  console.log('Toast:', messageOrOptions, type);
}