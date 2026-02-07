/**
 * Market Data Provider
 * Abstract market data source for technical indicators and signal generation
 */

import { createLogger } from '../../utils/index.js';

const log = createLogger('MARKET_DATA_PROVIDER');

// =============================================================================
// Types
// =============================================================================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  bid?: number;
  ask?: number;
  last?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  timestamp: number;
}

export interface MarketDataOptions {
  limit?: number;
  startTime?: number;
  endTime?: number;
}

// =============================================================================
// Market Data Provider
// =============================================================================

export abstract class MarketDataProvider {
  abstract fetchHistoricalData(symbol: string, timeframe: string, options?: MarketDataOptions): Promise<OHLCV[]>;
  abstract fetchQuote(symbol: string): Promise<Quote | null>;
  abstract fetchQuotes(symbols: string[]): Promise<Map<string, Quote>>;

  // Default implementations that can be overridden
  async fetchLatest(symbol: string, timeframe: string, count: number = 1): Promise<OHLCV[]> {
    return this.fetchHistoricalData(symbol, timeframe, { limit: count });
  }

  async subscribeToQuotes(
    symbols: string[],
    callback: (quote: Quote) => void
  ): Promise<() => void> {
    // Default implementation: poll periodically
    log.warn('Real-time subscription not implemented, using polling fallback');

    const interval = setInterval(async () => {
      for (const symbol of symbols) {
        try {
          const quote = await this.fetchQuote(symbol);
          if (quote) {
            callback(quote);
          }
        } catch (error) {
          log.error(`Failed to fetch quote for ${symbol}`, error as Error);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }
}

// =============================================================================
// REST API Market Data Provider
// =============================================================================

export class RestMarketDataProvider extends MarketDataProvider {
  private dataCache = new Map<string, { data: OHLCV[]; timestamp: number }>();
  private quoteCache = new Map<string, { quote: Quote; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private fetchFn: typeof fetch = fetch
  ) {
    super();
  }

  async fetchHistoricalData(
    symbol: string,
    timeframe: string,
    options: MarketDataOptions = {}
  ): Promise<OHLCV[]> {
    const { limit = 100, startTime, endTime } = options;

    // Check cache
    const cacheKey = `${symbol}-${timeframe}-${limit}-${startTime || ''}-${endTime || ''}`;
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const url = new URL(`${this.baseUrl}/history`);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('timeframe', timeframe);
      url.searchParams.set('limit', limit.toString());
      if (startTime) url.searchParams.set('start', startTime.toString());
      if (endTime) url.searchParams.set('end', endTime.toString());

      const response = await this.fetchFn(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform response to OHLCV format
      const ohlcv: OHLCV[] = (data as unknown[]).map((bar: unknown) => {
        const b = bar as Record<string, unknown>;
        return {
          timestamp: (b.t as number) || (b.timestamp as number) || Date.now(),
          open: (b.o as number) || (b.open as number),
          high: (b.h as number) || (b.high as number),
          low: (b.l as number) || (b.low as number),
          close: (b.c as number) || (b.close as number),
          volume: (b.v as number) || (b.volume as number) || 0,
        };
      });

      // Cache result
      this.dataCache.set(cacheKey, { data: ohlcv, timestamp: Date.now() });

      return ohlcv;
    } catch (error) {
      const errorDetails = {
        symbol,
        timeframe,
        limit,
        startTime,
        endTime,
        baseUrl: this.baseUrl,
      };

      // Handle different error types appropriately
      if (error instanceof TypeError && error.message.includes('fetch')) {
        log.error('Network error fetching historical data', error as Error, errorDetails);
        throw new Error(`Network error fetching ${symbol} data: ${error.message}`);
      }

      log.error(`Failed to fetch historical data for ${symbol}`, error as Error, errorDetails);
      // Re-throw instead of returning empty array
      throw new Error(`Failed to fetch historical data for ${symbol}: ${(error as Error).message}`);
    }
  }

  async fetchQuote(symbol: string): Promise<Quote | null> {
    // Check cache
    const cached = this.quoteCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL / 10) { // 6 seconds for quotes
      return cached.quote;
    }

    try {
      const url = new URL(`${this.baseUrl}/quote`);
      url.searchParams.set('symbol', symbol);

      const response = await this.fetchFn(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Return null for 404 (symbol not found) - this is a legitimate response
      if (response.status === 404) {
        log.warn(`Symbol not found: ${symbol}`);
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      const quote: Quote = {
        symbol,
        bid: data.bid as number | undefined,
        ask: data.ask as number | undefined,
        last: (data.last as number | undefined) || (data.price as number | undefined),
        change: data.change as number | undefined,
        changePercent: (data.changePercent as number | undefined) || (data.change_percent as number | undefined),
        volume: data.volume as number | undefined,
        timestamp: (data.timestamp as number | undefined) || Date.now(),
      };

      // Cache result
      this.quoteCache.set(symbol, { quote, timestamp: Date.now() });

      return quote;
    } catch (error) {
      // Re-throw HTTP errors (not 404) and network errors
      if (error instanceof Error && error.message.startsWith('HTTP')) {
        log.error(`Failed to fetch quote for ${symbol}`, error as Error, { symbol, baseUrl: this.baseUrl });
        throw error; // Re-throw HTTP errors
      }

      log.error(`Failed to fetch quote for ${symbol}`, error as Error, { symbol, baseUrl: this.baseUrl });
      throw new Error(`Network error fetching quote for ${symbol}: ${(error as Error).message}`);
    }
  }

  async fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const result = new Map<string, Quote>();

    // Fetch in parallel
    await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await this.fetchQuote(symbol);
        if (quote) {
          result.set(symbol, quote);
        }
      })
    );

    return result;
  }

  clearCache(): void {
    this.dataCache.clear();
    this.quoteCache.clear();
  }
}

// =============================================================================
// Mock Market Data Provider (for testing)
// =============================================================================

export class MockMarketDataProvider extends MarketDataProvider {
  private dataStore = new Map<string, OHLCV[]>();

