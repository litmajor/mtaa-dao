/**
 * Morio Data Hub Integration Service
 *
 * Handles data aggregation logic, caching, and optimization
 *
 * FIXES APPLIED:
 * 1. SimpleCache's cleanup sweep interval was being constructed with `120`
 *    (intended as 120 seconds) but the constructor treats its argument as
 *    milliseconds — so cleanup ran every 120ms instead of every 2 minutes,
 *    ~1000x more often than intended. Fixed the call site and made the
 *    constructor's unit explicit in its parameter name to prevent recurrence.
 * 2. `cache.get<T>(key)` was called with an explicit type argument, but
 *    SimpleCache.get() wasn't declared as a per-call generic method — that's
 *    a type error against the original class shape. get() is now generic
 *    per-call.
 * 3. set()'s own default ttl (300000) was being implicitly treated as
 *    *seconds* by the `ttl * 1000` conversion inside the method (matching
 *    every real call site, which passes seconds) — so relying on that
 *    default would silently produce an ~83 hour cache instead of the
 *    "5 minutes" implied by CACHE_STANDARD_TTL sitting right next to it.
 *    The default now matches the same seconds convention every caller uses.
 * 4. getStats() now reports real hit/miss counts instead of hardcoded 0s.
 */

// Simple in-memory cache implementation
class SimpleCache<TDefault = any> {
  private store: Map<string, { value: any; expiry: number }> = new Map();
  private checkPeriodMs: number;
  private hits = 0;
  private misses = 0;

  /**
   * @param checkPeriodMs How often (in milliseconds) to sweep expired
   * entries. Renamed from `checkPeriod` to make the unit unambiguous at
   * every call site.
   */
  constructor(checkPeriodMs: number = 120_000) {
    this.checkPeriodMs = checkPeriodMs;
    this.startCleanup();
  }

  private startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.store.entries()) {
        if (item.expiry < now) {
          this.store.delete(key);
        }
      }
    }, this.checkPeriodMs);
  }

  // FIX #2: generic per call, so `cache.get<Foo>(key)` type-checks.
  get<T = TDefault>(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) {
      this.misses++;
      return undefined;
    }
    if (item.expiry < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return item.value as T;
  }

  /**
   * @param ttlSeconds Time-to-live in SECONDS (converted to ms internally).
   * FIX #3: default now matches the seconds convention every real call site
   * already uses (CACHE_STANDARD_TTL etc.), instead of a bare 300000 that
   * would be misinterpreted as 300000 seconds (~83 hours) by the `* 1000`
   * below.
   */
  set<T = TDefault>(key: string, value: T, ttlSeconds: number = 300): void {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  flushAll(): void {
    this.store.clear();
  }

  getStats() {
    return {
      keys: this.store.size,
      hits: this.hits,     // FIX #4
      misses: this.misses, // FIX #4
      ksize: this.store.size
    };
  }
}

// Cache settings (all in SECONDS — matches SimpleCache.set()'s ttlSeconds param)
const CACHE_STANDARD_TTL = 300; // 5 minutes for most data
const CACHE_LONG_TTL = 3600; // 1 hour for aggregated reports
const CACHE_SHORT_TTL = 60; // 1 minute for real-time data

export interface DashboardMetric {
  label: string;
  value: string | number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  severity?: 'success' | 'warning' | 'danger' | 'info';
  percentChange?: number;
}

export interface DashboardSection {
  section: string;
  title: string;
  description: string;
  icon: string;
  data: DashboardMetric[];
  lastUpdated: string;
}

class MorioDataHubService {
  private cache: SimpleCache;

  constructor() {
    // FIX #1: this must be milliseconds. `120` alone previously meant
    // "sweep every 120ms" — now explicit that 120 SECONDS was intended.
    this.cache = new SimpleCache(120_000);
  }

  async getCachedOrFresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = CACHE_STANDARD_TTL
  ): Promise<T> {
    const cached = this.cache.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const data = await fetchFn();
    this.cache.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Aggregate all dashboard data
   *
   * NOTE: this currently returns static placeholder data (empty sections,
   * fixed metric values) rather than aggregating real sources — flagging
   * this as a known stub, not wiring it up further since the real
   * per-section aggregation logic isn't in scope here.
   */
  async aggregateDashboard(
    daoId?: string,
    useCache: boolean = true
  ): Promise<{
    sections: Record<string, DashboardSection>;
    aggregatedMetrics: {
      overallHealth: number;
      systemStatus: string;
      activeThreats: number;
      memberEngagement: number;
    };
    timestamp: string;
  }> {
    try {
      // TODO: aggregate data from all 5 sections here — currently a stub.
      return {
        sections: {},
        aggregatedMetrics: {
          overallHealth: 92,
          systemStatus: 'optimal',
          activeThreats: 127,
          memberEngagement: 76
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to aggregate dashboard:', error);
      throw error;
    }
  }

  /**
   * Get real-time alerts
   * NOTE: still a stub — returns fixed mock alerts rather than DAO-specific
   * live data. The daoId parameter is honored for cache-key scoping only.
   */
  async getRealTimeAlerts(daoId?: string) {
    const cacheKey = `alerts:${daoId || 'global'}`;

    return this.getCachedOrFresh(
      cacheKey,
      async () => ({
        alerts: [
          {
            id: 'THREAT-001',
            severity: 'warning',
            title: 'Elevated Security Threat Detected',
            description: 'ELD-SCRY has detected 3 potential security anomalies',
            timestamp: new Date().toISOString(),
            action: 'Review Security Report'
          },
          {
            id: 'PROPOSAL-002',
            severity: 'info',
            title: 'New Governance Proposal',
            description: 'Investment Pool Rebalancing - Vote Ends in 2 Days',
            timestamp: new Date().toISOString(),
            action: 'Vote Now'
          }
        ],
        lastUpdate: new Date().toISOString()
      }),
      CACHE_SHORT_TTL
    );
  }

  /** NOTE: still a stub — static mock metrics. */
  async getPerformanceMetrics() {
    const cacheKey = 'performance:global';

    return this.getCachedOrFresh(
      cacheKey,
      async () => ({
        uptime: 99.98,
        responseTime: {
          p50: 145,
          p95: 342,
          p99: 892
        },
        requestsPerSecond: 2847,
        errorRate: 0.02,
        lastUpdate: new Date().toISOString()
      }),
      CACHE_SHORT_TTL
    );
  }

  /** NOTE: still a stub — static mock status. */
  async getSystemStatus() {
    const cacheKey = 'system:status';

    return this.getCachedOrFresh(
      cacheKey,
      async () => ({
        overall: 'healthy',
        components: {
          eldScry: { status: 'online', uptime: 99.7 },
          eldKaizen: { status: 'online', uptime: 99.9 },
          eldLumen: { status: 'online', uptime: 99.8 },
          agents: { status: 'online', activeCount: 8, totalCount: 10 },
          database: { status: 'online', latency: 12 },
          cache: { status: 'online', hitRate: 87.3 }
        },
        lastCheck: new Date().toISOString()
      }),
      CACHE_SHORT_TTL
    );
  }

  clearCache(key?: string) {
    if (key) {
      this.cache.del(key);
    } else {
      this.cache.flushAll();
    }
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}

export const morioDataHubService = new MorioDataHubService();