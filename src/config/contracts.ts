/**
 * Futures Contract Specifications
 * Contract details for all supported futures contracts
 */

export interface FuturesContract {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  tickSize: number;
  tickValue: number;
  pointValue: number;
  contractSize: number;
  dayMargin: number;
  nightMargin: number;
  tradingHours: {
    open: string; // ET
    close: string; // ET
    sundayOpen?: string;
  };
}

export const FUTURES_CONTRACTS: Record<string, FuturesContract> = {
  MNQ: {
    symbol: 'MNQ',
    name: 'Micro E-mini Nasdaq-100',
    exchange: 'CME',
    currency: 'USD',
    tickSize: 0.25,
    tickValue: 0.50,
    pointValue: 2.00,
    contractSize: 2, // $2 per point
    dayMargin: 2100,
    nightMargin: 4200,
    tradingHours: {
      open: '18:00',
      close: '17:00',
      sundayOpen: '18:00',
    },
  },
  MES: {
    symbol: 'MES',
    name: 'Micro E-mini S&P 500',
    exchange: 'CME',
    currency: 'USD',
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5.00,
    contractSize: 5, // $5 per point
    dayMargin: 1500,
    nightMargin: 3000,
    tradingHours: {
      open: '18:00',
      close: '17:00',
      sundayOpen: '18:00',
    },
  },
  M2K: {
    symbol: 'M2K',
    name: 'Micro E-mini Russell 2000',
    exchange: 'CME',
    currency: 'USD',
    tickSize: 0.10,
    tickValue: 0.50,
    pointValue: 5.00,
    contractSize: 5, // $5 per point
    dayMargin: 850,
    nightMargin: 1700,
    tradingHours: {
      open: '18:00',
      close: '17:00',
      sundayOpen: '18:00',
    },
  },
  MCL: {
    symbol: 'MCL',
    name: 'Micro WTI Crude Oil',
    exchange: 'NYMEX',
    currency: 'USD',
    tickSize: 0.01,
    tickValue: 1.00,
    pointValue: 100, // $100 per point
    contractSize: 100, // 100 barrels
    dayMargin: 1200,
    nightMargin: 2400,
    tradingHours: {
      open: '18:00',
      close: '17:00',
      sundayOpen: '19:00',
    },
  },
  MGC: {
    symbol: 'MGC',
    name: 'Micro Gold',
    exchange: 'COMEX',
    currency: 'USD',
    tickSize: 0.10,
    tickValue: 1.00,
    pointValue: 10, // $10 per point
    contractSize: 10, // 10 ounces
    dayMargin: 1050,
    nightMargin: 2100,
    tradingHours: {
      open: '18:00',
      close: '17:00',
      sundayOpen: '18:00',
    },
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

export function getContract(symbol: string): FuturesContract | null {
  return FUTURES_CONTRACTS[symbol] || null;
}

export function calculateNotionalValue(
  symbol: string,
  quantity: number,
  price: number
): number {
  const contract = getContract(symbol);
  if (!contract) return quantity * price;

  // For futures, notional = contracts * price * pointValue
  return quantity * price * contract.pointValue;
}

export function calculatePnL(
  symbol: string,
  quantity: number,
  entryPrice: number,
  exitPrice: number
): number {
  const contract = getContract(symbol);
  if (!contract) return quantity * (exitPrice - entryPrice);

  // For futures: P&L = contracts * (exit - entry) * pointValue
  const priceDiff = exitPrice - entryPrice;
  return quantity * priceDiff * contract.pointValue;
}

export function isValidFuturesSymbol(symbol: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUTURES_CONTRACTS, symbol);
}

export function getAllFuturesSymbols(): string[] {
  return Object.keys(FUTURES_CONTRACTS);
}
