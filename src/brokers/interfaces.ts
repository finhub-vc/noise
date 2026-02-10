/**
 * Broker Adapter Interface
 * Re-exports BrokerAdapter from types for convenience
 */

export type { BrokerAdapter } from '../types/broker.js';

// =============================================================================
// Market Data Capabilities Interface
// =============================================================================

/**
 * Interface for adapters that support fetching market data.
 * Adapters can optionally implement these methods for real-time quotes
 * and historical OHLCV data.
 */
export interface MarketDataCapable {
  /**
   * Fetch a single quote for a symbol
   * @param symbol The ticker symbol
   * @returns Quote data or null if not found
   */
  getQuote(symbol: string): Promise<QuoteData | null>;

  /**
   * Fetch quotes for multiple symbols
   * @param symbols Array of ticker symbols
   * @returns Map of symbol to quote data
   */
  getQuotes(symbols: string[]): Promise<Map<string, QuoteData>>;

  /**
   * Fetch historical OHLCV bars
   * @param symbol The ticker symbol
   * @param timeframe Timeframe in minutes (1, 5, 15, 60, 1440 for daily)
   * @param limit Number of bars to fetch
   * @returns Array of OHLCV bars
   */
  getHistoricalData(symbol: string, timeframe: number, limit: number): Promise<BarData[]>;
}

/**
 * Raw quote data from broker APIs
 */
export interface QuoteData {
  symbol?: string;
  bid: number;
  ask: number;
  last: number;
  bidPrice?: number;
  askPrice?: number;
  lastTrade?: number;
  lastTradePrice?: number;
  change?: number;
  changePercent?: number;
  change_percent?: number;
  volume?: number;
  vol?: number;
  timestamp: number | string;
  t?: number | string;
}

/**
 * Raw bar data from broker APIs
 */
export interface BarData {
  timestamp: number | string;
  t?: number | string;
  time?: number | string;
  open: number;
  o?: number;
  Open?: number;
  high: number;
  h?: number;
  High?: number;
  low: number;
  l?: number;
  Low?: number;
  close: number;
  c?: number;
  Close?: number;
  volume: number;
  v?: number;
  Volume?: number;
}

/**
 * Type guard to check if an adapter supports market data methods
 */
export function isMarketDataCapable(adapter: BrokerAdapter): adapter is BrokerAdapter & MarketDataCapable {
  return (
    'getQuote' in adapter &&
    typeof adapter.getQuote === 'function' &&
    'getQuotes' in adapter &&
    typeof adapter.getQuotes === 'function' &&
    'getHistoricalData' in adapter &&
    typeof adapter.getHistoricalData === 'function'
  );
}
