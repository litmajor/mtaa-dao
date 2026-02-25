/**
 * NFTMintingPanel.tsx
 * NFT Operations - NFT Minting
 * 
 * Wires: NFT_MINTING simulator (Tier 3)
 * Status: Production-ready
 */

import React, { useState } from 'react';
import SimulationResultModal from '../SimulationResultModal';
import { useSimulationPreview } from '../../hooks/useSimulationPreview';

interface NFTMintingPanelProps {
  userId: string;
  onSimulationComplete?: (result: any) => void;
}

export const NFTMintingPanel: React.FC<NFTMintingPanelProps> = ({
  userId,
  onSimulationComplete,
}) => {
  const [collectionSize, setCollectionSize] = useState<string>('100');
  const [gasprice, setGasprice] = useState<string>('50');
  const [basePrice, setBasePrice] = useState<string>('10');
  const [rarity, setRarity] = useState<string>('standard');

  const { simulationResult, isLoading, isModalOpen, error, runSimulation, closeModal } =
    useSimulationPreview({
      onSuccess: (result: any) => onSimulationComplete?.(result),
    });

  const handlePreviewMinting = async (e: React.FormEvent) => {
    e.preventDefault();

    await runSimulation(
      'NFT_MINTING',
      {
        userId,
        collectionSize: Number(collectionSize),
        gasPrice: Number(gasprice),
        basePrice: Number(basePrice),
        rarityDistribution: rarity,
      },
      userId
    );
  };

  const handleExecuteMinting = async () => {
    console.log('Executing NFT minting:', {
      collectionSize,
      gasprice,
      basePrice,
      rarity,
    });
    closeModal();
  };

  return (
    <div className="panel nft-minting-panel">
      <div className="panel-header">
        <h3>NFT Minting</h3>
        <p className="subtitle">Prepare and cost NFT collection minting</p>
      </div>

      <form onSubmit={handlePreviewMinting}>
        <div className="form-group">
          <label htmlFor="collectionSize">Collection Size (number of NFTs)</label>
          <input
            id="collectionSize"
            type="number"
            value={collectionSize}
            onChange={(e) => setCollectionSize(e.target.value)}
            min="1"
            max="10000"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="gasprice">Gas Price (Gwei)</label>
          <input
            id="gasprice"
            type="number"
            value={gasprice}
            onChange={(e) => setGasprice(e.target.value)}
            min="1"
            max="500"
            step="1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="basePrice">Base Price per NFT (ETH)</label>
          <input
            id="basePrice"
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            min="0.01"
            step="0.1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rarity">Rarity Distribution</label>
          <select
            id="rarity"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            required
          >
            <option value="standard">Standard (Even distribution)</option>
            <option value="skewed">Skewed (Few rare, many common)</option>
            <option value="tiered">Tiered (Clear rarity tiers)</option>
          </select>
        </div>

        <button type="submit" className="btn-preview" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Preview Minting Cost'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      <SimulationResultModal
        result={simulationResult}
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleExecuteMinting}
        title="NFT Minting Analysis"
      />
    </div>
  );
};

export default NFTMintingPanel;
