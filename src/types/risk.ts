/**
 * Risk Management Types
 * Types for risk configuration, position sizing, and circuit breakers
 */

// =============================================================================
// Risk Configuration
// =============================================================================

export interface RiskConfig {
  // Position risk
  maxRiskPerTradePercent: number; // Max account risk per trade
  maxPositionPercent: number; // Max single position as % of equity
  maxOrderValue: number; // Maximum order value in dollars
  minOrderValue: number; // Minimum order value in dollars

  // Portfolio risk
  maxDailyLossPercent: number; // Daily loss limit
  maxWeeklyLossPercent: number; // Weekly loss limit
  maxDrawdownPercent: number; // Max drawdown from peak
  maxConcurrentPositions: number; // Max open positions
  maxTotalExposurePercent: number; // Max total exposure (leverage allowed)
  maxFuturesExposurePercent: number; // Max futures exposure
  maxEquitiesExposurePercent: number; // Max equities exposure

  // Correlation risk
  maxCorrelatedConcentration: number; // Max concentration in correlated group
  correlationGroups: Record<string, CorrelationGroup>;

  // Circuit breakers
  consecutiveLossLimit: number; // Consecutive losses before cooldown
  cooldownMinutes: number; // Cooldown after consecutive losses

  // PDT
  pdtReserveDayTrades: number; // Day trades to reserve
}

export interface CorrelationGroup {
  name: string;
  symbols: string[];
  maxConcentration: number; // Max % of portfolio in this group
}

export const DEFAULT_CORRELATION_GROUPS: Record<string, CorrelationGroup> = {
  NASDAQ: {
    name: 'NASDAQ',
    symbols: ['MNQ', 'TQQQ', 'QQQ', 'NQ'],
    maxConcentration: 0.50,
  },
  SP500: {
    name: 'S&P 500',
    symbols: ['MES', 'SPY', 'SPXL', 'ES'],
    maxConcentration: 0.50,
  },
  SEMICONDUCTORS: {
    name: 'SEMICONDUCTORS',
    symbols: ['SOXL', 'SMH', 'NVDA', 'AMD'],
    maxConcentration: 0.40,
  },
  RUSSELL: {
    name: 'RUSSELL',
    symbols: ['M2K', 'IWM', 'TNA', 'RTY'],
    maxConcentration: 0.40,
  },
  CRUDE_OIL: {
    name: 'CRUDE OIL',
    symbols: ['MCL', 'CL', 'USO'],
    maxConcentration: 0.30,
  },
  GOLD: {
    name: 'GOLD',
    symbols: ['MGC', 'GC', 'GLD'],
    maxConcentration: 0.30,
  },
};

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxRiskPerTradePercent: 2,
  maxDailyLossPercent: 5,
  maxWeeklyLossPercent: 10,
  maxDrawdownPercent: 15,
  maxPositionPercent: 20,
  maxConcurrentPositions: 10,
  maxCorrelatedConcentration: 0.40,
  maxTotalExposurePercent: 200,
  maxFuturesExposurePercent: 150,
  maxEquitiesExposurePercent: 100,
  minOrderValue: 100,
  maxOrderValue: 50000,
  consecutiveLossLimit: 5,
  cooldownMinutes: 60,
  pdtReserveDayTrades: 1,
  correlationGroups: DEFAULT_CORRELATION_GROUPS,
};

// =============================================================================
// Position Sizing Types
// =============================================================================

export type SizingMethod = 'kelly' | 'fixed' | 'volatility' | 'reduced' | 'signal';

export interface PositionSize {
  quantity: number;
  notionalValue: number;
  riskAmount: number;
  method: SizingMethod;
  reasoning: string;
}

export interface PositionSizingContext {
  accountEquity: number;
  entryPrice: number;
  stopPrice: number;
  signalStrength: number;
  atr?: number;
  winRate?: number;
  avgWinLossRatio?: number;
  volatilityPercentile?: number;
}

// =============================================================================
// Risk Decision Types
// =============================================================================

export type RiskDecision = 'ALLOW' | 'BLOCK' | 'REDUCE';

export interface RiskEvaluation {
  decision: RiskDecision;
  positionSize?: PositionSize;
  reason: string;
  warnings: string[];
  checks: RiskCheck[];
}

export interface RiskCheck {
  name: string;
  passed: boolean;
  reason: string;
  severity: 'error' | 'warning' | 'info';
}

