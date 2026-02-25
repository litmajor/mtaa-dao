// frontend/src/components/dashboard/YukiDashboard.tsx
/**
 * Main Yuki Trading Dashboard
 * Scroll-based layout with 8 collapsible sections
 * Responsive across all device sizes with optional Pro mode sidebar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BalanceHeader from './BalanceHeader';
import OpportunitiesSection from './OpportunitiesSection';
import WatchlistSection from './WatchlistSection';
import CEXMarketsSection from './CEXMarketsSection';
import DEXSwapSection from './DEXSwapSection';
import StrategiesSection from './StrategiesSection';
import ChartsSection from './ChartsSection';
import PortfolioSection from './PortfolioSection';
import MarketplaceSection from './MarketplaceSection';
import MultiChainWithdrawalSection from './multichain/MultiChainWithdrawalSection';
import ProSidebar from './ProSidebar';
import CollapsibleSection from './CollapsibleSection';
import { useDashboardData } from '../../hooks/useDashboardData';

interface Section {
  id: string;
  title: string;
  icon: string;
  component: React.ComponentType<any>;
  expanded: boolean;
}

const YukiDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [proMode, setProMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('proMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    balance: true,
    opportunities: true,
    watchlist: false,
    cex: false,
    dex: false,
    strategies: false,
    charts: false,
    portfolio: false,
    marketplace: false,
    multichain: false,
  });

  const { data, isLoading, error } = useDashboardData();

  // Keyboard shortcuts (Ctrl+1-8)
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      const shortcuts: { [key: string]: string } = {
        '1': 'opportunities',
        '2': 'watchlist',
        '3': 'cex',
        '4': 'dex',
        '5': 'strategies',
        '6': 'charts',
        '7': 'portfolio',
        '8': 'marketplace',
        '9': 'multichain',
        'p': 'proMode',
        't': 'theme',
      };

      const action = shortcuts[e.key];
      if (action === 'proMode') {
        toggleProMode();
      } else if (action === 'theme') {
        toggleTheme();
      } else if (action) {
        scrollToSection(action);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Add highlight
      element.classList.add('highlight-glow');
      setTimeout(() => element.classList.remove('highlight-glow'), 2000);
    }
  };

  const toggleProMode = () => {
    const newProMode = !proMode;
    setProMode(newProMode);
    localStorage.setItem('proMode', JSON.stringify(newProMode));
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-dark-bg">
        <div className="text-center">
          <p className="text-lg text-red-500 mb-4">Failed to load dashboard</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-blue text-white rounded hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-light-bg dark:bg-dark-bg">
      {/* Pro Mode Sidebar (Desktop only) */}
      {proMode && <ProSidebar onJump={scrollToSection} />}

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto transition-all duration-300 ${
        proMode ? 'lg:ml-0' : ''
      }`}>
        {/* Balance Header (Sticky) */}
        <div className="sticky top-0 z-40 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-gray-700">
          <BalanceHeader data={data?.balance} isLoading={isLoading} />
        </div>

        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue" />
            </div>
          )}

          {!isLoading && (
            <>
              {/* Section 1: Opportunities (Always Visible) */}
              <div id="section-opportunities" className="mb-6">
                <OpportunitiesSection
                  opportunities={data?.opportunities || []}
                  onSelectOpportunity={(opp) => {
                    console.log('Selected:', opp);
                  }}
                />
              </div>

              {/* Section 2: Watchlist */}
              <CollapsibleSection
                id="watchlist"
                title="⭐ WATCHLIST"
                expanded={expandedSections.watchlist}
                onToggle={() => toggleSection('watchlist')}
              >
                <WatchlistSection
                  watchlist={data?.watchlist || []}
                  onAddToken={() => {}}
                  onTradeToken={(token) => navigate(`/trade/${token}`)}
                />
              </CollapsibleSection>

              {/* Section 3: CEX Markets */}
              <CollapsibleSection
                id="cex"
                title="🏦 CEX MARKETS"
                expanded={expandedSections.cex}
                onToggle={() => toggleSection('cex')}
              >
                <CEXMarketsSection
                  markets={data?.cexMarkets || []}
                  onSelectMarket={(market) => console.log(market)}
                />
              </CollapsibleSection>

              {/* Section 4: DEX Swaps */}
              <CollapsibleSection
                id="dex"
                title="🔄 DEX SWAPS"
                expanded={expandedSections.dex}
                onToggle={() => toggleSection('dex')}
              >
                <DEXSwapSection
                  pairs={data?.dexPairs || []}
                  onPreviewSwap={(swap) => console.log(swap)}
                />
              </CollapsibleSection>

              {/* Section 5: Strategies */}
              <CollapsibleSection
                id="strategies"
                title="🤖 STRATEGIES"
                expanded={expandedSections.strategies}
                onToggle={() => toggleSection('strategies')}
              >
                <StrategiesSection
                  strategies={data?.strategies || []}
                  onDeployStrategy={(strategy) => console.log(strategy)}
                />
              </CollapsibleSection>

              {/* Section 6: Charts */}
              <CollapsibleSection
                id="charts"
                title="📊 CHARTS"
                expanded={expandedSections.charts}
                onToggle={() => toggleSection('charts')}
              >
                <ChartsSection
                  selectedPair={data?.selectedPair || 'SOL/USDC'}
                  timeframe="5m"
                  onTimeframeChange={(tf) => console.log(tf)}
                />
              </CollapsibleSection>

              {/* Section 7: Portfolio */}
              <CollapsibleSection
                id="portfolio"
                title="💼 PORTFOLIO"
                expanded={expandedSections.portfolio}
                onToggle={() => toggleSection('portfolio')}
              >
                <PortfolioSection
                  holdings={data?.portfolio || []}
                  totalValue={data?.balance?.totalValue || 0}
                />
              </CollapsibleSection>

              {/* Section 8: Marketplace */}
              <CollapsibleSection
                id="marketplace"
                title="🏆 MARKETPLACE"
                expanded={expandedSections.marketplace}
                onToggle={() => toggleSection('marketplace')}
              >
                <MarketplaceSection
                  strategies={data?.marketplaceStrategies || []}
                  onCopyStrategy={(strategy) => console.log(strategy)}
                />
              </CollapsibleSection>

              {/* Section 9: Multi-Chain Withdrawals */}
              <CollapsibleSection
                id="multichain"
                title="🌉 MULTI-CHAIN WITHDRAWALS"
                expanded={expandedSections.multichain}
                onToggle={() => toggleSection('multichain')}
              >
                <MultiChainWithdrawalSection />
              </CollapsibleSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-dark-surface border-t border-gray-200 dark:border-gray-700 py-4 px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Yuki Trading Dashboard • Last updated: {new Date().toLocaleTimeString()}</p>
          {proMode && <p className="text-brand-blue">Pro Mode Enabled • Ctrl+P to toggle</p>}
        </div>
      </div>

      {/* Settings Panel (Modal) */}
      {proMode && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-dark-surface rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="font-semibold mb-3 dark:text-white">Pro Settings</h3>
          <div className="space-y-2 text-sm">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                onChange={toggleTheme}
                className="rounded"
              />
              <span className="ml-2 dark:text-gray-300">Dark Mode</span>
            </label>
            <button
              onClick={toggleProMode}
              className="w-full px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white text-sm"
            >
              Disable Pro Mode (Ctrl+P)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default YukiDashboard;
