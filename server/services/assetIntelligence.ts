/**
 * Asset Intelligence Service
 * 
 * Enriches assets with educational content, metadata, and intelligence
 * Provides scoring, ranking, and insight generation
 * 
 * Key responsibilities:
 * - Generate educational summaries
 * - Link to external resources
 * - Calculate intelligence scores
 * - Provide asset insights
 * - Detect patterns and anomalies
 */

import { NormalizedAsset, AssetEducation, AssetCategory } from '../types/assetTypes';
import { logger } from '../utils/logger';

/**
 * Asset intelligence and education database
 * In production, this would be fetched from CoinGecko, Wikipedia, etc.
 */
const ASSET_INTELLIGENCE_DB: Record<string, AssetEducation> = {
  // Layer 1s
  BTC: {
    summary: 'Bitcoin is the first and largest cryptocurrency by market cap',
    useCase: 'Digital currency and store of value',
    blockchain: 'Bitcoin',
    founded: new Date('2009-01-03'),
    creator: 'Satoshi Nakamoto',
    governance: 'Decentralized consensus',
    security: 'Proof of Work with SHA-256',
    uniqueFeatures: ['First blockchain', 'Fixed supply of 21M', 'Longest chain history', 'Most secure network'],
    risks: ['Market volatility', 'Regulatory uncertainty', 'Energy consumption concerns'],
    relatedAssets: ['ETH', 'LTC', 'BCH'],
  },
  ETH: {
    summary: 'Ethereum is a decentralized platform for building smart contracts and dApps',
    useCase: 'Smart contract platform and DeFi backbone',
    blockchain: 'Ethereum',
    founded: new Date('2015-07-30'),
    creator: 'Vitalik Buterin',
    governance: 'Decentralized Autonomous Organization (DAO) principles',
    security: 'Proof of Stake (since 2022)',
    uniqueFeatures: ['Smart contracts', 'ERC-20 token standard', 'Layer 2 solutions', 'DeFi ecosystem leader'],
    risks: ['Smart contract vulnerabilities', 'Scalability challenges', 'Merge technical risks'],
    relatedAssets: ['MATIC', 'OP', 'ARB'],
  },

  // DeFi
  AAVE: {
    summary: 'Aave is a decentralized lending and borrowing protocol',
    useCase: 'Lending protocol for earning yield and collateralized borrowing',
    blockchain: 'Ethereum',
    founded: new Date('2018-01-01'),
    creator: 'Stani Kulechov',
    governance: 'AAVE token holders vote on protocol changes',
    security: 'Multiple audits and insurance mechanisms',
    uniqueFeatures: ['Flash loans', 'Variable/stable rates', 'Multiple blockchains', 'Governance token incentives'],
    risks: ['Smart contract risk', 'Liquidation risks', 'Oracle dependency'],
    relatedAssets: ['COMPOUND', 'MAKER', 'YEARN'],
  },

  UNI: {
    summary: 'Uniswap is the leading decentralized exchange (DEX)',
    useCase: 'Automated Market Maker (AMM) for token swaps',
    blockchain: 'Ethereum',
    founded: new Date('2018-09-01'),
    creator: 'Hayden Adams',
    governance: 'UNI token governance',
    security: 'Time-tested AMM mechanism',
    uniqueFeatures: ['V3 concentrated liquidity', 'Multiple fee tiers', 'Cross-chain compatibility', 'Highest trading volume'],
    risks: ['Impermanent loss for LPs', 'Governance centralization concerns', 'MEV risks'],
    relatedAssets: ['SUSHI', '1INCH', 'CURVE'],
  },

  // Layer 2s
  OP: {
    summary: 'Optimism is an Ethereum Layer 2 scaling solution using Optimistic Rollups',
    useCase: 'Fast and cheap Ethereum transactions',
    blockchain: 'Ethereum (L2)',
    founded: new Date('2021-12-16'),
    creator: 'OP Labs',
    governance: 'Optimism Collective governance',
    security: 'Optimistic rollups with fraud proofs',
    uniqueFeatures: ['EVM-compatible', 'Fast finality', 'Low gas costs', 'Growing ecosystem'],
    risks: ['Centralization of sequencer', 'Bridge risks', 'Proof system complexity'],
    relatedAssets: ['ARB', 'LINEA', 'SCROLL'],
  },

  ARB: {
    summary: 'Arbitrum is an Ethereum Layer 2 using Optimistic Rollups',
    useCase: 'Scalable smart contract platform',
    blockchain: 'Ethereum (L2)',
    founded: new Date('2021-05-28'),
    creator: 'Offchain Labs',
    governance: 'Arbitrum DAO governance',
    security: 'Interactive fraud proofs',
    uniqueFeatures: ['High throughput', 'EVM-compatible', 'Cross-chain messaging', 'Arbitrum Nitro upgrade'],
    risks: ['Sequencer centralization', 'Cross-chain bridge risks', 'Economic security model'],
    relatedAssets: ['OP', 'LINEA', 'BASE'],
  },

  // Stablecoins
  USDT: {
    summary: 'Tether is the largest stablecoin by market cap',
    useCase: 'Stable value for trading and transfers',
    blockchain: 'Multiple (Ethereum, Tron, Polygon, etc.)',
    founded: new Date('2014-07-06'),
    creator: 'Tether Limited',
    governance: 'Centralized (Tether Limited)',
    security: 'Backed by USD reserves (claimed)',
    uniqueFeatures: ['Largest stablecoin', 'Most widely used', 'Multiple blockchain deployments', 'High liquidity'],
    risks: ['Centralization', 'Reserve transparency concerns', 'Regulatory scrutiny'],
    relatedAssets: ['USDC', 'DAI', 'BUSD'],
  },

  USDC: {
    summary: 'Circle USD Coin is a regulated stablecoin',
    useCase: 'Compliant stablecoin for institutional use',
    blockchain: 'Multiple (Ethereum, Polygon, Solana, etc.)',
    founded: new Date('2018-09-26'),
    creator: 'Circle',
    governance: 'Circle governance with transparency',
    security: '1:1 backed by US dollars in US banks',
    uniqueFeatures: ['Regulated issuer', 'Regular audits', 'Growing institutional adoption', 'Multichain deployment'],
    risks: ['Regulatory risk', 'Circle company risk', 'De-pegging risk'],
    relatedAssets: ['USDT', 'DAI', 'EUROC'],
  },

  // Gaming
  AXS: {
    summary: 'Axie Infinity is a blockchain-based game',
    useCase: 'Play-to-earn gaming and NFT ownership',
    blockchain: 'Ethereum',
    founded: new Date('2018-03-01'),
    creator: 'Sky Mavis',
    governance: 'Axie DAO governance',
    security: 'Ethereum-based smart contracts',
    uniqueFeatures: ['Play-to-earn model', 'NFT-based gameplay', 'Ronin sidechain', 'Large gaming community'],
    risks: ['Game popularity dependency', 'Token inflation', 'Sidechain security'],
    relatedAssets: ['SAND', 'MANA', 'GALA'],
  },

  // Oracles
  LINK: {
    summary: 'Chainlink is a decentralized oracle network',
    useCase: 'Off-chain data feeds for smart contracts',
    blockchain: 'Ethereum',
    founded: new Date('2014-09-01'),
    creator: 'Sergey Nazarov',
    governance: 'Chainlink DAO governance',
    security: 'Distributed oracle network',
    uniqueFeatures: ['Industry-leading oracle', 'VRF for randomness', 'Automation network', 'Multiple use cases'],
    risks: ['Oracle dependency', 'Token dilution potential', 'Competition from other oracles'],
    relatedAssets: ['BAND', 'API3', 'PYTH'],
  },
};