// =============================================================================
// Circuit Breaker Types
// =============================================================================

export type CircuitBreakerType =
  | 'DAILY_LOSS'
  | 'WEEKLY_LOSS'
  | 'DRAWDOWN'
  | 'CONSECUTIVE_LOSSES'
  | 'POSITION_LIMIT'
  | 'MANUAL';

export type WarningLevel = 'OK' | 'CAUTION' | 'DANGER';

export interface CircuitBreakerStatus {
  triggered: boolean;
  type?: CircuitBreakerType;
  reason: string | null;
  until: number | null;
  warningLevel: WarningLevel;
  canReset: boolean;
}

export interface CircuitBreakerConfig {
  type: CircuitBreakerType;
  threshold: number;
  autoReset: boolean;
  resetCondition?: string;
}

// =============================================================================
// Exposure Types
// =============================================================================

export interface Exposure {
  total: number; // Total exposure as % of equity
  futures: number; // Futures exposure as % of equity
  equities: number; // Equities exposure as % of equity
  byGroup: Record<string, number>; // Exposure by correlation group
  longShort: {
    long: number;
    short: number;
    net: number;
  };
}

export interface ExposureCheck {
  withinLimits: boolean;
  currentExposure: Exposure;
  violations: string[];
  warnings: string[];
}

// =============================================================================
// Risk State Types
// =============================================================================

export interface RiskState {
  // Equity tracking
  startOfDayEquity: number;
  startOfWeekEquity: number;
  peakEquity: number;
  currentEquity: number;

  // P&L tracking
  dailyPnl: number;
  dailyPnlPercent: number;
  weeklyPnl: number;
  weeklyPnlPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;

  // Trading state
  consecutiveLosses: number;
  consecutiveWins: number;
  todayTradeCount: number;

  // Circuit breaker
  circuitBreakerTriggered: boolean;
  circuitBreakerUntil: number | null;
  circuitBreakerReason: string | null;

  // PDT tracking
  dayTradesUsed: number;
  dayTradesRemaining: number;
  tradingDay: string;

  // Metadata
  lastUpdated: number;
}

// =============================================================================
// PDT Types
// =============================================================================

export interface PDTInfo {
  isPdtRestricted: boolean;
  dayTradesUsed: number;
  dayTradesRemaining: number;
  dayTradesLimit: number;
  rollingWindowDays: number;
  windowHistory: PDTHistoryEntry[];
  exempt: boolean; // Accounts >= $25k
  alternativesAvailable: boolean;
}

export interface PDTHistoryEntry {
  date: string;
  tradesExecuted: number;
}

export interface FuturesAlternative {
  equitySymbol: string;
  futuresSymbol: string;
  description: string;
}

export const FUTURES_ALTERNATIVES: FuturesAlternative[] = [
  { equitySymbol: 'TQQQ', futuresSymbol: 'MNQ', description: 'Micro Nasdaq-100' },
  { equitySymbol: 'SPY', futuresSymbol: 'MES', description: 'Micro S&P 500' },
  { equitySymbol: 'IWM', futuresSymbol: 'M2K', description: 'Micro Russell 2000' },
];

// =============================================================================
// Time Filter Types
// =============================================================================

export type TradingSession = 'PRE_MARKET' | 'REGULAR_HOURS' | 'AFTER_HOURS' | 'CLOSED';

export interface TimeFilterResult {
  canTrade: boolean;
  session: TradingSession;
  strengthMultiplier: number; // 0 to 1
  reason: string;
}

export interface TimeFilterConfig {
  blockFirstMinutes: number; // Minutes after open to block
  blockLastMinutes: number; // Minutes before close to block
  preMarketStrength: number; // 0 to 1
  afterHoursStrength: number; // 0 to 1
  regularHoursStart: string; // HH:MM ET
  regularHoursEnd: string; // HH:MM ET
  preMarketStart: string; // HH:MM ET
  afterHoursEnd: string; // HH:MM ET
}

export const DEFAULT_TIME_FILTER_CONFIG: TimeFilterConfig = {
  blockFirstMinutes: 15,
  blockLastMinutes: 15,
  preMarketStrength: 0.8,
  afterHoursStrength: 0.6,
  regularHoursStart: '09:30',
  regularHoursEnd: '16:00',
  preMarketStart: '04:00',
  afterHoursEnd: '20:00',
};
