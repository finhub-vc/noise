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
  OrderSide,
  OrderType,
  PositionSide,
} from '@/types/broker.js';
import type { BrokerAdapter } from '../interfaces.js';
import { TradovateAuth } from './auth.js';
import { TRADOVATE_CONTRACTS, TRADOVATE_URLS } from './types.js';
import { createLogger, generateId, retryWithBackoff, BrokerError, OrderRejectedError } from '@/utils/index.js';

const log = createLogger('TRADOVATE_ADAPTER');

export class TradovateAdapter implements BrokerAdapter {
  private auth: TradovateAuth;
  private baseUrl: string;
  private isConnectedFlag = false;

  constructor(
    private db: D1Database,
    credentials: {
      username: string;
      password: string;
      appId: string;
      cid: string;
      secret: string;
    },
    isLive: boolean = false
  ) {
    this.auth = new TradovateAuth(db, credentials, isLive);
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

    const data = await response.json();
    const account = data[0]; // Tradovate returns array

    return {
      broker: 'TRADOVATE',
      accountId: String(account.accountId),
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

    const data = await response.json();

    return (data || []).map((pos: any) => this.mapPosition(pos));
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

    const data = await response.json();
    const orderId = data.orderId;

    log.info('Order placed', { orderId, symbol: order.symbol });

    return {
      clientOrderId: order.clientOrderId,
      brokerOrderId: String(orderId),
      status: this.mapOrderStatus(data.status),
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

    const data = await response.json();

    return {
      orderId,
      status: this.mapOrderStatus(data.status),
      filledQuantity: data.filledQuantity || 0,
      avgFillPrice: data.avgFillPrice,
      remainingQuantity: data.quantity - (data.filledQuantity || 0),
      createdAt: data.creationTimestamp,
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
}
