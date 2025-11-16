/**
 * Gateway Agent Type Definitions
 * Comprehensive types for multi-API aggregation and normalization
 */

// ============================================================================
// Message Types
// ============================================================================

export type GatewayMessageType =
  | "gateway:price_request"
  | "gateway:liquidity_request"
  | "gateway:apy_request"
  | "gateway:risk_request"
  | "gateway:price_update"
  | "gateway:liquidity_update"
  | "gateway:apy_update"
  | "gateway:risk_update"
  | "gateway:cache_invalidate"
  | "gateway:status"
  | "gateway:adapter_status"
  | "gateway:error"
  | "gateway:access_denied";

export interface GatewayMessage<T = any> {
  type: GatewayMessageType;
  from: string;
  to?: string | string[];
  timestamp: Date;
  payload: T;
  requiresResponse?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  metadata?: Record<string, any>;  // Optional metadata for security/context
}

// ============================================================================
// Data Types
// ============================================================================

export interface Asset {
  symbol: string;              // BTC, ETH, USDC, etc.
  chain: string;               // "celo", "ethereum", "solana"
  address: string;             // Normalized chain address
  decimals?: number;           // Token decimals
}

export interface NormalizedData {
  id: string;                  // Unique identifier (auto-generated)
  source: string;              // "uniswap", "coingecko", "chainlink", etc.
  timestamp: string;           // ISO 8601 UTC
  dataType: "price" | "liquidity" | "apy" | "risk" | "balance" | "tvl" | "transaction";
  asset: Asset;
  value: number | string;      // Main numeric value or BigInt string
  metadata: Record<string, any>; // Dynamic metadata from adapters
  error?: string;              // If fetch/normalization failed
  stale?: boolean;             // Flagged as stale (using cached fallback)
  age?: number;                // Data age in seconds
}

export interface PriceData extends NormalizedData {
  dataType: "price";
  value: number;               // USD price
  metadata: {
    confidence: number;
    source24hVolume?: number;
    source24hChange?: number;
  };
}

export interface LiquidityData extends NormalizedData {
  dataType: "liquidity";
  value: number;               // Liquidity in USD
  metadata: {
    confidence: number;
    tvl?: number;
    apr?: number;
    liquidityUSD?: number;
  };
}

export interface APYData extends NormalizedData {
  dataType: "apy";
  value: number;               // APY as percentage (e.g., 12.5 = 12.5%)
  metadata: {
    confidence: number;
    apy?: number;
    apr?: number;
  };
}

export interface RiskData extends NormalizedData {
  dataType: "risk";
  value: number;               // Risk score 0-100
  metadata: {
    confidence: number;
    riskScore?: number;
    auditStatus?: string;
    insurance?: boolean;
  };
}

export type DataPayload = PriceData | LiquidityData | APYData | RiskData;

// ============================================================================
// Request/Response Types
// ============================================================================

export interface PriceRequest {
  symbols: string[];           // ["BTC", "ETH", "USDC"]
  chains?: string[];           // ["celo", "ethereum"] - defaults to all
  preferredSource?: string;    // "chainlink", "uniswap", etc.
}

export interface LiquidityRequest {
  pools?: string[];            // Pool identifiers
  protocols?: string[];        // ["uniswap", "moola", "beefyfi"]
  chain?: string;
}

export interface APYRequest {
  protocols: string[];         // ["beefyfi", "moola"]
  assets?: string[];           // ["USDC", "cUSD"]
  chain?: string;
}

export interface RiskRequest {
  protocols: string[];         // ["aave", "uniswap", "curve"]
  includeAuditStatus?: boolean;
  includeInsurance?: boolean;
}

export interface GatewayRequest {
  type: "price" | "liquidity" | "apy" | "risk";
  payload: PriceRequest | LiquidityRequest | APYRequest | RiskRequest;
  requestId?: string;
  timeout?: number;            // ms
}

