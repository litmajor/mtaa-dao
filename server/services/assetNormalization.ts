/**
 * Asset Normalization Service
 * 
 * Standardizes asset data from different exchanges into a unified format
 * Handles inconsistencies, conflicts, and data quality issues
 * 
 * Key responsibilities:
 * - Normalize symbol formats (BTC vs bitcoin, WETH vs ETH)
 * - Merge data from multiple exchanges
 * - Detect and resolve conflicts
 * - Validate data quality
 * - Extract blockchain information
 */

import {
  NormalizedAsset,
  ExchangePresence,
  RawMarketData,
  NormalizationResult,
  CategorizationResult,
  AssetCategory,
  AssetEducation,
} from '../types/assetTypes';

/**
 * Symbol normalization mappings
 * Handles common aliases and variations
 */
const SYMBOL_MAPPINGS: Record<string, string> = {
  // Stablecoins
  'USDT': 'USDT',
  'USDC': 'USDC',
  'DAI': 'DAI',
  'BUSD': 'BUSD',
  'TUSD': 'TUSD',
  'USDD': 'USDD',
  'GUSD': 'GUSD',
  'FRAX': 'FRAX',
  'USDP': 'USDP',
  'DUSK': 'DUSK',
  
  // Major Layer 1s
  'BTC': 'BTC',
  'ETH': 'ETH',
  'SOL': 'SOL',
  'AVAX': 'AVAX',
  'MATIC': 'MATIC',
  'DOT': 'DOT',
  'ADA': 'ADA',
  'XRP': 'XRP',
  'LINK': 'LINK',
  'FTM': 'FTM',
  'CELO': 'CELO',
  
  // Layer 2s
  'OP': 'OP',
  'ARB': 'ARB',
  'LINEA': 'LINEA',
  'SCROLL': 'SCROLL',
  'ZKSYNC': 'ZKSYNC',
  'STARK': 'STARK',
  
  // DeFi
  'UNI': 'UNI',
  'AAVE': 'AAVE',
  'CURVE': 'CURVE',
  'COMPOUND': 'COMPOUND',
  'MAKER': 'MAKER',
  'LIDO': 'LIDO',
  'RETH': 'RETH',
  'SUSHI': 'SUSHI',
  '1INCH': '1INCH',
  'BALANCER': 'BALANCER',
  'GMX': 'GMX',
  'DYDX': 'DYDX',
  'YEARN': 'YEARN',
  'CONVEX': 'CONVEX',
  
  // Gaming/Metaverse
  'AXIE': 'AXS',
  'AXS': 'AXS',
  'SAND': 'SAND',
  'MANA': 'MANA',
  'ENJ': 'ENJ',
  'YGG': 'YGG',
  'GALA': 'GALA',
  'MAGIC': 'MAGIC',
  'ILV': 'ILV',
  
  // Oracles
  'BAND': 'BAND',
  'API3': 'API3',
  'PYTH': 'PYTH',
  'CHAINLINK': 'LINK',
  
  // Exchange Tokens
  'BNB': 'BNB',
  'FTT': 'FTT',
  'OKB': 'OKB',
  'GT': 'GT',
  'KUCOIN': 'KCS',
  'HT': 'HT',
};

/**
 * Category patterns for auto-detection
 */
const CATEGORY_PATTERNS: Array<{
  category: AssetCategory;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    category: 'Stablecoin',
    patterns: [/USD[CT]/, /DAI/, /BUSD/, /TUSD/, /USDD/, /GUSD/, /FRAX/, /USDP/],
    confidence: 95,
  },
  {
    category: 'Layer1',
    patterns: [/^BTC$/, /^ETH$/, /^SOL$/, /^AVAX$/, /^ADA$/, /^XRP$/, /^DOT$/, /^BNB$/],
    confidence: 90,
  },
  {
    category: 'Layer2',
    patterns: [/^OP$/, /^ARB$/, /^LINEA/, /^SCROLL/, /^ZKSYNC/, /^STARK/],
    confidence: 85,
  },
  {
    category: 'DeFi',
    patterns: [/^UNI$/, /^AAVE$/, /^CURVE/, /^COMPOUND/, /^MAKER/, /^LIDO/, /^SUSHI/],
    confidence: 85,
  },
  {
    category: 'Oracle',
    patterns: [/LINK|BAND|API3|PYTH/],
    confidence: 80,
  },
  {
    category: 'Gaming',
    patterns: [/AXS|SAND|MANA|ENJ|YGG|GALA|ILV|MAGIC|BLUR/],
    confidence: 80,
  },
  {
    category: 'Governance',
    patterns: [/DAO|VOTE|GOV/],
    confidence: 70,
  },
];