export class AssetIntelligenceService {
  /**
   * Get or generate education content for an asset
   */
  static getEducation(symbol: string): AssetEducation | null {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Try direct lookup
    if (ASSET_INTELLIGENCE_DB[normalized]) {
      return ASSET_INTELLIGENCE_DB[normalized];
    }

    // Try to generate basic education for unknown assets
    return this.generateBasicEducation(normalized);
  }

  /**
   * Generate basic education for new assets
   */
  private static generateBasicEducation(symbol: string): AssetEducation {
    return {
      summary: `${symbol} is a cryptocurrency token.`,
      useCase: 'Trading and value storage',
      blockchain: 'Unknown',
      uniqueFeatures: ['Cryptocurrency token'],
      risks: ['Unknown risks', 'Limited liquidity potential'],
      relatedAssets: [],
    };
  }

  /**
   * Enrich asset with intelligence
   */
  static enrichAsset(asset: NormalizedAsset): NormalizedAsset {
    const enriched = { ...asset };

    // Add education
    enriched.education = this.getEducation(asset.symbol) || undefined;

    // Add external links based on symbol
    enriched.website = this.getWebsite(asset.symbol);
    enriched.documentation = this.getDocumentation(asset.symbol);
    enriched.twitter = this.getTwitterHandle(asset.symbol);

    return enriched;
  }

