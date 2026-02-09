/**
 * Tradovate Adapter
 * Implements broker adapter for Tradovate futures trading
 */

import type {
  AssetClass,
  BrokerType,
  UnifiedOrder,
  UnifiedPosition,
  OrderResult,
  OrderStatusResult,
  AccountInfo,
  PositionSide,
} from '@/types/broker.js';
import type { BrokerAdapter } from '../interfaces.js';
import type { TradovateQuote, TradovateOHLC } from './types.js';
import { TradovateAuth } from './auth.js';
import { TRADOVATE_CONTRACTS, TRADOVATE_URLS } from './types.js';
import { createLogger, retryWithBackoff, BrokerError, OrderRejectedError } from '@/utils/index.js';

const log = createLogger('TRADOVATE_ADAPTER');

export class TradovateAdapter implements BrokerAdapter {
  private auth: TradovateAuth;
  private baseUrl: string;
  private isConnectedFlag = false;

  constructor(
    _db: D1Database,
    credentials: {
      username: string;
      password: string;
      appId: string;
      cid: string;
      secret: string;
    },
    isLive: boolean = false
  ) {
    this.auth = new TradovateAuth(_db, credentials, isLive);
    this.baseUrl = isLive ? TRADOVATE_URLS.LIVE : TRADOVATE_URLS.DEMO;
  }

  async authenticate(): Promise<void> {
    await this.auth.authenticate();
    this.isConnectedFlag = true;
    log.info('Tradovate authenticated');
  }

  async refreshToken(): Promise<void> {
    await this.auth.refreshToken();
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  getBrokerType(): BrokerType {
    return 'TRADOVATE';
  }

  getAssetClass(): AssetClass {
    return 'FUTURES';
  }

  getSupportedSymbols(): string[] {
    return Object.keys(TRADOVATE_CONTRACTS);
  }

  async getAccount(): Promise<AccountInfo> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const response = await this.fetchWithAuth('/account/account', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new BrokerError(`Failed to get account: ${response.status}`);
    }

    const data = await response.json() as unknown[];
    const account = data[0] as Record<string, unknown> | undefined; // Tradovate returns array

    return {
      broker: 'TRADOVATE',
      accountId: account ? String(account.accountId) : '',
      equity: 0, // Tradovate doesn't provide this directly
      cash: 0,
      buyingPower: 0,
      lastUpdated: Date.now(),
    };
  }

  async getPositions(): Promise<UnifiedPosition[]> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const response = await this.fetchWithAuth('/position/getPositions', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new BrokerError(`Failed to get positions: ${response.status}`);
    }

    const data = await response.json() as unknown[] | unknown;

