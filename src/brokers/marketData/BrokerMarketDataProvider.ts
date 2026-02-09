/**
 * Broker Market Data Provider
 * Integrates with Tradovate and Alpaca adapters for real market data
 */

import type { OHLCV, Quote, MarketDataOptions } from '../../signals/marketData/MarketDataProvider.js';
import { MarketDataProvider } from '../../signals/marketData/MarketDataProvider.js';
import type { BrokerAdapter } from '../interfaces.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('BROKER_MD_PROVIDER');

// =============================================================================
// Constants
// =============================================================================

/** Default cache TTL for historical data (60 seconds) */
const DEFAULT_CACHE_TTL_MS = 60_000;

/** Default cache TTL for quotes (5 seconds) */
const DEFAULT_QUOTE_CACHE_TTL_MS = 5_000;

/** Futures symbols that route to Tradovate */
const FUTURES_SYMBOLS = ['MNQ', 'MES', 'M2K', 'MCL', 'MGC', 'NQ', 'ES', 'RTY', 'CL', 'GC'] as const;

/** Regex pattern for futures contract months (e.g., NQH25, ESM4) */
const FUTURES_CONTRACT_PATTERN = /^(MNQ|MES|M2K|MCL|MGC|NQ|ES|RTY|CL|GC)[FGHJKMNQUVXZ]\d{1,2}$/;

/** Default timeframe in minutes when parsing fails */
const DEFAULT_TIMEFRAME_MINUTES = 15;

/** Maximum symbols per batch request to prevent API overwhelming */
const MAX_BATCH_SYMBOLS = 100;

// =============================================================================
// Broker Market Data Provider
// =============================================================================

export class BrokerMarketDataProvider extends MarketDataProvider {
  private dataCache = new Map<string, { data: OHLCV[]; timestamp: number }>();
  private quoteCache = new Map<string, { quote: Quote; timestamp: number }>();
  private readonly cacheTtlMs: number;
  private readonly quoteCacheTtlMs: number;

  constructor(
    private tradovateAdapter: BrokerAdapter | null = null,
    private alpacaAdapter: BrokerAdapter | null = null,
    options?: { cacheTtlMs?: number; quoteCacheTtlMs?: number }
  ) {
    super();
    this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.quoteCacheTtlMs = options?.quoteCacheTtlMs ?? DEFAULT_QUOTE_CACHE_TTL_MS;
  }

  // -------------------------------------------------------------------------
  // Symbol Routing
  // -------------------------------------------------------------------------

  private getAdapterForSymbol(symbol: string): BrokerAdapter | null {
    // Futures symbols go to Tradovate
    // Check for exact match first (e.g., "MNQ", "ES")
    if (FUTURES_SYMBOLS.some(s => symbol === s)) {
      return this.tradovateAdapter;
    }

    // Check for futures contract pattern (e.g., "NQH25", "ESM4")
    if (FUTURES_CONTRACT_PATTERN.test(symbol)) {
      return this.tradovateAdapter;
    }

    // Everything else goes to Alpaca
    return this.alpacaAdapter;
  }

  // -------------------------------------------------------------------------
  // Historical Data
  // -------------------------------------------------------------------------

  async fetchHistoricalData(
    symbol: string,
    timeframe: string,
    options: MarketDataOptions = {}
  ): Promise<OHLCV[]> {
    const { limit = 100 } = options;

    // Check cache
    const cacheKey = `${symbol}-${timeframe}-${limit}`;
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const adapter = this.getAdapterForSymbol(symbol);
    if (!adapter) {
      throw new Error(`No adapter available for symbol: ${symbol}`);
    }

    // Parse timeframe (e.g., "15m", "1h", "1d")
    const minutes = this.parseTimeframeToMinutes(timeframe);

    try {
      // Try to get data from broker adapter
      const bars = await this.fetchFromAdapter(adapter, symbol, minutes, limit);
      const ohlcv = bars.map(bar => this.normalizeBar(bar));

      // Cache result
      this.dataCache.set(cacheKey, { data: ohlcv, timestamp: Date.now() });

      return ohlcv;
    } catch (error) {
      log.error(`Failed to fetch historical data for ${symbol}`, error as Error);
      throw new Error(`Failed to fetch historical data for ${symbol}: ${(error as Error).message}`);
    }
  }

