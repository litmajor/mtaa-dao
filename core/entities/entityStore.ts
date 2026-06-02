import create from 'zustand';

interface EntityState {
  byType: Record<string, Record<string, any>>;
  upsert: (type: string, id: string, data: any) => void;
  get: (type: string, id: string) => any;
  list: (type: string) => any[];
}

export const useEntityStore = create<EntityState>((set, get) => ({
  byType: {},
  upsert: (type, id, data) =>
    set((s) => ({ byType: { ...s.byType, [type]: { ...(s.byType[type] || {}), [id]: { ...(s.byType[type]?.[id] || {}), ...data } } } })),
  get: (type, id) => (get().byType[type] || {})[id],
  list: (type) => Object.values(get().byType[type] || {}),
}));

export default useEntityStore;
