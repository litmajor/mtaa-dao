/**
 * Minimal layout engine: save/load layouts and simple grid helpers.
 * This will be replaced/expanded with react-grid-layout or Golden Layout.
 */
export type SavedLayout = { name: string; layout: any; createdAt: number };

const LAYOUT_KEY = 'workspaces:layouts:v1';

export function saveLayout(name: string, layout: any) {
  const raw = localStorage.getItem(LAYOUT_KEY);
  const list: SavedLayout[] = raw ? JSON.parse(raw) : [];
  const next = list.filter((l) => l.name !== name).concat([{ name, layout, createdAt: Date.now() }]);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
}

export function loadLayout(name: string): any | null {
  const raw = localStorage.getItem(LAYOUT_KEY);
  if (!raw) return null;
  const list: SavedLayout[] = JSON.parse(raw);
  const found = list.find((l) => l.name === name);
  return found ? found.layout : null;
}

export function listLayouts(): SavedLayout[] {
  const raw = localStorage.getItem(LAYOUT_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function computeGridLayout(panels: any[]) {
  // naive grid: place panels in columns of 3
  return panels.map((p, i) => ({ i: p.id, x: (i % 3) * 4, y: Math.floor(i / 3) * 4, w: 4, h: 4 }));
}

export default { saveLayout, loadLayout, listLayouts, computeGridLayout };
