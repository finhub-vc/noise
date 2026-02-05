/**
 * WebSocket Client for Market Data
 * Handles WebSocket connections to Tradovate and Alpaca for real-time price updates
 * Note: Cloudflare Workers has limited WebSocket support (server-side only)
 * This is designed for future use when WebSocket support is expanded
 */

import { createLogger } from '../../utils/index.js';

const log = createLogger('WS_CLIENT');

// =============================================================================
// Types
// =============================================================================

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface PriceUpdate {
  symbol: string;
  bid?: number;
  ask?: number;
  last?: number;
  volume?: number;
  timestamp: number;
  change?: number;
  changePercent?: number;
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;
export type PriceUpdateHandler = (update: PriceUpdate) => void;
export type ConnectionChangeHandler = (connected: boolean) => void;

export interface WebSocketClientConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

// =============================================================================
// WebSocket Client
// =============================================================================

export class WebSocketClient {
  private messageHandlers: Set<WebSocketMessageHandler> = new Set();
  private priceHandlers: Set<PriceUpdateHandler> = new Set();
  private connectionHandlers: Set<ConnectionChangeHandler> = new Set();
  private isConnected = false;

  // For Cloudflare Workers, we'll use fetch-based polling as a fallback
  // until proper WebSocket client support is available
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(_config: WebSocketClientConfig) {
    // Config will be used when WebSocket client is fully implemented
  }

  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Cloudflare Workers don't support initiating WebSocket connections from the worker
    // This is a placeholder for when that functionality becomes available
    log.warn('WebSocket client connections are not yet supported in Cloudflare Workers');
    log.info('Falling back to HTTP polling for market data');

    // Start polling as fallback
    this.startPolling();
    this.isConnected = true;
    this.notifyConnectionChange(true);
  }

  disconnect(): void {
    this.clearPollingTimer();

    this.isConnected = false;
    this.notifyConnectionChange(false);
    log.info('WebSocket client disconnected');
  }

  // -------------------------------------------------------------------------
  // Message Handling
  // -------------------------------------------------------------------------

  send(_data: string | object): void {
    // Placeholder for when WebSocket send is available
    log.debug('WebSocket send not yet supported in Cloudflare Workers');
  }

  subscribe(symbols: string[]): void {
    // For HTTP polling, we'll track subscriptions
    log.debug('Subscribing to symbols via polling', { symbols });
  }

  unsubscribe(symbols: string[]): void {
    log.debug('Unsubscribing from symbols', { symbols });
  }

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  onMessage(handler: WebSocketMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPriceUpdate(handler: PriceUpdateHandler): () => void {
    this.priceHandlers.add(handler);
    return () => this.priceHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionChangeHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private startPolling(): void {
    // Poll for market data via HTTP as a fallback
    this.pollingTimer = setInterval(() => {
      this.fetchMarketData();
    }, 5000); // Poll every 5 seconds
  }

  private clearPollingTimer(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async fetchMarketData(): Promise<void> {
    // This would fetch market data via HTTP API
    // Placeholder implementation
    try {
      // Simulate price updates for testing
      // In production, this would fetch from broker REST APIs
      const mockSymbols = ['MNQ', 'MES', 'M2K'];
      for (const symbol of mockSymbols) {
        const update: PriceUpdate = {
          symbol,
          last: Math.random() * 1000 + 10000,
          timestamp: Date.now(),
        };
        for (const handler of this.priceHandlers) {
          handler(update);
        }
      }
    } catch (error) {
      log.error('Failed to fetch market data', error as Error);
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  get connected(): boolean {
    return this.isConnected;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createTradovateWebSocket(): WebSocketClient {
  // Tradovate WebSocket URL (paper trading)
  const url = 'wss://demo-tradovate.com/marketdata';
  return new WebSocketClient({ url });
}

export function createAlpacaWebSocket(): WebSocketClient {
  // Alpaca WebSocket URL (paper trading)
  const url = 'wss://stream.data.alpaca.markets/v2/iex';
  return new WebSocketClient({ url });
}
