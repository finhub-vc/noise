/**
 * Alpaca Adapter
 * Implements broker adapter for Alpaca equities trading
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
import { createLogger, retryWithBackoff, BrokerError, OrderRejectedError } from '@/utils/index.js';

// =============================================================================
// Market Data Types
// =============================================================================

interface AlpacaQuote {
  symbol: string;
  bid_price: number;
  ask_price: number;
  last_trade_price: number;
  last_exchange: string;
  last_size: number;
  timestamp: string;
}

interface AlpacaBar {
  t: string;  // ISO 8601 datetime
  o: number;  // Open
  h: number;  // High
  l: number;  // Low
  c: number;  // Close
  v: number;  // Volume
}

const log = createLogger('ALPACA_ADAPTER');

export class AlpacaCredentials {
  constructor(
    public apiKey: string,
    public apiSecret: string,
    public baseUrl: string
  ) {}
}

export class AlpacaAdapter implements BrokerAdapter {
  private isConnectedFlag = false;

  constructor(
    private credentials: AlpacaCredentials
  ) {}

  async authenticate(): Promise<void> {
    // Alpaca uses API key auth - just validate credentials
    const response = await fetch(`${this.credentials.baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY': this.credentials.apiKey,
        'APCA-API-SECRET': this.credentials.apiSecret,
      },
    });

    if (!response.ok) {
      throw new BrokerError(`Alpaca authentication failed: ${response.status}`);
    }

    this.isConnectedFlag = true;
    log.info('Alpaca authenticated');
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  getBrokerType(): BrokerType {
    return 'ALPACA';
  }

  getAssetClass(): AssetClass {
    return 'EQUITY';
  }

  getSupportedSymbols(): string[] {
    return ['TQQQ', 'SOXL', 'SPXL', 'TNA', 'SPY', 'QQQ', 'IWM'];
  }

  async getAccount(): Promise<AccountInfo> {
    const response = await this.fetchWithAuth('/v2/account');

    if (!response.ok) {
      throw new BrokerError(`Failed to get account: ${response.status}`);
    }

    const data = await response.json() as AlpacaAccountResponse;

    return {
      broker: 'ALPACA',
      accountId: data.id,
      equity: parseFloat(data.equity),
      cash: parseFloat(data.cash),
      buyingPower: parseFloat(data.buying_power),
      lastUpdated: Date.now(),
    };
  }

  async getPositions(): Promise<UnifiedPosition[]> {
    const response = await this.fetchWithAuth('/v2/positions');

    if (!response.ok) {
      throw new BrokerError(`Failed to get positions: ${response.status}`);
    }

    const data = await response.json() as AlpacaPositionResponse[];

    return (data || []).map((pos) => this.mapPosition(pos));
  }

  async placeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const alpacaOrder = {
      symbol: order.symbol,
      side: order.side.toLowerCase(),
      type: order.type.toLowerCase(),
      qty: order.quantity,
      time_in_force: order.timeInForce,
      limit_price: order.limitPrice,
      stop_price: order.stopPrice,
      client_order_id: order.clientOrderId,
    };

    const response = await this.fetchWithAuth('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(alpacaOrder),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 422) {
        throw new OrderRejectedError(order.symbol, error);
      }
      throw new BrokerError(`Order failed: ${error}`);
    }

    const data = await response.json() as AlpacaOrderResponse;

    log.info('Order placed', { orderId: data.id, symbol: order.symbol });

    return {
      clientOrderId: order.clientOrderId,
      brokerOrderId: data.id,
      status: this.mapOrderStatus(data.status),
      filledQuantity: data.filled_qty || 0,
      avgFillPrice: data.filled_avg_price || undefined,
      timestamp: Date.now(),
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const response = await this.fetchWithAuth(`/v2/orders/${orderId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new BrokerError(`Cancel failed: ${response.status}`);
    }

    log.info('Order cancelled', { orderId });
  }

  async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    const response = await this.fetchWithAuth(`/v2/orders/${orderId}`);

    if (!response.ok) {
      throw new BrokerError(`Status check failed: ${response.status}`);
    }

    const data = await response.json() as AlpacaOrderResponse;

    return {
      orderId,
      status: this.mapOrderStatus(data.status),
      filledQuantity: data.filled_qty || 0,
      avgFillPrice: data.filled_avg_price || undefined,
      remainingQuantity: data.qty - (data.filled_qty || 0),
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  async getOpenOrders(): Promise<OrderStatusResult[]> {
    const response = await this.fetchWithAuth('/v2/orders?status=open');

    if (!response.ok) {
      throw new BrokerError(`Failed to get open orders: ${response.status}`);
    }

    const data = await response.json() as AlpacaOrderResponse[];

    return (data || []).map((order) => ({
      orderId: order.id,
      status: this.mapOrderStatus(order.status),
      filledQuantity: order.filled_qty || 0,
      avgFillPrice: order.filled_avg_price || undefined,
      remainingQuantity: order.qty - (order.filled_qty || 0),
      createdAt: new Date(order.created_at).getTime(),
      updatedAt: new Date(order.updated_at).getTime(),
    }));
  }

  private async fetchWithAuth(path: string, options?: RequestInit): Promise<Response> {
    return await retryWithBackoff(async () => {
      const response = await fetch(`${this.credentials.baseUrl}${path}`, {
        ...options,
        headers: {
          ...options?.headers,
          'APCA-API-KEY': this.credentials.apiKey,
          'APCA-API-SECRET': this.credentials.apiSecret,
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return response;
    });
  }

  private mapPosition(pos: AlpacaPositionResponse): UnifiedPosition {
    const side: PositionSide = pos.side === 'long' ? 'LONG' : 'SHORT';

    return {
      symbol: pos.symbol,
      assetClass: 'EQUITY',
      broker: 'ALPACA',
      side,
      quantity: pos.qty,
      entryPrice: pos.avg_entry_price || 0,
      currentPrice: pos.current_price || 0,
      marketValue: pos.market_value || 0,
      unrealizedPnl: pos.unrealized_pl || 0,
      updatedAt: new Date(pos.updated_at).getTime(),
    };
  }

  private mapOrderStatus(status: AlpacaOrderStatus): 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' {
    const validStatuses = ['PENDING', 'OPEN', 'FILLED', 'CANCELLED'] as const;
    const map: Record<AlpacaOrderStatus, typeof validStatuses[number]> = {
      'new': 'PENDING',
      'partially_filled': 'OPEN',
      'filled': 'FILLED',
      'cancelled': 'CANCELLED',
      'rejected': 'CANCELLED',
      'expired': 'CANCELLED',
      'pending_new': 'PENDING',
      'accepted': 'OPEN',
      'pending_cancel': 'PENDING',
      'stopped': 'CANCELLED',
    };
    return map[status] || 'PENDING';
  }

  // -------------------------------------------------------------------------
  // Market Data Methods
  // -------------------------------------------------------------------------

  /**
   * Fetch current quote for a symbol
   */
  async getQuote(symbol: string): Promise<AlpacaQuote | null> {
    try {
      const response = await this.fetchWithAuth(`/v2/stocks/${symbol}/quotes/latest`);

      if (!response.ok) {
        if (response.status === 404) {
          log.warn(`Symbol not found: ${symbol}`);
          return null;
        }
        throw new BrokerError(`Failed to get quote: ${response.status}`);
      }

      const data = await response.json() as { quote: AlpacaQuote };
      return data.quote;
    } catch (error) {
      log.error(`Failed to fetch quote for ${symbol}`, error as Error);
      return null;
    }
  }

  /**
   * Fetch quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Map<string, AlpacaQuote>> {
    const result = new Map<string, AlpacaQuote>();

    // Alpaca supports snapshot endpoint for multiple symbols
    try {
      const symbolsParam = symbols.join(',');
      const response = await this.fetchWithAuth(`/v2/stocks/snapshot?symbols=${symbolsParam}`);

      if (!response.ok) {
        // Fallback to individual requests
        log.warn('Batch quotes failed, falling back to individual requests');
        return this.getQuotesIndividually(symbols);
      }

      const data = await response.json() as Record<string, { latestQuote: AlpacaQuote } | null>;

      for (const [symbol, snapshot] of Object.entries(data)) {
        if (snapshot?.latestQuote) {
          result.set(symbol, snapshot.latestQuote);
        }
      }
    } catch (error) {
      log.error('Failed to fetch batch quotes', error as Error);
      return this.getQuotesIndividually(symbols);
    }

    return result;
  }

  private async getQuotesIndividually(symbols: string[]): Promise<Map<string, AlpacaQuote>> {
    const result = new Map<string, AlpacaQuote>();

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
   * @param symbol Stock symbol
   * @param timeframe Timeframe in minutes (1, 5, 15, 60, 1440 for daily)
   * @param limit Number of bars to fetch
   */
  async getHistoricalData(
    symbol: string,
    timeframe: number,
    limit: number = 100
  ): Promise<AlpacaBar[]> {
    // Map timeframe to Alpaca timespan
    let timespan = 'minute';
    let multiplier = 1;

    if (timeframe >= 1440) {
      timespan = 'day';
      multiplier = 1;
    } else if (timeframe >= 60) {
      timespan = 'hour';
      multiplier = Math.floor(timeframe / 60);
    } else {
      multiplier = timeframe;
    }

    try {
      const url = new URL(`${this.credentials.baseUrl}/v2/stocks/${symbol}/bars`);
      url.searchParams.set('timeframe', `${multiplier}${timespan}`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('adjustment', 'raw'); // No adjustment for splits/dividends

      const response = await this.fetchWithAuth(url.pathname + url.search);

      if (!response.ok) {
        throw new BrokerError(`Failed to get history: ${response.status}`);
      }

      const data = await response.json() as { bars: AlpacaBar[] | null };
      return data.bars || [];
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
      last: quote.last_trade_price,
      bid: quote.bid_price,
      ask: quote.ask_price,
      volume: quote.last_size,
      timestamp: new Date(quote.timestamp).getTime(),
    };
  }
}

// =============================================================================
// Alpaca API Response Types
// =============================================================================

interface AlpacaAccountResponse {
  id: string;
  equity: string;
  cash: string;
  buying_power: string;
  portfolio_value: string;
}

interface AlpacaPositionResponse {
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  updated_at: string;
}

interface AlpacaOrderResponse {
  id: string;
  status: AlpacaOrderStatus;
  filled_qty: number;
  filled_avg_price: number | null;
  qty: number;
  created_at: string;
  updated_at: string;
}

// Alpaca order status values
type AlpacaOrderStatus =
  | 'new'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'pending_new'
  | 'accepted'
  | 'pending_cancel'
  | 'stopped';
