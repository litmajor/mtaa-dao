import React from 'react';
import Panel from '../../core/panels/Panel';
import PanelHeader from '../../core/panels/PanelHeader';
import PanelBody from '../../core/panels/PanelBody';
import useWorkspaceStore from '../../core/workspace/workspaceStore';

interface Props {
  pair?: string;
  id?: string;
}

export const TradingPanel: React.FC<Props> = ({ pair = 'BTC/USDT', id = 'trading.btcusdt' }) => {
  const panel = useWorkspaceStore((s) => s.getPanelState(id)) || { viewState: { timeframe: '1h' } };
  const timeframe = panel.viewState?.timeframe ?? '1h';

  return (
    <Panel id={id} title={pair} persist>
      <PanelHeader title={`Trading — ${pair}`} />
      <PanelBody>
        <div>Timeframe: {timeframe}</div>
        <div>Placeholder for chart / order book / trades.</div>
      </PanelBody>
    </Panel>
  );
};

export default TradingPanel;
