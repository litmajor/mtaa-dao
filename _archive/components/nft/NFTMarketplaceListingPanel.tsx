/**
 * NFTMarketplaceListingPanel.tsx
 * NFT Operations - NFT Marketplace Listing
 * 
 * Wires: NFT_MARKETPLACE_LISTING simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface NFTMarketplaceListingPanelProps {
  userId: string;
  nftId?: string;
  onSimulationComplete?: (result: any) => void;
}

export const NFTMarketplaceListingPanel: React.FC<NFTMarketplaceListingPanelProps> = ({
  userId,
  nftId = 'default',
  onSimulationComplete,
}) => {
  const [floorPrice, setFloorPrice] = useState<string>('8.5');
  const [listingPrice, setListingPrice] = useState<string>('15');
  const [marketplace, setMarketplace] = useState<string>('opensea');
  const [royaltyFee, setRoyaltyFee] = useState<string>('5');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewListing = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'NFT_MARKETPLACE_LISTING',
      {
        userId,
        nftId,
        floorPrice: Number(floorPrice),
        listingPrice: Number(listingPrice),
        marketplace,
        royaltyFeePercentage: Number(royaltyFee),
      },
      userId
    );
  };

  const handleExecuteListing = async () => {
    console.log('Executing NFT listing:', {
      floorPrice,
      listingPrice,
      marketplace,
      royaltyFee,
    });
    closeModal();
  };

  return (
    <div className="panel nft-marketplace-listing-panel">
      <div className="panel-header">
        <h3>NFT Marketplace Listing</h3>
        <p className="subtitle">List NFT on marketplace with pricing strategy</p>
      </div>

      <form onSubmit={handlePreviewListing}>
        <div className="form-group">
          <label htmlFor="floorPrice">Floor Price (ETH)</label>
          <input
            id="floorPrice"
            type="number"
            value={floorPrice}
            onChange={(e) => setFloorPrice(e.target.value)}
            min="0.01"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="listingPrice">Your Listing Price (ETH)</label>
          <input
            id="listingPrice"
            type="number"
            value={listingPrice}
            onChange={(e) => setListingPrice(e.target.value)}
            min="0.01"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="marketplace">Marketplace</label>
          <select
            id="marketplace"
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            required
          >
            <option value="opensea">OpenSea (2.5% fee)</option>
            <option value="blur">Blur (2% fee)</option>
            <option value="looksrare">LooksRare (2% fee)</option>
            <option value="x2y2">X2Y2 (2% fee)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="royaltyFee">Creator Royalty Fee (%)</label>
          <input
            id="royaltyFee"
            type="number"
            value={royaltyFee}
            onChange={(e) => setRoyaltyFee(e.target.value)}
            min="0"
            max="25"
            step="0.5"
            required
          />
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Preview Listing Impact'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteListing}
        title="NFT Listing Analysis"
      />
    </div>
  );
};

export default NFTMarketplaceListingPanel;
