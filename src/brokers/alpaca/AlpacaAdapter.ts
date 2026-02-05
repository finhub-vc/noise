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
  OrderSide,
  PositionSide,
} from '@/types/broker.js';
import type { BrokerAdapter } from '../interfaces.js';
import { createLogger, generateId, retryWithBackoff, BrokerError, OrderRejectedError } from '@/utils/index.js';

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

    const data = await response.json();

    return {
      broker: 'ALPACA',
      accountId: data.id,
      equity: parseFloat(data.equity),
      cash: parseFloat(data.cash),
      buyingPower: parseFloat(data.buying_power || data.buying_power),
      lastUpdated: Date.now(),
    };
  }

  async getPositions(): Promise<UnifiedPosition[]> {
    const response = await this.fetchWithAuth('/v2/positions');

    if (!response.ok) {
      throw new BrokerError(`Failed to get positions: ${response.status}`);
    }

    const data = await response.json();

    return (data || []).map((pos: any) => this.mapPosition(pos));
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

    const data = await response.json();

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

    const data = await response.json();

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

    const data = await response.json();

    return (data || []).map((order: any) => ({
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

  private mapPosition(pos: any): UnifiedPosition {
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

  private mapOrderStatus(status: string): 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' {
    const map: Record<string, any> = {
      'new': 'PENDING',
      'partially_filled': 'OPEN',
      'filled': 'FILLED',
      'cancelled': 'CANCELLED',
      'rejected': 'CANCELLED',
      'expired': 'CANCELLED',
    };
    return map[status] || 'PENDING';
  }
}
