import React from 'react';

const PANEL_REGISTRY = new Map<string, React.ComponentType<any>>();

export function registerPanel(id: string, component: React.ComponentType<any>) {
  PANEL_REGISTRY.set(id, component);
}

export function getPanel(id: string) {
  return PANEL_REGISTRY.get(id);
}

export function listPanels() {
  return Array.from(PANEL_REGISTRY.keys());
}

export default { registerPanel, getPanel, listPanels };