  /**
   * Get website URL
   */
  private static getWebsite(symbol: string): string | undefined {
    const websites: Record<string, string> = {
      AAVE: 'https://aave.com',
      UNI: 'https://uniswap.org',
      OP: 'https://optimism.io',
      ARB: 'https://arbitrum.io',
      LINK: 'https://chain.link',
      SOL: 'https://solana.com',
      MATIC: 'https://polygon.technology',
      CURVE: 'https://curve.fi',
      SUSHI: 'https://sushi.com',
      LIDO: 'https://lido.fi',
      GMX: 'https://gmx.io',
      DYDX: 'https://dydx.trade',
      YEARN: 'https://yearn.finance',
    };

    return websites[symbol.toUpperCase()];
  }

  /**
   * Get documentation URL
   */
  private static getDocumentation(symbol: string): string | undefined {
    const docs: Record<string, string> = {
      AAVE: 'https://docs.aave.com',
      UNI: 'https://docs.uniswap.org',
      OP: 'https://docs.optimism.io',
      ARB: 'https://docs.arbitrum.io',
      LINK: 'https://docs.chain.link',
      CURVE: 'https://docs.curve.fi',
      SUSHI: 'https://docs.sushi.com',
      LIDO: 'https://docs.lido.fi',
    };

    return docs[symbol.toUpperCase()];
  }

  /**
   * Get Twitter handle
   */
  private static getTwitterHandle(symbol: string): string | undefined {
    const twitter: Record<string, string> = {
      AAVE: 'AaveAave',
      UNI: 'Uniswap',
      OP: 'optimismFND',
      ARB: 'arbitrum',
      LINK: 'chainlink',
      SOL: 'solana',
      MATIC: 'maticnetwork',
      CURVE: 'CurveFinance',
      SUSHI: 'SushiSwap',
      LIDO: 'LidoFinance',
    };

    return twitter[symbol.toUpperCase()];
  }

