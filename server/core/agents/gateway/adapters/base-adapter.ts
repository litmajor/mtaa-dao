/**
 * Base Adapter Class
 * Abstract interface for all API adapters
 */

import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export abstract class BaseAdapter {
  protected name: string;
  protected config: BaseAdapterConfig;
  protected cache = new Map<string, { data: any; expiresAt: number }>();

  constructor(name: string, config: BaseAdapterConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * Get adapter name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Fetch data from external API
   * @param dataType - Type of data to fetch (price, liquidity, apy, risk)
   * @param params - Request parameters
   */
  abstract fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>>;

  /**
   * Health check for adapter
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch("price", { symbols: ["BTC"] });
      return response.success;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache for specific data
   */
  invalidateCache(pattern?: any): void {
    if (!pattern) {
      this.cache.clear();
      console.log(`[${this.name}] Cache cleared`);
      return;
    }

    const keysToDelete: string[] = [];
    for (const [key] of this.cache) {
      if (JSON.stringify(pattern).includes(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    console.log(`[${this.name}] Cache invalidated for ${keysToDelete.length} entries`);
  }

  /**
   * Get cached data
   */
  protected getCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data
   */
  protected setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    let lastError: Error | null = null;
    const maxRetries = this.config.maxRetries || 3;
    const baseDelay = this.config.retryDelayMs || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timeout")),
            this.config.timeout || 5000
          )
        );

        const response = await Promise.race([
          fetch(url, options),
          timeout,
        ]) as Response;

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[${this.name}] Request attempt ${attempt + 1}/${maxRetries} failed:`,
          (error as Error).message
        );

        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Failed to make request");
  }
}
