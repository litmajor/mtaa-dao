
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

  const { toast, dismiss, toasts } = context;

  const toast = (options: ToastOptions) => {
    return addToast(options);
  };

  // Convenience methods
  toast.success = (title: string, description?: string) => {
    return addToast({ title, description, variant: "success" });
  };

  toast.error = (title: string, description?: string) => {
    return addToast({ title, description, variant: "destructive" });
  };

  toast.warning = (title: string, description?: string) => {
    return addToast({ title, description, variant: "warning" });
  };

  toast.info = (title: string, description?: string) => {
    return addToast({ title, description, variant: "default" });
  };

  return {
    toast,
    toasts,
    dismiss: removeToast,
  };
}
