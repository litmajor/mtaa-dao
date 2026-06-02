import React from 'react';

interface Props {
  children?: React.ReactNode;
}

export const PanelBody: React.FC<Props> = ({ children }) => (
  <div className="panel-body">{children}</div>
);

export default PanelBody;
