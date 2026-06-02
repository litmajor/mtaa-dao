import React from 'react';

interface Props {
  title?: string;
  actions?: React.ReactNode;
}

export const PanelHeader: React.FC<Props> = ({ title, actions }) => (
  <header className="panel-header">
    <h3 className="panel-title">{title}</h3>
    <div className="panel-actions">{actions}</div>
  </header>
);

export default PanelHeader;