/**
 * Blockchain detection from symbol/name
 */
const BLOCKCHAIN_INDICATORS: Record<string, string> = {
  'ETH': 'Ethereum',
  'WETH': 'Ethereum',
  'SOL': 'Solana',
  'WSOL': 'Solana',
  'AVAX': 'Avalanche',
  'WAVAX': 'Avalanche',
  'MATIC': 'Polygon',
  'WMATIC': 'Polygon',
  'FTM': 'Fantom',
  'WFTM': 'Fantom',
  'CELO': 'Celo',
  'OP': 'Optimism',
  'ARB': 'Arbitrum',
  'LINEA': 'Linea',
  'SCROLL': 'Scroll',
  'NEAR': 'Near',
  'ATOM': 'Cosmos',
  'DOT': 'Polkadot',
  'KSM': 'Kusama',
  'FLOW': 'Flow',
};

export class AssetNormalizationService {
  /**
   * Normalize a single asset from raw market data
   */
  static normalizeAsset(rawData: RawMarketData): NormalizationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    try {
      // Extract symbol
      const symbol = this.normalizeSymbol(rawData.symbol || rawData.id);
      if (!symbol) {
        errors.push('Could not extract valid symbol');
        return {
          success: false,
          asset: null,
          errors,
          warnings,
          dataQuality: 0,
          missingFields,
          conflictingData: [],
        };
      }

      // Extract base/quote
      const [base, quote] = this.parseSymbolPair(rawData.symbol || rawData.id);
      if (!base || !quote) {
        errors.push('Could not parse base/quote currencies');
      }

      // Categorize
      const categorization = this.categorizeAsset(symbol);

      // Detect blockchain
      const blockchains = this.detectBlockchains(symbol, rawData);

      // Calculate liquidity
      const liquidityScore = this.calculateLiquidityScore(rawData);

      // Create normalized asset
      const asset: NormalizedAsset = {
        id: this.generateAssetId(symbol),
        symbol,
        name: rawData.info?.name || symbol,
        base: base || rawData.base || '',
        quote: quote || rawData.quote || '',
        pair: `${base}/${quote}`,
        exchanges: [],
        exchangeCount: 0,
        category: categorization.category,
        subCategory: rawData.info?.type,
        tags: this.generateTags(symbol, categorization.category),
        blockchains: blockchains.length > 0 ? blockchains : undefined,
        isMultiChain: blockchains.length > 1,
        mainBlockchain: blockchains[0],
        discoveredDate: new Date(),
        isNew: true,
        newAssetScore: 100,
        totalVolume24h: rawData.quoteVolume || rawData.volume || 0,
        totalLiquidity: this.estimateLiquidity(rawData),
        liquidityScore,
        bestBid: rawData.bid || 0,
        bestAsk: rawData.ask || 0,
        bestSpread: this.calculateSpread(rawData.bid, rawData.ask),
        spreadVariation: 0,
        volumeTrend: {
          current: rawData.quoteVolume || rawData.volume || 0,
          average7d: 0,
          average30d: 0,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          trend: 'stable',
          volatility: 0,
        },
        lastUpdated: new Date(),
        dataQuality: this.assessDataQuality(rawData, errors, warnings, missingFields),
        normalizationFlags: warnings,
      };

      return {
        success: errors.length === 0,
        asset,
        errors,
        warnings,
        dataQuality: asset.dataQuality,
        missingFields,
        conflictingData: [],
      };
    } catch (error) {
      errors.push(`Normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        asset: null,
        errors,
        warnings,
        dataQuality: 0,
        missingFields,
        conflictingData: [],
      };
    }
  }

  /**
   * Merge multiple exchange data for same asset
   */
  static mergeAssets(assets: NormalizedAsset[]): NormalizedAsset {
    if (assets.length === 0) {
      throw new Error('Cannot merge empty asset list');
    }

    if (assets.length === 1) {
      return assets[0];
    }

    const primary = assets[0];
    const merged: NormalizedAsset = { ...primary };

    // Aggregate exchange presence
    const exchangeMap = new Map<string, ExchangePresence>();
    assets.forEach((asset) => {
      asset.exchanges.forEach((presence) => {
        const key = presence.exchange;
        if (!exchangeMap.has(key) || presence.volume24h > (exchangeMap.get(key)?.volume24h || 0)) {
          exchangeMap.set(key, presence);
        }
      });
    });

    merged.exchanges = Array.from(exchangeMap.values());
    merged.exchangeCount = merged.exchanges.length;

    // Find most liquid exchange
    merged.primaryExchange = merged.exchanges.reduce((prev, curr) =>
      curr.volume24h > prev.volume24h ? curr : prev
    ).exchange;

    // Aggregate volumes
    merged.totalVolume24h = merged.exchanges.reduce((sum, ex) => sum + ex.volume24h, 0);

    // Find best prices
    const validBids = merged.exchanges.filter((ex) => ex.bid > 0).map((ex) => ex.bid);
    const validAsks = merged.exchanges.filter((ex) => ex.ask > 0).map((ex) => ex.ask);

    merged.bestBid = validBids.length > 0 ? Math.max(...validBids) : 0;
    merged.bestAsk = validAsks.length > 0 ? Math.min(...validAsks) : 0;
    merged.bestSpread = this.calculateSpread(merged.bestBid, merged.bestAsk);

    // Calculate spread variation
    const spreads = merged.exchanges
      .map((ex) => ex.spread)
      .filter((s) => s > 0);
    merged.spreadVariation =
      spreads.length > 1
        ? Math.sqrt(spreads.reduce((sum, s) => sum + Math.pow(s - (spreads.reduce((a, b) => a + b) / spreads.length), 2), 0) / spreads.length)
        : 0;

    // Update quality based on data availability
    merged.dataQuality = Math.min(
      100,
      (merged.exchangeCount / 3) * 50 + (merged.liquidityScore / 100) * 50
    );

    merged.lastUpdated = new Date();

    return merged;
  }

  /**
   * Normalize symbol to standard format
   */
  private static normalizeSymbol(symbol: string): string {
    // Remove unwanted characters
    let cleaned = symbol
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .split('/')[0];

    // Apply mappings
    return SYMBOL_MAPPINGS[cleaned] || cleaned;
  }

  /**
   * Parse trading pair into base and quote
   */
  private static parseSymbolPair(pair: string): [string, string] {
    const parts = pair.split('/');
    if (parts.length === 2) {
      return [parts[0].toUpperCase(), parts[1].toUpperCase()];
    }

    // Try to infer if no slash
    const cleaned = pair.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Known patterns
    const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
    for (const stablecoin of stablecoins) {
      if (cleaned.endsWith(stablecoin)) {
        const base = cleaned.substring(0, cleaned.length - stablecoin.length);
        if (base.length > 0) {
          return [base, stablecoin];
        }
      }
    }

    return ['', ''];
  }

  /**
   * Auto-categorize asset based on symbol
   */
  private static categorizeAsset(symbol: string): CategorizationResult {
    for (const pattern of CATEGORY_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(symbol)) {
          return {
            category: pattern.category,
            confidence: pattern.confidence,
            reasoning: `Symbol matches ${pattern.category} pattern`,
            patterns: pattern.patterns.map((p) => p.source),
            alternativeCategories: [],
          };
        }
      }
    }

    return {
      category: 'Other',
      confidence: 20,
      reasoning: 'No specific pattern matched',
      patterns: [],
      alternativeCategories: [
        { category: 'Utility', confidence: 30 },
        { category: 'Governance', confidence: 25 },
      ],
    };
  }

  /**
   * Detect blockchains for asset
   */
  private static detectBlockchains(symbol: string, rawData: RawMarketData): string[] {
    const blockchains = new Set<string>();

    // Check symbol
    for (const [key, blockchain] of Object.entries(BLOCKCHAIN_INDICATORS)) {
      if (symbol.includes(key)) {
        blockchains.add(blockchain);
      }
    }

    // Check metadata
    if (rawData.info?.blockchain) {
      blockchains.add(rawData.info.blockchain);
    }

    // Common assumptions
    if (symbol.startsWith('W')) {
      blockchains.add('Ethereum'); // Wrapped tokens
    }

    return Array.from(blockchains);
  }

  /**
   * Calculate liquidity score
   */
  private static calculateLiquidityScore(rawData: RawMarketData): number {
    let score = 0;

    // Volume (0-40 points)
    const volume = rawData.quoteVolume || rawData.volume || 0;
    if (volume > 100000000) score += 40;
    else if (volume > 10000000) score += 30;
    else if (volume > 1000000) score += 20;
    else if (volume > 100000) score += 10;

    // Spread (0-30 points)
    const spread = this.calculateSpread(rawData.bid, rawData.ask);
    if (spread < 0.01) score += 30;
    else if (spread < 0.05) score += 20;
    else if (spread < 0.1) score += 10;

    // Order size (0-20 points)
    const minOrder = rawData.limits?.amount?.min || 0;
    if (minOrder < 1) score += 20;
    else if (minOrder < 10) score += 15;
    else if (minOrder < 100) score += 10;

    // Precision (0-10 points)
    if (rawData.precision?.amount !== undefined) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Estimate liquidity from raw data
   */
  private static estimateLiquidity(rawData: RawMarketData): number {
    const volume = rawData.quoteVolume || rawData.volume || 0;
    const spread = this.calculateSpread(rawData.bid, rawData.ask);

    // Liquidity = volume / spread
    return spread > 0 ? volume / spread : volume;
  }

  /**
   * Calculate bid-ask spread percentage
   */
  private static calculateSpread(bid: number | undefined, ask: number | undefined): number {
    if (!bid || !ask || bid <= 0 || ask <= 0) {
      return 100; // Max spread if invalid
    }

    return ((ask - bid) / bid) * 100;
  }

  /**
   * Generate unique asset ID
   */
  private static generateAssetId(symbol: string): string {
    return symbol.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Generate tags for asset
   */
  private static generateTags(symbol: string, category: AssetCategory): string[] {
    const tags: string[] = [category];

    // Add more tags based on symbol
    if (/USD/.test(symbol)) tags.push('stablecoin');
    if (/ETH/.test(symbol)) tags.push('ethereum');
    if (/SOL/.test(symbol)) tags.push('solana');
    if (/WRAPPED/.test(symbol) || symbol.startsWith('W')) tags.push('wrapped');
    if (/YIELD/.test(symbol)) tags.push('yield-bearing');
    if (/LP/.test(symbol)) tags.push('liquidity-pool');

    return tags;
  }

  /**
   * Assess data quality
   */
  private static assessDataQuality(
    rawData: RawMarketData,
    errors: string[],
    warnings: string[],
    missingFields: string[]
  ): number {
    let quality = 100;

    // Deduct for errors
    quality -= errors.length * 10;

    // Deduct for warnings
    quality -= warnings.length * 5;

    // Deduct for missing fields
    if (!rawData.bid || !rawData.ask) quality -= 10;
    if (!rawData.volume && !rawData.quoteVolume) quality -= 15;
    if (!rawData.base || !rawData.quote) quality -= 20;
    if (!rawData.active !== undefined) quality -= 5;

    return Math.max(0, quality);
  }
}

export default AssetNormalizationService;
