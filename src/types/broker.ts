/**
 * Unified Broker Types
 * Provides a common interface for both Tradovate (futures) and Alpaca (equities)
 */

// =============================================================================
// Core Types
// =============================================================================

export type AssetClass = 'FUTURES' | 'EQUITY';
export type BrokerType = 'TRADOVATE' | 'ALPACA';
export type OrderSide = 'BUY' | 'SELL';
export type PositionSide = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK';
export type OrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

// =============================================================================
// Order Types
// =============================================================================

/**
 * Unified order representation across all brokers
 * Provides a common interface for order placement
 */
export interface UnifiedOrder {
  /** Client-generated unique order identifier */
  clientOrderId: string;
  /** Trading symbol (e.g., 'MNQ', 'TQQQ') */
  symbol: string;
  /** Asset class for broker routing */
  assetClass: AssetClass;
  /** Order direction */
  side: OrderSide;
  /** Order quantity (contracts or shares) */
  quantity: number;
  /** Order type */
  type: OrderType;
  /** Limit price (required for LIMIT and STOP_LIMIT orders) */
  limitPrice?: number;
  /** Stop price (required for STOP and STOP_LIMIT orders) */
  stopPrice?: number;
  /** Time in force */
  timeInForce: TimeInForce;
  /** Optional metadata for tracking */
  metadata?: Record<string, unknown>;
}

export interface OrderResult {
  clientOrderId: string;
  brokerOrderId?: string;
  status: OrderStatus;
  filledQuantity?: number;
  avgFillPrice?: number;
  message?: string;
  timestamp: number;
}

export interface OrderStatusResult {
  orderId: string;
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice?: number;
  remainingQuantity: number;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// Position Types
// =============================================================================

/**
 * Unified position representation across all brokers
 * Combines data from Tradovate and Alpaca positions
 */
export interface UnifiedPosition {
  /** Trading symbol */
  symbol: string;
  /** Asset class */
  assetClass: AssetClass;
  /** Broker holding the position */
  broker: BrokerType;
  /** Position side (LONG or SHORT) */
  side: PositionSide;
  /** Position quantity (positive for both LONG and SHORT) */
  quantity: number;
  /** Average entry price */
  entryPrice: number;
  /** Current market price */
  currentPrice: number;
  /** Total market value (quantity * currentPrice) */
  marketValue: number;
  /** Unrealized P&L (current value - entry value) */
  unrealizedPnl: number;
  /** Realized P&L from closed portions of this position */
  realizedPnl?: number;
  /** Last update timestamp (ms since epoch) */
  updatedAt: number;
}

// =============================================================================
// Account Types
// =============================================================================

export interface AccountInfo {
  broker: BrokerType;
  accountId: string;
  equity: number;
  cash: number;
  buyingPower: number;
  marginUsed?: number;
  marginAvailable?: number;
  lastUpdated: number;
}

export interface AggregatedAccount {
  totalEquity: number;
  totalCash: number;
  totalBuyingPower: number;
  positions: UnifiedPosition[];
  exposure: {
    total: number;
    futures: number;
    equities: number;
  };
  brokers: {
    tradovate?: AccountInfo;
    alpaca?: AccountInfo;
  };
}

// =============================================================================
// Broker Adapter Interface
// =============================================================================

/**
 * Unified interface for broker adapters
 * Implements common methods for Tradovate (futures) and Alpaca (equities)
 */
export interface BrokerAdapter {
  // Authentication
  /** Authenticate with the broker using credentials */
  authenticate(): Promise<void>;
  /** Refresh authentication token (if using OAuth) */
  refreshToken?(): Promise<void>;
  /** Check if currently authenticated */
  isConnected(): boolean;

  // Account
  /** Get account information including equity, cash, buying power */
  getAccount(): Promise<AccountInfo>;
  /** Get all open positions */
  getPositions(): Promise<UnifiedPosition[]>;

  // Orders
  /** Place a new order */
  placeOrder(order: UnifiedOrder): Promise<OrderResult>;
  /** Cancel an existing order */
  cancelOrder(orderId: string): Promise<void>;
  /** Get status of a specific order */
  getOrderStatus(orderId: string): Promise<OrderStatusResult>;
  /** Get all open orders (optional) */
  getOpenOrders?(): Promise<OrderStatusResult[]>;

