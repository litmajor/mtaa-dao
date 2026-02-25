import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { CheckCircle, AlertTriangle, Loader2, XCircle, Info, Undo2, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "default" | "success" | "error" | "warning" | "info" | "loading";

interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  type?: ToastType;
  action?: React.ReactNode;
  undoCallback?: () => void;
  txHash?: string; // For block explorer links
}

export function useToast() {
  const toast = React.useCallback((options: ToastOptions) => {
    const {
      title = "",
      description = "",
      variant = "default",
      duration = 5000,
      type = "default",
      action,
      undoCallback,
      txHash,
    } = options;

    const icons: { [key in ToastType]: React.ReactNode } = {
      success: <CheckCircle className="text-green-500 w-5 h-5" />,
      error: <XCircle className="text-red-500 w-5 h-5" />,
      warning: <AlertTriangle className="text-yellow-500 w-5 h-5" />,
      info: <Info className="text-blue-500 w-5 h-5" />,
      loading: <Loader2 className="animate-spin w-5 h-5 text-muted" />,
      default: null,
    };

    const txLink = txHash ? (
      <a
        href={`https://explorer.celo.org/alfajores/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-500 hover:underline text-sm"
      >
        <LinkIcon className="w-4 h-4" />
        View on Explorer
      </a>
    ) : null;

    const undoAction = undoCallback ? (
      <button
        onClick={undoCallback}
        className="flex items-center gap-1 text-sm text-zinc-800 dark:text-white font-medium hover:underline"
      >
        <Undo2 className="w-4 h-4" />
        Undo
      </button>
    ) : null;

    sonnerToast.custom((t) => (
      <div
        className={cn(
          "w-full px-4 py-3 bg-white dark:bg-neutral-900 border rounded-xl shadow-md",
          variant === "destructive" ? "border-red-500" : "border-zinc-200 dark:border-neutral-800"
        )}
      >
        <div className="flex items-start gap-3">
          {type !== "default" && icons[type] && <div className="mt-1">{icons[type]}</div>}
          <div className="flex-1">
            <p className="font-semibold text-sm">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {txLink && <div className="mt-1">{txLink}</div>}
          </div>
        </div>
        {undoAction && <div className="mt-2">{undoAction}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    ), { duration });
  }, []);

  return { toast };
}

export default useToast;