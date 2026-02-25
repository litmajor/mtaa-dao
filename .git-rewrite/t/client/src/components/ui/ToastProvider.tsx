import React, { createContext, useState, useCallback, ReactNode } from "react";

export type Toast = {
  id: number;
  message: string;
  type?: "success" | "error" | "info";
};

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type?: Toast["type"]) => {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), message, type }
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              marginBottom: 8,
              padding: "12px 24px",
              borderRadius: 6,
              background: t.type === "error" ? "#f87171" : t.type === "success" ? "#4ade80" : "#60a5fa",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontWeight: 500
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
