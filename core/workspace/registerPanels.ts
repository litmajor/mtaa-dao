import React from 'react';
import { registerPanel } from './panelRegistry';

// Register panels as lazy-loaded components to enable code-splitting
// and avoid bundling these large pages into the main chunk.
const Dashboard = React.lazy(() => import('../../client/src/pages/dashboard'));
const TradingPage = React.lazy(() => import('../../client/src/pages/trading'));
const TradingPanel = React.lazy(() => import('../../modules/trading/TradingPanel'));
const DaosPage = React.lazy(() => import('../../client/src/pages/daos'));
const DaoTreasuryPage = React.lazy(() => import('../../client/src/pages/dao/[id]/treasury'));
const ProposalsPage = React.lazy(() => import('../../client/src/pages/proposals'));
const WalletPage = React.lazy(() => import('../../client/src/pages/wallet'));
const TreasuryIntelligence = React.lazy(() => import('../../client/src/pages/TreasuryIntelligence'));
const RevenueDashboard = React.lazy(() => import('../../client/src/pages/RevenueDashboard'));
const VaultDashboard = React.lazy(() => import('../../client/src/pages/vault-dashboard'));

export function registerCorePanels() {
  registerPanel('dashboard', Dashboard as any);
  registerPanel('trading.page', TradingPage as any);
  registerPanel('trading.panel', TradingPanel as any);
  registerPanel('daos', DaosPage as any);
  registerPanel('dao.treasury', DaoTreasuryPage as any);
  registerPanel('proposals', ProposalsPage as any);
  registerPanel('wallet', WalletPage as any);
  registerPanel('treasury.intel', TreasuryIntelligence as any);
  registerPanel('revenue.dashboard', RevenueDashboard as any);
  registerPanel('vault.dashboard', VaultDashboard as any);
}

// Auto-register on import for convenience (can be opted out by callers).
try {
  registerCorePanels();
} catch (e) {
  // ignore at runtime if imports fail in non-browser contexts
}

export default registerCorePanels;