  constructor() {
    super();
    // Generate some mock data
    this.generateMockData();
  }

  private generateMockData(): void {
    const symbols = ['MNQ', 'MES', 'M2K', 'TQQQ', 'SOXL', 'SPY'];
    const now = Date.now();
    const barSize = 15 * 60 * 1000; // 15 minutes

    for (const symbol of symbols) {
      const data: OHLCV[] = [];
      let price = symbol.startsWith('M') ? 15000 : 100;

      for (let i = 200; i >= 0; i--) {
        const timestamp = now - i * barSize;
        const open = price;
        const change = (Math.random() - 0.5) * price * 0.01;
        const high = Math.max(open, open + change + Math.random() * price * 0.005);
        const low = Math.min(open, open + change - Math.random() * price * 0.005);
        const close = open + change;
        const volume = Math.floor(Math.random() * 10000) + 1000;

        data.push({ timestamp, open, high, low, close, volume });
        price = close;
      }

      this.dataStore.set(symbol, data);
    }
  }

  async fetchHistoricalData(
    symbol: string,
    _timeframe: string,
    options: MarketDataOptions = {}
  ): Promise<OHLCV[]> {
    const { limit = 100 } = options;
    const data = this.dataStore.get(symbol) || [];

    // Return most recent bars
    return data.slice(-limit);
  }

  async fetchQuote(symbol: string): Promise<Quote | null> {
    const data = this.dataStore.get(symbol);
    if (!data || data.length === 0) {
      return null;
    }

    const latest = data[data.length - 1];
    return {
      symbol,
      last: latest.close,
      change: latest.close - latest.open,
      changePercent: ((latest.close - latest.open) / latest.open) * 100,
      volume: latest.volume,
      timestamp: latest.timestamp,
    };
  }

  async fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const result = new Map<string, Quote>();

    for (const symbol of symbols) {
      const quote = await this.fetchQuote(symbol);
      if (quote) {
        result.set(symbol, quote);
      }
    }

    return result;
  }

  // Add custom data for testing
  setHistoricalData(symbol: string, data: OHLCV[]): void {
    this.dataStore.set(symbol, data);
  }

  appendBar(symbol: string, bar: OHLCV): void {
    const data = this.dataStore.get(symbol) || [];
    data.push(bar);
    this.dataStore.set(symbol, data);
  }
}

// =============================================================================
// Global Provider Instance
// =============================================================================

let globalProvider: MarketDataProvider | null = null;

export function setMarketDataProvider(provider: MarketDataProvider): void {
  globalProvider = provider;
}

export function getMarketDataProvider(): MarketDataProvider {
  if (!globalProvider) {
    // Default to mock provider for now
    globalProvider = new MockMarketDataProvider();
  }
  return globalProvider;
}
