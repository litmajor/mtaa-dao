import create from 'zustand';

type ViewState = Record<string, any>;

interface ViewStateStore {
  views: Record<string, ViewState>;
  setViewState: (id: string, state: ViewState) => void;
  patchViewState: (id: string, patch: Partial<ViewState>) => void;
  getViewState: (id: string) => ViewState | undefined;
}

export const useViewStateStore = create<ViewStateStore>((set, get) => ({
  views: {},
  setViewState: (id, state) => set((s) => ({ views: { ...s.views, [id]: state } })),
  patchViewState: (id, patch) => set((s) => ({ views: { ...s.views, [id]: { ...(s.views[id] || {}), ...patch } } })),
  getViewState: (id) => get().views[id],
}));

export default useViewStateStore;
