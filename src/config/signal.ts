/**
 * Signal Configuration
 * Default signal generation parameters for the NOISE trading engine
 */

import type { SignalConfig, StrategyConfig } from '@/types/signal.js';

// =============================================================================
// Strategy Configurations
// =============================================================================

export const STRATEGY_CONFIGS: Record<string, StrategyConfig> = {
  momentum: {
    name: 'momentum',
    weight: 0.4,
    minStrength: 0.6,
    preferredRegimes: ['STRONG_TREND_UP', 'STRONG_TREND_DOWN', 'WEAK_TREND_UP', 'WEAK_TREND_DOWN'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
  meanReversion: {
    name: 'meanReversion',
    weight: 0.3,
    minStrength: 0.6,
    preferredRegimes: ['RANGING', 'LOW_VOLATILITY'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
  breakout: {
    name: 'breakout',
    weight: 0.3,
    minStrength: 0.6,
    preferredRegimes: ['LOW_VOLATILITY', 'RANGING'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
};

// =============================================================================
// Default Signal Configuration
// =============================================================================

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  minStrength: 0.6, // Minimum signal strength to execute
  minConfirmingIndicators: 2, // Min indicators that must agree
  primaryTimeframe: '15m',
  confirmationTimeframes: ['1h', '4h'],
  requireMultiTimeframeConfirmation: true,
  stopLossAtrMultiple: 2.0, // Stop loss at 2x ATR
  takeProfitAtrMultiple: 3.0, // Take profit at 3x ATR
  enableRegimeFilter: true,
  enableTimeFilter: true,
  enableVolatilityFilter: true,
  strategyWeights: {
    momentum: 0.4,
    meanReversion: 0.3,
    breakout: 0.3,
  },
  signalExpirationMinutes: 60, // Signals expire after 1 hour
};

// =============================================================================
// Indicator Parameters
// =============================================================================

export const INDICATOR_PARAMS = {
  RSI: {
    period: 14,
    oversold: 30,
    overbought: 70,
  },
  MACD: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  },
  BollingerBands: {
    period: 20,
    stdDev: 2,
    squeezeThreshold: 0.5, // Bandwidth < 50% of average = squeeze
  },
  ATR: {
    period: 14,
    highVolatilityThreshold: 80, // Percentile
    lowVolatilityThreshold: 20, // Percentile
  },
  ADX: {
    period: 14,
    strongTrendThreshold: 40,
    weakTrendThreshold: 25,
  },
  Volume: {
    period: 20,
    highVolumeThreshold: 1.5, // RVOL multiple
  },
} as const;

// =============================================================================
// Time Filter Configuration
// =============================================================================

export const TIME_FILTER_CONFIG = {
  blockFirstMinutes: 15, // Block 15 min after open
  blockLastMinutes: 15, // Block 15 min before close
  preMarketStrength: 0.8, // 80% signal strength pre-market
  afterHoursStrength: 0.6, // 60% signal strength after-hours
  regularHoursStart: '09:30', // ET
  regularHoursEnd: '16:00', // ET
  preMarketStart: '04:00', // ET
  afterHoursEnd: '20:00', // ET
} as const;

// =============================================================================
// Market Sessions
// =============================================================================

export type TradingSession = 'PRE_MARKET' | 'REGULAR_HOURS' | 'AFTER_HOURS' | 'CLOSED';

export interface SessionConfig {
  name: TradingSession;
  startHour: number; // 24-hour ET
  startMinute: number; // 0-59
  endHour: number; // 24-hour ET
  endMinute: number; // 0-59
  strengthMultiplier: number; // 0-1
  allowNewEntries: boolean;
}

export const TRADING_SESSIONS: SessionConfig[] = [
  {
    name: 'PRE_MARKET',
    startHour: 4,
    endHour: 9,
    startMinute: 30,
    endMinute: 30,
    strengthMultiplier: 0.8,
    allowNewEntries: true,
  },
  {
    name: 'REGULAR_HOURS',
    startHour: 9,
    endHour: 16,
    startMinute: 30,
    endMinute: 0,
    strengthMultiplier: 1.0,
    allowNewEntries: true,
  },
  {
    name: 'AFTER_HOURS',
    startHour: 16,
    endHour: 20,
    startMinute: 0,
    endMinute: 0,
    strengthMultiplier: 0.6,
    allowNewEntries: true,
  },
];

// =============================================================================
// Supported Symbols
// =============================================================================

export const WATCHED_SYMBOLS = {
  futures: ['MNQ', 'MES', 'M2K', 'MCL', 'MGC'],
  equities: ['TQQQ', 'SOXL', 'SPXL', 'TNA', 'SPY'],
} as const;

// =============================================================================
// Environment-specific configuration
// =============================================================================

export function getSignalConfig(env: string = 'development'): SignalConfig {
  const config = { ...DEFAULT_SIGNAL_CONFIG };

  if (env === 'production') {
    return config;
  }

  // Development uses stricter filters
  return {
    ...config,
    minStrength: 0.7,
    minConfirmingIndicators: 3,
    requireMultiTimeframeConfirmation: true,
  };
}