  private async fetchFromAdapter(
    adapter: BrokerAdapter,
    symbol: string,
    minutes: number,
    limit: number
  ): Promise<unknown[]> {
    // Check if adapter has market data methods
    if ('getHistoricalData' in adapter && typeof adapter.getHistoricalData === 'function') {
      return await (adapter as { getHistoricalData: (s: string, tf: number, l: number) => Promise<unknown[]> })
        .getHistoricalData(symbol, minutes, limit);
    }

    throw new Error(`Adapter ${adapter.getBrokerType()} does not support historical data`);
  }

  private normalizeBar(bar: unknown): OHLCV {
    const b = bar as Record<string, unknown>;
    return {
      timestamp: this.normalizeTimestamp(b.t || b.timestamp || b.time),
      open: this.normalizeNumber(b.o || b.open || b.Open),
      high: this.normalizeNumber(b.h || b.high || b.High),
      low: this.normalizeNumber(b.l || b.low || b.Low),
      close: this.normalizeNumber(b.c || b.close || b.Close),
      volume: this.normalizeNumber(b.v || b.volume || b.Volume) || 0,
    };
  }

  private normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!isNaN(parsed)) return parsed;
    }
    return Date.now();
  }

  private normalizeNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return 0;
  }

  private parseTimeframeToMinutes(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([mhd])$/i);
    if (!match) {
      log.warn(`Invalid timeframe format: ${timeframe}, defaulting to ${DEFAULT_TIMEFRAME_MINUTES}m`);
      return DEFAULT_TIMEFRAME_MINUTES;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 1440;
      default: return DEFAULT_TIMEFRAME_MINUTES;
    }
  }

  // -------------------------------------------------------------------------
  // Quotes
  // -------------------------------------------------------------------------

  async fetchQuote(symbol: string): Promise<Quote | null> {
    // Check cache (shorter TTL for quotes)
    const cached = this.quoteCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.quoteCacheTtlMs) {
      return cached.quote;
    }

    const adapter = this.getAdapterForSymbol(symbol);
    if (!adapter) {
      log.warn(`No adapter available for symbol: ${symbol}`);
      return null;
    }

    try {
      // Try to get quote from broker adapter
      const quote = await this.fetchQuoteFromAdapter(adapter, symbol);
      if (!quote) return null;

      const normalized = this.normalizeQuote(symbol, quote);

      // Cache result
      this.quoteCache.set(symbol, { quote: normalized, timestamp: Date.now() });

      return normalized;
    } catch (error) {
      log.error(`Failed to fetch quote for ${symbol}`, error as Error);
      return null;
    }
  }

  async fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const result = new Map<string, Quote>();

    // Group by adapter
    const tradovateSymbols: string[] = [];
    const alpacaSymbols: string[] = [];

    for (const symbol of symbols) {
      const adapter = this.getAdapterForSymbol(symbol);
      if (adapter === this.tradovateAdapter) {
        tradovateSymbols.push(symbol);
      } else if (adapter === this.alpacaAdapter) {
        alpacaSymbols.push(symbol);
      }
    }

    // Fetch from each adapter in parallel
    await Promise.all([
      this.fetchBatchFromAdapter(this.tradovateAdapter, tradovateSymbols, result),
      this.fetchBatchFromAdapter(this.alpacaAdapter, alpacaSymbols, result),
    ]);

    return result;
  }

  private async fetchBatchFromAdapter(
    adapter: BrokerAdapter | null,
    symbols: string[],
    result: Map<string, Quote>
  ): Promise<void> {
    if (!adapter || symbols.length === 0) return;

    // Process in batches to prevent overwhelming the API
    for (let i = 0; i < symbols.length; i += MAX_BATCH_SYMBOLS) {
      const batch = symbols.slice(i, i + MAX_BATCH_SYMBOLS);

      if ('getQuotes' in adapter && typeof adapter.getQuotes === 'function') {
        try {
          const quotes = await (adapter as { getQuotes: (symbols: string[]) => Promise<Map<string, unknown>> })
            .getQuotes(batch);

          for (const [symbol, quote] of quotes.entries()) {
            result.set(symbol, this.normalizeQuote(symbol, quote));
          }
        } catch (error) {
          log.error(`Batch quote fetch failed for ${adapter.getBrokerType()}`, error as Error);
          // Fallback to individual requests for this batch
          await Promise.all(
            batch.map(async (symbol) => {
              const quote = await this.fetchQuote(symbol);
              if (quote) result.set(symbol, quote);
            })
          );
        }
      } else {
        // Fallback: fetch individually
        await Promise.all(
          batch.map(async (symbol) => {
            const quote = await this.fetchQuote(symbol);
            if (quote) result.set(symbol, quote);
          })
        );
      }
    }
  }

  private async fetchQuoteFromAdapter(adapter: BrokerAdapter, symbol: string): Promise<unknown | null> {
    if ('getQuote' in adapter && typeof adapter.getQuote === 'function') {
      return await (adapter as { getQuote: (symbol: string) => Promise<unknown> })
        .getQuote(symbol);
    }
    if ('getMarketData' in adapter && typeof adapter.getMarketData === 'function') {
      return await (adapter as { getMarketData: (symbol: string) => Promise<unknown | null> })
        .getMarketData(symbol);
    }
    return null;
  }

  private normalizeQuote(symbol: string, quote: unknown): Quote {
    const q = quote as Record<string, unknown>;
    return {
      symbol,
      bid: this.normalizeNumber(q.bid || q.bidPrice || q.bid_price),
      ask: this.normalizeNumber(q.ask || q.askPrice || q.ask_price),
      last: this.normalizeNumber(q.last || q.lastTrade || q.last_price || q.lastTradePrice),
      change: this.normalizeNumber(q.change),
      changePercent: this.normalizeNumber(q.changePercent || q.change_percent),
      volume: this.normalizeNumber(q.volume || q.vol),
      timestamp: this.normalizeTimestamp(q.timestamp || q.t),
    };
  }

  // -------------------------------------------------------------------------
  // Cache Management
  // -------------------------------------------------------------------------

  /**
   * Clear all cached data (both historical and quotes)
   */
  clearCache(): void {
    this.dataCache.clear();
    this.quoteCache.clear();
  }

  /**
   * Clear all cached data for a specific symbol
   * @param symbol - The symbol to clear from cache
   */
  clearSymbolCache(symbol: string): void {
    for (const key of this.dataCache.keys()) {
      if (key.startsWith(`${symbol}-`)) {
        this.dataCache.delete(key);
      }
    }
    this.quoteCache.delete(symbol);
  }

  // -------------------------------------------------------------------------
  // Adapter Management
  // -------------------------------------------------------------------------

  /**
   * Set or update the Tradovate adapter
   * Clears cache when adapter changes to prevent stale data
   * @param adapter - The Tradovate adapter instance or null
   */
  setTradovateAdapter(adapter: BrokerAdapter | null): void {
    this.tradovateAdapter = adapter;
    this.clearCache();
  }

  /**
   * Set or update the Alpaca adapter
   * Clears cache when adapter changes to prevent stale data
   * @param adapter - The Alpaca adapter instance or null
   */
  setAlpacaAdapter(adapter: BrokerAdapter | null): void {
    this.alpacaAdapter = adapter;
    this.clearCache();
  }

  /**
   * Get the current adapter instances
   * @returns Object containing both adapter instances
   */
  getAdapters(): { tradovate: BrokerAdapter | null; alpaca: BrokerAdapter | null } {
    return {
      tradovate: this.tradovateAdapter,
      alpaca: this.alpacaAdapter,
    };
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalBrokerProvider: BrokerMarketDataProvider | null = null;

export function getBrokerMarketDataProvider(): BrokerMarketDataProvider {
  if (!globalBrokerProvider) {
    globalBrokerProvider = new BrokerMarketDataProvider(null, null);
  }
  return globalBrokerProvider;
}

export function setBrokerMarketDataProvider(provider: BrokerMarketDataProvider): void {
  globalBrokerProvider = provider;
}
