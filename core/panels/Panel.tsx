import React, { ReactNode, useEffect } from 'react';
import useSystemStore from '../system/systemStore';
import useWorkspaceStore from '../workspace/workspaceStore';

interface PanelProps {
  id: string;
  title?: string;
  persist?: boolean;
  children?: ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ id, title, persist = true, children }) => {
  const density = useSystemStore((s) => s.density);
  const registerPanel = useWorkspaceStore((s) => s.registerPanel);

  useEffect(() => {
    registerPanel({ id, title });
  }, [id, title, registerPanel]);

  return (
    <section className={`panel panel--${density}`} data-panel-id={id}>
      <div className="panel-inner">{children}</div>
    </section>
  );
};

export default Panel;
