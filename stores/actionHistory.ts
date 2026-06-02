import create from 'zustand';

export interface Action {
  id: string;
  timestamp: string;
  type: string;
  details: any;
}

interface ActionHistoryState {
  actionHistory: Action[];
  pushAction: (action: Action) => void;
  clearHistory: () => void;
}

export const useActionHistoryStore = create<ActionHistoryState>((set) => ({
  actionHistory: [],
  pushAction: (action: Action) =>
    set((state) => ({ actionHistory: [action, ...state.actionHistory] })),
  clearHistory: () => set({ actionHistory: [] }),
}));

export default useActionHistoryStore;
