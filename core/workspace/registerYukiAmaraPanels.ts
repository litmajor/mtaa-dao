import React from 'react';
import { registerPanel } from './panelRegistry';

// Register Yuki/Amara panels lazily to avoid inflating the main bundle
const YukiPage = React.lazy(() => import('../../client/src/pages/YukiDashboard'));
const YukiComponent = React.lazy(() => import('../../client/src/components/trading/YukiDashboard'));
const AmaraDashboard = React.lazy(() =>
  import('../../client/src/components/dashboard/AmaraDashboard').then((mod: any) => ({
    default: mod.AmaraDashboard || mod.default || (() => null),
  })) as any
);
const VisualStrategyBuilder = React.lazy(() => import('../../client/src/components/trading/VisualStrategyBuilder'));
const StrategyMarketplace = React.lazy(() => import('../../client/src/components/trading/StrategyMarketplace'));
const CexManager = React.lazy(() => import('../../client/src/components/trading/CexManager'));
const StakingComponent = React.lazy(() => import('../../client/src/components/staking/StakingComponent'));
const ExchangeMarkets = React.lazy(() => import('../../client/src/pages/ExchangeMarkets'));
const DeFiDEXAnalytics = React.lazy(() => import('../../client/src/pages/DeFiDEXAnalytics'));
const VaultListPage = React.lazy(() => import('../../client/src/components/vaults/VaultListPage'));

export function registerYukiAmaraPanels() {
  registerPanel('yuki.page', YukiPage as any);
  registerPanel('yuki.dashboard', YukiComponent as any);
  registerPanel('amara.dashboard', AmaraDashboard as any);
  registerPanel('yuki.strategy.builder', VisualStrategyBuilder as any);
  registerPanel('yuki.strategy.marketplace', StrategyMarketplace as any);
  registerPanel('yuki.cex.manager', CexManager as any);
  registerPanel('yuki.staking', StakingComponent as any);
  registerPanel('yuki.exchanges', ExchangeMarkets as any);
  registerPanel('yuki.dex.analytics', DeFiDEXAnalytics as any);
  registerPanel('yuki.vaults.list', VaultListPage as any);
}

try {
  registerYukiAmaraPanels();
} catch (e) {
  // ignore errors when importing in server contexts
}

export default registerYukiAmaraPanels;