    return (Array.isArray(data) ? data : []).map((pos) => this.mapPosition(pos));
  }

  async placeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const contract = TRADOVATE_CONTRACTS[order.symbol];
    if (!contract) {
      throw new BrokerError(`Unknown symbol: ${order.symbol}`);
    }

    // Tradovate order format
    const tradovateOrder = {
      contractId: contract.contractId,
      action: order.side === 'BUY' ? 'Buy' : 'Sell',
      orderType: this.mapOrderType(order.type),
      quantity: order.quantity,
      limitPrice: order.limitPrice || 0,
      stopPrice: order.stopPrice || 0,
    };

    const response = await this.fetchWithAuth('/order/placeOrder', {
      method: 'POST',
      body: JSON.stringify(tradovateOrder),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 400) {
        throw new OrderRejectedError(order.symbol, error);
      }
      throw new BrokerError(`Order failed: ${error}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const orderId = data.orderId as number | undefined;

    log.info('Order placed', { orderId, symbol: order.symbol });

    return {
      clientOrderId: order.clientOrderId,
      brokerOrderId: String(orderId),
      status: this.mapOrderStatus(String(data.status || '')),
      filledQuantity: 0,
      avgFillPrice: undefined,
      timestamp: Date.now(),
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const response = await this.fetchWithAuth('/order/cancelOrder', {
      method: 'POST',
      body: JSON.stringify({ orderId: parseInt(orderId, 10) }),
    });

    if (!response.ok) {
      throw new BrokerError(`Cancel failed: ${response.status}`);
    }

    log.info('Order cancelled', { orderId });
  }

  async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const response = await this.fetchWithAuth('/order/status', {
      method: 'POST',
      body: JSON.stringify({ orderId: parseInt(orderId, 10) }),
    });

    if (!response.ok) {
      throw new BrokerError(`Status check failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      orderId,
      status: this.mapOrderStatus(String(data.status || '')),
      filledQuantity: (data.filledQuantity as number) || 0,
      avgFillPrice: data.avgFillPrice as number | undefined,
      remainingQuantity: (data.quantity as number) - ((data.filledQuantity as number) || 0),
      createdAt: (data.creationTimestamp as number | undefined) ?? Date.now(),
      updatedAt: Date.now(),
    };
  }

  private async fetchWithAuth(path: string, options?: RequestInit): Promise<Response> {
    const token = await this.auth.getAccessToken();

    return await retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...options?.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Retry on 401 (token expired) - refresh and retry once
      if (response.status === 401) {
        await this.refreshToken();
        throw new Error('Token expired, retrying...');
      }

      return response;
    });
  }

  private mapPosition(pos: any): UnifiedPosition {
    const side: PositionSide = pos.buySell === 'Buy' ? 'LONG' : 'SHORT';

    return {
      symbol: pos.contractSymbol || '',
      assetClass: 'FUTURES',
      broker: 'TRADOVATE',
      side,
      quantity: Math.abs(pos.netPosition),
      entryPrice: pos.grossAvgPrice,
      currentPrice: pos.grossAvgPrice, // Would need market data
      marketValue: pos.grossAvgPrice * Math.abs(pos.netPosition),
      unrealizedPnl: 0,
      updatedAt: Date.now(),
    };
  }

  private mapOrderType(type: string): string {
    const map: Record<string, string> = {
      'MARKET': 'Market',
      'LIMIT': 'Limit',
      'STOP': 'Stop',
      'STOP_LIMIT': 'StopLimit',
    };
    return map[type] || 'Limit';
  }

  private mapOrderStatus(status: string): 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' {
    const map: Record<string, any> = {
      'Working': 'OPEN',
      'Filled': 'FILLED',
      'Cancelled': 'CANCELLED',
      'Rejected': 'CANCELLED',
    };
    return map[status] || 'PENDING';
  }

  // -------------------------------------------------------------------------
  // Market Data Methods
  // -------------------------------------------------------------------------

  /**
   * Fetch current quote for a symbol
   */
  async getQuote(symbol: string): Promise<TradovateQuote | null> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const contract = TRADOVATE_CONTRACTS[symbol];
    if (!contract) {
      log.warn(`Unknown symbol for quote: ${symbol}`);
      return null;
    }

    try {
      const response = await this.fetchWithAuth('/md/getQuote', {
        method: 'POST',
        body: JSON.stringify({ contractId: contract.contractId }),
      });

      if (!response.ok) {
        throw new BrokerError(`Failed to get quote: ${response.status}`);
      }

      const data = await response.json() as TradovateQuote;
      return data;
    } catch (error) {
      log.error(`Failed to fetch quote for ${symbol}`, error as Error);
      return null;
    }
  }

  /**
   * Fetch quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Map<string, TradovateQuote>> {
    const result = new Map<string, TradovateQuote>();

    await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await this.getQuote(symbol);
        if (quote) {
          result.set(symbol, quote);
        }
      })
    );

    return result;
  }

  /**
   * Fetch historical OHLCV data
   * @param symbol Contract symbol
   * @param timeframe Timeframe in minutes (1, 5, 15, 60, 1440 for daily)
   * @param limit Number of bars to fetch
   */
  async getHistoricalData(
    symbol: string,
    timeframe: number,
    limit: number = 100
  ): Promise<TradovateOHLC[]> {
    const token = await this.auth.getAccessToken();
    if (!token) throw new BrokerError('Not authenticated');

    const contract = TRADOVATE_CONTRACTS[symbol];
    if (!contract) {
      throw new BrokerError(`Unknown symbol: ${symbol}`);
    }

    // Determine bar type and interval
    let barType = 'Minute';
    let interval = timeframe;

    if (timeframe >= 1440) {
      barType = 'Day';
      interval = 1;
    } else if (timeframe >= 60) {
      barType = 'Hour';
      interval = Math.floor(timeframe / 60);
    }

    try {
      const response = await this.fetchWithAuth('/chart/history', {
        method: 'POST',
        body: JSON.stringify({
          contractId: contract.contractId,
          barsCount: limit,
          barType,
          interval,
        }),
      });

      if (!response.ok) {
        throw new BrokerError(`Failed to get history: ${response.status}`);
      }

      const data = await response.json() as unknown;
      const bars = (data as Record<string, unknown>).bars as TradovateOHLC[] | undefined;

      return bars || [];
    } catch (error) {
      log.error(`Failed to fetch historical data for ${symbol}`, error as Error);
      throw new BrokerError(`Historical data fetch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get real-time market data for a symbol
   * Returns the latest price with timestamp
   */
  async getMarketData(symbol: string): Promise<{
    last: number;
    bid: number;
    ask: number;
    volume: number;
    timestamp: number;
  } | null> {
    const quote = await this.getQuote(symbol);
    if (!quote) return null;

    return {
      last: quote.lastTrade,
      bid: quote.bidPrice,
      ask: quote.askPrice,
      volume: quote.volume,
      timestamp: quote.timestamp,
    };
  }
}
