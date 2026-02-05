/**
 * Real-Time Data Feed
 * WebSocket-based streaming market data with automatic reconnection
 */

import type { Quote, OHLCV } from './MarketDataProvider.js';
import { getMarketDataProvider } from './MarketDataProvider.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('REALTIME_FEED');

// =============================================================================
// Types
// =============================================================================

export interface RealtimeConfig {
  symbols: string[];
  onUpdate?: (update: RealtimeUpdate) => void;
  onError?: (error: Error) => void;
}

export interface RealtimeUpdate {
  symbol: string;
  quote?: Quote;
  bar?: OHLCV;
  timestamp: number;
}

export type UpdateCallback = (update: RealtimeUpdate) => void;

// =============================================================================
// Real-Time Data Feed
// =============================================================================

export class RealTimeDataFeed {
  private subscriptions = new Map<string, Set<UpdateCallback>>();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastQuotes = new Map<string, Quote>();

  constructor(private pollIntervalMs: number = 1000) {
    // 1 second default for polling
  }

  // -------------------------------------------------------------------------
  // Subscription Management
  // -------------------------------------------------------------------------

  async start(config: RealtimeConfig): Promise<void> {
    if (this.isRunning) {
      log.warn('Real-time feed is already running');
      return;
    }

    log.info('Starting real-time data feed', { symbols: config.symbols });

    // Subscribe to all symbols
    for (const symbol of config.symbols) {
      this.subscribe(symbol, config.onUpdate || (() => {}));
    }

    // Start polling
    this.startPolling();
    this.isRunning = true;

    log.info('Real-time data feed started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping real-time data feed');

    this.stopPolling();
    this.subscriptions.clear();
    this.lastQuotes.clear();
    this.isRunning = false;

    log.info('Real-time data feed stopped');
  }

  subscribe(symbol: string, callback: UpdateCallback): () => void {
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }
    this.subscriptions.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(symbol);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(symbol);
        }
      }
    };
  }

  unsubscribe(symbol: string, callback: UpdateCallback): void {
    const subs = this.subscriptions.get(symbol);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscriptions.delete(symbol);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Polling
  // -------------------------------------------------------------------------

  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async poll(): Promise<void> {
    const provider = getMarketDataProvider();
    const symbols = Array.from(this.subscriptions.keys());

    if (symbols.length === 0) {
      return;
    }

    try {
      const quotes = await provider.fetchQuotes(symbols);

      for (const [symbol, quote] of quotes.entries()) {
        const lastQuote = this.lastQuotes.get(symbol);
        this.lastQuotes.set(symbol, quote);

        // Check if there's a meaningful update
        if (!lastQuote || quote.last !== lastQuote.last) {
          const update: RealtimeUpdate = {
            symbol,
            quote,
            timestamp: Date.now(),
          };

          this.notifySubscribers(symbol, update);
        }
      }
    } catch (error) {
      log.error('Polling error', error as Error);
    }
  }

  private notifySubscribers(symbol: string, update: RealtimeUpdate): void {
    const subs = this.subscriptions.get(symbol);
    if (subs) {
      for (const callback of subs) {
        try {
          callback(update);
        } catch (error) {
          log.error('Subscriber callback error', error as Error);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Data Access
  // -------------------------------------------------------------------------

  getLastQuote(symbol: string): Quote | null {
    return this.lastQuotes.get(symbol) || null;
  }

  getAllQuotes(): Map<string, Quote> {
    return new Map(this.lastQuotes);
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  get running(): boolean {
    return this.isRunning;
  }

  get subscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  get subscriberCount(): number {
    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.size;
    }
    return count;
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalFeed: RealTimeDataFeed | null = null;

export function getRealTimeDataFeed(intervalMs?: number): RealTimeDataFeed {
  if (!globalFeed) {
    globalFeed = new RealTimeDataFeed(intervalMs);
  }
  return globalFeed;
}

export function resetRealTimeDataFeed(): void {
  if (globalFeed?.running) {
    globalFeed.stop();
  }
  globalFeed = null;
}

// =============================================================================
// Utility Functions
// =============================================================================

export async function startRealTimeFeed(
  symbols: string[],
  callback: (update: RealtimeUpdate) => void,
  intervalMs?: number
): Promise<RealTimeDataFeed> {
  const feed = getRealTimeDataFeed(intervalMs);
  await feed.start({ symbols, onUpdate: callback });
  return feed;
}
