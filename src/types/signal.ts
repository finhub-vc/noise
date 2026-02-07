/**
 * Signal Generation Types
 * Types for trading signals, indicators, and market regimes
 */

import type { AssetClass } from './broker.js';

export type { AssetClass } from './broker.js';

// =============================================================================
// Signal Direction
// =============================================================================

export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

// =============================================================================
// Indicator Result
// =============================================================================

export interface IndicatorResult {
  value: number;
  signal: SignalDirection;
  strength: number; // 0 to 1
  metadata: Record<string, unknown>;
}

// =============================================================================
// Market Regime
// =============================================================================

export type MarketRegime =
  | 'STRONG_TREND_UP'
  | 'STRONG_TREND_DOWN'
  | 'WEAK_TREND_UP'
  | 'WEAK_TREND_DOWN'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY';

export interface RegimeDetection {
  regime: MarketRegime;
  adx: number;
  atrPercentile: number;
  trendStrength: 'strong' | 'weak' | 'none';
  volatilityLevel: 'high' | 'normal' | 'low';
  timestamp: number;
}

// =============================================================================
// Strategy Signal
// =============================================================================

export interface StrategySignal {
  strategy: string;
  direction: SignalDirection;
  strength: number; // 0 to 1
  confidence: number; // 0 to 1
  reasons: string[];
  metadata: Record<string, unknown>;
}

// =============================================================================
// Timeframe
// =============================================================================

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

// =============================================================================
// Signal Types
// =============================================================================

export interface Signal {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  timeframe: Timeframe;
  direction: SignalDirection;
  strength: number; // 0 to 1
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskRewardRatio?: number;
  source: string; // Strategy name that generated the signal
  indicators: Record<string, IndicatorResult>;
  reasons: string[];
  regime: MarketRegime;
  timestamp: number;
  expiresAt: number;
  executedAt?: number;
  cancelledAt?: number;
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
}

// =============================================================================
// Market Data Types
// =============================================================================

export interface PriceBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  timeframe: Timeframe;
  bars: PriceBar[];
  lastUpdate: number;
}

// =============================================================================
// Indicator Calculation Result
// =============================================================================

export interface IndicatorValues {
  // Trend indicators
  sma?: { period: number; value: number }[];
  ema?: { period: number; value: number }[];

  // Momentum indicators
  rsi?: { period: number; value: number };
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };

  // Volatility indicators
  bollingerBands?: {
    period: number;
    stdDev: number;
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  atr?: { period: number; value: number; percentile: number };

  // Trend strength
  adx?: {
    period: number;
    adx: number;
    pdi: number;
    ndi: number;
  };

  // Volume indicators
  volume?: {
    current: number;
    sma: number;
    rvol: number; // Relative volume
  };
}

// =============================================================================
// Strategy Configuration
// =============================================================================

export interface StrategyConfig {
  name: string;
  weight: number; // Weight in combined signal (0 to 1)
  minStrength: number; // Minimum strength to generate signal
  preferredRegimes: MarketRegime[];
  timeframes: Timeframe[];
  enabled: boolean;
}

export const DEFAULT_STRATEGIES: StrategyConfig[] = [
  {
    name: 'momentum',
    weight: 0.4,
    minStrength: 0.6,
    preferredRegimes: ['STRONG_TREND_UP', 'STRONG_TREND_DOWN', 'WEAK_TREND_UP', 'WEAK_TREND_DOWN'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
  {
    name: 'meanReversion',
    weight: 0.3,
    minStrength: 0.6,
    preferredRegimes: ['RANGING', 'LOW_VOLATILITY'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
  {
    name: 'breakout',
    weight: 0.3,
    minStrength: 0.6,
    preferredRegimes: ['LOW_VOLATILITY', 'RANGING'],
    timeframes: ['15m', '1h'],
    enabled: true,
  },
];

// =============================================================================
// Signal Generation Configuration
// =============================================================================

export interface SignalConfig {
  minStrength: number;
  minConfirmingIndicators: number;
  primaryTimeframe: Timeframe;
  confirmationTimeframes: Timeframe[];
  requireMultiTimeframeConfirmation: boolean;
  stopLossAtrMultiple: number;
  takeProfitAtrMultiple: number;
  enableRegimeFilter: boolean;
  enableTimeFilter: boolean;
  enableVolatilityFilter: boolean;
  strategyWeights: Record<string, number>;
  signalExpirationMinutes: number;
}

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  minStrength: 0.6,
  minConfirmingIndicators: 2,
  primaryTimeframe: '15m',
  confirmationTimeframes: ['1h', '4h'],
  requireMultiTimeframeConfirmation: true,
  stopLossAtrMultiple: 2.0,
  takeProfitAtrMultiple: 3.0,
  enableRegimeFilter: true,
  enableTimeFilter: true,
  enableVolatilityFilter: true,
  strategyWeights: {
    momentum: 0.4,
    meanReversion: 0.3,
    breakout: 0.3,
  },
  signalExpirationMinutes: 60,
};
