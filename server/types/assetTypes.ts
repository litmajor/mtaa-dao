/**
 * Asset Discovery & Intelligence Type Definitions
 * 
 * Core types for symbol normalization, asset discovery,
 * and intelligent categorization across all exchanges
 */

/**
 * Normalized asset from any exchange
 * Standardizes data from CCXT across all exchange formats
 */
export interface NormalizedAsset {
  // Unique identification
  id: string;                      // Globally unique ID (hash of symbol)
  symbol: string;                  // Unified symbol (BTC, ETH, AAVE, etc.)
  name?: string;                   // Full name if available
  
  // Trading pair info
  base: string;                    // Base currency (BTC in BTC/USDT)
  quote: string;                   // Quote currency (USDT in BTC/USDT)
  pair: string;                    // Full pair (BTC/USDT)
  
  // Exchange presence
  exchanges: ExchangePresence[];   // Which exchanges have this asset
  exchangeCount: number;           // Total number of exchanges
  primaryExchange?: string;        // Most liquid exchange
  
  // Categorization
  category?: AssetCategory;        // DeFi, Layer1, Stablecoin, etc.
  subCategory?: string;            // More specific categorization
  tags: string[];                  // Flexible tagging system
  
  // Blockchain info
  blockchains?: string[];          // Ethereum, Solana, Polygon, etc.
  isMultiChain: boolean;           // Available on multiple blockchains
  mainBlockchain?: string;         // Primary blockchain
  
  // Discovery metrics
  discoveredDate: Date;            // When first seen
  isNew: boolean;                  // Appeared in last 7 days
  newAssetScore: number;           // 0-100 how new it is
  
  // Liquidity metrics
  totalVolume24h: number;          // Sum across all exchanges
  totalLiquidity: number;          // Aggregated liquidity
  liquidityScore: number;          // 1-100
  bestBid: number;                 // Best bid across exchanges
  bestAsk: number;                 // Best ask across exchanges
  bestSpread: number;              // Tightest spread
  spreadVariation: number;         // How spread varies by exchange
  
  // Market metrics
  volumeTrend: VolumeTrend;        // Volume analysis
  marketCapRank?: number;          // CoinGecko rank if available
  priceUSD?: number;               // Current price in USD
  
  // Metadata
  education?: AssetEducation;      // Educational content
  website?: string;                // Official website
  documentation?: string;          // Docs link
  twitter?: string;                // Social media
  
  // Normalization info
  lastUpdated: Date;               // When this record was updated
  dataQuality: number;             // 1-100 confidence score
  normalizationFlags: string[];    // Issues found during normalization
}

/**
 * Exchange presence for an asset
 */
export interface ExchangePresence {
  exchange: string;                // Exchange name (binance, coinbase, etc.)
  symbol: string;                  // Symbol on this exchange (may differ)
  active: boolean;                 // Is trading pair active
  volume24h: number;               // Volume on this exchange
  bid: number;                     // Current bid
  ask: number;                     // Current ask
  spread: number;                  // Bid-ask spread %
  lastUpdate: Date;                // Last time data was fetched
  maker?: number;                  // Maker fee
  taker?: number;                  // Taker fee
  minOrderSize?: number;           // Minimum order size
  precision?: {
    amount?: number;
    price?: number;
  };
}

/**
 * Asset categories
 */
export type AssetCategory = 
  | 'DeFi'
  | 'Layer1'
  | 'Layer2'
  | 'Stablecoin'
  | 'Oracle'
  | 'Gaming'
  | 'Metaverse'
  | 'Exchange'
  | 'Storage'
  | 'NFT'
  | 'Privacy'
  | 'Governance'
  | 'Infrastructure'
  | 'Utility'
  | 'Meme'
  | 'Other';

/**
 * Volume trend analysis
 */
export interface VolumeTrend {
  current: number;                 // Current 24h volume
  average7d: number;               // 7-day average
  average30d: number;              // 30-day average
  change24h: number;               // % change from yesterday
  change7d: number;                // % change from 7 days ago
  change30d: number;               // % change from 30 days ago
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: number;              // Standard deviation
}

/**
 * Educational content for asset
 */
export interface AssetEducation {
  summary: string;                 // Brief description
  useCase: string;                 // What is it used for
  blockchain: string;              // Main blockchain
  founded?: Date;                  // When created
  creator?: string;                // Creator/team
  governance?: string;             // Governance model
  security?: string;               // Security features
  uniqueFeatures: string[];        // What makes it special
  risks?: string[];                // Known risks
  relatedAssets?: string[];        // Similar/related assets
}

/**
 * Discovery event (new asset detected)
 */
export interface DiscoveryEvent {
  symbol: string;
  discoveredAt: Date;
  discoveredOn: string;            // Exchange where found
  firstVolume: number;
  initialPrice?: number;
  category?: AssetCategory;
  category_confidence?: number;    // How confident is the categorization
  sources: string[];               // Where we learned about it
}

/**
 * Asset statistics/summary
 */
export interface AssetStats {
  totalAssets: number;             // Total unique assets tracked
  assetsByCategory: Record<AssetCategory, number>;
  assetsByExchange: Record<string, number>;
  newAssetsThisWeek: number;
  newAssetsToday: number;
  mostLiquidAssets: NormalizedAsset[];
  trendingAssets: NormalizedAsset[];
  newListings: DiscoveryEvent[];
}

/**
 * Query filters for asset discovery
 */
export interface AssetQueryFilters {
  category?: AssetCategory | AssetCategory[];
  exchange?: string | string[];
  minVolume?: number;
  maxSpread?: number;
  minLiquidity?: number;
  isNew?: boolean;
  blockchains?: string | string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Normalization result with metrics
 */
export interface NormalizationResult {
  success: boolean;
  asset: NormalizedAsset | null;
  errors: string[];
  warnings: string[];
  dataQuality: number;
  missingFields: string[];
  conflictingData: Array<{
    field: string;
    values: any[];
    exchanges: string[];
  }>;
}

/**
 * Raw market data from CCXT
 * Before normalization
 */
export interface RawMarketData {
  exchange: string;
  symbol: string;
  id: string;
  base?: string;
  quote?: string;
  baseId?: string;
  quoteId?: string;
  active?: boolean;
  maker?: number;
  taker?: number;
  limits?: {
    amount?: { min?: number; max?: number };
    price?: { min?: number; max?: number };
    cost?: { min?: number; max?: number };
  };
  precision?: {
    amount?: number;
    price?: number;
    base?: number;
    quote?: number;
  };
  info?: any;
  // Ticker data
  last?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  quoteVolume?: number;
  timestamp?: number;
}

/**
 * Categorization confidence
 */
export interface CategorizationResult {
  category: AssetCategory;
  confidence: number;              // 0-100
  reasoning: string;
  patterns: string[];              // What patterns matched
  alternativeCategories: Array<{
    category: AssetCategory;
    confidence: number;
  }>;
}

/**
 * Historical snapshot of assets at a point in time
 */
export interface AssetSnapshot {
  timestamp: Date;
  totalAssets: number;
  assetsByCategory: Record<AssetCategory, number>;
  newAssetsCount: number;
  totalVolume: number;
  averageLiquidity: number;
}
