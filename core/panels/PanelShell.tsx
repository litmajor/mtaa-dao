import React, { ReactNode, useEffect } from 'react';
import Panel from './Panel';
import useWorkspaceStore from '../workspace/workspaceStore';
import useViewStateStore from '../views/viewStateStore';

interface PanelShellProps {
  id: string;
  title?: string;
  persist?: boolean;
  children?: ReactNode;
}

export const PanelShell: React.FC<PanelShellProps> = ({ id, title, persist = true, children }) => {
  const registerPanel = useWorkspaceStore((s) => s.registerPanel);
  const getViewState = useViewStateStore((s) => s.getViewState);

  useEffect(() => {
    // Register panel with minimal metadata so the workspace knows about it
    registerPanel({ id, title, persist });
  }, [id, title, persist, registerPanel]);

  // Provide children with the preserved view state via props (optional)
  const preservedViewState = getViewState(id) || undefined;

  return (
    <Panel id={id} title={title} persist={persist}>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, { preservedViewState })
        : children}
    </Panel>
  );
};

export default PanelShell;
