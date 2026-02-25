import { create } from "zustand";

type ToastPayload = {
  title?: string;
  description?: string;
  type?: "default" | "success" | "error" | "warning" | "info" | "loading";
  variant?: "default" | "destructive";
  txHash?: string;
  undoCallback?: () => void;
};

interface ToastStore {
  fire: (payload: ToastPayload) => void;
  listeners: ((payload: ToastPayload) => void)[];
  subscribe: (cb: (payload: ToastPayload) => void) => () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  fire: (payload) => {
    get().listeners.forEach((listener) => listener(payload));
  },
  listeners: [],
  subscribe: (cb) => {
    set((state) => ({
      listeners: [...state.listeners, cb],
    }));
    return () => {
      set((state) => ({
        listeners: state.listeners.filter((l) => l !== cb),
      }));
    };
  },
}));
