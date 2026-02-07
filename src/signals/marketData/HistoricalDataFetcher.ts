/**
 * Historical Data Fetcher
 * Specialized utility for fetching and managing historical market data
 */

import type { OHLCV, MarketDataOptions } from './MarketDataProvider.js';
import { getMarketDataProvider } from './MarketDataProvider.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('HISTORICAL_DATA');

// =============================================================================
// Historical Data Cache
// =============================================================================

interface CacheEntry {
  data: OHLCV[];
  timestamp: number;
}

export class HistoricalDataFetcher {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  // -------------------------------------------------------------------------
  // Fetch Methods
  // -------------------------------------------------------------------------

  async fetch(
    symbol: string,
    timeframe: string,
    options?: MarketDataOptions
  ): Promise<OHLCV[]> {
    const provider = getMarketDataProvider();
    const cacheKey = this.getCacheKey(symbol, timeframe, options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Fetch from provider
    try {
      const data = await provider.fetchHistoricalData(symbol, timeframe, options);

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      log.error(`Failed to fetch historical data for ${symbol}`, error as Error, {
        symbol,
        timeframe,
        limit: options?.limit,
        startTime: options?.startTime,
        endTime: options?.endTime,
      });
      // Re-throw to let caller handle the error instead of masking it with empty array
      throw new Error(`Failed to fetch historical data for ${symbol}: ${(error as Error).message}`);
    }
  }

  async fetchMultiple(
    symbols: string[],
    timeframe: string,
    options?: MarketDataOptions
  ): Promise<Map<string, OHLCV[]>> {
    const result = new Map<string, OHLCV[]>();

    // Fetch in parallel
    await Promise.all(
      symbols.map(async (symbol) => {
        const data = await this.fetch(symbol, timeframe, options);
        result.set(symbol, data);
      })
    );

    return result;
  }

  async fetchLatestBars(
    symbol: string,
    timeframe: string,
    count: number
  ): Promise<OHLCV[]> {
    return this.fetch(symbol, timeframe, { limit: count });
  }

  async fetchDateRange(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number
  ): Promise<OHLCV[]> {
    return this.fetch(symbol, timeframe, { startTime, endTime });
  }

  // -------------------------------------------------------------------------
  // Data Utilities
  // -------------------------------------------------------------------------

  getLatestBar(symbol: string, timeframe: string): Promise<OHLCV | null> {
    return this.fetchLatestBars(symbol, timeframe, 1).then((bars) => {
      return bars.length > 0 ? bars[0] : null;
    });
  }

  getLatestClose(symbol: string, timeframe: string): Promise<number> {
    return this.getLatestBar(symbol, timeframe).then((bar) => {
      return bar?.close ?? 0;
    });
  }

  // -------------------------------------------------------------------------
  // Cache Management
  // -------------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear();
  }

  clearSymbolCache(symbol: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${symbol}-`)) {
        this.cache.delete(key);
      }
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private getCacheKey(symbol: string, timeframe: string, options?: MarketDataOptions): string {
    const parts = [symbol, timeframe];
    if (options?.limit) parts.push(`l:${options.limit}`);
    if (options?.startTime) parts.push(`s:${options.startTime}`);
    if (options?.endTime) parts.push(`e:${options.endTime}`);
    return parts.join('-');
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalFetcher: HistoricalDataFetcher | null = null;

export function getHistoricalDataFetcher(): HistoricalDataFetcher {
  if (!globalFetcher) {
    globalFetcher = new HistoricalDataFetcher();
  }
  return globalFetcher;
}
