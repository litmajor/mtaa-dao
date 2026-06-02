import create from 'zustand';

export type SystemMode = 'focus' | 'analysis' | 'execution' | 'network' | 'treasury';
export type Density = 'compact' | 'comfortable' | 'expanded';

export interface SystemState {
  mode: SystemMode;
  density: Density;
  theme: 'dark' | 'light' | 'cybernetic';
  realtime: boolean;
  workspaceLocked: boolean;

  setMode: (m: SystemMode) => void;
  setDensity: (d: Density) => void;
  setTheme: (t: 'dark' | 'light' | 'cybernetic') => void;
  toggleRealtime: () => void;
  setWorkspaceLocked: (locked: boolean) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  mode: 'analysis',
  density: 'comfortable',
  theme: 'dark',
  realtime: true,
  workspaceLocked: false,

  setMode: (m) => set({ mode: m }),
  setDensity: (d) => set({ density: d }),
  setTheme: (t) => set({ theme: t }),
  toggleRealtime: () => set((s) => ({ realtime: !s.realtime })),
  setWorkspaceLocked: (locked) => set({ workspaceLocked: locked }),
}));

export default useSystemStore;
