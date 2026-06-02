import useWorkspaceStore from './workspaceStore';
import { registerPanel, getPanel } from './panelRegistry';

export function useWorkspace() {
  const register = useWorkspaceStore((s) => s.registerPanel);
  const updatePanelState = useWorkspaceStore((s) => s.updatePanelState);
  const removePanel = useWorkspaceStore((s) => s.removePanel);
  const getPanelState = useWorkspaceStore((s) => s.getPanelState);

  function openPanel(id: string, opts: { title?: string; viewState?: any } = {}) {
    const comp = getPanel(id);
    // allow opening unregistered panels by registering minimal state
    register({ id, title: opts.title || id, viewState: opts.viewState });
    updatePanelState(id, { viewState: opts.viewState || {} });
    return getPanelState(id);
  }

  function closePanel(id: string) {
    removePanel(id);
  }

  function focusPanel(id: string) {
    // For now, bring to front by setting a timestamp in layout
    updatePanelState(id, { layout: { zIndex: Date.now() } });
  }

  function togglePanel(id: string) {
    const p = getPanelState(id);
    if (p) removePanel(id);
    else register({ id, title: id });
  }

  function listOpenPanels() {
    const s = (useWorkspaceStore.getState() as any).panels;
    return Object.keys(s || {});
  }

  return { openPanel, closePanel, focusPanel, togglePanel, listOpenPanels };
}

export default useWorkspace;