  /**
   * Calculate intelligence score (0-100)
   */
  static calculateIntelligenceScore(asset: NormalizedAsset): number {
    let score = 0;

    // Liquidity (0-30 points)
    score += (asset.liquidityScore / 100) * 30;

    // Exchange presence (0-20 points)
    const exchangeScore = Math.min(100, (asset.exchangeCount / 6) * 100);
    score += (exchangeScore / 100) * 20;

    // Data quality (0-20 points)
    score += (asset.dataQuality / 100) * 20;

    // Volume trend (0-15 points)
    if (asset.volumeTrend.change24h !== undefined) {
      const trendScore = Math.min(100, Math.abs(asset.volumeTrend.change24h) / 5);
      score += (trendScore / 100) * 15;
    }

    // Has education (0-10 points)
    if (asset.education) {
      score += 10;
    }

    // Multi-chain (0-5 points)
    if (asset.isMultiChain) {
      score += 5;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Generate asset insights
   */
  static generateInsights(asset: NormalizedAsset): string[] {
    const insights: string[] = [];

    // Liquidity insights
    if (asset.liquidityScore > 90) {
      insights.push('✅ Excellent liquidity across multiple exchanges');
    } else if (asset.liquidityScore < 30) {
      insights.push('⚠️ Limited liquidity - wide spreads expected');
    }

    // Spread insights
    if (asset.bestSpread < 0.05) {
      insights.push('✅ Tight bid-ask spread - efficient trading');
    } else if (asset.bestSpread > 0.5) {
      insights.push('⚠️ Wide spread - significant slippage risk');
    }

    // Exchange presence
    if (asset.exchangeCount === 6) {
      insights.push('🌍 Available on all 6 major exchanges');
    } else if (asset.exchangeCount === 1) {
      insights.push(`🏠 Only available on ${asset.primaryExchange}`);
    }

    // Volume trends
    if (asset.volumeTrend.change24h && asset.volumeTrend.change24h > 100) {
      insights.push(`📈 Volume surged ${Math.round(asset.volumeTrend.change24h)}% in 24 hours`);
    } else if (asset.volumeTrend.change24h && asset.volumeTrend.change24h < -50) {
      insights.push(`📉 Volume dropped ${Math.round(Math.abs(asset.volumeTrend.change24h))}% - possible opportunity`);
    }

    // New asset
    if (asset.isNew) {
      const daysOld = Math.floor((Date.now() - asset.discoveredDate.getTime()) / (1000 * 60 * 60 * 24));
      insights.push(`🆕 Newly discovered - ${daysOld} days old`);
    }

    // Spread variation
    if (asset.spreadVariation > 0.5) {
      insights.push('💰 Arbitrage opportunities - spread varies across exchanges');
    }

    // Multi-chain
    if (asset.isMultiChain) {
      insights.push(`🔗 Multi-chain: Available on ${asset.blockchains?.join(', ')}`);
    }

    return insights;
  }

  /**
   * Compare two assets
   */
  static compareAssets(asset1: NormalizedAsset, asset2: NormalizedAsset): Record<string, any> {
    return {
      symbol1: asset1.symbol,
      symbol2: asset2.symbol,
      liquidityComparison: {
        asset1Score: asset1.liquidityScore,
        asset2Score: asset2.liquidityScore,
        winner: asset1.liquidityScore > asset2.liquidityScore ? asset1.symbol : asset2.symbol,
      },
      spreadComparison: {
        asset1Spread: asset1.bestSpread,
        asset2Spread: asset2.bestSpread,
        winner: asset1.bestSpread < asset2.bestSpread ? asset1.symbol : asset2.symbol,
      },
      volumeComparison: {
        asset1Volume: asset1.totalVolume24h,
        asset2Volume: asset2.totalVolume24h,
        winner: asset1.totalVolume24h > asset2.totalVolume24h ? asset1.symbol : asset2.symbol,
      },
      exchangePresenceComparison: {
        asset1Count: asset1.exchangeCount,
        asset2Count: asset2.exchangeCount,
        winner: asset1.exchangeCount > asset2.exchangeCount ? asset1.symbol : asset2.symbol,
      },
      categoryMatch: asset1.category === asset2.category,
    };
  }

  /**
   * Suggest related assets
   */
  static suggestRelated(asset: NormalizedAsset, allAssets: NormalizedAsset[], limit: number = 5): NormalizedAsset[] {
    // Find assets with same category and high liquidity
    return allAssets
      .filter((a) => a.category === asset.category && a.symbol !== asset.symbol)
      .sort((a, b) => b.liquidityScore - a.liquidityScore)
      .slice(0, limit);
  }

  /**
   * Rate asset for different use cases
   */
  static rateForUseCase(
    asset: NormalizedAsset,
    useCase: 'trading' | 'lending' | 'yield' | 'arbitrage' | 'long-term-hold'
  ): {
    score: number;
    reasoning: string;
    recommendations: string[];
  } {
    let score = 50;
    const recommendations: string[] = [];
    let reasoning = '';

    switch (useCase) {
      case 'trading':
        score += asset.liquidityScore * 0.4; // High liquidity important
        score += (100 - asset.bestSpread) * 0.3; // Low spread important
        score -= (asset.spreadVariation || 0) * 0.2; // Lower variation is better
        reasoning = 'Rating based on liquidity and spread';
        if (asset.liquidityScore > 80) recommendations.push('Excellent for trading');
        if (asset.bestSpread > 0.5) recommendations.push('Watch for slippage');
        break;

      case 'lending':
        score += asset.category === 'DeFi' ? 20 : 0;
        score += asset.exchangeCount * 5; // Multi-exchange good for lending
        reasoning = 'Rating based on ecosystem maturity and liquidity';
        if (asset.category === 'DeFi') recommendations.push('DeFi asset - suitable for lending protocols');
        break;

      case 'yield':
        score += asset.liquidityScore * 0.5;
        score += asset.category === 'DeFi' ? 30 : 0;
        reasoning = 'Rating based on liquidity and DeFi integration';
        if (asset.category === 'DeFi') recommendations.push('Many yield opportunities for DeFi tokens');
        break;

      case 'arbitrage':
        score += (100 - asset.bestSpread) * 0.3; // Low spread bad for arb
        score += asset.spreadVariation * 0.4; // Spread variation good for arb
        reasoning = 'Rating based on spread variation across exchanges';
        if (asset.spreadVariation > 0.2) recommendations.push('Good arbitrage potential');
        break;

      case 'long-term-hold':
        score += asset.dataQuality * 0.4;
        score += asset.liquidityScore * 0.3;
        score += (asset.exchangeCount / 6) * 100 * 0.3;
        reasoning = 'Rating based on data quality and ecosystem presence';
        if (asset.exchangeCount === 6) recommendations.push('Available everywhere - easy exit');
        break;
    }

    return {
      score: Math.round(Math.min(100, Math.max(0, score))),
      reasoning,
      recommendations,
    };
  }
}

export default AssetIntelligenceService;
