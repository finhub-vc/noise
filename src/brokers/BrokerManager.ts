/**
 * Broker Manager
 * Orchestrates dual-broker architecture with asset-class-based routing
 */

import type {
  AssetClass,
  UnifiedOrder,
  UnifiedPosition,
  AggregatedAccount,
  OrderResult,
} from '@/types/broker.js';
import type { BrokerAdapter } from './interfaces.js';
import { TradovateAdapter } from './tradovate/TradovateAdapter.js';
import { AlpacaAdapter, AlpacaCredentials } from './alpaca/AlpacaAdapter.js';
import { createLogger } from '@/utils/index.js';

const log = createLogger('BROKER_MANAGER');

export class BrokerManager {
  private adapters: Map<AssetClass, BrokerAdapter> = new Map();
  private tradovate: TradovateAdapter;
  private alpaca: AlpacaAdapter;

  constructor(
    _db: D1Database,
    _config: {
      tradovate: {
        username: string;
        password: string;
        appId: string;
        cid: string;
        secret: string;
      };
      alpaca: {
        apiKey: string;
        apiSecret: string;
        baseUrl: string;
      };
      tradovateLive?: boolean;
    }
  ) {
    // Initialize Alpaca
    this.alpaca = new AlpacaAdapter(
      new AlpacaCredentials(
        _config.alpaca.apiKey,
        _config.alpaca.apiSecret,
        _config.alpaca.baseUrl
      )
    );

    // Initialize Tradovate
    this.tradovate = new TradovateAdapter(
      _db,
      _config.tradovate,
      _config.tradovateLive || false
    );

    // Map asset classes to adapters
    this.adapters.set('FUTURES', this.tradovate);
    this.adapters.set('EQUITY', this.alpaca);
  }

  async authenticate(): Promise<void> {
    log.info('Authenticating all brokers...');

    await Promise.all([
      this.tradovate.authenticate(),
      this.alpaca.authenticate(),
    ]);

    log.info('All brokers authenticated');
  }

  async getAccount(): Promise<AggregatedAccount> {
    log.debug('Fetching aggregated account...');

    let tradovateError: Error | undefined;
    let alpacaError: Error | undefined;

    const [tradovateAccount, alpacaAccount] = await Promise.all([
      this.tradovate.getAccount().catch((e) => {
        tradovateError = e as Error;
        log.error('Failed to fetch Tradovate account', e as Error, { broker: 'TRADOVATE' });
        return null;
      }),
      this.alpaca.getAccount().catch((e) => {
        alpacaError = e as Error;
        log.error('Failed to fetch Alpaca account', e as Error, { broker: 'ALPACA' });
        return null;
      }),
    ]);

    // Log warnings when brokers fail
    if (tradovateError) {
      log.warn('Tradovate account unavailable - using partial data', { error: tradovateError.message });
    }
    if (alpacaError) {
      log.warn('Alpaca account unavailable - using partial data', { error: alpacaError.message });
    }

    const equity = (tradovateAccount?.equity ?? 0) + (alpacaAccount?.equity ?? 0);
    const cash = (tradovateAccount?.cash ?? 0) + (alpacaAccount?.cash ?? 0);
    const buyingPower = (tradovateAccount?.buyingPower ?? 0) + (alpacaAccount?.buyingPower ?? 0);

    // Get all positions
    const positions = await this.getAllPositions();

    // Calculate exposure
    const futuresValue = positions
      .filter(p => p.assetClass === 'FUTURES')
      .reduce((sum, p) => sum + p.marketValue, 0);
    const equitiesValue = positions
      .filter(p => p.assetClass === 'EQUITY')
      .reduce((sum, p) => sum + p.marketValue, 0);

    return {
      totalEquity: equity,
      totalCash: cash,
      totalBuyingPower: buyingPower,
      positions,
      exposure: {
        total: futuresValue + equitiesValue,
        futures: futuresValue,
        equities: equitiesValue,
      },
      brokers: {
        tradovate: tradovateAccount ?? undefined,
        alpaca: alpacaAccount ?? undefined,
      },
    };
  }

  async getAllPositions(): Promise<UnifiedPosition[]> {
    log.debug('Fetching all positions...');

    const [tradovatePositions, alpacaPositions] = await Promise.all([
      this.tradovate.getPositions().catch((e) => {
        log.error('Failed to fetch Tradovate positions', e as Error, { broker: 'TRADOVATE' });
        return [];
      }),
      this.alpaca.getPositions().catch((e) => {
        log.error('Failed to fetch Alpaca positions', e as Error, { broker: 'ALPACA' });
        return [];
      }),
    ]);

    return [...tradovatePositions, ...alpacaPositions];
  }

  async placeOrder(order: UnifiedOrder): Promise<OrderResult> {
    const adapter = this.selectAdapter(order.assetClass);
    log.info(`Placing ${order.assetClass} order via ${adapter.getBrokerType()}`);

    return await adapter.placeOrder(order);
  }

  async cancelOrder(orderId: string, assetClass: AssetClass): Promise<void> {
    const adapter = this.selectAdapter(assetClass);
    await adapter.cancelOrder(orderId);
  }

  healthCheck(): { tradovate: boolean; alpaca: boolean } {
    return {
      tradovate: this.tradovate.isConnected(),
      alpaca: this.alpaca.isConnected(),
    };
  }

  private selectAdapter(assetClass: AssetClass): BrokerAdapter {
    const adapter = this.adapters.get(assetClass);
    if (!adapter) {
      throw new Error(`No adapter found for asset class: ${assetClass}`);
    }
    return adapter;
  }

  // Get supported symbols for each broker
  getSupportedSymbols(): { futures: string[]; equities: string[] } {
    return {
      futures: this.tradovate.getSupportedSymbols(),
      equities: this.alpaca.getSupportedSymbols(),
    };
  }

  // Get futures alternatives for equity symbols
  getFuturesAlternative(equitySymbol: string): string | null {
    const alternatives: Record<string, string> = {
      'TQQQ': 'MNQ',
      'SPY': 'MES',
      'IWM': 'M2K',
      'QQQ': 'MNQ',
    };
    return alternatives[equitySymbol] || null;
  }
}