  // Broker metadata
  /** Get the broker type */
  getBrokerType(): BrokerType;
  /** Get the asset class this broker handles */
  getAssetClass(): AssetClass;
  /** Get list of supported symbols */
  getSupportedSymbols(): string[];
}

// =============================================================================
// Broker-Specific Types
// =============================================================================

// Tradovate Types
export interface TradovateCredentials {
  username: string;
  password: string;
  appId: string;
  cid: string;
  secret: string;
}

export interface TradovateTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TradovateContract {
  contractId: number;
  symbol: string;
  exchange: string;
  product: string;
  description: string;
  tickSize: number;
  tickValue: number;
  pointValue: number;
  dayMargin: number;
  nightMargin: number;
}

/**
 * Tradovate micro futures contract specifications
 *
 * NOTE: contractId values are set to 0 and must be replaced with actual
 * Tradovate contract IDs before live trading. These can be obtained from:
 * - Tradovate API: GET /md/contracts
 * - Tradovate documentation
 * - Contacting Tradovate support
 *
 * Example actual IDs (may vary by environment):
 * - MNQ: ~423736194
 * - MES: ~423736182
 * - M2K: ~423736186
 * - MCL: ~423736190
 * - MGC: ~423736188
 */
export const TRADOVATE_CONTRACTS: Record<string, TradovateContract> = {
  MNQ: {
    contractId: 0, // TODO: Replace with actual Tradovate contract ID
    symbol: 'MNQ',
    exchange: 'CME',
    product: 'Micro E-mini Nasdaq-100',
    description: 'Micro Nasdaq-100',
    tickSize: 0.25,
    tickValue: 0.50,
    pointValue: 2.00,
    dayMargin: 2100,
    nightMargin: 4200,
  },
  MES: {
    contractId: 0, // TODO: Replace with actual Tradovate contract ID
    symbol: 'MES',
    exchange: 'CME',
    product: 'Micro E-mini S&P 500',
    description: 'Micro S&P 500',
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5.00,
    dayMargin: 1500,
    nightMargin: 3000,
  },
  M2K: {
    contractId: 0, // TODO: Replace with actual Tradovate contract ID
    symbol: 'M2K',
    exchange: 'CME',
    product: 'Micro E-mini Russell 2000',
    description: 'Micro Russell 2000',
    tickSize: 0.10,
    tickValue: 0.50,
    pointValue: 5.00,
    dayMargin: 850,
    nightMargin: 1700,
  },
  MCL: {
    contractId: 0, // TODO: Replace with actual Tradovate contract ID
    symbol: 'MCL',
    exchange: 'NYMEX',
    product: 'Micro WTI Crude Oil',
    description: 'Micro Crude Oil',
    tickSize: 0.01,
    tickValue: 1.00,
    pointValue: 100,
    dayMargin: 1200,
    nightMargin: 2400,
  },
  MGC: {
    contractId: 0, // TODO: Replace with actual Tradovate contract ID
    symbol: 'MGC',
    exchange: 'COMEX',
    product: 'Micro Gold',
    description: 'Micro Gold',
    tickSize: 0.10,
    tickValue: 1.00,
    pointValue: 10,
    dayMargin: 1050,
    nightMargin: 2100,
  },
};

// Alpaca Types
export interface AlpacaCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface AlpacaAccount {
  id: string;
  account_number: string;
  buying_power: string;
  cash: string;
  equity: string;
  long_market_value: string;
  short_market_value: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  daytrading_buying_power: string;
  regt_buying_power: string;
  last_equity: string;
  last_maintenance_margin: string;
  daytrade_count: number;
  accrued_fees: string;
  status: string;
}

export const ALPACA_SYMBOLS = [
  'TQQQ', // ProShares UltraPro QQQ
  'SOXL', // Direxion Daily Semiconductor Bull 3x
  'SPXL', // Direxion Daily S&P 500 Bull 3x
  'TNA',  // Direxion Daily Small Cap Bull 3x
  'SPY',  // SPDR S&P 500 ETF
  'QQQ',  // Invesco QQQ Trust
  'IWM',  // iShares Russell 2000 ETF
] as const;

export type AlpacaSymbol = typeof ALPACA_SYMBOLS[number];
