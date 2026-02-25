/**
 * NFTDashboard.tsx
 * NFT Operations Dashboard
 * 
 * Wires all 4 NFT simulators:
 * - NFT_MINTING
 * - NFT_MARKETPLACE_LISTING
 * - NFT_PURCHASE
 * - NFT_ROYALTY_TRACKING
 */

import React, { useState } from 'react';
import { NFTMintingPanel } from './NFTMintingPanel';
import { NFTMarketplaceListingPanel } from './NFTMarketplaceListingPanel';
import { NFTPurchasePanel } from './NFTPurchasePanel';
import { NFTRoyaltyTrackingPanel } from './NFTRoyaltyTrackingPanel';

interface NFTDashboardProps {
  userId: string;
  daoName?: string;
}

export const NFTDashboard: React.FC<NFTDashboardProps> = ({
  userId,
  daoName = 'My DAO',
}) => {
  const [activePanel, setActivePanel] = useState<'minting' | 'listing' | 'purchase' | 'royalty'>('minting');
  const [nftHistory, setNftHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // NFT state
  const [nftState] = useState({
    totalVolume: 2400000,
    totalCollections: 18,
    activeListings: 145,
    avgRoyaltyRate: 8.5,
  });

  const handleSimulationComplete = (result: any) => {
    const action = {
      id: `nft_action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: activePanel,
      details: result,
    };
    setNftHistory([action, ...nftHistory]);
  };

  return (
    <div className="nft-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{daoName} NFT Operations</h1>
          <p className="subtitle">Minting, marketplace listing, purchasing, and royalty management</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">Total Trading Volume</span>
            <span className="stat-value">
              ${nftState.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Collections</span>
            <span className="stat-value">{nftState.totalCollections}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Listings</span>
            <span className="stat-value">{nftState.activeListings}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Royalty Rate</span>
            <span className="stat-value">{nftState.avgRoyaltyRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Panel Selector */}
      <div className="panel-selector">
        <div className="selector-header">
          <h2>NFT Operations</h2>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'minting' ? 'active' : ''}`}
            onClick={() => setActivePanel('minting')}
          >
            <span className="tab-icon">✨</span>
            <span className="tab-label">Minting</span>
            <span className="tab-subtitle">Create new NFTs</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'listing' ? 'active' : ''}`}
            onClick={() => setActivePanel('listing')}
          >
            <span className="tab-icon">🏪</span>
            <span className="tab-label">Marketplace Listing</span>
            <span className="tab-subtitle">List for sale</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'purchase' ? 'active' : ''}`}
            onClick={() => setActivePanel('purchase')}
          >
            <span className="tab-icon">🛍️</span>
            <span className="tab-label">Purchase</span>
            <span className="tab-subtitle">Buy NFTs</span>
          </button>

          <button
            className={`panel-tab ${activePanel === 'royalty' ? 'active' : ''}`}
            onClick={() => setActivePanel('royalty')}
          >
            <span className="tab-icon">👑</span>
            <span className="tab-label">Royalty Tracking</span>
            <span className="tab-subtitle">Monitor earnings</span>
          </button>
        </div>
      </div>

      {/* Active Panel Content */}
      <div className="panels-container">
        {activePanel === 'minting' && (
          <div className="panel-wrapper">
            <NFTMintingPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'listing' && (
          <div className="panel-wrapper">
            <NFTMarketplaceListingPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'purchase' && (
          <div className="panel-wrapper">
            <NFTPurchasePanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}

        {activePanel === 'royalty' && (
          <div className="panel-wrapper">
            <NFTRoyaltyTrackingPanel
              userId={userId}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        )}
      </div>

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h2>NFT Activity History</h2>
          {nftHistory.length === 0 ? (
            <div className="empty-history">
              <p>No NFT operations yet. Start by selecting a tool above.</p>
            </div>
          ) : (
            <div className="history-list">
              {nftHistory.map((action) => (
                <div key={action.id} className="history-item">
                  <div className="history-icon">
                    {action.type === 'minting' && '✨'}
                    {action.type === 'listing' && '🏪'}
                    {action.type === 'purchase' && '🛍️'}
                    {action.type === 'royalty' && '👑'}
                  </div>
                  <div className="history-content">
                    <div className="history-type">
                      {action.type === 'minting' && 'NFT Minted'}
                      {action.type === 'listing' && 'Listing Created'}
                      {action.type === 'purchase' && 'NFT Purchased'}
                      {action.type === 'royalty' && 'Royalties Tracked'}
                    </div>
                    <div className="history-time">
                      {new Date(action.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>💡 NFT Management Tools</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>NFT Minting</h4>
            <p>Create new NFTs from your collection. Set metadata, define supply limits, apply royalty rates for secondary sales.</p>
          </div>
          <div className="info-card">
            <h4>Marketplace Listing</h4>
            <p>List NFTs for sale across major marketplaces. Optimize pricing strategy, set reserve prices, and manage auction timing.</p>
          </div>
          <div className="info-card">
            <h4>NFT Purchase</h4>
            <p>Buy NFTs from marketplace listings or auctions. Analyze floor prices, rarity scores, and verify authenticity.</p>
          </div>
          <div className="info-card">
            <h4>Royalty Tracking</h4>
            <p>Track royalty earnings across all secondary sales. Monitor payment streams, calculate cumulative returns on collections.</p>
          </div>
        </div>
      </div>

      {/* Collection Stats */}
      <div className="collection-stats">
        <h3>📊 Collection Performance</h3>
        <div className="stats-grid">
          <div className="stats-card">
            <span className="stat-icon">💎</span>
            <h4>Avg Floor Price</h4>
            <p>${(nftState.totalVolume / nftState.totalCollections / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} ETH</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">📈</span>
            <h4>Avg ROI (30d)</h4>
            <p>+24.5%</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">🔥</span>
            <h4>Trending Collections</h4>
            <p>5 of {nftState.totalCollections}</p>
          </div>
          <div className="stats-card">
            <span className="stat-icon">👥</span>
            <h4>Unique Holders</h4>
            <p>3,247</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTDashboard;
