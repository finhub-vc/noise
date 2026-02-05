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