export interface GatewayResponse<T = DataPayload> {
  success: boolean;
  data?: T[];
  error?: string;
  timestamp: string;
  requestId?: string;
  cacheHit?: boolean;
  age?: number;
}

// ============================================================================
// Adapter Types
// ============================================================================

export interface AdapterConfig {
  enabled: boolean;
  apiKey?: string;
  rpcUrl?: string;
  timeout?: number;            // ms, default 5000
  priority?: number;           // Lower = higher priority (0-10)
  maxRetries?: number;         // default 3
  retryDelayMs?: number;       // default 1000
}

export interface AdapterStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: Date;
  failureCount: number;
  circuitBreakerState: "closed" | "open" | "half-open";
  nextCheckTime: Date;
  error?: string;
}

export interface BaseAdapterConfig extends AdapterConfig {
  name: string;
  rpcUrl?: string;
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening (default: 5)
  successThreshold: number;    // Successes before closing (default: 2)
  timeout: number;             // ms until half-open (default: 30000)
  halfOpenRequests?: number;   // Max concurrent requests in half-open state (default: 3)
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  transitionTime: Date;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T = NormalizedData> {
  data: T;
  timestamp: string;
  ttl: number;                 // seconds
  source: string;
}

export interface CacheConfig {
  enabled?: boolean;
  maxItems?: number;           // Max entries (default: 10000)
  maxMemoryMb?: number;        // Max memory in MB (default: 512)
  redisUrl?: string;
  keyPrefix?: string;
  defaultTtl?: number;         // seconds (default: 300)
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;            // 0-1
  entries: number;
  memoryUsageMB: number;
}

// ============================================================================
// Gateway Status Types
// ============================================================================

export interface GatewayStatus {
  uptime: number;             // ms
  adapters: AdapterStatus[];
  cache: CacheStats;
  metrics: GatewayMetrics;
  health: "healthy" | "degraded" | "unhealthy";
}

export interface GatewayMetrics {
  requestsTotal: number;
  requestsFailed: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  failoverCount: number;
  staleDataReturned: number;
}

// ============================================================================
// Request/Response for Adapters
// ============================================================================

export interface AdapterResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  latencyMs: number;
  raw?: any;                   // Raw API response for debugging
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface GatewayConfig {
  enabled: boolean;
  adapters: {
    [key: string]: AdapterConfig;
  };
  cache: CacheConfig;
  circuitBreaker: CircuitBreakerConfig;
  priorityOrder: string[];     // Adapter names in priority order
  fallbackOrder: string[];     // Fallback adapters if primary fails
  maxConcurrentRequests: number;
  requestTimeout: number;      // ms
  enableMetrics: boolean;
  metricsInterval: number;     // ms between metric flushes
}

export interface GatewayEnvironment {
  // Adapter API Keys
  UNISWAP_API_KEY?: string;
  COINGECKO_API_KEY?: string;
  CHAINLINK_RPC_URL?: string;
  MOOLA_API_KEY?: string;
  BEEFYFI_API_KEY?: string;
  BLOCKCHAIN_RPC_URL?: string;

  // Cache Strategy
  CACHE_TTL_PRICES?: number;
  CACHE_TTL_LIQUIDITY?: number;
  CACHE_TTL_APY?: number;
  CACHE_TTL_RISK?: number;

  // Circuit Breaker
  CB_FAILURE_THRESHOLD?: number;
  CB_TIMEOUT_MS?: number;
  CB_HALF_OPEN_TIMEOUT?: number;

  // Rate Limiting
  GATEWAY_RATE_LIMIT?: number;
  GATEWAY_RATE_WINDOW_MS?: number;

  // Adapters
  ENABLED_ADAPTERS?: string;  // Comma-separated: "chainlink,uniswap,coingecko"
  ADAPTER_PRIORITY_ORDER?: string;
  USE_CACHED_ON_FAILURE?: boolean;
  MARK_STALE_WHEN_FALLBACK?: boolean;
}
