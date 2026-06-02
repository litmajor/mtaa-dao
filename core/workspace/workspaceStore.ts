import create from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelViewState = Record<string, any>;

export interface PanelState {
  id: string;
  title?: string;
  layout?: any;
  viewState?: PanelViewState;
  pinned?: boolean;
  floating?: boolean;
}

interface WorkspaceState {
  panels: Record<string, PanelState>;
  registerPanel: (p: PanelState) => void;
  updatePanelState: (id: string, patch: Partial<PanelState>) => void;
  removePanel: (id: string) => void;
  getPanelState: (id: string) => PanelState | undefined;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      panels: {},
      registerPanel: (p) =>
        set((s) => ({ panels: { ...s.panels, [p.id]: { ...(s.panels[p.id] || {}), ...p } } })),
      updatePanelState: (id, patch) =>
        set((s) => ({ panels: { ...s.panels, [id]: { ...(s.panels[id] || { id }), ...patch } } })),
      removePanel: (id) => set((s) => {
        const next = { ...s.panels };
        delete next[id];
        return { panels: next };
      }),
      getPanelState: (id) => get().panels[id],
    }),
    {
      name: 'workspace-store-v1',
      getStorage: () => (typeof window !== 'undefined' ? window.localStorage : ({} as Storage)),
    }
  )
);

export default useWorkspaceStore;
