/**
 * Tests for BrokerMarketDataProvider
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrokerMarketDataProvider } from '../../../src/brokers/marketData/BrokerMarketDataProvider.js';
import type { BrokerAdapter } from '../../../src/brokers/interfaces.js';
import type { OHLCV, Quote } from '../../../src/signals/marketData/MarketDataProvider.js';

// Mock broker adapter
class MockBrokerAdapter implements BrokerAdapter {
  private connected = false;
  private quotes = new Map<string, { last: number; bid: number; ask: number; timestamp: number }>();
  private historicalData = new Map<string, OHLCV[]>();

  async authenticate(): Promise<void> {
    this.connected = true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getBrokerType(): 'TRADOVATE' | 'ALPACA' {
    return 'ALPACA';
  }

  getAssetClass(): 'FUTURES' | 'EQUITY' {
    return 'EQUITY';
  }

  getSupportedSymbols(): string[] {
    return ['TQQQ', 'SOXL', 'SPY'];
  }

  async getAccount() {
    return {
      broker: 'ALPACA' as const,
      accountId: 'test',
      equity: 100000,
      cash: 50000,
      buyingPower: 200000,
      lastUpdated: Date.now(),
    };
  }

  async getPositions() {
    return [];
  }

  async placeOrder() {
    return {
      clientOrderId: 'test',
      status: 'FILLED' as const,
      timestamp: Date.now(),
    };
  }

  async cancelOrder(): Promise<void> {
    // Mock
  }

  async getOrderStatus() {
    return {
      orderId: 'test',
      status: 'FILLED' as const,
      filledQuantity: 1,
      remainingQuantity: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Market data methods
  setMockQuote(symbol: string, quote: { last: number; bid: number; ask: number }): void {
    this.quotes.set(symbol, { ...quote, timestamp: Date.now() });
  }

  async getQuote(symbol: string) {
    return this.quotes.get(symbol) || null;
  }

  async getQuotes(symbols: string[]) {
    const result = new Map<string, { last: number; bid: number; ask: number; timestamp: number }>();
    for (const symbol of symbols) {
      const quote = this.quotes.get(symbol);
      if (quote) {
        result.set(symbol, quote);
      }
    }
    return result;
  }

  setMockHistoricalData(symbol: string, data: OHLCV[]): void {
    this.historicalData.set(symbol, data);
  }

  async getHistoricalData(_symbol: string, _timeframe: number, _limit: number) {
    return [];
  }
}

describe('BrokerMarketDataProvider', () => {
  let provider: BrokerMarketDataProvider;
  let tradovateAdapter: MockBrokerAdapter;
  let alpacaAdapter: MockBrokerAdapter;

  beforeEach(() => {
    tradovateAdapter = new MockBrokerAdapter();
    alpacaAdapter = new MockBrokerAdapter();
    provider = new BrokerMarketDataProvider(tradovateAdapter, alpacaAdapter);
  });

  afterEach(() => {
    provider.clearCache();
  });

  describe('fetchQuote', () => {
    it('should return null for unknown symbols', async () => {
      const quote = await provider.fetchQuote('UNKNOWN');
      expect(quote).toBeNull();
    });

    it('should fetch and normalize quote from Alpaca adapter', async () => {
      alpacaAdapter.setMockQuote('TQQQ', {
        last: 50.25,
        bid: 50.20,
        ask: 50.30,
      });

      const quote = await provider.fetchQuote('TQQQ') as Quote;

      expect(quote).not.toBeNull();
      expect(quote?.symbol).toBe('TQQQ');
      expect(quote?.last).toBe(50.25);
      expect(quote?.bid).toBe(50.20);
      expect(quote?.ask).toBe(50.30);
    });

    it('should cache quotes for short TTL', async () => {
      alpacaAdapter.setMockQuote('SPY', {
        last: 400.00,
        bid: 399.99,
        ask: 400.01,
      });

      const quote1 = await provider.fetchQuote('SPY');
      const quote2 = await provider.fetchQuote('SPY');

      expect(quote1).toEqual(quote2);
    });
  });

  describe('fetchQuotes', () => {
    it('should fetch multiple quotes in parallel', async () => {
      alpacaAdapter.setMockQuote('TQQQ', { last: 50, bid: 49.9, ask: 50.1 });
      alpacaAdapter.setMockQuote('SOXL', { last: 30, bid: 29.9, ask: 30.1 });
      alpacaAdapter.setMockQuote('SPY', { last: 400, bid: 399.9, ask: 400.1 });

      const quotes = await provider.fetchQuotes(['TQQQ', 'SOXL', 'SPY']);

      expect(quotes.size).toBe(3);
      expect(quotes.get('TQQQ')?.last).toBe(50);
      expect(quotes.get('SOXL')?.last).toBe(30);
      expect(quotes.get('SPY')?.last).toBe(400);
    });

    it('should handle partial failures gracefully', async () => {
      alpacaAdapter.setMockQuote('TQQQ', { last: 50, bid: 49.9, ask: 50.1 });
      // SOXL not set

      const quotes = await provider.fetchQuotes(['TQQQ', 'SOXL']);

      expect(quotes.size).toBe(1);
      expect(quotes.has('TQQQ')).toBe(true);
      expect(quotes.has('SOXL')).toBe(false);
    });
  });

  describe('fetchHistoricalData', () => {
    it('should return empty array for symbols without data', async () => {
      const bars = await provider.fetchHistoricalData('UNKNOWN', '15m', { limit: 100 });
      expect(bars).toEqual([]);
    });

    it('should normalize different bar formats', async () => {
      // Mock with abbreviated keys (like Alpaca)
      const mockBars = [
        { t: '2024-01-01T10:00:00Z', o: 100, h: 105, l: 95, c: 103, v: 1000 },
        { t: '2024-01-01T10:15:00Z', o: 103, h: 108, l: 102, c: 107, v: 1200 },
      ];

      // Spy on the adapter's getHistoricalData method
      const spy = vi.spyOn(alpacaAdapter, 'getHistoricalData').mockResolvedValue(mockBars as any);

      const bars = await provider.fetchHistoricalData('TQQQ', '15m', { limit: 100 });

      expect(bars.length).toBe(2);
      expect(bars[0].open).toBe(100);
      expect(bars[0].high).toBe(105);
      expect(bars[0].low).toBe(95);
      expect(bars[0].close).toBe(103);
      expect(bars[0].volume).toBe(1000);
      expect(bars[1].open).toBe(103);

      spy.mockRestore();
    });

    it('should cache historical data', async () => {
      const mockBars = [
        { t: '2024-01-01T10:00:00Z', o: 100, h: 105, l: 95, c: 103, v: 1000 },
      ];

      const spy = vi.spyOn(alpacaAdapter, 'getHistoricalData').mockResolvedValue(mockBars as any);

      await provider.fetchHistoricalData('TQQQ', '15m', { limit: 100 });
      await provider.fetchHistoricalData('TQQQ', '15m', { limit: 100 });

      // Should only call once due to caching
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });
  });

  describe('parseTimeframeToMinutes', () => {
    it('should parse minute timeframes', () => {
      const provider = new BrokerMarketDataProvider();
      // Access private method through type assertion for testing
      const parse = (provider as any).parseTimeframeToMinutes.bind(provider);

      expect(parse('1m')).toBe(1);
      expect(parse('5m')).toBe(5);
      expect(parse('15m')).toBe(15);
      expect(parse('60m')).toBe(60);
    });

    it('should parse hour timeframes', () => {
      const provider = new BrokerMarketDataProvider();
      const parse = (provider as any).parseTimeframeToMinutes.bind(provider);

      expect(parse('1h')).toBe(60);
      expect(parse('4h')).toBe(240);
    });

    it('should parse day timeframes', () => {
      const provider = new BrokerMarketDataProvider();
      const parse = (provider as any).parseTimeframeToMinutes.bind(provider);

      expect(parse('1d')).toBe(1440);
    });

    it('should default to 15m for invalid formats', () => {
      const provider = new BrokerMarketDataProvider();
      const parse = (provider as any).parseTimeframeToMinutes.bind(provider);

      expect(parse('invalid')).toBe(15);
    });
  });

  describe('adapter management', () => {
    it('should update adapters and clear cache', async () => {
      alpacaAdapter.setMockQuote('TQQQ', { last: 50, bid: 49.9, ask: 50.1 });

      const quote1 = await provider.fetchQuote('TQQQ');
      expect(quote1?.last).toBe(50);

      // Change adapter (simulating reconnection)
      const newAdapter = new MockBrokerAdapter();
      provider.setAlpacaAdapter(newAdapter);

      // Cache should be cleared
      const quote2 = await provider.fetchQuote('TQQQ');
      expect(quote2).toBeNull(); // New adapter has no data
    });

    it('should return current adapters', () => {
      const adapters = provider.getAdapters();

      expect(adapters.tradovate).toBe(tradovateAdapter);
      expect(adapters.alpaca).toBe(alpacaAdapter);
    });
  });

  describe('symbol routing', () => {
    it('should route futures symbols to Tradovate adapter', () => {
      const getAdapter = (provider as any).getAdapterForSymbol.bind(provider);

      expect(getAdapter('MNQ')).toBe(tradovateAdapter);
      expect(getAdapter('MES')).toBe(tradovateAdapter);
      expect(getAdapter('M2K')).toBe(tradovateAdapter);
      expect(getAdapter('MCL')).toBe(tradovateAdapter);
      expect(getAdapter('MGC')).toBe(tradovateAdapter);
    });

    it('should route equity symbols to Alpaca adapter', () => {
      const getAdapter = (provider as any).getAdapterForSymbol.bind(provider);

      expect(getAdapter('TQQQ')).toBe(alpacaAdapter);
      expect(getAdapter('SOXL')).toBe(alpacaAdapter);
      expect(getAdapter('SPY')).toBe(alpacaAdapter);
    });
  });
});
