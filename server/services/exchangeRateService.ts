/**
 * Exchange Rate Service
 * Fetches real-time USD to KES exchange rates from market data APIs
 * with caching and fallback to default rate
 */

let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 3600000; // 1 hour cache
const DEFAULT_RATE = 129; // Fallback rate if API fails

export class ExchangeRateService {
  /**
   * Get current USD to KES exchange rate
   * Uses cached rate if available and fresh, otherwise fetches from API
   */
  static async getUSDtoKESRate(): Promise<number> {
    try {
      // Return cached rate if fresh
      if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
        console.log(`[ExchangeRate] Using cached rate: ${cachedRate.rate}`);
        return cachedRate.rate;
      }

      // Try exchangerate-api.com free tier
      const rate = await this.fetchFromExchangeRateAPI();
      
      if (rate) {
        cachedRate = { rate, timestamp: Date.now() };
        console.log(`[ExchangeRate] Fetched new rate from API: ${rate}`);
        return rate;
      }

      // Fallback: return cached rate even if stale
      if (cachedRate) {
        console.warn(`[ExchangeRate] API failed, using stale cached rate: ${cachedRate.rate}`);
        return cachedRate.rate;
      }

      // Final fallback: use default rate
      console.warn(`[ExchangeRate] All sources failed, using default rate: ${DEFAULT_RATE}`);
      cachedRate = { rate: DEFAULT_RATE, timestamp: Date.now() };
      return DEFAULT_RATE;
    } catch (error) {
      console.error('[ExchangeRate] Error fetching rate:', error);
      
      // Return cached or default rate on error
      if (cachedRate) {
        return cachedRate.rate;
      }
      
      cachedRate = { rate: DEFAULT_RATE, timestamp: Date.now() };
      return DEFAULT_RATE;
    }
  }

  /**
   * Fetch rate from exchangerate-api.com (free tier)
   * Free tier: 1500 requests/month
   */
  private static async fetchFromExchangeRateAPI(): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[ExchangeRate] API returned status ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.rates && data.rates.KES) {
        const rate = parseFloat(data.rates.KES);
        if (rate > 0) {
          return rate;
        }
      }

      console.warn('[ExchangeRate] Invalid response structure from API');
      return null;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[ExchangeRate] API request timeout');
      } else {
        console.warn('[ExchangeRate] Failed to fetch from exchangerate-api:', error.message);
      }
      return null;
    }
  }

  /**
   * Convert USD to KES using current rate
   */
  static async convertUSDtoKES(amountUSD: number): Promise<number> {
    const rate = await this.getUSDtoKESRate();
    return amountUSD * rate;
  }

  /**
   * Convert KES to USD using current rate
   */
  static async convertKEStoUSD(amountKES: number): Promise<number> {
    const rate = await this.getUSDtoKESRate();
    return amountKES / rate;
  }
}

export const exchangeRateService = ExchangeRateService;
