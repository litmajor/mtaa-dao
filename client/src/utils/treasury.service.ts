/**
 * Treasury Service
 * Core business logic for treasury validation, asset management,
 * voting weight calculation, and multisig enforcement
 */

import {
  DAOTreasury,
  TreasuryAsset,
  DAOType,
  TreasuryValidationRequest,
  TreasuryValidationResponse,
  ChainType,
  VotingWeightMapping,
  OraclePriceData
} from '@/types/treasury';

import {
  getTreasuryConfigForDAOType,
  isMultisigRequiredForDAOType,
  getSupportedAssetsForDAOType,
  getMultisigSettingsForDAOType,
  areCustomTokensAllowedForDAOType,
  getVotingWeightMapping,
  TREASURY_MATRIX
} from '@/config/treasury.config';

/**
 * Create a default treasury for a DAO type
 */
export const createDefaultTreasury = (
  daoId: string,
  daoType: DAOType,
  customAssets?: TreasuryAsset[]
): DAOTreasury => {
  const config = getTreasuryConfigForDAOType(daoType);
  const defaultAssets = customAssets && customAssets.length > 0 ? customAssets : config.supportedAssets;

  return {
    daoId,
    daoType,
    assets: defaultAssets.map(asset => ({ ...asset, balance: '0' })),
    multisigRequired: config.multisigRequired,
    minSigners: config.minSigners,
    maxSigners: config.maxSigners,
    membersCanDeposit: config.features.membersCanDeposit,
    customTokenAllowed: config.features.customTokenAllowed,
    emergencyWithdrawAllowed: config.features.emergencyWithdrawAllowed || false,
    totalValueUSD: '0',
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Validate a treasury configuration against DAO type rules
 */
export const validateTreasuryConfiguration = (
  request: TreasuryValidationRequest
): TreasuryValidationResponse => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const config = getTreasuryConfigForDAOType(request.daoType);

  // Validate assets
  if (!request.selectedAssets || request.selectedAssets.length === 0) {
    errors.push(`At least one asset must be selected for ${request.daoType} DAO`);
  } else {
    // Check if selected assets are supported
    for (const asset of request.selectedAssets) {
      const supportedAsset = config.supportedAssets.find(
        a => a.symbol === asset.symbol && a.chain === asset.chain
      );

      if (!supportedAsset) {
        errors.push(`Asset ${asset.symbol} on ${asset.chain} is not supported for ${request.daoType} DAO`);
      }
    }

    // Warn about single asset (multi-asset better for risk)
    if (request.selectedAssets.length === 1) {
      warnings.push(
        'Single-asset treasury has higher risk. Consider adding a second asset for diversification.'
      );
    }
  }

  // Validate multisig configuration
  if (config.multisigRequired && !request.multisigEnabled) {
    errors.push(`Multisig is required for ${request.daoType} DAO`);
  }

  if (request.multisigEnabled && config.multisigRequired) {
    if (!request.multisigSigners || request.multisigSigners.length < config.minSigners) {
      errors.push(
        `At least ${config.minSigners} signers required for multisig on ${request.daoType} DAO`
      );
    }

    if (request.multisigSigners && request.multisigSigners.length > config.maxSigners) {
      errors.push(
        `Maximum ${config.maxSigners} signers allowed for ${request.daoType} DAO`
      );
    }

    if (
      request.multisigRequiredSignatures &&
      request.multisigSigners &&
      request.multisigRequiredSignatures > request.multisigSigners.length
    ) {
      errors.push('Required signatures cannot exceed total signers');
    }

    if (request.multisigRequiredSignatures && request.multisigRequiredSignatures < 2) {
      warnings.push('Recommended minimum 2 required signatures for security');
    }
  }

  // Validate custom tokens
  if (request.selectedAssets.some(a => a.tokenType === 'custom-erc20')) {
    if (!config.features.customTokenAllowed) {
      errors.push(`Custom tokens are not allowed for ${request.daoType} DAO`);
    }

    // Check that custom tokens have valid addresses
    for (const asset of request.selectedAssets) {
      if (asset.tokenType === 'custom-erc20' && !asset.tokenAddress) {
        errors.push(`Custom token ${asset.symbol} must have a valid contract address`);
      }
    }
  }

  // Recommendations
  if (request.daoType === 'collective' || request.daoType === 'governance') {
    if (request.selectedAssets.length < 2) {
      recommendations.push('Consider dual-asset treasury (CELO + cUSD) for mixed communities');
    }
  }

  if (config.features.multiChainSupport && request.selectedAssets.length === 1) {
    recommendations.push('This DAO supports multi-chain assets. Consider adding assets on other chains.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
};

/**
 * Add a custom token to a treasury
 */
export const addCustomTokenToTreasury = (
  treasury: DAOTreasury,
  token: TreasuryAsset
): { success: boolean; message: string; updatedTreasury?: DAOTreasury } => {
  // Check if custom tokens are allowed
  if (!treasury.customTokenAllowed) {
    return {
      success: false,
      message: `Custom tokens are not allowed for ${treasury.daoType} DAO`
    };
  }

  // Validate token address
  if (!token.tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(token.tokenAddress)) {
    return {
      success: false,
      message: 'Invalid ERC-20 contract address'
    };
  }

  // Check for duplicates
  if (treasury.assets.some(a => a.tokenAddress === token.tokenAddress && a.chain === token.chain)) {
    return {
      success: false,
      message: `Token ${token.symbol} is already in this treasury`
    };
  }

  const updatedTreasury = {
    ...treasury,
    assets: [...treasury.assets, { ...token, balance: '0', isActive: true }],
    lastUpdated: new Date().toISOString()
  };

  return {
    success: true,
    message: `Successfully added ${token.symbol} to treasury`,
    updatedTreasury
  };
};

/**
 * Remove an asset from treasury
 */
export const removeAssetFromTreasury = (
  treasury: DAOTreasury,
  assetSymbol: string,
  chain: ChainType
): { success: boolean; message: string; updatedTreasury?: DAOTreasury } => {
  // Check if at least one asset will remain
  const nonRemovedAssets = treasury.assets.filter(
    a => !(a.symbol === assetSymbol && a.chain === chain)
  );

  if (nonRemovedAssets.length === 0) {
    return {
      success: false,
      message: 'Cannot remove the last asset from treasury'
    };
  }

  const updatedTreasury = {
    ...treasury,
    assets: nonRemovedAssets,
    lastUpdated: new Date().toISOString()
  };

  return {
    success: true,
    message: `Successfully removed ${assetSymbol} from treasury`,
    updatedTreasury
  };
};

/**
 * Calculate total treasury value in USD (requires oracle data)
 */
export const calculateTreasuryValueUSD = (
  treasury: DAOTreasury,
  priceData: Record<string, OraclePriceData>
): string => {
  let totalUSD = 0;

  for (const asset of treasury.assets) {
    if (!asset.isActive) continue;

    const priceKey = `${asset.chain}-${asset.symbol}`;
    const price = priceData[priceKey];

    if (price) {
      const balance = parseFloat(asset.balance);
      const value = (balance / Math.pow(10, asset.decimals)) * price.priceUSD;
      totalUSD += value;
    }
  }

  return totalUSD.toFixed(2);
};

/**
 * Calculate voting weight for a member based on deposits/holdings
 */
export const calculateVotingWeight = (
  treasury: DAOTreasury,
  memberAddress: string,
  memberBalances: Record<string, string>, // asset key -> balance
  priceData?: Record<string, OraclePriceData>
): { weight: number; breakdown: Record<string, number> } => {
  const config = getTreasuryConfigForDAOType(treasury.daoType);
  const breakdown: Record<string, number> = {};

  // If voting is equal (1 person = 1 vote), return 1
  if (config.votingWeightSource.includes('equal')) {
    return { weight: 1, breakdown: { equal: 1 } };
  }

  let totalWeight = 0;

  for (const asset of treasury.assets) {
    if (!asset.isActive) continue;

    const assetKey = `${asset.chain}-${asset.symbol}`;
    const balance = memberBalances[assetKey] || '0';
    const balanceNum = parseFloat(balance) / Math.pow(10, asset.decimals);

    if (asset.votingWeightMapping === 'deposit' || asset.votingWeightMapping === 'tokenHolding') {
      // If we have price data, convert to USD for weighting
      if (priceData) {
        const price = priceData[assetKey];
        if (price) {
          const usdValue = balanceNum * price.priceUSD;
          breakdown[assetKey] = usdValue;
          totalWeight += usdValue;
        }
      } else {
        // Fallback: use raw balance
        breakdown[assetKey] = balanceNum;
        totalWeight += balanceNum;
      }
    }
  }

  return {
    weight: totalWeight || 0,
    breakdown
  };
};

/**
 * Check if a withdrawal requires multisig approval
 */
export const doesWithdrawalRequireMultisig = (
  treasury: DAOTreasury,
  withdrawalAmount: string // in asset decimals
): boolean => {
  // Check DAO type requirements
  if (treasury.multisigRequired) {
    return true;
  }

  // TODO: Add amount-based thresholds if needed
  // For example, withdrawals over a certain USD amount might require multisig

  return false;
};

/**
 * Get quorum requirement for a DAO type
 */
export const getQuorumRequirementForDAOType = (daoType: DAOType): number => {
  const quorumMap: Record<DAOType, number> = {
    free: 0, // No quorum required
    shortTerm: 0.2, // 20% quorum
    collective: 0.2, // 20% quorum
    governance: 0.3, // 30% quorum (higher for major decisions)
    meta: 0.4 // 40% quorum (stricter for network coordination)
  };
  return quorumMap[daoType];
};

/**
 * Get voting period (in days) for a DAO type
 */
export const getVotingPeriodForDAOType = (daoType: DAOType): number => {
  const periodMap: Record<DAOType, number> = {
    free: 1, // 1 day (24 hours)
    shortTerm: 3, // 3 days
    collective: 7, // 7 days (1 week)
    governance: 14, // 14 days (2 weeks)
    meta: 21 // 21 days (3 weeks for network coordination)
  };
  return periodMap[daoType];
};

/**
 * Get emergency withdrawal multiplier (if allowed)
 * Determines what % of treasury can be emergency withdrawn
 */
export const getEmergencyWithdrawalLimit = (daoType: DAOType): number => {
  const limitMap: Record<DAOType, number> = {
    free: 0.5, // 50%
    shortTerm: 0.3, // 30%
    collective: 0.1, // 10%
    governance: 0.05, // 5%
    meta: 0.01 // 1% (very restricted)
  };
  return limitMap[daoType];
};

/**
 * Validate if an asset transfer is allowed
 */
export const validateAssetTransfer = (
  treasury: DAOTreasury,
  from: string,
  to: string,
  assetSymbol: string,
  chain: ChainType,
  amount: string
): { allowed: boolean; reason: string } => {
  // Check if asset is in treasury
  const asset = treasury.assets.find(a => a.symbol === assetSymbol && a.chain === chain);
  if (!asset) {
    return { allowed: false, reason: `Asset ${assetSymbol} not found in treasury` };
  }

  if (!asset.isActive) {
    return { allowed: false, reason: `Asset ${assetSymbol} is currently disabled` };
  }

  // Check balance (simplified - real implementation would check actual balance)
  const transferAmount = parseFloat(amount);
  if (transferAmount <= 0) {
    return { allowed: false, reason: 'Transfer amount must be greater than 0' };
  }

  // Check minimum deposit amounts for deposits
  if (from === 'external' && asset.minDepositAmount) {
    const minDeposit = parseFloat(asset.minDepositAmount);
    if (transferAmount < minDeposit) {
      return { allowed: false, reason: `Minimum deposit is ${asset.minDepositAmount} ${assetSymbol}` };
    }
  }

  return { allowed: true, reason: 'Transfer is allowed' };
};

/**
 * Migrate treasury to support additional chains
 */
export const addChainSupportToTreasury = (
  treasury: DAOTreasury,
  newChain: ChainType
): { success: boolean; message: string; updatedTreasury?: DAOTreasury } => {
  const config = getTreasuryConfigForDAOType(treasury.daoType);

  // Check if the chain is already supported
  if (treasury.assets.some(a => a.chain === newChain)) {
    return {
      success: false,
      message: `${newChain} is already supported in this treasury`
    };
  }

  // Get default assets for the new chain from config
  const newChainAssets = config.supportedAssets.filter(a => a.chain === newChain);

  if (newChainAssets.length === 0) {
    return {
      success: false,
      message: `No default assets available for ${newChain} on ${treasury.daoType} DAO`
    };
  }

  const updatedTreasury = {
    ...treasury,
    assets: [
      ...treasury.assets,
      ...newChainAssets.map(asset => ({ ...asset, balance: '0' }))
    ],
    lastUpdated: new Date().toISOString()
  };

  return {
    success: true,
    message: `Successfully added ${newChain} support to treasury`,
    updatedTreasury
  };
};

/**
 * Get treasury summary for UI display
 */
export const getTreasurySummary = (
  treasury: DAOTreasury,
  priceData?: Record<string, OraclePriceData>
) => {
  const summary = {
    daoType: treasury.daoType,
    totalAssets: treasury.assets.filter(a => a.isActive).length,
    activeChains: Array.from(new Set(treasury.assets.filter(a => a.isActive).map(a => a.chain))),
    totalValueUSD: priceData ? calculateTreasuryValueUSD(treasury, priceData) : '0',
    multisigRequired: treasury.multisigRequired,
    minSigners: treasury.minSigners,
    emergencyWithdrawAllowed: treasury.emergencyWithdrawAllowed,
    assets: treasury.assets
      .filter(a => a.isActive)
      .map(asset => ({
        symbol: asset.symbol,
        chain: asset.chain,
        balance: asset.balance,
        votingWeight: asset.votingWeightMapping
      }))
  };

  return summary;
};
