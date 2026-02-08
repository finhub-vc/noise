/**
 * Tradovate Types
 * Types for Tradovate API integration
 */

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

export interface TradovateTokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  updatedAt: number;
}

export interface TradovateAccount {
  accountId: number;
  name: string;
  accountTypeId: number;
  clearingAccountId: number;
}

export interface TradovatePosition {
  contractId: number;
  accountId: number;
  buySell: string; // 'Buy' or 'Sell'
  quantity: number;
  grossAvgPrice: number;
  netPosition: number;
  netPrice: number;
  currency: string;
}

export interface TradovateOrder {
  orderId: number;
  contractId: number;
  action: string; // 'Buy' or 'Sell'
  quantity: number;
  orderType: string; // 'Limit', 'Market', 'Stop', 'StopLimit'
  limitPrice?: number;
  stopPrice?: number;
  status: string; // 'Working', 'Filled', 'Cancelled', 'Rejected'
  filledQuantity: number;
  avgFillPrice: number;
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

export const TRADOVATE_CONTRACTS: Record<string, TradovateContract> = {
  MNQ: {
    contractId: 0,
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
    contractId: 0,
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
    contractId: 0,
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
    contractId: 0,
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
    contractId: 0,
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

export const TRADOVATE_URLS = {
  DEMO: 'https://demo.tradovateapi.com/v1',
  LIVE: 'https://live.tradovateapi.com/v1',
};

// =============================================================================
// Market Data Types
// =============================================================================

export interface TradovateQuote {
  contractId: number;
  lastTrade: number;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  volume: number;
  timestamp: number;
}

export interface TradovateOHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradovateHistoryRequest {
  contractId: number;
  barsCount: number;
  barType: string; // 'Minute' | 'Hour' | 'Day'
  interval: number; // 1, 5, 15, 60, etc.
}
