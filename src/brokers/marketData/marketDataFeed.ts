/**
 * Market Data Feed
 * Unified interface for real-time market data from multiple brokers
 */

import type { PriceUpdate } from './WebSocketClient.js';
import { WebSocketClient, createTradovateWebSocket, createAlpacaWebSocket } from './WebSocketClient.js';
import { createLogger } from '../../utils/index.js';

const log = createLogger('MARKET_DATA_FEED');

// =============================================================================
// Types
// =============================================================================

export interface MarketDataConfig {
  enableTradovate?: boolean;
  enableAlpaca?: boolean;
}

export interface Subscription {
  symbol: string;
  broker: 'tradovate' | 'alpaca';
  callback: (update: PriceUpdate) => void;
}

// =============================================================================
// Market Data Feed
// =============================================================================

export class MarketDataFeed {
  private tradovateClient: WebSocketClient | null = null;
  private alpacaClient: WebSocketClient | null = null;
  private subscriptions = new Map<string, Set<Subscription>>();
  private priceBuffer = new Map<string, PriceUpdate>();

  constructor(config: MarketDataConfig = {}) {
    if (config.enableTradovate ?? true) {
      this.tradovateClient = createTradovateWebSocket();
    }
    if (config.enableAlpaca ?? true) {
      this.alpacaClient = createAlpacaWebSocket();
    }
  }

  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    const connections: Promise<void>[] = [];

    if (this.tradovateClient) {
      connections.push(this.connectTradovate());
    }
    if (this.alpacaClient) {
      connections.push(this.connectAlpaca());
    }

    await Promise.allSettled(connections);
  }

  disconnect(): void {
    this.tradovateClient?.disconnect();
    this.alpacaClient?.disconnect();
  }

  private async connectTradovate(): Promise<void> {
    if (!this.tradovateClient) return;

    try {
      await this.tradovateClient.connect();

      // Subscribe to all Tradovate symbols
      const tradovateSymbols = this.getTradovateSymbols();
      if (tradovateSymbols.length > 0) {
        this.tradovateClient.subscribe(tradovateSymbols);
      }

      // Handle price updates
      this.tradovateClient.onPriceUpdate((update) => {
        this.handlePriceUpdate(update, 'tradovate');
      });
    } catch (error) {
      log.error('Failed to connect to Tradovate WebSocket', error as Error);
    }
  }

  private async connectAlpaca(): Promise<void> {
    if (!this.alpacaClient) return;

    try {
      await this.alpacaClient.connect();

      // Subscribe to all Alpaca symbols
      const alpacaSymbols = this.getAlpacaSymbols();
      if (alpacaSymbols.length > 0) {
        this.alpacaClient.subscribe(alpacaSymbols);
      }

      // Handle price updates
      this.alpacaClient.onPriceUpdate((update) => {
        this.handlePriceUpdate(update, 'alpaca');
      });
    } catch (error) {
      log.error('Failed to connect to Alpaca WebSocket', error as Error);
    }
  }

  // -------------------------------------------------------------------------
  // Subscription Management
  // -------------------------------------------------------------------------

  subscribe(symbol: string, broker: 'tradovate' | 'alpaca', callback: (update: PriceUpdate) => void): () => void {
    const subscription: Subscription = { symbol, broker, callback };

    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }
    this.subscriptions.get(symbol)!.add(subscription);

    // Subscribe to WebSocket if connected
    const client = broker === 'tradovate' ? this.tradovateClient : this.alpacaClient;
    if (client?.connected) {
      client.subscribe([symbol]);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(symbol);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this.subscriptions.delete(symbol);
          // Unsubscribe from WebSocket
          client?.unsubscribe([symbol]);
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // Price Data
  // -------------------------------------------------------------------------

  getPrice(symbol: string): PriceUpdate | null {
    return this.priceBuffer.get(symbol) ?? null;
  }

  getPrices(symbols: string[]): Map<string, PriceUpdate> {
    const result = new Map<string, PriceUpdate>();
    for (const symbol of symbols) {
      const price = this.priceBuffer.get(symbol);
      if (price) {
        result.set(symbol, price);
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private handlePriceUpdate(update: PriceUpdate, broker: 'tradovate' | 'alpaca'): void {
    // Store in buffer
    this.priceBuffer.set(update.symbol, update);

    // Notify subscribers
    const subs = this.subscriptions.get(update.symbol);
    if (subs) {
      for (const sub of subs) {
        if (sub.broker === broker) {
          sub.callback(update);
        }
      }
    }
  }

  private getTradovateSymbols(): string[] {
    const symbols: string[] = [];
    for (const [symbol, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.broker === 'tradovate') {
          symbols.push(symbol);
          break;
        }
      }
    }
    return symbols;
  }

  private getAlpacaSymbols(): string[] {
    const symbols: string[] = [];
    for (const [symbol, subs] of this.subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.broker === 'alpaca') {
          symbols.push(symbol);
          break;
        }
      }
    }
    return symbols;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  get connected(): boolean {
    return (this.tradovateClient?.connected ?? false) ||
           (this.alpacaClient?.connected ?? false);
  }

  getConnectionStatus(): { tradovate: boolean; alpaca: boolean } {
    return {
      tradovate: this.tradovateClient?.connected ?? false,
      alpaca: this.alpacaClient?.connected ?? false,
    };
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalMarketDataFeed: MarketDataFeed | null = null;

export function getMarketDataFeed(config?: MarketDataConfig): MarketDataFeed {
  if (!globalMarketDataFeed) {
    globalMarketDataFeed = new MarketDataFeed(config);
  }
  return globalMarketDataFeed;
}
